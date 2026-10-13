import { useNavigate, useLocation } from 'react-router'
import { BottomSheet } from '@/app/components/BottomSheet'
import { NuevaAuditoriaEfimeraForm } from './NuevaAuditoriaEfimeraForm'

// Ruta hija /auditor/instalacion/:instalacionId/nueva — se pinta dentro del
// <Outlet /> de AuditorInstalacionDetalle. Cerrar regresa a la instalación.
export function AuditorNuevaAuditoriaEfimera() {
  const navigate = useNavigate()
  const location = useLocation()
  const cerrar = () => navigate('..', { relative: 'path', replace: true, state: location.state })

  return (
    <BottomSheet open onClose={cerrar} height="85%">
      <NuevaAuditoriaEfimeraForm onClose={cerrar} />
    </BottomSheet>
  )
}
