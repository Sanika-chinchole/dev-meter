import { isExpired } from './token'

/** localStorage key for the app JWT. TODO(auth): localStorage is readable by any script on the page (XSS risk). */
export const TOKEN_KEY = 'devmeter.jwt'

/** The stored token if it is still valid; an expired or malformed token is removed and treated as signed out. */
export function getToken(storage: Storage = localStorage, now: Date = new Date()): string | null {
  const token = storage.getItem(TOKEN_KEY)
  if (token && isExpired(token, now)) {
    storage.removeItem(TOKEN_KEY)
    return null
  }
  return token
}

export function setToken(token: string, storage: Storage = localStorage): void {
  storage.setItem(TOKEN_KEY, token)
}

/** Local sign-out only: the backend can't revoke tokens yet, so the token stays valid until it expires. */
export function clearToken(storage: Storage = localStorage): void {
  storage.removeItem(TOKEN_KEY)
}
