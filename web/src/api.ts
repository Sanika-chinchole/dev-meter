const DEFAULT_TIMEOUT_MS = 15_000

/** The backend rejected the token (401): sign out. */
export class UnauthorizedError extends Error {
  constructor() {
    super('Unauthorized')
  }
}

/** The caller cancelled the request (e.g. it was superseded); not an error to show. */
export class CancelledError extends Error {
  constructor() {
    super('Cancelled')
  }
}

/** Any other failure: backend unreachable, too slow, or a non-2xx status. */
export class ApiError extends Error {
  readonly status: number | undefined

  constructor(message: string, status?: number) {
    super(message)
    this.status = status
  }
}

export interface Me {
  id: string
  email: string
  name: string | null
}

export interface RequestOptions {
  signal?: AbortSignal
  timeoutMs?: number
  fetchImpl?: typeof fetch
}

/**
 * GET a backend endpoint with the app JWT. The one request path for the whole app.
 * Throws UnauthorizedError (401), CancelledError (signal aborted) or ApiError (anything else).
 */
export async function apiGet<T>(baseUrl: string, path: string, token: string, options: RequestOptions = {}): Promise<T> {
  const { signal, timeoutMs = DEFAULT_TIMEOUT_MS, fetchImpl = fetch } = options
  const timeout = AbortSignal.timeout(timeoutMs)
  let response: Response
  try {
    response = await fetchImpl(`${baseUrl}${path}`, {
      headers: { Authorization: `Bearer ${token}`, Accept: 'application/json' },
      signal: signal ? AbortSignal.any([signal, timeout]) : timeout,
    })
  } catch {
    if (signal?.aborted) {
      throw new CancelledError()
    }
    if (timeout.aborted) {
      throw new ApiError(`The backend didn't respond in time (${timeoutMs / 1000} s).`)
    }
    throw new ApiError(`Can't reach the DevMeter backend at ${baseUrl}. Is it running?`)
  }
  if (response.status === 401) {
    throw new UnauthorizedError()
  }
  if (!response.ok) {
    throw new ApiError(await problemDetail(response), response.status)
  }
  return (await response.json()) as T
}

/** The backend's problem-JSON "detail", if any (it never echoes request data). */
async function problemDetail(response: Response): Promise<string> {
  try {
    const body = (await response.json()) as { detail?: unknown }
    if (typeof body.detail === 'string' && body.detail) {
      return body.detail
    }
  } catch {
    // Not JSON; fall back to the status.
  }
  return `The backend returned HTTP ${response.status}.`
}

export function fetchMe(baseUrl: string, token: string, options?: RequestOptions): Promise<Me> {
  return apiGet<Me>(baseUrl, '/auth/me', token, options)
}
