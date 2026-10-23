import { Link, Outlet } from 'react-router-dom'
import { useAuth } from '../auth/useAuth'

export default function Layout() {
  const { state, signOut } = useAuth()
  return (
    <div className="app">
      <header className="app-header">
        <Link to="/" className="brand">DevMeter</Link>
        {state.status === 'signed-in' && (
          <div className="account">
            {state.user.name && <span className="account-name">{state.user.name}</span>}
            <span className="muted account-email" title={state.user.email}>{state.user.email}</span>
            <button type="button" className="button secondary" onClick={() => signOut()}>Sign out</button>
          </div>
        )}
      </header>
      <main className="app-main">
        <Outlet />
      </main>
    </div>
  )
}
