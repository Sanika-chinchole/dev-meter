import { createContext } from 'react'
import type { Me } from '../api'

export type AuthState =
  | { status: 'loading' }
  | { status: 'signed-out'; message?: string }
  | { status: 'signed-in'; token: string; user: Me }
  /** Backend unreachable or erroring: not the same as signed out, so the token is kept. */
  | { status: 'error'; message: string }

export interface Auth {
  state: AuthState
  /** Starts Google sign-in: leaves the app for the backend's /auth/login. */
  signIn(): void
  /** Verifies a token from the callback with /auth/me and stores it only if that succeeds. */
  completeSignIn(token: string): Promise<void>
  /** Local sign-out (the backend can't revoke tokens yet). */
  signOut(message?: string): void
  /** Re-checks the stored token, e.g. after the backend was down. */
  retry(): void
  /** GET a backend endpoint with the current token. A 401 signs out; an aborted signal cancels. */
  get<T>(path: string, signal?: AbortSignal): Promise<T>
}

export const AuthContext = createContext<Auth | null>(null)
