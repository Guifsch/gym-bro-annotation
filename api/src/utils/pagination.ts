import type { FilterQuery, Model } from 'mongoose';

/** Generic cursor-based pagination for a compound sort (e.g. `[ordem, nome, _id]`) — used by every
 * `GET /` list route that wants infinite-scroll on the mobile app. Callers that never pass
 * `cursor`/`limit` (existing "give me everything for a picker" call sites) get every row back in
 * one page as before, as long as `defaultLimit` is set to the resource's own hard cap — only
 * requests that explicitly pass a smaller `limit` (the infinite-scroll screens) actually paginate. */

export interface SortSpec {
  field: string;
  direction: 1 | -1;
  /** Reconstitutes a cursor value back to the type Mongo needs to compare against the real field
   * (e.g. an ISO string back into a `Date` for a `createdAt` sort). Identity by default. */
  parse?: (raw: unknown) => unknown;
}

interface CursorEntry {
  field: string;
  value: unknown;
}

export interface PageResult<T> {
  items: T[];
  nextCursor: string | null;
}

export function parseLimit(raw: unknown, defaultLimit: number, maxLimit = 200): number {
  const parsed = typeof raw === 'string' ? Number(raw) : NaN;
  if (!Number.isFinite(parsed) || parsed <= 0) return defaultLimit;
  return Math.min(Math.floor(parsed), maxLimit);
}

function decodeCursor(raw: unknown): CursorEntry[] | null {
  if (typeof raw !== 'string' || !raw) return null;
  try {
    const parsed = JSON.parse(Buffer.from(raw, 'base64url').toString('utf8'));
    if (!Array.isArray(parsed)) return null;
    return parsed;
  } catch {
    return null;
  }
}

function encodeCursor(entries: CursorEntry[]): string {
  return Buffer.from(JSON.stringify(entries)).toString('base64url');
}

/** Nested-`$or` technique for a compound sort: strictly past the 1st field, OR tied on it and
 * strictly past the 2nd, OR tied on both and strictly past the 3rd, etc. */
function buildCursorFilter(sorts: SortSpec[], cursorValues: unknown[]): FilterQuery<any> {
  const orClauses: FilterQuery<any>[] = [];
  for (const [i, sort] of sorts.entries()) {
    const clause: FilterQuery<any> = {};
    for (const [j, priorSort] of sorts.slice(0, i).entries()) {
      clause[priorSort.field] = cursorValues[j];
    }
    const op = sort.direction === 1 ? '$gt' : '$lt';
    clause[sort.field] = { [op]: cursorValues[i] };
    orClauses.push(clause);
  }
  return { $or: orClauses };
}

function sortObject(sorts: SortSpec[]): Record<string, 1 | -1> {
  return Object.fromEntries(sorts.map((s) => [s.field, s.direction]));
}

export async function paginateFind<T = any>(
  model: Model<any>,
  baseFilter: FilterQuery<any>,
  sorts: SortSpec[],
  options: { cursor: unknown; limit: number; select?: string }
): Promise<PageResult<T>> {
  const cursorEntries = decodeCursor(options.cursor);

  let filter = baseFilter;
  if (cursorEntries && cursorEntries.length === sorts.length) {
    const cursorValues = sorts.map((sort, i) => {
      const raw = cursorEntries[i]?.value;
      return sort.parse ? sort.parse(raw) : raw;
    });
    filter = { $and: [baseFilter, buildCursorFilter(sorts, cursorValues)] };
  }

  let query = model.find(filter).sort(sortObject(sorts)).limit(options.limit + 1);
  if (options.select) query = query.select(options.select);
  const docs = await query;

  const hasMore = docs.length > options.limit;
  const items = hasMore ? docs.slice(0, options.limit) : docs;
  const nextCursor = hasMore
    ? encodeCursor(sorts.map((sort) => ({ field: sort.field, value: (items[items.length - 1] as any)[sort.field] })))
    : null;

  return { items, nextCursor };
}
