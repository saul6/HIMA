import { Skeleton } from '@/app/components/ui/skeleton'

interface FormularioSkeletonProps {
  /** Número de campos (etiqueta + caja) a imitar. */
  campos?: number
}

/** Skeleton para formularios que esperan su catálogo: una etiqueta corta y una caja de 44 px por campo. */
export function FormularioSkeleton({ campos = 3 }: FormularioSkeletonProps) {
  return (
    <div className="flex flex-col gap-5" aria-busy="true" aria-label="Cargando formulario">
      {Array.from({ length: campos }).map((_, i) => (
        <div key={i} className="flex flex-col gap-1.5">
          <Skeleton className="h-3 w-24" />
          <Skeleton className="h-11 w-full rounded-lg" />
        </div>
      ))}
    </div>
  )
}
