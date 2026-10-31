import { Navigate, Outlet } from 'react-router'
import { useAuthContext } from '@/context/AuthContext'
import { Skeleton } from '@/app/components/ui/skeleton'
import { AvisoCargaLenta } from '@/app/components/ui-mady/AvisoCargaLenta'
import { Boton } from '@/app/components/ui-mady/Boton'

export function RequireAuth() {
  const { user, profile, loading, isRecovery, signOut } = useAuthContext()

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

  // Miembro dado de baja: la BD ya no le devuelve datos; no se renderiza nada de la app.
  if (profile?.activo === false) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center p-6">
        <div className="w-full max-w-sm text-center space-y-4">
          <h1 className="text-foreground font-semibold text-lg">Tu acceso fue desactivado</h1>
          <p className="text-sm text-muted-foreground">
            Si crees que es un error, contacta al administrador de tu organización.
          </p>
          <Boton type="button" variante="secundario" className="w-full h-11" onClick={() => void signOut()}>
            Cerrar sesión
          </Boton>
        </div>
      </div>
    )
  }

  return <Outlet />
}
