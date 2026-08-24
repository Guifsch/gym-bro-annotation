/** Manual UTC-3 formatting — avoids showing the wrong local time if the browser/OS timezone is misconfigured. */
export function formatDateTimeBRT(iso: string): string {
  const date = new Date(iso)
  const brt = new Date(date.getTime() - 3 * 60 * 60 * 1000)
  const dd = String(brt.getUTCDate()).padStart(2, '0')
  const mm = String(brt.getUTCMonth() + 1).padStart(2, '0')
  const yyyy = brt.getUTCFullYear()
  const hh = String(brt.getUTCHours()).padStart(2, '0')
  const min = String(brt.getUTCMinutes()).padStart(2, '0')
  return `${dd}/${mm}/${yyyy} ${hh}:${min}`
}
