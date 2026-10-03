import { useState, useEffect, useRef, useCallback, useMemo } from 'react'
import { useParams, useNavigate } from 'react-router'
import {
  ChevronLeft, AlertCircle, Loader, RefreshCw,
  ClipboardList, ChevronDown, CheckCircle, ExternalLink, MoreVertical,
  Plus, Minus, XCircle, WifiOff,
} from 'lucide-react'
import { toast } from 'sonner'
import { useAuditorJornada } from '@/hooks/useAuditorJornada'
import type {
  JornadaDetalle, JornadaOperacionDetalle, JornadaPregunta, JornadaConteo,
} from '@/hooks/useAuditorJornada'
import { CapturaPreguntaAuditoria } from './CapturaPreguntaAuditoria'
import type { CapturaPreguntaRef } from './CapturaPreguntaAuditoria'
import { BottomSheet } from '@/app/components/BottomSheet'

// ── Helpers ──────────────────────────────────────────────────────────────────

function formatFecha(f: string) {
  const [y, m, d] = f.split('-')
  return `${parseInt(d, 10)} ${['', 'ene', 'feb', 'mar', 'abr', 'may', 'jun', 'jul', 'ago', 'sep', 'oct', 'nov', 'dic'][parseInt(m, 10)]} ${y}`
}

function avancePct(conteo: JornadaConteo): number {
  if (!conteo.total) return 0
  return Math.round(((conteo.resueltas ?? 0) / conteo.total) * 100)
}

type SaveStatusLocal = 'idle' | 'saving' | 'saved' | 'error'

// Estado de respuesta para los puntos del navigator
function colorDestino(resp: string | null, herencia: boolean): string {
  if (herencia) return 'var(--agro-amber)'
  if (!resp) return 'var(--border)'
  if (resp === 'cumplimiento_total' || resp === 'excede_cumplimiento') return 'var(--agro-success-text)'
  if (resp === 'na') return 'var(--muted-foreground)'
  if (resp === 'no_conformidad') return 'var(--agro-danger-text)'
  return 'var(--agro-warning-text)'
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
      disabled={!op.disponible}
      className="flex flex-col gap-1 px-3 py-2 rounded-xl border transition-all flex-shrink-0 disabled:opacity-50 text-left"
      style={{
        minWidth: 160,
        backgroundColor: activa ? 'var(--primary)' : 'var(--card)',
        borderColor: activa ? 'var(--primary)' : 'var(--border)',
        color: activa ? '#fff' : 'var(--foreground)',
      }}
    >
      <p className="text-[11px] font-semibold leading-tight truncate max-w-[140px]">
        {op.productor}
      </p>
      <p className="text-[10px] leading-tight truncate max-w-[140px]" style={{ color: activa ? 'rgba(255,255,255,.8)' : 'var(--muted-foreground)' }}>
        {op.operacion}
      </p>
      <div className="flex items-center gap-1.5 mt-0.5">
        <div
          className="flex-1 h-1 rounded-full overflow-hidden"
          style={{ backgroundColor: activa ? 'rgba(255,255,255,.3)' : 'var(--muted)' }}
        >
          <div
            className="h-full rounded-full"
            style={{ width: `${pct}%`, backgroundColor: activa ? '#fff' : 'var(--primary)' }}
          />
        </div>
        <span className="text-[9px] font-mono" style={{ color: activa ? 'rgba(255,255,255,.8)' : 'var(--muted-foreground)' }}>
          {op.conteo.resueltas ?? 0}/{op.conteo.total}
        </span>
        {op.herencia_pendiente > 0 && (
          <span className="text-[9px] font-bold" style={{ color: activa ? 'rgba(255,255,255,.9)' : 'var(--agro-amber)' }}>
            {op.herencia_pendiente}H
          </span>
        )}
        {op.issues_abiertos > 0 && (
          <span className="text-[9px] font-bold" style={{ color: activa ? 'rgba(255,255,255,.9)' : 'var(--agro-danger-text)' }}>
            {op.issues_abiertos}R
          </span>
        )}
      </div>
      {!op.disponible && op.motivo && (
        <p className="text-[9px]" style={{ color: activa ? 'rgba(255,255,255,.7)' : 'var(--muted-foreground)' }}>
          {op.motivo}
        </p>
      )}
    </button>
  )
}

