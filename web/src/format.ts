/**
 * USD for display. Costs are often fractions of a cent, so amounts under $1 show exactly 4 decimals
 * ($0.0013, $0.0030: a fixed width lines up in columns) and larger ones show cents ($12.34).
 * Zero stays "$0.00". The exact 6-decimal value stays in the data (see formatUsdExact).
 */
export function formatUsd(value: number): string {
  const digits = value !== 0 && Math.abs(value) < 1 ? 4 : 2
  return new Intl.NumberFormat('en-US', {
    style: 'currency',
    currency: 'USD',
    minimumFractionDigits: digits,
    maximumFractionDigits: digits,
  }).format(value)
}

/** Chart axis ticks: as few decimals as needed ($0.003, $0.012, $0.00), since trailing zeros are clutter there. */
export function formatUsdTick(value: number): string {
  return new Intl.NumberFormat('en-US', {
    style: 'currency',
    currency: 'USD',
    minimumFractionDigits: 2,
    maximumFractionDigits: Math.abs(value) < 1 ? 4 : 2,
  }).format(value)
}

/** The full stored precision, for hover text: "$0.001313". */
export function formatUsdExact(value: number): string {
  return `$${value.toFixed(6)}`
}

export function formatCount(value: number): string {
  return new Intl.NumberFormat('en-US').format(value)
}

/** "2026-09-24" -> "Sep 24, 2026", formatted as the calendar date itself (no time-zone shift). */
export function formatDate(isoDate: string): string {
  return formatCalendarDate(isoDate, { month: 'short', day: 'numeric', year: 'numeric' })
}

/** "2026-09-24" -> "Sep 24", for chart axes. */
export function formatShortDate(isoDate: string): string {
  return formatCalendarDate(isoDate, { month: 'short', day: 'numeric' })
}

function formatCalendarDate(isoDate: string, options: Intl.DateTimeFormatOptions): string {
  const [year, month, day] = isoDate.split('-').map(Number)
  return new Intl.DateTimeFormat('en-US', { ...options, timeZone: 'UTC' })
    .format(new Date(Date.UTC(year!, month! - 1, day!)))
}
