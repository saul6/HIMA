import { useState, useEffect, useMemo, useRef, useCallback, useId, type ReactNode } from 'react'
import { useParams, useNavigate, useLocation, Navigate } from 'react-router'
import { guardarLastWorkspace } from '@/hooks/useContinuarTrabajo'
import { ahora, ms, segundos, emitirEvento, consumeResumeMetrics } from '@/lib/telemetria'
import { useMisPermisos } from '@/hooks/useMisPermisos'
import {
  AlertTriangle, CheckCircle, Loader,
  XCircle, AlertCircle, ChevronDown, ChevronUp, Download, ShieldCheck,
  Flag, Plus, History, ClipboardList, Copy, Paperclip, Link2,
  BarChart2, AlertOctagon, Pencil, X,
} from 'lucide-react'
import { toast } from 'sonner'
import { useAuthContext } from '@/context/AuthContext'
import { useAuditorAuditoria } from '@/hooks/useAuditorAuditoria'
import type { AudPregunta, AudRespuesta, AudHallazgo, AudHallazgoClasificacion, AudHallazgoEstado, AudAccionCorrectivaCAPA, AudAcVersion, AudInternalStatus, AudExternalStatus, AudExternalWorkflow, AudExternalObservedStatus } from '@/types/database.types'
import { generarAuditorReportePDF } from '@/lib/pdf/auditor/generarAuditorReportePDF'
import { supabase } from '@/lib/supabase'
import { useHallazgos } from '@/hooks/useHallazgos'
import { BottomSheet } from '@/app/components/BottomSheet'
import { EvidenciaPanel } from './EvidenciaPanel'
import { TextoRecortable } from './TextoRecortable'
import { useReglasRama } from '@/hooks/useReglasRama'
import { CapturaPreguntaAuditoria } from './CapturaPreguntaAuditoria'
import type { CapturaPreguntaRef, AjusteInfo } from './CapturaPreguntaAuditoria'
import { traducirErrorBd } from '@/lib/erroresBd'
import { Boton } from '@/app/components/ui-mady/Boton'
import { useConfirmar } from '@/app/components/ui-mady/ConfirmarSheet'
import { Etiqueta, type TonoEtiqueta } from '@/app/components/ui-mady/Etiqueta'
import { EstadoVacio } from '@/app/components/ui-mady/EstadoVacio'
import { estadoAuditoria, estadoHallazgo } from './estados'
import { ModuloHeader } from '@/app/components/ModuloHeader'
import { Skeleton } from '@/app/components/ui/skeleton'
import { motion, AnimatePresence, useReducedMotion } from 'motion/react'
import { useEntradaPantalla, useFundidoPlegable, avisoMotion, comportamientoScroll, resaltarDestino } from './motionAuditor'
import { FormularioSkeleton } from '@/app/components/FormularioSkeleton'
import { useMostrarCarga } from '@/hooks/useMostrarCarga'
import { TituloSeccion } from '@/app/components/ui-mady/TituloSeccion'
import { fechaCorta, fechaHora, formatoPct } from '@/lib/formato'
import { Campo } from '@/app/components/ui-mady/Campo'
import { NavegadorAgrupado, estadoDestino } from './NavegadorPreguntas'
import type { ModuloNavegador } from './NavegadorPreguntas'

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
    na_por_rama?: number
    revision_pendiente?: number
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
  REQUIRED: { label: 'Requerido',  bg: 'var(--agro-info-fill)', color: 'var(--agro-info-text)' },
  WARNING:  { label: 'Aviso',      bg: 'var(--agro-info-fill)', color: 'var(--agro-info-text)' },
  INFO:     { label: 'Info',       bg: 'var(--agro-success-fill)', color: 'var(--agro-success-text)' },
}

const CLASIFICACION_CONFIG: Record<AudHallazgoClasificacion, { label: string; tono: TonoEtiqueta }> = {
  menor:       { label: 'Menor',       tono: 'sky'     },
  mayor:       { label: 'Mayor',       tono: 'error'   },
  critico:     { label: 'Crítico',     tono: 'rojo'    },
  observacion: { label: 'Observación', tono: 'neutral' },
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

const HALL_ESTADOS: AudHallazgoEstado[] = ['OPEN', 'PLAN_ACCEPTED', 'IMPLEMENTED', 'EFFECTIVENESS_PENDING', 'CLOSED', 'REOPENED']

const SEV_TONO: Record<Severidad, TonoEtiqueta> = {
  BLOCKER: 'error',
  REQUIRED: 'sky',
  WARNING: 'sky',
  INFO: 'menta',
}

// ── Tarjeta de pregunta (eliminada — ahora usa CapturaPreguntaAuditoria) ─────

// ── Plegables: chevron que rota y salto a pregunta ───────────────────────────

/** Chevron de los encabezados plegables: solo `transform`, con la duración rápida del tema. */
function ChevronPlegable({ abierto }: { abierto: boolean }) {
  return (
    <ChevronDown
      size={14}
      aria-hidden="true"
      className={`flex-shrink-0 transition-transform duration-[var(--motion-fast)] ease-[var(--ease-out)] motion-reduce:transition-none${abierto ? ' rotate-180' : ''}`}
      style={{ color: 'var(--muted-foreground)' }}
    />
  )
}

/** Lleva a una pregunta; si su bloque está plegado, lo despliega antes del scroll. */
function irAPregunta(pregId: string) {
  const el = document.getElementById(`preg-${pregId}`)
  if (!el) return
  const bloque = el.closest<HTMLElement>('[data-bloque-plegado="true"]')
  if (bloque) {
    bloque.dispatchEvent(new CustomEvent('desplegar-bloque'))
    requestAnimationFrame(() => requestAnimationFrame(() => {
      el.scrollIntoView({ behavior: comportamientoScroll(), block: 'center' })
      resaltarDestino(el)
    }))
    return
  }
  el.scrollIntoView({ behavior: comportamientoScroll(), block: 'center' })
  resaltarDestino(el)
}

/** Bloque de preguntas plegable. Plegar oculta (`hidden`), no desmonta: las capturas conservan su borrador y su guardado. */
function BloqueAuditoria({
  codigo, nombre, total, respondidas, children,
}: {
  codigo: string
  nombre: string
  total: number
  respondidas: number
  children: ReactNode
}) {
  const id = useId()
  const [abierto, setAbierto] = useState(true)
  const fundido = useFundidoPlegable(abierto)
  const ref = useRef<HTMLElement>(null)

  useEffect(() => {
    const el = ref.current
    if (!el) return
    const desplegar = () => setAbierto(true)
    el.addEventListener('desplegar-bloque', desplegar)
    return () => el.removeEventListener('desplegar-bloque', desplegar)
  }, [])

  return (
    <section ref={ref} data-bloque-plegado={!abierto} className="mb-3">
      <button
        type="button"
        onClick={() => setAbierto(v => !v)}
        aria-expanded={abierto}
        aria-controls={id}
        className="w-full min-h-11 px-3 py-2 rounded-lg bg-muted flex items-center gap-2 text-left outline-none focus-visible:ring-[3px] focus-visible:ring-ring/50"
      >
        <span
          className="text-caption font-mono px-1.5 py-0.5 rounded flex-shrink-0 bg-border text-muted-foreground"
        >
          {codigo}
        </span>
        <span className="flex-1 min-w-0">
          <span className="block text-xs font-semibold text-foreground">{nombre}</span>
          <span className="block text-caption text-muted-foreground">
            {total} {total === 1 ? 'pregunta' : 'preguntas'} · {respondidas} de {total} respondidas
          </span>
        </span>
        <ChevronPlegable abierto={abierto} />
      </button>
      <motion.div id={id} hidden={!abierto} {...fundido}>
        <div className="flex flex-col gap-2 mt-2">{children}</div>
      </motion.div>
    </section>
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
    TOTAL_COMPLIANCE_REACHED:     { label: 'Total alcanzado', bg: 'var(--agro-success-fill)', color: 'var(--agro-success-text)', icon: <CheckCircle aria-hidden="true" size={12} /> },
    TOTAL_COMPLIANCE_NOT_REACHED: { label: 'No alcanzado',   bg: 'var(--agro-danger-fill)',  color: 'var(--agro-danger-text)',  icon: <AlertCircle aria-hidden="true" size={12} /> },
    PENDING_REVIEW:               { label: 'Pendiente',      bg: 'var(--agro-info-fill)', color: 'var(--agro-info-text)', icon: <AlertCircle aria-hidden="true" size={12} /> },
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
        <p className="text-caption" style={{ color: 'var(--muted-foreground)' }}>
          Complemento cualitativo · no afecta el puntaje numérico
        </p>
      </div>
      <div className="flex items-center gap-2 flex-shrink-0">
        {cargando && <Loader aria-hidden="true" size={12} className="animate-spin motion-reduce:animate-none" style={{ color: 'var(--muted-foreground)' }} />}
        <span className="text-xs font-bold" style={{ color: 'var(--muted-foreground)' }}>
          {calculo.resueltas}/{calculo.total}
        </span>
        <span
          className="flex items-center gap-1 text-small font-semibold px-2 py-1 rounded-lg"
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
  reviewLoadError,
  onReintentar,
  descartandoId,
  motivoDescarte,
  onDescartarClick,
  onCancelarDescarte,
  onConfirmarDescarte,
  onMotivoChange,
}: {
  issues: ReviewIssue[]
  validando: boolean
  reviewLoadError: boolean
  onReintentar: () => void
  descartandoId: string | null
  motivoDescarte: string
  onDescartarClick: (id: string) => void
  onCancelarDescarte: () => void
  onConfirmarDescarte: () => void
  onMotivoChange: (v: string) => void
}) {
  const idCuerpo = useId()
  const [herenciaCursorIdx, setHerenciaCursorIdx] = useState(0)
  const tieneBlockers = !reviewLoadError && issues.some(i => i.severidad === 'BLOCKER')
  // Plegado con su resumen de una línea; con bloqueantes abiertos (o si la revisión falló) empieza desplegado.
  const [abierto, setAbierto] = useState(tieneBlockers || reviewLoadError)
  const fundido = useFundidoPlegable(abierto)
  useEffect(() => {
    if (tieneBlockers || reviewLoadError) setAbierto(true)
  }, [tieneBlockers, reviewLoadError])

  const herenciaIssues = issues.filter(i =>
    i.estado === 'OPEN' &&
    (i.codigo === 'HERENCIA_SIN_CONFIRMAR' || i.codigo === 'HERENCIA_CONFLICTO' || i.codigo === 'HERENCIA_REVALIDAR')
  )

  function scrollToPreg(pregId: string) {
    irAPregunta(pregId)
  }

  function navSiguienteHerencia() {
    if (!herenciaIssues.length) return
    const idx = herenciaCursorIdx % herenciaIssues.length
    const issue = herenciaIssues[idx]
    if (issue.pregunta_id) scrollToPreg(issue.pregunta_id)
    setHerenciaCursorIdx(idx + 1)
  }

  return (
    <div id="panel-validacion"
      className="rounded-xl border overflow-hidden"
      style={{
        backgroundColor: reviewLoadError ? 'var(--agro-danger-fill)' : tieneBlockers ? 'var(--agro-danger-fill)' : 'var(--card)',
        borderColor: reviewLoadError ? 'var(--agro-red)' : tieneBlockers ? 'var(--agro-red)' : 'var(--border)',
        borderWidth: (reviewLoadError || tieneBlockers) ? '1.5px' : '1px',
      }}
    >
      {/* Header colapsable */}
      <button
        type="button"
        onClick={() => setAbierto(v => !v)}
        aria-expanded={abierto}
        aria-controls={idCuerpo}
        className="w-full min-h-11 flex items-center justify-between gap-2 px-4 py-3 text-left focus-visible:outline-offset-[-2px]"
      >
        <div className="flex items-center gap-2 min-w-0 flex-wrap">
          {validando ? (
            <Loader aria-hidden="true" size={14} className="animate-spin flex-shrink-0 motion-reduce:animate-none" style={{ color: 'var(--muted-foreground)' }} />
          ) : reviewLoadError ? (
            <XCircle aria-hidden="true" size={15} className="flex-shrink-0" style={{ color: 'var(--agro-danger-text)' }} />
          ) : (
            <ShieldCheck aria-hidden="true"
              size={15}
              className="flex-shrink-0"
              style={{ color: tieneBlockers ? 'var(--agro-danger-text)' : issues.length === 0 ? 'var(--agro-success-text)' : 'var(--agro-info-text)' }}
            />
          )}
          <span
            className="text-xs font-semibold"
            style={{ color: (reviewLoadError || tieneBlockers) ? 'var(--agro-danger-text)' : 'var(--foreground)' }}
          >
            {validando
              ? 'Analizando respuestas…'
              : reviewLoadError
                ? 'No se pudo comprobar la revisión'
                : issues.length === 0
                  ? 'Sin observaciones de validación'
                  : `${issues.length} observación${issues.length !== 1 ? 'es' : ''} encontrada${issues.length !== 1 ? 's' : ''}`
            }
          </span>
          {!validando && !reviewLoadError && issues.length > 0 && (
            <div className="flex gap-1">
              {SEV_ORDER.map(sev => {
                const count = issues.filter(i => i.severidad === sev).length
                if (!count) return null
                const cfg = SEV_CONFIG[sev]
                return (
                  <Etiqueta key={sev} tono={SEV_TONO[sev]} className="font-bold">
                    {count} {cfg.label.slice(0, 3)}
                  </Etiqueta>
                )
              })}
            </div>
          )}
        </div>
        <ChevronPlegable abierto={abierto} />
      </button>

      {/* Cuerpo: plegar solo lo oculta */}
      <motion.div id={idCuerpo} hidden={!abierto} {...fundido}>
        <div className="border-t border-border">
          {validando ? (
            <div className="flex items-center justify-center gap-2 py-6">
              <Loader aria-hidden="true" size={14} className="animate-spin motion-reduce:animate-none" style={{ color: 'var(--muted-foreground)' }} />
              <span className="text-xs" style={{ color: 'var(--muted-foreground)' }}>Analizando respuestas…</span>
            </div>
          ) : reviewLoadError ? (
            <div role="alert" className="flex flex-col items-start gap-3 px-4 py-4">
              <div className="flex items-center gap-2">
                <XCircle aria-hidden="true" size={15} style={{ color: 'var(--agro-danger-text)' }} />
                <span className="text-xs" style={{ color: 'var(--agro-danger-text)' }}>
                  No se pudo verificar las validaciones. Reintenta antes de continuar.
                </span>
              </div>
              <Boton variante="secundario" onClick={onReintentar}>
                Reintentar
              </Boton>
            </div>
          ) : issues.length === 0 ? (
            <div className="flex items-center gap-2 px-4 py-4">
              <CheckCircle aria-hidden="true" size={15} style={{ color: 'var(--agro-success-text)' }} />
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
                      <span className="text-caption font-semibold" style={{ color: cfg.color }}>
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
                            <Boton variante="secundario" onClick={() => scrollToPreg(issue.pregunta_id!)}>
                              → Ir a pregunta
                            </Boton>
                          )}
                          {descartandoId !== issue.id && (
                            <Boton variante="secundario" onClick={() => onDescartarClick(issue.id)}>
                              Descartar
                            </Boton>
                          )}
                        </div>
                        {descartandoId === issue.id && (
                          <div className="flex flex-col gap-1.5 mt-0.5">
                            <input
                              aria-label="Motivo del descarte (opcional)"
                              type="text"
                              value={motivoDescarte}
                              onChange={e => onMotivoChange(e.target.value)}
                              placeholder="Motivo del descarte (opcional)"
                              autoFocus
                              className="text-xs"
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
                              <Boton variante="secundario" onClick={onConfirmarDescarte} className="flex-1">
                                Confirmar descarte
                              </Boton>
                              <Boton variante="secundario" onClick={onCancelarDescarte}>
                                Cancelar
                              </Boton>
                            </div>
                          </div>
                        )}
                      </div>
                    ))}
                  </div>
                )
              })}
              {herenciaIssues.length > 0 && (
                <div className="px-4 py-3 border-t border-border flex items-center justify-between gap-2">
                  <span className="text-caption" style={{ color: 'var(--muted-foreground)' }}>
                    {herenciaIssues.length} herencia{herenciaIssues.length !== 1 ? 's' : ''} pendiente{herenciaIssues.length !== 1 ? 's' : ''}
                  </span>
                  <Boton variante="secundario" onClick={navSiguienteHerencia}>
                    Siguiente pendiente →
                  </Boton>
                </div>
              )}
            </div>
          )}
        </div>
      </motion.div>
    </div>
  )
}

