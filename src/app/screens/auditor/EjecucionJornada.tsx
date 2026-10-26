import { useState, useEffect, useLayoutEffect, useRef, useCallback, useMemo } from 'react'
import { useParams, useNavigate } from 'react-router'
import {
  AlertCircle, Loader, RefreshCw,
  ClipboardList, ChevronDown, CheckCircle, ExternalLink, MoreVertical,
  Plus, Minus, XCircle, WifiOff, Circle, Link2, AlertTriangle,
} from 'lucide-react'
import { toast } from 'sonner'
import { useAuditorJornada } from '@/hooks/useAuditorJornada'
import type {
  JornadaDetalle, JornadaOperacionDetalle, JornadaPregunta, JornadaConteo,
} from '@/hooks/useAuditorJornada'
import { CapturaPreguntaAuditoria } from './CapturaPreguntaAuditoria'
import type { CapturaPreguntaRef } from './CapturaPreguntaAuditoria'
import { BottomSheet } from '@/app/components/BottomSheet'
import { ModuloHeader } from '@/app/components/ModuloHeader'
import { Boton } from '@/app/components/ui-mady/Boton'
import { Etiqueta } from '@/app/components/ui-mady/Etiqueta'
import { EstadoVacio } from '@/app/components/ui-mady/EstadoVacio'
import { TituloSeccion } from '@/app/components/ui-mady/TituloSeccion'
import { fechaCorta, formatoPct } from '@/lib/formato'
import { ListaSkeleton } from '@/app/components/ListaSkeleton'
import { motion, AnimatePresence, useAnimate, useReducedMotion } from 'motion/react'
import { DUR, EASE_OUT } from '@/lib/motion'
import { useEntradaPantalla, avisoMotion, fundidoEntrada, comportamientoScroll } from './motionAuditor'

// ── Helpers ──────────────────────────────────────────────────────────────────

function avancePct(conteo: JornadaConteo): number {
  if (!conteo.total) return 0
  return Math.round(((conteo.resueltas ?? 0) / conteo.total) * 100)
}

type SaveStatusLocal = 'idle' | 'saving' | 'saved' | 'error'

// Estado de respuesta de los puntos del navigator: color + ícono + nombre,
// para que el estado no dependa solo del color.
interface EstadoDestino { nombre: string; Icono: typeof Circle; color: string }

const ESTADOS_LEYENDA: EstadoDestino[] = [
  { nombre: 'Cumple', Icono: CheckCircle, color: 'var(--agro-success-text)' },
  { nombre: 'Deficiencia', Icono: AlertTriangle, color: 'var(--agro-info-text)' },
  { nombre: 'No conformidad', Icono: XCircle, color: 'var(--agro-danger-text)' },
  { nombre: 'No aplica', Icono: Minus, color: 'var(--muted-foreground)' },
  { nombre: 'Por confirmar', Icono: Link2, color: 'var(--agro-menta)' },
  { nombre: 'Sin responder', Icono: Circle, color: 'var(--muted-foreground)' },
]

function estadoDestino(resp: string | null, herencia: boolean): EstadoDestino {
  if (herencia) return ESTADOS_LEYENDA[4]
  if (!resp) return ESTADOS_LEYENDA[5]
  if (resp === 'cumplimiento_total' || resp === 'excede_cumplimiento') return ESTADOS_LEYENDA[0]
  if (resp === 'na') return ESTADOS_LEYENDA[3]
  if (resp === 'no_conformidad') return ESTADOS_LEYENDA[2]
  if (resp === 'deficiencia_menor') return { ...ESTADOS_LEYENDA[1], nombre: 'Deficiencia menor' }
  if (resp === 'deficiencia_mayor') return { ...ESTADOS_LEYENDA[1], nombre: 'Deficiencia mayor' }
  return ESTADOS_LEYENDA[1]
}

// ── Sub-componentes ───────────────────────────────────────────────────────────

