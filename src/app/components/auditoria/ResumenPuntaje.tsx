import { calcularProgresoCatalogo } from '@/hooks/useAuditoriaV2'
import type { AudPregunta, AudRespuesta } from '@/types/database.types'

interface ResumenPuntajeProps {
  preguntas: AudPregunta[]
  respuestas: Map<string, AudRespuesta>
}

export function ResumenPuntaje({ preguntas, respuestas }: ResumenPuntajeProps) {
  const { puntos_obtenidos, puntos_posibles, porcentaje } = calcularProgresoCatalogo(preguntas, respuestas)
  const respondidas = preguntas.filter((p) => respuestas.has(p.id)).length
  const total = preguntas.length

  const color =
    puntos_posibles === 0
      ? 'var(--muted-foreground)'
      : porcentaje >= 85
      ? 'var(--agro-success-text)'
      : porcentaje >= 70
      ? 'var(--agro-warning-text)'
      : 'var(--agro-danger-text)'

  const bg =
    puntos_posibles === 0
      ? 'var(--muted)'
      : porcentaje >= 85
      ? 'var(--agro-success-fill)'
      : porcentaje >= 70
      ? 'var(--agro-warning-fill)'
      : 'var(--agro-danger-fill)'

  return (
    <div className="rounded-xl p-4 flex items-center gap-4" style={{ backgroundColor: bg }}>
      <div className="flex-1 min-w-0">
        <p className="text-xs" style={{ color, fontWeight: 600 }}>
          Progreso
        </p>
        <p className="text-xs mt-0.5" style={{ color }}>
          {respondidas}/{total} preguntas respondidas
        </p>
      </div>
      <div className="text-right shrink-0">
        {puntos_posibles > 0 ? (
          <>
            <p className="text-2xl" style={{ color, fontWeight: 700, lineHeight: 1 }}>
              {porcentaje}%
            </p>
            <p className="text-xs mt-0.5" style={{ color }}>
              {puntos_obtenidos}/{puntos_posibles} pts
            </p>
          </>
        ) : (
          <p className="text-2xl" style={{ color, fontWeight: 700, lineHeight: 1 }}>
            {respondidas}/{total}
          </p>
        )}
      </div>
    </div>
  )
}
