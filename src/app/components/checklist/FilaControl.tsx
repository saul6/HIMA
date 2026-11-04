// Renglón de la Tabla 2 / Tabla 3 en dos columnas: C1 (datos para revisar, solo lectura) y C2 (observaciones de la asesora).
// Solo Aprobado / Pendiente / Incidencia, con observación obligatoria. Escritorio: lado a lado; celular: C1 arriba y C2 abajo.
import { useEffect, useState } from 'react'
import { ChevronDown, Pencil } from 'lucide-react'
import { Boton } from '@/app/components/ui-mady/Boton'
import { Input } from '@/app/components/ui/input'
import { chk, codigoError, useAccion, type DocVisita, type IncidenciaDoc, type Omision } from '@/hooks/useChecklistV2'
import { Chip, CLASE_INPUT, TONOS } from './comun'
import { IncidenciasDoc, Relacionados } from './DetalleDoc'
import { textoAntecedente } from './estadoDoc'
import { fechaCorta, horaCorta } from './constantes'
import type { TipoSeguimiento } from './VisitaSheets'

type Estado = 'correcto' | 'pendiente' | 'incidencia'

const OPCIONES: { valor: Estado; etiqueta: string }[] = [
  { valor: 'correcto', etiqueta: 'Aprobado' },
  { valor: 'pendiente', etiqueta: 'Pendiente' },
  { valor: 'incidencia', etiqueta: 'Incidencia' },
]
const TONO_ESTADO = { correcto: TONOS.exito, pendiente: TONOS.info, incidencia: TONOS.peligro, no_aplica: TONOS.neutro }
const TEXTO_ESTADO = { correcto: 'Aprobado', pendiente: 'Pendiente', incidencia: 'Incidencia', no_aplica: 'No aplica' }

/** Observación de ESTA visita (nunca la histórica). En una incidencia es su descripción. */
function observacionDeVisita(d: DocVisita): string {
  const v = d.verificacion
  if (!v) return ''
  if (v.resultado === 'incidencia') return d.incidencias.find(i => i.nueva)?.descripcion ?? v.observacion ?? ''
  return v.observacion ?? ''
}

interface Props {
  doc: DocVisita
  visitaId: string
  puede: boolean
  /** Lo que el servidor dijo que falta tras pulsar Siguiente / Ir a la omisión. */
  falta: Omision['falta'] | null
  onGuardado: () => void
  onSeguir: (inc: IncidenciaDoc, tipo: TipoSeguimiento) => void
}

