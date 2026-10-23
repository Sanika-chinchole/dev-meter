import { Route, Routes } from 'react-router-dom'
import { AuthProvider } from './auth/AuthProvider.tsx'
import RequireAuth from './auth/RequireAuth.tsx'
import Layout from './components/Layout.tsx'
import CallbackPage from './pages/CallbackPage.tsx'
import DashboardPage from './pages/DashboardPage.tsx'
import LoginPage from './pages/LoginPage.tsx'
import NotFoundPage from './pages/NotFoundPage.tsx'

export default function App() {
  return (
    <AuthProvider>
      <Routes>
        <Route element={<Layout />}>
          <Route index element={<RequireAuth><DashboardPage /></RequireAuth>} />
          <Route path="login" element={<LoginPage />} />
          {/* The backend redirects here after Google sign-in, with ?token= or ?error=. */}
          <Route path="callback/:state" element={<CallbackPage />} />
          <Route path="*" element={<NotFoundPage />} />
        </Route>
      </Routes>
    </AuthProvider>
  )
}
