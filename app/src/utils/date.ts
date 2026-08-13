export function getTodayDateString(reference: Date = new Date()): string {
  const year = reference.getFullYear();
  const month = String(reference.getMonth() + 1).padStart(2, '0');
  const day = String(reference.getDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
}

export function formatDateDisplay(date: string): string {
  const [year, month, day] = date.split('-');
  return `${day}/${month}/${year}`;
}

/** Formats in America/Sao_Paulo (UTC-3, no DST since 2019) regardless of the device's own timezone setting. */
export function formatDateTimeDisplay(isoDate: string): string {
  const utcMs = new Date(isoDate).getTime();
  const brt = new Date(utcMs - 3 * 60 * 60 * 1000);
  const day = String(brt.getUTCDate()).padStart(2, '0');
  const month = String(brt.getUTCMonth() + 1).padStart(2, '0');
  const hours = String(brt.getUTCHours()).padStart(2, '0');
  const minutes = String(brt.getUTCMinutes()).padStart(2, '0');
  return `${day}/${month}/${brt.getUTCFullYear()} ${hours}:${minutes}`;
}
