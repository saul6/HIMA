import { useParams, useNavigate, useLocation } from 'react-router'
import { BottomSheet } from '@/app/components/BottomSheet'
import { AuditorInstalacionDetalle } from './AuditorInstalacionDetalle'
import { NuevaAuditoriaEfimeraForm } from './NuevaAuditoriaEfimeraForm'

// Ruta /auditor/instalacion/:instalacionId/nueva — pinta la instalación y
// encima la ventana de "Nueva auditoría". Cerrar regresa a la instalación.
export function AuditorNuevaAuditoriaEfimera() {
  const { instalacionId } = useParams<{ instalacionId: string }>()
  const navigate = useNavigate()
  const location = useLocation()

  function cerrar() {
    navigate(`/auditor/instalacion/${instalacionId}`, { replace: true, state: location.state })
  }

  return (
    <>
      <AuditorInstalacionDetalle />
      <BottomSheet open onClose={cerrar} height="85%">
        <NuevaAuditoriaEfimeraForm onClose={cerrar} />
      </BottomSheet>
    </>
  )
}