// ── Panel de scoring en vivo (F8) ────────────────────────────────────────────

// COR-08: estado tipado para el scoring
type ScoringEstado = 'cargando' | 'vigente' | 'desactualizado' | 'error'

function PanelScoring({
  auditoriaId,
  version,
}: {
  auditoriaId: string | undefined
  version: number
}) {
  const [calculo, setCalculo]  = useState<CalculoPuntaje | null>(null)
  const [scoringEstado, setScoringEstado] = useState<ScoringEstado>('cargando')
  const idCuerpo = useId()
  const [abierto, setAbierto]  = useState(false)
  const fundido = useFundidoPlegable(abierto)
  const ultimaVersionRef = useRef<number>(0)
  // Versión interna para reintentar sin incrementar la externa
  const [reintento, setReintento] = useState(0)

  useEffect(() => {
    if (!auditoriaId) return
    // COR-08: marcar desactualizado si ya había datos
    if (calculo !== null) {
      setScoringEstado('desactualizado')
    }
    const versionActual = version + reintento
    ultimaVersionRef.current = versionActual
    let cancelado = false
    ;(async () => {
      try {
        const { data, error } = await supabase.rpc('aud_calcular_puntaje', { p_auditoria_id: auditoriaId })
        if (cancelado) return
        if (ultimaVersionRef.current !== versionActual) return  // respuesta vieja, ignorar
        if (error) {
          console.error('[PanelScoring] aud_calcular_puntaje', error)
          setScoringEstado('error')
          return
        }
        setCalculo(data as CalculoPuntaje)
        setScoringEstado('vigente')
      } catch (e) {
        if (!cancelado) {
          console.error('[PanelScoring] aud_calcular_puntaje', e)
          setScoringEstado('error')
        }
      }
    })()
    return () => { cancelado = true }
  }, [auditoriaId, version, reintento]) // eslint-disable-line react-hooks/exhaustive-deps

  const cargando = scoringEstado === 'cargando' || scoringEstado === 'desactualizado'
  const estado = calculo?.estado
  const fallaActiva = calculo?.falla_automatica_activa ?? false

  function tituloPrincipal(): string {
    if (scoringEstado === 'cargando' && !calculo) return 'Calculando…'
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
        type="button"
        onClick={() => setAbierto(v => !v)}
        aria-expanded={abierto}
        aria-controls={idCuerpo}
        className="w-full min-h-11 flex items-center justify-between gap-2 px-4 py-3 text-left focus-visible:outline-offset-[-2px]"
      >
        <div className="flex items-center gap-2 min-w-0 flex-1">
          <BarChart2 aria-hidden="true"
            size={15}
            className="flex-shrink-0"
            style={{ color: fallaActiva ? 'var(--agro-danger-text)' : 'var(--muted-foreground)' }}
          />
          <span className="text-xs font-semibold flex-1 min-w-0" style={{ color: fallaActiva ? 'var(--agro-danger-text)' : 'var(--foreground)' }}>
            {tituloPrincipal()}
          </span>
          {/* COR-08: indicadores de estado en el header */}
          {scoringEstado === 'cargando' && (
            <Loader aria-hidden="true" size={12} className="animate-spin flex-shrink-0 motion-reduce:animate-none" style={{ color: 'var(--muted-foreground)' }} />
          )}
          {scoringEstado === 'desactualizado' && (
            <span className="flex items-center gap-1 text-caption flex-shrink-0" style={{ color: 'var(--muted-foreground)' }}>
              <Loader aria-hidden="true" size={10} className="animate-spin motion-reduce:animate-none" /> Actualizando…
            </span>
          )}
          {scoringEstado === 'error' && calculo && (
            <span className="text-small flex-shrink-0" style={{ color: 'var(--agro-info-text)' }}>
              Cálculo anterior (no actualizado)
            </span>
          )}
          {scoringEstado === 'error' && !calculo && (
            <span className="text-small flex-shrink-0" style={{ color: 'var(--agro-danger-text)' }}>
              No se pudo calcular
            </span>
          )}
        </div>
        <ChevronPlegable abierto={abierto} />
      </button>

      <motion.div id={idCuerpo} hidden={!abierto} {...fundido}>
        <div className="border-t border-border px-4 pb-4 flex flex-col gap-3">
          {/* Etiqueta invariante */}
          <p className="text-caption pt-3 italic" style={{ color: 'var(--muted-foreground)' }}>
            Cálculo interno M.A.D.Y. · no oficial — el puntaje definitivo lo emite el organismo certificador.
          </p>

          {/* Falla automática activa */}
          {fallaActiva && calculo && (
            <div
              className="flex items-start gap-2 rounded-lg px-3 py-2"
              style={{ backgroundColor: 'var(--agro-danger-fill)', border: '1px solid var(--agro-red)' }}
            >
              <AlertOctagon aria-hidden="true" size={14} className="flex-shrink-0 mt-0.5" style={{ color: 'var(--agro-danger-text)' }} />
              <div className="flex flex-col gap-0.5">
                <p className="text-small font-bold" style={{ color: 'var(--agro-danger-text)' }}>
                  Fallo automático detectado · módulo afectado 0% efectivo
                </p>
                <p className="text-small" style={{ color: 'var(--agro-danger-text)' }}>
                  Resultado aritmético bruto: {calculo.resultado_bruto}% (antes de aplicar el cero)
                </p>
              </div>
            </div>
          )}

          {calculo && estado === 'BLOCKED_MISSING_MAX' && (
            <>
              <div className="rounded-lg px-3 py-2" style={{ backgroundColor: 'var(--muted)' }}>
                <p className="text-small font-medium" style={{ color: 'var(--foreground)' }}>
                  Puntuación integral no disponible — faltan máximos verificados
                </p>
                <p className="text-caption mt-0.5" style={{ color: 'var(--muted-foreground)' }}>
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
                    <p className="text-caption" style={{ color: 'var(--muted-foreground)' }}>{lbl}</p>
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
                    <p className="text-caption" style={{ color: 'var(--muted-foreground)' }}>{lbl}</p>
                    <p className="text-sm font-bold" style={{ color: 'var(--foreground)' }}>{val}</p>
                  </div>
                ))}
              </div>
              <div className="rounded-lg px-3 py-2 flex flex-col gap-1" style={{ backgroundColor: 'var(--agro-success-fill)' }}>
                <p className="text-caption font-semibold" style={{ color: 'var(--agro-success-text)' }}>
                  Escenario si pendientes cumplen: {calculo.proyeccion_si_pendientes_cumplen}%
                </p>
                <p className="text-caption" style={{ color: 'var(--agro-success-text)' }}>
                  Cota inferior (todas fallan): {calculo.cota_inferior}%
                </p>
              </div>
              {((calculo.conteo.na_por_rama ?? 0) > 0 || (calculo.conteo.revision_pendiente ?? 0) > 0) && (
                <div className="grid grid-cols-2 gap-2">
                  {(calculo.conteo.na_por_rama ?? 0) > 0 && (
                    <div className="rounded-lg px-3 py-2" style={{ backgroundColor: 'var(--muted)' }}>
                      <p className="text-caption" style={{ color: 'var(--muted-foreground)' }}>N/A por rama</p>
                      <p className="text-sm font-bold" style={{ color: 'var(--foreground)' }}>{calculo.conteo.na_por_rama}</p>
                    </div>
                  )}
                  {(calculo.conteo.revision_pendiente ?? 0) > 0 && (
                    <div className="rounded-lg px-3 py-2" style={{ backgroundColor: 'var(--agro-info-fill)' }}>
                      <p className="text-small" style={{ color: 'var(--agro-info-text)' }}>Revisión pendiente</p>
                      <p className="text-sm font-bold" style={{ color: 'var(--agro-info-text)' }}>{calculo.conteo.revision_pendiente}</p>
                    </div>
                  )}
                </div>
              )}
            </>
          )}

          {calculo && estado === 'INTERNAL_COMPLETE' && (
            <div className="rounded-lg px-3 py-2" style={{ backgroundColor: 'var(--muted)' }}>
              <p className="text-small font-semibold" style={{ color: 'var(--foreground)' }}>
                Resultado aritmético interno: {calculo.resultado_bruto}%
              </p>
            </div>
          )}

          {calculo && estado === 'REQUIRES_VALIDATION' && (
            <>
              <div className="rounded-lg px-3 py-2 flex flex-col gap-1" style={{ backgroundColor: 'var(--agro-info-fill)', border: '1px solid var(--agro-menta)' }}>
                <p className="text-small font-bold" style={{ color: 'var(--agro-info-text)' }}>
                  Revisión de puntuación requerida
                </p>
                <p className="text-small" style={{ color: 'var(--agro-info-text)' }}>
                  Resultado normativo: {calculo.resultado_bruto}%
                  {(calculo.ajustes_en_conflicto ?? 0) > 0 && (
                    <span className="font-semibold"> · {calculo.ajustes_en_conflicto} ajuste{calculo.ajustes_en_conflicto !== 1 ? 's' : ''} en conflicto</span>
                  )}
                </p>
              </div>
            </>
          )}

          {calculo && estado === 'NO_SCORABLE_CRITERIA' && (
            <p className="text-caption" style={{ color: 'var(--muted-foreground)' }}>
              Sin puntuación aplicable
            </p>
          )}

          {/* Escenario de trabajo (no normativo) cuando hay ajustes manuales */}
          {calculo && (calculo.ajustes_manuales ?? 0) > 0 && calculo.escenario_trabajo && (
            <div className="rounded-lg px-3 py-2 flex flex-col gap-0.5" style={{ backgroundColor: 'var(--muted)', border: '1px dashed var(--border)' }}>
              <TituloSeccion as="p" variante="subtitulo" className="mb-0">
                Escenario de trabajo · no normativo
              </TituloSeccion>
              <p className="text-sm font-bold" style={{ color: 'var(--foreground)' }}>
                {calculo.escenario_trabajo.resultado}%
              </p>
              <p className="text-caption" style={{ color: 'var(--muted-foreground)' }}>
                {calculo.escenario_trabajo.etiqueta} · {calculo.ajustes_manuales} ajuste{calculo.ajustes_manuales !== 1 ? 's' : ''} manual{calculo.ajustes_manuales !== 1 ? 'es' : ''}
              </p>
            </div>
          )}

          {/* Fallas automáticas detalle */}
          {calculo && fallaActiva && (calculo.fallas?.length ?? 0) > 0 && (
            <div className="flex flex-col gap-1">
              <TituloSeccion as="p" variante="subtitulo" className="mb-0 text-agro-danger-text">
                Numerales con falla
              </TituloSeccion>
              {calculo.fallas!.map(f => (
                <div key={f.question_id} className="flex items-center gap-2">
                  <span className="text-caption font-mono px-1.5 py-0.5 rounded" style={{ backgroundColor: 'var(--agro-danger-fill)', color: 'var(--agro-danger-text)' }}>
                    {f.question_id}
                  </span>
                  <span className="text-caption" style={{ color: 'var(--muted-foreground)' }}>{f.modulo}</span>
                </div>
              ))}
            </div>
          )}

          {/* Desglose por módulo (IN_PROGRESS o INTERNAL_COMPLETE) */}
          {calculo && (estado === 'IN_PROGRESS' || estado === 'INTERNAL_COMPLETE') && calculo.por_modulo.length > 0 && (
            <div className="flex flex-col gap-1.5">
              <TituloSeccion as="p" variante="subtitulo" className="mb-0">
                Por módulo
              </TituloSeccion>
              {calculo.por_modulo.map(m => (
                <div key={m.modulo} className="rounded-lg px-3 py-2 flex flex-col gap-0.5" style={{ backgroundColor: 'var(--muted)' }}>
                  <div className="flex items-center justify-between gap-2">
                    <p className="text-small font-semibold truncate flex-1" style={{ color: 'var(--foreground)' }}>
                      {m.nombre || m.modulo}
                    </p>
                    {m.falla_automatica && (
                      <Etiqueta tono="error" className="font-bold">Falla</Etiqueta>
                    )}
                  </div>
                  <div className="flex gap-3 flex-wrap">
                    <span className="text-caption" style={{ color: 'var(--muted-foreground)' }}>
                      Bruto: <span className="font-semibold" style={{ color: 'var(--foreground)' }}>{formatoPct(m.resultado_bruto)}</span>
                    </span>
                    {m.falla_automatica && (
                      <span className="text-small" style={{ color: 'var(--agro-danger-text)' }}>
                        Efectivo: <span className="font-bold">0%</span>
                      </span>
                    )}
                    {!m.falla_automatica && m.resultado_efectivo !== m.resultado_bruto && (
                      <span className="text-caption" style={{ color: 'var(--muted-foreground)' }}>
                        Efectivo: <span className="font-semibold" style={{ color: 'var(--foreground)' }}>{formatoPct(m.resultado_efectivo)}</span>
                      </span>
                    )}
                    {m.proyeccion_si_cumplen > 0 && (
                      <span className="text-caption" style={{ color: 'var(--agro-success-text)' }}>
                        Proj.: {formatoPct(m.proyeccion_si_cumplen)}
                      </span>
                    )}
                  </div>
                </div>
              ))}
            </div>
          )}

          {/* COR-08: estado error con botón reintentar */}
          {scoringEstado === 'error' && !calculo && (
            <div role="alert" className="flex flex-col gap-2 pt-3">
              <p className="text-small" style={{ color: 'var(--agro-danger-text)' }}>
                No se pudo calcular el puntaje.
              </p>
              <Boton variante="secundario" onClick={() => setReintento(v => v + 1)} className="self-start">
                Reintentar
              </Boton>
            </div>
          )}
          {scoringEstado === 'error' && calculo && (
            <div className="flex flex-col gap-2 pt-3">
              <div role="status" className="flex items-center gap-2 rounded-lg px-3 py-2" style={{ backgroundColor: 'var(--agro-info-fill)' }}>
                <AlertCircle aria-hidden="true" size={13} style={{ color: 'var(--agro-info-text)' }} />
                <p className="text-small" style={{ color: 'var(--agro-info-text)' }}>
                  Mostrando cálculo anterior — no refleja los últimos cambios.
                </p>
              </div>
              <Boton variante="secundario" onClick={() => setReintento(v => v + 1)} className="self-start">
                Reintentar
              </Boton>
            </div>
          )}
          {!calculo && scoringEstado !== 'error' && !cargando && (
            <p className="text-caption" style={{ color: 'var(--muted-foreground)' }}>
              No se pudo obtener el cálculo. Recarga la pantalla.
            </p>
          )}
        </div>
      </motion.div>
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
  const idCuerpo = useId()
  const [abierto, setAbierto] = useState(true)
  const fundido = useFundidoPlegable(abierto)

  function scrollToPreg(pregId: string) {
    irAPregunta(pregId)
  }

  return (
    <div className="rounded-xl border border-border overflow-hidden" style={{ backgroundColor: 'var(--card)' }}>
      <button
        type="button"
        onClick={() => setAbierto(v => !v)}
        aria-expanded={abierto}
        aria-controls={idCuerpo}
        className="w-full min-h-11 flex items-center justify-between gap-2 px-4 py-3 text-left focus-visible:outline-offset-[-2px]"
      >
        <div className="flex items-center gap-2">
          <Flag aria-hidden="true" size={15} className="flex-shrink-0" style={{ color: hallazgos.length > 0 ? 'var(--agro-danger-text)' : 'var(--muted-foreground)' }} />
          <span className="text-xs font-semibold" style={{ color: 'var(--foreground)' }}>
            {cargando
              ? <Skeleton className="h-3.5 w-24 inline-block align-middle" />
              : `${hallazgos.length} hallazgo${hallazgos.length !== 1 ? 's' : ''}`}
          </span>
        </div>
        <ChevronPlegable abierto={abierto} />
      </button>

      <motion.div id={idCuerpo} hidden={!abierto} {...fundido}>
        <div className="border-t border-border">
          {hallazgos.length === 0 ? (
            cargando ? (
              <div className="px-4 py-4 flex flex-col gap-2" aria-busy="true" aria-label="Cargando hallazgos">
                <Skeleton className="h-3.5 w-3/4" />
                <Skeleton className="h-3.5 w-1/2" />
              </div>
            ) : (
              <EstadoVacio icono={Flag} titulo="Sin hallazgos registrados." />
            )
          ) : (
            <div className="flex flex-col divide-y" style={{ borderColor: 'var(--border)' }}>
              {hallazgos.map(h => {
                const clasConfig = CLASIFICACION_CONFIG[h.clasificacion]
                const estConfig = estadoHallazgo(h.estado)
                const preg = preguntas.find(p => p.id === h.pregunta_id)
                return (
                  <div key={h.id} className="px-4 py-3 flex flex-col gap-2">
                    <div className="flex items-start gap-2 flex-wrap">
                      <Etiqueta tono={clasConfig.tono} className={clasConfig.tono === 'rojo' ? 'font-bold dark:text-primary-foreground' : 'font-bold'}>{clasConfig.label}</Etiqueta>
                      <Etiqueta tono={estConfig.tono}>{estConfig.texto}</Etiqueta>
                    </div>
                    <TextoRecortable className="text-body leading-snug text-foreground">
                      {h.descripcion}
                    </TextoRecortable>
                    {preg && (
                      <button
                        onClick={() => scrollToPreg(preg.id)}
                        className="self-start text-caption font-medium px-2 py-0.5 rounded relative before:absolute before:content-[''] before:-inset-y-3 before:-inset-x-1"
                        style={{ backgroundColor: 'var(--muted)', color: 'var(--primary)' }}
                      >
                        → {preg.question_id}
                      </button>
                    )}
                    <div className="flex items-center gap-2 flex-wrap">
                      <select
                        aria-label="Estado del hallazgo"
                        value={h.estado}
                        onChange={e => onEstadoChange(h.id, e.target.value as AudHallazgoEstado)}
                        disabled={!canWriteNC}
                        className="text-small h-11 rounded-lg px-2 disabled:opacity-50"
                        style={{
                          border: '1px solid var(--border)',
                          backgroundColor: canWriteNC ? 'var(--input-background)' : 'var(--muted)',
                          color: 'var(--foreground)',
                        }}
                      >
                        {HALL_ESTADOS.map(est => (
                          <option key={est} value={est}>{estadoHallazgo(est).texto}</option>
                        ))}
                      </select>
                      {canWriteAC && (
                        <Boton variante="secundario" aria-haspopup="dialog" onClick={() => onVerAccion(h)}>
                          <ClipboardList aria-hidden="true" size={13} />
                          Acción correctiva
                        </Boton>
                      )}
                      <Boton variante="secundario" aria-haspopup="dialog" className="h-11" onClick={() => onVerEvidencias(h)}>
                        <Paperclip aria-hidden="true" size={13} />
                        Evidencias
                      </Boton>
                      <Boton variante="secundario" aria-haspopup="dialog" className="h-11" onClick={() => onVerIncidencias(h)}>
                        <Link2 aria-hidden="true" size={13} />
                        Antecedentes M13
                      </Boton>
                    </div>
                  </div>
                )
              })}
            </div>
          )}
        </div>
      </motion.div>
    </div>
  )
}

