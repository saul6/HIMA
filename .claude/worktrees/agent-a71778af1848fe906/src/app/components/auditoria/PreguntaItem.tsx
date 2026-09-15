import type { AuditoriaPregunta, RespuestaAuditoria } from '@/types/database.types'

const LABELS: Record<RespuestaAuditoria, string> = {
  cumple: 'Cumple',
  no_cumple: 'No cumple',
  na: 'N/A',
}

const ACTIVO_CLASS: Record<RespuestaAuditoria, string> = {
  cumple: 'bg-agro-success-fill text-agro-success-text',
  no_cumple: 'bg-agro-danger-fill text-agro-danger-text',
  na: 'bg-muted text-foreground',
}

interface PreguntaItemProps {
  pregunta: AuditoriaPregunta
  respuesta: RespuestaAuditoria | undefined
  comentario: string | undefined
  onRespuesta: (preguntaId: string, respuesta: RespuestaAuditoria) => void
  onComentario: (preguntaId: string, comentario: string) => void
}

export function PreguntaItem({
  pregunta,
  respuesta,
  comentario,
  onRespuesta,
  onComentario,
}: PreguntaItemProps) {
  const opciones: RespuestaAuditoria[] = ['cumple', 'no_cumple', 'na']

  return (
    <div className="py-3 border-b border-border last:border-b-0">
      <div className="mb-2">
        <div className="flex items-center gap-2 mb-1">
          <span className="text-[10px] text-muted-foreground shrink-0">{pregunta.codigo}</span>
          {pregunta.puntos > 0 ? (
            <span className="text-[10px] bg-muted px-1.5 py-0.5 rounded text-muted-foreground">
              {pregunta.puntos} pts
            </span>
          ) : (
            <span className="text-[10px] bg-muted px-1.5 py-0.5 rounded text-muted-foreground">
              Info
            </span>
          )}
        </div>
        <p className="text-sm text-foreground leading-snug">{pregunta.texto}</p>
      </div>

      <div className="flex gap-1.5">
        {opciones.map((op) => (
          <button
            key={op}
            type="button"
            onClick={() => onRespuesta(pregunta.id, op)}
            className={`flex-1 h-8 rounded-lg text-xs transition-colors ${
              respuesta === op
                ? ACTIVO_CLASS[op]
                : 'bg-input-background text-muted-foreground hover:bg-muted'
            }`}
            style={{ fontWeight: respuesta === op ? 600 : 400 }}
          >
            {LABELS[op]}
          </button>
        ))}
      </div>

      {respuesta && (
        <input
          type="text"
          placeholder="Comentario (opcional)"
          value={comentario ?? ''}
          onChange={(e) => onComentario(pregunta.id, e.target.value)}
          className="w-full mt-2 h-8 px-2.5 text-xs rounded-lg bg-input-background border border-border text-foreground placeholder:text-muted-foreground focus:outline-none focus:border-primary focus:ring-1 focus:ring-primary"
        />
      )}
    </div>
  )
}
