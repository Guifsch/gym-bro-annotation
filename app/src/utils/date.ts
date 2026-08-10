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
