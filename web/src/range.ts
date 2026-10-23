export const RANGE_PRESETS = [7, 30, 90] as const
export type RangeDays = (typeof RANGE_PRESETS)[number]
export const DEFAULT_RANGE: RangeDays = 30

/** The ?range= URL value, or the 30-day default for anything else. */
export function parseRange(value: string | null): RangeDays {
  const days = Number(value)
  return (RANGE_PRESETS as readonly number[]).includes(days) ? (days as RangeDays) : DEFAULT_RANGE
}

/** Today's calendar date on this computer (local time zone, matching the tz sent to /usage). */
export function localToday(now: Date = new Date()): string {
  return isoDate(now.getFullYear(), now.getMonth() + 1, now.getDate())
}

/** Inclusive range of `days` calendar days ending on `today`: 7 days = today and the 6 before it. */
export function rangeDates(days: number, today: string): { from: string; to: string } {
  const [year, month, day] = today.split('-').map(Number)
  const start = new Date(Date.UTC(year!, month! - 1, day! - (days - 1))) // UTC: pure calendar math, no DST shifts
  return { from: isoDate(start.getUTCFullYear(), start.getUTCMonth() + 1, start.getUTCDate()), to: today }
}

function isoDate(year: number, month: number, day: number): string {
  return `${year}-${String(month).padStart(2, '0')}-${String(day).padStart(2, '0')}`
}
