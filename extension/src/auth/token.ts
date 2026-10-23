/** Seconds of leeway so a token that is about to expire counts as expired. */
const EXPIRY_SKEW_SECONDS = 30;

/**
 * Reads the JWT payload locally. The signature is NOT checked: the backend does that.
 * This only avoids sending a token we already know is expired, and lets Show Status work offline.
 */
function payloadOf(token: string): Record<string, unknown> | undefined {
  const payload = token.split('.')[1];
  if (!payload) {
    return undefined;
  }
  try {
    const parsed: unknown = JSON.parse(Buffer.from(payload, 'base64url').toString('utf8'));
    return parsed && typeof parsed === 'object' ? (parsed as Record<string, unknown>) : undefined;
  } catch {
    return undefined;
  }
}

export function tokenExpiry(token: string): Date | undefined {
  const exp = payloadOf(token)?.exp;
  return typeof exp === 'number' ? new Date(exp * 1000) : undefined;
}

/** The email claim the backend puts in every app JWT. */
export function tokenEmail(token: string): string | undefined {
  const email = payloadOf(token)?.email;
  return typeof email === 'string' ? email : undefined;
}

/** Malformed tokens and tokens without exp count as expired. */
export function isExpired(token: string, now: Date = new Date()): boolean {
  const expiry = tokenExpiry(token);
  return expiry === undefined || expiry.getTime() - EXPIRY_SKEW_SECONDS * 1000 <= now.getTime();
}
