import { Navigate, Outlet } from 'react-router'
import { useTieneNomina } from '@/hooks/useNomina'

/** Deja pasar solo si get_mis_modulos trae M81 (admin de una organización habilitada). */
export function RequireNomina() {
  const { tiene, cargando } = useTieneNomina()
  if (cargando) return null
  if (!tiene) return <Navigate to="/" replace />
  return <Outlet />
}
