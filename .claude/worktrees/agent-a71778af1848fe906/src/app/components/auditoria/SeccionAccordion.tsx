import { useState } from 'react'
import { ChevronDown } from 'lucide-react'
import { PreguntaItem } from './PreguntaItem'
import { calcularAgregados } from '@/hooks/useAuditoria'
import type { AuditoriaSeccion, AuditoriaPregunta, RespuestaAuditoria } from '@/types/database.types'

function scoreClass(porcentaje: number, posibles: number): string {
  if (posibles === 0) return 'bg-muted text-muted-foreground'
  if (porcentaje >= 85) return 'bg-agro-success-fill text-agro-success-text'
  if (porcentaje >= 70) return 'bg-agro-warning-fill text-agro-warning-text'
  return 'bg-agro-danger-fill text-agro-danger-text'
}

interface SeccionAccordionProps {
  seccion: AuditoriaSeccion
  preguntas: AuditoriaPregunta[]
  respuestas: Map<string, RespuestaAuditoria>
  comentarios: Map<string, string>
  onRespuesta: (preguntaId: string, respuesta: RespuestaAuditoria) => void
  onComentario: (preguntaId: string, comentario: string) => void
  defaultAbierto?: boolean
}

export function SeccionAccordion({
  seccion,
  preguntas,
  respuestas,
  comentarios,
  onRespuesta,
  onComentario,
  defaultAbierto = false,
}: SeccionAccordionProps) {
  const [abierto, setAbierto] = useState(defaultAbierto)

  const { puntos_obtenidos, puntos_posibles, porcentaje } = calcularAgregados(preguntas, respuestas)
  const respondidas = preguntas.filter((p) => respuestas.has(p.id)).length

  return (
    <div className="bg-card border border-border rounded-xl overflow-hidden">
      <button
        type="button"
        onClick={() => setAbierto((a) => !a)}
        className="w-full px-4 py-3 flex items-center gap-3 text-left"
      >
        <div className="flex-1 min-w-0">
          <p className="text-sm text-foreground truncate" style={{ fontWeight: 600 }}>
            {seccion.codigo} · {seccion.nombre}
          </p>
          <p className="text-xs text-muted-foreground mt-0.5">
            {respondidas}/{preguntas.length} respondidas
          </p>
        </div>
        <div className="flex items-center gap-2 shrink-0">
          <span
            className={`text-[11px] px-2 py-0.5 rounded ${scoreClass(porcentaje, puntos_posibles)}`}
            style={{ fontWeight: 600 }}
          >
            {puntos_posibles > 0
              ? `${porcentaje}% · ${puntos_obtenidos}/${puntos_posibles} pts`
              : respondidas > 0
              ? 'Solo info'
              : '—'}
          </span>
          <ChevronDown
            className={`w-4 h-4 text-muted-foreground transition-transform duration-200 ${
              abierto ? 'rotate-180' : ''
            }`}
          />
        </div>
      </button>

      {abierto && (
        <div className="px-4 border-t border-border">
          {preguntas.map((p) => (
            <PreguntaItem
              key={p.id}
              pregunta={p}
              respuesta={respuestas.get(p.id)}
              comentario={comentarios.get(p.id)}
              onRespuesta={onRespuesta}
              onComentario={onComentario}
            />
          ))}
        </div>
      )}
    </div>
  )
}
