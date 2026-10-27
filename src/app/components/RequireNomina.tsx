import { Navigate, Outlet } from 'react-router'
import { useTieneNomina } from '@/hooks/useNomina'
import { ErrorCargaModulos } from '@/app/components/ErrorCargaModulos'

/** Deja pasar solo si get_mis_modulos trae M81 (admin de una organización habilitada). */
export function RequireNomina() {
  const { tiene, cargando, error, refetch } = useTieneNomina()
  if (cargando) return null
  if (tiene) return <Outlet />
  if (error) return <ErrorCargaModulos onReintentar={() => { void refetch() }} />
  return <Navigate to="/" replace />
}
