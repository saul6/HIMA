import { ModuloHeader } from '@/app/components/ModuloHeader'
import { EstadoVacio } from '@/app/components/ui-mady/EstadoVacio'

export function NominaCatalogo() {
  return (
    <div className="min-h-full pb-safe-nav">
      <ModuloHeader tituloFallback="Catálogo" />
      <EstadoVacio titulo="En construcción" />
    </div>
  )
}
