// Recorrido de la visita en curso: indicador de etapas (informativo, no es un selector) y botones Anterior / Siguiente.
import { ChevronLeft, ChevronRight } from 'lucide-react'
import { Boton } from '@/app/components/ui-mady/Boton'

export type Etapa = 1 | 2 | 3 | 'resumen'

export const NOMBRE_ETAPA: Record<string, string> = { '1': 'Formatos', '2': 'Controles', '3': 'Orgánico', resumen: 'Resumen' }

interface IndicadorProps {
  etapas: Etapa[]
  actual: Etapa
  /** Progreso de la etapa actual, ej. "12 de 42 revisados". */
  progreso: string | null
  onVerResumen: () => void
}

export function IndicadorEtapas({ etapas, actual, progreso, onVerResumen }: IndicadorProps) {
  return (
    <nav aria-label="Etapas de la visita" className="space-y-1.5">
      <ol className="flex flex-wrap items-center gap-x-2 gap-y-1 text-sm">
        {etapas.map((e, i) => {
          const activa = e === actual
          return (
            <li key={e} className="flex items-center gap-2" aria-current={activa ? 'step' : undefined}>
              <span className={activa ? 'font-semibold text-foreground' : 'text-muted-foreground'}>
                {i + 1} {NOMBRE_ETAPA[String(e)]}
              </span>
              {activa && progreso && <span className="text-xs text-muted-foreground">· {progreso}</span>}
              {i < etapas.length - 1 && <span className="text-muted-foreground" aria-hidden="true">·</span>}
            </li>
          )
        })}
      </ol>
      {actual !== 'resumen' && (
        <button type="button" onClick={onVerResumen} className="text-xs font-semibold" style={{ color: 'var(--primary)' }}>Ver resumen</button>
      )}
    </nav>
  )
}

interface PieProps {
  puedeAnterior: boolean
  mostrarSiguiente: boolean
  verificando: boolean
  onAnterior: () => void
  onSiguiente: () => void
}

export function PieEtapas({ puedeAnterior, mostrarSiguiente, verificando, onAnterior, onSiguiente }: PieProps) {
  return (
    <div className="flex gap-3">
      <Boton variante="secundario" className="flex-1" disabled={!puedeAnterior} onClick={onAnterior}><ChevronLeft className="w-4 h-4" /> Anterior</Boton>
      {mostrarSiguiente && <Boton className="flex-1" cargando={verificando} onClick={onSiguiente}>Siguiente <ChevronRight className="w-4 h-4" /></Boton>}
    </div>
  )
}
