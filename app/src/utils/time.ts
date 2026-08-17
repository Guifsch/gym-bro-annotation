/** Masks free-typed digits into a 24h "HH:MM" time as the user types, clamping each part once
 * it has both digits (23 max for hours, 59 max for minutes) so it's impossible to end up with an
 * invalid time like "25:99". */
export function formatTimeInput(raw: string): string {
  const digits = raw.replace(/\D/g, '').slice(0, 4);
  if (digits.length === 0) return '';

  let hours = digits.slice(0, Math.min(2, digits.length));
  if (hours.length === 2) {
    hours = String(Math.min(23, Number(hours))).padStart(2, '0');
  }

  if (digits.length <= 2) return hours;

  let minutes = digits.slice(2);
  if (minutes.length === 2) {
    minutes = String(Math.min(59, Number(minutes))).padStart(2, '0');
  }

  return `${hours}:${minutes}`;
}
