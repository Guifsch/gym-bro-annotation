import * as Crypto from 'expo-crypto';

import { upsertSessaoEntry, type UpsertEntryParams } from '@/api/workoutApi';

import { readJson, writeJson } from './storage';

const QUEUE_STORAGE_KEY = 'gymbro.mutationQueue.v1';
const BASE_BACKOFF_MS = 2_000;
const MAX_BACKOFF_MS = 60_000;

interface QueuedMutation {
  id: string;
  kind: 'upsertSessaoEntry';
  payload: UpsertEntryParams;
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
    case 'upsertSessaoEntry':
      await upsertSessaoEntry(mutation.payload);
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
      } catch {
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

export async function enqueueUpsertSessaoEntry(payload: UpsertEntryParams): Promise<void> {
  await ensureInitialized();
  queue.push({
    id: Crypto.randomUUID(),
    kind: 'upsertSessaoEntry',
    payload,
    attempts: 0,
    nextAttemptAt: Date.now(),
  });
  notifyListeners();
  await persist();
  void drainQueue();
}
