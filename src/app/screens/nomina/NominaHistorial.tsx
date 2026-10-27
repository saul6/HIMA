import { useNavigate } from 'react-router'
import { History } from 'lucide-react'
import { ModuloHeader } from '@/app/components/ModuloHeader'
import { Boton } from '@/app/components/ui-mady/Boton'
import { EstadoVacio } from '@/app/components/ui-mady/EstadoVacio'

/** Ventana del historial de trabajadores: solo informativa. La carga real llegará después. */
export function NominaHistorial() {
  const navigate = useNavigate()
  return (
    <div className="min-h-full pb-safe-nav">
      <ModuloHeader tituloFallback="Historial" forzarTitulo="Historial" onBack={() => navigate('/nomina')} />
      <div className="px-4 py-4 max-w-3xl mx-auto">
        <EstadoVacio
          icono={History}
          titulo="Historial por cargar"
          ayuda="Aquí se importará el historial de pagos anteriores al arranque; no afecta las semanas nuevas."
          accion={
            <div className="flex flex-col items-center gap-1">
              <Boton disabled>Cargar historial</Boton>
              <span className="text-xs text-muted-foreground">Disponible próximamente</span>
            </div>
          }
        />
      </div>
    </div>
  )
}
