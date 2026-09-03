import { AlertTriangle } from 'lucide-react'
import { calcularFallaAutomatica } from '@/hooks/useAuditoriaV2'
import type { AudPregunta, AudComentarioEsquema, AudRespuesta } from '@/types/database.types'

const OPCIONES: { val: AudRespuesta; label: string }[] = [
  { val: 'cumplimiento_total',  label: 'Cumplimiento total' },
  { val: 'deficiencia_menor',   label: 'Deficiencia menor' },
  { val: 'deficiencia_mayor',   label: 'Deficiencia mayor' },
  { val: 'no_conformidad',      label: 'No conformidad' },
  { val: 'na',                  label: 'N/A' },
]

const ACTIVO_CLASS: Record<AudRespuesta, string> = {
  cumplimiento_total: 'bg-agro-success-fill text-agro-success-text',
  deficiencia_menor:  'bg-agro-warning-fill text-agro-warning-text',
  deficiencia_mayor:  '',   // orange — inline style
  no_conformidad:     'bg-agro-danger-fill text-agro-danger-text',
  na:                 'bg-muted text-muted-foreground',
}

interface PreguntaItemProps {
  pregunta: AudPregunta
  esquemas: AudComentarioEsquema[]
  respuesta: AudRespuesta | undefined
  instanciaValores: Map<string, string>   // esquema_id → valor
  onRespuesta: (preguntaId: string, respuesta: AudRespuesta) => void
  onValor: (preguntaId: string, esquemaId: string, valor: string) => void
}

export function PreguntaItem({
  pregunta, esquemas, respuesta, instanciaValores, onRespuesta, onValor,
}: PreguntaItemProps) {
  const falla = respuesta
    ? calcularFallaAutomatica(pregunta.trigger_falla_automatica, respuesta)
    : 'ninguno'

  return (
    <div className="py-3 border-b border-border last:border-b-0">
      {/* Código + tipo + texto */}
      <div className="mb-2">
        <div className="flex items-center gap-2 mb-1">
          <span className="text-[10px] text-muted-foreground shrink-0">{pregunta.codigo}</span>
          <span className="text-[10px] bg-muted px-1.5 py-0.5 rounded text-muted-foreground">
            {pregunta.tipo === 'informativa' ? 'Info' : pregunta.max_puntos > 0 ? `${pregunta.max_puntos} pts` : 'Evaluable'}
          </span>
        </div>
        <p className="text-sm text-foreground leading-snug">{pregunta.prompt_texto}</p>
      </div>

      {/* Botones de respuesta — 2 filas para 5 opciones */}
      <div className="grid grid-cols-2 gap-1.5">
        {OPCIONES.map((op) => {
          const activo = respuesta === op.val
          const isNa = op.val === 'na'
          const isMayor = op.val === 'deficiencia_mayor'
          return (
            <button
              key={op.val}
              type="button"
              onClick={() => onRespuesta(pregunta.id, op.val)}
              className={`h-8 rounded-lg text-xs transition-colors ${isNa ? 'col-span-2' : ''} ${
                activo
                  ? isMayor
                    ? ''
                    : ACTIVO_CLASS[op.val]
                  : 'bg-input-background text-muted-foreground hover:bg-muted'
              }`}
              style={
                activo && isMayor
                  ? { backgroundColor: '#FAEEDA', color: '#854F0B', fontWeight: 600 }
                  : activo
                  ? { fontWeight: 600 }
                  : undefined
              }
            >
              {op.label}
            </button>
          )
        })}
      </div>

      {/* Alerta interna de falla automática */}
      {falla === 'alerta' && (
        <div
          className="flex items-start gap-2 mt-2 text-xs rounded-lg px-3 py-2"
          style={{ backgroundColor: 'var(--agro-warning-fill)', color: 'var(--agro-warning-text)' }}
        >
          <AlertTriangle className="w-3 h-3 shrink-0 mt-0.5" />
          Alerta interna de preparación — revisa la conformidad de esta pregunta.
        </div>
      )}

      {/* Campos de comentario estructurado (solo si hay esquema) */}
      {respuesta && esquemas.length > 0 && (
        <div className="mt-2 space-y-2">
          {esquemas.map((esq) => {
            const valor = instanciaValores.get(esq.id) ?? ''
            if (esq.tipo === 'seleccion' && esq.opciones?.length) {
              return (
                <div key={esq.id}>
                  <label className="block text-[10px] text-muted-foreground mb-1">
                    {esq.etiqueta}{esq.requerido ? ' *' : ''}
                  </label>
                  <select
                    value={valor}
                    onChange={(e) => onValor(pregunta.id, esq.id, e.target.value)}
                    className="w-full h-8 px-2 text-xs rounded-lg bg-input-background border border-border text-foreground focus:outline-none focus:border-primary"
                  >
                    <option value="">— Seleccionar —</option>
                    {esq.opciones.map((o) => <option key={o} value={o}>{o}</option>)}
                  </select>
                </div>
              )
            }
            return (
              <div key={esq.id}>
                <label className="block text-[10px] text-muted-foreground mb-1">
                  {esq.etiqueta}{esq.requerido ? ' *' : ''}
                </label>
                <input
                  type={esq.tipo === 'numero' ? 'number' : esq.tipo === 'fecha' ? 'date' : 'text'}
                  placeholder={esq.etiqueta}
                  value={valor}
                  onChange={(e) => onValor(pregunta.id, esq.id, e.target.value)}
                  className="w-full h-8 px-2.5 text-xs rounded-lg bg-input-background border border-border text-foreground placeholder:text-muted-foreground focus:outline-none focus:border-primary focus:ring-1 focus:ring-primary"
                />
              </div>
            )
          })}
        </div>
      )}
    </div>
  )
}
