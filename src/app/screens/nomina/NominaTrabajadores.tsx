import { ModuloHeader } from '@/app/components/ModuloHeader'
import { EstadoVacio } from '@/app/components/ui-mady/EstadoVacio'

export function NominaTrabajadores() {
  return (
    <div className="min-h-full pb-safe-nav">
      <ModuloHeader tituloFallback="Trabajadores" />
      <EstadoVacio titulo="En construcción" />
    </div>
  )
}
