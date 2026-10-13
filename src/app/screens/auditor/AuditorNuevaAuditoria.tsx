import { useNavigate, useLocation } from 'react-router'
import { BottomSheet } from '@/app/components/BottomSheet'
import { NuevaAuditoriaPgfsForm } from './NuevaAuditoriaPgfsForm'

// Ruta hija /auditor/org/:orgId/nueva — se pinta dentro del <Outlet /> de
// AuditorOrgDetalle, así la empresa de fondo no se desmonta. Cerrar regresa
// a la empresa (replace).
export function AuditorNuevaAuditoria() {
  const navigate = useNavigate()
  const location = useLocation()
  const cerrar = () => navigate('..', { relative: 'path', replace: true, state: location.state })

  return (
    <BottomSheet open onClose={cerrar} height="85%">
      <NuevaAuditoriaPgfsForm onClose={cerrar} />
    </BottomSheet>
  )
}
