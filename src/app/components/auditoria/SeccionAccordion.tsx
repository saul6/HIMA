import { useState } from 'react'
import { ChevronDown } from 'lucide-react'
import { PreguntaItem } from './PreguntaItem'
import { calcularProgresoCatalogo } from '@/hooks/useAuditoriaV2'
import type { AudBloque, AudPregunta, AudComentarioEsquema, AudRespuesta } from '@/types/database.types'

interface SeccionAccordionProps {
  seccion: Pick<AudBloque, 'id' | 'codigo' | 'nombre'>
  preguntas: AudPregunta[]
  esquemas: AudComentarioEsquema[]
  respuestas: Map<string, AudRespuesta>
  instanciaValores: Map<string, Map<string, string>>
  onRespuesta: (preguntaId: string, respuesta: AudRespuesta) => void
  onValor: (preguntaId: string, esquemaId: string, valor: string) => void
  defaultAbierto?: boolean
}

export function SeccionAccordion({
  seccion,
  preguntas,
  esquemas,
  respuestas,
  instanciaValores,
  onRespuesta,
  onValor,
  defaultAbierto = false,
}: SeccionAccordionProps) {
  const [abierto, setAbierto] = useState(defaultAbierto)

  const { puntos_posibles } = calcularProgresoCatalogo(preguntas, respuestas)
  const respondidas = preguntas.filter((p) => respuestas.has(p.id)).length
  const total = preguntas.length

  const chipClass =
    puntos_posibles > 0
      ? respondidas === total
        ? 'bg-agro-success-fill text-agro-success-text'
        : 'bg-agro-warning-fill text-agro-warning-text'
      : 'bg-muted text-muted-foreground'

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
            {respondidas}/{total} respondidas
          </p>
        </div>
        <div className="flex items-center gap-2 shrink-0">
          <span className={`text-[11px] px-2 py-0.5 rounded ${chipClass}`} style={{ fontWeight: 600 }}>
            {respondidas}/{total}
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
              esquemas={esquemas.filter((e) => e.pregunta_id === p.id)}
              respuesta={respuestas.get(p.id)}
              instanciaValores={instanciaValores.get(p.id) ?? new Map()}
              onRespuesta={onRespuesta}
              onValor={onValor}
            />
          ))}
        </div>
      )}
    </div>
  )
}
