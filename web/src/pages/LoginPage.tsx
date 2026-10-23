import { Navigate, useLocation } from 'react-router-dom'
import { useAuth } from '../auth/useAuth'

export default function LoginPage() {
  const { state, signIn } = useAuth()
  const location = useLocation()
  if (state.status === 'signed-in') {
    return <Navigate to="/" replace />
  }
  const message = (location.state as { loginError?: string } | null)?.loginError
    ?? (state.status === 'signed-out' ? state.message : undefined)

  return (
    <section className="card narrow">
      <h1>Sign in to DevMeter</h1>
      <p className="muted">Use the same Google account as the VS Code extension to see your AI spend.</p>
      {message && <p className="notice" role="alert">{message}</p>}
      <button type="button" className="button" onClick={signIn}>Sign in with Google</button>
    </section>
  )
}
