import { useState, useEffect, useRef } from 'react'
import { useParams, useNavigate, useLocation, Navigate } from 'react-router'
import {
  ChevronLeft, AlertTriangle, CheckCircle, Loader,
  XCircle, AlertCircle, ChevronDown, ChevronUp, Download, Clock,
} from 'lucide-react'
import { toast } from 'sonner'
import { useAuthContext } from '@/context/AuthContext'
import { useAuditorAuditoria } from '@/hooks/useAuditorAuditoria'
import type { AudComentarioEsquema, AudPregunta, AudRespuesta } from '@/types/database.types'
import { generarAuditorReportePDF } from '@/lib/pdf/auditor/generarAuditorReportePDF'

const RESP_OPTIONS: {
  value: AudRespuesta
  label: string
  activeStyle: { bg: string; color: string }
}[] = [
  { value: 'cumplimiento_total', label: 'CT',  activeStyle: { bg: 'var(--agro-success-fill)', color: 'var(--agro-success-text)' } },
  { value: 'deficiencia_menor',  label: 'D−',  activeStyle: { bg: 'var(--agro-warning-fill)', color: 'var(--agro-warning-text)' } },
  { value: 'deficiencia_mayor',  label: 'D+',  activeStyle: { bg: 'var(--agro-warning-fill)', color: 'var(--agro-warning-text)' } },
  { value: 'no_conformidad',     label: 'NC',  activeStyle: { bg: 'var(--agro-danger-fill)',  color: 'var(--agro-danger-text)'  } },
  { value: 'na',                 label: 'N/A', activeStyle: { bg: 'var(--muted)',              color: 'var(--muted-foreground)'  } },
]

const RESP_TOOLTIPS: Record<AudRespuesta, string> = {
  cumplimiento_total: 'Cumplimiento total',
  deficiencia_menor:  'Deficiencia menor',
  deficiencia_mayor:  'Deficiencia mayor',
  no_conformidad:     'No conformidad',
  na:                 'No aplica',
}

type SaveStatus = 'idle' | 'saving' | 'saved' | 'error'

const ESTADO_LABELS: Record<string, string> = {
  en_proceso:  'En proceso',
  preliminar:  'Preliminar',
  completada:  'Completada',
  cerrada:     'Cerrada',
}
const ESTADO_STYLE: Record<string, { bg: string; color: string }> = {
  en_proceso:  { bg: 'var(--agro-warning-fill)', color: 'var(--agro-warning-text)' },
  preliminar:  { bg: 'var(--agro-success-fill)', color: 'var(--agro-success-text)' },
  completada:  { bg: 'var(--agro-success-fill)', color: 'var(--agro-success-text)' },
  cerrada:     { bg: 'var(--muted)',              color: 'var(--muted-foreground)'  },
}

function formatFecha(f: string) {
  const [y, m, d] = f.split('-')
  return `${d}/${m}/${y}`
}

// ── Campo de esquema ─────────────────────────────────────────────────────────

function CampoEsquema({
  esquema, value, onChange, onBlur, disabled,
}: {
  esquema: AudComentarioEsquema
  value: string
  onChange: (v: string) => void
  onBlur: () => void
  disabled: boolean
}) {
  const base: React.CSSProperties = {
    width: '100%',
    borderRadius: 'var(--radius)',
    border: '1px solid var(--border)',
    backgroundColor: disabled ? 'var(--muted)' : 'var(--input-background)',
    color: 'var(--foreground)',
    padding: '0.375rem 0.625rem',
    fontSize: '0.8125rem',
    outline: 'none',
  }
  return (
    <div className="flex flex-col gap-1">
      <label className="text-[11px] font-medium" style={{ color: 'var(--muted-foreground)' }}>
        {esquema.etiqueta}
        {esquema.requerido && <span style={{ color: 'var(--agro-red)' }}> *</span>}
      </label>
      {esquema.tipo === 'seleccion' && esquema.opciones ? (
        <select value={value} onChange={e => onChange(e.target.value)} onBlur={onBlur} disabled={disabled}
          style={{ ...base, height: '2.25rem' }}>
          <option value="">Seleccionar…</option>
          {esquema.opciones.map(op => <option key={op} value={op}>{op}</option>)}
        </select>
      ) : (
        <input
          type={esquema.tipo === 'fecha' ? 'date' : esquema.tipo === 'numero' ? 'number' : 'text'}
          value={value}
          onChange={e => onChange(e.target.value)}
          onBlur={onBlur}
          disabled={disabled}
          placeholder={esquema.info_minima ?? undefined}
          style={{ ...base, height: '2.25rem' }}
        />
      )}
    </div>
  )
}