// ── Pantalla principal ────────────────────────────────────────────────────────

// Indicador global de guardado, en las acciones del header (no empuja el contenido).
// Guardando… → Guardado (1.5 s, se desvanece) → nada; el error se queda hasta que se resuelva.
// En celular solo el ícono (texto en sr-only); desde `sm` el texto. Sin motion: el header es sticky.
function IndicadorGuardado({ savingMap }: { savingMap: Record<string, SaveStatus> }) {
  const values = Object.values(savingMap)
  const hayGuardando = values.some(s => s === 'saving')
  const nError = values.filter(s => s === 'error').length
  const huboGuardandoRef = useRef(false)
  const [guardado, setGuardado] = useState<'oculto' | 'visible' | 'saliendo'>('oculto')

  useEffect(() => {
    if (hayGuardando) {
      huboGuardandoRef.current = true
      setGuardado('oculto')
      return
    }
    if (nError > 0 || !huboGuardandoRef.current) return
    huboGuardandoRef.current = false
    setGuardado('visible')
    const idSale = setTimeout(() => setGuardado('saliendo'), 1500)
    const idOculta = setTimeout(() => setGuardado('oculto'), 1800)
    return () => { clearTimeout(idSale); clearTimeout(idOculta) }
  }, [hayGuardando, nError])

  if (hayGuardando) {
    return (
      <Etiqueta role="status" title="Guardando…" icono={<Loader aria-hidden="true" size={11} className="animate-spin motion-reduce:animate-none" />}>
        <span className="sr-only sm:not-sr-only">Guardando…</span>
      </Etiqueta>
    )
  }
  if (nError > 0) {
    return (
      <Etiqueta role="alert" tono="error" title={`Error al guardar (${nError})`} icono={<XCircle aria-hidden="true" size={11} />}>
        <span className="sr-only sm:not-sr-only">Error al guardar </span>({nError})
      </Etiqueta>
    )
  }
  if (guardado !== 'oculto') {
    return (
      <Etiqueta
        role="status"
        tono="menta"
        title="Guardado"
        icono={<CheckCircle aria-hidden="true" size={11} />}
        className={`transition-opacity duration-[var(--motion-base)] ease-[var(--ease-out)] motion-reduce:transition-none${guardado === 'saliendo' ? ' opacity-0' : ''}`}
      >
        <span className="sr-only sm:not-sr-only">Guardado</span>
      </Etiqueta>
    )
  }
  return null
}

