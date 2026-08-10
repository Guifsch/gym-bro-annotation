export interface QuickEntryResult {
  sets?: number;
  reps?: number;
  pesoKg?: number;
  unrecognized: string[];
  duplicateFields: ('sets' | 'reps' | 'pesoKg')[];
}

const TOKEN_PATTERN = /(\d+(?:[.,]\d+)?)\s*([a-zA-Z]+)/g;

const SUFFIX_TO_FIELD: Record<string, 'sets' | 'reps' | 'pesoKg'> = {
  s: 'sets',
  r: 'reps',
  k: 'pesoKg',
};

/**
 * Parses gym-shorthand like "3s 10r 10k" or "10r 3s 12,5k" into { sets, reps, pesoKg }.
 * Tokens are order-independent (matched purely by suffix letter) and only the fields
 * actually present in the input are returned, so callers can apply a partial patch
 * (e.g. typing just "12k" updates weight without touching sets/reps).
 */
export function parseQuickEntry(input: string): QuickEntryResult {
  const result: QuickEntryResult = { unrecognized: [], duplicateFields: [] };
  const seenFields = new Set<'sets' | 'reps' | 'pesoKg'>();

  let consumedLength = 0;
  let match: RegExpExecArray | null;
  TOKEN_PATTERN.lastIndex = 0;

  while ((match = TOKEN_PATTERN.exec(input)) !== null) {
    const [fullMatch, rawNumber, rawSuffix] = match;
    consumedLength += fullMatch.length;

    const suffix = rawSuffix.trim().toLowerCase().charAt(0);
    const field = SUFFIX_TO_FIELD[suffix];

    if (!field) {
      result.unrecognized.push(fullMatch.trim());
      continue;
    }

    const normalized = rawNumber.replace(',', '.');
    const value = field === 'pesoKg' ? Number.parseFloat(normalized) : Math.round(Number.parseFloat(normalized));

    if (!Number.isFinite(value) || value <= 0) {
      result.unrecognized.push(fullMatch.trim());
      continue;
    }

    if (seenFields.has(field)) {
      result.duplicateFields.push(field);
    }
    seenFields.add(field);

    result[field] = value;
  }

  const strippedLength = input.replace(/\s+/g, '').length;
  if (consumedLength < strippedLength) {
    // input had characters that didn't form any number+letter token at all (e.g. stray text)
    const leftover = input.replace(TOKEN_PATTERN, '').trim();
    if (leftover) {
      result.unrecognized.push(leftover);
    }
  }

  return result;
}
