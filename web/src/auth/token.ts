/** Seconds of leeway so a token that is about to expire counts as expired (same as the extension). */
const EXPIRY_SKEW_SECONDS = 30

/**
 * Reads the JWT payload locally. The signature is NOT checked here: the backend does that on every call.
 * This only avoids using a token we already know is expired.
 */
function payloadOf(token: string): Record<string, unknown> | undefined {
  const part = token.split('.')[1]
  if (!part) {
    return undefined
  }
  try {
    const base64 = part.replace(/-/g, '+').replace(/_/g, '/').padEnd(Math.ceil(part.length / 4) * 4, '=')
    const bytes = Uint8Array.from(atob(base64), (c) => c.charCodeAt(0))
    const parsed: unknown = JSON.parse(new TextDecoder().decode(bytes))
    return parsed && typeof parsed === 'object' ? (parsed as Record<string, unknown>) : undefined
  } catch {
    return undefined
  }
}

export function tokenExpiry(token: string): Date | undefined {
  const exp = payloadOf(token)?.exp
  return typeof exp === 'number' ? new Date(exp * 1000) : undefined
}

export function tokenEmail(token: string): string | undefined {
  const email = payloadOf(token)?.email
  return typeof email === 'string' ? email : undefined
}

/** Malformed tokens and tokens without exp count as expired. */
export function isExpired(token: string, now: Date = new Date()): boolean {
  const expiry = tokenExpiry(token)
  return expiry === undefined || expiry.getTime() - EXPIRY_SKEW_SECONDS * 1000 <= now.getTime()
}
