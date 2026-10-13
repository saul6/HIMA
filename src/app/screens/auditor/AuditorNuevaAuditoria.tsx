import { useParams, useNavigate, useLocation } from 'react-router'
import { BottomSheet } from '@/app/components/BottomSheet'
import { AuditorOrgDetalle } from './AuditorOrgDetalle'
import { NuevaAuditoriaPgfsForm } from './NuevaAuditoriaPgfsForm'

// Ruta /auditor/org/:orgId/nueva — pinta la empresa y encima la ventana de
// "Nueva auditoría". Cerrar regresa a la empresa (replace).
export function AuditorNuevaAuditoria() {
  const { orgId } = useParams<{ orgId: string }>()
  const navigate = useNavigate()
  const location = useLocation()

  function cerrar() {
    navigate(`/auditor/org/${orgId}`, { replace: true, state: location.state })
  }

  return (
    <>
      <AuditorOrgDetalle />
      <BottomSheet open onClose={cerrar} height="85%">
        <NuevaAuditoriaPgfsForm onClose={cerrar} />
      </BottomSheet>
    </>
  )
}