function OperacionChip({ op, activa, onClick }: {
  op: JornadaOperacionDetalle
  activa: boolean
  onClick: () => void
}) {
  const pct = avancePct(op.conteo)
  return (
    <button
      onClick={onClick}
      aria-current={activa ? 'true' : undefined}
      disabled={!op.disponible}
      className="flex flex-col gap-1 px-3 py-2 rounded-xl border focus-visible:outline-offset-[-2px] transition-colors duration-[var(--motion-fast)] ease-[var(--ease-out)] flex-shrink-0 disabled:opacity-50 text-left"
      style={{
        minWidth: 160,
        backgroundColor: activa ? 'var(--primary)' : 'var(--card)',
        borderColor: activa ? 'var(--primary)' : 'var(--border)',
        color: activa ? 'var(--primary-foreground)' : 'var(--foreground)',
      }}
    >
      <p className="text-small font-semibold leading-tight truncate max-w-[140px]">
        {op.productor}
      </p>
      <p className="text-small leading-tight truncate max-w-[140px]" style={{ color: activa ? 'color-mix(in srgb, var(--primary-foreground) 80%, transparent)' : 'var(--muted-foreground)' }}>
        {op.operacion}
      </p>
      <div className="flex items-center gap-1.5 mt-0.5">
        <div
          className="flex-1 h-1 rounded-full overflow-hidden"
          style={{ backgroundColor: activa ? 'color-mix(in srgb, var(--primary-foreground) 30%, transparent)' : 'var(--muted)' }}
        >
          <div
            className="h-full rounded-full"
            style={{ width: `${pct}%`, backgroundColor: activa ? 'var(--primary-foreground)' : 'var(--primary)' }}
          />
        </div>
        <span className="text-caption font-mono" style={{ color: activa ? 'color-mix(in srgb, var(--primary-foreground) 80%, transparent)' : 'var(--muted-foreground)' }}>
          {op.conteo.resueltas ?? 0}/{op.conteo.total}
        </span>
      </div>
      {(op.herencia_pendiente > 0 || op.issues_abiertos > 0) && (
        <div className="flex flex-wrap items-center gap-x-2 text-caption font-semibold">
          {op.herencia_pendiente > 0 && (
            <span style={{ color: activa ? 'var(--primary-foreground)' : 'var(--agro-success-text)' }}>
              {op.herencia_pendiente} por confirmar
            </span>
          )}
          {op.issues_abiertos > 0 && (
            <span style={{ color: activa ? 'var(--primary-foreground)' : 'var(--agro-danger-text)' }}>
              {op.issues_abiertos} {op.issues_abiertos === 1 ? 'revisión' : 'revisiones'}
            </span>
          )}
        </div>
      )}
      {!op.disponible && op.motivo && (
        <p className="text-caption" style={{ color: activa ? 'color-mix(in srgb, var(--primary-foreground) 80%, transparent)' : 'var(--muted-foreground)' }}>
          {op.motivo}
        </p>
      )}
    </button>
  )
}

function NavigatorPregunta({ pregunta, activa, auditoriaActiva, operaciones, onClick }: {
  pregunta: JornadaPregunta
  activa: boolean
  auditoriaActiva: string | null
  operaciones: JornadaOperacionDetalle[]
  onClick: () => void
}) {
  const destinoActivo = auditoriaActiva
    ? pregunta.destinos.find(d => d.auditoria_id === auditoriaActiva)
    : null
  const estadoActivo = destinoActivo ? estadoDestino(destinoActivo.respuesta, destinoActivo.herencia_pendiente) : null

  return (
    <button
      onClick={onClick}
      aria-current={activa ? 'step' : undefined}
      className="w-full text-left px-4 py-2.5 flex items-center gap-2.5 focus-visible:outline-offset-[-2px] transition-colors duration-[var(--motion-fast)] ease-[var(--ease-out)]"
      style={{
        backgroundColor: activa ? 'var(--agro-success-fill)' : 'transparent',
        borderBottom: '1px solid var(--border)',
      }}
    >
      {/* Estado del destino activo: ícono + color + nombre para lectores de pantalla */}
      {estadoActivo ? (
        <>
          <estadoActivo.Icono size={12} aria-hidden="true" className="flex-shrink-0" style={{ color: estadoActivo.color }} />
          <span className="sr-only">{estadoActivo.nombre}</span>
        </>
      ) : (
        <Circle size={12} aria-hidden="true" className="flex-shrink-0 opacity-40" style={{ color: 'var(--muted-foreground)' }} />
      )}
      <div className="flex-1 min-w-0">
        <div className="flex items-center gap-2">
          <span className="text-caption font-mono flex-shrink-0" style={{ color: 'var(--muted-foreground)' }}>
            {pregunta.question_id}
          </span>
          <p className="text-xs truncate" style={{ color: 'var(--foreground)', lineHeight: 1.3 }}>
            {pregunta.texto}
          </p>
        </div>
        {/* Puntos por destino */}
        {pregunta.destinos.length > 1 && (
          <div className="flex gap-1 mt-0.5">
            {pregunta.destinos.map(d => {
              const est = estadoDestino(d.respuesta, d.herencia_pendiente)
              const op = operaciones.find(o => o.auditoria_id === d.auditoria_id)
              const nombreOp = op ? `${op.productor} · ${op.operacion}` : undefined
              return (
                <span key={d.auditoria_id} className="inline-flex" title={nombreOp}>
                  <est.Icono size={10} aria-hidden="true" style={{ color: est.color }} />
                  <span className="sr-only">{nombreOp ? `${nombreOp}: ${est.nombre}` : est.nombre}</span>
                </span>
              )
            })}
          </div>
        )}
      </div>
      {/* No en esta op */}
      {auditoriaActiva && !destinoActivo && (
        <span className="text-caption max-w-24 flex-shrink-0 text-right leading-tight" style={{ color: 'var(--muted-foreground)' }}>
          No aplica en esta operación
        </span>
      )}
    </button>
  )
}

