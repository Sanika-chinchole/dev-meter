const DEFAULT_BACKEND_URL = 'http://localhost:8080'

export function normalizeBackendUrl(raw: string | undefined): string {
  return (raw?.trim() || DEFAULT_BACKEND_URL).replace(/\/+$/, '')
}

/**
 * DevMeter backend, from VITE_BACKEND_URL. VITE_ values are built into the public JavaScript bundle,
 * so they must never hold a secret. Use localhost (not 127.0.0.1): Google sign-in only accepts the
 * address registered for the backend.
 */
export const BACKEND_URL = normalizeBackendUrl(import.meta.env.VITE_BACKEND_URL)
