import { ModuloHeader } from '@/app/components/ModuloHeader'
import { EstadoVacio } from '@/app/components/ui-mady/EstadoVacio'

export function NominaTrabajadorSemana() {
  return (
    <div className="min-h-full pb-safe-nav">
      <ModuloHeader tituloFallback="Semana del trabajador" />
      <EstadoVacio titulo="En construcción" />
    </div>
  )
}
