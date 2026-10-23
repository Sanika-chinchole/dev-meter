import { type ReactNode, useCallback, useEffect, useMemo, useState } from 'react'
import { apiGet, fetchMe, UnauthorizedError } from '../api'
import { BACKEND_URL } from '../config'
import { type Auth, AuthContext, type AuthState } from './authContext'
import { createLoginState, loginUrl } from './loginState'
import { clearToken, getToken, setToken, TOKEN_KEY } from './tokenStore'

const SESSION_EXPIRED = 'Your session expired. Please sign in again.'

/** Checks a token against /auth/me: fresh name/email, and a 401 means signed out (token cleared). */
async function verifiedState(token: string): Promise<AuthState> {
  try {
    return { status: 'signed-in', token, user: await fetchMe(BACKEND_URL, token) }
  } catch (error) {
    if (error instanceof UnauthorizedError) {
      clearToken()
      return { status: 'signed-out', message: SESSION_EXPIRED }
    }
    return { status: 'error', message: error instanceof Error ? error.message : String(error) }
  }
}

export function AuthProvider({ children }: { children: ReactNode }) {
  // No stored token: signed out straight away. Otherwise "loading" until /auth/me answers.
  const [state, setState] = useState<AuthState>(() => (getToken() ? { status: 'loading' } : { status: 'signed-out' }))

  const signOut = useCallback((message?: string) => {
    clearToken()
    setState({ status: 'signed-out', message })
  }, [])

  /** Re-reads the stored token (retry, or a change from another tab). */
  const load = useCallback(() => {
    const token = getToken()
    if (!token) {
      setState({ status: 'signed-out' })
      return
    }
    setState({ status: 'loading' })
    void verifiedState(token).then(setState)
  }, [])

  // On page load, check the stored token once.
  useEffect(() => {
    const token = getToken()
    if (!token) {
      return
    }
    let cancelled = false
    void verifiedState(token).then((next) => {
      if (!cancelled) {
        setState(next)
      }
    })
    return () => {
      cancelled = true
    }
  }, [])

  // Signing in or out in another tab changes the token in localStorage; follow it here.
  useEffect(() => {
    const onStorage = (event: StorageEvent) => {
      if (event.key === TOKEN_KEY || event.key === null) {
        load()
      }
    }
    window.addEventListener('storage', onStorage)
    return () => window.removeEventListener('storage', onStorage)
  }, [load])

  const completeSignIn = useCallback(async (token: string) => {
    const user = await fetchMe(BACKEND_URL, token) // throws: nothing is stored unless the backend accepts it
    setToken(token)
    setState({ status: 'signed-in', token, user })
  }, [])

  const signIn = useCallback(() => {
    window.location.assign(loginUrl(BACKEND_URL, window.location.origin, createLoginState()))
  }, [])

  const get = useCallback(async <T,>(path: string, signal?: AbortSignal): Promise<T> => {
    if (state.status !== 'signed-in') {
      throw new UnauthorizedError()
    }
    try {
      return await apiGet<T>(BACKEND_URL, path, state.token, { signal })
    } catch (error) {
      if (error instanceof UnauthorizedError) {
        signOut(SESSION_EXPIRED)
      }
      throw error
    }
  }, [state, signOut])

  const auth = useMemo<Auth>(
    () => ({ state, signIn, completeSignIn, signOut, retry: load, get }),
    [state, signIn, completeSignIn, signOut, load, get],
  )
  return <AuthContext.Provider value={auth}>{children}</AuthContext.Provider>
}