function PendientesPanel({
  operaciones, preguntas, onResolver, onAbrir, onClose,
}: {
  operaciones: JornadaOperacionDetalle[]
  preguntas: JornadaPregunta[]
  onResolver: (auditoriaId: string, questionId: string) => void
  onAbrir: (auditoriaId: string) => void
  onClose: () => void
}) {
  return (
    <BottomSheet onClose={onClose} title="Pendientes">
      <div className="flex flex-col gap-4 pb-6">
        {operaciones.map(op => {
          const pendientesDest = preguntas.flatMap(p =>
            p.destinos.filter(d => d.auditoria_id === op.auditoria_id && !d.respuesta)
              .map(d => ({ question_id: p.question_id, pregunta_id: d.pregunta_id, texto: p.texto }))
          )
          const herenciasDest = preguntas.flatMap(p =>
            p.destinos.filter(d => d.auditoria_id === op.auditoria_id && d.herencia_pendiente)
              .map(d => ({ question_id: p.question_id, pregunta_id: d.pregunta_id, texto: p.texto }))
          )

          return (
            <div key={op.auditoria_id} className="flex flex-col gap-2">
              <div className="flex items-center justify-between">
                <div className="flex flex-col">
                  <p className="text-xs font-semibold" style={{ color: 'var(--foreground)' }}>
                    {op.productor} · {op.operacion}
                  </p>
                  <p className="text-caption" style={{ color: 'var(--muted-foreground)' }}>
                    {pendientesDest.length} sin responder
                    {herenciasDest.length > 0 ? ` · ${herenciasDest.length} por confirmar` : ''}
                    {op.issues_abiertos > 0 ? ` · ${op.issues_abiertos} revisión` : ''}
                  </p>
                </div>
                <button
                  onClick={() => onAbrir(op.auditoria_id)}
                  className="flex items-center gap-1 text-small font-semibold px-2 py-1 rounded-lg relative before:absolute before:content-[''] before:-inset-y-2.5 before:-inset-x-1"
                  style={{ backgroundColor: 'var(--muted)', color: 'var(--foreground)' }}
                >
                  <ExternalLink aria-hidden="true" size={10} />
                  Abrir auditoría
                </button>
              </div>

              {pendientesDest.slice(0, 5).map(p => (
                <button
                  key={p.question_id}
                  onClick={() => { onClose(); onResolver(op.auditoria_id, p.question_id) }}
                  className="w-full text-left rounded-xl border border-border px-3 py-2 flex items-center gap-2 active:opacity-70"
                  style={{ backgroundColor: 'var(--card)' }}
                >
                  <div className="w-2 h-2 rounded-full flex-shrink-0" style={{ backgroundColor: 'var(--border)' }} />
                  <div className="flex-1 min-w-0">
                    <span className="text-caption font-mono mr-1" style={{ color: 'var(--muted-foreground)' }}>{p.question_id}</span>
                    <span className="text-caption truncate" style={{ color: 'var(--foreground)' }}>{p.texto}</span>
                  </div>
                </button>
              ))}

              {herenciasDest.slice(0, 3).map(p => (
                <button
                  key={`h-${p.question_id}`}
                  onClick={() => { onClose(); onResolver(op.auditoria_id, p.question_id) }}
                  className="w-full text-left rounded-xl border px-3 py-2 flex items-center gap-2 active:opacity-70"
                  style={{ backgroundColor: 'var(--card)', borderColor: 'var(--agro-menta)' }}
                >
                  <div className="w-2 h-2 rounded-full flex-shrink-0" style={{ backgroundColor: 'var(--agro-menta)' }} />
                  <div className="flex-1 min-w-0">
                    <span className="text-caption font-mono mr-1" style={{ color: 'var(--muted-foreground)' }}>{p.question_id}</span>
                    <span className="text-caption" style={{ color: 'var(--foreground)' }}>Dato por confirmar</span>
                  </div>
                </button>
              ))}

              {op.issues_abiertos > 0 && (
                <div className="rounded-xl px-3 py-2 flex items-center justify-between"
                  style={{ backgroundColor: 'var(--agro-info-fill)', border: '1px solid var(--agro-info-text)' }}>
                  <p className="text-small" style={{ color: 'var(--agro-info-text)' }}>
                    {op.issues_abiertos} {op.issues_abiertos === 1 ? 'observación de revisión abierta' : 'observaciones de revisión abiertas'}
                  </p>
                  <button
                    onClick={() => onAbrir(op.auditoria_id)}
                    className="text-caption font-semibold underline"
                    style={{ color: 'var(--agro-info-text)' }}
                  >
                    Resolver
                  </button>
                </div>
              )}
            </div>
          )
        })}

        {operaciones.every(op => op.conteo.pendientes === 0 && op.herencia_pendiente === 0 && op.issues_abiertos === 0) && (
          <EstadoVacio icono={CheckCircle} titulo="Sin pendientes" ayuda="Todas las operaciones están al día." />
        )}
      </div>
    </BottomSheet>
  )
}

// ── Pantalla principal ────────────────────────────────────────────────────────

