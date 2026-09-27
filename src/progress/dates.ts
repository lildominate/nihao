// Local-timezone calendar-date helpers. All dates are "YYYY-MM-DD" strings.

const pad = (n: number) => String(n).padStart(2, '0')

/** Local calendar date of `now` as "YYYY-MM-DD". */
export function localDay(now: Date = new Date()): string {
  return `${now.getFullYear()}-${pad(now.getMonth() + 1)}-${pad(now.getDate())}`
}

function parseDay(day: string): Date {
  const [y, m, d] = day.split('-').map(Number)
  return new Date(y, m - 1, d, 12) // noon avoids DST edge cases
}

/** `day` shifted by `n` calendar days. */
export function addDays(day: string, n: number): string {
  const d = parseDay(day)
  d.setDate(d.getDate() + n)
  return localDay(d)
}

/** Whole calendar days from `a` to `b` (b − a). */
export function daysBetween(a: string, b: string): number {
  return Math.round((parseDay(b).getTime() - parseDay(a).getTime()) / 86_400_000)
}