export function AuditorEjecucion() {
  const { auditoriaId } = useParams<{ auditoriaId: string }>()
  const navigate = useNavigate()
  const location = useLocation()
  const { profile } = useAuthContext()
  const { confirmar, confirmarElemento } = useConfirmar()

  const orgNombre: string       = (location.state as { orgNombre?: string }       | null)?.orgNombre       ?? ''
  const orgId: string | undefined  = (location.state as { orgId?: string }              | null)?.orgId
  const instalacionId: string | undefined  = (location.state as { instalacionId?: string }  | null)?.instalacionId
  const instalacionNombreNav: string = (location.state as { instalacionNombre?: string } | null)?.instalacionNombre ?? ''

  const hook = useAuditorAuditoria(auditoriaId)
  const {
    auditoria, modulosData, esquemaMap,
    respuestasMap, valoresMap, observacionesMap,
    instanciasMap,
    cargando, errorMsg,
    // COR-07
    esquemaCargaEstado, obsCargaEstado,
    herenciaMap, recargarHerencia,
    cambiarEstado, refetch,
  } = hook
  const mostrarSkeleton = useMostrarCarga(cargando, modulosData.length > 0)
  const ent = useEntradaPantalla(!cargando && !errorMsg)

  // Escritorio (xl+): el navegador y la columna de resumen quedan fijos bajo el header sticky.
  // Se publican como variables CSS en el contenedor: --alto-header (ModuloHeader, que no se edita) y
  // --alto-visible (lo que queda visible del área con scroll del Layout debajo del header).
  const raizRef = useRef<HTMLDivElement>(null)
  const columnasRef = useRef<HTMLElement>(null)
  const cargadaPantalla = !cargando && !errorMsg
  useEffect(() => {
    const columnas = columnasRef.current
    const header = raizRef.current?.querySelector<HTMLElement>(':scope > header')
    if (!columnas || !header) return
    let scroll: HTMLElement | null = null
    for (let el = columnas.parentElement; el; el = el.parentElement) {
      const o = getComputedStyle(el).overflowY
      if (o === 'auto' || o === 'scroll') { scroll = el; break }
    }
    const medir = () => {
      const alto = header.getBoundingClientRect().height
      const visible = (scroll?.clientHeight ?? window.innerHeight) - alto
      columnas.style.setProperty('--alto-header', `${alto}px`)
      columnas.style.setProperty('--alto-visible', `${visible}px`)
    }
    medir()
    const observer = new ResizeObserver(medir)
    observer.observe(header)
    if (scroll) observer.observe(scroll)
    return () => observer.disconnect()
  }, [cargadaPantalla])

  // Datos del navegador de escritorio: salen de lo que la pantalla ya tiene en memoria.
  const modulosNavegador = useMemo<ModuloNavegador[]>(() => modulosData.map(modulo => ({
    id: modulo.modulo_id,
    nombre: modulo.modulo_nombre,
    respondidas: modulo.preguntas.filter(p => respuestasMap.get(p.id)).length,
    total: modulo.preguntas.length,
    bloques: modulo.bloques
      .map(bloque => {
        const preguntas = modulo.preguntas.filter(p => p.bloque_id === bloque.id)
        return {
          id: bloque.id,
          codigo: bloque.codigo,
          nombre: bloque.nombre,
          respondidas: preguntas.filter(p => respuestasMap.get(p.id)).length,
          total: preguntas.length,
          items: preguntas.map(p => {
            const resp = respuestasMap.get(p.id) ?? null
            return {
              id: p.id,
              codigo: p.question_id,
              texto: p.texto,
              estado: estadoDestino(resp, false),
              pendiente: !resp,
            }
          }),
        }
      })
      .filter(b => b.total > 0),
  })), [modulosData, respuestasMap])

  const herenciaOriginSetRef = useRef<Set<string>>(new Set())
  const recargarHerenciaRef = useRef(recargarHerencia)

  useEffect(() => {
    const origins = new Set<string>()
    for (const h of herenciaMap.values()) {
      if (h.origen_pregunta_id) origins.add(h.origen_pregunta_id)
    }
    herenciaOriginSetRef.current = origins
  }, [herenciaMap])

  useEffect(() => {
    recargarHerenciaRef.current = recargarHerencia
  }, [recargarHerencia])

  const reglasHook = useReglasRama(auditoriaId)

  const [savingMap, setSavingMap] = useState<Record<string, SaveStatus>>({})
  const [cambiando, setCambiando] = useState(false)
  const [descargando, setDescargando] = useState(false)
  const [scoringVersion, setScoringVersion] = useState(0)

  const [reviewIssues, setReviewIssues] = useState<ReviewIssue[]>([])
  const [validando, setValidando] = useState(false)
  // COR-01: estado de error al cargar issues
  const [reviewLoadError, setReviewLoadError] = useState(false)
  const [panelValidacionVisible, setPanelValidacionVisible] = useState(false)
  const [descartandoId, setDescartandoId] = useState<string | null>(null)
  const [motivoDescarte, setMotivoDescarte] = useState('')

  // — Reincidencia e historial por criterio —
  const [reincidenciaMap, setReincidenciaMap] = useState<Map<string, ReincidenciaResult>>(new Map())
  const [historialCriterios, setHistorialCriterios] = useState<HistorialCriterio[]>([])
  const [panelAntecedentesAbierto, setPanelAntecedentesAbierto] = useState(false)
  const fundidoAntecedentes = useFundidoPlegable(panelAntecedentesAbierto)
  const reducedMotion = useReducedMotion()
  const loadedReincidenciaRef = useRef<Set<string>>(new Set())

  // — Hallazgos y CAPA —
  const hallazgosHook = useHallazgos(auditoriaId, auditoria?.org_id)
  const { hallazgos, cargar: cargarHallazgos, crearHallazgo, actualizarEstado: actualizarEstadoHallazgo, cargarAccion, crearAccion, actualizarAccion, cargarVersiones } = hallazgosHook

  useEffect(() => {
    if (auditoria?.id) cargarHallazgos()
  }, [auditoria?.id]) // eslint-disable-line react-hooks/exhaustive-deps

  useEffect(() => {
    if (auditoriaId) reglasHook.refrescar()
  }, [auditoriaId]) // eslint-disable-line react-hooks/exhaustive-deps

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


  const capturaRefsMap = useRef<Map<string, { current: CapturaPreguntaRef | null }>>(new Map())

  function getCapturaRef(pregId: string): { current: CapturaPreguntaRef | null } {
    if (!capturaRefsMap.current.has(pregId)) {
      capturaRefsMap.current.set(pregId, { current: null })
    }
    return capturaRefsMap.current.get(pregId)!
  }

  const flushPendientes = useCallback(async (): Promise<boolean> => {
    const promises: Promise<boolean>[] = []
    for (const ref of capturaRefsMap.current.values()) {
      if (ref.current) {
        promises.push(ref.current.flushPendientes())
      }
    }
    if (promises.length === 0) return false
    const results = await Promise.all(promises)
    return results.some(r => r)
  }, [])

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
    const bd = traducirErrorBd(msg)
    if (bd) return bd
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


  function handleAjusteActualizado(_pregId: string, _ajuste: AjusteInfo | null) {
    setScoringVersion(v => v + 1)
  }
  async function handleCambiarEstado(nuevoEstado: 'preliminar' | 'cerrada') {
    if (!auditoria?.id) return
    const accion = nuevoEstado === 'cerrada' ? 'cerrar' : 'marcar como preliminar'

    // COR-02: flush pendientes antes de validar/cerrar
    const hayErrores = await flushPendientes()
    if (hayErrores) {
      toast.error('Hay cambios sin guardar. Corrígelos antes de continuar.')
      return
    }

    // Validar primero — bloquear si hay BLOCKERs
    setValidando(true)
    setPanelValidacionVisible(true)
    setReviewLoadError(false)
    try {
      const { error: revErr } = await supabase.rpc('aud_run_review', { p_auditoria_id: auditoria.id })
      if (revErr) {
        console.error('[handleCambiarEstado] aud_run_review', revErr)
        setReviewLoadError(true)
        return
      }
      const result = await loadReviewIssues()
      if (!result.ok) {
        setReviewLoadError(true)
        return
      }
      setReviewIssues(result.issues)
      setReviewLoadError(false)
      const blockers = result.issues.filter(i => i.severidad === 'BLOCKER')
      if (blockers.length > 0) {
        toast.warning(`Resuelve ${blockers.length} bloqueo${blockers.length !== 1 ? 's' : ''} antes de ${accion}`)
        return
      }
    } finally {
      setValidando(false)
    }

    const confirmado = await confirmar(nuevoEstado === 'cerrada'
      ? {
          titulo: 'Cerrar auditoría',
          descripcion: 'Ya no podrás editar respuestas ni hallazgos. Descarga el reporte PDF si lo necesitas.',
          textoConfirmar: 'Cerrar auditoría',
          tono: 'peligro',
        }
      : {
          titulo: 'Marcar como preliminar',
          descripcion: '¿Marcar esta auditoría como preliminar?',
          textoConfirmar: 'Marcar como preliminar',
        })
    if (!confirmado) return
    setCambiando(true)
    try {
      await cambiarEstado(nuevoEstado)
      toast.success(`Auditoría ${accion === 'cerrar' ? 'cerrada' : 'marcada como preliminar'}`)
    } catch (e: unknown) {
      console.error('[handleCambiarEstado]', e)
      const errMsg = (e as { message?: string })?.message ?? ''
      if (errMsg.includes('CIERRE_BLOQUEADO')) {
        // Mostrar exactamente qué falta: correr la revisión, leer aud_review_issues y abrir el panel
        setPanelValidacionVisible(true)
        setValidando(true)
        try {
          await supabase.rpc('aud_run_review', { p_auditoria_id: auditoria.id })
          const result = await loadReviewIssues()
          if (result.ok) { setReviewIssues(result.issues); setReviewLoadError(false) }
          else setReviewLoadError(true)
        } finally {
          setValidando(false)
        }
        toast.error(errMsg.split(': ').slice(1).join(': ') || 'No se pudo cerrar la auditoría. Revisa el panel de validación.')
        setTimeout(() => document.getElementById('panel-validacion')?.scrollIntoView({ behavior: comportamientoScroll(), block: 'start' }), 150)
      } else if (errMsg.includes('AUDITORIA_CERRADA')) {
        toast.error(errMsg.split(': ').slice(1).join(': ') || 'La auditoría ya está cerrada.')
      } else {
        toast.error(`No se pudo ${accion}. Reintenta.`)
      }
    } finally {
      setCambiando(false)
    }
  }


  const allPreguntas = modulosData.flatMap(m => m.preguntas)

  const estadoAud = estadoAuditoria(auditoria?.estado)

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
    // COR-02: esperar guardados pendientes antes de generar el PDF (no bloquea si hay errores)
    await flushPendientes()
    setDescargando(true)
    try {
      await generarAuditorReportePDF({ auditoria })
    } catch (e: unknown) {
      console.error('[AuditorEjecucion] generarAuditorReportePDF:', e)
      toast.error('No se pudo generar el PDF. Reintenta.')
    } finally {
      setDescargando(false)
    }
  }

  // COR-01: retorna ok/error para que el llamador distinga "vacío" de "falló"
  async function loadReviewIssues(): Promise<{ ok: true; issues: ReviewIssue[] } | { ok: false }> {
    if (!auditoriaId) return { ok: false }
    const { data, error } = await supabase
      .from('aud_review_issues')
      .select('*')
      .eq('auditoria_id', auditoriaId)
      .eq('estado', 'OPEN')
      .order('severidad')
    if (error) {
      console.error('[loadReviewIssues]', error)
      return { ok: false }
    }
    return { ok: true, issues: (data ?? []) as ReviewIssue[] }
  }

  async function handleValidar() {
    if (!auditoria?.id) return
    setValidando(true)
    setReviewLoadError(false)
    setPanelValidacionVisible(true)
    try {
      const { error } = await supabase.rpc('aud_run_review', { p_auditoria_id: auditoria.id })
      if (error) {
        console.error('[handleValidar] aud_run_review', error)
        setReviewLoadError(true)
        return
      }
      const result = await loadReviewIssues()
      if (!result.ok) {
        setReviewLoadError(true)
        return
      }
      setReviewIssues(result.issues)
      setReviewLoadError(false)
      if (result.issues.length === 0) {
        toast.success('Sin observaciones — la auditoría pasó todas las validaciones')
      } else {
        const nBlock = result.issues.filter(i => i.severidad === 'BLOCKER').length
        if (nBlock > 0) {
          toast.warning(`${nBlock} bloqueo${nBlock !== 1 ? 's' : ''} encontrado${nBlock !== 1 ? 's' : ''}`)
        } else {
          toast.info(`${result.issues.length} observación${result.issues.length !== 1 ? 'es' : ''} de validación`)
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
      toast.error(/^Solo /.test((e as { message?: string })?.message ?? '') ? (e as { message: string }).message : 'No se pudo guardar la acción. Reintenta.')
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

  // haySavePending: computed from onEstadoGuardado callbacks feeding savingMap
  const haySavePending = Object.values(savingMap).some(s => s === 'saving')

  // COR-07: deshabilitar Validar/Cerrar si hay error de carga de esquema
  const hayErrorCargaEsquema = esquemaCargaEstado === 'error' || obsCargaEstado === 'error'

  // Barra de acciones al pie: sin auditoría cerrada, en todos los tamaños; cerrada, solo el PDF desde md.
  const hayBarra = !cargando && !errorMsg && allPreguntas.length > 0 && (!!auditoria || !cerrada)

  return (
    <div ref={raizRef} className={`flex flex-col min-h-screen bg-background ${!hayBarra ? 'pb-8' : cerrada ? 'pb-8 md:pb-0' : ''}`}>
      <ModuloHeader
        tituloFallback="Auditoría"
        forzarTitulo={auditoria ? (auditoria.modulos.map(m => m.nombre).join(' · ') || 'Auditoría') : undefined}
        subtitulo={auditoria
          ? (auditoria.instalacion_id
            ? `${auditoria.instalacion_nombre ?? 'Instalación'} · ${fechaCorta(auditoria.fecha)}`
            : `${auditoria.productor_nombre} · ${auditoria.rancho_nombre} · ${fechaCorta(auditoria.fecha)}`)
          : undefined}
        onBack={() => navigate(backTarget, { state: backState })}
        acciones={(
          <>
            {!cargando && !errorMsg && <IndicadorGuardado savingMap={savingMap} />}
            {auditoria && <Etiqueta tono={estadoAud.tono}>{estadoAud.texto}</Etiqueta>}
          </>
        )}
      />

      {cargando || errorMsg ? (
        <main className="flex-1 px-4 py-4 flex flex-col gap-4">
          {cargando ? (
            mostrarSkeleton ? (
              <div className="flex flex-col gap-4" aria-busy="true" aria-label="Cargando auditoría">
                <Skeleton className="h-9 w-full rounded-lg" />
                {[0, 1, 2].map(i => (
                  <div key={i} className="bg-card rounded-xl p-4 border border-border flex flex-col gap-3">
                    <Skeleton className="h-4 w-16 rounded-full" />
                    <div className="flex flex-col gap-2">
                      <Skeleton className="h-3.5 w-full" />
                      <Skeleton className="h-3.5 w-2/3" />
                    </div>
                    <div className="grid grid-cols-5 gap-2">
                      {[0, 1, 2, 3, 4].map(j => <Skeleton key={j} className="h-11 rounded-lg" />)}
                    </div>
                  </div>
                ))}
              </div>
            ) : null
          ) : (
            <p className="text-sm text-center py-16" style={{ color: 'var(--agro-danger-text)' }}>
              {errorMsg}
            </p>
          )}
        </main>
      ) : (
        // Escritorio: xl = navegador | preguntas (resumen arriba); 2xl = navegador | preguntas | resumen.
        // Todo se dibuja una sola vez; el reacomodo es solo CSS (grid-template-areas), sin medir la pantalla en JS.
        <main
          ref={columnasRef}
          className="flex-1 flex flex-col xl:grid xl:grid-cols-[18rem_minmax(0,1fr)] xl:grid-rows-[auto_1fr] xl:items-start xl:gap-x-6 xl:gap-y-4 xl:px-4 xl:pt-4 xl:[grid-template-areas:'nav_resumen'_'nav_centro'] 2xl:grid-cols-[18rem_minmax(0,1fr)_20rem] 2xl:grid-rows-[1fr] 2xl:[grid-template-areas:'nav_centro_resumen']"
        >
          {/* Navegador de preguntas: solo escritorio, solo visual (llama a irAPregunta) */}
          <NavegadorAgrupado
            modulos={modulosNavegador}
            onIr={irAPregunta}
            className="hidden xl:block xl:[grid-area:nav] xl:sticky xl:top-[calc(var(--alto-header,0px)+1rem)] xl:max-h-[calc(var(--alto-visible,100vh)-2rem)] xl:overflow-y-auto overscroll-contain rounded-xl border border-border bg-card"
          />

          {/* Resumen: paneles de puntaje, MIP, validación, hallazgos y antecedentes. xl: arriba de las preguntas; 2xl: columna derecha fija. */}
          <div className="px-4 pt-4 xl:p-0 xl:[grid-area:resumen] xl:w-full xl:max-w-3xl xl:justify-self-center 2xl:max-w-none 2xl:justify-self-stretch 2xl:sticky 2xl:top-[calc(var(--alto-header,0px)+1rem)] 2xl:max-h-[calc(var(--alto-visible,100vh)-2rem)] 2xl:overflow-y-auto">
            <motion.div className="flex flex-col gap-4" {...ent(0)}>
              {/* COR-07: banners de error de carga */}
              <AnimatePresence initial={false}>
              {esquemaCargaEstado === 'error' && (
                <motion.div key="err-esquema" role="alert" {...avisoMotion(reducedMotion)} className="flex items-start gap-3 rounded-xl px-4 py-3" style={{ backgroundColor: 'var(--agro-danger-fill)', border: '1px solid var(--agro-red)' }}>
                  <XCircle aria-hidden="true" size={15} className="flex-shrink-0 mt-0.5" style={{ color: 'var(--agro-danger-text)' }} />
                  <div className="flex-1">
                    <p className="text-xs font-semibold" style={{ color: 'var(--agro-danger-text)' }}>No se pudieron cargar los campos de comentario</p>
                    <p className="text-small mt-0.5" style={{ color: 'var(--agro-danger-text)' }}>Reintenta antes de continuar.</p>
                  </div>
                  <Boton variante="secundario" onClick={refetch} className="flex-shrink-0">
                    Reintentar
                  </Boton>
                </motion.div>
              )}
              {obsCargaEstado === 'error' && (
                <motion.div key="err-obs" role="status" {...avisoMotion(reducedMotion)} className="flex items-start gap-3 rounded-xl px-4 py-3" style={{ backgroundColor: 'var(--agro-info-fill)', border: '1px solid var(--agro-menta)' }}>
                  <AlertCircle aria-hidden="true" size={15} className="flex-shrink-0 mt-0.5" style={{ color: 'var(--agro-info-text)' }} />
                  <div className="flex-1">
                    <p className="text-xs font-semibold" style={{ color: 'var(--agro-info-text)' }}>No se pudieron cargar las observaciones guardadas</p>
                    <p className="text-small mt-0.5" style={{ color: 'var(--agro-info-text)' }}>Es posible que algunas observaciones no se muestren.</p>
                  </div>
                  <Boton variante="secundario" onClick={refetch} className="flex-shrink-0">
                    Reintentar
                  </Boton>
                </motion.div>
              )}
              </AnimatePresence>

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
                  reviewLoadError={reviewLoadError}
                  onReintentar={handleValidar}
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
                      toast.error(/^Solo /.test(e?.message ?? '') ? e.message : 'No se pudo actualizar el estado. Reintenta.')
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
                    type="button"
                    onClick={() => setPanelAntecedentesAbierto(v => !v)}
                    aria-expanded={panelAntecedentesAbierto}
                    aria-controls="panel-antecedentes-cuerpo"
                    className="w-full min-h-11 flex items-center justify-between gap-2 px-4 py-3 text-left focus-visible:outline-offset-[-2px]"
                  >
                    <div className="flex items-center gap-2">
                      <History aria-hidden="true" size={15} className="flex-shrink-0" style={{ color: 'var(--agro-info-text)' }} />
                      <span className="text-xs font-semibold" style={{ color: 'var(--foreground)' }}>
                        Antecedentes ({historialCriterios.length} criterio{historialCriterios.length !== 1 ? 's' : ''} con NC)
                      </span>
                    </div>
                    <ChevronPlegable abierto={panelAntecedentesAbierto} />
                  </button>
                  <motion.div id="panel-antecedentes-cuerpo" hidden={!panelAntecedentesAbierto} {...fundidoAntecedentes}>
                    <div className="border-t border-border">
                      <p className="text-caption px-4 pt-3 pb-1" style={{ color: 'var(--muted-foreground)' }}>
                        Criterios con historial de NC en este sitio. Informativo — no determina cumplimiento.
                      </p>
                      {historialCriterios.map(h => {
                        const pregMatch = allPreguntas.find(p => String(p.prompt_component_id) === String(h.criterion_code))
                        return (
                          <div key={h.criterion_code} className="px-4 py-3 flex flex-col gap-1.5 border-t border-border">
                            <div className="flex items-center gap-2 flex-wrap">
                              <span
                                className="text-caption font-mono px-1.5 py-0.5 rounded"
                                style={{ backgroundColor: 'var(--muted)', color: 'var(--muted-foreground)' }}
                              >
                                {h.criterion_code}
                              </span>
                              <Etiqueta tono="error">{h.n_hallazgos} NC</Etiqueta>
                              {h.ultimo_detectado && (
                                <span className="text-caption" style={{ color: 'var(--muted-foreground)' }}>
                                  último: {fechaCorta(h.ultimo_detectado)}
                                </span>
                              )}
                              {h.ultimo_estado && (
                                <Etiqueta tono={estadoHallazgo(h.ultimo_estado).tono}>{estadoHallazgo(h.ultimo_estado).texto}</Etiqueta>
                              )}
                            </div>
                            {pregMatch && (
                              <button
                                onClick={() => irAPregunta(pregMatch.id)}
                                className="self-start text-caption font-medium px-2 py-0.5 rounded relative before:absolute before:content-[''] before:-inset-y-3 before:-inset-x-1"
                                style={{ backgroundColor: 'var(--muted)', color: 'var(--primary)' }}
                              >
                                → Ir a criterio {pregMatch.question_id}
                              </button>
                            )}
                          </div>
                        )
                      })}
                    </div>
                  </motion.div>
                </div>
              )}

            </motion.div>
          </div>

          {/* Preguntas + barra de acciones al pie (sticky dentro de esta columna) */}
          <div className="flex-1 min-w-0 flex flex-col xl:flex-none xl:[grid-area:centro] xl:self-stretch xl:w-full xl:max-w-3xl xl:justify-self-center 2xl:max-w-none">
            <motion.div className="flex-1 px-4 pt-4 pb-4 xl:px-0 xl:pt-0 flex flex-col gap-4" {...ent(0)}>
              {/* Celular: PDF y Marcar preliminar bajo los paneles de resumen (en md+ viven en la barra al pie) */}
              {((auditoria && allPreguntas.length > 0) || (!cerrada && !cargando && allPreguntas.length > 0 && auditoria?.estado !== 'preliminar')) && (
                <div className="md:hidden flex flex-col gap-2">
                  {auditoria && allPreguntas.length > 0 && (
                    <Boton variante="secundario" onClick={handleDescargarPDF} cargando={descargando} className="w-full">
                      <Download aria-hidden="true" size={15} /> Descargar reporte PDF
                    </Boton>
                  )}
                  {!cerrada && !cargando && allPreguntas.length > 0 && auditoria?.estado !== 'preliminar' && (
                    <Boton
                      variante="secundario"
                      onClick={() => handleCambiarEstado('preliminar')}
                      disabled={cambiando || validando || haySavePending || hayErrorCargaEsquema}
                      className="w-full"
                    >
                      {cambiando ? 'Guardando…' : 'Marcar preliminar'}
                    </Boton>
                  )}
                </div>
              )}

              {/* Módulos → Bloques → Preguntas */}
              {modulosData.map(modulo => {
                const respondidasModulo = modulo.preguntas.filter(p => respuestasMap.get(p.id)).length
                const totalModulo = modulo.preguntas.length
                return (
                <div key={modulo.modulo_id}>
                  {/* Encabezado de módulo con avance */}
                  <div className="rounded-xl border border-border bg-card px-4 py-3 mb-3 flex flex-col gap-2">
                    <div className="flex items-center gap-2">
                      <TituloSeccion as="h2" className="mb-0 flex-1 min-w-0">{modulo.modulo_nombre}</TituloSeccion>
                      <Etiqueta tono="neutral">{totalModulo} {totalModulo === 1 ? 'pregunta' : 'preguntas'}</Etiqueta>
                    </div>
                    <p className="text-small text-muted-foreground">{respondidasModulo} de {totalModulo} respondidas</p>
                    <div
                      role="progressbar"
                      aria-label={`Avance de ${modulo.modulo_nombre}`}
                      aria-valuemin={0}
                      aria-valuenow={respondidasModulo}
                      aria-valuemax={totalModulo}
                      className="h-1.5 rounded-full bg-muted overflow-hidden"
                    >
                      <div
                        className="h-full rounded-full bg-primary"
                        style={{ width: `${totalModulo > 0 ? Math.round((respondidasModulo / totalModulo) * 100) : 0}%` }}
                      />
                    </div>
                  </div>

                  {modulo.bloques.map(bloque => {
                    const pregBloque = modulo.preguntas.filter(p => p.bloque_id === bloque.id)
                    if (pregBloque.length === 0) return null
                    return (
                      <BloqueAuditoria
                        key={bloque.id}
                        codigo={bloque.codigo}
                        nombre={bloque.nombre}
                        total={pregBloque.length}
                        respondidas={pregBloque.filter(p => respuestasMap.get(p.id)).length}
                      >
                        {pregBloque.map(preg => (
                            <CapturaPreguntaAuditoria
                              key={preg.id}
                              ref={getCapturaRef(preg.id)}
                              auditoriaId={auditoriaId!}
                              preguntaId={preg.id}
                              sharedHook={hook}
                              sharedReglas={reglasHook}
                              onEstadoGuardado={status => setSavingMap(prev => ({ ...prev, [preg.id]: status }))}
                              canWriteNC={canWriteNC}
                              canAuditWrite={!cerrada && can('audit.write')}
                              hallazgosCount={hallazgos.filter(h => h.pregunta_id === preg.id).length}
                              reincidencia={reincidenciaMap.get(preg.id)}
                              onRespuestaChanged={(_, resp) => {
                                emitFirstEdit(preg.id)
                                if (resp === 'no_conformidad' || resp === 'deficiencia_menor' || resp === 'deficiencia_mayor') {
                                  if (!preg.es_cualitativa) cargarReincidenciaForPreg(preg.id, String(preg.prompt_component_id))
                                }
                              }}
                              onAjusteActualizado={handleAjusteActualizado}
                              onScoringInvalidated={() => setScoringVersion(v => v + 1)}
                              onAfterSave={pregId => {
                                if (herenciaOriginSetRef.current.has(pregId)) {
                                  recargarHerenciaRef.current().catch(e => console.error('[AuditorEjecucion] onAfterSave recargarHerencia', e))
                                }
                              }}
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
                                panelHallazgosRef.current?.scrollIntoView({ behavior: comportamientoScroll(), block: 'start' })
                              }}
                            />
                        ))}
                      </BloqueAuditoria>
                    )
                  })}
                </div>
                )
              })}

              {cerrada && (
                <div className="rounded-xl px-4 py-3 text-center mt-2" style={{ backgroundColor: 'var(--muted)' }}>
                  <p className="text-xs font-semibold" style={{ color: 'var(--muted-foreground)' }}>
                    Auditoría cerrada — solo lectura
                  </p>
                </div>
              )}

            </motion.div>

          {/* Barra de acciones al pie: sticky dentro del área con scroll del Layout, sin motion.
              Celular: Validar y Cerrar (a la derecha del botón del menú); md+: PDF, Validar, Marcar preliminar y Cerrar. */}
          {hayBarra && (
            <div
              className={`sticky bottom-0 z-10 border-t border-border bg-card pr-4 pl-[5.25rem] md:pl-4 pt-3 pb-[calc(0.75rem+env(safe-area-inset-bottom,0px))] items-center justify-end gap-2 ${cerrada ? 'hidden md:flex' : 'flex'}`}
            >
              {auditoria && allPreguntas.length > 0 && (
                <Boton variante="secundario" onClick={handleDescargarPDF} cargando={descargando} className="hidden md:inline-flex">
                  <Download aria-hidden="true" size={15} /> Descargar reporte PDF
                </Boton>
              )}
              {!cerrada && allPreguntas.length > 0 && (
                <>
                  {canAuditReview && (
                    <Boton
                      variante="secundario"
                      onClick={handleValidar}
                      disabled={validando || cambiando || haySavePending || hayErrorCargaEsquema}
                      className="px-3 md:px-4"
                    >
                      {validando
                        ? <><Loader aria-hidden="true" size={15} className="animate-spin motion-reduce:animate-none" />Validando…</>
                        : <><ShieldCheck aria-hidden="true" size={15} />Validar</>
                      }
                    </Boton>
                  )}
                  {auditoria?.estado !== 'preliminar' && (
                    <Boton
                      variante="secundario"
                      onClick={() => handleCambiarEstado('preliminar')}
                      disabled={cambiando || validando || haySavePending || hayErrorCargaEsquema}
                      className="hidden md:inline-flex"
                    >
                      {cambiando ? 'Guardando…' : 'Marcar preliminar'}
                    </Boton>
                  )}
                  <Boton
                    onClick={() => handleCambiarEstado('cerrada')}
                    disabled={cambiando || validando || haySavePending || hayErrorCargaEsquema}
                    className="px-3 md:px-4"
                  >
                    {cambiando ? 'Cerrando…' : 'Cerrar auditoría'}
                  </Boton>
                </>
              )}
            </div>
          )}
          </div>
        </main>
      )}

      {confirmarElemento}

      {/* Sheet: Crear hallazgo */}
      <BottomSheet open={!!sheetHallazgo} onClose={() => setSheetHallazgo(null)}>
        <div className="flex flex-col h-full">
          <div className="flex items-center justify-between px-4 py-4 border-b border-border flex-shrink-0">
            <h2 className="text-sm font-semibold" style={{ color: 'var(--foreground)' }}>Registrar hallazgo</h2>
            <button aria-label="Cerrar" onClick={() => setSheetHallazgo(null)} className="text-muted-foreground relative before:absolute before:content-[''] before:-inset-3">
              <XCircle aria-hidden="true" size={20} />
            </button>
          </div>
          <div className="flex-1 overflow-y-auto px-4 py-4 flex flex-col gap-4">
            <Campo etiqueta="Clasificación" className="gap-1" claseEtiqueta="text-caption font-medium">
              {({ id }) => (
                <select id={id}
                  value={formHallazgoClas}
                  onChange={e => setFormHallazgoClas(e.target.value as AudHallazgoClasificacion)}
                  className="h-10 rounded-xl px-3 text-sm"
                  style={{ border: '1px solid var(--border)', backgroundColor: 'var(--input-background)', color: 'var(--foreground)' }}
                >
                  <option value="menor">Menor</option>
                  <option value="mayor">Mayor</option>
                  <option value="critico">Crítico</option>
                  <option value="observacion">Observación</option>
                </select>
              )}
            </Campo>
            <Campo
              etiqueta={<>Descripción <span aria-hidden="true" style={{ color: 'var(--agro-red)' }}>*</span><span className="sr-only"> obligatorio</span></>}
              className="gap-1"
              claseEtiqueta="text-caption font-medium"
            >
              {({ id }) => (
                <textarea id={id}
                  value={formHallazgoDesc}
                  onChange={e => setFormHallazgoDesc(e.target.value)}
                  rows={4}
                  placeholder="Describe el hallazgo encontrado…"
                  className="resize-none text-sm"
                  style={{
                    borderRadius: 'var(--radius)',
                    border: '1px solid var(--border)',
                    backgroundColor: 'var(--input-background)',
                    color: 'var(--foreground)',
                    padding: '0.5rem 0.75rem',
                  }}
                />
              )}
            </Campo>
          </div>
          <div className="px-4 pb-6 pt-3 flex-shrink-0 border-t border-border">
            <Boton onClick={handleGuardarHallazgo} cargando={guardandoHallazgo} disabled={!formHallazgoDesc.trim()} className="w-full">
              Registrar hallazgo
            </Boton>
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
                <p className="text-caption mt-0.5 line-clamp-1" style={{ color: 'var(--muted-foreground)' }}>
                  {sheetAccion.descripcion}
                </p>
              )}
            </div>
            <button aria-label="Cerrar" onClick={() => { setSheetAccion(null); setAccionActual(null); setFormAccion({}) }} className="text-muted-foreground ml-2 flex-shrink-0 relative before:absolute before:content-[''] before:-inset-3">
              <XCircle aria-hidden="true" size={20} />
            </button>
          </div>

          {cargandoAccion ? (
            <div className="flex-1 px-4 py-4">
              <FormularioSkeleton campos={4} />
            </div>
          ) : (
            <div className="flex-1 overflow-y-auto px-4 py-4 flex flex-col gap-4">
              {/* Estado interno M.A.D.Y */}
              <div className="rounded-xl p-3 flex flex-col gap-2" style={{ backgroundColor: 'var(--muted)' }}>
                <p className="text-caption font-bold" style={{ color: 'var(--muted-foreground)' }}>Estado interno — M.A.D.Y</p>
                <select
                  aria-label="Estado interno"
                  value={formAccion.internal_status ?? 'REGISTERED'}
                  onChange={e => setFormAccion(prev => ({ ...prev, internal_status: e.target.value as AudInternalStatus }))}
                  className="h-10 rounded-xl px-3 text-sm w-full"
                  style={{ border: '1px solid var(--border)', backgroundColor: 'var(--card)', color: 'var(--foreground)' }}
                >
                  {(Object.keys(INTERNAL_STATUS_LABELS) as AudInternalStatus[]).map(k => (
                    <option key={k} value={k}>{INTERNAL_STATUS_LABELS[k]}</option>
                  ))}
                </select>
              </div>

              {/* Estado externo Azzule / organismo */}
              <div className="rounded-xl p-3 flex flex-col gap-2" style={{ border: '1.5px solid var(--border)' }}>
                <p className="text-caption font-bold" style={{ color: 'var(--muted-foreground)' }}>Estado externo — Azzule / organismo</p>
                <p className="text-caption" style={{ color: 'var(--muted-foreground)' }}>Registra manualmente lo que ocurrió fuera del sistema.</p>
                <select
                  aria-label="Estado externo"
                  value={formAccion.external_status ?? 'NOT_TRACKED'}
                  onChange={e => setFormAccion(prev => ({ ...prev, external_status: e.target.value as AudExternalStatus }))}
                  className="h-10 rounded-xl px-3 text-sm w-full"
                  style={{ border: '1px solid var(--border)', backgroundColor: 'var(--input-background)', color: 'var(--foreground)' }}
                >
                  {(Object.keys(EXTERNAL_STATUS_LABELS) as AudExternalStatus[]).map(k => (
                    <option key={k} value={k}>{EXTERNAL_STATUS_LABELS[k]}</option>
                  ))}
                </select>
              </div>

              {/* Contraparte externa */}
              <Campo etiqueta="Contraparte externa (sin usuario MADY)" className="gap-1" claseEtiqueta="text-caption font-medium">
                {({ id }) => (
                  <input id={id}
                    type="text"
                    value={formAccion.owner_external_party ?? ''}
                    onChange={e => setFormAccion(prev => ({ ...prev, owner_external_party: e.target.value || null }))}
                    placeholder="Nombre de la persona u organismo responsable"
                    className="h-10 rounded-xl px-3 text-sm"
                    style={{ border: '1px solid var(--border)', backgroundColor: 'var(--input-background)', color: 'var(--foreground)' }}
                  />
                )}
              </Campo>

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
                <Campo etiqueta={etiqueta} className="gap-1" key={campo} claseEtiqueta="text-caption font-medium">
                  {({ id }) => (
                    <textarea id={id}
                      value={(formAccion[campo] as string) ?? ''}
                      onChange={e => setFormAccion(prev => ({ ...prev, [campo]: e.target.value || null }))}
                      rows={2}
                      className="resize-none text-sm"
                      style={{
                        borderRadius: 'var(--radius)',
                        border: '1px solid var(--border)',
                        backgroundColor: 'var(--input-background)',
                        color: 'var(--foreground)',
                        padding: '0.5rem 0.75rem',
                      }}
                    />
                  )}
                </Campo>
              ))}

              {/* Ver historial */}
              {accionActual && (
                <Boton variante="secundario" aria-haspopup="dialog" onClick={handleVerHistorial} disabled={cargandoHistorial} className="w-full">
                  {cargandoHistorial ? <Loader aria-hidden="true" size={14} className="animate-spin motion-reduce:animate-none" /> : <History aria-hidden="true" size={14} />}
                  Ver historial de versiones ({accionActual.current_version})
                </Boton>
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
                    <p className="text-caption italic" style={{ color: 'var(--muted-foreground)' }}>
                      M.A.D.Y organiza, valida y da seguimiento. No sustituye a PrimusGFS, Azzule Systems, al auditor autorizado ni al organismo de certificación.
                    </p>
                  </div>

                  {/* Botón Validar para Azzule */}
                  {canExternalStatus && (
                    <Boton variante="secundario" onClick={handleValidarAzzule} disabled={validandoAzzule || cerrada} className="w-full">
                      {validandoAzzule
                        ? <><Loader aria-hidden="true" size={13} className="animate-spin motion-reduce:animate-none" />Validando…</>
                        : <><ShieldCheck aria-hidden="true" size={13} />Validar para Azzule</>
                      }
                    </Boton>
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
                          ? { bg: 'var(--agro-info-fill)', color: 'var(--agro-info-text)', label: 'Aviso' }
                          : { bg: 'var(--agro-success-fill)', color: 'var(--agro-success-text)', label: 'Info' }
                        return (
                          <div key={sev} className="rounded-xl overflow-hidden border" style={{ borderColor: 'var(--border)' }}>
                            <div className="px-3 py-1.5" style={{ backgroundColor: cfg.bg }}>
                              <span className="text-caption font-bold" style={{ color: cfg.color }}>
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
                        <Boton onClick={() => navigate(
                            `/auditor/auditoria/${auditoriaId}/azzule`,
                            { state: { orgNombre, orgId, instalacionId, instalacionNombreNav } }
                          )} className="w-full">
                          Abrir Modo Azzule
                        </Boton>
                      ) : !azzuleReady ? (
                        <p className="text-caption text-center py-1" style={{ color: 'var(--muted-foreground)' }}>
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
                      aria-expanded={sheetRegistrarResultado}
                      aria-controls="panel-registrar-resultado"
                      className="w-full flex items-center justify-between px-3 py-2.5 text-left focus-visible:outline-offset-[-2px]"
                    >
                      <span className="text-xs font-semibold" style={{ color: 'var(--foreground)' }}>Registrar resultado de Azzule</span>
                      {sheetRegistrarResultado
                        ? <ChevronUp aria-hidden="true" size={14} style={{ color: 'var(--muted-foreground)' }} />
                        : <ChevronDown aria-hidden="true" size={14} style={{ color: 'var(--muted-foreground)' }} />
                      }
                    </button>
                    {sheetRegistrarResultado && (
                      <div id="panel-registrar-resultado" className="px-3 pb-3 flex flex-col gap-3 border-t" style={{ borderColor: 'var(--border)' }}>
                        <p className="text-caption pt-2" style={{ color: 'var(--muted-foreground)' }}>
                          Cada registro es una nueva observación — no sobrescribe el anterior.
                        </p>
                        <Campo etiqueta="Estado observado" requerido className="gap-1" claseEtiqueta="text-caption font-medium">
                          {({ id }) => (
                            <select id={id}
                              value={formResultado.observed_status}
                              onChange={e => setFormResultado(p => ({ ...p, observed_status: e.target.value as AudExternalObservedStatus }))}
                              className="h-9 rounded-lg px-2 text-xs"
                              style={{ border: '1px solid var(--border)', backgroundColor: 'var(--input-background)', color: 'var(--foreground)' }}
                            >
                              {(Object.keys(OBSERVED_STATUS_LABELS) as AudExternalObservedStatus[]).map(k => (
                                <option key={k} value={k}>{OBSERVED_STATUS_LABELS[k]}</option>
                              ))}
                            </select>
                          )}
                        </Campo>
                        <Campo etiqueta="Fecha observada" className="gap-1" claseEtiqueta="text-caption font-medium">
                          {({ id }) => (
                            <input id={id}
                              type="date"
                              value={formResultado.observed_at}
                              onChange={e => setFormResultado(p => ({ ...p, observed_at: e.target.value }))}
                              className="h-9 rounded-lg px-2 text-xs"
                              style={{ border: '1px solid var(--border)', backgroundColor: 'var(--input-background)', color: 'var(--foreground)' }}
                            />
                          )}
                        </Campo>
                        <Campo etiqueta="ID auditoría Azzule" className="gap-1" claseEtiqueta="text-caption font-medium">
                          {({ id }) => (
                            <input id={id}
                              type="text"
                              value={formResultado.external_audit_id}
                              onChange={e => setFormResultado(p => ({ ...p, external_audit_id: e.target.value }))}
                              placeholder="Ej. AZZ-2024-00123"
                              className="h-9 rounded-lg px-2 text-xs"
                              style={{ border: '1px solid var(--border)', backgroundColor: 'var(--input-background)', color: 'var(--foreground)' }}
                            />
                          )}
                        </Campo>
                        {([
                          ['official_decision',     'Decisión oficial'],
                          ['official_new_response', 'Nueva respuesta oficial'],
                          ['official_comment',      'Comentario'],
                        ] as [keyof typeof formResultado, string][]).map(([campo, label]) => (
                          <Campo etiqueta={label} className="gap-1" key={campo} claseEtiqueta="text-caption font-medium">
                            {({ id }) => (
                              <textarea id={id}
                                value={formResultado[campo]}
                                onChange={e => setFormResultado(p => ({ ...p, [campo]: e.target.value }))}
                                rows={2}
                                className="resize-none text-xs"
                                style={{ borderRadius: 'var(--radius)', border: '1px solid var(--border)', backgroundColor: 'var(--input-background)', color: 'var(--foreground)', padding: '0.375rem 0.625rem' }}
                              />
                            )}
                          </Campo>
                        ))}
                        <Boton onClick={handleRegistrarResultado} cargando={guardandoResultado} className="w-full">
                          Registrar resultado
                        </Boton>
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
                      aria-expanded={historialExternoVisible}
                      aria-controls="panel-historial-externo"
                      className="w-full flex items-center justify-between px-3 py-2.5 text-left focus-visible:outline-offset-[-2px]"
                    >
                      <span className="text-xs font-semibold" style={{ color: 'var(--foreground)' }}>
                        Historial de seguimiento externo
                      </span>
                      {historialExternoVisible
                        ? <ChevronUp aria-hidden="true" size={14} style={{ color: 'var(--muted-foreground)' }} />
                        : <ChevronDown aria-hidden="true" size={14} style={{ color: 'var(--muted-foreground)' }} />
                      }
                    </button>
                    {historialExternoVisible && (
                      <div id="panel-historial-externo" className="border-t" style={{ borderColor: 'var(--border)' }}>
                        {cargandoHistorialExterno ? (
                          <div className="px-3 py-3 flex flex-col gap-2" aria-busy="true" aria-label="Cargando seguimiento">
                            <Skeleton className="h-3.5 w-3/4" />
                            <Skeleton className="h-3.5 w-1/2" />
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
                                  <span className="text-caption font-bold" style={{ color: 'var(--foreground)' }}>
                                    {OBSERVED_STATUS_LABELS[ewr.observed_status]}
                                  </span>
                                  <span className="text-caption" style={{ color: 'var(--muted-foreground)' }}>
                                    {fechaCorta(ewr.observed_at)}
                                  </span>
                                </div>
                                {ewr.official_decision && (
                                  <TextoRecortable className="text-body text-foreground">{ewr.official_decision}</TextoRecortable>
                                )}
                                {ewr.official_comment && (
                                  <TextoRecortable className="text-caption text-muted-foreground">{ewr.official_comment}</TextoRecortable>
                                )}
                                {ewr.source_note && (
                                  <TextoRecortable className="text-caption italic text-muted-foreground">{ewr.source_note}</TextoRecortable>
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
              <Boton onClick={handleGuardarAccion} cargando={guardandoAccion} className="w-full">
                {accionActual ? 'Actualizar acción' : 'Crear acción correctiva'}
              </Boton>
            </div>
          )}
        </div>
      </BottomSheet>

      {/* Sheet: Historial de versiones */}
      <BottomSheet open={sheetHistorial !== null} onClose={() => setSheetHistorial(null)} height="85%">
        <div className="flex flex-col h-full">
          <div className="flex items-center justify-between px-4 py-4 border-b border-border flex-shrink-0">
            <h2 className="text-sm font-semibold" style={{ color: 'var(--foreground)' }}>Historial de versiones</h2>
            <button aria-label="Cerrar" onClick={() => setSheetHistorial(null)} className="text-muted-foreground relative before:absolute before:content-[''] before:-inset-3">
              <XCircle aria-hidden="true" size={20} />
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
                    <span className="text-caption" style={{ color: 'var(--muted-foreground)' }}>
                      {fechaHora(v.created_at)}
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
                        <p className="text-caption font-medium" style={{ color: 'var(--muted-foreground)' }}>{etiqueta}</p>
                        <TextoRecortable className="text-xs text-foreground">{val}</TextoRecortable>
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
                <p className="text-caption mt-0.5 line-clamp-1" style={{ color: 'var(--muted-foreground)' }}>
                  {sheetIncidenciasHallazgo.descripcion}
                </p>
              )}
            </div>
            <button aria-label="Cerrar" onClick={() => setSheetIncidenciasHallazgo(null)} className="text-muted-foreground ml-2 flex-shrink-0 relative before:absolute before:content-[''] before:-inset-3">
              <XCircle aria-hidden="true" size={20} />
            </button>
          </div>

          <div className="flex-1 overflow-y-auto px-4 py-4 flex flex-col gap-4">
            {/* Incidencias vinculadas */}
            <div className="flex flex-col gap-2">
              <TituloSeccion as="p" variante="subtitulo" className="mb-0">
                Vinculadas ({incVinculadas.length})
              </TituloSeccion>
              {cargandoIncVinc ? (
                <div className="flex flex-col gap-2 py-2" aria-busy="true" aria-label="Cargando antecedentes">
                  <Skeleton className="h-14 w-full rounded-lg" />
                  <Skeleton className="h-14 w-full rounded-lg" />
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
                            className="text-caption font-bold px-1.5 py-0.5 rounded-full"
                            style={{ backgroundColor: 'var(--agro-success-fill)', color: 'var(--agro-success-text)' }}
                          >
                            {v.relation_type === 'ANTECEDENTE' ? 'Antecedente' : 'Evidencia'}
                          </span>
                          {fecha && (
                            <span className="text-caption" style={{ color: 'var(--muted-foreground)' }}>
                              {fechaCorta(fecha)}
                            </span>
                          )}
                        </div>
                        <TextoRecortable className="text-body leading-snug text-foreground">{desc}</TextoRecortable>
                        <div className="flex items-center gap-2 mt-0.5">
                          <a
                            href="/inocuidad/incidencias"
                            target="_blank"
                            rel="noopener noreferrer"
                            className="flex items-center gap-1 text-small h-6 px-2 rounded relative before:absolute before:content-[''] before:-inset-y-2.5 before:-inset-x-1"
                            style={{ color: 'var(--primary)', border: '1px solid var(--border)', backgroundColor: 'var(--card)' }}
                          >
                            <AlertTriangle aria-hidden="true" size={10} />
                            Ver en M13
                          </a>
                          <button
                            onClick={() => handleQuitarIncidencia(v.id)}
                            disabled={incQuitandoId === v.id}
                            className="flex items-center gap-1 text-small h-6 px-2 rounded disabled:opacity-50 ml-auto relative before:absolute before:content-[''] before:-inset-y-2.5 before:-inset-x-1"
                            style={{ color: 'var(--agro-danger-text)' }}
                          >
                            {incQuitandoId === v.id
                              ? <Loader aria-hidden="true" size={10} className="animate-spin motion-reduce:animate-none" />
                              : <XCircle aria-hidden="true" size={10} />
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
              <TituloSeccion as="p" variante="subtitulo" className="mb-0">
                Buscar incidencia existente
              </TituloSeccion>

              <div className="flex gap-2">
                <Campo etiqueta="Desde" className="gap-1 flex-1" claseEtiqueta="text-caption font-medium">
                  {({ id }) => (
                    <input id={id}
                      type="date"
                      value={incDesde}
                      onChange={e => setIncDesde(e.target.value)}
                      className="h-9 rounded-lg px-2 text-xs"
                      style={{ border: '1px solid var(--border)', backgroundColor: 'var(--card)', color: 'var(--foreground)' }}
                    />
                  )}
                </Campo>
                <Campo etiqueta="Hasta" className="gap-1 flex-1" claseEtiqueta="text-caption font-medium">
                  {({ id }) => (
                    <input id={id}
                      type="date"
                      value={incHasta}
                      onChange={e => setIncHasta(e.target.value)}
                      className="h-9 rounded-lg px-2 text-xs"
                      style={{ border: '1px solid var(--border)', backgroundColor: 'var(--card)', color: 'var(--foreground)' }}
                    />
                  )}
                </Campo>
              </div>

              <div className="flex gap-2">
                <input
                  aria-label="Buscar por descripción"
                  type="text"
                  value={incSearch}
                  onChange={e => setIncSearch(e.target.value)}
                  onKeyDown={e => { if (e.key === 'Enter') handleBuscarIncidencias() }}
                  placeholder="Buscar por descripción…"
                  className="h-11 rounded-lg px-3 text-xs flex-1"
                  style={{ border: '1px solid var(--border)', backgroundColor: 'var(--card)', color: 'var(--foreground)' }}
                />
                <Boton onClick={handleBuscarIncidencias} cargando={incBuscando} className="flex-shrink-0">
                  Buscar
                </Boton>
              </div>

              {incBuscando ? (
                <div className="flex items-center gap-2 py-1">
                  <Loader aria-hidden="true" size={12} className="animate-spin motion-reduce:animate-none" style={{ color: 'var(--muted-foreground)' }} />
                  <span className="text-caption" style={{ color: 'var(--muted-foreground)' }}>Buscando incidencias…</span>
                </div>
              ) : incResultados.length === 0 ? (
                <p className="text-caption text-center py-1" style={{ color: 'var(--muted-foreground)' }}>
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
                          className="text-caption font-bold px-1.5 py-0.5 rounded-full"
                          style={{ backgroundColor: 'var(--muted)', color: 'var(--muted-foreground)' }}
                        >
                          M13
                        </span>
                        <span className="text-caption" style={{ color: 'var(--muted-foreground)' }}>
                          {fechaCorta(inc.fecha)}
                        </span>
                      </div>
                      <TextoRecortable className="text-body leading-snug text-foreground">{inc.descripcion}</TextoRecortable>
                      <Boton onClick={() => handleRelacionarIncidencia(inc)} cargando={!!incRelacionandoId} className="self-end">
                        <Link2 aria-hidden="true" size={10} />
                        Relacionar
                      </Boton>
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
                <p className="text-caption mt-0.5 line-clamp-1" style={{ color: 'var(--muted-foreground)' }}>
                  {sheetEvidenciaHallazgo.descripcion}
                </p>
              )}
            </div>
            <button aria-label="Cerrar" onClick={() => setSheetEvidenciaHallazgo(null)} className="text-muted-foreground ml-2 flex-shrink-0 relative before:absolute before:content-[''] before:-inset-3">
              <XCircle aria-hidden="true" size={20} />
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
