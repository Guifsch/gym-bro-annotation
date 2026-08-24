/** Live validation message shown while typing, before the user ever clicks save. */
export function maxValueRule(max: number): (value: string) => true | string {
  return (value) => {
    const num = Number(value)
    return !Number.isFinite(num) || num <= max ? true : `Máx: ${max}`
  }
}

/** Backstop for the rule above — snaps the value back down to `max` once the field loses
 * focus, so an over-limit number can't actually be saved even if the error message above
 * goes unnoticed. */
export function clampMaxValue(value: string, max: number): string {
  const num = Number(value)
  return Number.isFinite(num) && num > max ? String(max) : value
}