// ── Tarjeta de pregunta ──────────────────────────────────────────────────────

function PreguntaCard({
  pregunta, esquemas, respuesta, valores, observacion,
  saveStatus, saveMessage, onRespuesta, onValor, onObservacion, onBlur, onRetry, cerrada,
}: {
  pregunta: AudPregunta
  esquemas: AudComentarioEsquema[]
  respuesta: AudRespuesta | undefined
  valores: Map<string, string>
  observacion: string
  saveStatus: SaveStatus
  saveMessage?: string
  onRespuesta: (r: AudRespuesta) => void
  onValor: (esquemaId: string, v: string) => void
  onObservacion: (v: string) => void
  onBlur: () => void
  onRetry: () => void
  cerrada: boolean
}) {
  const falla =
    respuesta &&
    respuesta !== 'na' &&
    ((pregunta.trigger_falla_automatica === 'cualquier_descuento' && respuesta !== 'cumplimiento_total') ||
      (pregunta.trigger_falla_automatica === 'solo_cero' && respuesta === 'no_conformidad'))

  return (
    <div
      className="rounded-xl border border-border bg-card px-4 py-4 flex flex-col gap-3"
      style={falla ? { borderColor: 'var(--agro-red)', borderWidth: '1.5px' } : undefined}
    >
      <div className="flex items-start gap-2">
        <span
          className="text-[10px] font-mono flex-shrink-0 mt-0.5 px-1.5 py-0.5 rounded"
          style={{ backgroundColor: 'var(--muted)', color: 'var(--muted-foreground)' }}
        >
          {pregunta.question_id}
        </span>
        {pregunta.tipo === 'informativa' && (
          <span
            className="text-[10px] font-semibold flex-shrink-0 mt-0.5 px-1.5 py-0.5 rounded"
            style={{ backgroundColor: 'var(--agro-success-fill)', color: 'var(--agro-success-text)' }}
          >
            Informativa
          </span>
        )}
        {pregunta.trigger_falla_automatica !== 'ninguno' && (
          <span
            className="text-[10px] font-semibold flex-shrink-0 mt-0.5 px-1.5 py-0.5 rounded"
            style={{ backgroundColor: 'var(--agro-danger-fill)', color: 'var(--agro-danger-text)' }}
          >
            Falla automática
          </span>
        )}
        <p className="text-sm flex-1" style={{ color: 'var(--foreground)', lineHeight: '1.45' }}>
          {pregunta.texto}
        </p>
      </div>

      <div className="flex gap-1.5">
        {RESP_OPTIONS.map(opt => {
          const active = respuesta === opt.value
          return (
            <button
              key={opt.value}
              onClick={() => !cerrada && onRespuesta(opt.value)}
              disabled={cerrada}
              title={RESP_TOOLTIPS[opt.value]}
              className="flex-1 min-w-0 h-8 rounded-lg text-xs font-bold border transition-all disabled:opacity-50"
              style={
                active
                  ? { backgroundColor: opt.activeStyle.bg, color: opt.activeStyle.color, borderColor: 'transparent' }
                  : { backgroundColor: 'var(--input-background)', color: 'var(--muted-foreground)', borderColor: 'var(--border)' }
              }
            >
              {opt.label}
            </button>
          )
        })}
      </div>

      {falla && (
        <div className="flex items-start gap-2 rounded-lg px-3 py-2" style={{ backgroundColor: 'var(--agro-warning-fill)' }}>
          <AlertTriangle size={14} className="flex-shrink-0 mt-0.5" style={{ color: 'var(--agro-warning-text)' }} />
          <p className="text-[11px] font-medium" style={{ color: 'var(--agro-warning-text)' }}>
            Control de falla automática — revisar con el auditor certificado.
          </p>
        </div>
      )}

      {esquemas.length > 0 && (
        <div className="flex flex-col gap-2.5">
          {esquemas.map(esq => (
            <CampoEsquema
              key={esq.id}
              esquema={esq}
              value={valores.get(esq.id) ?? ''}
              onChange={v => onValor(esq.id, v)}
              onBlur={onBlur}
              disabled={cerrada}
            />
          ))}
        </div>
      )}

      {respuesta === 'no_conformidad' && !observacion && (
        <div className="flex items-start gap-2 rounded-lg px-3 py-2" style={{ backgroundColor: 'var(--agro-warning-fill)' }}>
          <AlertTriangle size={14} className="flex-shrink-0 mt-0.5" style={{ color: 'var(--agro-warning-text)' }} />
          <p className="text-[11px] font-medium" style={{ color: 'var(--agro-warning-text)' }}>
            Una no conformidad requiere observación del auditor.
          </p>
        </div>
      )}

      <div className="flex flex-col gap-1">
        <label className="text-[11px] font-medium" style={{ color: 'var(--muted-foreground)' }}>
          Observación del auditor
        </label>
        <textarea
          value={observacion}
          onChange={e => onObservacion(e.target.value)}
          onBlur={onBlur}
          disabled={cerrada}
          rows={2}
          placeholder="Notas libres sobre esta pregunta…"
          className="resize-none text-[0.8125rem] outline-none"
          style={{
            borderRadius: 'var(--radius)',
            border: '1px solid var(--border)',
            backgroundColor: cerrada ? 'var(--muted)' : 'var(--input-background)',
            color: 'var(--foreground)',
            padding: '0.375rem 0.625rem',
          }}
        />
      </div>

      <div className="flex items-center justify-end gap-2 min-h-4">
        {saveStatus === 'saving' && (
          <span className="flex items-center gap-1 text-[10px]" style={{ color: 'var(--muted-foreground)' }}>
            <Loader size={11} className="animate-spin" /> Guardando…
          </span>
        )}
        {saveStatus === 'saved' && (
          <span className="flex items-center gap-1 text-[10px]" style={{ color: 'var(--agro-success-text)' }}>
            <CheckCircle size={11} /> Guardado
          </span>
        )}
        {saveStatus === 'error' && (
          <div className="flex items-center gap-2 w-full">
            <span className="flex items-center gap-1 text-[10px] flex-1 min-w-0" style={{ color: 'var(--agro-danger-text)' }}>
              <XCircle size={11} className="flex-shrink-0" />
              <span className="line-clamp-2">{saveMessage ?? 'Error al guardar'}</span>
            </span>
            <button
              onClick={onRetry}
              className="text-[10px] font-semibold px-2 py-0.5 rounded flex-shrink-0"
              style={{ backgroundColor: 'var(--agro-danger-fill)', color: 'var(--agro-danger-text)', border: '1px solid var(--agro-red)' }}
            >
              Reintentar
            </button>
          </div>
        )}
      </div>
    </div>
  )
}

