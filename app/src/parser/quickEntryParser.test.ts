import assert from 'node:assert/strict';
import { test } from 'node:test';

import { parseQuickEntry } from './quickEntryParser';

test('parses the canonical order: 3s 10r 10k', () => {
  const result = parseQuickEntry('3s 10r 10k');
  assert.equal(result.sets, 3);
  assert.equal(result.reps, 10);
  assert.equal(result.pesoKg, 10);
  assert.deepEqual(result.unrecognized, []);
});

test('is order-independent', () => {
  const result = parseQuickEntry('10r 3s 12,5k');
  assert.equal(result.sets, 3);
  assert.equal(result.reps, 10);
  assert.equal(result.pesoKg, 12.5);
});

test('accepts optional whitespace between number and letter', () => {
  const result = parseQuickEntry('3 s 10 r 10 k');
  assert.equal(result.sets, 3);
  assert.equal(result.reps, 10);
  assert.equal(result.pesoKg, 10);
});

test('accepts both comma and dot as decimal separator for weight', () => {
  assert.equal(parseQuickEntry('12,5k').pesoKg, 12.5);
  assert.equal(parseQuickEntry('12.5k').pesoKg, 12.5);
});

test('returns a partial patch when only one field is typed', () => {
  const result = parseQuickEntry('12k');
  assert.equal(result.pesoKg, 12);
  assert.equal(result.sets, undefined);
  assert.equal(result.reps, undefined);
});

test('rounds sets/reps to integers but keeps weight decimals', () => {
  const result = parseQuickEntry('3,7s 10r 10,25k');
  assert.equal(result.sets, 4);
  assert.equal(result.pesoKg, 10.25);
});

test('rejects zero values', () => {
  const result = parseQuickEntry('0s 10r 10k');
  assert.equal(result.sets, undefined);
  assert.equal(result.reps, 10);
  assert.equal(result.pesoKg, 10);
  assert.deepEqual(result.unrecognized, ['0s']);
});

test('last match wins and is reported as a duplicate on repeated fields', () => {
  const result = parseQuickEntry('10k 12k');
  assert.equal(result.pesoKg, 12);
  assert.deepEqual(result.duplicateFields, ['pesoKg']);
});

test('flags unrecognized suffixes without touching known fields', () => {
  const result = parseQuickEntry('3s 10r 10k 5x');
  assert.equal(result.sets, 3);
  assert.equal(result.reps, 10);
  assert.equal(result.pesoKg, 10);
  assert.deepEqual(result.unrecognized, ['5x']);
});

test('flags stray text with no digits as unrecognized', () => {
  const result = parseQuickEntry('3s 10r 10k oi');
  assert.deepEqual(result.unrecognized, ['oi']);
});

test('handles an empty string gracefully', () => {
  const result = parseQuickEntry('');
  assert.equal(result.sets, undefined);
  assert.equal(result.reps, undefined);
  assert.equal(result.pesoKg, undefined);
  assert.deepEqual(result.unrecognized, []);
});
