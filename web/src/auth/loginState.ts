/**
 * One-time "state" for the Google sign-in round trip. Without it, any website could send a signed-in
 * user to /callback/...?token=<someone else's token> and the dashboard would show that account.
 * The state lives in sessionStorage (this tab only) and is part of the callback path.
 */
const STATE_KEY = 'devmeter.loginState'

function randomState(): string {
  const bytes = crypto.getRandomValues(new Uint8Array(32))
  return btoa(String.fromCharCode(...bytes)).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '')
}

/** Creates and remembers a new state, replacing any earlier one. */
export function createLoginState(storage: Storage = sessionStorage): string {
  const state = randomState()
  storage.setItem(STATE_KEY, state)
  return state
}

/** True only for the state this tab created. The stored state is removed either way, so it works once. */
export function consumeLoginState(received: string | undefined, storage: Storage = sessionStorage): boolean {
  const expected = storage.getItem(STATE_KEY)
  storage.removeItem(STATE_KEY)
  return Boolean(expected && received && received === expected)
}

/** Where the "Sign in with Google" button sends the browser. */
export function loginUrl(backendUrl: string, appOrigin: string, state: string): string {
  return `${backendUrl}/auth/login?redirect_uri=${encodeURIComponent(`${appOrigin}/callback/${state}`)}`
}

export type CallbackResult =
  | { kind: 'token'; token: string }
  | { kind: 'error'; code: string }
  | { kind: 'missing' }

/** Reads what the backend appended to the callback URL: ?token=<jwt> or ?error=<code>. */
export function parseCallback(search: string): CallbackResult {
  const params = new URLSearchParams(search)
  const error = params.get('error')
  if (error) {
    return { kind: 'error', code: error }
  }
  const token = params.get('token')
  return token ? { kind: 'token', token } : { kind: 'missing' }
}

const LOGIN_ERRORS: Record<string, string> = {
  access_denied: 'Sign-in was cancelled.',
  email_not_verified: "Your Google account's email isn't verified.",
  invalid_state: 'That sign-in link has expired or was not started here. Please sign in again.',
}

export function loginErrorMessage(code: string): string {
  return LOGIN_ERRORS[code] ?? 'Sign-in failed. Please try again.'
}
