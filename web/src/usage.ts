import { ApiError } from './api'

/** GET /usage response. Costs are USD numbers with up to 6 decimals; days are zero-filled. */
export interface UsageDay {
  date: string
  costUsd: number
  calls: number
  inputTokens: number
  outputTokens: number
}

export interface UsageModel {
  model: string
  costUsd: number
  calls: number
  inputTokens: number
  outputTokens: number
}

export interface UsageReport {
  totalCostUsd: number
  totalCalls: number
  /** The resolved inclusive range (ISO dates) and time zone the backend used. */
  from: string
  to: string
  tz: string
  byDay: UsageDay[]
  byModel: UsageModel[]
}

export interface UsageQuery {
  /** Inclusive ISO dates; omit for the backend default (last 30 days ending today). */
  from?: string
  to?: string
  /** IANA time zone deciding where each day starts. */
  tz?: string
}

/** Fetches a path through the signed-in request path (adds the token, handles 401). */
export type Getter = <T>(path: string, signal?: AbortSignal) => Promise<T>

export const FALLBACK_TZ = 'UTC'

/** The browser's IANA time zone, e.g. "Asia/Calcutta"; undefined if the browser can't tell. */
export function browserTimeZone(): string | undefined {
  try {
    return Intl.DateTimeFormat().resolvedOptions().timeZone || undefined
  } catch {
    return undefined
  }
}

export function usagePath(query: UsageQuery): string {
  const params = new URLSearchParams()
  for (const key of ['from', 'to', 'tz'] as const) {
    const value = query[key]?.trim()
    if (value) {
      params.set(key, value)
    }
  }
  const search = params.toString()
  return search ? `/usage?${search}` : '/usage'
}

export interface UsageResult {
  report: UsageReport
  /** True when the backend rejected the browser's time zone and days are shown in UTC instead. */
  usedFallbackTz: boolean
}

/** GET /usage. If the backend rejects the time zone (400 about tz), retries once in UTC. */
export async function getUsage(get: Getter, query: UsageQuery, signal?: AbortSignal): Promise<UsageResult> {
  try {
    return { report: await get<UsageReport>(usagePath(query), signal), usedFallbackTz: false }
  } catch (error) {
    const tzRejected = error instanceof ApiError && error.status === 400 && /\btz\b/.test(error.message)
    if (!tzRejected || !query.tz || query.tz === FALLBACK_TZ) {
      throw error
    }
    const report = await get<UsageReport>(usagePath({ ...query, tz: FALLBACK_TZ }), signal)
    return { report, usedFallbackTz: true }
  }
}
