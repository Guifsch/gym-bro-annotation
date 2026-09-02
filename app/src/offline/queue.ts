import { isAxiosError } from 'axios';
import * as Crypto from 'expo-crypto';

import { getApiErrorMessage } from '@/api/apiClient';
import { updateExercicio, type UpdateExercicioParams } from '@/api/workoutApi';
import { showToast } from '@/components/toast';

import { readJson, writeJson } from './storage';

/** A 4xx means the server actively rejected the request (bad value, not found, etc.) — retrying the
 * exact same payload will never succeed, unlike a network blip or a 5xx from a cold/overloaded server. */
function isPermanentFailure(err: unknown): boolean {
  const status = isAxiosError(err) ? err.response?.status : undefined;
  return typeof status === 'number' && status >= 400 && status < 500;
}

const QUEUE_STORAGE_KEY = 'gymbro.mutationQueue.v1';
const BASE_BACKOFF_MS = 2_000;
const MAX_BACKOFF_MS = 60_000;

interface UpdateExercicioPayload {
  exercicioId: string;
  fields: UpdateExercicioParams;
}

interface QueuedMutation {
  id: string;
  kind: 'updateExercicio';
  payload: UpdateExercicioPayload;
  attempts: number;
  nextAttemptAt: number;
}

let queue: QueuedMutation[] = [];
let initialized = false;
let loadPromise: Promise<void> | null = null;
let draining = false;
let listeners: ((pendingCount: number) => void)[] = [];

function notifyListeners(): void {
  for (const listener of listeners) listener(queue.length);
}

/** Subscribe to the pending-mutation count, e.g. to render a subtle "syncing" indicator. Never used to block the UI. */
export function subscribeQueueSize(listener: (pendingCount: number) => void): () => void {
  listeners.push(listener);
  listener(queue.length);
  return () => {
    listeners = listeners.filter((l) => l !== listener);
  };
}

function persist(): Promise<void> {
  return writeJson(QUEUE_STORAGE_KEY, queue);
}

async function ensureInitialized(): Promise<void> {
  if (initialized) return;
  loadPromise ??= readJson<QueuedMutation[]>(QUEUE_STORAGE_KEY, []).then((loaded) => {
    queue = loaded;
    initialized = true;
    notifyListeners();
  });
  await loadPromise;
}

async function executeMutation(mutation: QueuedMutation): Promise<void> {
  switch (mutation.kind) {
    case 'updateExercicio':
      await updateExercicio(mutation.payload.exercicioId, mutation.payload.fields);
      return;
  }
}

/** Drains the queue sequentially. Safe to call repeatedly/concurrently — re-entrant calls are no-ops while one is in flight. */
export async function drainQueue(): Promise<void> {
  await ensureInitialized();
  if (draining) return;
  draining = true;

  try {
    while (queue.length > 0) {
      const mutation = queue[0];
      if (mutation.nextAttemptAt > Date.now()) break;

      try {
        await executeMutation(mutation);
        queue.shift();
        await persist();
        notifyListeners();
      } catch (err) {
        if (isPermanentFailure(err)) {
          // Drop it instead of retrying forever, and move on — otherwise this single bad mutation
          // blocks every valid one queued after it, indefinitely.
          queue.shift();
          await persist();
          notifyListeners();
          showToast(getApiErrorMessage(err, 'Não foi possível salvar uma alteração pendente.'), 'error');
          continue;
        }

        mutation.attempts += 1;
        const backoff = Math.min(MAX_BACKOFF_MS, BASE_BACKOFF_MS * 2 ** mutation.attempts) + Math.random() * 500;
        mutation.nextAttemptAt = Date.now() + backoff;
        await persist();
        break;
      }
    }
  } finally {
    draining = false;
  }
}

/** Queues a partial `Exercicio` update (nome/descrição/sets/reps/pesoKg/etc.) — used for every
 * exercise edit that can plausibly happen mid-workout with bad gym connectivity: the quick
 * sets/reps/kg row and the full edit screen alike, from either the calendar or the Exercícios tab.
 * Same target endpoint (`PATCH /api/exercicios/:id`) as a direct `updateExercicio()` call — this
 * just makes it resilient to being offline when it fires. */
export async function enqueueUpdateExercicio(payload: UpdateExercicioPayload): Promise<void> {
  await ensureInitialized();
  queue.push({
    id: Crypto.randomUUID(),
    kind: 'updateExercicio',
    payload,
    attempts: 0,
    nextAttemptAt: Date.now(),
  });
  notifyListeners();
  await persist();
  void drainQueue();
}
