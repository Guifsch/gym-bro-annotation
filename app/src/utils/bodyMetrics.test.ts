import assert from 'node:assert/strict';
import { test } from 'node:test';

import type { BodyMetricEntry, BodyMetricMedidas } from '@/types/workout';

import {
  computeGoalProgressPct,
  computeWeightDeltas,
  findPreviousFieldValue,
  getGoalDirection,
  getWeightEntries,
  isDeltaFavorable,
  parseMedidasText,
} from './bodyMetrics';

function emptyMedidasText(): Record<keyof BodyMetricMedidas, string> {
  return {
    cintura: '',
    quadril: '',
    peito: '',
    pescoco: '',
    bracoEsquerdo: '',
    bracoDireito: '',
    coxaEsquerda: '',
    coxaDireita: '',
  };
}

test('getWeightEntries filters out entries without pesoKg and sorts ascending', () => {
  const entries: BodyMetricEntry[] = [
    { _id: '1', date: '2026-01-10', pesoKg: 80 },
    { _id: '2', date: '2026-01-05', medidas: { cintura: 80 } },
    { _id: '3', date: '2026-01-08', pesoKg: 79 },
  ];
  const result = getWeightEntries(entries);
  assert.deepEqual(
    result.map((e) => e.date),
    ['2026-01-08', '2026-01-10']
  );
});

test('computeWeightDeltas returns nulls with 0 or 1 weight entries', () => {
  assert.deepEqual(computeWeightDeltas([]), { sinceLast: null, sinceFirst: null });
  assert.deepEqual(computeWeightDeltas([{ date: '2026-01-01', pesoKg: 80 }]), {
    sinceLast: null,
    sinceFirst: null,
  });
});

test('computeWeightDeltas compares against the previous and first entries', () => {
  const result = computeWeightDeltas([
    { date: '2026-01-01', pesoKg: 82 },
    { date: '2026-01-08', pesoKg: 80 },
    { date: '2026-01-15', pesoKg: 79 },
  ]);
  assert.equal(result.sinceLast, -1);
  assert.equal(result.sinceFirst, -3);
});

test('getGoalDirection', () => {
  assert.equal(getGoalDirection(80, 70), 'loss');
  assert.equal(getGoalDirection(70, 80), 'gain');
  assert.equal(getGoalDirection(75, 75), 'maintain');
});

test('computeGoalProgressPct for a loss goal', () => {
  assert.equal(computeGoalProgressPct(80, 75, 70), 50);
  assert.equal(computeGoalProgressPct(80, 65, 70), 100); // overshoot clamps at 100
  assert.equal(computeGoalProgressPct(80, 82, 70), 0); // wrong direction clamps at 0
});

test('computeGoalProgressPct for a gain goal', () => {
  assert.equal(computeGoalProgressPct(70, 75, 80), 50);
  assert.equal(computeGoalProgressPct(70, 85, 80), 100); // overshoot clamps at 100
  assert.equal(computeGoalProgressPct(70, 65, 80), 0); // wrong direction clamps at 0
});

test('computeGoalProgressPct when goal equals the starting weight', () => {
  assert.equal(computeGoalProgressPct(75, 75, 75), 100);
  assert.equal(computeGoalProgressPct(75, 76, 75), 0);
});

test('isDeltaFavorable judges delta relative to goal direction', () => {
  assert.equal(isDeltaFavorable(-1, 'loss'), true);
  assert.equal(isDeltaFavorable(1, 'loss'), false);
  assert.equal(isDeltaFavorable(1, 'gain'), true);
  assert.equal(isDeltaFavorable(-1, 'gain'), false);
  assert.equal(isDeltaFavorable(null, 'loss'), null);
  assert.equal(isDeltaFavorable(1, null), null);
  assert.equal(isDeltaFavorable(1, 'maintain'), null);
});

test('parseMedidasText ignores blank and non-numeric fields, accepts comma decimals', () => {
  const text = emptyMedidasText();
  text.cintura = '82,5';
  text.quadril = '  ';
  text.peito = 'abc';
  text.bracoEsquerdo = '34';

  const result = parseMedidasText(text);
  assert.deepEqual(result, { cintura: 82.5, bracoEsquerdo: 34 });
});

test('parseMedidasText returns an empty object when every field is blank', () => {
  assert.deepEqual(parseMedidasText(emptyMedidasText()), {});
});

test('findPreviousFieldValue walks backward to the most recent recorded value', () => {
  const entries: BodyMetricEntry[] = [
    { _id: '1', date: '2026-01-01', medidas: { cintura: 84 } },
    { _id: '2', date: '2026-01-08' },
    { _id: '3', date: '2026-01-15', medidas: { cintura: 82 } },
  ];
  assert.equal(findPreviousFieldValue(entries, 2, 'cintura'), 84);
  assert.equal(findPreviousFieldValue(entries, 1, 'cintura'), 84);
  assert.equal(findPreviousFieldValue(entries, 0, 'cintura'), undefined);
});
