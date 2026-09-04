import { Navigate, Outlet } from 'react-router'
import { useAuthContext } from '@/context/AuthContext'

export function RequireAuth() {
  const { user, loading, isRecovery } = useAuthContext()

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-background">
        <div className="text-muted-foreground text-sm">Cargando...</div>
      </div>
    )
  }

  if (!user) {
    return <Navigate to="/login" replace />
  }

  if (isRecovery) {
    return <Navigate to="/restablecer-contrasena" replace />
  }

  return <Outlet />
}
