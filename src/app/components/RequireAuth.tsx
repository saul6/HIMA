import { Navigate, Outlet } from 'react-router'
import { useAuthContext } from '@/context/AuthContext'
import { Skeleton } from '@/app/components/ui/skeleton'
import { AvisoCargaLenta } from '@/app/components/ui-mady/AvisoCargaLenta'

export function RequireAuth() {
  const { user, loading, isRecovery } = useAuthContext()

  if (loading) {
    return (
      <div className="min-h-screen bg-background p-4 space-y-3" aria-busy="true" aria-label="Cargando">
        <Skeleton className="h-12 w-full" />
        <Skeleton className="h-24 w-full" />
        <Skeleton className="h-24 w-full" />
        <Skeleton className="h-24 w-full" />
        <AvisoCargaLenta />
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
