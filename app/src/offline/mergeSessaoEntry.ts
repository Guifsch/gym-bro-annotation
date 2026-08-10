import type { UpsertEntryParams } from '@/api/workoutApi';
import type { Exercicio, Sessao, SessaoEntry } from '@/types/workout';

/**
 * Client-side mirror of the server's partial-upsert semantics (PUT /api/sessoes/entries),
 * so a save can be applied to the UI instantly — before the mutation even reaches the queue,
 * let alone the network — without waiting for a round trip that might be delayed by a cold Render instance.
 * Unspecified fields fall back to the existing entry's value, then to the exercicio's current default
 * (mirrors the server's "pré-preenche na primeira vez" behavior).
 */
export function mergeSessaoEntry(sessao: Sessao, exercicio: Exercicio, params: UpsertEntryParams): Sessao {
  const now = new Date().toISOString();
  const index = sessao.entries.findIndex((entry) => entry.exercicioId === params.exercicioId);
  const existing = index >= 0 ? sessao.entries[index] : undefined;

  const merged: SessaoEntry = {
    _id: existing?._id ?? params.exercicioId,
    exercicioId: params.exercicioId,
    sets: params.sets ?? existing?.sets ?? exercicio.sets,
    reps: params.reps ?? existing?.reps ?? exercicio.reps,
    pesoKg: params.pesoKg ?? existing?.pesoKg ?? exercicio.pesoKg,
    updatedAt: now,
  };

  const entries = [...sessao.entries];
  if (index >= 0) {
    entries[index] = merged;
  } else {
    entries.push(merged);
  }

  return { ...sessao, entries };
}
