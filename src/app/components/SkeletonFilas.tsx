import { Skeleton } from '@/app/components/ui/skeleton'

interface SkeletonFilasProps {
  /** Número de filas a imitar (2–3). */
  rows?: number
}

/** Skeleton ligero para secciones desplegables (p. ej. "Ver historial",
 * "Ver historial de firmas") — imita la tarjeta pequeña de cada fila sin el
 * padding de card completo que usa ListaSkeleton. */
export function SkeletonFilas({ rows = 2 }: SkeletonFilasProps) {
  return (
    <div className="space-y-2">
      {Array.from({ length: rows }).map((_, i) => (
        <div
          key={i}
          className="rounded-lg border p-2 space-y-1.5"
          style={{ borderColor: 'var(--border)' }}
        >
          <div className="flex items-center gap-2">
            <Skeleton className="h-3 w-3 rounded-full" />
            <Skeleton className="h-3 w-24" />
          </div>
          <Skeleton className="h-3 w-32" />
          <Skeleton className="h-2.5 w-20" />
        </div>
      ))}
    </div>
  )
}