function NavigatorPregunta({ pregunta, activa, auditoriaActiva, onClick }: {
  pregunta: JornadaPregunta
  activa: boolean
  auditoriaActiva: string | null
  onClick: () => void
}) {
  const destinoActivo = auditoriaActiva
    ? pregunta.destinos.find(d => d.auditoria_id === auditoriaActiva)
    : null

  return (
    <button
      onClick={onClick}
      className="w-full text-left px-4 py-2.5 flex items-center gap-2.5 active:opacity-70 transition-opacity"
      style={{
        backgroundColor: activa ? 'var(--agro-success-fill)' : 'transparent',
        borderBottom: '1px solid var(--border)',
      }}
    >
      {/* Punto del destino activo */}
      <div
        className="w-2.5 h-2.5 rounded-full flex-shrink-0"
        style={{
          backgroundColor: destinoActivo
            ? colorDestino(destinoActivo.respuesta, destinoActivo.herencia_pendiente)
            : 'var(--muted)',
        }}
      />
      <div className="flex-1 min-w-0">
        <div className="flex items-center gap-2">
          <span className="text-[10px] font-mono flex-shrink-0" style={{ color: 'var(--muted-foreground)' }}>
            {pregunta.question_id}
          </span>
          <p className="text-xs truncate" style={{ color: 'var(--foreground)', lineHeight: 1.3 }}>
            {pregunta.texto}
          </p>
        </div>
        {/* Puntos por destino */}
        {pregunta.destinos.length > 1 && (
          <div className="flex gap-1 mt-0.5">
            {pregunta.destinos.map(d => (
              <div
                key={d.auditoria_id}
                className="w-1.5 h-1.5 rounded-full"
                title={d.auditoria_id}
                style={{ backgroundColor: colorDestino(d.respuesta, d.herencia_pendiente) }}
              />
            ))}
          </div>
        )}
      </div>
      {/* No en esta op */}
      {auditoriaActiva && !destinoActivo && (
        <span className="text-[9px] flex-shrink-0" style={{ color: 'var(--muted-foreground)' }}>
          N/A en esta op.
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
                  <p className="text-[10px]" style={{ color: 'var(--muted-foreground)' }}>
                    {pendientesDest.length} sin responder
                    {herenciasDest.length > 0 ? ` · ${herenciasDest.length} por confirmar` : ''}
                    {op.issues_abiertos > 0 ? ` · ${op.issues_abiertos} revisión` : ''}
                  </p>
                </div>
                <button
                  onClick={() => onAbrir(op.auditoria_id)}
                  className="flex items-center gap-1 text-[10px] font-semibold px-2 py-1 rounded-lg"
                  style={{ backgroundColor: 'var(--muted)', color: 'var(--foreground)' }}
                >
                  <ExternalLink size={10} />
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
                    <span className="text-[10px] font-mono mr-1" style={{ color: 'var(--muted-foreground)' }}>{p.question_id}</span>
                    <span className="text-[11px] truncate" style={{ color: 'var(--foreground)' }}>{p.texto}</span>
                  </div>
                </button>
              ))}

              {herenciasDest.slice(0, 3).map(p => (
                <button
                  key={`h-${p.question_id}`}
                  onClick={() => { onClose(); onResolver(op.auditoria_id, p.question_id) }}
                  className="w-full text-left rounded-xl border px-3 py-2 flex items-center gap-2 active:opacity-70"
                  style={{ backgroundColor: 'var(--card)', borderColor: 'var(--agro-amber)' }}
                >
                  <div className="w-2 h-2 rounded-full flex-shrink-0" style={{ backgroundColor: 'var(--agro-amber)' }} />
                  <div className="flex-1 min-w-0">
                    <span className="text-[10px] font-mono mr-1" style={{ color: 'var(--muted-foreground)' }}>{p.question_id}</span>
                    <span className="text-[11px]" style={{ color: 'var(--foreground)' }}>Dato por confirmar</span>
                  </div>
                </button>
              ))}

              {op.issues_abiertos > 0 && (
                <div className="rounded-xl px-3 py-2 flex items-center justify-between"
                  style={{ backgroundColor: 'var(--agro-warning-fill)', border: '1px solid var(--agro-warning-text)' }}>
                  <p className="text-[11px]" style={{ color: 'var(--agro-warning-text)' }}>
                    {op.issues_abiertos} {op.issues_abiertos === 1 ? 'issue de revisión abierto' : 'issues de revisión abiertos'}
                  </p>
                  <button
                    onClick={() => onAbrir(op.auditoria_id)}
                    className="text-[10px] font-semibold underline"
                    style={{ color: 'var(--agro-warning-text)' }}
                  >
                    Resolver
                  </button>
                </div>
              )}
            </div>
          )
        })}

        {operaciones.every(op => op.conteo.pendientes === 0 && op.herencia_pendiente === 0 && op.issues_abiertos === 0) && (
          <div className="flex flex-col items-center gap-2 py-6">
            <CheckCircle size={24} style={{ color: 'var(--agro-success-text)' }} />
            <p className="text-sm font-medium" style={{ color: 'var(--foreground)' }}>Sin pendientes</p>
            <p className="text-xs text-center" style={{ color: 'var(--muted-foreground)' }}>
              Todas las operaciones están al día.
            </p>
          </div>
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

  // ── Render ────────────────────────────────────────────────────────────────

  if (cargando) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <Loader size={24} className="animate-spin" style={{ color: 'var(--muted-foreground)' }} />
      </div>
    )
  }

  if (errorCarga || !detalle) {
    return (
      <div className="flex flex-col items-center justify-center min-h-screen px-6 gap-4">
        <AlertCircle size={28} style={{ color: 'var(--agro-danger-text)' }} />
        <p className="text-sm text-center" style={{ color: 'var(--muted-foreground)' }}>
          No se pudo cargar la jornada.
        </p>
        <button
          onClick={cargar}
          className="flex items-center gap-1.5 text-sm font-semibold px-4 py-2 rounded-xl"
          style={{ backgroundColor: 'var(--muted)', color: 'var(--foreground)' }}
        >
          <RefreshCw size={14} />
          Reintentar
        </button>
      </div>
    )
  }

  const terminada = detalle.jornada.estado === 'terminada'

  return (
    <div className="flex flex-col min-h-screen" style={{ backgroundColor: 'var(--background)' }}>

      {/* ── Encabezado fijo ── */}
      <header
        className="sticky top-0 z-20 border-b border-border"
        style={{ backgroundColor: 'var(--card)' }}
      >
        {/* Fila principal */}
        <div className="flex items-center gap-2 px-4 py-3">
          <button
            onClick={() => navigate('/auditor')}
            className="w-8 h-8 rounded-lg flex items-center justify-center focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary flex-shrink-0"
            aria-label="Volver"
          >
            <ChevronLeft size={18} style={{ color: 'var(--foreground)' }} />
          </button>

          <div className="flex-1 min-w-0">
            <p className="text-[11px] font-semibold uppercase tracking-wide" style={{ color: 'var(--muted-foreground)' }}>
              {terminada ? 'Jornada terminada' : 'Jornada'} · {formatFecha(detalle.jornada.fecha)}
            </p>
            <p className="text-sm font-semibold truncate" style={{ color: 'var(--foreground)' }}>
              {detalle.jornada.nombre}
            </p>
          </div>

          {/* Pendientes badge */}
          <button
            onClick={() => setPanelPendientes(true)}
            className="flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg text-[11px] font-semibold flex-shrink-0"
            style={{
              backgroundColor: totalPendientes > 0 ? 'var(--agro-warning-fill)' : 'var(--muted)',
              color: totalPendientes > 0 ? 'var(--agro-warning-text)' : 'var(--muted-foreground)',
            }}
          >
            <ClipboardList size={12} />
            Pendientes ({totalPendientes})
          </button>

          {/* Menu jornada */}
          {!terminada && (
            <button
              onClick={() => setMenuAbierto(m => !m)}
              className="w-8 h-8 rounded-lg flex items-center justify-center flex-shrink-0 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary"
            >
              <MoreVertical size={16} style={{ color: 'var(--muted-foreground)' }} />
            </button>
          )}
        </div>

        {/* Subheader: operación activa */}
        {operacionActiva && (
          <div
            className="px-4 py-2 border-t border-border flex items-center justify-between"
            style={{ backgroundColor: 'var(--muted)' }}
          >
            <div className="flex-1 min-w-0">
              <p className="text-xs font-semibold truncate" style={{ color: 'var(--foreground)' }}>
                {operacionActiva.productor} · {operacionActiva.operacion}
              </p>
              <p className="text-[10px]" style={{ color: 'var(--muted-foreground)' }}>
                {avancePct(operacionActiva.conteo)}% completado · {operacionActiva.conteo.pendientes ?? 0} pendientes
              </p>
            </div>
          </div>
        )}

        {/* Sin conexión */}
        {sinConexion && (
          <div className="flex items-center gap-2 px-4 py-2 border-t" style={{ backgroundColor: 'var(--agro-warning-fill)', borderColor: 'var(--agro-warning-text)' }}>
            <WifiOff size={13} style={{ color: 'var(--agro-warning-text)' }} />
            <p className="text-[11px] font-medium" style={{ color: 'var(--agro-warning-text)' }}>
              Sin conexión: los cambios no guardados se perderán si cierras la página.
            </p>
          </div>
        )}
      </header>

      {/* ── Error de guardado ── */}
      {saveError && (
        <div className="mx-4 mt-3 rounded-xl px-3 py-2.5 flex items-center gap-2 border"
          style={{ backgroundColor: 'var(--agro-danger-fill)', borderColor: 'var(--agro-danger-text)' }}>
          <AlertCircle size={14} className="flex-shrink-0" style={{ color: 'var(--agro-danger-text)' }} />
          <p className="text-[11px] flex-1" style={{ color: 'var(--agro-danger-text)' }}>{saveError}</p>
          <button onClick={() => setSaveError(null)} className="flex-shrink-0">
            <XCircle size={14} style={{ color: 'var(--agro-danger-text)' }} />
          </button>
        </div>
      )}

      <main className="flex-1 flex flex-col lg:flex-row pb-32">

        {/* ── Panel izquierdo: selector de operación + navigator de preguntas ── */}
        <div className="lg:w-72 lg:border-r lg:border-border flex-shrink-0 flex flex-col">

          {/* Selector de operación (mobile: scroll horizontal; desktop: lista vertical) */}
          <div className="px-4 pt-3 pb-2">
            <p className="text-[10px] font-semibold uppercase tracking-wide mb-2" style={{ color: 'var(--muted-foreground)' }}>
              Operaciones
            </p>
            <div className="flex gap-2 overflow-x-auto pb-1 -mx-4 px-4 scrollbar-none lg:flex-col lg:overflow-visible lg:pb-0">
              {detalle.operaciones.map(op => (
                <OperacionChip
                  key={op.auditoria_id}
                  op={op}
                  activa={op.auditoria_id === auditoriaActiva}
                  onClick={() => cambiarOperacion(op.auditoria_id)}
                />
              ))}
            </div>
          </div>

          {/* Tabs por módulo */}
          <div className="px-4 pt-3">
            <div className="flex gap-1.5 overflow-x-auto pb-1 -mx-4 px-4 scrollbar-none">
              {modulos.map(m => (
                <button
                  key={m}
                  onClick={() => setModuloActivo(m)}
                  className="flex-shrink-0 px-2.5 py-1 rounded-lg text-[11px] font-semibold transition-colors"
                  style={{
                    backgroundColor: moduloActivo === m ? 'var(--primary)' : 'var(--muted)',
                    color: moduloActivo === m ? '#fff' : 'var(--muted-foreground)',
                  }}
                >
                  {m}
                </button>
              ))}
            </div>
          </div>

          {/* Filtros */}
          <div className="px-4 pt-2 pb-1 flex gap-1.5">
            {(['todas', 'pendientes', 'comunes'] as const).map(f => (
              <button
                key={f}
                onClick={() => setFiltro(f)}
                className="flex-shrink-0 text-[10px] font-medium px-2 py-0.5 rounded"
                style={{
                  backgroundColor: filtro === f ? 'var(--foreground)' : 'var(--muted)',
                  color: filtro === f ? 'var(--card)' : 'var(--muted-foreground)',
                }}
              >
                {f === 'todas' ? 'Todas' : f === 'pendientes' ? 'Pendientes' : 'Comunes'}
              </button>
            ))}
          </div>

          {/* Lista de preguntas */}
          <div className="flex-1 overflow-y-auto border-t border-border lg:max-h-[calc(100vh-280px)]">
            {preguntasFiltradas.length === 0 ? (
              <p className="px-4 py-4 text-xs text-center" style={{ color: 'var(--muted-foreground)' }}>
                Sin preguntas con este filtro.
              </p>
            ) : (
              preguntasFiltradas.map(p => (
                <NavigatorPregunta
                  key={p.question_id}
                  pregunta={p}
                  activa={p.question_id === questionActiva}
                  auditoriaActiva={auditoriaActiva}
                  onClick={() => cambiarPregunta(p.question_id)}
                />
              ))
            )}
          </div>
        </div>

        {/* ── Panel derecho: formulario de captura ── */}
        <div className="flex-1 px-4 pt-4 flex flex-col gap-3">

          {/* Aviso: pregunta no en cuestionario */}
          {preguntaNoEnCuestionario && operacionActiva && (
            <div className="rounded-xl border border-dashed border-border p-5 flex flex-col items-center gap-2">
              <AlertCircle size={20} style={{ color: 'var(--muted-foreground)', opacity: 0.5 }} />
              <p className="text-sm text-center" style={{ color: 'var(--foreground)' }}>
                Esta pregunta no forma parte del cuestionario de <strong>{operacionActiva.operacion}</strong>.
              </p>
              <p className="text-xs text-center" style={{ color: 'var(--muted-foreground)' }}>
                Selecciona otra operación que tenga esta pregunta o elige una pregunta distinta.
              </p>
            </div>
          )}

          {/* Captura */}
          {!preguntaNoEnCuestionario && preguntaIdActivo && auditoriaActiva && (
            <CapturaPreguntaAuditoria
              key={auditoriaActiva}
              ref={capturaRef}
              auditoriaId={auditoriaActiva}
              preguntaId={preguntaIdActivo}
            />
          )}

          {/* Placeholder cuando no hay pregunta activa */}
          {!questionActiva && (
            <div className="rounded-xl border border-dashed border-border p-8 flex flex-col items-center gap-2">
              <ClipboardList size={28} style={{ color: 'var(--muted-foreground)', opacity: 0.4 }} />
              <p className="text-sm font-medium" style={{ color: 'var(--foreground)' }}>
                Selecciona una pregunta
              </p>
            </div>
          )}

          {/* ── Botones de acción ── */}
          {questionActivaObj && (
            <div className="flex flex-col gap-2">
              {/* Continuar con siguiente operación */}
              {sigOperacion && (
                <button
                  onClick={async () => {
                    const ok = await cambiarOperacion(sigOperacion.auditoria_id)
                    if (!ok) return
                  }}
                  className="w-full h-11 rounded-xl text-sm font-semibold flex items-center justify-center gap-2 active:opacity-70 transition-opacity"
                  style={{ backgroundColor: 'var(--primary)', color: '#fff' }}
                >
                  Continuar con {sigOperacion.productor} · {sigOperacion.operacion} →
                </button>
              )}

              {/* Siguiente pregunta */}
              {sigPregunta && (
                <button
                  onClick={() => cambiarPregunta(sigPregunta.question_id)}
                  className="w-full h-11 rounded-xl text-sm font-semibold flex items-center justify-center gap-2 active:opacity-70 transition-opacity border border-border"
                  style={{ backgroundColor: 'var(--card)', color: 'var(--foreground)' }}
                >
                  <span>Siguiente pregunta</span>
                  <ChevronDown size={14} />
                </button>
              )}

              {/* Abrir auditoría completa */}
              {auditoriaActiva && (
                <button
                  onClick={() => navigate(`/auditor/auditoria/${auditoriaActiva}`)}
                  className="flex items-center justify-center gap-1.5 text-xs font-medium py-2"
                  style={{ color: 'var(--muted-foreground)' }}
                >
                  <ExternalLink size={12} />
                  Abrir auditoría completa (validar, cerrar, PDF…)
                </button>
              )}
            </div>
          )}

        </div>
      </main>

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
              <Plus size={16} style={{ color: 'var(--primary)' }} />
              <span className="text-sm font-medium" style={{ color: 'var(--foreground)' }}>
                Agregar operación
              </span>
            </button>

            {/* Quitar operación activa */}
            {auditoriaActiva && (
              confirmRetirar === auditoriaActiva ? (
                <div className="rounded-xl border px-4 py-3 flex flex-col gap-2"
                  style={{ backgroundColor: 'var(--agro-warning-fill)', borderColor: 'var(--agro-warning-text)' }}>
                  <p className="text-xs font-medium" style={{ color: 'var(--agro-warning-text)' }}>
                    ¿Quitar "{operacionActiva?.operacion}"? La auditoría no se modifica.
                  </p>
                  <div className="flex gap-2">
                    <button
                      onClick={() => handleRetirar(auditoriaActiva)}
                      disabled={retirando}
                      className="flex-1 h-8 rounded-lg text-xs font-semibold flex items-center justify-center"
                      style={{ backgroundColor: 'var(--agro-warning-text)', color: '#fff' }}
                    >
                      {retirando ? <Loader size={12} className="animate-spin" /> : 'Confirmar'}
                    </button>
                    <button
                      onClick={() => setConfirmRetirar(null)}
                      className="flex-1 h-8 rounded-lg text-xs font-semibold"
                      style={{ backgroundColor: 'var(--muted)', color: 'var(--foreground)', border: '1px solid var(--border)' }}
                    >
                      Cancelar
                    </button>
                  </div>
                </div>
              ) : (
                <button
                  onClick={() => setConfirmRetirar(auditoriaActiva)}
                  className="flex items-center gap-3 px-4 py-3 rounded-xl text-left active:opacity-70"
                  style={{ backgroundColor: 'var(--muted)' }}
                >
                  <Minus size={16} style={{ color: 'var(--muted-foreground)' }} />
                  <span className="text-sm font-medium" style={{ color: 'var(--foreground)' }}>
                    Quitar "{operacionActiva?.operacion}" de la jornada
                  </span>
                </button>
              )
            )}

            <div style={{ height: 1, backgroundColor: 'var(--border)', margin: '4px 0' }} />

            {/* Terminar jornada */}
            {confirmTerminar ? (
              <div className="rounded-xl border px-4 py-3 flex flex-col gap-2"
                style={{ backgroundColor: 'var(--agro-danger-fill)', borderColor: 'var(--agro-danger-text)' }}>
                <p className="text-xs font-medium" style={{ color: 'var(--agro-danger-text)' }}>
                  ¿Terminar la jornada? Las auditorías no se cierran; puedes seguir editándolas individualmente.
                </p>
                <div className="flex gap-2">
                  <button
                    onClick={handleTerminar}
                    disabled={terminando}
                    className="flex-1 h-8 rounded-lg text-xs font-semibold flex items-center justify-center"
                    style={{ backgroundColor: 'var(--agro-danger-text)', color: '#fff' }}
                  >
                    {terminando ? <Loader size={12} className="animate-spin" /> : 'Terminar jornada'}
                  </button>
                  <button
                    onClick={() => setConfirmTerminar(false)}
                    className="flex-1 h-8 rounded-lg text-xs font-semibold"
                    style={{ backgroundColor: 'var(--muted)', color: 'var(--foreground)', border: '1px solid var(--border)' }}
                  >
                    Cancelar
                  </button>
                </div>
              </div>
            ) : (
              <button
                onClick={() => setConfirmTerminar(true)}
                className="flex items-center gap-3 px-4 py-3 rounded-xl text-left active:opacity-70"
                style={{ backgroundColor: 'var(--muted)' }}
              >
                <XCircle size={16} style={{ color: 'var(--agro-danger-text)' }} />
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
              el?.scrollIntoView({ behavior: 'smooth', block: 'start' })
            }, 100)
          }}
          onAbrir={audId => navigate(`/auditor/auditoria/${audId}`)}
          onClose={() => setPanelPendientes(false)}
        />
      )}

    </div>
  )
}
