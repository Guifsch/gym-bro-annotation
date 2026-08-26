import type { BodyMetricEntry, BodyMetricMedidas } from '../types/workout'

export type GoalDirection = 'loss' | 'gain' | 'maintain'

export interface WeightPoint {
  date: string
  pesoKg: number
}

/** Only entries that actually recorded a weight, sorted ascending by date — what the chart and
 * the delta math both want. */
export function getWeightEntries(entries: BodyMetricEntry[]): WeightPoint[] {
  return entries
    .filter((entry): entry is BodyMetricEntry & { pesoKg: number } => entry.pesoKg !== undefined)
    .map((entry) => ({ date: entry.date, pesoKg: entry.pesoKg }))
    .sort((a, b) => a.date.localeCompare(b.date))
}

export interface WeightDeltas {
  sinceLast: number | null
  sinceFirst: number | null
}

/** `weightEntries` must already be sorted ascending (see `getWeightEntries`). */
export function computeWeightDeltas(weightEntries: WeightPoint[]): WeightDeltas {
  if (weightEntries.length === 0) return { sinceLast: null, sinceFirst: null }
  const current = weightEntries[weightEntries.length - 1]
  const previous = weightEntries.length >= 2 ? weightEntries[weightEntries.length - 2] : null
  const first = weightEntries[0]

  return {
    sinceLast: previous ? current.pesoKg - previous.pesoKg : null,
    sinceFirst: weightEntries.length >= 2 ? current.pesoKg - first.pesoKg : null,
  }
}

export function getGoalDirection(startKg: number, goalKg: number): GoalDirection {
  if (goalKg < startKg) return 'loss'
  if (goalKg > startKg) return 'gain'
  return 'maintain'
}

/** Direction-agnostic: numerator and denominator flip sign together for a loss vs. a gain goal,
 * so the same formula works either way. Clamped 0-100; overshooting the goal reads as "done"
 * rather than over 100%, moving the wrong way reads as 0% rather than negative. */
export function computeGoalProgressPct(startKg: number, currentKg: number, goalKg: number): number {
  if (goalKg === startKg) return currentKg === goalKg ? 100 : 0
  const raw = ((currentKg - startKg) / (goalKg - startKg)) * 100
  return Math.max(0, Math.min(100, raw))
}

/** Whether a weight delta is "good news" relative to the goal's direction — a bulking user's
 * +0.4kg should read positive, not alarming. Returns null (render neutral) when there's no goal
 * or no movement to judge. */
export function isDeltaFavorable(delta: number | null, direction: GoalDirection | null): boolean | null {
  if (delta === null || direction === null || direction === 'maintain' || delta === 0) return null
  return direction === 'loss' ? delta < 0 : delta > 0
}

export const MEDIDA_KEYS: (keyof BodyMetricMedidas)[] = [
  'cintura',
  'quadril',
  'peito',
  'pescoco',
  'bracoEsquerdo',
  'bracoDireito',
  'coxaEsquerda',
  'coxaDireita',
]

export const MEDIDA_LABELS: Record<keyof BodyMetricMedidas, string> = {
  cintura: 'Cintura',
  quadril: 'Quadril',
  peito: 'Peito',
  pescoco: 'Pescoço',
  bracoEsquerdo: 'Braço E',
  bracoDireito: 'Braço D',
  coxaEsquerda: 'Coxa E',
  coxaDireita: 'Coxa D',
}

/** Walks backward from `index` (in a list sorted ascending by date) to find the most recent
 * earlier entry that recorded the given measurement field — for "vs. registro anterior" deltas
 * per measurement, since not every entry fills in every field. */
export function findPreviousFieldValue(
  entries: BodyMetricEntry[],
  index: number,
  field: keyof BodyMetricMedidas
): number | undefined {
  for (let i = index - 1; i >= 0; i -= 1) {
    const value = entries[i].medidas?.[field]
    if (value !== undefined) return value
  }
  return undefined
}
