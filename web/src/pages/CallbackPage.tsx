import { useEffect, useRef } from 'react'
import { useLocation, useNavigate, useParams } from 'react-router-dom'
import { ApiError } from '../api'
import { consumeLoginState, loginErrorMessage, parseCallback } from '../auth/loginState'
import { useAuth } from '../auth/useAuth'

/** The backend redirects here after Google sign-in: /callback/<state>?token=<jwt> (or ?error=<code>). */
export default function CallbackPage() {
  const { state: receivedState } = useParams()
  const location = useLocation()
  const navigate = useNavigate()
  const { completeSignIn } = useAuth()
  const handled = useRef(false) // the state is single-use, so run once (StrictMode runs effects twice in dev)

  useEffect(() => {
    if (handled.current) {
      return
    }
    handled.current = true
    const result = parseCallback(location.search)
    // Take the token out of the address bar and browser history before doing anything else.
    window.history.replaceState(window.history.state, '', '/callback')

    const fail = (loginError: string) => navigate('/login', { replace: true, state: { loginError } })
    if (!consumeLoginState(receivedState)) {
      fail(loginErrorMessage('invalid_state'))
    } else if (result.kind === 'error') {
      fail(loginErrorMessage(result.code))
    } else if (result.kind === 'missing') {
      fail(loginErrorMessage('login_failed'))
    } else {
      completeSignIn(result.token)
        .then(() => navigate('/', { replace: true }))
        .catch((error: unknown) => fail(error instanceof ApiError ? error.message : loginErrorMessage('login_failed')))
    }
  }, [receivedState, location.search, navigate, completeSignIn])

  return (
    <section className="card narrow">
      <h1>Finishing sign-in…</h1>
    </section>
  )
}