// ── Panel de puntaje preliminar ───────────────────────────────────────────────

function PanelPreliminar({
  totalPreguntas, respondidas, aplicables, completos, hasCritico,
}: {
  totalPreguntas: number
  respondidas: number
  aplicables: number
  completos: number
  hasCritico: boolean
}) {
  const [abierto, setAbierto] = useState(false)
  const pct = aplicables > 0 ? Math.round((completos / aplicables) * 100) : null

  return (
    <div
      className="rounded-xl border border-border overflow-hidden"
      style={{ backgroundColor: hasCritico ? 'var(--agro-danger-fill)' : 'var(--card)' }}
    >
      <button
        onClick={() => setAbierto(v => !v)}
        className="w-full flex items-center justify-between px-4 py-3 text-left"
      >
        <div className="flex items-center gap-2 min-w-0">
          <AlertCircle
            size={15}
            className="flex-shrink-0"
            style={{ color: hasCritico ? 'var(--agro-danger-text)' : 'var(--muted-foreground)' }}
          />
          <span
            className="text-xs font-semibold"
            style={{ color: hasCritico ? 'var(--agro-danger-text)' : 'var(--foreground)' }}
          >
            {hasCritico
              ? 'SUSPENDIDA (preliminar)'
              : pct !== null
                ? `Puntaje preliminar: ${pct}%`
                : 'Sin respuestas aún'}
          </span>
        </div>
        {abierto ? (
          <ChevronUp size={14} style={{ color: 'var(--muted-foreground)' }} />
        ) : (
          <ChevronDown size={14} style={{ color: 'var(--muted-foreground)' }} />
        )}
      </button>

      {abierto && (
        <div className="px-4 pb-4 flex flex-col gap-1.5 border-t border-border">
          <p className="text-[11px] pt-3" style={{ color: 'var(--muted-foreground)' }}>
            Puntaje preliminar — el cálculo oficial se hará en el servidor.
          </p>
          <div className="grid grid-cols-2 gap-2 mt-1">
            {[
              ['Total preguntas', totalPreguntas],
              ['Respondidas', respondidas],
              ['Aplicables (no N/A)', aplicables],
              ['Completas (CT)', completos],
            ].map(([label, val]) => (
              <div key={label as string} className="rounded-lg px-3 py-2" style={{ backgroundColor: 'var(--muted)' }}>
                <p className="text-[10px] font-medium" style={{ color: 'var(--muted-foreground)' }}>{label}</p>
                <p className="text-base font-bold" style={{ color: 'var(--foreground)' }}>{val}</p>
              </div>
            ))}
          </div>
          {hasCritico && (
            <p className="text-[11px] font-medium mt-1" style={{ color: 'var(--agro-danger-text)' }}>
              Al menos una respuesta marcada como No Conformidad (NC) suspende la certificación de forma preliminar.
            </p>
          )}
        </div>
      )}
    </div>
  )
}

