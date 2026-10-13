import { useNavigate } from 'react-router'
import { BottomSheet } from '@/app/components/BottomSheet'
import { AuditorHome } from './AuditorHome'
import { NuevaInstalacionForm } from './NuevaInstalacionForm'

// Ruta /auditor/instalacion/nueva — pinta el Inicio y encima la ventana de
// "Nueva instalación". Cerrar regresa al Inicio.
export function AuditorNuevaInstalacion() {
  const navigate = useNavigate()
  const cerrar = () => navigate('/auditor', { replace: true })

  return (
    <>
      <AuditorHome />
      <BottomSheet open onClose={cerrar} height="85%">
        <NuevaInstalacionForm onClose={cerrar} />
      </BottomSheet>
    </>
  )
}
