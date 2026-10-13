import { useNavigate } from 'react-router'
import { BottomSheet } from '@/app/components/BottomSheet'
import { NuevaInstalacionForm } from './NuevaInstalacionForm'

// Ruta hija /auditor/instalacion/nueva — se pinta dentro del <Outlet /> de
// AuditorHome. Cerrar regresa al Inicio.
export function AuditorNuevaInstalacion() {
  const navigate = useNavigate()
  const cerrar = () => navigate('/auditor', { replace: true })

  return (
    <BottomSheet open onClose={cerrar} height="85%">
      <NuevaInstalacionForm onClose={cerrar} />
    </BottomSheet>
  )
}
