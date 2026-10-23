import type { ReactNode } from 'react'
import { Navigate } from 'react-router-dom'
import { useAuth } from './useAuth'

/** Shows children only with a valid token; otherwise the login screen. */
export default function RequireAuth({ children }: { children: ReactNode }) {
  const { state, retry } = useAuth()
  switch (state.status) {
    case 'loading':
      return <p className="muted">Loading…</p>
    case 'error':
      return (
        <section className="card narrow">
          <h1>Can't load DevMeter</h1>
          <p className="muted">{state.message}</p>
          <button type="button" className="button" onClick={retry}>Try again</button>
        </section>
      )
    case 'signed-out':
      return <Navigate to="/login" replace />
    case 'signed-in':
      return children
  }
}
