import { Skeleton } from '@/app/components/ui/skeleton'
import { AvisoCargaLenta } from '@/app/components/ui-mady/AvisoCargaLenta'
import { ListaAncho, ListaTarjetas } from '@/app/components/ui-mady/ListaTarjetas'
import { useEsEscritorio } from './useEsEscritorio'

interface Props {
  /** cartera: indicadores + secciones por cliente · detalle: encabezado, indicadores, pestañas y catálogo. */
  variante?: 'cartera' | 'detalle'
  /** Refetch que la pantalla ya tiene: agrega "Reintentar" al aviso de carga lenta. */
  onReintentar?: () => void
}

function Indicadores({ n = 4 }: { n?: number }) {
  return (
    <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
      {Array.from({ length: n }).map((_, i) => (
        <div key={i} className="rounded-xl border border-border bg-card p-4 space-y-2">
          <Skeleton className="h-3 w-24" />
          <Skeleton className="h-7 w-12" />
        </div>
      ))}
    </div>
  )
}

function TarjetaInstalacionSkeleton() {
  return (
    <div className="bg-card rounded-xl border border-border p-4 space-y-2.5">
      <Skeleton className="h-3 w-24" />
      <Skeleton className="h-4 w-3/4" />
      <div className="flex gap-1.5">
        <Skeleton className="h-5 w-20 rounded-full" />
        <Skeleton className="h-5 w-28 rounded-full" />
      </div>
      <Skeleton className="h-3 w-40" />
      <Skeleton className="h-3 w-28" />
    </div>
  )
}

/** Imita la pantalla del checklist mientras carga, con la misma forma que el contenido final. */
export function ChecklistSkeleton({ variante = 'cartera', onReintentar }: Props) {
  const esEscritorio = useEsEscritorio()

  if (variante === 'detalle') {
    return (
      <div className="space-y-4" aria-hidden="true">
        <div className="flex items-start gap-3">
          <Skeleton className="h-8 w-8 rounded-lg flex-shrink-0" />
          <div className="min-w-0 flex-1 space-y-2">
            <Skeleton className="h-5 w-48" />
            <Skeleton className="h-3 w-64 max-w-full" />
          </div>
          <Skeleton className="h-10 w-72 max-w-[40%] rounded-lg" />
        </div>
        <Indicadores />
        <div className="flex items-center justify-between gap-3">
          <Skeleton className="h-10 w-full max-w-[26rem] rounded-xl" />
          <Skeleton className="h-4 w-28 hidden lg:block" />
        </div>
        <div className="rounded-xl border border-border bg-card p-4 space-y-3">
          <div className="flex items-start justify-between gap-4">
            <div className="space-y-2">
              <Skeleton className="h-4 w-56" />
              <Skeleton className="h-3 w-40" />
            </div>
            <div className="hidden lg:flex gap-2">
              {[40, 24, 24, 28].map((w, i) => <Skeleton key={i} className="h-8 rounded-lg" style={{ width: `${w * 4}px` }} />)}
            </div>
          </div>
          <Skeleton className="h-9 w-full rounded-lg" />
        </div>
        <div className="flex flex-wrap gap-2">
          {[28, 40, 24].map((w, i) => <Skeleton key={i} className="h-9 rounded-full" style={{ width: `${w * 4}px` }} />)}
        </div>
        <div className="rounded-xl border border-border bg-card overflow-hidden">
          <Skeleton className="h-9 w-full rounded-none" />
          {Array.from({ length: 6 }).map((_, i) => (
            <div key={i} className="flex items-center gap-3 border-t border-border px-3 py-3">
              <Skeleton className="h-4 w-4" />
              <Skeleton className="h-5 w-24" />
              <div className="min-w-0 flex-1 space-y-1.5">
                <Skeleton className="h-4 w-2/3" />
                <Skeleton className="h-3 w-1/3" />
              </div>
              <Skeleton className="h-9 w-28 rounded-lg" />
            </div>
          ))}
        </div>
        <AvisoCargaLenta onReintentar={onReintentar} />
      </div>
    )
  }

  return (
    <div className="space-y-6" aria-hidden="true">
      {esEscritorio && <Indicadores />}
      <div className="space-y-2">
        <div className="flex items-center justify-between gap-2">
          <div className="space-y-1.5">
            <Skeleton className="h-4 w-32" />
            <Skeleton className="h-3 w-24" />
          </div>
          <Skeleton className="h-9 w-28 rounded-lg" />
        </div>
        <ListaTarjetas>
          {Array.from({ length: 4 }).map((_, i) => <TarjetaInstalacionSkeleton key={i} />)}
          <ListaAncho>
            <AvisoCargaLenta onReintentar={onReintentar} />
          </ListaAncho>
        </ListaTarjetas>
      </div>
    </div>
  )
}
