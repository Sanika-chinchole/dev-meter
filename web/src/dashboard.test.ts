import { describe, expect, it } from 'vitest'
import { formatShortDate, formatUsdExact } from './format'
import { DEFAULT_RANGE, localToday, parseRange, rangeDates } from './range'
import type { UsageModel } from './usage'
import { costShare, daysWithCalls, isUnpriced, sortByCost, unpricedCount } from './usageView'

const model = (name: string, costUsd: number, calls: number): UsageModel =>
  ({ model: name, costUsd, calls, inputTokens: 10, outputTokens: 20 })

describe('date range presets', () => {
  it('accepts only 7 / 30 / 90 and defaults to 30', () => {
    expect(parseRange('7')).toBe(7)
    expect(parseRange('90')).toBe(90)
    expect(DEFAULT_RANGE).toBe(30)
    for (const bad of [null, '', '14', 'abc', '-7', '30.5']) {
      expect(parseRange(bad)).toBe(30)
    }
  })

  it('ends today and includes it: 7 days = today + the 6 before', () => {
    expect(rangeDates(7, '2026-10-23')).toEqual({ from: '2026-10-17', to: '2026-10-23' })
    expect(rangeDates(30, '2026-10-23')).toEqual({ from: '2026-09-24', to: '2026-10-23' })
    expect(rangeDates(1, '2026-10-23')).toEqual({ from: '2026-10-23', to: '2026-10-23' })
  })

  it('crosses month, year and leap-day boundaries', () => {
    expect(rangeDates(7, '2026-03-02')).toEqual({ from: '2026-02-24', to: '2026-03-02' })
    expect(rangeDates(7, '2028-03-02')).toEqual({ from: '2028-02-25', to: '2028-03-02' }) // 2028 is a leap year
    expect(rangeDates(90, '2027-01-15')).toEqual({ from: '2026-10-18', to: '2027-01-15' })
  })

  it("uses the computer's local calendar date", () => {
    expect(localToday(new Date(2026, 9, 23, 23, 59))).toBe('2026-10-23')
    expect(localToday(new Date(2026, 0, 5, 0, 1))).toBe('2026-01-05')
  })
})

describe('model table', () => {
  it('flags $0 models with calls as unpriced, not free', () => {
    expect(isUnpriced(model('mystery-9000', 0, 3))).toBe(true)
    expect(isUnpriced(model('gemini-3.8-flash', 0.001313, 1))).toBe(false)
    expect(isUnpriced(model('idle', 0, 0))).toBe(false)
    expect(unpricedCount([model('a', 0, 1), model('b', 0.1, 1), model('c', 0, 2)])).toBe(2)
  })

  it('sorts by cost, highest first, with a stable order for ties', () => {
    const sorted = sortByCost([model('b', 0.001, 1), model('a', 0.008, 1), model('c', 0, 5), model('d', 0, 5)])
    expect(sorted.map((m) => m.model)).toEqual(['a', 'b', 'c', 'd'])
  })

  it('computes each share of the total, 0 when nothing was spent', () => {
    expect(costShare(model('a', 0.003, 1), 0.012)).toBeCloseTo(0.25)
    expect(costShare(model('a', 0, 1), 0)).toBe(0)
  })
})

describe('daily view', () => {
  it('lists only days that had calls in the table view', () => {
    const day = (date: string, calls: number) => ({ date, calls, costUsd: calls * 0.001, inputTokens: 0, outputTokens: 0 })
    expect(daysWithCalls([day('2026-10-21', 0), day('2026-10-22', 2), day('2026-10-23', 1)]).map((d) => d.date))
      .toEqual(['2026-10-22', '2026-10-23'])
  })

  it('formats exact cost and short axis dates', () => {
    expect(formatUsdExact(0.001313)).toBe('$0.001313')
    expect(formatUsdExact(12.4)).toBe('$12.400000')
    expect(formatShortDate('2026-10-03')).toBe('Oct 3')
  })
})
