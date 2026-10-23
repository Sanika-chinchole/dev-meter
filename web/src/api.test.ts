import { describe, expect, it, vi } from 'vitest'
import { ApiError, apiGet, CancelledError, fetchMe, UnauthorizedError } from './api'

const respond = (status: number, body?: object) =>
  vi.fn<typeof fetch>().mockResolvedValue(new Response(body ? JSON.stringify(body) : null, { status }))

/** A fetch that never answers until its signal aborts, like a hung backend. */
const hang = vi.fn<typeof fetch>((_url, init) => new Promise((_resolve, reject) => {
  init?.signal?.addEventListener('abort', () => reject(new DOMException('Aborted', 'AbortError')))
}))

describe('apiGet', () => {
  it('sends the bearer token and returns the JSON body', async () => {
    const fetchImpl = respond(200, { id: 'u1', email: 'ada@example.com', name: null })
    await expect(fetchMe('http://localhost:8080', 'jwt-1', { fetchImpl }))
      .resolves.toEqual({ id: 'u1', email: 'ada@example.com', name: null })
    const [url, init] = fetchImpl.mock.calls[0]!
    expect(url).toBe('http://localhost:8080/auth/me')
    expect(new Headers(init?.headers).get('Authorization')).toBe('Bearer jwt-1')
  })

  it('turns 401 into UnauthorizedError (the caller signs out)', async () => {
    await expect(apiGet('http://b', '/usage', 't', { fetchImpl: respond(401) })).rejects.toBeInstanceOf(UnauthorizedError)
  })

  it("uses the backend's problem detail for other statuses", async () => {
    const error = await apiGet('http://b', '/usage', 't', { fetchImpl: respond(400, { detail: 'from must be on or before to' }) })
      .catch((e: unknown) => e)
    expect(error).toMatchObject({ status: 400, message: 'from must be on or before to' })
    await expect(apiGet('http://b', '/usage', 't', { fetchImpl: respond(500) }))
      .rejects.toMatchObject({ status: 500, message: 'The backend returned HTTP 500.' })
  })

  it('reports an unreachable backend', async () => {
    const offline = vi.fn<typeof fetch>().mockRejectedValue(new TypeError('Failed to fetch'))
    const error = await apiGet('http://b', '/usage', 't', { fetchImpl: offline }).catch((e: unknown) => e)
    expect(error).toBeInstanceOf(ApiError)
    expect((error as ApiError).message).toMatch(/Can't reach the DevMeter backend/)
  })

  it('times out a backend that never answers', async () => {
    await expect(apiGet('http://b', '/usage', 't', { fetchImpl: hang, timeoutMs: 20 }))
      .rejects.toThrow("The backend didn't respond in time (0.02 s).")
  })

  it('reports a cancelled request as CancelledError, not as a failure', async () => {
    const controller = new AbortController()
    const request = apiGet('http://b', '/usage', 't', { fetchImpl: hang, signal: controller.signal })
    controller.abort()
    await expect(request).rejects.toBeInstanceOf(CancelledError)
  })
})
