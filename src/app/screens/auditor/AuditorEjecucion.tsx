import { useState, useEffect, useRef } from 'react'
import { useParams, useNavigate, useLocation, Navigate } from 'react-router'
import { guardarLastWorkspace } from '@/hooks/useContinuarTrabajo'
import { ahora, ms, segundos, emitirEvento, consumeResumeMetrics } from '@/lib/telemetria'
import { useMisPermisos } from '@/hooks/useMisPermisos'
import {
  ChevronLeft, AlertTriangle, CheckCircle, Loader,
  XCircle, AlertCircle, ChevronDown, ChevronUp, Download, ShieldCheck,
  Flag, Plus, History, ClipboardList, Copy, Paperclip, Link2,
  BarChart2, AlertOctagon, Pencil, X,
} from 'lucide-react'
import { SCORE_MATRIX, RESP_TO_CLASS } from '@/lib/scoring/matriz'
import type { ScoreMatrixKey } from '@/lib/scoring/matriz'
import { toast } from 'sonner'
import { useAuthContext } from '@/context/AuthContext'
import { useAuditorAuditoria } from '@/hooks/useAuditorAuditoria'
import type { AudComentarioEsquema, AudPregunta, AudRespuesta, AudHallazgo, AudHallazgoClasificacion, AudHallazgoEstado, AudAccionCorrectivaCAPA, AudAcVersion, AudInternalStatus, AudExternalStatus, AudExternalWorkflow, AudExternalObservedStatus } from '@/types/database.types'
import { generarAuditorReportePDF } from '@/lib/pdf/auditor/generarAuditorReportePDF'
import { supabase } from '@/lib/supabase'
import { useHallazgos } from '@/hooks/useHallazgos'
import { BottomSheet } from '@/app/components/BottomSheet'
import { EvidenciaPanel } from './EvidenciaPanel'

const CLASS_TO_RESP: Partial<Record<string, AudRespuesta>> = {
  TOTAL: 'cumplimiento_total',
  MINOR: 'deficiencia_menor',
  MAJOR: 'deficiencia_mayor',
  NON_COMPLIANCE: 'no_conformidad',
}

interface AjusteInfo {
  puntos_manual: number | null
  ajuste_motivo: string | null
  ajuste_estado: string | null
  ajuste_en: string | null
}

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
  excede_cumplimiento: 'Excede cumplimiento',
  cumplimiento_total: 'Cumplimiento total',
  deficiencia_menor:  'Deficiencia menor',
  deficiencia_mayor:  'Deficiencia mayor',
  no_conformidad:     'No conformidad',
  na:                 'No aplica',
}

const RESP_OPTIONS_M9: {
  value: AudRespuesta
  label: string
  activeStyle: { bg: string; color: string }
}[] = [
  { value: 'excede_cumplimiento', label: 'Excede',    activeStyle: { bg: 'var(--agro-success-fill)', color: 'var(--agro-success-text)' } },
  { value: 'cumplimiento_total',  label: 'Total',     activeStyle: { bg: 'var(--agro-success-fill)', color: 'var(--agro-success-text)' } },
  { value: 'no_conformidad',      label: 'No cumple', activeStyle: { bg: 'var(--agro-danger-fill)',  color: 'var(--agro-danger-text)'  } },
]

type SaveStatus = 'idle' | 'saving' | 'saved' | 'error'

type EstadoCalculo =
  | 'NO_SCORABLE_CRITERIA'
  | 'BLOCKED_MISSING_MAX'
  | 'IN_PROGRESS'
  | 'INTERNAL_COMPLETE'
  | 'REQUIRES_VALIDATION'

interface PorModuloCalculo {
  modulo: string
  nombre: string
  posibles: number
  ganados: number
  pendientes: number
  perdida: number
  falla_automatica: boolean
  resultado_bruto: number
  resultado_efectivo: number
  proyeccion_si_cumplen: number
}

interface CalculoPuntaje {
  official: false
  estado: EstadoCalculo
  puntos_posibles: number
  puntos_ganados: number
  pendientes: number
  perdida: number
  proyeccion_si_pendientes_cumplen: number
  cota_inferior: number
  avance_respondidas: number
  resultado_bruto: number
  falla_automatica_activa: boolean
  conteo: {
    total: number
    // New keys (BD >= sep-2026):
    resueltas?: number
    scored_con_max?: number
    missing_max?: number
    na_excluidas?: number
    // Legacy compat:
    evaluadas: number
    con_maximo: number
    pendientes_maximo: number
    na: number
  }
  por_modulo: PorModuloCalculo[]
  mensaje: string
  // Ajuste manual (F3):
  ajustes_manuales?: number
  ajustes_en_conflicto?: number
  escenario_trabajo?: { etiqueta: string; puntos_ganados: number; resultado: number }
  fallas?: Array<{ question_id: string; modulo: string; respuesta: string }>
}

interface M9CalcResult {
  estado: 'SIN_M9' | 'TOTAL_COMPLIANCE_REACHED' | 'TOTAL_COMPLIANCE_NOT_REACHED' | 'PENDING_REVIEW'
  delta_score: number
  total: number
  resueltas: number
  no_conformes: number
  por_pregunta: Array<{ question_id: string; clase: string }>
}

interface ReincidenciaResult {
  reincidente: boolean
  mensaje: string
  n_hallazgos_total: number
  ultima_fecha: string | null
}

interface HistorialCriterio {
  criterion_code: string
  n_hallazgos: number
  primer_detectado: string | null
  ultimo_detectado: string | null
  ultimo_hallazgo_id: string | null
  ultimo_estado: string | null
}

interface ReviewIssue {
  id: string
  codigo: string
  severidad: 'BLOCKER' | 'REQUIRED' | 'WARNING' | 'INFO'
  mensaje: string
  pregunta_id: string | null
  instancia_id: string | null
  estado: 'OPEN' | 'RESOLVED' | 'DISMISSED'
  rule_id: string | null
  campo_path: string | null
}

interface IncidenciaBusqueda {
  incidencia_id: string
  reporte_id: string
  rancho_id: string | null
  fecha: string
  descripcion: string
  created_at: string
}

interface IncidenciaVinculada {
  id: string
  incidencia_id: string
  reporte_id: string
  relation_type: 'ANTECEDENTE' | 'EVIDENCIA'
  m13_incidencias: { descripcion: string } | null
  m13_reportes: { fecha: string; rancho_id: string | null } | null
}

type Severidad = 'BLOCKER' | 'REQUIRED' | 'WARNING' | 'INFO'
const SEV_ORDER: Severidad[] = ['BLOCKER', 'REQUIRED', 'WARNING', 'INFO']
const SEV_CONFIG: Record<Severidad, { label: string; bg: string; color: string }> = {
  BLOCKER:  { label: 'Bloqueante', bg: 'var(--agro-danger-fill)',  color: 'var(--agro-danger-text)'  },
  REQUIRED: { label: 'Requerido',  bg: 'var(--agro-warning-fill)', color: 'var(--agro-warning-text)' },
  WARNING:  { label: 'Aviso',      bg: 'var(--agro-warning-fill)', color: 'var(--agro-warning-text)' },
  INFO:     { label: 'Info',       bg: 'var(--agro-success-fill)', color: 'var(--agro-success-text)' },
}

const CLASIFICACION_CONFIG: Record<AudHallazgoClasificacion, { label: string; bg: string; color: string }> = {
  menor:       { label: 'Menor',       bg: 'var(--agro-warning-fill)', color: 'var(--agro-warning-text)' },
  mayor:       { label: 'Mayor',       bg: 'var(--agro-danger-fill)',  color: 'var(--agro-danger-text)'  },
  critico:     { label: 'Crítico',     bg: 'var(--agro-red)',          color: '#fff'                     },
  observacion: { label: 'Observación', bg: 'var(--muted)',             color: 'var(--muted-foreground)'  },
}

const HALL_ESTADO_CONFIG: Record<AudHallazgoEstado, { label: string; bg: string; color: string }> = {
  OPEN:                   { label: 'Abierto',        bg: 'var(--agro-danger-fill)',  color: 'var(--agro-danger-text)'  },
  PLAN_ACCEPTED:          { label: 'Plan aceptado',  bg: 'var(--agro-warning-fill)', color: 'var(--agro-warning-text)' },
  IMPLEMENTED:            { label: 'Implementado',   bg: 'var(--agro-success-fill)', color: 'var(--agro-success-text)' },
  EFFECTIVENESS_PENDING:  { label: 'Eficacia pend.', bg: 'var(--agro-warning-fill)', color: 'var(--agro-warning-text)' },
  CLOSED:                 { label: 'Cerrado',        bg: 'var(--muted)',             color: 'var(--muted-foreground)'  },
  REOPENED:               { label: 'Reabierto',      bg: 'var(--agro-danger-fill)',  color: 'var(--agro-danger-text)'  },
}

const INTERNAL_STATUS_LABELS: Record<AudInternalStatus, string> = {
  REGISTERED:        'Registrado',
  PREPARING:         'Preparando respuesta',
  WAITING_EVIDENCE:  'Esperando evidencia',
  INTERNAL_REVIEW:   'Revisión interna',
  NEEDS_WORK:        'Requiere trabajo',
  READY_FOR_AZZULE:  'Listo para Azzule',
  COMPLETE_INTERNAL: 'Completo internamente',
  ARCHIVED:          'Archivado',
}

const EXTERNAL_STATUS_LABELS: Record<AudExternalStatus, string> = {
  NOT_TRACKED:      'Sin seguimiento externo',
  PENDING_UPLOAD:   'Pendiente de envío',
  SUBMITTED:        'Enviado',
  UNDER_REVIEW:     'En revisión',
  NEEDS_CORRECTION: 'Requiere corrección',
  ACCEPTED:         'Aceptado',
  REVIEWED:         'Revisado',
  CLOSED:           'Cerrado',
}

