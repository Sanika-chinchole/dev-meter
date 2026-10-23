import { useEffect, useRef, useState } from 'react'
import { CancelledError, UnauthorizedError } from './api'
import { useAuth } from './auth/useAuth'
import { browserTimeZone, getUsage, type UsageReport } from './usage'

/** Coming back to the tab within this window doesn't refetch again (focus + visibility often fire together). */
const MIN_REFETCH_INTERVAL_MS = 2_000

interface Result {
  /** Which request this result belongs to. */
  key: string
  report?: UsageReport
  usedFallbackTz: boolean
  error?: string
}

export interface UsageState {
  /** True until the current request settles. The previous report stays available meanwhile. */
  loading: boolean
  /** The latest report, possibly from an earlier range while a new one loads. */
  report?: UsageReport
  usedFallbackTz: boolean
  /** Set when the current request failed. */
  error?: string
  /** Fetch again now (Refresh / Try again). */
  retry(): void
}

/**
 * Usage for the signed-in user in the browser's time zone. Superseded requests are cancelled.
 * Refetches when the user comes back to the tab, so calls made in VS Code show up without a reload.
 */
export function useUsage(from?: string, to?: string): UsageState {
  const { get } = useAuth()
  const [attempt, setAttempt] = useState(0)
  const [result, setResult] = useState<Result>()
  const lastFetch = useRef(0)
  const key = `${from ?? ''}|${to ?? ''}|${attempt}`

  useEffect(() => {
    lastFetch.current = Date.now()
    const controller = new AbortController()
    getUsage(get, { from, to, tz: browserTimeZone() }, controller.signal).then(
      ({ report, usedFallbackTz }) => setResult({ key, report, usedFallbackTz }),
      (error: unknown) => {
        // Cancelled: a newer request owns the screen. Unauthorized: auth already signed out.
        if (error instanceof CancelledError || error instanceof UnauthorizedError || controller.signal.aborted) {
          return
        }
        const message = error instanceof Error ? error.message : String(error)
        setResult((previous) => ({ key, report: previous?.report, usedFallbackTz: false, error: message }))
      },
    )
    return () => controller.abort()
  }, [get, from, to, key])

  useEffect(() => {
    const refetchIfVisible = () => {
      if (document.visibilityState === 'visible' && Date.now() - lastFetch.current > MIN_REFETCH_INTERVAL_MS) {
        setAttempt((n) => n + 1)
      }
    }
    window.addEventListener('focus', refetchIfVisible)
    document.addEventListener('visibilitychange', refetchIfVisible)
    return () => {
      window.removeEventListener('focus', refetchIfVisible)
      document.removeEventListener('visibilitychange', refetchIfVisible)
    }
  }, [])

  const current = result?.key === key
  return {
    loading: !current,
    report: result?.report,
    usedFallbackTz: current ? result.usedFallbackTz : false,
    error: current ? result.error : undefined,
    retry: () => setAttempt((n) => n + 1),
  }
}
