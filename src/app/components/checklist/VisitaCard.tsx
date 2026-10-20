import { CalendarPlus } from 'lucide-react'
import type { ChkVisita } from '@/hooks/useChecklist'
import { fechaLarga } from './constantes'
import { FilaRegistro } from '@/app/components/ui-mady/FilaRegistro'

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
  const boton = 'h-9 px-3 rounded-lg text-xs border transition-colors'

  return (
    <FilaRegistro
      variante="tarjeta"
      tono={atrasada ? 'resaltadoConTexto' : 'normal'}
      className="h-full"
      {...(visita
        ? {
            etiquetas: <span className="text-xs" style={{ opacity: 0.8 }}>Próxima visita de revisión</span>,
            titulo: atrasada ? `Atrasada desde el ${fechaLarga(visita.fecha)}` : fechaLarga(visita.fecha),
            lineas: (visita.revisor || visita.nota) ? (
              <>
                {visita.revisor && <span className="block" style={{ opacity: 0.8 }}>Revisa: {visita.revisor}</span>}
                {visita.nota && <span className="mt-1 block whitespace-pre-wrap">{visita.nota}</span>}
              </>
            ) : undefined,
            acciones: puedeEditar ? (
              <>
                <button
                  type="button"
                  onClick={onTerminar}
                  className={`${boton} border-transparent`}
                  style={{ backgroundColor: 'var(--primary)', color: 'var(--primary-foreground)', fontWeight: 600 }}
                >
                  Terminar visita
                </button>
                <button type="button" onClick={onReprogramar} className={`${boton} border-border bg-card text-foreground transition-colors duration-[var(--motion-fast)] ease-[var(--ease-out)] hover:bg-muted`} style={{ fontWeight: 600 }}>
                  Reprogramar
                </button>
                <button
                  type="button"
                  onClick={onCancelar}
                  className={`${boton} bg-card transition-colors duration-[var(--motion-fast)] ease-[var(--ease-out)] hover:bg-muted`}
                  style={{ borderColor: 'var(--agro-red)', color: 'var(--agro-danger-text)', fontWeight: 600 }}
                >
                  Cancelar
                </button>
              </>
            ) : undefined,
          }
        : {
            titulo: 'Sin visita programada',
            lineas: 'Agenda cuándo revisarás este sitio.',
            derecha: puedeEditar ? (
              <button
                type="button"
                onClick={onProgramar}
                className={`${boton} border-transparent inline-flex items-center gap-1.5 flex-shrink-0 self-center`}
                style={{ backgroundColor: 'var(--primary)', color: 'var(--primary-foreground)', fontWeight: 600 }}
              >
                <CalendarPlus className="w-3.5 h-3.5" />
                Programar visita
              </button>
            ) : undefined,
          })}
    >
      {hayVisitas && (
        <div className="flex justify-end">
          <button type="button" onClick={onVerVisitas} className="text-xs font-semibold" style={{ color: 'var(--primary)' }}>
            Ver visitas
          </button>
        </div>
      )}
    </FilaRegistro>
  )
}
