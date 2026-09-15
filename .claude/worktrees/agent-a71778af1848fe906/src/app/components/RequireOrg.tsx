import { Navigate, Outlet } from 'react-router'
import { useAuthContext } from '@/context/AuthContext'

// Requiere que el usuario tenga org_id asignado.
// Debe usarse dentro de RequireAuth (que ya garantiza user != null y loading = false).
export function RequireOrg() {
  const { profile } = useAuthContext()

  if (profile !== null && !profile.org_id) {
    return <Navigate to="/completar-organizacion" replace />
  }

  return <Outlet />
}