export function FilaControl({ doc: d, visitaId, puede, falta, onGuardado, onSeguir }: Props) {
  const ver = d.verificacion
  const guardado = ver ? observacionDeVisita(d) : null
  const sinObservacion = !!ver && ver.resultado !== 'no_aplica' && !guardado?.trim()
  // Un registro con incidencia no se reabre: volver a registrarla crearía otra incidencia
  const bloqueado = ver?.resultado === 'incidencia'
  const [editando, setEditando] = useState(!ver || sinObservacion)
  const [estado, setEstado] = useState<Estado | null>(ver && ver.resultado !== 'no_aplica' ? ver.resultado : null)
  const [obs, setObs] = useState(guardado ?? '')
  const [resp, setResp] = useState('')
  const [compromiso, setCompromiso] = useState('')
  const [errEstado, setErrEstado] = useState<string | null>(null)
  const [errObs, setErrObs] = useState<string | null>(null)
  const { ocupado, ejecutar } = useAccion()

  // Tras un aviso del servidor se abre en modo edición para capturar lo que falta
  useEffect(() => {
    if (!falta) return
    setEditando(true)
    if (falta === 'estado') setErrEstado('Elige Aprobado, Pendiente o Incidencia')
    else setErrObs('Escribe la observación')
  }, [falta])

  function abrirEdicion() {
    setEstado(ver && ver.resultado !== 'no_aplica' ? ver.resultado : null)
    setObs(observacionDeVisita(d))
    setErrEstado(null); setErrObs(null)
    setEditando(true)
  }

  async function guardar() {
    const texto = obs.trim()
    let ok = true
    if (!estado) { setErrEstado('Elige Aprobado, Pendiente o Incidencia'); ok = false } else setErrEstado(null)
    if (!texto) { setErrObs('La observación es obligatoria'); ok = false } else setErrObs(null)
    if (!ok || !estado) return
    const r = await ejecutar(eventId => {
      if (estado === 'correcto') return chk.docConfirmar({ visita: visitaId, documento: d.id, observacion: texto, eventId })
      if (estado === 'pendiente') return chk.docMarcar({ visita: visitaId, documento: d.id, resultado: 'pendiente', observacion: texto, eventId })
      return chk.incidenciaRegistrar({
        visita: visitaId, documento: d.id, descripcion: texto, responsable: resp.trim() || null, fechaCompromiso: compromiso || null, eventId,
      })
    })
    if (!r.ok) {
      const c = codigoError(r.error)
      if (c === 'OBSERVACION_REQUERIDA' || c === 'DESCRIPCION_REQUERIDA') setErrObs(r.mensaje)
      else if (c === 'VALOR_INVALIDO') setErrEstado(r.mensaje)
      else setErrObs(r.mensaje)
      return
    }
    setEditando(false)
    onGuardado()
  }

  const antecedente = textoAntecedente(d.antecedente)
  const hayAntecedentes = !!(d.antecedentes || antecedente || d.relacionados.length > 0)
  const idObs = `obs-${d.id}`

  return (
    <div
      data-doc-id={d.id}
      className="grid grid-cols-1 md:grid-cols-2 gap-3 rounded-xl border bg-card p-3"
      style={falta ? { borderColor: 'var(--agro-danger-text)' } : undefined}
    >
      {/* C1 — datos para revisar */}
      <div className="min-w-0 space-y-2">
        <div>
          <p className="text-sm font-semibold">{d.nombre}</p>
          {(d.categoria || d.area) && <p className="text-xs text-muted-foreground">{d.categoria?.trim() || d.area}</p>}
          {d.atribucion === 'compartido_por_confirmar' && (
            <p className="text-xs mt-0.5" style={{ color: 'var(--agro-info-text)' }}>Antecedente compartido — atribución por confirmar</p>
          )}
        </div>
        {hayAntecedentes && (
          <details className="group rounded-lg bg-muted px-2.5 py-1.5 text-xs text-muted-foreground">
            <summary className="cursor-pointer font-semibold flex items-center gap-1 list-none">
              <ChevronDown className="w-3 h-3 transition-transform group-open:rotate-180" aria-hidden="true" /> Antecedentes
            </summary>
            <div className="mt-1.5 space-y-1.5">
              {d.antecedentes && <p className="whitespace-pre-line"><span className="font-semibold">Observación histórica:</span> {d.antecedentes}</p>}
              {antecedente && <p><span className="font-semibold">Última revisión previa:</span> {antecedente}</p>}
              <Relacionados doc={d} />
            </div>
          </details>
        )}
        <IncidenciasDoc incidencias={d.incidencias} puede={puede} onSeguir={onSeguir} soloAnteriores />
      </div>

      {/* C2 — observaciones de la asesora */}
      <div className="min-w-0 space-y-2">
        {editando && puede ? (
          <>
            <div role="radiogroup" aria-label={`Resultado de ${d.nombre}`} className="grid grid-cols-3 gap-1.5">
              {OPCIONES.map(o => {
                const activo = estado === o.valor
                return (
                  <button
                    key={o.valor}
                    type="button"
                    role="radio"
                    aria-checked={activo}
                    data-foco={o.valor === 'correcto' ? '' : undefined}
                    onClick={() => { setEstado(o.valor); setErrEstado(null) }}
                    className="rounded-lg border px-2 py-2 text-sm font-semibold focus-visible:outline focus-visible:outline-2 focus-visible:outline-ring"
                    style={activo
                      ? { backgroundColor: TONO_ESTADO[o.valor].fill, color: TONO_ESTADO[o.valor].text, borderColor: TONO_ESTADO[o.valor].text }
                      : { borderColor: 'var(--border-control)', color: 'var(--foreground)' }}
                  >
                    {o.etiqueta}
                  </button>
                )
              })}
            </div>
            {errEstado && <p role="alert" className="text-xs" style={{ color: 'var(--agro-danger-text)' }}>{errEstado}</p>}

            <label htmlFor={idObs} className="block text-xs text-muted-foreground">Observaciones (obligatorio)</label>
            <textarea
              id={idObs}
              rows={1}
              maxLength={2000}
              value={obs}
              aria-invalid={!!errObs}
              onChange={e => { setObs(e.target.value); if (e.target.value.trim()) setErrObs(null) }}
              onInput={e => { const t = e.currentTarget; t.style.height = 'auto'; t.style.height = `${t.scrollHeight}px` }}
              className="w-full min-h-10 rounded-lg border bg-card px-3 py-2 text-sm text-foreground resize-none"
              style={{ borderColor: errObs ? 'var(--agro-danger-text)' : 'var(--border-control)' }}
            />
            {errObs && <p role="alert" className="text-xs" style={{ color: 'var(--agro-danger-text)' }}>{errObs}</p>}

            {estado === 'incidencia' && (
              <details className="rounded-lg border border-border px-2.5 py-1.5 text-xs">
                <summary className="cursor-pointer font-semibold">Más datos</summary>
                <div className="mt-2 space-y-2">
                  <label className="block space-y-1">
                    <span className="text-muted-foreground">Responsable de corregir (opcional)</span>
                    <Input value={resp} maxLength={200} onChange={e => setResp(e.target.value)} />
                  </label>
                  <label className="block space-y-1">
                    <span className="text-muted-foreground">Fecha compromiso (opcional)</span>
                    <input type="date" className={CLASE_INPUT} value={compromiso} onChange={e => setCompromiso(e.target.value)} />
                  </label>
                </div>
              </details>
            )}

            <div className="flex justify-end gap-2">
              {ver && !sinObservacion && <Boton tamano="sm" variante="secundario" onClick={() => setEditando(false)}>Cancelar</Boton>}
              <Boton tamano="sm" cargando={ocupado} onClick={guardar}>Guardar</Boton>
            </div>
          </>
        ) : ver ? (
          <div className="space-y-1">
            <div className="flex flex-wrap items-center justify-between gap-2">
              <Chip tono={TONO_ESTADO[ver.resultado]}>{TEXTO_ESTADO[ver.resultado]}</Chip>
              {puede && !bloqueado && (
                <button type="button" onClick={abrirEdicion} className="inline-flex items-center gap-1 text-xs font-semibold" style={{ color: 'var(--primary)' }}>
                  <Pencil className="w-3 h-3" aria-hidden="true" /> Editar
                </button>
              )}
            </div>
            <p className="text-sm whitespace-pre-line">{guardado}</p>
            <p className="text-xs text-muted-foreground">por {ver.actor ?? '—'} el {fechaCorta(ver.creado_en)} a las {horaCorta(ver.creado_en)}</p>
            {bloqueado && <p className="text-xs text-muted-foreground">La incidencia ya está registrada; dale seguimiento desde Incidencias.</p>}
          </div>
        ) : (
          <p className="text-xs text-muted-foreground">Sin revisar.</p>
        )}
      </div>
    </div>
  )
}
