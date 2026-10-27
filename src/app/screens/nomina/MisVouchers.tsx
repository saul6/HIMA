import { ModuloHeader } from '@/app/components/ModuloHeader'
import { EstadoVacio } from '@/app/components/ui-mady/EstadoVacio'

export function MisVouchers() {
  return (
    <div className="min-h-full pb-safe-nav">
      <ModuloHeader tituloFallback="Mis vouchers" />
      <EstadoVacio titulo="En construcción" />
    </div>
  )
}
