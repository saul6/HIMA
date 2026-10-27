import { ModuloHeader } from '@/app/components/ModuloHeader'
import { EstadoVacio } from '@/app/components/ui-mady/EstadoVacio'

export function NominaHistorial() {
  return (
    <div className="min-h-full pb-safe-nav">
      <ModuloHeader tituloFallback="Historial" />
      <EstadoVacio titulo="En construcción" />
    </div>
  )
}
