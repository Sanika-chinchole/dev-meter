import { describe, expect, it, vi } from 'vitest'
import { ApiError, CancelledError, UnauthorizedError } from './api'
import { formatCount, formatDate, formatUsd, formatUsdTick } from './format'
import { browserTimeZone, type Getter, getUsage, usagePath, type UsageReport } from './usage'

const report = (tz: string): UsageReport => ({
  totalCostUsd: 0.001313, totalCalls: 1, from: '2026-09-24', to: '2026-10-23', tz, byDay: [], byModel: [],
})

/** A Getter that answers per path, recording what was asked. */
function getterFor(answers: Record<string, () => Promise<unknown>>) {
  const calls: string[] = []
  const get = vi.fn(async (path: string) => {
    calls.push(path)
    const answer = answers[path]
    if (!answer) {
      throw new Error(`unexpected path ${path}`)
    }
    return answer()
  }) as unknown as Getter
  return { get, calls }
}

describe('usagePath', () => {
  it('includes only the parameters that are set', () => {
    expect(usagePath({})).toBe('/usage')
    expect(usagePath({ tz: 'Asia/Calcutta' })).toBe('/usage?tz=Asia%2FCalcutta')
    expect(usagePath({ from: '2026-10-01', to: '2026-10-23', tz: 'UTC' })).toBe('/usage?from=2026-10-01&to=2026-10-23&tz=UTC')
    expect(usagePath({ from: ' ', tz: '' })).toBe('/usage')
  })

  it("reads the browser's time zone", () => {
    expect(browserTimeZone()).toBe(Intl.DateTimeFormat().resolvedOptions().timeZone)
  })
})

describe('getUsage', () => {
  it("asks for the browser's time zone", async () => {
    const { get, calls } = getterFor({ '/usage?tz=Asia%2FCalcutta': async () => report('Asia/Calcutta') })
    await expect(getUsage(get, { tz: 'Asia/Calcutta' })).resolves.toEqual({ report: report('Asia/Calcutta'), usedFallbackTz: false })
    expect(calls).toEqual(['/usage?tz=Asia%2FCalcutta'])
  })

  it('retries once in UTC when the backend rejects the time zone', async () => {
    const { get, calls } = getterFor({
      '/usage?tz=Mars%2FOlympus': async () => { throw new ApiError('tz must be an IANA time zone such as UTC or Asia/Kolkata', 400) },
      '/usage?tz=UTC': async () => report('UTC'),
    })
    await expect(getUsage(get, { tz: 'Mars/Olympus' })).resolves.toEqual({ report: report('UTC'), usedFallbackTz: true })
    expect(calls).toEqual(['/usage?tz=Mars%2FOlympus', '/usage?tz=UTC'])
  })

  it('does not retry other errors', async () => {
    for (const error of [
      new ApiError('from must be on or before to', 400),
      new ApiError('The backend returned HTTP 500.', 500),
      new UnauthorizedError(),
      new CancelledError(),
    ]) {
      const { get, calls } = getterFor({ '/usage?tz=Asia%2FCalcutta': async () => { throw error } })
      await expect(getUsage(get, { tz: 'Asia/Calcutta' })).rejects.toBe(error)
      expect(calls).toHaveLength(1)
    }
  })

  it('passes the cancel signal through', async () => {
    const controller = new AbortController()
    const get = vi.fn(async () => report('UTC')) as unknown as Getter
    await getUsage(get, { tz: 'UTC' }, controller.signal)
    expect(get).toHaveBeenCalledWith('/usage?tz=UTC', controller.signal)
  })
})

describe('formatting', () => {
  it('shows fractions of a cent with a fixed 4 decimals, cents from $1', () => {
    expect(formatUsd(0.001313)).toBe('$0.0013')
    expect(formatUsd(0.003009)).toBe('$0.0030') // trailing zero kept so cost columns line up
    expect(formatUsd(0.0124)).toBe('$0.0124')
    expect(formatUsd(0)).toBe('$0.00')
    expect(formatUsd(12.3456)).toBe('$12.35')
    expect(formatUsd(1234.5)).toBe('$1,234.50')
  })

  it('keeps chart axis ticks short', () => {
    expect(formatUsdTick(0.003)).toBe('$0.003')
    expect(formatUsdTick(0.012)).toBe('$0.012')
    expect(formatUsdTick(0)).toBe('$0.00')
    expect(formatUsdTick(2.5)).toBe('$2.50')
  })

  it('formats counts and calendar dates', () => {
    expect(formatCount(12345)).toBe('12,345')
    expect(formatDate('2026-09-24')).toBe('Sep 24, 2026')
  })
})
