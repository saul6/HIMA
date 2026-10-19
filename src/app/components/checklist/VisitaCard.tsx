import { CalendarPlus } from 'lucide-react'
import type { ChkVisita } from '@/hooks/useChecklist'
import { fechaLarga } from './constantes'

interface Props {
  visita: ChkVisita | null
  puedeEditar: boolean
  onProgramar: () => void
  onTerminar: () => void
  onReprogramar: () => void
  onCancelar: () => void
  onVerVisitas: () => void
  hayVisitas: boolean
}

export function VisitaCard({ visita, puedeEditar, onProgramar, onTerminar, onReprogramar, onCancelar, onVerVisitas, hayVisitas }: Props) {
  const atrasada = !!visita?.atrasada
  const boton = 'h-9 px-3 rounded-lg text-xs border transition-colors active:scale-[0.97]'

  return (
    <div
      className="rounded-xl border p-4 h-full flex flex-col gap-3 md:flex-row md:flex-wrap md:items-center md:justify-between md:gap-x-4 md:gap-y-2"
      style={atrasada
        ? { backgroundColor: 'var(--agro-warning-fill)', borderColor: 'var(--agro-amber)' }
        : { backgroundColor: 'var(--card)', borderColor: 'var(--border)' }}
    >
      {visita ? (
        <>
          <div className="md:flex-1 md:min-w-0" style={atrasada ? { color: 'var(--agro-warning-text)' } : undefined}>
            <p className="text-xs" style={{ opacity: 0.8 }}>Próxima visita de revisión</p>
            <p className="text-sm" style={{ fontWeight: 600 }}>
              {atrasada ? `Atrasada desde el ${fechaLarga(visita.fecha)}` : fechaLarga(visita.fecha)}
            </p>
            {visita.revisor && <p className="text-xs" style={{ opacity: 0.8 }}>Revisa: {visita.revisor}</p>}
            {visita.nota && <p className="text-xs mt-1 whitespace-pre-wrap">{visita.nota}</p>}
          </div>
          {puedeEditar && (
            <div className="flex flex-wrap gap-2">
              <button
                type="button"
                onClick={onTerminar}
                className={`${boton} border-transparent`}
                style={{ backgroundColor: 'var(--primary)', color: 'var(--primary-foreground)', fontWeight: 600 }}
              >
                Terminar visita
              </button>
              <button type="button" onClick={onReprogramar} className={`${boton} border-border bg-card text-foreground hover:bg-muted`} style={{ fontWeight: 600 }}>
                Reprogramar
              </button>
              <button
                type="button"
                onClick={onCancelar}
                className={`${boton} bg-card hover:bg-muted`}
                style={{ borderColor: 'var(--agro-red)', color: 'var(--agro-danger-text)', fontWeight: 600 }}
              >
                Cancelar
              </button>
            </div>
          )}
        </>
      ) : (
        <div className="flex items-center justify-between gap-3 md:flex-1 md:min-w-0">
          <div>
            <p className="text-sm text-foreground" style={{ fontWeight: 600 }}>Sin visita programada</p>
            <p className="text-xs text-muted-foreground">Agenda cuándo revisarás este sitio.</p>
          </div>
          {puedeEditar && (
            <button
              type="button"
              onClick={onProgramar}
              className={`${boton} border-transparent inline-flex items-center gap-1.5 flex-shrink-0`}
              style={{ backgroundColor: 'var(--primary)', color: 'var(--primary-foreground)', fontWeight: 600 }}
            >
              <CalendarPlus className="w-3.5 h-3.5" />
              Programar visita
            </button>
          )}
        </div>
      )}
      {hayVisitas && (
        <div className="flex justify-end md:ml-auto">
          <button type="button" onClick={onVerVisitas} className="text-xs" style={{ color: 'var(--primary)', fontWeight: 600 }}>
            Ver visitas
          </button>
        </div>
      )}
    </div>
  )
}
