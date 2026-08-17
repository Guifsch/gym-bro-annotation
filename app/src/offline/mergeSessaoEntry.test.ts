import assert from 'node:assert/strict';
import { test } from 'node:test';

import { mergeSessaoEntry } from './mergeSessaoEntry';
import type { Exercicio, Sessao } from '@/types/workout';

const exercicio: Exercicio = {
  _id: 'exercicio-supino',
  categoriaId: 'categoria-peito',
  nome: 'Supino',
  sets: 3,
  reps: 10,
  pesoKg: 30,
  imagens: [],
  videoUrls: [],
};

const emptySessao: Sessao = {
  _id: 'sessao-1',
  treinoId: 'treino-1',
  date: '2026-08-03',
  entries: [],
};

test('creates the first entry pre-filled from the exercicio default when only one field is sent', () => {
  const result = mergeSessaoEntry(emptySessao, exercicio, {
    sessaoId: emptySessao._id,
    exercicioId: exercicio._id,
    pesoKg: 35,
  });

  assert.equal(result.entries.length, 1);
  const entry = result.entries[0];
  assert.equal(entry.pesoKg, 35, 'weight uses the value sent');
  assert.equal(entry.sets, 3, 'sets pre-filled from exercicio default');
  assert.equal(entry.reps, 10, 'reps pre-filled from exercicio default');
});

test('applies a partial update in place without duplicating the entry', () => {
  const first = mergeSessaoEntry(emptySessao, exercicio, {
    sessaoId: emptySessao._id,
    exercicioId: exercicio._id,
    sets: 3,
    reps: 10,
    pesoKg: 30,
  });
  const second = mergeSessaoEntry(first, exercicio, {
    sessaoId: emptySessao._id,
    exercicioId: exercicio._id,
    pesoKg: 35,
  });

  assert.equal(second.entries.length, 1);
  const entry = second.entries[0];
  assert.equal(entry.pesoKg, 35, 'weight updated');
  assert.equal(entry.sets, 3, 'sets preserved from the previous merge');
  assert.equal(entry.reps, 10, 'reps preserved from the previous merge');
});

test('keeps other exercises in the session untouched', () => {
  const withSupino = mergeSessaoEntry(emptySessao, exercicio, {
    sessaoId: emptySessao._id,
    exercicioId: exercicio._id,
    sets: 3,
    reps: 10,
    pesoKg: 30,
  });

  const agachamento: Exercicio = { ...exercicio, _id: 'exercicio-agachamento', nome: 'Agachamento' };
  const withAgachamento = mergeSessaoEntry(withSupino, agachamento, {
    sessaoId: emptySessao._id,
    exercicioId: agachamento._id,
    sets: 4,
    reps: 8,
    pesoKg: 40,
  });

  assert.equal(withAgachamento.entries.length, 2);
  const supino = withAgachamento.entries.find((e) => e.exercicioId === exercicio._id);
  const agach = withAgachamento.entries.find((e) => e.exercicioId === agachamento._id);
  assert.equal(supino?.pesoKg, 30);
  assert.equal(agach?.pesoKg, 40);
});

test('stamps an ISO updatedAt on the merged entry so the UI can key off it to remount', () => {
  const result = mergeSessaoEntry(emptySessao, exercicio, {
    sessaoId: emptySessao._id,
    exercicioId: exercicio._id,
    sets: 3,
  });
  assert.match(result.entries[0].updatedAt ?? '', /^\d{4}-\d{2}-\d{2}T/);
});
