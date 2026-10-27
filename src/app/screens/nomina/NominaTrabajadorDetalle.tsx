import { ModuloHeader } from '@/app/components/ModuloHeader'
import { EstadoVacio } from '@/app/components/ui-mady/EstadoVacio'

export function NominaTrabajadorDetalle() {
  return (
    <div className="min-h-full pb-safe-nav">
      <ModuloHeader tituloFallback="Trabajador" />
      <EstadoVacio titulo="En construcción" />
    </div>
  )
}
