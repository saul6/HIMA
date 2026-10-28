import { Skeleton } from '@/app/components/ui/skeleton'
import { AvisoCargaLenta } from '@/app/components/ui-mady/AvisoCargaLenta'

/** Imita la pantalla del checklist (sitio + visita, píldoras y tarjetas en 2 columnas). */
export function ChecklistSkeleton() {
  return (
    <div className="space-y-4" aria-hidden="true">
      <div className="grid gap-4 md:grid-cols-2">
        <div className="space-y-1.5">
          <Skeleton className="h-3 w-12" />
          <Skeleton className="h-10 w-full rounded-lg" />
        </div>
        <div className="rounded-xl border border-border bg-card p-4 space-y-2">
          <Skeleton className="h-3 w-32" />
          <Skeleton className="h-4 w-44" />
          <Skeleton className="h-8 w-28 rounded-lg" />
        </div>
      </div>
      <div className="flex flex-wrap gap-2">
        {[28, 24, 28, 36].map((w, i) => <Skeleton key={i} className="h-9 rounded-full" style={{ width: `${w * 4}px` }} />)}
      </div>
      <Skeleton className="h-3 w-36" />
      <div className="grid gap-3 grid-cols-1 lg:grid-cols-2">
        {Array.from({ length: 6 }).map((_, i) => (
          <div key={i} className="bg-card rounded-xl border border-border p-4 space-y-2.5">
            <div className="flex items-start justify-between gap-3">
              <div className="space-y-2 min-w-0 flex-1">
                <Skeleton className="h-3 w-20" />
                <Skeleton className="h-4 w-3/4" />
                <Skeleton className="h-3 w-1/2" />
              </div>
              <Skeleton className="h-5 w-16 rounded-full" />
            </div>
            <Skeleton className="h-7 w-full rounded-lg" />
          </div>
        ))}
      </div>
      <AvisoCargaLenta />
    </div>
  )
}