export function EjecucionJornada() {
  const { jornadaId } = useParams<{ jornadaId: string }>()
  const navigate = useNavigate()
  const jornada_ = useAuditorJornada()
  const { cargarDetalle, cargarPreguntas, agregarOperacion, retirarOperacion, terminarJornada, guardarContexto } = jornada_

  const [detalle, setDetalle] = useState<JornadaDetalle | null>(null)
  const [preguntas, setPreguntas] = useState<JornadaPregunta[]>([])
  const [cargando, setCargando] = useState(true)
  const [errorCarga, setErrorCarga] = useState(false)

  const [auditoriaActiva, setAuditoriaActiva] = useState<string | null>(null)
  const [questionActiva, setQuestionActiva] = useState<string | null>(null)  // question_id (no UUID)

  const [moduloActivo, setModuloActivo] = useState<string | null>(null)
  const [filtro, setFiltro] = useState<'todas' | 'pendientes' | 'comunes'>('todas')

  const [panelPendientes, setPanelPendientes] = useState(false)
  const [menuAbierto, setMenuAbierto] = useState(false)
  const [confirmTerminar, setConfirmTerminar] = useState(false)
  const [confirmRetirar, setConfirmRetirar] = useState<string | null>(null)
  const [terminando, setTerminando] = useState(false)
  const [retirando, setRetirando] = useState(false)

  const [saveError, setSaveError] = useState<string | null>(null)
  const [sinConexion, setSinConexion] = useState(false)

  const capturaRef = useRef<CapturaPreguntaRef | null>(null)
  const contextoTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null)

  // ── Carga inicial ──

  const cargar = useCallback(async () => {
    if (!jornadaId) return
    setCargando(true)
    setErrorCarga(false)
    try {
      const [det, preg] = await Promise.all([
        cargarDetalle(jornadaId),
        cargarPreguntas(jornadaId),
      ])
      if (!det) { setErrorCarga(true); return }
      setDetalle(det)
      setPreguntas(preg)

      // Restaurar contexto o poner defaults
      const ctx = det.jornada.contexto
      const firstOp = det.operaciones.find(o => o.disponible)
      const initialAud = ctx?.auditoria_id ?? firstOp?.auditoria_id ?? null
      setAuditoriaActiva(initialAud)

      if (ctx?.question_id) {
        setQuestionActiva(ctx.question_id)
      } else if (preg.length > 0) {
        setQuestionActiva(preg[0].question_id)
      }

      const modulos = [...new Set(preg.map(p => p.modulo))]
      setModuloActivo(modulos[0] ?? null)
    } catch (e) {
      console.error('[EjecucionJornada] cargar', e)
      setErrorCarga(true)
    } finally {
      setCargando(false)
    }
  }, [jornadaId, cargarDetalle, cargarPreguntas])

  useEffect(() => { cargar() }, [cargar])

  // ── Guardar contexto con debounce ──

  function guardarCtx(audId: string, qId: string) {
    if (!jornadaId) return
    if (contextoTimerRef.current) clearTimeout(contextoTimerRef.current)
    contextoTimerRef.current = setTimeout(() => {
      guardarContexto(jornadaId, { auditoria_id: audId, question_id: qId })
        .catch(e => console.error('[EjecucionJornada] guardarContexto', e))
    }, 1000)
  }

  // ── Flush + cambio de operación ──

  async function cambiarOperacion(nuevaAud: string): Promise<boolean> {
    if (nuevaAud === auditoriaActiva) return true
    setSaveError(null)
    const captRef = capturaRef.current
    if (captRef) {
      const hayError = await captRef.flushPendientes()
      if (hayError) {
        const opNombre = detalle?.operaciones.find(o => o.auditoria_id === auditoriaActiva)?.operacion ?? 'la operación'
        setSaveError(`No se pudo guardar en ${opNombre}. Reintenta antes de continuar.`)
        return false
      }
    }
    setAuditoriaActiva(nuevaAud)
    if (questionActiva) guardarCtx(nuevaAud, questionActiva)
    return true
  }

  // ── Flush + cambio de pregunta ──

  async function cambiarPregunta(nuevaQId: string): Promise<boolean> {
    setSaveError(null)
    const captRef = capturaRef.current
    if (captRef && questionActiva !== nuevaQId) {
      const hayError = await captRef.flushPendientes()
      if (hayError) {
        const opNombre = detalle?.operaciones.find(o => o.auditoria_id === auditoriaActiva)?.operacion ?? 'la operación'
        setSaveError(`No se pudo guardar en ${opNombre}. Reintenta antes de continuar.`)
        return false
      }
    }
    setQuestionActiva(nuevaQId)
    if (auditoriaActiva) guardarCtx(auditoriaActiva, nuevaQId)
    return true
  }

  // ── Derivados ──

  const modulos = useMemo(() => [...new Set(preguntas.map(p => p.modulo))], [preguntas])

  const preguntasFiltradas = useMemo(() => {
    let base = preguntas
    if (moduloActivo) base = base.filter(p => p.modulo === moduloActivo)
    if (filtro === 'comunes') base = base.filter(p => p.destinos.length > 1)
    if (filtro === 'pendientes' && auditoriaActiva) {
      base = base.filter(p => {
        const d = p.destinos.find(d => d.auditoria_id === auditoriaActiva)
        return d && !d.respuesta
      })
    }
    return base
  }, [preguntas, moduloActivo, filtro, auditoriaActiva])

  const operacionActiva = detalle?.operaciones.find(o => o.auditoria_id === auditoriaActiva) ?? null
  const questionActivaObj = preguntas.find(p => p.question_id === questionActiva) ?? null
  const destinoActivo = questionActivaObj?.destinos.find(d => d.auditoria_id === auditoriaActiva) ?? null

  // pregunta_id (UUID) para el destino activo
  const preguntaIdActivo = destinoActivo?.pregunta_id ?? null
  const preguntaNoEnCuestionario = questionActiva !== null && auditoriaActiva !== null && destinoActivo === null

  // siguiente operación que tiene la pregunta activa sin responder
  const sigOperacion = useMemo(() => {
    if (!questionActivaObj || !auditoriaActiva) return null
    const ops = detalle?.operaciones ?? []
    for (const op of ops) {
      if (op.auditoria_id === auditoriaActiva) continue
      const d = questionActivaObj.destinos.find(dd => dd.auditoria_id === op.auditoria_id)
      if (d && !d.respuesta && op.disponible) return op
    }
    return null
  }, [questionActivaObj, auditoriaActiva, detalle?.operaciones])

  // siguiente pregunta en el filtrado actual
  const sigPregunta = useMemo(() => {
    const idx = preguntasFiltradas.findIndex(p => p.question_id === questionActiva)
    if (idx < 0 || idx >= preguntasFiltradas.length - 1) return null
    return preguntasFiltradas[idx + 1]
  }, [preguntasFiltradas, questionActiva])

  const totalPendientes = useMemo(() => {
    return detalle?.operaciones.reduce((acc, op) => acc + (op.conteo.pendientes ?? 0) + op.herencia_pendiente + op.issues_abiertos, 0) ?? 0
  }, [detalle?.operaciones])

  // ── Acciones de jornada ──

  async function handleTerminar() {
    if (!jornadaId || terminando) return
    setTerminando(true)
    try {
      await terminarJornada(jornadaId)
      toast.success('Jornada terminada.')
      navigate('/auditor')
    } catch (e) {
      console.error('[EjecucionJornada] terminarJornada', e)
      toast.error('No se pudo terminar la jornada. Reintenta.')
    } finally {
      setTerminando(false)
      setConfirmTerminar(false)
    }
  }

  async function handleRetirar(auditoriaId: string) {
    if (!jornadaId || retirando) return
    setRetirando(true)
    try {
      await retirarOperacion(jornadaId, auditoriaId)
      toast.success('Operación retirada de la jornada.')
      setDetalle(prev => prev ? {
        ...prev,
        operaciones: prev.operaciones.filter(o => o.auditoria_id !== auditoriaId),
      } : prev)
      if (auditoriaActiva === auditoriaId) {
        const first = detalle?.operaciones.find(o => o.auditoria_id !== auditoriaId && o.disponible)
        setAuditoriaActiva(first?.auditoria_id ?? null)
      }
    } catch (e) {
      console.error('[EjecucionJornada] retirarOperacion', e)
      toast.error('No se pudo retirar la operación. Reintenta.')
    } finally {
      setRetirando(false)
      setConfirmRetirar(null)
    }
  }

  // ── Sin conexión detection ──
  useEffect(() => {
    function onOffline() { setSinConexion(true) }
    function onOnline() { setSinConexion(false) }
    window.addEventListener('offline', onOffline)
    window.addEventListener('online', onOnline)
    return () => {
      window.removeEventListener('offline', onOffline)
      window.removeEventListener('online', onOnline)
    }
  }, [])

  const ent = useEntradaPantalla(!cargando && !errorCarga && !!detalle)

  // Fundido del panel de captura al cambiar de PREGUNTA (misma operación), con un desplazamiento mínimo
  // en la dirección del cambio. Sin `key` nuevo ni `exit`: anima el contenedor ya montado. Al cambiar de
  // operación la captura se vuelve a montar y entra con su propio fundido (CapturaPreguntaAuditoria).
  const reducedMotion = useReducedMotion()
  const [capturaScope, animarCaptura] = useAnimate()
  const prevNavRef = useRef<{ q: string | null; idx: number; aud: string | null; cambioOpEn: number }>({
    q: questionActiva, idx: -1, aud: auditoriaActiva, cambioOpEn: 0,
  })
  useLayoutEffect(() => {
    const prev = prevNavRef.current
    const idx = preguntasFiltradas.findIndex(p => p.question_id === questionActiva)
    const cambioOp = prev.aud !== auditoriaActiva
    prevNavRef.current = { q: questionActiva, idx, aud: auditoriaActiva, cambioOpEn: cambioOp ? performance.now() : prev.cambioOpEn }
    if (reducedMotion || cambioOp || prev.q === questionActiva || prev.q === null || questionActiva === null) return
    if (performance.now() - prev.cambioOpEn < 600) return // la captura recién se montó: ya entra con su fundido
    const el = capturaScope.current
    if (!el) return
    const dir = prev.idx >= 0 && idx >= 0 && idx < prev.idx ? -1 : 1
    animarCaptura(el, { opacity: [0, 1], x: [dir * 6, 0] }, { duration: DUR.rapido, ease: EASE_OUT })
  }, [questionActiva, auditoriaActiva]) // eslint-disable-line react-hooks/exhaustive-deps

  // ── Render ────────────────────────────────────────────────────────────────

  if (cargando) {
    return (
      <div className="min-h-screen bg-background px-4 py-6" aria-busy="true" aria-label="Cargando jornada">
        <ListaSkeleton rows={4} />
      </div>
    )
  }

  if (errorCarga || !detalle) {
    return (
      <div className="flex flex-col items-center justify-center min-h-screen px-6">
        <EstadoVacio
          icono={AlertCircle}
          titulo="No se pudo cargar la jornada."
          accion={(
            <Boton variante="secundario" onClick={cargar}>
              <RefreshCw aria-hidden="true" size={14} />
              Reintentar
            </Boton>
          )}
        />
      </div>
    )
  }

  const terminada = detalle.jornada.estado === 'terminada'

  return (
    // Desde md el área de contenido del Layout deja 3.5rem (4rem desde lg) para su barra superior: la
    // pantalla ocupa el resto y cada panel se desplaza por separado.
    <div className="flex flex-col min-h-screen md:min-h-0 md:h-[calc(100dvh-3.5rem)] lg:h-[calc(100dvh-4rem)]" style={{ backgroundColor: 'var(--background)' }}>

      {/* ── Encabezado fijo ── */}
      <ModuloHeader
        tituloFallback="Jornada"
        forzarTitulo={detalle.jornada.nombre}
        subtitulo={`${terminada ? 'Jornada terminada · ' : ''}${fechaCorta(detalle.jornada.fecha)}`}
        onBack={() => navigate('/auditor')}
        acciones={(
          <>
            <Boton
              variante="secundario"
              onClick={() => setPanelPendientes(true)}
              aria-label={`Pendientes (${totalPendientes})`}
            >
              <ClipboardList aria-hidden="true" size={14} />
              <span className="hidden sm:inline">Pendientes</span>
              <Etiqueta tono={totalPendientes > 0 ? 'sky' : 'neutral'}>{totalPendientes}</Etiqueta>
            </Boton>
            {!terminada && (
              <Boton variante="icono" aria-label="Más opciones" aria-haspopup="dialog" aria-expanded={menuAbierto} onClick={() => setMenuAbierto(m => !m)}>
                <MoreVertical aria-hidden="true" size={16} style={{ color: 'var(--muted-foreground)' }} />
              </Boton>
            )}
          </>
        )}
      />

      {/* Sin conexión */}
      <AnimatePresence initial={false}>
      {sinConexion && (
        <motion.div key="sin-conexion" role="status" {...avisoMotion(reducedMotion)} className="flex items-center gap-2 px-4 py-2 border-b" style={{ backgroundColor: 'var(--agro-info-fill)', borderColor: 'var(--agro-info-text)' }}>
          <WifiOff aria-hidden="true" size={13} style={{ color: 'var(--agro-info-text)' }} />
          <p className="text-small font-medium" style={{ color: 'var(--agro-info-text)' }}>
            Sin conexión: los cambios no guardados se perderán si cierras la página.
          </p>
        </motion.div>
      )}
      </AnimatePresence>

      {/* ── Error de guardado ── */}
      <AnimatePresence initial={false}>
      {saveError && (
        <motion.div key="error-guardado" role="alert" {...avisoMotion(reducedMotion)} className="mx-4 mt-3 rounded-xl px-3 py-2.5 flex items-center gap-2 border"
          style={{ backgroundColor: 'var(--agro-danger-fill)', borderColor: 'var(--agro-danger-text)' }}>
          <AlertCircle aria-hidden="true" size={14} className="flex-shrink-0" style={{ color: 'var(--agro-danger-text)' }} />
          <p className="text-small flex-1" style={{ color: 'var(--agro-danger-text)' }}>{saveError}</p>
          <button aria-label="Cerrar" onClick={() => setSaveError(null)} className="flex-shrink-0 relative before:absolute before:content-[''] before:-inset-[15px]">
            <XCircle aria-hidden="true" size={14} style={{ color: 'var(--agro-danger-text)' }} />
          </button>
        </motion.div>
      )}
      </AnimatePresence>

      <motion.main className="flex-1 flex flex-col md:flex-row md:min-h-0 pb-32 md:pb-8" {...ent(0)}>

        {/* ── Panel izquierdo: selector de operación + navigator de preguntas ── */}
        <div className="md:w-64 lg:w-72 md:border-r md:border-border flex-shrink-0 flex flex-col md:min-h-0">

          {/* Selector de operación (mobile: scroll horizontal; desktop: lista vertical) */}
          <div className="px-4 pt-3 pb-2">
            <TituloSeccion as="p" className="mb-2">Operaciones</TituloSeccion>
            <div className="flex gap-2 overflow-x-auto pb-1 -mx-4 px-4 scrollbar-none md:flex-col md:overflow-visible md:pb-0">
              {detalle.operaciones.map(op => (
                <OperacionChip
                  key={op.auditoria_id}
                  op={op}
                  activa={op.auditoria_id === auditoriaActiva}
                  onClick={() => cambiarOperacion(op.auditoria_id)}
                />
              ))}
            </div>
            {operacionActiva && (
              <div className="mt-2 min-w-0">
                <p className="text-xs font-semibold truncate" style={{ color: 'var(--foreground)' }}>
                  {operacionActiva.productor} · {operacionActiva.operacion}
                </p>
                <p className="text-caption" style={{ color: 'var(--muted-foreground)' }}>
                  {formatoPct(avancePct(operacionActiva.conteo))} completado · {operacionActiva.conteo.pendientes ?? 0} pendientes
                </p>
              </div>
            )}
          </div>

          {/* Filtro por módulo: solo si la jornada tiene más de uno */}
          {modulos.length > 1 && (
          <div className="px-4 pt-3">
            <div className="flex gap-1.5 overflow-x-auto pt-2.5 pb-3.5 -mt-2.5 -mb-2.5 -mx-4 px-4 scrollbar-none">
              {modulos.map(m => (
                <button
                  key={m}
                  onClick={() => setModuloActivo(m)}
                  aria-pressed={moduloActivo === m}
                  className="flex-shrink-0 px-2.5 py-1 rounded-lg text-small font-semibold transition-colors focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ring relative before:absolute before:content-[''] before:-inset-y-2.5 before:-inset-x-1"
                  style={{
                    backgroundColor: moduloActivo === m ? 'var(--accent)' : 'var(--muted)',
                    color: moduloActivo === m ? 'var(--accent-foreground)' : 'var(--muted-foreground)',
                  }}
                >
                  Módulo {m}
                </button>
              ))}
            </div>
          </div>
          )}

          {/* Filtros */}
          <div className="px-4 pt-2 pb-1 flex gap-1.5">
            {(['todas', 'pendientes', 'comunes'] as const).map(f => (
              <button
                key={f}
                onClick={() => setFiltro(f)}
                className="flex-shrink-0 text-small font-medium px-2 py-0.5 rounded relative before:absolute before:content-[''] before:-inset-y-3 before:-inset-x-1"
                style={{
                  backgroundColor: filtro === f ? 'var(--foreground)' : 'var(--muted)',
                  color: filtro === f ? 'var(--card)' : 'var(--muted-foreground)',
                }}
              >
                {f === 'todas' ? 'Todas' : f === 'pendientes' ? 'Pendientes' : 'Comunes'}
              </button>
            ))}
          </div>

          {/* Leyenda de los íconos de estado (solo visual: cada punto ya trae su texto para lectores de pantalla) */}
          <p aria-hidden="true" className="px-4 pb-2 flex flex-wrap items-center gap-x-3 gap-y-0.5 text-small text-muted-foreground">
            {ESTADOS_LEYENDA.map(e => (
              <span key={e.nombre} className="inline-flex items-center gap-1">
                <e.Icono size={10} style={{ color: e.color }} />
                {e.nombre}
              </span>
            ))}
          </p>

          {/* Lista de preguntas */}
          <div className="flex-1 overflow-y-auto border-t border-border md:min-h-0">
            {preguntasFiltradas.length === 0 ? (
              <EstadoVacio icono={ClipboardList} titulo="Sin preguntas con este filtro." />
            ) : (
              preguntasFiltradas.map(p => (
                <NavigatorPregunta
                  key={p.question_id}
                  pregunta={p}
                  activa={p.question_id === questionActiva}
                  auditoriaActiva={auditoriaActiva}
                  operaciones={detalle.operaciones}
                  onClick={() => cambiarPregunta(p.question_id)}
                />
              ))
            )}
          </div>
        </div>

        {/* ── Panel derecho: formulario de captura ── */}
        <div className="flex-1 px-4 pt-4 flex flex-col gap-3 md:min-h-0 md:overflow-y-auto">

          {/* Aviso: pregunta no en cuestionario */}
          {preguntaNoEnCuestionario && operacionActiva && (
            <EstadoVacio
              icono={AlertCircle}
              titulo={`Esta pregunta no forma parte del cuestionario de ${operacionActiva.operacion}.`}
              ayuda="Selecciona otra operación que tenga esta pregunta o elige una pregunta distinta."
            />
          )}

          {/* Captura */}
          {!preguntaNoEnCuestionario && preguntaIdActivo && auditoriaActiva && (
            <div ref={capturaScope}>
              <CapturaPreguntaAuditoria
                key={auditoriaActiva}
                ref={capturaRef}
                auditoriaId={auditoriaActiva}
                preguntaId={preguntaIdActivo}
              />
            </div>
          )}

          {/* Placeholder cuando no hay pregunta activa */}
          {!questionActiva && (
            <EstadoVacio icono={ClipboardList} titulo="Selecciona una pregunta" />
          )}

          {/* ── Botones de acción ── */}
          {questionActivaObj && (
            <div className="flex flex-col gap-2">
              {/* Continuar con siguiente operación */}
              {sigOperacion && (
                <Boton onClick={async () => {
                    const ok = await cambiarOperacion(sigOperacion.auditoria_id)
                    if (!ok) return
                  }} className="w-full">
                  Continuar con {sigOperacion.productor} · {sigOperacion.operacion} →
                </Boton>
              )}

              {/* Siguiente pregunta */}
              {sigPregunta && (
                <Boton variante="secundario" onClick={() => cambiarPregunta(sigPregunta.question_id)} className="w-full">
                  <span>Siguiente pregunta</span>
                  <ChevronDown aria-hidden="true" size={14} />
                </Boton>
              )}

              {/* Abrir auditoría completa */}
              {auditoriaActiva && (
                <button
                  onClick={() => navigate(`/auditor/auditoria/${auditoriaActiva}`)}
                  className="flex items-center justify-center gap-1.5 text-xs font-medium py-2"
                  style={{ color: 'var(--muted-foreground)' }}
                >
                  <ExternalLink aria-hidden="true" size={12} />
                  Abrir auditoría completa (validar, cerrar, PDF…)
                </button>
              )}
            </div>
          )}

        </div>
      </motion.main>

      {/* ── Menú de jornada ── */}
      {menuAbierto && (
        <BottomSheet onClose={() => setMenuAbierto(false)} title="Jornada">
          <div className="flex flex-col gap-1 pb-6">

            {/* Agregar operación */}
            <button
              onClick={() => { setMenuAbierto(false); navigate('/auditor/jornada/nueva') }}
              className="flex items-center gap-3 px-4 py-3 rounded-xl text-left active:opacity-70"
              style={{ backgroundColor: 'var(--muted)' }}
            >
              <Plus aria-hidden="true" size={16} style={{ color: 'var(--primary)' }} />
              <span className="text-sm font-medium" style={{ color: 'var(--foreground)' }}>
                Agregar operación
              </span>
            </button>

            {/* Quitar operación activa */}
            {auditoriaActiva && (
              confirmRetirar === auditoriaActiva ? (
                <motion.div {...fundidoEntrada(reducedMotion)} className="rounded-xl border px-4 py-3 flex flex-col gap-2"
                  style={{ backgroundColor: 'var(--agro-info-fill)', borderColor: 'var(--agro-info-text)' }}>
                  <p className="text-xs font-medium" style={{ color: 'var(--agro-info-text)' }}>
                    ¿Quitar "{operacionActiva?.operacion}"? La auditoría no se modifica.
                  </p>
                  <div className="flex gap-2">
                    <button
                      onClick={() => handleRetirar(auditoriaActiva)}
                      disabled={retirando}
                      className="flex-1 h-8 rounded-lg text-xs font-semibold flex items-center justify-center relative before:absolute before:content-[''] before:-inset-y-1.5"
                      style={{ backgroundColor: 'var(--agro-info-fill)', color: 'var(--agro-info-text)', border: '1px solid var(--agro-info-text)' }}
                    >
                      {retirando ? <Loader aria-hidden="true" size={12} className="animate-spin motion-reduce:animate-none" /> : 'Confirmar'}
                    </button>
                    <button
                      onClick={() => setConfirmRetirar(null)}
                      className="flex-1 h-8 rounded-lg text-xs font-semibold relative before:absolute before:content-[''] before:-inset-y-1.5"
                      style={{ backgroundColor: 'var(--muted)', color: 'var(--foreground)', border: '1px solid var(--border)' }}
                    >
                      Cancelar
                    </button>
                  </div>
                </motion.div>
              ) : (
                <button
                  onClick={() => setConfirmRetirar(auditoriaActiva)}
                  className="flex items-center gap-3 px-4 py-3 rounded-xl text-left active:opacity-70"
                  style={{ backgroundColor: 'var(--muted)' }}
                >
                  <Minus aria-hidden="true" size={16} style={{ color: 'var(--muted-foreground)' }} />
                  <span className="text-sm font-medium" style={{ color: 'var(--foreground)' }}>
                    Quitar "{operacionActiva?.operacion}" de la jornada
                  </span>
                </button>
              )
            )}

            <div style={{ height: 1, backgroundColor: 'var(--border)', margin: '4px 0' }} />

            {/* Terminar jornada */}
            {confirmTerminar ? (
              <motion.div {...fundidoEntrada(reducedMotion)} className="rounded-xl border px-4 py-3 flex flex-col gap-2"
                style={{ backgroundColor: 'var(--agro-danger-fill)', borderColor: 'var(--agro-danger-text)' }}>
                <p className="text-xs font-medium" style={{ color: 'var(--agro-danger-text)' }}>
                  ¿Terminar la jornada? Las auditorías no se cierran; puedes seguir editándolas individualmente.
                </p>
                <div className="flex gap-2">
                  <button
                    onClick={handleTerminar}
                    disabled={terminando}
                    className="flex-1 h-8 rounded-lg text-xs font-semibold flex items-center justify-center relative before:absolute before:content-[''] before:-inset-y-1.5"
                    style={{ backgroundColor: 'var(--agro-danger-fill)', color: 'var(--agro-danger-text)', border: '1px solid var(--agro-danger-text)' }}
                  >
                    {terminando ? <Loader aria-hidden="true" size={12} className="animate-spin motion-reduce:animate-none" /> : 'Terminar jornada'}
                  </button>
                  <button
                    onClick={() => setConfirmTerminar(false)}
                    className="flex-1 h-8 rounded-lg text-xs font-semibold relative before:absolute before:content-[''] before:-inset-y-1.5"
                    style={{ backgroundColor: 'var(--muted)', color: 'var(--foreground)', border: '1px solid var(--border)' }}
                  >
                    Cancelar
                  </button>
                </div>
              </motion.div>
            ) : (
              <button
                onClick={() => setConfirmTerminar(true)}
                className="flex items-center gap-3 px-4 py-3 rounded-xl text-left active:opacity-70"
                style={{ backgroundColor: 'var(--muted)' }}
              >
                <XCircle aria-hidden="true" size={16} style={{ color: 'var(--agro-danger-text)' }} />
                <span className="text-sm font-medium" style={{ color: 'var(--agro-danger-text)' }}>
                  Terminar jornada
                </span>
              </button>
            )}
          </div>
        </BottomSheet>
      )}

      {/* ── Panel de pendientes ── */}
      {panelPendientes && detalle && (
        <PendientesPanel
          operaciones={detalle.operaciones}
          preguntas={preguntas}
          onResolver={async (audId, qId) => {
            const okOp = await cambiarOperacion(audId)
            if (!okOp) return
            await cambiarPregunta(qId)
            // Scroll al campo
            setTimeout(() => {
              const el = document.getElementById('captura-pregunta')
              el?.scrollIntoView({ behavior: comportamientoScroll(), block: 'start' })
            }, 100)
          }}
          onAbrir={audId => navigate(`/auditor/auditoria/${audId}`)}
          onClose={() => setPanelPendientes(false)}
        />
      )}

    </div>
  )
}