// ── Pantalla principal ────────────────────────────────────────────────────────

export function AuditorEjecucion() {
  const { auditoriaId } = useParams<{ auditoriaId: string }>()
  const navigate = useNavigate()
  const location = useLocation()
  const { profile } = useAuthContext()

  const orgNombre: string       = (location.state as { orgNombre?: string }       | null)?.orgNombre       ?? ''
  const orgId: string | undefined  = (location.state as { orgId?: string }              | null)?.orgId
  const instalacionId: string | undefined  = (location.state as { instalacionId?: string }  | null)?.instalacionId
  const instalacionNombreNav: string = (location.state as { instalacionNombre?: string } | null)?.instalacionNombre ?? ''

  const hook = useAuditorAuditoria(auditoriaId)
  const {
    auditoria, modulosData, esquemaMap,
    respuestasMap, setRespuestasMap,
    valoresMap, setValoresMap,
    observacionesMap, setObservacionesMap,
    cargando, errorMsg,
    guardarRespuesta, cambiarEstado,
  } = hook

  const [savingMap, setSavingMap] = useState<Record<string, SaveStatus>>({})
  const [saveErrMap, setSaveErrMap] = useState<Record<string, string>>({})
  const [cambiando, setCambiando] = useState(false)
  const [descargando, setDescargando] = useState(false)

  const respuestasRef   = useRef(respuestasMap)
  const valoresRef      = useRef(valoresMap)
  const observacionesRef = useRef(observacionesMap)
  useEffect(() => { respuestasRef.current    = respuestasMap    }, [respuestasMap])
  useEffect(() => { valoresRef.current       = valoresMap       }, [valoresMap])
  useEffect(() => { observacionesRef.current = observacionesMap }, [observacionesMap])

  const debounceTimers = useRef<Record<string, ReturnType<typeof setTimeout>>>({})

  if (profile !== null && profile.rol !== 'auditor' && profile.rol !== 'super_admin') {
    return <Navigate to="/" replace />
  }

  const cerrada = auditoria?.estado === 'cerrada' || auditoria?.estado === 'completada'

  function traducirError(err: unknown): string {
    const e = err as { message?: string; code?: string; details?: string; hint?: string }
    const msg = e?.message ?? String(err)
    if (e?.code === '42501' || msg.toLowerCase().includes('row-level security') || msg.toLowerCase().includes('policy')) {
      return 'No tienes permiso para guardar en esta empresa (revisa que la auditoría pertenezca a una empresa asignada).'
    }
    if (msg.toLowerCase().includes('fetch') || msg.toLowerCase().includes('network') || msg.toLowerCase().includes('timeout') || msg.toLowerCase().includes('offline')) {
      return 'Sin conexión; no se guardó. Reintenta.'
    }
    console.error('[traducirError]', err)
    return 'No se pudo guardar. Reintenta.'
  }

  function dispatchSave(pregId: string, forceResp?: AudRespuesta) {
    const resp = forceResp ?? respuestasRef.current.get(pregId)
    if (!resp || !auditoriaId) return
    const allPregs = modulosData.flatMap(m => m.preguntas)
    const preg = allPregs.find(p => p.id === pregId)
    const vals  = valoresRef.current.get(pregId) ?? new Map<string, string>()
    const obs   = observacionesRef.current.get(pregId)

    setSavingMap(prev => ({ ...prev, [pregId]: 'saving' }))
    setSaveErrMap(prev => { const n = { ...prev }; delete n[pregId]; return n })
    guardarRespuesta({
      preguntaId: pregId,
      respuesta: resp,
      trigger: preg?.trigger_falla_automatica ?? 'ninguno',
      valoresMap: vals,
      observacion: obs,
    })
      .then(() => {
        setSavingMap(prev => ({ ...prev, [pregId]: 'saved' }))
        setSaveErrMap(prev => { const n = { ...prev }; delete n[pregId]; return n })
        setTimeout(() => setSavingMap(prev => ({ ...prev, [pregId]: 'idle' })), 2500)
      })
      .catch((err: unknown) => {
        console.error('[AuditorEjecucion] guardarRespuesta:', err)
        setSavingMap(prev => ({ ...prev, [pregId]: 'error' }))
        setSaveErrMap(prev => ({ ...prev, [pregId]: traducirError(err) }))
      })
  }

  function handleRespuesta(pregId: string, resp: AudRespuesta) {
    setRespuestasMap(prev => new Map(prev).set(pregId, resp))
    clearTimeout(debounceTimers.current[pregId])
    debounceTimers.current[pregId] = setTimeout(() => dispatchSave(pregId, resp), 50)
  }

  function handleValor(pregId: string, esquemaId: string, v: string) {
    setValoresMap(prev => {
      const next = new Map(prev)
      const campos = new Map(next.get(pregId) ?? [])
      campos.set(esquemaId, v)
      next.set(pregId, campos)
      return next
    })
  }

  function handleObservacion(pregId: string, v: string) {
    setObservacionesMap(prev => new Map(prev).set(pregId, v))
  }

  function handleBlur(pregId: string) {
    clearTimeout(debounceTimers.current[pregId])
    debounceTimers.current[pregId] = setTimeout(() => dispatchSave(pregId), 400)
  }

  async function handleCambiarEstado(nuevoEstado: 'preliminar' | 'cerrada') {
    const label = nuevoEstado === 'cerrada' ? 'cerrar' : 'marcar como preliminar'
    const msg = nuevoEstado === 'cerrada'
      ? '¿Cerrar esta auditoría?\n\nNo podrás editar las respuestas después.\n\nImportante: los datos se eliminan automáticamente 15 días después del cierre. Descarga el reporte PDF antes de esa fecha.'
      : '¿Marcar esta auditoría como preliminar?'
    if (!window.confirm(msg)) return
    setCambiando(true)
    try {
      await cambiarEstado(nuevoEstado)
      toast.success(`Auditoría ${label === 'cerrar' ? 'cerrada' : 'marcada como preliminar'}`)
    } catch (e: unknown) {
      console.error('[handleCambiarEstado]', e)
      toast.error(`No se pudo ${label}. Reintenta.`)
    } finally {
      setCambiando(false)
    }
  }

  // Scoring preliminar
  const allPreguntas = modulosData.flatMap(m => m.preguntas)
  const respondidas  = allPreguntas.filter(p => respuestasMap.has(p.id))
  const aplicables   = respondidas.filter(p => respuestasMap.get(p.id) !== 'na')
  const completos    = aplicables.filter(p => respuestasMap.get(p.id) === 'cumplimiento_total')
  const hasCritico   = [...respuestasMap.values()].some(r => r === 'no_conformidad')

  const estadoStyle = ESTADO_STYLE[auditoria?.estado ?? ''] ?? ESTADO_STYLE.cerrada

  const backTarget = instalacionId
    ? `/auditor/instalacion/${instalacionId}`
    : orgId
      ? `/auditor/org/${orgId}`
      : '/auditor'
  const backState = instalacionId
    ? { instalacionNombre: instalacionNombreNav }
    : { orgNombre }

  // Fecha de expiración (15 días desde el cierre, la BD la fija en expires_at)
  const expiresAt = auditoria?.expires_at ?? null
  function formatExpira(iso: string): string {
    const d = new Date(iso)
    return d.toLocaleDateString('es-MX', { day: '2-digit', month: 'long', year: 'numeric' })
  }

  async function handleDescargarPDF() {
    if (!auditoria) return
    setDescargando(true)
    try {
      await generarAuditorReportePDF({
        auditoria,
        modulosData,
        esquemaMap,
        respuestasMap,
        valoresMap,
        observacionesMap,
      })
    } catch (e: unknown) {
      console.error('[AuditorEjecucion] generarAuditorReportePDF:', e)
      toast.error('No se pudo generar el PDF. Reintenta.')
    } finally {
      setDescargando(false)
    }
  }

  return (
    <div className="flex flex-col min-h-screen bg-background pb-8">
      <header className="sticky top-0 z-10 bg-card border-b border-border flex items-center gap-3 px-4 py-3">
        <button
          onClick={() => navigate(backTarget, { state: backState })}
          className="text-muted-foreground flex-shrink-0"
        >
          <ChevronLeft size={24} />
        </button>
        <div className="flex-1 min-w-0">
          <p className="text-sm font-semibold truncate" style={{ color: 'var(--foreground)' }}>
            {auditoria ? (auditoria.modulos.map(m => m.nombre).join(' · ') || 'Auditoría') : 'Cargando…'}
          </p>
          {auditoria && (
            <p className="text-xs" style={{ color: 'var(--muted-foreground)' }}>
              {auditoria.instalacion_id
                ? `${auditoria.instalacion_nombre ?? 'Instalación'} · ${formatFecha(auditoria.fecha)}`
                : `${auditoria.productor_nombre} · ${auditoria.rancho_nombre} · ${formatFecha(auditoria.fecha)}`
              }
            </p>
          )}
        </div>
        {auditoria && (
          <span
            className="text-[10px] font-semibold px-2 py-0.5 rounded-full flex-shrink-0"
            style={{ backgroundColor: estadoStyle.bg, color: estadoStyle.color }}
          >
            {ESTADO_LABELS[auditoria.estado] ?? auditoria.estado}
          </span>
        )}
      </header>

      <main className="flex-1 px-4 py-4 flex flex-col gap-4">
        {cargando ? (
          <p className="text-sm text-center py-16" style={{ color: 'var(--muted-foreground)' }}>
            Cargando catálogo…
          </p>
        ) : errorMsg ? (
          <p className="text-sm text-center py-16" style={{ color: 'var(--agro-danger-text)' }}>
            {errorMsg}
          </p>
        ) : (
          <>
            {/* Aviso: auditoría se borra en 15 días */}
            {cerrada && expiresAt && (
              <div
                className="rounded-xl px-4 py-3 flex items-start gap-3"
                style={{ backgroundColor: 'var(--agro-warning-fill)', borderLeft: '3px solid var(--agro-amber)' }}
              >
                <Clock size={16} className="flex-shrink-0 mt-0.5" style={{ color: 'var(--agro-warning-text)' }} />
                <div className="flex-1 min-w-0">
                  <p className="text-xs font-semibold" style={{ color: 'var(--agro-warning-text)' }}>
                    Esta auditoría se elimina el {formatExpira(expiresAt)}.
                  </p>
                  <p className="text-[11px] mt-0.5" style={{ color: 'var(--agro-warning-text)' }}>
                    Descarga el reporte PDF antes de esa fecha — no podrás recuperar los datos después.
                  </p>
                </div>
              </div>
            )}

            {/* Botón descargar reporte PDF — visible en preliminar y cerrada */}
            {(auditoria?.estado === 'preliminar' || cerrada) && allPreguntas.length > 0 && (
              <button
                onClick={handleDescargarPDF}
                disabled={descargando}
                className="w-full h-11 rounded-xl text-sm font-semibold flex items-center justify-center gap-2 disabled:opacity-50"
                style={{ backgroundColor: 'var(--primary)', color: '#fff' }}
              >
                {descargando
                  ? <><Loader size={15} className="animate-spin" /> Generando PDF…</>
                  : <><Download size={15} /> Descargar reporte PDF</>
                }
              </button>
            )}

            {/* Puntaje preliminar */}
            {!cerrada && respondidas.length > 0 && (
              <PanelPreliminar
                totalPreguntas={allPreguntas.length}
                respondidas={respondidas.length}
                aplicables={aplicables.length}
                completos={completos.length}
                hasCritico={hasCritico}
              />
            )}

            {/* Módulos → Bloques → Preguntas */}
            {modulosData.map(modulo => (
              <div key={modulo.modulo_id}>
                {/* Banner de módulo */}
                <div
                  className="rounded-t-xl px-4 py-2.5 flex items-center gap-2 mb-0"
                  style={{ backgroundColor: 'var(--primary)' }}
                >
                  <p className="text-xs font-bold flex-1" style={{ color: '#fff' }}>
                    {modulo.modulo_nombre}
                  </p>
                  <span className="text-[10px]" style={{ color: 'rgba(255,255,255,0.7)' }}>
                    {modulo.preguntas.length} preguntas
                  </span>
                </div>

                {modulo.bloques.map(bloque => {
                  const pregBloque = modulo.preguntas.filter(p => p.bloque_id === bloque.id)
                  if (pregBloque.length === 0) return null
                  return (
                    <section key={bloque.id} className="mb-3">
                      <div
                        className="px-4 py-2.5 flex items-center gap-2 mb-2"
                        style={{ backgroundColor: 'var(--muted)' }}
                      >
                        <span
                          className="text-[10px] font-mono px-1.5 py-0.5 rounded"
                          style={{ backgroundColor: 'var(--border)', color: 'var(--muted-foreground)' }}
                        >
                          {bloque.codigo}
                        </span>
                        <p className="text-xs font-semibold flex-1" style={{ color: 'var(--foreground)' }}>
                          {bloque.nombre}
                        </p>
                        <span className="text-[10px]" style={{ color: 'var(--muted-foreground)' }}>
                          {pregBloque.length} preg.
                        </span>
                      </div>
                      <div className="flex flex-col gap-2">
                        {pregBloque.map(preg => (
                          <PreguntaCard
                            key={preg.id}
                            pregunta={preg}
                            esquemas={esquemaMap.get(preg.id) ?? []}
                            respuesta={respuestasMap.get(preg.id)}
                            valores={valoresMap.get(preg.id) ?? new Map()}
                            observacion={observacionesMap.get(preg.id) ?? ''}
                            saveStatus={savingMap[preg.id] ?? 'idle'}
                            saveMessage={saveErrMap[preg.id]}
                            onRespuesta={r => handleRespuesta(preg.id, r)}
                            onValor={(eid, v) => handleValor(preg.id, eid, v)}
                            onObservacion={v => handleObservacion(preg.id, v)}
                            onBlur={() => handleBlur(preg.id)}
                            onRetry={() => dispatchSave(preg.id)}
                            cerrada={!!cerrada}
                          />
                        ))}
                      </div>
                    </section>
                  )
                })}
              </div>
            ))}

            {/* Acciones de estado */}
            {!cerrada && !cargando && allPreguntas.length > 0 && (
              <div className="flex flex-col gap-2.5 mt-2">
                {auditoria?.estado !== 'preliminar' && (
                  <button
                    onClick={() => handleCambiarEstado('preliminar')}
                    disabled={cambiando}
                    className="w-full h-11 rounded-xl text-sm font-semibold disabled:opacity-50"
                    style={{ backgroundColor: 'var(--card)', color: 'var(--primary)', border: '1.5px solid var(--primary)' }}
                  >
                    {cambiando ? 'Guardando…' : 'Marcar preliminar'}
                  </button>
                )}
                <button
                  onClick={() => handleCambiarEstado('cerrada')}
                  disabled={cambiando}
                  className="w-full h-11 rounded-xl text-sm font-semibold disabled:opacity-50"
                  style={{ backgroundColor: 'var(--primary)', color: '#fff' }}
                >
                  {cambiando ? 'Cerrando…' : 'Cerrar auditoría'}
                </button>
              </div>
            )}

            {cerrada && (
              <div className="rounded-xl px-4 py-3 text-center mt-2" style={{ backgroundColor: 'var(--muted)' }}>
                <p className="text-xs font-semibold" style={{ color: 'var(--muted-foreground)' }}>
                  Auditoría cerrada — solo lectura
                </p>
              </div>
            )}
          </>
        )}
      </main>
    </div>
  )
}
