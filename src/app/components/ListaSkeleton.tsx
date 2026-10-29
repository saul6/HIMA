import { Skeleton } from '@/app/components/ui/skeleton'
import { AvisoCargaLenta } from '@/app/components/ui-mady/AvisoCargaLenta'
import { ListaAncho, ListaTarjetas } from '@/app/components/ui-mady/ListaTarjetas'

interface ListaSkeletonProps {
  /** Número de filas a imitar (3–6). */
  rows?: number
  /** Refetch que la pantalla ya tiene: agrega "Reintentar" al aviso de carga lenta. */
  onReintentar?: () => void
  /** false si el esqueleto está sobre un formulario a medio llenar (el aviso no ofrece recargar la página). */
  permitirRecargar?: boolean
  /** true: dibuja el esqueleto en la misma rejilla de ListaTarjetas (2 columnas en escritorio ancho). */
  rejilla?: boolean
}

/** Skeleton genérico para listas de registros de módulo — mismo contenedor
 * de card (rounded-xl border p-4) que usa el patrón M6 de referencia
 * (ver BotiquinPrimerosAuxilios.tsx). Sustituye el spinner centrado que
 * mostraban estas pantallas mientras `loading` es true. */
export function ListaSkeleton({ rows = 4, onReintentar, permitirRecargar, rejilla = false }: ListaSkeletonProps) {
  const filas = Array.from({ length: rows }).map((_, i) => (
    <div key={i} className="bg-card rounded-xl p-4 border border-border">
      <div className="flex items-start justify-between gap-3">
        <div className="flex-1 min-w-0 space-y-2">
          <div className="flex items-center gap-2">
            <Skeleton className="h-3.5 w-28" />
            <Skeleton className="h-4 w-14 rounded-full" />
          </div>
          <Skeleton className="h-3 w-20" />
        </div>
        <Skeleton className="h-8 w-8 rounded-lg flex-shrink-0" />
      </div>
    </div>
  ))

  if (rejilla) {
    return (
      <ListaTarjetas>
        {filas}
        <ListaAncho>
          <AvisoCargaLenta onReintentar={onReintentar} permitirRecargar={permitirRecargar} />
        </ListaAncho>
      </ListaTarjetas>
    )
  }

  return (
    <div className="space-y-3">
      {filas}
      <AvisoCargaLenta onReintentar={onReintentar} permitirRecargar={permitirRecargar} />
    </div>
  )
}