const OBSERVED_STATUS_LABELS: Record<AudExternalObservedStatus, string> = {
  pendiente:           'Pendiente',
  enviada:             'Enviada',
  revisada:            'Revisada',
  aceptada:            'Aceptada',
  requiere_correccion: 'Requiere corrección',
  cerrada:             'Cerrada',
}

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
  saveStatus, saveMessage, onRespuesta, onValor, onObservacion, onBlur, onRetry, cerrada, canWriteNC,
  hallazgosCount, instanciaDisponible, onRegistrarHallazgo, onVerHallazgos,
  reincidencia,
  ajuste, instanciaId, onAjusteActualizado,
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
  canWriteNC: boolean
  hallazgosCount?: number
  instanciaDisponible?: boolean
  onRegistrarHallazgo?: () => void
  onVerHallazgos?: () => void
  reincidencia?: ReincidenciaResult
  ajuste?: AjusteInfo
  instanciaId?: string
  onAjusteActualizado?: (nuevoAjuste: AjusteInfo | null) => void
}) {
  const falla =
    respuesta &&
    respuesta !== 'na' &&
    ((pregunta.trigger_falla_automatica === 'cualquier_descuento' && respuesta !== 'cumplimiento_total') ||
      (pregunta.trigger_falla_automatica === 'solo_cero' && respuesta === 'no_conformidad'))

  // ── Ajuste manual state ──
  const [ajusteOpen, setAjusteOpen] = useState(false)
  const [puntosInput, setPuntosInput] = useState('')
  const [descuentoInput, setDescuentoInput] = useState('')
  const [motivoInput, setMotivoInput] = useState('')
  const ajusteEventIdRef = useRef<string | null>(null)
  const [enviandoAjuste, setEnviandoAjuste] = useState(false)
  const [ajusteWarning, setAjusteWarning] = useState<{
    tipo: 'OTHER_CATEGORY' | 'OFF_MATRIX'
    mensaje: string
    clasificacion_sugerida?: string
  } | null>(null)
  const [quitandoAjuste, setQuitandoAjuste] = useState(false)

  const VALID_MAX_SET: Set<number> = new Set([15, 10, 5, 3])
  const hasValidMax = VALID_MAX_SET.has(pregunta.max_puntos) && !!respuesta && respuesta in RESP_TO_CLASS
  const matrizMax = hasValidMax ? pregunta.max_puntos as ScoreMatrixKey : null
  const matrizClase = (hasValidMax && respuesta) ? RESP_TO_CLASS[respuesta as keyof typeof RESP_TO_CLASS] : null
  const matrizObtenido = (matrizMax && matrizClase) ? SCORE_MATRIX[matrizMax][matrizClase] : null
  const matrizDescuento = (matrizMax != null && matrizObtenido != null) ? matrizMax - matrizObtenido : null

  const puedeAjustar = !cerrada &&
    !pregunta.es_cualitativa &&
    pregunta.tipo !== 'information_gathering' &&
    hasValidMax &&
    !!instanciaId &&
    !!onAjusteActualizado

  function abrirAjuste() {
    if (matrizMax == null) return
    const initPuntos = ajuste?.puntos_manual != null ? ajuste.puntos_manual : (matrizObtenido ?? 0)
    setPuntosInput(String(initPuntos))
    setDescuentoInput(String(matrizMax - initPuntos))
    setMotivoInput(ajuste?.ajuste_motivo ?? '')
    setAjusteWarning(null)
    ajusteEventIdRef.current = null
    setAjusteOpen(true)
  }

  function handlePuntosChange(val: string) {
    setPuntosInput(val)
    if (matrizMax != null) {
      const n = parseInt(val, 10)
      setDescuentoInput(!isNaN(n) ? String(matrizMax - n) : '')
    }
  }

  function handleDescuentoChange(val: string) {
    setDescuentoInput(val)
    if (matrizMax != null) {
      const n = parseInt(val, 10)
      setPuntosInput(!isNaN(n) ? String(matrizMax - n) : '')
    }
  }

  const puntosNum = parseInt(puntosInput, 10)
  const puntosValido = !isNaN(puntosNum) && puntosNum >= 0 && puntosNum <= (matrizMax ?? 0) && String(puntosNum) === puntosInput.trim()
  const difiere = puntosValido && matrizObtenido != null && puntosNum !== matrizObtenido
  const motivoValido = !difiere || motivoInput.trim().length > 0
  const puedeConfirmar = puntosValido && motivoValido && !enviandoAjuste

  let errorPuntos: string | null = null
  if (puntosInput !== '' && !puntosValido) {
    if (isNaN(puntosNum) || String(puntosNum) !== puntosInput.trim()) errorPuntos = 'Solo se permiten números enteros'
    else if (puntosNum < 0 || puntosNum > (matrizMax ?? 0)) errorPuntos = `El valor debe estar entre 0 y ${matrizMax}`
  }

  async function handleConfirmarAjuste() {
    if (!puedeConfirmar || !instanciaId) return
    if (!ajusteEventIdRef.current) ajusteEventIdRef.current = crypto.randomUUID()
    setEnviandoAjuste(true)
    try {
      const { data, error } = await supabase.rpc('aud_ajustar_puntaje', {
        p_instancia_id: instanciaId,
        p_puntos: puntosNum,
        p_motivo: motivoInput.trim(),
        p_event_id: ajusteEventIdRef.current,
      })
      if (error) {
        toast.error(error.message ?? 'No se pudo guardar el ajuste. Reintenta.')
        return
      }
      const r = data as {
        estado: 'MANUAL_MATCHES_MATRIX' | 'MANUAL_OTHER_CATEGORY' | 'MANUAL_OFF_MATRIX'
        puntos_manual: number
        clasificacion_sugerida: string
        mensaje: string
      }
      ajusteEventIdRef.current = null
      const nuevoAjuste: AjusteInfo = {
        puntos_manual: r.puntos_manual,
        ajuste_motivo: motivoInput.trim() || null,
        ajuste_estado: r.estado,
        ajuste_en: new Date().toISOString(),
      }
      onAjusteActualizado?.(nuevoAjuste)
      setAjusteOpen(false)
      if (r.estado === 'MANUAL_MATCHES_MATRIX') {
        toast.success('Coincide con la matriz PrimusGFS')
      } else if (r.estado === 'MANUAL_OTHER_CATEGORY') {
        setAjusteWarning({ tipo: 'OTHER_CATEGORY', mensaje: r.mensaje, clasificacion_sugerida: r.clasificacion_sugerida })
      } else {
        setAjusteWarning({ tipo: 'OFF_MATRIX', mensaje: 'Valor fuera de la matriz: escenario interno en conflicto, no es puntaje normativo.' })
      }
    } catch (e) {
      console.error('[PreguntaCard] aud_ajustar_puntaje', e)
      toast.error('No se pudo guardar el ajuste. Reintenta.')
    } finally {
      setEnviandoAjuste(false)
    }
  }

  async function handleQuitarAjuste() {
    if (!instanciaId) return
    setQuitandoAjuste(true)
    try {
      const { error } = await supabase.rpc('aud_quitar_ajuste', {
        p_instancia_id: instanciaId,
        p_event_id: crypto.randomUUID(),
      })
      if (error) {
        toast.error(error.message ?? 'No se pudo quitar el ajuste. Reintenta.')
        return
      }
      onAjusteActualizado?.(null)
      setAjusteWarning(null)
      toast.success('Ajuste quitado')
    } catch (e) {
      console.error('[PreguntaCard] aud_quitar_ajuste', e)
      toast.error('No se pudo quitar el ajuste. Reintenta.')
    } finally {
      setQuitandoAjuste(false)
    }
  }

  return (
    <div
      id={`preg-${pregunta.id}`}
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
        {pregunta.tipo === 'information_gathering' && (
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
        {reincidencia?.reincidente && (
          <span
            className="text-[10px] font-semibold flex-shrink-0 mt-0.5 px-1.5 py-0.5 rounded"
            title={reincidencia.mensaje}
            style={{ backgroundColor: 'var(--agro-warning-fill)', color: 'var(--agro-warning-text)' }}
          >
            Reincidente
          </span>
        )}
        <p className="text-sm flex-1" style={{ color: 'var(--foreground)', lineHeight: '1.45' }}>
          {pregunta.texto}
        </p>
      </div>

      <div className="flex gap-1.5">
        {(pregunta.es_cualitativa ? RESP_OPTIONS_M9 : RESP_OPTIONS).map(opt => {
          const active = respuesta === opt.value
          return (
            <button
              key={opt.value}
              onClick={() => !cerrada && onRespuesta(opt.value)}
              disabled={cerrada}
              title={opt.label}
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

      {pregunta.es_cualitativa && (
        <p className="text-[10px]" style={{ color: 'var(--muted-foreground)' }}>
          MIP es un complemento cualitativo; no afecta el puntaje de los demás módulos.
        </p>
      )}

      {/* Sugerencia de scoring + ajuste manual (F2/F3) — solo para preguntas numéricas */}
      {!pregunta.es_cualitativa && respuesta === 'na' && pregunta.permite_na && (
        <div className="rounded-lg px-3 py-2 text-[11px]" style={{ backgroundColor: 'var(--muted)', color: 'var(--muted-foreground)' }}>
          N/A — excluida del denominador de puntaje
        </div>
      )}
      {!pregunta.es_cualitativa && hasValidMax && matrizMax && matrizClase && matrizObtenido != null && (() => {
        const esTotal = matrizClase === 'TOTAL'
        const esNC    = matrizClase === 'NON_COMPLIANCE'
        const bg    = esTotal ? 'var(--agro-success-fill)' : esNC ? 'var(--agro-danger-fill)' : 'var(--agro-warning-fill)'
        const color = esTotal ? 'var(--agro-success-text)' : esNC ? 'var(--agro-danger-text)' : 'var(--agro-warning-text)'
        const desc = matrizDescuento ?? 0
        return (
          <div className="rounded-lg px-3 py-2 flex items-center gap-2" style={{ backgroundColor: bg }}>
            <BarChart2 size={12} className="flex-shrink-0" style={{ color }} />
            <p className="text-[11px] font-medium flex-1" style={{ color }}>
              {matrizMax} posibles → {matrizObtenido} obtenidos
              {desc > 0 && <span className="font-bold"> · −{desc} descuento</span>}
            </p>
          </div>
        )
      })()}
      {!pregunta.es_cualitativa && pregunta.max_puntos === 0 && respuesta && respuesta !== 'na' && (
        <div className="rounded-lg px-3 py-2 text-[11px]" style={{ backgroundColor: 'var(--muted)', color: 'var(--muted-foreground)' }}>
          Máximo pendiente de verificar
        </div>
      )}

      {/* Chip de ajuste manual vigente */}
      {!pregunta.es_cualitativa && ajuste?.puntos_manual != null && matrizMax != null && (
        <div className="rounded-lg px-3 py-2 flex flex-col gap-1.5" style={{
          backgroundColor: ajuste.ajuste_estado === 'MANUAL_MATCHES_MATRIX' ? 'var(--agro-success-fill)'
            : ajuste.ajuste_estado === 'MANUAL_OFF_MATRIX' ? 'var(--agro-warning-fill)'
            : 'var(--agro-warning-fill)',
          border: `1px solid ${ajuste.ajuste_estado === 'MANUAL_MATCHES_MATRIX' ? 'var(--agro-success-text)' : 'var(--agro-amber)'}`,
        }}>
          <div className="flex items-center justify-between gap-2">
            <div className="flex items-center gap-1.5">
              <Pencil size={11} style={{ color: ajuste.ajuste_estado === 'MANUAL_MATCHES_MATRIX' ? 'var(--agro-success-text)' : 'var(--agro-warning-text)', flexShrink: 0 }} />
              <span className="text-[11px] font-semibold" style={{ color: ajuste.ajuste_estado === 'MANUAL_MATCHES_MATRIX' ? 'var(--agro-success-text)' : 'var(--agro-warning-text)' }}>
                Ajuste manual: {ajuste.puntos_manual}/{matrizMax}
              </span>
              <span className="text-[10px] px-1.5 py-0.5 rounded" style={{
                backgroundColor: 'rgba(0,0,0,0.07)',
                color: ajuste.ajuste_estado === 'MANUAL_MATCHES_MATRIX' ? 'var(--agro-success-text)' : 'var(--agro-warning-text)',
              }}>
                {ajuste.ajuste_estado === 'MANUAL_MATCHES_MATRIX' ? 'coincide'
                  : ajuste.ajuste_estado === 'MANUAL_OTHER_CATEGORY' ? 'otra clasificación'
                  : 'fuera de matriz'}
              </span>
            </div>
            {!cerrada && (
              <button
                onClick={handleQuitarAjuste}
                disabled={quitandoAjuste}
                className="flex items-center gap-1 text-[10px] font-medium px-2 py-0.5 rounded disabled:opacity-50"
                style={{ backgroundColor: 'rgba(0,0,0,0.07)', color: 'var(--agro-warning-text)' }}
              >
                {quitandoAjuste ? <Loader size={10} className="animate-spin" /> : <X size={10} />}
                Quitar
              </button>
            )}
          </div>
          {ajuste.ajuste_motivo && (
            <p className="text-[10px]" style={{ color: 'var(--agro-warning-text)' }}>
              Motivo: {ajuste.ajuste_motivo}
            </p>
          )}

          {/* Aviso OTHER_CATEGORY con botón cambiar clasificación */}
          {ajusteWarning?.tipo === 'OTHER_CATEGORY' && ajusteWarning.clasificacion_sugerida && (
            <div className="flex items-start gap-2 pt-0.5">
              <AlertCircle size={12} className="flex-shrink-0 mt-0.5" style={{ color: 'var(--agro-warning-text)' }} />
              <div className="flex flex-col gap-1 flex-1">
                <p className="text-[10px]" style={{ color: 'var(--agro-warning-text)' }}>{ajusteWarning.mensaje}</p>
                {!cerrada && (
                  <button
                    onClick={() => {
                      const resp = CLASS_TO_RESP[ajusteWarning.clasificacion_sugerida!]
                      if (resp) {
                        onRespuesta(resp)
                        onAjusteActualizado?.(null)
                        setAjusteWarning(null)
                      }
                    }}
                    className="self-start text-[10px] font-semibold px-2 py-0.5 rounded"
                    style={{ backgroundColor: 'var(--primary)', color: '#fff' }}
                  >
                    Cambiar clasificación a {ajusteWarning.clasificacion_sugerida === 'MINOR' ? 'Menor'
                      : ajusteWarning.clasificacion_sugerida === 'MAJOR' ? 'Mayor'
                      : ajusteWarning.clasificacion_sugerida === 'TOTAL' ? 'Total'
                      : 'No conformidad'}
                  </button>
                )}
              </div>
            </div>
          )}
          {ajusteWarning?.tipo === 'OFF_MATRIX' && (
            <p className="text-[10px]" style={{ color: 'var(--agro-warning-text)' }}>{ajusteWarning.mensaje}</p>
          )}
        </div>
      )}

      {/* Aviso OTHER_CATEGORY cuando aún no hay chip (ajuste recién mostrado antes de refetch) */}
      {!pregunta.es_cualitativa && ajuste?.puntos_manual == null && ajusteWarning && (
        <div className="rounded-lg px-3 py-2 flex items-start gap-2" style={{ backgroundColor: 'var(--agro-warning-fill)' }}>
          <AlertCircle size={12} className="flex-shrink-0 mt-0.5" style={{ color: 'var(--agro-warning-text)' }} />
          <p className="text-[10px]" style={{ color: 'var(--agro-warning-text)' }}>{ajusteWarning.mensaje}</p>
        </div>
      )}

      {/* Enlace "Ajustar puntuación" */}
      {puedeAjustar && !ajusteOpen && (
        <button
          onClick={abrirAjuste}
          className="self-start flex items-center gap-1 text-[11px] font-medium"
          style={{ color: 'var(--primary)' }}
        >
          <Pencil size={10} />
          Ajustar puntuación
        </button>
      )}

      {/* Panel de ajuste en línea */}
      {ajusteOpen && matrizMax != null && (
        <div className="rounded-xl p-3 flex flex-col gap-2.5" style={{ backgroundColor: 'var(--muted)', border: '1px solid var(--border)' }}>
          <div className="flex items-center justify-between">
            <p className="text-[11px] font-semibold" style={{ color: 'var(--foreground)' }}>Ajuste manual de puntuación</p>
            <button onClick={() => setAjusteOpen(false)} className="text-muted-foreground">
              <X size={14} />
            </button>
          </div>
          <div className="flex gap-3">
            <div className="flex flex-col gap-1 flex-1">
              <label className="text-[10px] font-medium" style={{ color: 'var(--muted-foreground)' }}>Puntos otorgados</label>
              <input
                type="number"
                min={0}
                max={matrizMax}
                step={1}
                value={puntosInput}
                onChange={e => handlePuntosChange(e.target.value)}
                className="h-9 rounded-lg px-2 text-sm outline-none text-center"
                style={{ border: `1px solid ${errorPuntos ? 'var(--agro-red)' : 'var(--border)'}`, backgroundColor: 'var(--input-background)', color: 'var(--foreground)' }}
              />
            </div>
            <div className="flex flex-col gap-1 flex-1">
              <label className="text-[10px] font-medium" style={{ color: 'var(--muted-foreground)' }}>Descuento</label>
              <input
                type="number"
                min={0}
                max={matrizMax}
                step={1}
                value={descuentoInput}
                onChange={e => handleDescuentoChange(e.target.value)}
                className="h-9 rounded-lg px-2 text-sm outline-none text-center"
                style={{ border: `1px solid ${errorPuntos ? 'var(--agro-red)' : 'var(--border)'}`, backgroundColor: 'var(--input-background)', color: 'var(--foreground)' }}
              />
            </div>
          </div>
          {errorPuntos && (
            <p className="text-[10px]" style={{ color: 'var(--agro-danger-text)' }}>{errorPuntos}</p>
          )}
          <div className="flex flex-col gap-1">
            <label className="text-[10px] font-medium" style={{ color: 'var(--muted-foreground)' }}>
              Motivo del ajuste{difiere && <span style={{ color: 'var(--agro-red)' }}> *</span>}
            </label>
            <textarea
              value={motivoInput}
              onChange={e => setMotivoInput(e.target.value)}
              rows={2}
              placeholder={difiere ? 'Requerido cuando el valor difiere de la sugerencia…' : 'Opcional cuando coincide con la matriz…'}
              className="resize-none text-[0.8125rem] outline-none"
              style={{
                borderRadius: 'var(--radius)',
                border: `1px solid ${difiere && !motivoValido ? 'var(--agro-red)' : 'var(--border)'}`,
                backgroundColor: 'var(--input-background)',
                color: 'var(--foreground)',
                padding: '0.375rem 0.625rem',
              }}
            />
            {difiere && !motivoValido && (
              <p className="text-[10px]" style={{ color: 'var(--agro-danger-text)' }}>El motivo es obligatorio cuando el valor difiere de la sugerencia.</p>
            )}
          </div>
          <div className="flex gap-2">
            <button
              onClick={handleConfirmarAjuste}
              disabled={!puedeConfirmar}
              className="flex-1 h-9 rounded-lg text-[11px] font-semibold flex items-center justify-center gap-1.5 disabled:opacity-50"
              style={{ backgroundColor: 'var(--primary)', color: '#fff' }}
            >
              {enviandoAjuste ? <><Loader size={11} className="animate-spin" /> Guardando…</> : 'Confirmar'}
            </button>
            <button
              onClick={() => setAjusteOpen(false)}
              className="flex-1 h-9 rounded-lg text-[11px] font-medium"
              style={{ backgroundColor: 'var(--muted)', color: 'var(--foreground)', border: '1px solid var(--border)' }}
            >
              Cancelar
            </button>
          </div>
        </div>
      )}

      {!pregunta.es_cualitativa && reincidencia?.reincidente && (
        <div className="flex items-start gap-2 rounded-lg px-3 py-2" style={{ backgroundColor: 'var(--agro-warning-fill)' }}>
          <History size={14} className="flex-shrink-0 mt-0.5" style={{ color: 'var(--agro-warning-text)' }} />
          <p className="text-[11px]" style={{ color: 'var(--agro-warning-text)' }}>
            {reincidencia.mensaje}
          </p>
        </div>
      )}

      {!pregunta.es_cualitativa && falla && (
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

      {/* Hallazgos de esta pregunta — solo para preguntas numéricas */}
      {!pregunta.es_cualitativa && (respuesta === 'deficiencia_menor' || respuesta === 'deficiencia_mayor' || respuesta === 'no_conformidad') && (
        <div className="flex items-center gap-2 pt-0.5">
          {(hallazgosCount ?? 0) > 0 && (
            <button
              onClick={onVerHallazgos}
              className="flex items-center gap-1 text-[10px] font-semibold px-2 py-1 rounded-lg"
              style={{ backgroundColor: 'var(--agro-danger-fill)', color: 'var(--agro-danger-text)' }}
            >
              <Flag size={10} />
              {hallazgosCount} hallazgo{(hallazgosCount ?? 0) !== 1 ? 's' : ''}
            </button>
          )}
          {!cerrada && canWriteNC && (
            <button
              onClick={onRegistrarHallazgo}
              disabled={!instanciaDisponible}
              className="flex items-center gap-1 text-[10px] font-medium px-2 py-1 rounded-lg disabled:opacity-40"
              style={{ backgroundColor: 'var(--muted)', color: 'var(--foreground)', border: '1px solid var(--border)' }}
            >
              <Plus size={10} />
              {!instanciaDisponible ? 'Guardando…' : 'Registrar hallazgo'}
            </button>
          )}
        </div>
      )}
    </div>
  )
}

// ── Panel MIP / Módulo 9 cualitativo ─────────────────────────────────────────

function PanelM9({
  auditoriaId,
  version,
}: {
  auditoriaId: string | undefined
  version: number
}) {
  const [calculo, setCalculo] = useState<M9CalcResult | null>(null)
  const [cargando, setCargando] = useState(false)

  useEffect(() => {
    if (!auditoriaId) return
    let cancelado = false
    setCargando(true)
    ;(async () => {
      try {
        const { data, error } = await supabase.rpc('aud_calcular_m9', { p_auditoria_id: auditoriaId })
        if (error) { console.error('[PanelM9] aud_calcular_m9', error); return }
        if (!cancelado) setCalculo(data as M9CalcResult)
      } catch (e) {
        console.error('[PanelM9] aud_calcular_m9', e)
      } finally {
        if (!cancelado) setCargando(false)
      }
    })()
    return () => { cancelado = true }
  }, [auditoriaId, version])

  if (!calculo || calculo.estado === 'SIN_M9') return null

  const estadoConfig = {
    TOTAL_COMPLIANCE_REACHED:     { label: 'Total alcanzado', bg: 'var(--agro-success-fill)', color: 'var(--agro-success-text)', icon: <CheckCircle size={12} /> },
    TOTAL_COMPLIANCE_NOT_REACHED: { label: 'No alcanzado',   bg: 'var(--agro-danger-fill)',  color: 'var(--agro-danger-text)',  icon: <AlertCircle size={12} /> },
    PENDING_REVIEW:               { label: 'Pendiente',      bg: 'var(--agro-warning-fill)', color: 'var(--agro-warning-text)', icon: <AlertCircle size={12} /> },
  }

  const cfg = estadoConfig[calculo.estado as keyof typeof estadoConfig] ?? estadoConfig.PENDING_REVIEW

  return (
    <div
      className="rounded-xl border border-border px-4 py-3 flex items-center justify-between gap-3"
      style={{ backgroundColor: 'var(--card)' }}
    >
      <div className="flex flex-col gap-0.5 min-w-0">
        <p className="text-xs font-semibold" style={{ color: 'var(--foreground)' }}>
          MIP · Módulo 9
        </p>
        <p className="text-[10px]" style={{ color: 'var(--muted-foreground)' }}>
          Complemento cualitativo · no afecta el puntaje numérico
        </p>
      </div>
      <div className="flex items-center gap-2 flex-shrink-0">
        {cargando && <Loader size={12} className="animate-spin" style={{ color: 'var(--muted-foreground)' }} />}
        <span className="text-xs font-bold" style={{ color: 'var(--muted-foreground)' }}>
          {calculo.resueltas}/{calculo.total}
        </span>
        <span
          className="flex items-center gap-1 text-[10px] font-semibold px-2 py-1 rounded-lg"
          style={{ backgroundColor: cfg.bg, color: cfg.color }}
        >
          {cfg.icon}
          {cfg.label}
        </span>
      </div>
    </div>
  )
}

// ── Panel de validación determinística ──────────────────────────────────────

function PanelValidacion({
  issues,
  validando,
  descartandoId,
  motivoDescarte,
  onDescartarClick,
  onCancelarDescarte,
  onConfirmarDescarte,
  onMotivoChange,
}: {
  issues: ReviewIssue[]
  validando: boolean
  descartandoId: string | null
  motivoDescarte: string
  onDescartarClick: (id: string) => void
  onCancelarDescarte: () => void
  onConfirmarDescarte: () => void
  onMotivoChange: (v: string) => void
}) {
  const [abierto, setAbierto] = useState(true)
  const tieneBlockers = issues.some(i => i.severidad === 'BLOCKER')

  function scrollToPreg(pregId: string) {
    const el = document.getElementById(`preg-${pregId}`)
    if (el) el.scrollIntoView({ behavior: 'smooth', block: 'center' })
  }

  return (
    <div
      className="rounded-xl border overflow-hidden"
      style={{
        backgroundColor: tieneBlockers ? 'var(--agro-danger-fill)' : 'var(--card)',
        borderColor: tieneBlockers ? 'var(--agro-red)' : 'var(--border)',
        borderWidth: tieneBlockers ? '1.5px' : '1px',
      }}
    >
      {/* Header colapsable */}
      <button
        onClick={() => setAbierto(v => !v)}
        className="w-full flex items-center justify-between px-4 py-3 text-left"
      >
        <div className="flex items-center gap-2 min-w-0 flex-wrap">
          {validando ? (
            <Loader size={14} className="animate-spin flex-shrink-0" style={{ color: 'var(--muted-foreground)' }} />
          ) : (
            <ShieldCheck
              size={15}
              className="flex-shrink-0"
              style={{ color: tieneBlockers ? 'var(--agro-danger-text)' : issues.length === 0 ? 'var(--agro-success-text)' : 'var(--agro-warning-text)' }}
            />
          )}
          <span
            className="text-xs font-semibold"
            style={{ color: tieneBlockers ? 'var(--agro-danger-text)' : 'var(--foreground)' }}
          >
            {validando
              ? 'Analizando respuestas…'
              : issues.length === 0
                ? 'Sin observaciones de validación'
                : `${issues.length} observación${issues.length !== 1 ? 'es' : ''} encontrada${issues.length !== 1 ? 's' : ''}`
            }
          </span>
          {!validando && issues.length > 0 && (
            <div className="flex gap-1">
              {SEV_ORDER.map(sev => {
                const count = issues.filter(i => i.severidad === sev).length
                if (!count) return null
                const cfg = SEV_CONFIG[sev]
                return (
                  <span
                    key={sev}
                    className="text-[9px] font-bold px-1.5 py-0.5 rounded-full"
                    style={{ backgroundColor: cfg.bg, color: cfg.color }}
                  >
                    {count} {cfg.label.slice(0, 3)}
                  </span>
                )
              })}
            </div>
          )}
        </div>
        {abierto
          ? <ChevronUp size={14} style={{ color: 'var(--muted-foreground)' }} />
          : <ChevronDown size={14} style={{ color: 'var(--muted-foreground)' }} />
        }
      </button>

      {/* Cuerpo */}
      {abierto && (
        <div className="border-t border-border">
          {validando ? (
            <div className="flex items-center justify-center gap-2 py-6">
              <Loader size={14} className="animate-spin" style={{ color: 'var(--muted-foreground)' }} />
              <span className="text-xs" style={{ color: 'var(--muted-foreground)' }}>Analizando respuestas…</span>
            </div>
          ) : issues.length === 0 ? (
            <div className="flex items-center gap-2 px-4 py-4">
              <CheckCircle size={15} style={{ color: 'var(--agro-success-text)' }} />
              <span className="text-xs" style={{ color: 'var(--agro-success-text)' }}>
                Todas las validaciones pasaron correctamente.
              </span>
            </div>
          ) : (
            <div className="flex flex-col">
              {SEV_ORDER.map(sev => {
                const grupo = issues.filter(i => i.severidad === sev)
                if (!grupo.length) return null
                const cfg = SEV_CONFIG[sev]
                return (
                  <div key={sev}>
                    <div
                      className="px-4 py-1.5"
                      style={{ backgroundColor: cfg.bg }}
                    >
                      <span className="text-[10px] font-semibold uppercase tracking-wide" style={{ color: cfg.color }}>
                        {cfg.label} · {grupo.length}
                      </span>
                    </div>
                    {grupo.map(issue => (
                      <div
                        key={issue.id}
                        className="px-4 py-3 border-b border-border last:border-b-0 flex flex-col gap-2"
                        style={{ backgroundColor: 'var(--card)' }}
                      >
                        <p className="text-xs leading-relaxed" style={{ color: 'var(--foreground)' }}>
                          {issue.mensaje}
                        </p>
                        <div className="flex items-center gap-2 flex-wrap">
                          {issue.pregunta_id && (
                            <button
                              onClick={() => scrollToPreg(issue.pregunta_id!)}
                              className="text-[10px] font-semibold px-2 py-1 rounded-lg transition-colors hover:opacity-80"
                              style={{ backgroundColor: 'var(--accent)', color: 'var(--primary)' }}
                            >
                              → Ir a pregunta
                            </button>
                          )}
                          {descartandoId !== issue.id && (
                            <button
                              onClick={() => onDescartarClick(issue.id)}
                              className="text-[10px] px-2 py-1 rounded-lg transition-colors hover:bg-muted"
                              style={{ color: 'var(--muted-foreground)', border: '1px solid var(--border)' }}
                            >
                              Descartar
                            </button>
                          )}
                        </div>
                        {descartandoId === issue.id && (
                          <div className="flex flex-col gap-1.5 mt-0.5">
                            <input
                              type="text"
                              value={motivoDescarte}
                              onChange={e => onMotivoChange(e.target.value)}
                              placeholder="Motivo del descarte (opcional)"
                              autoFocus
                              className="text-xs outline-none"
                              style={{
                                width: '100%', height: '2rem',
                                borderRadius: 'var(--radius)',
                                border: '1px solid var(--border)',
                                backgroundColor: 'var(--input-background)',
                                color: 'var(--foreground)',
                                padding: '0 0.625rem',
                              }}
                            />
                            <div className="flex gap-2">
                              <button
                                onClick={onConfirmarDescarte}
                                className="flex-1 h-7 rounded-lg text-[10px] font-semibold transition-colors hover:opacity-80"
                                style={{ backgroundColor: 'var(--muted)', color: 'var(--foreground)', border: '1px solid var(--border)' }}
                              >
                                Confirmar descarte
                              </button>
                              <button
                                onClick={onCancelarDescarte}
                                className="h-7 px-3 rounded-lg text-[10px] transition-colors hover:bg-muted"
                                style={{ color: 'var(--muted-foreground)' }}
                              >
                                Cancelar
                              </button>
                            </div>
                          </div>
                        )}
                      </div>
                    ))}
                  </div>
                )
              })}
            </div>
          )}
        </div>
      )}
    </div>
  )
}

// ── Panel de scoring en vivo (F8) ────────────────────────────────────────────

function PanelScoring({
  auditoriaId,
  version,
}: {
  auditoriaId: string | undefined
  version: number
}) {
  const [calculo, setCalculo]  = useState<CalculoPuntaje | null>(null)
  const [cargando, setCargando] = useState(false)
  const [abierto, setAbierto]  = useState(false)

  useEffect(() => {
    if (!auditoriaId) return
    let cancelado = false
    setCargando(true)
    ;(async () => {
      try {
        const { data, error } = await supabase.rpc('aud_calcular_puntaje', { p_auditoria_id: auditoriaId })
        if (error) { console.error('[PanelScoring] aud_calcular_puntaje', error); return }
        if (!cancelado) setCalculo(data as CalculoPuntaje)
      } catch (e) {
        console.error('[PanelScoring] aud_calcular_puntaje', e)
      } finally {
        if (!cancelado) setCargando(false)
      }
    })()
    return () => { cancelado = true }
  }, [auditoriaId, version])

  const estado = calculo?.estado
  const fallaActiva = calculo?.falla_automatica_activa ?? false

  function tituloPrincipal(): string {
    if (cargando && !calculo) return 'Calculando…'
    if (!calculo) return 'Scoring en vivo'
    if (estado === 'BLOCKED_MISSING_MAX') return 'Scoring en vivo — máximos pendientes'
    if (estado === 'IN_PROGRESS') {
      const ev = calculo.conteo.resueltas ?? calculo.conteo.evaluadas
      const tot = calculo.conteo.total
      return `${ev}/${tot} evaluadas · −${calculo.perdida} pts`
    }
    if (estado === 'INTERNAL_COMPLETE') return `Resultado interno: ${calculo.resultado_bruto}%`
    if (estado === 'REQUIRES_VALIDATION') return `Revisión requerida · ${calculo.resultado_bruto}% normativo`
    if (estado === 'NO_SCORABLE_CRITERIA') return 'Sin criterios puntuables'
    return 'Scoring en vivo'
  }

  return (
    <div className="rounded-xl border border-border overflow-hidden" style={{ backgroundColor: 'var(--card)' }}>
      {/* Cabecera */}
      <button
        onClick={() => setAbierto(v => !v)}
        className="w-full flex items-center justify-between px-4 py-3 text-left"
      >
        <div className="flex items-center gap-2 min-w-0">
          <BarChart2
            size={15}
            className="flex-shrink-0"
            style={{ color: fallaActiva ? 'var(--agro-danger-text)' : 'var(--muted-foreground)' }}
          />
          <span className="text-xs font-semibold" style={{ color: fallaActiva ? 'var(--agro-danger-text)' : 'var(--foreground)' }}>
            {tituloPrincipal()}
          </span>
          {cargando && <Loader size={12} className="animate-spin flex-shrink-0" style={{ color: 'var(--muted-foreground)' }} />}
        </div>
        {abierto
          ? <ChevronUp size={14} style={{ color: 'var(--muted-foreground)' }} />
          : <ChevronDown size={14} style={{ color: 'var(--muted-foreground)' }} />
        }
      </button>

      {abierto && (
        <div className="border-t border-border px-4 pb-4 flex flex-col gap-3">
          {/* Etiqueta invariante */}
          <p className="text-[10px] pt-3 italic" style={{ color: 'var(--muted-foreground)' }}>
            Cálculo interno M.A.D.Y. · no oficial — el puntaje definitivo lo emite el organismo certificador.
          </p>

          {/* Falla automática activa */}
          {fallaActiva && calculo && (
            <div
              className="flex items-start gap-2 rounded-lg px-3 py-2"
              style={{ backgroundColor: 'var(--agro-danger-fill)', border: '1px solid var(--agro-red)' }}
            >
              <AlertOctagon size={14} className="flex-shrink-0 mt-0.5" style={{ color: 'var(--agro-danger-text)' }} />
              <div className="flex flex-col gap-0.5">
                <p className="text-[11px] font-bold" style={{ color: 'var(--agro-danger-text)' }}>
                  Fallo automático detectado · módulo afectado 0% efectivo
                </p>
                <p className="text-[11px]" style={{ color: 'var(--agro-danger-text)' }}>
                  Resultado aritmético bruto: {calculo.resultado_bruto}% (antes de aplicar el cero)
                </p>
              </div>
            </div>
          )}

          {calculo && estado === 'BLOCKED_MISSING_MAX' && (
            <>
              <div className="rounded-lg px-3 py-2" style={{ backgroundColor: 'var(--muted)' }}>
                <p className="text-[11px] font-medium" style={{ color: 'var(--foreground)' }}>
                  Puntuación integral no disponible — faltan máximos verificados
                </p>
                <p className="text-[10px] mt-0.5" style={{ color: 'var(--muted-foreground)' }}>
                  {calculo.mensaje}
                </p>
              </div>
              <div className="grid grid-cols-3 gap-2">
                {[
                  ['Total', calculo.conteo.total],
                  ['Con máximo', calculo.conteo.scored_con_max ?? calculo.conteo.con_maximo],
                  ['Pendientes máx.', calculo.conteo.missing_max ?? calculo.conteo.pendientes_maximo],
                ].map(([lbl, val]) => (
                  <div key={lbl as string} className="rounded-lg px-3 py-2" style={{ backgroundColor: 'var(--muted)' }}>
                    <p className="text-[10px]" style={{ color: 'var(--muted-foreground)' }}>{lbl}</p>
                    <p className="text-base font-bold" style={{ color: 'var(--foreground)' }}>{val ?? '—'}</p>
                  </div>
                ))}
              </div>
            </>
          )}

          {calculo && estado === 'IN_PROGRESS' && (
            <>
              <div className="grid grid-cols-2 gap-2">
                {[
                  ['Evaluadas', `${calculo.conteo.resueltas ?? calculo.conteo.evaluadas}/${calculo.conteo.total}`],
                  ['Puntos ganados', `${calculo.puntos_ganados}`],
                  ['Perdida', `−${calculo.perdida} pts`],
                  ['Pendientes', `${calculo.pendientes} pts`],
                ].map(([lbl, val]) => (
                  <div key={lbl as string} className="rounded-lg px-3 py-2" style={{ backgroundColor: 'var(--muted)' }}>
                    <p className="text-[10px]" style={{ color: 'var(--muted-foreground)' }}>{lbl}</p>
                    <p className="text-sm font-bold" style={{ color: 'var(--foreground)' }}>{val}</p>
                  </div>
                ))}
              </div>
              <div className="rounded-lg px-3 py-2 flex flex-col gap-1" style={{ backgroundColor: 'var(--agro-success-fill)' }}>
                <p className="text-[10px] font-semibold" style={{ color: 'var(--agro-success-text)' }}>
                  Escenario si pendientes cumplen: {calculo.proyeccion_si_pendientes_cumplen}%
                </p>
                <p className="text-[10px]" style={{ color: 'var(--agro-success-text)' }}>
                  Cota inferior (todas fallan): {calculo.cota_inferior}%
                </p>
              </div>
            </>
          )}

          {calculo && estado === 'INTERNAL_COMPLETE' && (
            <div className="rounded-lg px-3 py-2" style={{ backgroundColor: 'var(--muted)' }}>
              <p className="text-[11px] font-semibold" style={{ color: 'var(--foreground)' }}>
                Resultado aritmético interno: {calculo.resultado_bruto}%
              </p>
            </div>
          )}

          {calculo && estado === 'REQUIRES_VALIDATION' && (
            <>
              <div className="rounded-lg px-3 py-2 flex flex-col gap-1" style={{ backgroundColor: 'var(--agro-warning-fill)', border: '1px solid var(--agro-amber)' }}>
                <p className="text-[11px] font-bold" style={{ color: 'var(--agro-warning-text)' }}>
                  Revisión de puntuación requerida
                </p>
                <p className="text-[11px]" style={{ color: 'var(--agro-warning-text)' }}>
                  Resultado normativo: {calculo.resultado_bruto}%
                  {(calculo.ajustes_en_conflicto ?? 0) > 0 && (
                    <span className="font-semibold"> · {calculo.ajustes_en_conflicto} ajuste{calculo.ajustes_en_conflicto !== 1 ? 's' : ''} en conflicto</span>
                  )}
                </p>
              </div>
            </>
          )}

          {calculo && estado === 'NO_SCORABLE_CRITERIA' && (
            <p className="text-[11px]" style={{ color: 'var(--muted-foreground)' }}>
              No hay criterios puntuables configurados para esta auditoría.
            </p>
          )}

          {/* Escenario de trabajo (no normativo) cuando hay ajustes manuales */}
          {calculo && (calculo.ajustes_manuales ?? 0) > 0 && calculo.escenario_trabajo && (
            <div className="rounded-lg px-3 py-2 flex flex-col gap-0.5" style={{ backgroundColor: 'var(--muted)', border: '1px dashed var(--border)' }}>
              <p className="text-[10px] font-semibold uppercase tracking-wide" style={{ color: 'var(--muted-foreground)' }}>
                Escenario de trabajo · no normativo
              </p>
              <p className="text-sm font-bold" style={{ color: 'var(--foreground)' }}>
                {calculo.escenario_trabajo.resultado}%
              </p>
              <p className="text-[10px]" style={{ color: 'var(--muted-foreground)' }}>
                {calculo.escenario_trabajo.etiqueta} · {calculo.ajustes_manuales} ajuste{calculo.ajustes_manuales !== 1 ? 's' : ''} manual{calculo.ajustes_manuales !== 1 ? 'es' : ''}
              </p>
            </div>
          )}

          {/* Fallas automáticas detalle */}
          {calculo && fallaActiva && (calculo.fallas?.length ?? 0) > 0 && (
            <div className="flex flex-col gap-1">
              <p className="text-[10px] font-semibold uppercase tracking-wide" style={{ color: 'var(--agro-danger-text)' }}>
                Numerales con falla
              </p>
              {calculo.fallas!.map(f => (
                <div key={f.question_id} className="flex items-center gap-2">
                  <span className="text-[10px] font-mono px-1.5 py-0.5 rounded" style={{ backgroundColor: 'var(--agro-danger-fill)', color: 'var(--agro-danger-text)' }}>
                    {f.question_id}
                  </span>
                  <span className="text-[10px]" style={{ color: 'var(--muted-foreground)' }}>{f.modulo}</span>
                </div>
              ))}
            </div>
          )}

          {/* Desglose por módulo (IN_PROGRESS o INTERNAL_COMPLETE) */}
          {calculo && (estado === 'IN_PROGRESS' || estado === 'INTERNAL_COMPLETE') && calculo.por_modulo.length > 0 && (
            <div className="flex flex-col gap-1.5">
              <p className="text-[10px] font-semibold uppercase tracking-wide" style={{ color: 'var(--muted-foreground)' }}>
                Por módulo
              </p>
              {calculo.por_modulo.map(m => (
                <div key={m.modulo} className="rounded-lg px-3 py-2 flex flex-col gap-0.5" style={{ backgroundColor: 'var(--muted)' }}>
                  <div className="flex items-center justify-between gap-2">
                    <p className="text-[11px] font-semibold truncate flex-1" style={{ color: 'var(--foreground)' }}>
                      {m.nombre || m.modulo}
                    </p>
                    {m.falla_automatica && (
                      <span className="text-[10px] font-bold px-1.5 py-0.5 rounded flex-shrink-0" style={{ backgroundColor: 'var(--agro-danger-fill)', color: 'var(--agro-danger-text)' }}>
                        Falla
                      </span>
                    )}
                  </div>
                  <div className="flex gap-3 flex-wrap">
                    <span className="text-[10px]" style={{ color: 'var(--muted-foreground)' }}>
                      Bruto: <span className="font-semibold" style={{ color: 'var(--foreground)' }}>{m.resultado_bruto}%</span>
                    </span>
                    {m.falla_automatica && (
                      <span className="text-[10px]" style={{ color: 'var(--agro-danger-text)' }}>
                        Efectivo: <span className="font-bold">0%</span>
                      </span>
                    )}
                    {!m.falla_automatica && m.resultado_efectivo !== m.resultado_bruto && (
                      <span className="text-[10px]" style={{ color: 'var(--muted-foreground)' }}>
                        Efectivo: <span className="font-semibold" style={{ color: 'var(--foreground)' }}>{m.resultado_efectivo}%</span>
                      </span>
                    )}
                    {m.proyeccion_si_cumplen > 0 && (
                      <span className="text-[10px]" style={{ color: 'var(--agro-success-text)' }}>
                        Proj.: {m.proyeccion_si_cumplen}%
                      </span>
                    )}
                  </div>
                </div>
              ))}
            </div>
          )}

          {!calculo && !cargando && (
            <p className="text-[11px]" style={{ color: 'var(--muted-foreground)' }}>
              No se pudo obtener el cálculo. Recarga la pantalla.
            </p>
          )}
        </div>
      )}
    </div>
  )
}

// ── Panel de lista de hallazgos ──────────────────────────────────────────────

function PanelHallazgos({
  hallazgos, preguntas, onVerAccion, onEstadoChange, onVerEvidencias, onVerIncidencias, cargando,
  canWriteNC, canWriteAC,
}: {
  hallazgos: AudHallazgo[]
  preguntas: AudPregunta[]
  onVerAccion: (h: AudHallazgo) => void
  onEstadoChange: (id: string, estado: AudHallazgoEstado) => void
  onVerEvidencias: (h: AudHallazgo) => void
  onVerIncidencias: (h: AudHallazgo) => void
  cargando: boolean
  canWriteNC: boolean
  canWriteAC: boolean
}) {
  const [abierto, setAbierto] = useState(true)

  function scrollToPreg(pregId: string) {
    const el = document.getElementById(`preg-${pregId}`)
    if (el) el.scrollIntoView({ behavior: 'smooth', block: 'center' })
  }

  return (
    <div className="rounded-xl border border-border overflow-hidden" style={{ backgroundColor: 'var(--card)' }}>
      <button
        onClick={() => setAbierto(v => !v)}
        className="w-full flex items-center justify-between px-4 py-3 text-left"
      >
        <div className="flex items-center gap-2">
          <Flag size={15} className="flex-shrink-0" style={{ color: hallazgos.length > 0 ? 'var(--agro-danger-text)' : 'var(--muted-foreground)' }} />
          <span className="text-xs font-semibold" style={{ color: 'var(--foreground)' }}>
            {cargando ? 'Cargando hallazgos…' : `${hallazgos.length} hallazgo${hallazgos.length !== 1 ? 's' : ''}`}
          </span>
        </div>
        {abierto
          ? <ChevronUp size={14} style={{ color: 'var(--muted-foreground)' }} />
          : <ChevronDown size={14} style={{ color: 'var(--muted-foreground)' }} />
        }
      </button>

      {abierto && (
        <div className="border-t border-border">
          {hallazgos.length === 0 ? (
            <p className="text-xs px-4 py-4" style={{ color: 'var(--muted-foreground)' }}>
              {cargando ? 'Cargando…' : 'Sin hallazgos registrados.'}
            </p>
          ) : (
            <div className="flex flex-col divide-y" style={{ borderColor: 'var(--border)' }}>
              {hallazgos.map(h => {
                const clasConfig = CLASIFICACION_CONFIG[h.clasificacion]
                const estConfig = HALL_ESTADO_CONFIG[h.estado]
                const preg = preguntas.find(p => p.id === h.pregunta_id)
                return (
                  <div key={h.id} className="px-4 py-3 flex flex-col gap-2">
                    <div className="flex items-start gap-2 flex-wrap">
                      <span className="text-[10px] font-bold px-1.5 py-0.5 rounded flex-shrink-0"
                            style={{ backgroundColor: clasConfig.bg, color: clasConfig.color }}>
                        {clasConfig.label}
                      </span>
                      <span className="text-[10px] font-semibold px-1.5 py-0.5 rounded flex-shrink-0"
                            style={{ backgroundColor: estConfig.bg, color: estConfig.color }}>
                        {estConfig.label}
                      </span>
                    </div>
                    <p className="text-[0.8125rem] leading-snug" style={{ color: 'var(--foreground)' }}>
                      {h.descripcion}
                    </p>
                    {preg && (
                      <button
                        onClick={() => scrollToPreg(preg.id)}
                        className="self-start text-[10px] font-medium px-2 py-0.5 rounded"
                        style={{ backgroundColor: 'var(--muted)', color: 'var(--primary)' }}
                      >
                        → {preg.question_id}
                      </button>
                    )}
                    <div className="flex items-center gap-2 flex-wrap">
                      <select
                        value={h.estado}
                        onChange={e => onEstadoChange(h.id, e.target.value as AudHallazgoEstado)}
                        disabled={!canWriteNC}
                        className="text-[10px] h-7 rounded-lg px-2 outline-none disabled:opacity-50"
                        style={{
                          border: '1px solid var(--border)',
                          backgroundColor: canWriteNC ? 'var(--input-background)' : 'var(--muted)',
                          color: 'var(--foreground)',
                        }}
                      >
                        {(Object.keys(HALL_ESTADO_CONFIG) as AudHallazgoEstado[]).map(est => (
                          <option key={est} value={est}>{HALL_ESTADO_CONFIG[est].label}</option>
                        ))}
                      </select>
                      {canWriteAC && (
                        <button
                          onClick={() => onVerAccion(h)}
                          className="flex items-center gap-1 text-[10px] font-semibold h-7 px-2 rounded-lg"
                          style={{ backgroundColor: 'var(--primary)', color: '#fff' }}
                        >
                          <ClipboardList size={11} />
                          Acción correctiva
                        </button>
                      )}
                      <button
                        onClick={() => onVerEvidencias(h)}
                        className="flex items-center gap-1 text-[10px] font-semibold h-7 px-2 rounded-lg"
                        style={{ backgroundColor: 'var(--muted)', color: 'var(--foreground)', border: '1px solid var(--border)' }}
                      >
                        <Paperclip size={11} />
                        Evidencias
                      </button>
                      <button
                        onClick={() => onVerIncidencias(h)}
                        className="flex items-center gap-1 text-[10px] font-semibold h-7 px-2 rounded-lg"
                        style={{ backgroundColor: 'var(--muted)', color: 'var(--foreground)', border: '1px solid var(--border)' }}
                      >
                        <Link2 size={11} />
                        Antecedentes M13
                      </button>
                    </div>
                  </div>
                )
              })}
            </div>
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
    instanciasMap,
    ajustesMap, setAjustesMap,
    cargando, errorMsg,
    guardarRespuesta, cambiarEstado,
  } = hook

  const [savingMap, setSavingMap] = useState<Record<string, SaveStatus>>({})
  const [saveErrMap, setSaveErrMap] = useState<Record<string, string>>({})
  const [cambiando, setCambiando] = useState(false)
  const [descargando, setDescargando] = useState(false)
  const [scoringVersion, setScoringVersion] = useState(0)

  const [reviewIssues, setReviewIssues] = useState<ReviewIssue[]>([])
  const [validando, setValidando] = useState(false)
  const [panelValidacionVisible, setPanelValidacionVisible] = useState(false)
  const [descartandoId, setDescartandoId] = useState<string | null>(null)
  const [motivoDescarte, setMotivoDescarte] = useState('')

  // — Reincidencia e historial por criterio —
  const [reincidenciaMap, setReincidenciaMap] = useState<Map<string, ReincidenciaResult>>(new Map())
  const [historialCriterios, setHistorialCriterios] = useState<HistorialCriterio[]>([])
  const [panelAntecedentesAbierto, setPanelAntecedentesAbierto] = useState(false)
  const loadedReincidenciaRef = useRef<Set<string>>(new Set())

  // — Hallazgos y CAPA —
  const hallazgosHook = useHallazgos(auditoriaId, auditoria?.org_id)
  const { hallazgos, cargar: cargarHallazgos, crearHallazgo, actualizarEstado: actualizarEstadoHallazgo, cargarAccion, crearAccion, actualizarAccion, cargarVersiones } = hallazgosHook

  useEffect(() => {
    if (auditoria?.id) cargarHallazgos()
  }, [auditoria?.id]) // eslint-disable-line react-hooks/exhaustive-deps

  useEffect(() => {
    if (!auditoria?.id || !profile?.id) return
    const nombre = auditoria.instalacion_id
      ? (auditoria.instalacion_nombre ?? 'Instalación')
      : `${auditoria.productor_nombre} · ${auditoria.rancho_nombre}`
    guardarLastWorkspace({
      profileId: profile.id,
      route: `/auditor/auditoria/${auditoria.id}`,
      entity_type: 'AUDITORIA',
      entity_id: auditoria.id,
      titulo: nombre,
    })
  }, [auditoria?.id, profile?.id]) // eslint-disable-line react-hooks/exhaustive-deps

  // Cargar historial de criterios con NC al sitio auditado
  useEffect(() => {
    if (!auditoria?.org_id) return
    let cancelado = false
    async function cargarHistorial() {
      try {
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        let q: any = (supabase as any)
          .from('aud_criterion_history')
          .select('criterion_code, n_hallazgos, primer_detectado, ultimo_detectado, ultimo_hallazgo_id, ultimo_estado')
          .eq('org_id', auditoria!.org_id)
          .order('n_hallazgos', { ascending: false })
          .limit(20)
        if (auditoria!.rancho_id) q = q.eq('rancho_id', auditoria!.rancho_id)
        const { data, error } = await q
        if (error) { console.error('[AuditorEjecucion] aud_criterion_history', error); return }
        if (!cancelado) setHistorialCriterios(data ?? [])
      } catch (e) {
        console.error('[AuditorEjecucion] cargarHistorialCriterios', e)
      }
    }
    cargarHistorial()
    return () => { cancelado = true }
  }, [auditoria?.org_id, auditoria?.rancho_id]) // eslint-disable-line react-hooks/exhaustive-deps

  // Cargar reincidencia para preguntas con NC/deficiencia al cargar el catálogo
  useEffect(() => {
    if (!auditoria?.org_id || modulosData.length === 0) return
    const allPregs = modulosData.flatMap(m => m.preguntas)
    for (const preg of allPregs) {
      const resp = respuestasMap.get(preg.id)
      if (resp === 'no_conformidad' || resp === 'deficiencia_menor' || resp === 'deficiencia_mayor') {
        cargarReincidenciaForPreg(preg.id, String(preg.prompt_component_id))
      }
    }
  }, [auditoria?.org_id, modulosData.length]) // eslint-disable-line react-hooks/exhaustive-deps

  function cargarReincidenciaForPreg(pregId: string, criterionCode: string | null) {
    if (!auditoria?.org_id || !criterionCode) return
    if (loadedReincidenciaRef.current.has(pregId)) return
    loadedReincidenciaRef.current.add(pregId)
    ;(async () => {
      try {
        const { data, error } = await (supabase as any).rpc('aud_reincidencia_criterio', {
          p_org_id: auditoria!.org_id,
          p_criterion_code: criterionCode,
          p_rancho_id: auditoria!.rancho_id ?? null,
        })
        if (error) {
          console.error('[AuditorEjecucion] aud_reincidencia_criterio', error)
          loadedReincidenciaRef.current.delete(pregId)
          return
        }
        if (data) setReincidenciaMap(prev => new Map(prev).set(pregId, data as ReincidenciaResult))
      } catch (e) {
        console.error('[AuditorEjecucion] aud_reincidencia_criterio', e)
        loadedReincidenciaRef.current.delete(pregId)
      }
    })()
  }

  const panelHallazgosRef = useRef<HTMLDivElement>(null)

  // Sheet: crear hallazgo
  const [sheetHallazgo, setSheetHallazgo] = useState<{ preguntaId: string; instanciaId: string } | null>(null)
  const [formHallazgoDesc, setFormHallazgoDesc] = useState('')
  const [formHallazgoClas, setFormHallazgoClas] = useState<AudHallazgoClasificacion>('menor')
  const [guardandoHallazgo, setGuardandoHallazgo] = useState(false)

  // Sheet: acción correctiva
  const [sheetAccion, setSheetAccion] = useState<{ hallazgoId: string; descripcion: string } | null>(null)
  const [accionActual, setAccionActual] = useState<AudAccionCorrectivaCAPA | null>(null)
  const [cargandoAccion, setCargandoAccion] = useState(false)
  const [guardandoAccion, setGuardandoAccion] = useState(false)
  const [formAccion, setFormAccion] = useState<Partial<AudAccionCorrectivaCAPA>>({})

  // Sheet: historial de versiones
  const [sheetHistorial, setSheetHistorial] = useState<AudAcVersion[] | null>(null)
  const [cargandoHistorial, setCargandoHistorial] = useState(false)

  // Sheet: evidencias de hallazgo
  const [sheetEvidenciaHallazgo, setSheetEvidenciaHallazgo] = useState<{
    hallazgoId: string
    descripcion: string
    preguntaId: string | null
    criterionCode: string | null
  } | null>(null)

  // Sheet: incidencias M13 como antecedentes del hallazgo
  const [sheetIncidenciasHallazgo, setSheetIncidenciasHallazgo] = useState<{ hallazgoId: string; descripcion: string } | null>(null)
  const [incVinculadas, setIncVinculadas] = useState<IncidenciaVinculada[]>([])
  const [cargandoIncVinc, setCargandoIncVinc] = useState(false)
  const [incQuitandoId, setIncQuitandoId] = useState<string | null>(null)
  const [incDesde, setIncDesde] = useState('')
  const [incHasta, setIncHasta] = useState('')
  const [incSearch, setIncSearch] = useState('')
  const [incResultados, setIncResultados] = useState<IncidenciaBusqueda[]>([])
  const [incBuscando, setIncBuscando] = useState(false)
  const [incRelacionandoId, setIncRelacionandoId] = useState<string | null>(null)

  // — Azzule —
  const [validandoAzzule, setValidandoAzzule] = useState(false)
  const [azzuleItems, setAzzuleItems] = useState<Array<{ code: string; severity: string; message: string }> | null>(null)
  const [azzuleReady, setAzzuleReady] = useState(false)
  const [sheetRegistrarResultado, setSheetRegistrarResultado] = useState(false)
  const initialFormResultado = {
    observed_status: 'revisada' as AudExternalObservedStatus,
    official_decision: '',
    official_new_response: '',
    official_comment: '',
    external_audit_id: '',
    observed_at: '',
  }
  const [formResultado, setFormResultado] = useState(initialFormResultado)
  const [guardandoResultado, setGuardandoResultado] = useState(false)
  const [historialExterno, setHistorialExterno] = useState<AudExternalWorkflow[]>([])
  const [cargandoHistorialExterno, setCargandoHistorialExterno] = useState(false)
  const [historialExternoVisible, setHistorialExternoVisible] = useState(false)

  const respuestasRef   = useRef(respuestasMap)
  const valoresRef      = useRef(valoresMap)
  const observacionesRef = useRef(observacionesMap)
  useEffect(() => { respuestasRef.current    = respuestasMap    }, [respuestasMap])
  useEffect(() => { valoresRef.current       = valoresMap       }, [valoresMap])
  useEffect(() => { observacionesRef.current = observacionesMap }, [observacionesMap])

  const debounceTimers = useRef<Record<string, ReturnType<typeof setTimeout>>>({})

  const loadStartRef      = useRef(ahora())
  const loadEmittedRef    = useRef(false)
  const openedAtRef       = useRef(new Map<string, number>())
  const measuredRef       = useRef(new Set<string>())
  const firstEditEmittedRef = useRef(false)

  useEffect(() => {
    if (!cargando && !loadEmittedRef.current && modulosData.length > 0) {
      loadEmittedRef.current = true
      emitirEvento('lat_workspace', ms(loadStartRef.current), { auditoriaId: auditoriaId ?? null })
      const t = ahora()
      modulosData.flatMap(m => m.preguntas).forEach(p => {
        openedAtRef.current.set(p.id, t)
      })
    }
  }, [cargando, modulosData.length]) // eslint-disable-line react-hooks/exhaustive-deps

  const { can, cargando: cargandoPermisos } = useMisPermisos()
  const canWriteNC       = cargandoPermisos || can('nc.write')
  const canWriteAC       = cargandoPermisos || can('ac.write')
  const canAuditReview   = cargandoPermisos || can('audit.review')
  const canExternalStatus = cargandoPermisos || can('external_status.record')

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

  function emitFirstEdit(pregId: string) {
    const openedAt = openedAtRef.current.get(pregId)
    if (openedAt !== undefined && !measuredRef.current.has(pregId)) {
      measuredRef.current.add(pregId)
      const instId = instanciasMap.get(pregId) ?? null
      emitirEvento('T_open_to_first_edit', segundos(openedAt), {
        auditoriaId: auditoriaId ?? null,
        preguntaId: pregId,
        instanciaId: instId,
      })
    }
    if (!firstEditEmittedRef.current) {
      firstEditEmittedRef.current = true
      const resume = consumeResumeMetrics()
      if (resume) {
        emitirEvento('T_resume_to_edit', segundos(resume.ts), { auditoriaId: auditoriaId ?? null })
        emitirEvento('clicks_to_resume', resume.clicks, { auditoriaId: auditoriaId ?? null })
      }
    }
  }

  function dispatchSave(pregId: string, forceResp?: AudRespuesta) {
    const resp = forceResp ?? respuestasRef.current.get(pregId)
    if (!resp || !auditoriaId) return
    const allPregs = modulosData.flatMap(m => m.preguntas)
    const preg = allPregs.find(p => p.id === pregId)
    const vals  = valoresRef.current.get(pregId) ?? new Map<string, string>()
    const obs   = observacionesRef.current.get(pregId)

    const t0 = ahora()
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
        emitirEvento('lat_autosave', ms(t0), { auditoriaId: auditoriaId ?? null, preguntaId: pregId })
        setSavingMap(prev => ({ ...prev, [pregId]: 'saved' }))
        setSaveErrMap(prev => { const n = { ...prev }; delete n[pregId]; return n })
        setTimeout(() => setSavingMap(prev => ({ ...prev, [pregId]: 'idle' })), 2500)
        setScoringVersion(v => v + 1)
      })
      .catch((err: unknown) => {
        console.error('[AuditorEjecucion] guardarRespuesta:', err)
        setSavingMap(prev => ({ ...prev, [pregId]: 'error' }))
        setSaveErrMap(prev => ({ ...prev, [pregId]: traducirError(err) }))
      })
  }

  function handleRespuesta(pregId: string, resp: AudRespuesta) {
    emitFirstEdit(pregId)
    setRespuestasMap(prev => new Map(prev).set(pregId, resp))
    clearTimeout(debounceTimers.current[pregId])
    debounceTimers.current[pregId] = setTimeout(() => dispatchSave(pregId, resp), 50)
    if (resp === 'no_conformidad' || resp === 'deficiencia_menor' || resp === 'deficiencia_mayor') {
      const preg = modulosData.flatMap(m => m.preguntas).find(p => p.id === pregId)
      if (preg && !preg.es_cualitativa) cargarReincidenciaForPreg(preg.id, String(preg.prompt_component_id))
    }
  }

  function handleAjusteActualizado(pregId: string, nuevoAjuste: AjusteInfo | null) {
    setAjustesMap(prev => {
      const next = new Map(prev)
      if (nuevoAjuste && nuevoAjuste.puntos_manual != null) {
        next.set(pregId, nuevoAjuste)
      } else {
        next.delete(pregId)
      }
      return next
    })
    setScoringVersion(v => v + 1)
  }

  function handleValor(pregId: string, esquemaId: string, v: string) {
    emitFirstEdit(pregId)
    setValoresMap(prev => {
      const next = new Map(prev)
      const campos = new Map(next.get(pregId) ?? [])
      campos.set(esquemaId, v)
      next.set(pregId, campos)
      return next
    })
  }

  function handleObservacion(pregId: string, v: string) {
    emitFirstEdit(pregId)
    setObservacionesMap(prev => new Map(prev).set(pregId, v))
  }

  function handleBlur(pregId: string) {
    clearTimeout(debounceTimers.current[pregId])
    debounceTimers.current[pregId] = setTimeout(() => dispatchSave(pregId), 400)
  }

  async function handleCambiarEstado(nuevoEstado: 'preliminar' | 'cerrada') {
    if (!auditoria?.id) return
    const accion = nuevoEstado === 'cerrada' ? 'cerrar' : 'marcar como preliminar'

    // Validar primero — bloquear si hay BLOCKERs
    setValidando(true)
    setPanelValidacionVisible(true)
    let issues: ReviewIssue[] = []
    try {
      const { error: revErr } = await supabase.rpc('aud_run_review', { p_auditoria_id: auditoria.id })
      if (revErr) {
        console.error('[handleCambiarEstado] aud_run_review', revErr)
        toast.error('No se pudo validar la auditoría. Reintenta.')
        return
      }
      issues = await loadReviewIssues()
      setReviewIssues(issues)
    } finally {
      setValidando(false)
    }

    const blockers = issues.filter(i => i.severidad === 'BLOCKER')
    if (blockers.length > 0) {
      toast.warning(
        `Resuelve ${blockers.length} bloqueo${blockers.length !== 1 ? 's' : ''} antes de ${accion}`
      )
      return
    }

    const msg = nuevoEstado === 'cerrada'
      ? '¿Cerrar esta auditoría? No podrás editar las respuestas después. Descarga el reporte PDF si lo necesitas.'
      : '¿Marcar esta auditoría como preliminar?'
    if (!window.confirm(msg)) return
    setCambiando(true)
    try {
      await cambiarEstado(nuevoEstado)
      toast.success(`Auditoría ${accion === 'cerrar' ? 'cerrada' : 'marcada como preliminar'}`)
    } catch (e: unknown) {
      console.error('[handleCambiarEstado]', e)
      toast.error(`No se pudo ${accion}. Reintenta.`)
    } finally {
      setCambiando(false)
    }
  }

  const allPreguntas = modulosData.flatMap(m => m.preguntas)

  const estadoStyle = ESTADO_STYLE[auditoria?.estado ?? ''] ?? ESTADO_STYLE.cerrada

  const backTarget = instalacionId
    ? `/auditor/instalacion/${instalacionId}`
    : orgId
      ? `/auditor/org/${orgId}`
      : '/auditor'
  const backState = instalacionId
    ? { instalacionNombre: instalacionNombreNav }
    : { orgNombre }

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
        reviewIssues: reviewIssues.filter(i => i.estado === 'OPEN'),
      })
    } catch (e: unknown) {
      console.error('[AuditorEjecucion] generarAuditorReportePDF:', e)
      toast.error('No se pudo generar el PDF. Reintenta.')
    } finally {
      setDescargando(false)
    }
  }

  async function loadReviewIssues(): Promise<ReviewIssue[]> {
    if (!auditoriaId) return []
    const { data, error } = await supabase
      .from('aud_review_issues')
      .select('*')
      .eq('auditoria_id', auditoriaId)
      .eq('estado', 'OPEN')
      .order('severidad')
    if (error) {
      console.error('[loadReviewIssues]', error)
      return []
    }
    return (data ?? []) as ReviewIssue[]
  }

  async function handleValidar() {
    if (!auditoria?.id) return
    setValidando(true)
    setPanelValidacionVisible(true)
    try {
      const { error } = await supabase.rpc('aud_run_review', { p_auditoria_id: auditoria.id })
      if (error) {
        console.error('[handleValidar] aud_run_review', error)
        toast.error('No se pudo ejecutar la validación. Reintenta.')
        return
      }
      const issues = await loadReviewIssues()
      setReviewIssues(issues)
      if (issues.length === 0) {
        toast.success('Sin observaciones — la auditoría pasó todas las validaciones')
      } else {
        const nBlock = issues.filter(i => i.severidad === 'BLOCKER').length
        if (nBlock > 0) {
          toast.warning(`${nBlock} bloqueo${nBlock !== 1 ? 's' : ''} encontrado${nBlock !== 1 ? 's' : ''}`)
        } else {
          toast.info(`${issues.length} observación${issues.length !== 1 ? 'es' : ''} de validación`)
        }
      }
    } finally {
      setValidando(false)
    }
  }

  async function handleAbrirAccion(h: AudHallazgo) {
    setSheetAccion({ hallazgoId: h.id, descripcion: h.descripcion })
    setAccionActual(null)
    setFormAccion({})
    setAzzuleItems(null)
    setAzzuleReady(false)
    setHistorialExterno([])
    setHistorialExternoVisible(false)
    setSheetRegistrarResultado(false)
    setFormResultado(initialFormResultado)
    setCargandoAccion(true)
    try {
      const ac = await cargarAccion(h.id)
      setAccionActual(ac)
      if (ac) {
        setFormAccion(ac)
        cargarHistorialExternoFn(ac.id)
      } else {
        setFormAccion({ internal_status: 'REGISTERED', external_status: 'NOT_TRACKED' })
      }
    } catch (e) {
      console.error('[AuditorEjecucion] cargarAccion', e)
      toast.error('No se pudo cargar la acción correctiva. Reintenta.')
    } finally {
      setCargandoAccion(false)
    }
  }

  async function handleGuardarHallazgo() {
    if (!sheetHallazgo || !formHallazgoDesc.trim()) return
    setGuardandoHallazgo(true)
    try {
      const pregHallazgo = allPreguntas.find(p => p.id === sheetHallazgo.preguntaId)
      await crearHallazgo({
        instanciaId: sheetHallazgo.instanciaId,
        preguntaId: sheetHallazgo.preguntaId,
        descripcion: formHallazgoDesc.trim(),
        clasificacion: formHallazgoClas,
        criterionCode: pregHallazgo ? String(pregHallazgo.prompt_component_id) : null,
        ranchoId: auditoria?.rancho_id ?? null,
      })
      setSheetHallazgo(null)
      setFormHallazgoDesc('')
      setFormHallazgoClas('menor')
      toast.success('Hallazgo registrado')
    } catch (e) {
      console.error('[AuditorEjecucion] crearHallazgo', e)
      toast.error('No se pudo registrar el hallazgo. Reintenta.')
    } finally {
      setGuardandoHallazgo(false)
    }
  }

  async function handleGuardarAccion() {
    if (!sheetAccion) return
    setGuardandoAccion(true)
    try {
      if (accionActual) {
        await actualizarAccion(accionActual.id, formAccion)
      } else {
        await crearAccion(sheetAccion.hallazgoId, formAccion)
      }
      toast.success(accionActual ? 'Acción actualizada' : 'Acción creada')
      setSheetAccion(null)
      setAccionActual(null)
      setFormAccion({})
    } catch (e) {
      console.error('[AuditorEjecucion] guardarAccion', e)
      toast.error('No se pudo guardar la acción. Reintenta.')
    } finally {
      setGuardandoAccion(false)
    }
  }

  async function handleVerHistorial() {
    if (!accionActual) return
    setCargandoHistorial(true)
    try {
      const vs = await cargarVersiones(accionActual.id)
      setSheetHistorial(vs)
    } catch (e) {
      console.error('[AuditorEjecucion] cargarVersiones', e)
      toast.error('No se pudo cargar el historial. Reintenta.')
    } finally {
      setCargandoHistorial(false)
    }
  }

  async function handleDescartar() {
    if (!descartandoId) return
    try {
      const { error } = await supabase
        .from('aud_review_issues')
        .update({ estado: 'DISMISSED', resolution_note: motivoDescarte.trim() || null })
        .eq('id', descartandoId)
      if (error) throw error
      setReviewIssues(prev => prev.filter(i => i.id !== descartandoId))
    } catch (e: unknown) {
      console.error('[handleDescartar]', e)
      toast.error('No se pudo descartar el hallazgo. Reintenta.')
      return
    }
    setDescartandoId(null)
    setMotivoDescarte('')
  }

  async function cargarHistorialExternoFn(accionId: string) {
    setCargandoHistorialExterno(true)
    try {
      const { data, error } = await supabase
        .from('aud_external_workflow')
        .select('*')
        .eq('accion_id', accionId)
        .order('observed_at', { ascending: false })
      if (error) throw error
      setHistorialExterno((data ?? []) as AudExternalWorkflow[])
    } catch (e) {
      console.error('[cargarHistorialExterno]', e)
    } finally {
      setCargandoHistorialExterno(false)
    }
  }

  async function cargarIncVinculadas(hallazgoId: string) {
    setCargandoIncVinc(true)
    try {
      const { data, error } = await (supabase as any)
        .from('aud_nc_incidencia')
        .select('id, incidencia_id, reporte_id, relation_type, m13_incidencias(descripcion), m13_reportes(fecha, rancho_id)')
        .eq('hallazgo_id', hallazgoId)
      if (error) throw error
      setIncVinculadas(data ?? [])
    } catch (e) {
      console.error('[AuditorEjecucion] cargarIncVinculadas', e)
      toast.error('No se pudieron cargar los antecedentes. Reintenta.')
    } finally {
      setCargandoIncVinc(false)
    }
  }

  async function handleBuscarIncidencias() {
    if (!auditoria?.org_id) return
    setIncBuscando(true)
    setIncResultados([])
    try {
      const { data, error } = await (supabase as any).rpc('aud_buscar_incidencias', {
        p_org_id: auditoria.org_id,
        p_rancho_id: auditoria.rancho_id ?? null,
        p_date_from: incDesde || null,
        p_date_to: incHasta || null,
        p_search: incSearch.trim() || null,
      })
      if (error) throw error
      setIncResultados(data ?? [])
    } catch (e) {
      console.error('[AuditorEjecucion] buscarIncidencias', e)
      toast.error('No se pudieron buscar las incidencias. Reintenta.')
    } finally {
      setIncBuscando(false)
    }
  }

  async function handleRelacionarIncidencia(inc: IncidenciaBusqueda) {
    if (!sheetIncidenciasHallazgo || !auditoria?.org_id) return
    setIncRelacionandoId(inc.incidencia_id)
    try {
      const { error } = await (supabase as any).from('aud_nc_incidencia').insert({
        org_id: auditoria.org_id,
        hallazgo_id: sheetIncidenciasHallazgo.hallazgoId,
        incidencia_id: inc.incidencia_id,
        reporte_id: inc.reporte_id,
        relation_type: 'ANTECEDENTE',
      })
      if (error) {
        if (error.code === '23505') {
          toast.info('Esta incidencia ya está relacionada con el hallazgo.')
        } else {
          throw error
        }
      } else {
        toast.success('Incidencia relacionada como antecedente')
        await cargarIncVinculadas(sheetIncidenciasHallazgo.hallazgoId)
      }
    } catch (e) {
      console.error('[AuditorEjecucion] relacionarIncidencia', e)
      toast.error('No se pudo relacionar la incidencia. Reintenta.')
    } finally {
      setIncRelacionandoId(null)
    }
  }

  async function handleQuitarIncidencia(vinculoId: string) {
    if (!sheetIncidenciasHallazgo) return
    setIncQuitandoId(vinculoId)
    try {
      const { error } = await (supabase as any)
        .from('aud_nc_incidencia')
        .delete()
        .eq('id', vinculoId)
      if (error) throw error
      toast.success('Vínculo eliminado')
      setIncVinculadas(prev => prev.filter(v => v.id !== vinculoId))
    } catch (e) {
      console.error('[AuditorEjecucion] quitarIncidencia', e)
      toast.error('No se pudo eliminar el vínculo. Reintenta.')
    } finally {
      setIncQuitandoId(null)
    }
  }

  function handleAbrirIncidencias(h: AudHallazgo) {
    setSheetIncidenciasHallazgo({ hallazgoId: h.id, descripcion: h.descripcion })
    setIncVinculadas([])
    setIncDesde('')
    setIncHasta('')
    setIncSearch('')
    setIncResultados([])
    cargarIncVinculadas(h.id)
  }

  async function handleValidarAzzule() {
    if (!accionActual?.id) return
    setValidandoAzzule(true)
    setAzzuleItems(null)
    setAzzuleReady(false)
    try {
      const { data, error } = await supabase.rpc('aud_lista_para_azzule', { p_accion_id: accionActual.id })
      if (error) {
        console.error('[handleValidarAzzule]', error)
        toast.error('No se pudo validar para Azzule. Reintenta.')
        return
      }
      const result = data as { ready: boolean; blockingIssues: number; warnings: number; items: Array<{ code: string; severity: string; message: string }> }
      setAzzuleItems(result?.items ?? [])
      setAzzuleReady(result?.ready ?? false)
      if (result?.ready) {
        toast.success('Lista para Azzule — puedes abrir el Modo Azzule')
      } else {
        const nb = result?.blockingIssues ?? 0
        toast.warning(`${nb} bloqueo${nb !== 1 ? 's' : ''} pendiente${nb !== 1 ? 's' : ''}`)
      }
    } finally {
      setValidandoAzzule(false)
    }
  }

  async function handleRegistrarResultado() {
    if (!accionActual?.id || !sheetAccion) return
    setGuardandoResultado(true)
    try {
      const { error } = await supabase.rpc('aud_azzule_registrar_resultado', {
        p_accion_id: accionActual.id,
        p_observed_status: formResultado.observed_status,
        p_official_decision: formResultado.official_decision || null,
        p_official_new_response: formResultado.official_new_response || null,
        p_official_comment: formResultado.official_comment || null,
        p_external_audit_id: formResultado.external_audit_id || null,
        p_observed_at: formResultado.observed_at || null,
      })
      if (error) {
        console.error('[handleRegistrarResultado]', error)
        toast.error('No se pudo registrar el resultado. Reintenta.')
        return
      }
      toast.success('Resultado registrado')
      setFormResultado(initialFormResultado)
      setSheetRegistrarResultado(false)
      cargarHistorialExternoFn(accionActual.id)
      // Refrescar acción para ver el nuevo external_status
      const updated = await cargarAccion(sheetAccion.hallazgoId)
      if (updated) {
        setAccionActual(updated)
        setFormAccion(updated)
      }
    } finally {
      setGuardandoResultado(false)
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
            {/* Botón descargar reporte PDF */}
            {auditoria && allPreguntas.length > 0 && (
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

            {/* Scoring en vivo */}
            {!cerrada && allPreguntas.length > 0 && (
              <PanelScoring
                auditoriaId={auditoriaId}
                version={scoringVersion}
              />
            )}

            {/* MIP · Módulo 9 cualitativo */}
            {!cerrada && allPreguntas.length > 0 && (
              <PanelM9
                auditoriaId={auditoriaId}
                version={scoringVersion}
              />
            )}

            {/* Panel de validación */}
            {panelValidacionVisible && !cerrada && canAuditReview && (
              <PanelValidacion
                issues={reviewIssues}
                validando={validando}
                descartandoId={descartandoId}
                motivoDescarte={motivoDescarte}
                onDescartarClick={id => { setDescartandoId(id); setMotivoDescarte('') }}
                onCancelarDescarte={() => { setDescartandoId(null); setMotivoDescarte('') }}
                onConfirmarDescarte={handleDescartar}
                onMotivoChange={setMotivoDescarte}
              />
            )}

            {/* Panel de hallazgos */}
            <div ref={panelHallazgosRef}>
              <PanelHallazgos
                hallazgos={hallazgos}
                preguntas={allPreguntas}
                onVerAccion={handleAbrirAccion}
                onVerEvidencias={h => setSheetEvidenciaHallazgo({ hallazgoId: h.id, descripcion: h.descripcion, preguntaId: h.pregunta_id ?? null, criterionCode: h.criterion_code ?? null })}
                onVerIncidencias={handleAbrirIncidencias}
                onEstadoChange={(id, estado) => {
                  actualizarEstadoHallazgo(id, estado).catch(e => {
                    console.error('[AuditorEjecucion] actualizarEstadoHallazgo', e)
                    toast.error('No se pudo actualizar el estado. Reintenta.')
                  })
                }}
                cargando={hallazgosHook.cargando}
                canWriteNC={canWriteNC}
                canWriteAC={canWriteAC}
              />
            </div>

            {/* Panel de antecedentes (historial de NC por criterio en el sitio) */}
            {historialCriterios.length > 0 && (
              <div className="rounded-xl border border-border overflow-hidden" style={{ backgroundColor: 'var(--card)' }}>
                <button
                  onClick={() => setPanelAntecedentesAbierto(v => !v)}
                  className="w-full flex items-center justify-between px-4 py-3 text-left"
                >
                  <div className="flex items-center gap-2">
                    <History size={15} className="flex-shrink-0" style={{ color: 'var(--agro-warning-text)' }} />
                    <span className="text-xs font-semibold" style={{ color: 'var(--foreground)' }}>
                      Antecedentes ({historialCriterios.length} criterio{historialCriterios.length !== 1 ? 's' : ''} con NC)
                    </span>
                  </div>
                  {panelAntecedentesAbierto
                    ? <ChevronUp size={14} style={{ color: 'var(--muted-foreground)' }} />
                    : <ChevronDown size={14} style={{ color: 'var(--muted-foreground)' }} />
                  }
                </button>
                {panelAntecedentesAbierto && (
                  <div className="border-t border-border">
                    <p className="text-[11px] px-4 pt-3 pb-1" style={{ color: 'var(--muted-foreground)' }}>
                      Criterios con historial de NC en este sitio. Informativo — no determina cumplimiento.
                    </p>
                    {historialCriterios.map(h => {
                      const pregMatch = allPreguntas.find(p => String(p.prompt_component_id) === String(h.criterion_code))
                      return (
                        <div key={h.criterion_code} className="px-4 py-3 flex flex-col gap-1.5 border-t border-border">
                          <div className="flex items-center gap-2 flex-wrap">
                            <span
                              className="text-[10px] font-mono px-1.5 py-0.5 rounded"
                              style={{ backgroundColor: 'var(--muted)', color: 'var(--muted-foreground)' }}
                            >
                              {h.criterion_code}
                            </span>
                            <span
                              className="text-[10px] font-semibold px-1.5 py-0.5 rounded"
                              style={{ backgroundColor: 'var(--agro-danger-fill)', color: 'var(--agro-danger-text)' }}
                            >
                              {h.n_hallazgos} NC
                            </span>
                            {h.ultimo_detectado && (
                              <span className="text-[10px]" style={{ color: 'var(--muted-foreground)' }}>
                                último: {formatFecha(h.ultimo_detectado)}{h.ultimo_estado ? ` (${h.ultimo_estado})` : ''}
                              </span>
                            )}
                          </div>
                          {pregMatch && (
                            <button
                              onClick={() => document.getElementById(`preg-${pregMatch.id}`)?.scrollIntoView({ behavior: 'smooth', block: 'center' })}
                              className="self-start text-[10px] font-medium px-2 py-0.5 rounded"
                              style={{ backgroundColor: 'var(--muted)', color: 'var(--primary)' }}
                            >
                              → Ir a criterio {pregMatch.question_id}
                            </button>
                          )}
                        </div>
                      )
                    })}
                  </div>
                )}
              </div>
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
                            canWriteNC={canWriteNC}
                            instanciaDisponible={
                              !!instanciasMap.get(preg.id) &&
                              (savingMap[preg.id] ?? 'idle') !== 'saving'
                            }
                            hallazgosCount={hallazgos.filter(h => h.pregunta_id === preg.id).length}
                            reincidencia={reincidenciaMap.get(preg.id)}
                            ajuste={ajustesMap.get(preg.id)}
                            instanciaId={instanciasMap.get(preg.id)}
                            onAjusteActualizado={a => handleAjusteActualizado(preg.id, a)}
                            onRegistrarHallazgo={() => {
                              const instId = instanciasMap.get(preg.id)
                              if (!instId) {
                                toast.info('Espera a que se guarde la respuesta')
                                return
                              }
                              setFormHallazgoDesc('')
                              setFormHallazgoClas('menor')
                              setSheetHallazgo({ preguntaId: preg.id, instanciaId: instId })
                            }}
                            onVerHallazgos={() => {
                              panelHallazgosRef.current?.scrollIntoView({ behavior: 'smooth', block: 'start' })
                            }}
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
                {/* Botón Validar */}
                {canAuditReview && (
                  <button
                    onClick={handleValidar}
                    disabled={validando || cambiando}
                    className="w-full h-11 rounded-xl text-sm font-semibold flex items-center justify-center gap-2 disabled:opacity-50 transition-colors"
                    style={{ backgroundColor: 'var(--muted)', color: 'var(--foreground)', border: '1px solid var(--border)' }}
                  >
                    {validando
                      ? <><Loader size={15} className="animate-spin" />Validando…</>
                      : <><ShieldCheck size={15} />Validar</>
                    }
                  </button>
                )}

                {auditoria?.estado !== 'preliminar' && (
                  <button
                    onClick={() => handleCambiarEstado('preliminar')}
                    disabled={cambiando || validando}
                    className="w-full h-11 rounded-xl text-sm font-semibold disabled:opacity-50"
                    style={{ backgroundColor: 'var(--card)', color: 'var(--primary)', border: '1.5px solid var(--primary)' }}
                  >
                    {cambiando ? 'Guardando…' : 'Marcar preliminar'}
                  </button>
                )}
                <button
                  onClick={() => handleCambiarEstado('cerrada')}
                  disabled={cambiando || validando}
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

      {/* Sheet: Crear hallazgo */}
      <BottomSheet open={!!sheetHallazgo} onClose={() => setSheetHallazgo(null)}>
        <div className="flex flex-col h-full">
          <div className="flex items-center justify-between px-4 py-4 border-b border-border flex-shrink-0">
            <h2 className="text-sm font-semibold" style={{ color: 'var(--foreground)' }}>Registrar hallazgo</h2>
            <button onClick={() => setSheetHallazgo(null)} className="text-muted-foreground">
              <XCircle size={20} />
            </button>
          </div>
          <div className="flex-1 overflow-y-auto px-4 py-4 flex flex-col gap-4">
            <div className="flex flex-col gap-1">
              <label className="text-[11px] font-medium" style={{ color: 'var(--muted-foreground)' }}>
                Clasificación
              </label>
              <select
                value={formHallazgoClas}
                onChange={e => setFormHallazgoClas(e.target.value as AudHallazgoClasificacion)}
                className="h-10 rounded-xl px-3 outline-none text-sm"
                style={{ border: '1px solid var(--border)', backgroundColor: 'var(--input-background)', color: 'var(--foreground)' }}
              >
                <option value="menor">Menor</option>
                <option value="mayor">Mayor</option>
                <option value="critico">Crítico</option>
                <option value="observacion">Observación</option>
              </select>
            </div>
            <div className="flex flex-col gap-1">
              <label className="text-[11px] font-medium" style={{ color: 'var(--muted-foreground)' }}>
                Descripción <span style={{ color: 'var(--agro-red)' }}>*</span>
              </label>
              <textarea
                value={formHallazgoDesc}
                onChange={e => setFormHallazgoDesc(e.target.value)}
                rows={4}
                placeholder="Describe el hallazgo encontrado…"
                className="resize-none text-sm outline-none"
                style={{
                  borderRadius: 'var(--radius)',
                  border: '1px solid var(--border)',
                  backgroundColor: 'var(--input-background)',
                  color: 'var(--foreground)',
                  padding: '0.5rem 0.75rem',
                }}
              />
            </div>
          </div>
          <div className="px-4 pb-6 pt-3 flex-shrink-0 border-t border-border">
            <button
              onClick={handleGuardarHallazgo}
              disabled={guardandoHallazgo || !formHallazgoDesc.trim()}
              className="w-full h-11 rounded-xl text-sm font-semibold flex items-center justify-center gap-2 disabled:opacity-50"
              style={{ backgroundColor: 'var(--primary)', color: '#fff' }}
            >
              {guardandoHallazgo ? <><Loader size={15} className="animate-spin" /> Guardando…</> : 'Registrar hallazgo'}
            </button>
          </div>
        </div>
      </BottomSheet>

      {/* Sheet: Acción correctiva */}
      <BottomSheet open={!!sheetAccion} onClose={() => { setSheetAccion(null); setAccionActual(null); setFormAccion({}) }} height="85%">
        <div className="flex flex-col h-full">
          <div className="flex items-center justify-between px-4 py-4 border-b border-border flex-shrink-0">
            <div className="min-w-0 flex-1">
              <h2 className="text-sm font-semibold" style={{ color: 'var(--foreground)' }}>Acción correctiva</h2>
              {sheetAccion && (
                <p className="text-[10px] mt-0.5 line-clamp-1" style={{ color: 'var(--muted-foreground)' }}>
                  {sheetAccion.descripcion}
                </p>
              )}
            </div>
            <button onClick={() => { setSheetAccion(null); setAccionActual(null); setFormAccion({}) }} className="text-muted-foreground ml-2 flex-shrink-0">
              <XCircle size={20} />
            </button>
          </div>

          {cargandoAccion ? (
            <div className="flex-1 flex items-center justify-center gap-2">
              <Loader size={16} className="animate-spin" style={{ color: 'var(--muted-foreground)' }} />
              <span className="text-sm" style={{ color: 'var(--muted-foreground)' }}>Cargando…</span>
            </div>
          ) : (
            <div className="flex-1 overflow-y-auto px-4 py-4 flex flex-col gap-4">
              {/* Estado interno M.A.D.Y */}
              <div className="rounded-xl p-3 flex flex-col gap-2" style={{ backgroundColor: 'var(--muted)' }}>
                <p className="text-[10px] font-bold uppercase tracking-wide" style={{ color: 'var(--muted-foreground)' }}>Estado interno — M.A.D.Y</p>
                <select
                  value={formAccion.internal_status ?? 'REGISTERED'}
                  onChange={e => setFormAccion(prev => ({ ...prev, internal_status: e.target.value as AudInternalStatus }))}
                  className="h-10 rounded-xl px-3 outline-none text-sm w-full"
                  style={{ border: '1px solid var(--border)', backgroundColor: 'var(--card)', color: 'var(--foreground)' }}
                >
                  {(Object.keys(INTERNAL_STATUS_LABELS) as AudInternalStatus[]).map(k => (
                    <option key={k} value={k}>{INTERNAL_STATUS_LABELS[k]}</option>
                  ))}
                </select>
              </div>

              {/* Estado externo Azzule / organismo */}
              <div className="rounded-xl p-3 flex flex-col gap-2" style={{ border: '1.5px solid var(--border)' }}>
                <p className="text-[10px] font-bold uppercase tracking-wide" style={{ color: 'var(--muted-foreground)' }}>Estado externo — Azzule / organismo</p>
                <p className="text-[10px]" style={{ color: 'var(--muted-foreground)' }}>Registra manualmente lo que ocurrió fuera del sistema.</p>
                <select
                  value={formAccion.external_status ?? 'NOT_TRACKED'}
                  onChange={e => setFormAccion(prev => ({ ...prev, external_status: e.target.value as AudExternalStatus }))}
                  className="h-10 rounded-xl px-3 outline-none text-sm w-full"
                  style={{ border: '1px solid var(--border)', backgroundColor: 'var(--input-background)', color: 'var(--foreground)' }}
                >
                  {(Object.keys(EXTERNAL_STATUS_LABELS) as AudExternalStatus[]).map(k => (
                    <option key={k} value={k}>{EXTERNAL_STATUS_LABELS[k]}</option>
                  ))}
                </select>
              </div>

              {/* Contraparte externa */}
              <div className="flex flex-col gap-1">
                <label className="text-[11px] font-medium" style={{ color: 'var(--muted-foreground)' }}>Contraparte externa (sin usuario MADY)</label>
                <input
                  type="text"
                  value={formAccion.owner_external_party ?? ''}
                  onChange={e => setFormAccion(prev => ({ ...prev, owner_external_party: e.target.value || null }))}
                  placeholder="Nombre de la persona u organismo responsable"
                  className="h-10 rounded-xl px-3 outline-none text-sm"
                  style={{ border: '1px solid var(--border)', backgroundColor: 'var(--input-background)', color: 'var(--foreground)' }}
                />
              </div>

              {/* Campos narrativos */}
              {([
                ['condicion_inicial',      'Condición inicial'],
                ['correccion_inmediata',   'Corrección inmediata'],
                ['causa_raiz',             'Causa raíz'],
                ['cambio_sistemico',       'Cambio sistémico'],
                ['prevencion',             'Prevención'],
                ['verificacion_eficacia',  'Verificación de eficacia'],
                ['respuesta_organizacion', 'Respuesta de la organización'],
                ['comentario_accion',      'Comentario de la acción'],
              ] as [keyof AudAccionCorrectivaCAPA, string][]).map(([campo, etiqueta]) => (
                <div key={campo} className="flex flex-col gap-1">
                  <label className="text-[11px] font-medium" style={{ color: 'var(--muted-foreground)' }}>{etiqueta}</label>
                  <textarea
                    value={(formAccion[campo] as string) ?? ''}
                    onChange={e => setFormAccion(prev => ({ ...prev, [campo]: e.target.value || null }))}
                    rows={2}
                    className="resize-none text-sm outline-none"
                    style={{
                      borderRadius: 'var(--radius)',
                      border: '1px solid var(--border)',
                      backgroundColor: 'var(--input-background)',
                      color: 'var(--foreground)',
                      padding: '0.5rem 0.75rem',
                    }}
                  />
                </div>
              ))}

              {/* Ver historial */}
              {accionActual && (
                <button
                  onClick={handleVerHistorial}
                  disabled={cargandoHistorial}
                  className="flex items-center justify-center gap-2 w-full h-10 rounded-xl text-sm font-medium disabled:opacity-50"
                  style={{ backgroundColor: 'var(--muted)', color: 'var(--foreground)', border: '1px solid var(--border)' }}
                >
                  {cargandoHistorial
                    ? <><Loader size={14} className="animate-spin" /> Cargando historial…</>
                    : <><History size={14} /> Ver historial de versiones ({accionActual.current_version})</>
                  }
                </button>
              )}

              {/* Evidencias de la acción */}
              {accionActual && auditoria && (
                <EvidenciaPanel
                  entityType="ACCION"
                  entityId={accionActual.id}
                  orgId={auditoria.org_id}
                  auditoriaId={auditoria.id}
                  cerrada={!!cerrada}
                  hallazgoId={sheetAccion?.hallazgoId ?? null}
                  accionId={accionActual.id}
                  preguntaId={hallazgos.find(h => h.id === (sheetAccion?.hallazgoId ?? ''))?.pregunta_id ?? null}
                  criterionCode={hallazgos.find(h => h.id === (sheetAccion?.hallazgoId ?? ''))?.criterion_code ?? null}
                  ranchoId={auditoria.rancho_id ?? null}
                />
              )}

              {/* ── Sección Azzule ─────────────────────────────────────────── */}
              {accionActual && (
                <div className="flex flex-col gap-3">
                  {/* Disclaimer */}
                  <div className="rounded-xl px-3 py-2" style={{ backgroundColor: 'var(--muted)' }}>
                    <p className="text-[10px] italic" style={{ color: 'var(--muted-foreground)' }}>
                      M.A.D.Y organiza, valida y da seguimiento. No sustituye a PrimusGFS, Azzule Systems, al auditor autorizado ni al organismo de certificación.
                    </p>
                  </div>

                  {/* Botón Validar para Azzule */}
                  {canExternalStatus && (
                    <button
                      onClick={handleValidarAzzule}
                      disabled={validandoAzzule || cerrada}
                      className="w-full h-10 rounded-xl text-sm font-semibold flex items-center justify-center gap-2 disabled:opacity-50"
                      style={{ backgroundColor: 'var(--muted)', color: 'var(--foreground)', border: '1px solid var(--border)' }}
                    >
                      {validandoAzzule
                        ? <><Loader size={13} className="animate-spin" />Validando…</>
                        : <><ShieldCheck size={13} />Validar para Azzule</>
                      }
                    </button>
                  )}

                  {/* Resultados de validación */}
                  {azzuleItems !== null && (
                    <div className="flex flex-col gap-2">
                      {(['BLOCKER', 'WARNING', 'INFO'] as const).map(sev => {
                        const grupo = azzuleItems.filter(i => i.severity === sev)
                        if (!grupo.length) return null
                        const cfg = sev === 'BLOCKER'
                          ? { bg: 'var(--agro-danger-fill)',  color: 'var(--agro-danger-text)',  label: 'Bloqueante' }
                          : sev === 'WARNING'
                          ? { bg: 'var(--agro-warning-fill)', color: 'var(--agro-warning-text)', label: 'Aviso' }
                          : { bg: 'var(--agro-success-fill)', color: 'var(--agro-success-text)', label: 'Info' }
                        return (
                          <div key={sev} className="rounded-xl overflow-hidden border" style={{ borderColor: 'var(--border)' }}>
                            <div className="px-3 py-1.5" style={{ backgroundColor: cfg.bg }}>
                              <span className="text-[10px] font-bold uppercase tracking-wide" style={{ color: cfg.color }}>
                                {cfg.label} · {grupo.length}
                              </span>
                            </div>
                            {grupo.map((item, i) => (
                              <div key={i} className="px-3 py-2 border-t" style={{ borderColor: 'var(--border)', backgroundColor: 'var(--card)' }}>
                                <p className="text-xs leading-relaxed" style={{ color: 'var(--foreground)' }}>{item.message}</p>
                              </div>
                            ))}
                          </div>
                        )
                      })}

                      {azzuleReady && canExternalStatus ? (
                        <button
                          onClick={() => navigate(
                            `/auditor/auditoria/${auditoriaId}/azzule`,
                            { state: { orgNombre, orgId, instalacionId, instalacionNombreNav } }
                          )}
                          className="w-full h-10 rounded-xl text-sm font-semibold flex items-center justify-center gap-2"
                          style={{ backgroundColor: 'var(--primary)', color: '#fff' }}
                        >
                          Abrir Modo Azzule
                        </button>
                      ) : !azzuleReady ? (
                        <p className="text-[10px] text-center py-1" style={{ color: 'var(--muted-foreground)' }}>
                          Resuelve los bloqueos para habilitar el Modo Azzule
                        </p>
                      ) : null}
                    </div>
                  )}

                  {/* Registrar resultado oficial (colapsable) */}
                  {canExternalStatus && (
                  <div className="rounded-xl overflow-hidden border" style={{ borderColor: 'var(--border)' }}>
                    <button
                      onClick={() => setSheetRegistrarResultado(v => !v)}
                      className="w-full flex items-center justify-between px-3 py-2.5 text-left"
                    >
                      <span className="text-xs font-semibold" style={{ color: 'var(--foreground)' }}>Registrar resultado de Azzule</span>
                      {sheetRegistrarResultado
                        ? <ChevronUp size={14} style={{ color: 'var(--muted-foreground)' }} />
                        : <ChevronDown size={14} style={{ color: 'var(--muted-foreground)' }} />
                      }
                    </button>
                    {sheetRegistrarResultado && (
                      <div className="px-3 pb-3 flex flex-col gap-3 border-t" style={{ borderColor: 'var(--border)' }}>
                        <p className="text-[10px] pt-2" style={{ color: 'var(--muted-foreground)' }}>
                          Cada registro es una nueva observación — no sobrescribe el anterior.
                        </p>
                        <div className="flex flex-col gap-1">
                          <label className="text-[11px] font-medium" style={{ color: 'var(--muted-foreground)' }}>Estado observado *</label>
                          <select
                            value={formResultado.observed_status}
                            onChange={e => setFormResultado(p => ({ ...p, observed_status: e.target.value as AudExternalObservedStatus }))}
                            className="h-9 rounded-lg px-2 text-xs outline-none"
                            style={{ border: '1px solid var(--border)', backgroundColor: 'var(--input-background)', color: 'var(--foreground)' }}
                          >
                            {(Object.keys(OBSERVED_STATUS_LABELS) as AudExternalObservedStatus[]).map(k => (
                              <option key={k} value={k}>{OBSERVED_STATUS_LABELS[k]}</option>
                            ))}
                          </select>
                        </div>
                        <div className="flex flex-col gap-1">
                          <label className="text-[11px] font-medium" style={{ color: 'var(--muted-foreground)' }}>Fecha observada</label>
                          <input
                            type="date"
                            value={formResultado.observed_at}
                            onChange={e => setFormResultado(p => ({ ...p, observed_at: e.target.value }))}
                            className="h-9 rounded-lg px-2 text-xs outline-none"
                            style={{ border: '1px solid var(--border)', backgroundColor: 'var(--input-background)', color: 'var(--foreground)' }}
                          />
                        </div>
                        <div className="flex flex-col gap-1">
                          <label className="text-[11px] font-medium" style={{ color: 'var(--muted-foreground)' }}>ID auditoría Azzule</label>
                          <input
                            type="text"
                            value={formResultado.external_audit_id}
                            onChange={e => setFormResultado(p => ({ ...p, external_audit_id: e.target.value }))}
                            placeholder="Ej. AZZ-2024-00123"
                            className="h-9 rounded-lg px-2 text-xs outline-none"
                            style={{ border: '1px solid var(--border)', backgroundColor: 'var(--input-background)', color: 'var(--foreground)' }}
                          />
                        </div>
                        {([
                          ['official_decision',     'Decisión oficial'],
                          ['official_new_response', 'Nueva respuesta oficial'],
                          ['official_comment',      'Comentario'],
                        ] as [keyof typeof formResultado, string][]).map(([campo, label]) => (
                          <div key={campo} className="flex flex-col gap-1">
                            <label className="text-[11px] font-medium" style={{ color: 'var(--muted-foreground)' }}>{label}</label>
                            <textarea
                              value={formResultado[campo]}
                              onChange={e => setFormResultado(p => ({ ...p, [campo]: e.target.value }))}
                              rows={2}
                              className="resize-none text-xs outline-none"
                              style={{ borderRadius: 'var(--radius)', border: '1px solid var(--border)', backgroundColor: 'var(--input-background)', color: 'var(--foreground)', padding: '0.375rem 0.625rem' }}
                            />
                          </div>
                        ))}
                        <button
                          onClick={handleRegistrarResultado}
                          disabled={guardandoResultado}
                          className="w-full h-9 rounded-lg text-xs font-semibold flex items-center justify-center gap-2 disabled:opacity-50"
                          style={{ backgroundColor: 'var(--primary)', color: '#fff' }}
                        >
                          {guardandoResultado ? <><Loader size={12} className="animate-spin" />Guardando…</> : 'Registrar resultado'}
                        </button>
                      </div>
                    )}
                  </div>
                  )}

                  {/* Historial externo (colapsable) */}
                  <div className="rounded-xl overflow-hidden border" style={{ borderColor: 'var(--border)' }}>
                    <button
                      onClick={() => {
                        const next = !historialExternoVisible
                        setHistorialExternoVisible(next)
                        if (next && historialExterno.length === 0) cargarHistorialExternoFn(accionActual.id)
                      }}
                      className="w-full flex items-center justify-between px-3 py-2.5 text-left"
                    >
                      <span className="text-xs font-semibold" style={{ color: 'var(--foreground)' }}>
                        Historial de seguimiento externo
                      </span>
                      {historialExternoVisible
                        ? <ChevronUp size={14} style={{ color: 'var(--muted-foreground)' }} />
                        : <ChevronDown size={14} style={{ color: 'var(--muted-foreground)' }} />
                      }
                    </button>
                    {historialExternoVisible && (
                      <div className="border-t" style={{ borderColor: 'var(--border)' }}>
                        {cargandoHistorialExterno ? (
                          <div className="flex items-center justify-center gap-2 py-4">
                            <Loader size={14} className="animate-spin" style={{ color: 'var(--muted-foreground)' }} />
                          </div>
                        ) : historialExterno.length === 0 ? (
                          <p className="text-xs px-3 py-3" style={{ color: 'var(--muted-foreground)' }}>
                            Sin seguimiento externo registrado.
                          </p>
                        ) : (
                          <div className="flex flex-col divide-y" style={{ borderColor: 'var(--border)' }}>
                            {historialExterno.map(ewr => (
                              <div key={ewr.id} className="px-3 py-2.5 flex flex-col gap-1">
                                <div className="flex items-center justify-between">
                                  <span className="text-[10px] font-bold" style={{ color: 'var(--foreground)' }}>
                                    {OBSERVED_STATUS_LABELS[ewr.observed_status]}
                                  </span>
                                  <span className="text-[10px]" style={{ color: 'var(--muted-foreground)' }}>
                                    {new Date(ewr.observed_at).toLocaleDateString('es-MX', { day: '2-digit', month: 'short', year: 'numeric' })}
                                  </span>
                                </div>
                                {ewr.official_decision && (
                                  <p className="text-[10px]" style={{ color: 'var(--foreground)' }}>{ewr.official_decision}</p>
                                )}
                                {ewr.official_comment && (
                                  <p className="text-[10px]" style={{ color: 'var(--muted-foreground)' }}>{ewr.official_comment}</p>
                                )}
                                {ewr.source_note && (
                                  <p className="text-[10px] italic" style={{ color: 'var(--muted-foreground)' }}>{ewr.source_note}</p>
                                )}
                              </div>
                            ))}
                          </div>
                        )}
                      </div>
                    )}
                  </div>
                </div>
              )}
            </div>
          )}

          {!cargandoAccion && canWriteAC && (
            <div className="px-4 pb-6 pt-3 flex-shrink-0 border-t border-border">
              <button
                onClick={handleGuardarAccion}
                disabled={guardandoAccion}
                className="w-full h-11 rounded-xl text-sm font-semibold flex items-center justify-center gap-2 disabled:opacity-50"
                style={{ backgroundColor: 'var(--primary)', color: '#fff' }}
              >
                {guardandoAccion ? <><Loader size={15} className="animate-spin" /> Guardando…</> : (accionActual ? 'Actualizar acción' : 'Crear acción correctiva')}
              </button>
            </div>
          )}
        </div>
      </BottomSheet>

      {/* Sheet: Historial de versiones */}
      <BottomSheet open={sheetHistorial !== null} onClose={() => setSheetHistorial(null)} height="85%">
        <div className="flex flex-col h-full">
          <div className="flex items-center justify-between px-4 py-4 border-b border-border flex-shrink-0">
            <h2 className="text-sm font-semibold" style={{ color: 'var(--foreground)' }}>Historial de versiones</h2>
            <button onClick={() => setSheetHistorial(null)} className="text-muted-foreground">
              <XCircle size={20} />
            </button>
          </div>
          <div className="flex-1 overflow-y-auto px-4 py-4 flex flex-col gap-3">
            {(sheetHistorial ?? []).length === 0 ? (
              <p className="text-sm text-center py-8" style={{ color: 'var(--muted-foreground)' }}>Sin versiones guardadas aún.</p>
            ) : (
              (sheetHistorial ?? []).map(v => (
                <div key={v.id} className="rounded-xl border border-border p-3 flex flex-col gap-2">
                  <div className="flex items-center justify-between">
                    <span className="text-xs font-bold" style={{ color: 'var(--foreground)' }}>Versión {v.version}</span>
                    <span className="text-[10px]" style={{ color: 'var(--muted-foreground)' }}>
                      {new Date(v.created_at).toLocaleDateString('es-MX', { day: '2-digit', month: 'short', year: 'numeric', hour: '2-digit', minute: '2-digit' })}
                    </span>
                  </div>
                  {([
                    ['causa_raiz',             'Causa raíz'],
                    ['correccion_inmediata',   'Corrección inmediata'],
                    ['cambio_sistemico',       'Cambio sistémico'],
                    ['prevencion',             'Prevención'],
                    ['verificacion_eficacia',  'Verificación de eficacia'],
                    ['respuesta_organizacion', 'Respuesta de la organización'],
                    ['comentario_accion',      'Comentario'],
                  ] as [keyof AudAcVersion, string][]).map(([campo, etiqueta]) => {
                    const val = v[campo] as string | null
                    if (!val) return null
                    return (
                      <div key={campo}>
                        <p className="text-[10px] font-medium" style={{ color: 'var(--muted-foreground)' }}>{etiqueta}</p>
                        <p className="text-xs" style={{ color: 'var(--foreground)' }}>{val}</p>
                      </div>
                    )
                  })}
                </div>
              ))
            )}
          </div>
        </div>
      </BottomSheet>

      {/* Sheet: Incidencias M13 como antecedentes del hallazgo */}
      <BottomSheet open={!!sheetIncidenciasHallazgo} onClose={() => setSheetIncidenciasHallazgo(null)} height="85%">
        <div className="flex flex-col h-full">
          <div className="flex items-center justify-between px-4 py-4 border-b border-border flex-shrink-0">
            <div className="min-w-0 flex-1">
              <h2 className="text-sm font-semibold" style={{ color: 'var(--foreground)' }}>Antecedentes — Incidencias M13</h2>
              {sheetIncidenciasHallazgo && (
                <p className="text-[10px] mt-0.5 line-clamp-1" style={{ color: 'var(--muted-foreground)' }}>
                  {sheetIncidenciasHallazgo.descripcion}
                </p>
              )}
            </div>
            <button onClick={() => setSheetIncidenciasHallazgo(null)} className="text-muted-foreground ml-2 flex-shrink-0">
              <XCircle size={20} />
            </button>
          </div>

          <div className="flex-1 overflow-y-auto px-4 py-4 flex flex-col gap-4">
            {/* Incidencias vinculadas */}
            <div className="flex flex-col gap-2">
              <p className="text-[11px] font-semibold uppercase tracking-wide" style={{ color: 'var(--muted-foreground)' }}>
                Vinculadas ({incVinculadas.length})
              </p>
              {cargandoIncVinc ? (
                <div className="flex items-center gap-2 py-2">
                  <Loader size={13} className="animate-spin" style={{ color: 'var(--muted-foreground)' }} />
                  <span className="text-xs" style={{ color: 'var(--muted-foreground)' }}>Cargando…</span>
                </div>
              ) : incVinculadas.length === 0 ? (
                <p className="text-xs py-1" style={{ color: 'var(--muted-foreground)' }}>Sin antecedentes vinculados.</p>
              ) : (
                <div className="flex flex-col gap-2">
                  {incVinculadas.map(v => {
                    const fecha = v.m13_reportes?.fecha ?? null
                    const desc = v.m13_incidencias?.descripcion ?? '—'
                    return (
                      <div
                        key={v.id}
                        className="rounded-xl p-3 flex flex-col gap-1.5"
                        style={{ border: '1px solid var(--border)', backgroundColor: 'var(--card)' }}
                      >
                        <div className="flex items-center gap-2 flex-wrap">
                          <span
                            className="text-[9px] font-bold px-1.5 py-0.5 rounded-full uppercase tracking-wide"
                            style={{ backgroundColor: 'var(--agro-success-fill)', color: 'var(--agro-success-text)' }}
                          >
                            {v.relation_type === 'ANTECEDENTE' ? 'Antecedente' : 'Evidencia'}
                          </span>
                          {fecha && (
                            <span className="text-[10px]" style={{ color: 'var(--muted-foreground)' }}>
                              {new Date(fecha + 'T12:00:00').toLocaleDateString('es-MX', { day: '2-digit', month: 'short', year: 'numeric' })}
                            </span>
                          )}
                        </div>
                        <p className="text-[0.8125rem] leading-snug" style={{ color: 'var(--foreground)' }}>{desc}</p>
                        <div className="flex items-center gap-2 mt-0.5">
                          <a
                            href="/inocuidad/incidencias"
                            target="_blank"
                            rel="noopener noreferrer"
                            className="flex items-center gap-1 text-[10px] h-6 px-2 rounded"
                            style={{ color: 'var(--primary)', border: '1px solid var(--border)', backgroundColor: 'var(--card)' }}
                          >
                            <AlertTriangle size={10} />
                            Ver en M13
                          </a>
                          <button
                            onClick={() => handleQuitarIncidencia(v.id)}
                            disabled={incQuitandoId === v.id}
                            className="flex items-center gap-1 text-[10px] h-6 px-2 rounded disabled:opacity-50 ml-auto"
                            style={{ color: 'var(--agro-danger-text)' }}
                          >
                            {incQuitandoId === v.id
                              ? <Loader size={10} className="animate-spin" />
                              : <XCircle size={10} />
                            }
                            Quitar
                          </button>
                        </div>
                      </div>
                    )
                  })}
                </div>
              )}
            </div>

            {/* Buscador de incidencias */}
            <div className="flex flex-col gap-3 rounded-xl p-3" style={{ backgroundColor: 'var(--muted)' }}>
              <p className="text-[11px] font-semibold uppercase tracking-wide" style={{ color: 'var(--muted-foreground)' }}>
                Buscar incidencia existente
              </p>

              <div className="flex gap-2">
                <div className="flex flex-col gap-1 flex-1">
                  <label className="text-[11px] font-medium" style={{ color: 'var(--muted-foreground)' }}>Desde</label>
                  <input
                    type="date"
                    value={incDesde}
                    onChange={e => setIncDesde(e.target.value)}
                    className="h-9 rounded-lg px-2 text-xs outline-none"
                    style={{ border: '1px solid var(--border)', backgroundColor: 'var(--card)', color: 'var(--foreground)' }}
                  />
                </div>
                <div className="flex flex-col gap-1 flex-1">
                  <label className="text-[11px] font-medium" style={{ color: 'var(--muted-foreground)' }}>Hasta</label>
                  <input
                    type="date"
                    value={incHasta}
                    onChange={e => setIncHasta(e.target.value)}
                    className="h-9 rounded-lg px-2 text-xs outline-none"
                    style={{ border: '1px solid var(--border)', backgroundColor: 'var(--card)', color: 'var(--foreground)' }}
                  />
                </div>
              </div>

              <div className="flex gap-2">
                <input
                  type="text"
                  value={incSearch}
                  onChange={e => setIncSearch(e.target.value)}
                  onKeyDown={e => { if (e.key === 'Enter') handleBuscarIncidencias() }}
                  placeholder="Buscar por descripción…"
                  className="h-9 rounded-lg px-3 text-xs outline-none flex-1"
                  style={{ border: '1px solid var(--border)', backgroundColor: 'var(--card)', color: 'var(--foreground)' }}
                />
                <button
                  onClick={handleBuscarIncidencias}
                  disabled={incBuscando}
                  className="h-9 px-3 rounded-lg text-[11px] font-semibold flex items-center gap-1 disabled:opacity-50 flex-shrink-0"
                  style={{ backgroundColor: 'var(--primary)', color: '#fff' }}
                >
                  {incBuscando ? <Loader size={12} className="animate-spin" /> : 'Buscar'}
                </button>
              </div>

              {incBuscando ? (
                <div className="flex items-center gap-2 py-1">
                  <Loader size={12} className="animate-spin" style={{ color: 'var(--muted-foreground)' }} />
                  <span className="text-[11px]" style={{ color: 'var(--muted-foreground)' }}>Buscando incidencias…</span>
                </div>
              ) : incResultados.length === 0 ? (
                <p className="text-[11px] text-center py-1" style={{ color: 'var(--muted-foreground)' }}>
                  Usa los filtros y presiona Buscar.
                </p>
              ) : (
                <div className="flex flex-col gap-2 max-h-64 overflow-y-auto">
                  {incResultados.map(inc => (
                    <div
                      key={inc.incidencia_id}
                      className="rounded-lg p-3 flex flex-col gap-1.5"
                      style={{ backgroundColor: 'var(--card)', border: '1px solid var(--border)' }}
                    >
                      <div className="flex items-center gap-2 flex-wrap">
                        <span
                          className="text-[9px] font-bold px-1.5 py-0.5 rounded-full uppercase tracking-wide"
                          style={{ backgroundColor: 'var(--muted)', color: 'var(--muted-foreground)' }}
                        >
                          M13
                        </span>
                        <span className="text-[10px]" style={{ color: 'var(--muted-foreground)' }}>
                          {new Date(inc.fecha + 'T12:00:00').toLocaleDateString('es-MX', { day: '2-digit', month: 'short', year: 'numeric' })}
                        </span>
                      </div>
                      <p className="text-[11px] leading-snug" style={{ color: 'var(--foreground)' }}>{inc.descripcion}</p>
                      <button
                        onClick={() => handleRelacionarIncidencia(inc)}
                        disabled={!!incRelacionandoId}
                        className="self-end flex items-center gap-1 text-[10px] font-semibold h-6 px-2 rounded disabled:opacity-50"
                        style={{ backgroundColor: 'var(--primary)', color: '#fff' }}
                      >
                        {incRelacionandoId === inc.incidencia_id
                          ? <Loader size={10} className="animate-spin" />
                          : <Link2 size={10} />
                        }
                        Relacionar
                      </button>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>
        </div>
      </BottomSheet>

      {/* Sheet: Evidencias del hallazgo */}
      <BottomSheet open={!!sheetEvidenciaHallazgo} onClose={() => setSheetEvidenciaHallazgo(null)} height="85%">
        <div className="flex flex-col h-full">
          <div className="flex items-center justify-between px-4 py-4 border-b border-border flex-shrink-0">
            <div className="min-w-0 flex-1">
              <h2 className="text-sm font-semibold" style={{ color: 'var(--foreground)' }}>Evidencias del hallazgo</h2>
              {sheetEvidenciaHallazgo && (
                <p className="text-[10px] mt-0.5 line-clamp-1" style={{ color: 'var(--muted-foreground)' }}>
                  {sheetEvidenciaHallazgo.descripcion}
                </p>
              )}
            </div>
            <button onClick={() => setSheetEvidenciaHallazgo(null)} className="text-muted-foreground ml-2 flex-shrink-0">
              <XCircle size={20} />
            </button>
          </div>
          <div className="flex-1 overflow-y-auto px-4 py-4">
            {sheetEvidenciaHallazgo && auditoria && (
              <EvidenciaPanel
                entityType="HALLAZGO"
                entityId={sheetEvidenciaHallazgo.hallazgoId}
                orgId={auditoria.org_id}
                auditoriaId={auditoria.id}
                cerrada={!!cerrada}
                hallazgoId={sheetEvidenciaHallazgo.hallazgoId}
                preguntaId={sheetEvidenciaHallazgo.preguntaId}
                criterionCode={sheetEvidenciaHallazgo.criterionCode}
                ranchoId={auditoria.rancho_id ?? null}
              />
            )}
          </div>
        </div>
      </BottomSheet>
    </div>
  )
}
