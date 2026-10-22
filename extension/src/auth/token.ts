/** Seconds of leeway so a token that is about to expire counts as expired. */
const EXPIRY_SKEW_SECONDS = 30;

/**
 * Reads the JWT's exp claim locally. The signature is NOT checked: the backend does that.
 * This only avoids sending a token we already know is expired.
 */
export function tokenExpiry(token: string): Date | undefined {
  const payload = token.split('.')[1];
  if (!payload) {
    return undefined;
  }
  try {
    const { exp } = JSON.parse(Buffer.from(payload, 'base64url').toString('utf8')) as { exp?: unknown };
    return typeof exp === 'number' ? new Date(exp * 1000) : undefined;
  } catch {
    return undefined;
  }
}

/** Malformed tokens and tokens without exp count as expired. */
export function isExpired(token: string, now: Date = new Date()): boolean {
  const expiry = tokenExpiry(token);
  return expiry === undefined || expiry.getTime() - EXPIRY_SKEW_SECONDS * 1000 <= now.getTime();
}
