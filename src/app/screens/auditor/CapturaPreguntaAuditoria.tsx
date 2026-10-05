import {
  useState, useRef, useEffect, forwardRef, useImperativeHandle,
  useCallback,
} from 'react'
import {
  CheckCircle, AlertCircle, Loader, AlertTriangle,
  BarChart2, Pencil, X, Flag, Plus, History, Paperclip, XCircle,
} from 'lucide-react'
import { toast } from 'sonner'
import { supabase } from '@/lib/supabase'
import { useAuditorAuditoria, GuardadoIncompleto } from '@/hooks/useAuditorAuditoria'
import type { AudRespuesta, AudPregunta, AudComentarioEsquema } from '@/types/database.types'
import { useReglasRama } from '@/hooks/useReglasRama'
import type { ReglaRama, CausaNA, AplicarResultado, RetirarResultado } from '@/hooks/useReglasRama'
import { SCORE_MATRIX, RESP_TO_CLASS } from '@/lib/scoring/matriz'
import type { ScoreMatrixKey } from '@/lib/scoring/matriz'
import { BottomSheet } from '@/app/components/BottomSheet'
import { EvidenciaPanel } from './EvidenciaPanel'

type SaveStatus = 'idle' | 'saving' | 'saved' | 'error'

export interface AjusteInfo {
  puntos_manual: number | null
  ajuste_motivo: string | null
  ajuste_estado: string | null
  ajuste_en: string | null
}

export interface CapturaPreguntaRef {
  flushPendientes: () => Promise<boolean>
  getSaveStatus: () => SaveStatus
}

interface Props {
  auditoriaId: string
  preguntaId: string
  onEstadoGuardado?: (status: SaveStatus) => void
  // Shared hooks — pass from parent when rendering many questions simultaneously
  sharedHook?: ReturnType<typeof useAuditorAuditoria>
  sharedReglas?: ReturnType<typeof useReglasRama>
  // Hallazgos
  canWriteNC?: boolean
  canAuditWrite?: boolean
  hallazgosCount?: number
  onRegistrarHallazgo?: () => void
  onVerHallazgos?: () => void
  // Reincidencia
  reincidencia?: { reincidente: boolean; mensaje: string }
  // Callbacks for parent side effects
  onRespuestaChanged?: (pregId: string, resp: AudRespuesta) => void
  onAjusteActualizado?: (pregId: string, ajuste: AjusteInfo | null) => void
  onScoringInvalidated?: () => void
  onAfterSave?: (pregId: string) => void
}

const RESP_OPTIONS: { value: AudRespuesta; label: string; activeStyle: { bg: string; color: string } }[] = [
  { value: 'cumplimiento_total', label: 'CT',  activeStyle: { bg: 'var(--agro-success-fill)', color: 'var(--agro-success-text)' } },
  { value: 'deficiencia_menor',  label: 'D−',  activeStyle: { bg: 'var(--agro-warning-fill)', color: 'var(--agro-warning-text)' } },
  { value: 'deficiencia_mayor',  label: 'D+',  activeStyle: { bg: 'var(--agro-warning-fill)', color: 'var(--agro-warning-text)' } },
  { value: 'no_conformidad',     label: 'NC',  activeStyle: { bg: 'var(--agro-danger-fill)',  color: 'var(--agro-danger-text)'  } },
  { value: 'na',                 label: 'N/A', activeStyle: { bg: 'var(--muted)',             color: 'var(--muted-foreground)'  } },
]

const RESP_OPTIONS_M9: { value: AudRespuesta; label: string; activeStyle: { bg: string; color: string } }[] = [
  { value: 'excede_cumplimiento', label: 'Excede',    activeStyle: { bg: 'var(--agro-success-fill)', color: 'var(--agro-success-text)' } },
  { value: 'cumplimiento_total',  label: 'Total',     activeStyle: { bg: 'var(--agro-success-fill)', color: 'var(--agro-success-text)' } },
  { value: 'no_conformidad',      label: 'No cumple', activeStyle: { bg: 'var(--agro-danger-fill)',  color: 'var(--agro-danger-text)'  } },
  { value: 'na',                  label: 'N/A',       activeStyle: { bg: 'var(--muted)',             color: 'var(--muted-foreground)'  } },
]

const RESP_TOOLTIPS: Record<AudRespuesta, string> = {
  excede_cumplimiento: 'Excede cumplimiento',
  cumplimiento_total:  'Cumplimiento total',
  deficiencia_menor:   'Deficiencia menor',
  deficiencia_mayor:   'Deficiencia mayor',
  no_conformidad:      'No conformidad',
  na:                  'No aplica',
}

const CLASS_TO_RESP: Partial<Record<string, AudRespuesta>> = {
  TOTAL:           'cumplimiento_total',
  MINOR:           'deficiencia_menor',
  MAJOR:           'deficiencia_mayor',
  NON_COMPLIANCE:  'no_conformidad',
}

const VALID_MAX_SET: Set<number> = new Set([15, 10, 5, 3])

function traducirError(err: unknown): string {
  const e = err as { message?: string; code?: string }
  const msg = e?.message ?? String(err)
  if (e?.code === '42501' || msg.toLowerCase().includes('row-level security') || msg.toLowerCase().includes('policy')) {
    return 'Sin permiso para guardar en esta empresa.'
  }
  if (msg.toLowerCase().includes('fetch') || msg.toLowerCase().includes('network') || msg.toLowerCase().includes('offline')) {
    return 'Sin conexión; no se guardó. Reintenta.'
  }
  console.error('[CapturaPregunta]', err)
  return 'No se pudo guardar. Reintenta.'
}

// ── CampoEsquema ──────────────────────────────────────────────────────────────

function CampoEsquema({
  esquema, value, onChange, onBlur, disabled, herenciaEstado,
}: {
  esquema: AudComentarioEsquema
  value: string
  onChange: (v: string) => void
  onBlur: () => void
  disabled: boolean
  herenciaEstado?: 'sin_confirmar' | 'revalidar'
}) {
  const base: React.CSSProperties = {
    width: '100%',
    borderRadius: 'var(--radius)',
    border: herenciaEstado
      ? '1.5px dashed var(--agro-blue)'
      : '1px solid var(--border)',
    backgroundColor: disabled ? 'var(--muted)' : 'var(--input-background)',
    color: 'var(--foreground)',
    padding: '0.375rem 0.625rem',
    fontSize: '0.8125rem',
    outline: 'none',
  }
  return (
    <div className="flex flex-col gap-1">
      <label className="text-[11px] font-medium" style={{ color: 'var(--muted-foreground)' }}>
        {esquema.etiqueta ?? esquema.campo_clave}
        {esquema.requerido && <span style={{ color: 'var(--agro-red)' }}> *</span>}
      </label>
      {esquema.tipo === 'seleccion' && esquema.opciones ? (
        <select
          value={value}
          onChange={e => onChange(e.target.value)}
          onBlur={onBlur}
          disabled={disabled}
          style={{ ...base, height: '2.25rem' }}
        >
          <option value="">Seleccionar…</option>
          {esquema.opciones.map(op => <option key={op} value={op}>{op}</option>)}
        </select>
      ) : (
        <input
          type={esquema.tipo === 'fecha' ? 'date' : esquema.tipo_campo === 'number' ? 'number' : 'text'}
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

// ── Main component ────────────────────────────────────────────────────────────

export const CapturaPreguntaAuditoria = forwardRef<CapturaPreguntaRef, Props>(
  function CapturaPreguntaAuditoria(
    {
      auditoriaId, preguntaId, onEstadoGuardado,
      sharedHook, sharedReglas,
      canWriteNC, hallazgosCount,
      onRegistrarHallazgo, onVerHallazgos,
      reincidencia,
      onRespuestaChanged, onAjusteActualizado, onScoringInvalidated, onAfterSave,
    },
    ref,
  ) {
    // ── Hook selection ────────────────────────────────────────────────────────
    const internalHook = useAuditorAuditoria(sharedHook ? undefined : auditoriaId)
    const hook = sharedHook ?? internalHook
    const {
      auditoria, modulosData, esquemaMap,
      respuestasMap, setRespuestasMap,
      valoresMap, setValoresMap,
      observacionesMap, setObservacionesMap,
      instanciasMap, ajustesMap, setAjustesMap,
      estadoAplicabilidadMap,
      herenciaMap, recargarHerencia,
      guardarRespuesta, guardarComentarios,
      cargando, errorMsg,
    } = hook

    const internalReglas = useReglasRama(sharedHook ? undefined : auditoriaId)
    const {
      reglasPorPrincipal, reglasPorMiembroC, causasPorPregunta,
      aplicarRegla, retirarRegla, confirmarRevision, refrescar: refrescarReglas,
    } = sharedReglas ?? internalReglas

    const cerrada = auditoria?.estado === 'cerrada' || auditoria?.estado === 'completada'

    // ── Save state ────────────────────────────────────────────────────────────
    const [saveStatus, setSaveStatus] = useState<SaveStatus>('idle')
    const [saveMessage, setSaveMessage] = useState('')

    const respRef = useRef(respuestasMap)
    const valsRef = useRef(valoresMap)
    const obsRef  = useRef(observacionesMap)
    useEffect(() => { respRef.current = respuestasMap }, [respuestasMap])
    useEffect(() => { valsRef.current = valoresMap },    [valoresMap])
    useEffect(() => { obsRef.current  = observacionesMap }, [observacionesMap])

    useEffect(() => {
      setSaveStatus('idle')
      setSaveMessage('')
    }, [preguntaId])

    const pendingRef = useRef<{
      pregId: string | null
      args: { resp: AudRespuesta; vals: Map<string, string>; obs: string | undefined; obsExistia: boolean } | null
      timer: ReturnType<typeof setTimeout> | null
      promise: Promise<void> | null
    }>({ pregId: null, args: null, timer: null, promise: null })

    const executeSave = useCallback(async (
      pregId: string,
      args: { resp: AudRespuesta; vals: Map<string, string>; obs: string | undefined; obsExistia: boolean },
    ): Promise<void> => {
      setSaveStatus('saving')
      setSaveMessage('')
      const allPregs = modulosData.flatMap(m => m.preguntas)
      const preg = allPregs.find(p => p.id === pregId)
      const promise = guardarRespuesta({
        preguntaId: pregId,
        respuesta: args.resp,
        trigger: preg?.trigger_falla_automatica ?? 'ninguno',
        valoresMap: args.vals,
        observacion: args.obs,
        obsExistia: args.obsExistia,
      })
        .then(() => {
          pendingRef.current.promise = null
          setSaveStatus('saved')
          setSaveMessage('')
          onEstadoGuardado?.('saved')
          onAfterSave?.(pregId)
          onScoringInvalidated?.()
          setTimeout(() => setSaveStatus(s => s === 'saved' ? 'idle' : s), 2500)
        })
        .catch((err: unknown) => {
          pendingRef.current.promise = null
          const msg = err instanceof GuardadoIncompleto
            ? `Dato por confirmar incompleto (${err.etapa}). Reintenta.`
            : traducirError(err)
          setSaveStatus('error')
          setSaveMessage(msg)
          onEstadoGuardado?.('error')
        })
      pendingRef.current.promise = promise
      return promise
    }, [guardarRespuesta, modulosData, onEstadoGuardado, onAfterSave, onScoringInvalidated]) // eslint-disable-line react-hooks/exhaustive-deps

    const flushPendientes = useCallback(async (): Promise<boolean> => {
      const p = pendingRef.current
      if (p.timer !== null) {
        clearTimeout(p.timer)
        p.timer = null
      }
      if (p.args !== null && p.pregId !== null) {
        const args   = p.args
        const pregId = p.pregId
        p.args = null
        try {
          await executeSave(pregId, args)
          return false
        } catch {
          return true
        }
      }
      if (p.promise !== null) {
        try {
          await p.promise
          return saveStatus === 'error'
        } catch {
          return true
        }
      }
      return saveStatus === 'error'
    }, [executeSave, saveStatus])

    useImperativeHandle(ref, () => ({
      flushPendientes,
      getSaveStatus: () => saveStatus,
    }), [flushPendientes, saveStatus])

    function scheduleSave(pregId: string, resp: AudRespuesta) {
      const vals      = valsRef.current.get(pregId) ?? new Map<string, string>()
      const obs       = obsRef.current.get(pregId)
      const obsExistia = obsRef.current.has(pregId)
      const args = { resp, vals, obs, obsExistia }

      if (pendingRef.current.timer !== null) {
        clearTimeout(pendingRef.current.timer)
        pendingRef.current.timer = null
      }
      pendingRef.current.pregId = pregId
      pendingRef.current.args   = args

      const timer = setTimeout(() => {
        pendingRef.current.args  = null
        pendingRef.current.timer = null
        executeSave(pregId, args).catch(() => { /* handled in executeSave */ })
      }, 50)
      pendingRef.current.timer = timer
    }

    function scheduleBlurSave(pregId: string) {
      if (pendingRef.current.timer !== null) {
        clearTimeout(pendingRef.current.timer)
        pendingRef.current.timer = null
      }
      const resp = respRef.current.get(pregId)
      if (resp) {
        const vals       = valsRef.current.get(pregId) ?? new Map<string, string>()
        const obs        = obsRef.current.get(pregId)
        const obsExistia = obsRef.current.has(pregId)
        const args = { resp, vals, obs, obsExistia }
        pendingRef.current.pregId = pregId
        pendingRef.current.args   = args
        const timer = setTimeout(() => {
          pendingRef.current.args  = null
          pendingRef.current.timer = null
          executeSave(pregId, args).catch(() => { /* handled */ })
        }, 400)
        pendingRef.current.timer = timer
      } else {
        const vals       = valsRef.current.get(pregId) ?? new Map<string, string>()
        const obs        = obsRef.current.get(pregId)
        const obsExistia = obsRef.current.has(pregId)
        if (vals.size === 0 && obs === undefined) return
        const timer = setTimeout(() => {
          setSaveStatus('saving')
          guardarComentarios({ preguntaId: pregId, valoresMap: vals, observacion: obs, obsExistia })
            .then(() => {
              setSaveStatus('saved')
              setTimeout(() => setSaveStatus(s => s === 'saved' ? 'idle' : s), 2500)
            })
            .catch((err: unknown) => { setSaveStatus('error'); setSaveMessage(traducirError(err)) })
        }, 400)
        pendingRef.current.timer = timer
      }
    }

    // ── Handlers ──────────────────────────────────────────────────────────────

    function handleRespuesta(pregId: string, resp: AudRespuesta) {
      // Mirror the BD trigger trg_aud_ip_limpiar_ajuste: clear ajuste when response changes
      const prevResp = hook.respuestasMap.get(pregId)
      if (prevResp !== resp && hook.ajustesMap.has(pregId)) {
        hook.setAjustesMap(prev => { const next = new Map(prev); next.delete(pregId); return next })
      }
      setRespuestasMap(prev => new Map(prev).set(pregId, resp))
      scheduleSave(pregId, resp)
      onRespuestaChanged?.(pregId, resp)
    }

    function handleValor(pregId: string, esquemaId: string, v: string) {
      setValoresMap(prev => {
        const next   = new Map(prev)
        const campos = new Map(next.get(pregId) ?? [])
        campos.set(esquemaId, v)
        next.set(pregId, campos)
        return next
      })
    }

    function handleObservacion(pregId: string, v: string) {
      setObservacionesMap(prev => new Map(prev).set(pregId, v))
    }

    // ── Herencia state ────────────────────────────────────────────────────────
    const [herenciaAcciones, setHerenciaAcciones] = useState<Map<string, string>>(new Map())
    const [escribiendoOtro, setEscribiendoOtro]   = useState<Set<string>>(new Set())

    useEffect(() => {
      if (!escribiendoOtro.size) return
      setEscribiendoOtro(prev => {
        const next = new Set(prev)
        for (const eid of prev) {
          const h = herenciaMap.get(`${preguntaId}:${eid}`)
          if (!h || (h.estado !== 'sin_confirmar' && h.estado !== 'revalidar')) next.delete(eid)
        }
        return next.size === prev.size ? prev : next
      })
    }, [herenciaMap]) // eslint-disable-line react-hooks/exhaustive-deps

    function fmtHerenciaTs(ts: string | null): string {
      if (!ts) return ''
      return new Date(ts).toLocaleDateString('es-MX', { day: '2-digit', month: 'short', year: 'numeric' })
    }

    async function handleConfirmarHerencia(valorId: string) {
      try {
        const { error } = await supabase.rpc('aud_herencia_confirmar', { p_valor_id: valorId })
        if (error) throw error
        await recargarHerencia()
        onScoringInvalidated?.()
      } catch (e) {
        console.error('[CapturaPregunta] confirmarHerencia', e)
      }
    }

    async function handleRechazarHerencia(valorId: string) {
      try {
        const { error } = await supabase.rpc('aud_herencia_rechazar', { p_valor_id: valorId })
        if (error) throw error
        await recargarHerencia()
        onScoringInvalidated?.()
      } catch (e) {
        console.error('[CapturaPregunta] rechazarHerencia', e)
      }
    }

    async function handleResolverHerencia(valorId: string, res: 'propio' | 'propuesto') {
      try {
        const { error } = await supabase.rpc('aud_herencia_resolver', { p_valor_id: valorId, p_resolucion: res })
        if (error) throw error
        await recargarHerencia()
        onScoringInvalidated?.()
      } catch (e) {
        console.error('[CapturaPregunta] resolverHerencia', e)
      }
    }

    // ── Ajuste manual state ───────────────────────────────────────────────────
    const [ajusteOpen, setAjusteOpen]           = useState(false)
    const [puntosInput, setPuntosInput]         = useState('')
    const [descuentoInput, setDescuentoInput]   = useState('')
    const [motivoInput, setMotivoInput]         = useState('')
    const ajusteEventIdRef                       = useRef<string | null>(null)
    const [enviandoAjuste, setEnviandoAjuste]   = useState(false)
    const [ajusteWarning, setAjusteWarning]     = useState<{
      tipo: 'OTHER_CATEGORY' | 'OFF_MATRIX'
      mensaje: string
      clasificacion_sugerida?: string
    } | null>(null)
    const [quitandoAjuste, setQuitandoAjuste]   = useState(false)

    // ── Reglas de rama state ──────────────────────────────────────────────────
    const [reglaExpandidaId, setReglaExpandidaId]               = useState<string | null>(null)
    const [reglaExplicacion, setReglaExplicacion]               = useState('')
    const [reglaConfirmaciones, setReglaConfirmaciones]         = useState<Record<string, boolean>>({})
    const reglaEventIdRef                                        = useRef<string | null>(null)
    const [aplicandoReglaId, setAplicandoReglaId]               = useState<string | null>(null)
    const [reglaConflictos, setReglaConflictos]                 = useState<Array<{ question_id: string; tipo: 'respuesta' | 'hallazgo'; valor: string }> | null>(null)
    const [reglaFaltantes, setReglaFaltantes]                   = useState<string[] | null>(null)
    const [retirandoReglaId, setRetirandoReglaId]               = useState<string | null>(null)
    const [motivoRetiro, setMotivoRetiro]                       = useState('')
    const retirarEventIdRef                                      = useRef<string | null>(null)
    const [retirandoEnCurso, setRetirandoEnCurso]               = useState(false)
    const [retiroResultado, setRetiroResultado]                 = useState<RetirarResultado | null>(null)
    const [confirmandoRevision, setConfirmandoRevision]         = useState(false)
    const [sugerenciaCId, setSugerenciaCId]                     = useState<string | null>(null)
    const [sugerenciaCExplicacion, setSugerenciaCExplicacion]   = useState('')
    const [aplicandoSugerenciaC, setAplicandoSugerenciaC]       = useState(false)
    const sugerenciaCEventIdRef                                  = useRef<string | null>(null)

    // ── EvidenciaPanel state ──────────────────────────────────────────────────
    const [evidenciaOpen, setEvidenciaOpen] = useState(false)

    // ── Render guards ─────────────────────────────────────────────────────────
    if (cargando) {
      return (
        <div className="flex items-center justify-center py-12">
          <Loader size={20} className="animate-spin" style={{ color: 'var(--muted-foreground)' }} />
        </div>
      )
    }

    if (errorMsg) {
      return (
        <div className="rounded-xl border border-dashed border-border p-6 flex flex-col items-center gap-2">
          <AlertCircle size={20} style={{ color: 'var(--agro-danger-text)' }} />
          <p className="text-sm text-center" style={{ color: 'var(--muted-foreground)' }}>
            No se pudo cargar la auditoría.
          </p>
        </div>
      )
    }

    const pregunta = modulosData.flatMap(m => m.preguntas).find(p => p.id === preguntaId) as AudPregunta | undefined

    if (!pregunta) {
      return (
        <div className="rounded-xl border border-dashed border-border p-6">
          <p className="text-sm text-center" style={{ color: 'var(--muted-foreground)' }}>
            Selecciona una pregunta para capturar.
          </p>
        </div>
      )
    }

    const esquemas       = esquemaMap.get(preguntaId) ?? []
    const respuesta      = respuestasMap.get(preguntaId)
    const valores        = valoresMap.get(preguntaId) ?? new Map<string, string>()
    const observacion    = observacionesMap.get(preguntaId) ?? ''
    const instanciaId    = instanciasMap.get(preguntaId)
    const ajuste         = ajustesMap.get(preguntaId)
    const estadoAplicabilidad = estadoAplicabilidadMap.get(preguntaId)
    const causasNA       = causasPorPregunta.get(preguntaId) ?? []
    const reglasPrincipal = reglasPorPrincipal.get(pregunta.question_id) ?? []
    const reglasC        = reglasPorMiembroC.get(pregunta.question_id) ?? []

    const esNaPorRama       = estadoAplicabilidad === 'na_rama'
    const esRevisionPendiente = estadoAplicabilidad === 'revision_pendiente'
    const bloqueado         = cerrada || esNaPorRama

    const opciones = pregunta.es_cualitativa ? RESP_OPTIONS_M9 : RESP_OPTIONS

    const falla = respuesta && respuesta !== 'na' &&
      ((pregunta.trigger_falla_automatica === 'cualquier_descuento' && respuesta !== 'cumplimiento_total') ||
       (pregunta.trigger_falla_automatica === 'solo_cero' && respuesta === 'no_conformidad'))

    // Scoring matrix
    const hasValidMax    = VALID_MAX_SET.has(pregunta.max_puntos) && !!respuesta && respuesta in RESP_TO_CLASS
    const matrizMax      = hasValidMax ? pregunta.max_puntos as ScoreMatrixKey : null
    const matrizClase    = (hasValidMax && respuesta) ? RESP_TO_CLASS[respuesta as keyof typeof RESP_TO_CLASS] : null
    const matrizObtenido = (matrizMax && matrizClase) ? SCORE_MATRIX[matrizMax][matrizClase] : null
    const matrizDescuento = (matrizMax != null && matrizObtenido != null) ? matrizMax - matrizObtenido : null

    const puedeAjustar = !cerrada && !esNaPorRama && !pregunta.es_cualitativa &&
      pregunta.tipo !== 'information_gathering' && hasValidMax && !!instanciaId

    // Ajuste panel state derived values
    const puntosNum    = parseInt(puntosInput, 10)
    const puntosValido = !isNaN(puntosNum) && puntosNum >= 0 && puntosNum <= (matrizMax ?? 0) && String(puntosNum) === puntosInput.trim()
    const difiere      = puntosValido && matrizObtenido != null && puntosNum !== matrizObtenido
    const motivoValido = !difiere || motivoInput.trim().length > 0
    const puedeConfirmar = puntosValido && motivoValido && !enviandoAjuste

    let errorPuntos: string | null = null
    if (puntosInput !== '' && !puntosValido) {
      if (isNaN(puntosNum) || String(puntosNum) !== puntosInput.trim()) errorPuntos = 'Solo se permiten números enteros'
      else if (puntosNum < 0 || puntosNum > (matrizMax ?? 0)) errorPuntos = `El valor debe estar entre 0 y ${matrizMax}`
    }

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

    async function handleConfirmarAjuste() {
      if (!puedeConfirmar || !instanciaId) return
      if (!ajusteEventIdRef.current) ajusteEventIdRef.current = crypto.randomUUID()
      setEnviandoAjuste(true)
      try {
        const { data, error } = await supabase.rpc('aud_ajustar_puntaje', {
          p_instancia_id: instanciaId,
          p_puntos:       puntosNum,
          p_motivo:       motivoInput.trim(),
          p_event_id:     ajusteEventIdRef.current,
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
          ajuste_en:     new Date().toISOString(),
        }
        // Update shared map and notify parent
        hook.setAjustesMap(prev => new Map(prev).set(preguntaId, nuevoAjuste))
        onAjusteActualizado?.(preguntaId, nuevoAjuste)
        onScoringInvalidated?.()
        setAjusteOpen(false)
        if (r.estado === 'MANUAL_MATCHES_MATRIX') {
          toast.success('Coincide con la matriz PrimusGFS')
        } else if (r.estado === 'MANUAL_OTHER_CATEGORY') {
          setAjusteWarning({ tipo: 'OTHER_CATEGORY', mensaje: r.mensaje, clasificacion_sugerida: r.clasificacion_sugerida })
        } else {
          setAjusteWarning({ tipo: 'OFF_MATRIX', mensaje: 'Valor fuera de la matriz: escenario interno en conflicto, no es puntaje normativo.' })
        }
      } catch (e) {
        console.error('[CapturaPregunta] aud_ajustar_puntaje', e)
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
          p_event_id:     crypto.randomUUID(),
        })
        if (error) {
          toast.error(error.message ?? 'No se pudo quitar el ajuste. Reintenta.')
          return
        }
        hook.setAjustesMap(prev => { const next = new Map(prev); next.delete(preguntaId); return next })
        onAjusteActualizado?.(preguntaId, null)
        onScoringInvalidated?.()
        setAjusteWarning(null)
        toast.success('Ajuste quitado')
      } catch (e) {
        console.error('[CapturaPregunta] aud_quitar_ajuste', e)
        toast.error('No se pudo quitar el ajuste. Reintenta.')
      } finally {
        setQuitandoAjuste(false)
      }
    }

    // ── Reglas helpers ────────────────────────────────────────────────────────

    async function handleAplicarRegla(
      reglaId: string, explicacion: string,
      confirmaciones: Record<string, boolean>, forzar: boolean, eventId: string,
    ): Promise<AplicarResultado> {
      const r = await aplicarRegla(reglaId, explicacion, confirmaciones, forzar, eventId)
      if (r.estado === 'APLICADA') {
        toast.success(r.mensaje)
        await refrescarReglas()
        onScoringInvalidated?.()
      }
      return r
    }

    async function handleRetirarRegla(reglaId: string, motivo: string, eventId: string): Promise<RetirarResultado> {
      const r = await retirarRegla(reglaId, motivo, eventId)
      await refrescarReglas()
      onScoringInvalidated?.()
      return r
    }

    async function handleConfirmarRevision() {
      await confirmarRevision(preguntaId)
      onScoringInvalidated?.()
    }

    // ── Render ────────────────────────────────────────────────────────────────
    return (
      <div className="flex flex-col gap-4">
        <div
          className="rounded-xl border border-border bg-card px-4 py-4 flex flex-col gap-3"
          style={falla ? { borderColor: 'var(--agro-red)', borderWidth: '1.5px' } : undefined}
        >
          {/* ── Encabezado ── */}
          <div className="flex items-start gap-2 flex-wrap">
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
            <p className="text-sm flex-1 min-w-0" style={{ color: 'var(--foreground)', lineHeight: '1.45' }}>
              {pregunta.texto}
            </p>
          </div>

          {/* ── Botones de respuesta ── */}
          {esNaPorRama ? (
            <div
              className="rounded-lg px-3 py-2 text-[11px] font-medium"
              style={{ backgroundColor: 'var(--muted)', color: 'var(--muted-foreground)' }}
            >
              N/A por regla de rama — no editable aquí.
            </div>
          ) : (
            <div className="flex gap-1.5">
              {opciones.map(opt => {
                const active = respuesta === opt.value
                return (
                  <button
                    key={opt.value}
                    onClick={() => !bloqueado && handleRespuesta(preguntaId, opt.value)}
                    disabled={bloqueado}
                    title={opt.label}
                    className="flex-1 min-w-0 h-10 rounded-lg text-xs font-bold border transition-all disabled:opacity-50"
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
          )}

          {pregunta.es_cualitativa && (
            <p className="text-[10px]" style={{ color: 'var(--muted-foreground)' }}>
              MIP es un complemento cualitativo; no afecta el puntaje de los demás módulos.
            </p>
          )}

          {/* ── Sugerencia clase C ── */}
          {respuesta === 'na' && !esNaPorRama && reglasC.length > 0 && reglasC.map(regla => {
            const otrosNumerales = regla.dependientes.filter(d => d !== pregunta.question_id)
            if (otrosNumerales.length === 0 || regla.aplicada) return null
            const esSugerenciaAbierta = sugerenciaCId === regla.id
            return (
              <div
                key={regla.id}
                className="rounded-lg px-3 py-2 flex flex-col gap-2"
                style={{ backgroundColor: 'var(--agro-success-fill)', border: '1px solid var(--agro-success-text)' }}
              >
                <p className="text-[11px] font-medium" style={{ color: 'var(--agro-success-text)' }}>
                  La causa "{regla.causa}" aplica también a {otrosNumerales.join(', ')}
                </p>
                {!esSugerenciaAbierta ? (
                  <div className="flex gap-2">
                    <button
                      onClick={() => { setSugerenciaCId(regla.id); setSugerenciaCExplicacion(''); sugerenciaCEventIdRef.current = null }}
                      className="flex-1 h-7 rounded-lg text-[10px] font-semibold"
                      style={{ backgroundColor: 'var(--primary)', color: '#fff' }}
                    >
                      Sí, aplicar también
                    </button>
                    <button
                      onClick={() => setSugerenciaCId(null)}
                      className="h-7 px-3 rounded-lg text-[10px]"
                      style={{ backgroundColor: 'var(--muted)', color: 'var(--foreground)', border: '1px solid var(--border)' }}
                    >
                      No
                    </button>
                  </div>
                ) : (
                  <div className="flex flex-col gap-2">
                    <textarea
                      value={sugerenciaCExplicacion}
                      onChange={e => setSugerenciaCExplicacion(e.target.value)}
                      rows={2}
                      placeholder="Explicación obligatoria…"
                      className="resize-none text-[0.8125rem] outline-none"
                      style={{
                        borderRadius: 'var(--radius)',
                        border: `1px solid ${!sugerenciaCExplicacion.trim() ? 'var(--agro-red)' : 'var(--border)'}`,
                        backgroundColor: 'var(--input-background)',
                        color: 'var(--foreground)',
                        padding: '0.375rem 0.625rem',
                      }}
                    />
                    <div className="flex gap-2">
                      <button
                        disabled={!sugerenciaCExplicacion.trim() || aplicandoSugerenciaC}
                        onClick={async () => {
                          if (!sugerenciaCExplicacion.trim()) return
                          if (!sugerenciaCEventIdRef.current) sugerenciaCEventIdRef.current = crypto.randomUUID()
                          setAplicandoSugerenciaC(true)
                          try {
                            const r = await handleAplicarRegla(regla.id, sugerenciaCExplicacion.trim(), {}, false, sugerenciaCEventIdRef.current)
                            sugerenciaCEventIdRef.current = null
                            if (r.estado === 'APLICADA') setSugerenciaCId(null)
                            else toast.warning(r.mensaje)
                          } catch { /* handled */ }
                          finally { setAplicandoSugerenciaC(false) }
                        }}
                        className="flex-1 h-7 rounded-lg text-[10px] font-semibold flex items-center justify-center gap-1 disabled:opacity-50"
                        style={{ backgroundColor: 'var(--primary)', color: '#fff' }}
                      >
                        {aplicandoSugerenciaC ? <><Loader size={10} className="animate-spin" /> Aplicando…</> : 'Confirmar'}
                      </button>
                      <button
                        onClick={() => setSugerenciaCId(null)}
                        className="flex-1 h-7 rounded-lg text-[10px]"
                        style={{ backgroundColor: 'var(--muted)', color: 'var(--foreground)', border: '1px solid var(--border)' }}
                      >
                        Cancelar
                      </button>
                    </div>
                  </div>
                )}
              </div>
            )
          })}

          {/* ── N/A por rama — causas activas ── */}
          {esNaPorRama && causasNA.length > 0 && (
            <div
              className="rounded-lg px-3 py-2 flex flex-col gap-1"
              style={{ backgroundColor: 'var(--muted)', border: '1px solid var(--border)' }}
            >
              {causasNA.map((causa, i) => (
                <div key={i} className="flex flex-col gap-0.5">
                  <p className="text-[11px] font-semibold" style={{ color: 'var(--muted-foreground)' }}>
                    N/A — {causa.causa}
                  </p>
                  {causa.explicacion && (
                    <p className="text-[10px]" style={{ color: 'var(--muted-foreground)' }}>{causa.explicacion}</p>
                  )}
                  {causa.created_at && (
                    <p className="text-[10px]" style={{ color: 'var(--muted-foreground)' }}>
                      {new Date(causa.created_at).toLocaleDateString('es-MX')}
                    </p>
                  )}
                </div>
              ))}
            </div>
          )}

          {/* ── Revisión pendiente ── */}
          {esRevisionPendiente && (
            <div
              className="rounded-lg px-3 py-2 flex flex-col gap-2"
              style={{ backgroundColor: 'var(--agro-warning-fill)', border: '1px solid var(--agro-amber)' }}
            >
              <div className="flex items-start gap-2">
                <AlertTriangle size={14} className="flex-shrink-0 mt-0.5" style={{ color: 'var(--agro-warning-text)' }} />
                <div className="flex flex-col gap-1 flex-1">
                  <p className="text-[11px] font-semibold" style={{ color: 'var(--agro-warning-text)' }}>
                    Reactivada tras retirar una regla
                    {respuesta && respuesta !== 'na' && ` — respuesta anterior: ${RESP_TOOLTIPS[respuesta]}`}
                  </p>
                  <p className="text-[10px]" style={{ color: 'var(--agro-warning-text)' }}>
                    Confirma o cambia la respuesta para que vuelva a contar.
                  </p>
                </div>
              </div>
              {!cerrada && (
                <button
                  onClick={async () => {
                    setConfirmandoRevision(true)
                    try { await handleConfirmarRevision() } catch { /* handled */ }
                    finally { setConfirmandoRevision(false) }
                  }}
                  disabled={confirmandoRevision}
                  className="self-start h-7 px-3 rounded-lg text-[10px] font-semibold flex items-center gap-1 disabled:opacity-50"
                  style={{ backgroundColor: 'var(--agro-warning-text)', color: '#fff' }}
                >
                  {confirmandoRevision
                    ? <><Loader size={10} className="animate-spin" /> Confirmando…</>
                    : 'Confirmar respuesta anterior'}
                </button>
              )}
            </div>
          )}

          {/* ── Reglas de rama clase A/B ── */}
          {!esNaPorRama && reglasPrincipal.length > 0 && reglasPrincipal.map(regla => {
            const estaAplicada  = regla.aplicada
            const expandida     = reglaExpandidaId === regla.id
            const esClaseB      = !regla.habilitada
            const retirandoEsta = retirandoReglaId === regla.id

            return (
              <div
                key={regla.id}
                className="rounded-lg flex flex-col overflow-hidden"
                style={{ border: '1px solid var(--border)', backgroundColor: 'var(--card)' }}
              >
                <div className="px-3 py-2 flex items-start justify-between gap-2">
                  <div className="flex flex-col gap-0.5 flex-1 min-w-0">
                    <p className="text-[11px] font-semibold" style={{ color: 'var(--foreground)' }}>
                      {regla.causa}
                      {regla.dependientes.length > 0 && (
                        <span className="font-normal" style={{ color: 'var(--muted-foreground)' }}>
                          {' '}→ N/A en {regla.dependientes.length} {regla.dependientes.length === 1 ? 'pregunta' : 'preguntas'}
                        </span>
                      )}
                    </p>
                    {esClaseB && (
                      <p className="text-[10px]" style={{ color: 'var(--muted-foreground)' }}>
                        Dependencias sugeridas: requieren revisión
                      </p>
                    )}
                  </div>
                  {!esClaseB && (
                    estaAplicada ? (
                      <button
                        onClick={() => { setRetirandoReglaId(regla.id); setMotivoRetiro(''); retirarEventIdRef.current = null; setRetiroResultado(null) }}
                        className="flex-shrink-0 h-6 px-2 rounded text-[10px] font-medium"
                        style={{ backgroundColor: 'var(--muted)', color: 'var(--foreground)', border: '1px solid var(--border)' }}
                      >
                        Retirar
                      </button>
                    ) : (
                      <button
                        onClick={() => {
                          if (expandida) {
                            setReglaExpandidaId(null)
                          } else {
                            setReglaExpandidaId(regla.id)
                            setReglaExplicacion('')
                            setReglaConfirmaciones({})
                            reglaEventIdRef.current = null
                            setReglaConflictos(null)
                            setReglaFaltantes(null)
                          }
                        }}
                        className="flex-shrink-0 h-6 px-2 rounded text-[10px] font-semibold"
                        style={
                          expandida
                            ? { backgroundColor: 'var(--muted)', color: 'var(--foreground)' }
                            : { backgroundColor: 'var(--primary)', color: '#fff' }
                        }
                      >
                        {expandida ? 'Cancelar' : 'Aplicar'}
                      </button>
                    )
                  )}
                </div>

                {/* Panel de aplicar (clase A no aplicada, expandida) */}
                {!esClaseB && !estaAplicada && expandida && (
                  <div
                    className="border-t border-border px-3 pb-3 pt-2 flex flex-col gap-2"
                    style={{ backgroundColor: 'var(--muted)' }}
                  >
                    <p className="text-[11px] font-semibold" style={{ color: 'var(--foreground)' }}>
                      Se marcarán N/A estas {regla.dependientes.length} preguntas:
                    </p>
                    <p className="text-[10px] font-mono" style={{ color: 'var(--muted-foreground)' }}>
                      {regla.dependientes.join(' · ')}
                    </p>
                    {regla.principal_conserva && respuesta && respuesta !== 'na' && (
                      <p className="text-[10px]" style={{ color: 'var(--agro-success-text)' }}>
                        El principal conserva su respuesta: {RESP_TOOLTIPS[respuesta] ?? respuesta}
                      </p>
                    )}
                    {regla.condiciones.length > 0 && (
                      <div className="flex flex-col gap-1">
                        <p className="text-[10px] font-medium" style={{ color: 'var(--foreground)' }}>Confirmar condiciones:</p>
                        {regla.condiciones.map(cond => (
                          <label key={cond.clave} className="flex items-start gap-2 cursor-pointer">
                            <input
                              type="checkbox"
                              checked={reglaConfirmaciones[cond.clave] ?? false}
                              onChange={e => setReglaConfirmaciones(prev => ({ ...prev, [cond.clave]: e.target.checked }))}
                              className="mt-0.5 flex-shrink-0"
                              style={{ accentColor: 'var(--primary)' }}
                            />
                            <span
                              className="text-[11px]"
                              style={{ color: reglaFaltantes?.includes(cond.clave) ? 'var(--agro-danger-text)' : 'var(--foreground)' }}
                            >
                              {cond.texto}
                            </span>
                          </label>
                        ))}
                        {reglaFaltantes && reglaFaltantes.length > 0 && (
                          <p className="text-[10px]" style={{ color: 'var(--agro-danger-text)' }}>
                            Marca todas las condiciones para continuar.
                          </p>
                        )}
                      </div>
                    )}
                    <div className="flex flex-col gap-1">
                      <label className="text-[10px] font-medium" style={{ color: 'var(--foreground)' }}>
                        Explicación <span style={{ color: 'var(--agro-red)' }}>*</span>
                      </label>
                      <textarea
                        value={reglaExplicacion}
                        onChange={e => setReglaExplicacion(e.target.value)}
                        rows={2}
                        placeholder="Obligatoria — describe el motivo de esta N/A por rama…"
                        className="resize-none text-[0.8125rem] outline-none"
                        style={{
                          borderRadius: 'var(--radius)',
                          border: '1px solid var(--border)',
                          backgroundColor: 'var(--input-background)',
                          color: 'var(--foreground)',
                          padding: '0.375rem 0.625rem',
                        }}
                      />
                    </div>

                    {reglaConflictos && reglaConflictos.length > 0 && (
                      <div
                        className="flex flex-col gap-1 rounded-lg px-3 py-2"
                        style={{ backgroundColor: 'var(--agro-warning-fill)' }}
                      >
                        <p className="text-[11px] font-semibold" style={{ color: 'var(--agro-warning-text)' }}>
                          Conflictos encontrados — revisar antes de continuar:
                        </p>
                        {reglaConflictos.map((c, i) => (
                          <p key={i} className="text-[10px]" style={{ color: 'var(--agro-warning-text)' }}>
                            {c.question_id}: {c.tipo === 'respuesta' ? `respuesta capturada: ${c.valor}` : `hallazgo abierto: ${c.valor}`}
                          </p>
                        ))}
                      </div>
                    )}

                    <div className="flex gap-2">
                      <button
                        disabled={!reglaExplicacion.trim() || !!aplicandoReglaId}
                        onClick={async () => {
                          if (!reglaExplicacion.trim()) return
                          if (!reglaEventIdRef.current) reglaEventIdRef.current = crypto.randomUUID()
                          setAplicandoReglaId(regla.id)
                          setReglaConflictos(null)
                          setReglaFaltantes(null)
                          try {
                            const r = await handleAplicarRegla(regla.id, reglaExplicacion.trim(), reglaConfirmaciones, false, reglaEventIdRef.current)
                            if (r.estado === 'APLICADA') {
                              reglaEventIdRef.current = null
                              setReglaExpandidaId(null)
                            } else if (r.estado === 'CONFLICTO') {
                              setReglaConflictos(r.conflictos ?? [])
                            } else if (r.estado === 'CONDICIONES_INCOMPLETAS') {
                              setReglaFaltantes(r.faltantes ?? [])
                            } else {
                              toast.warning(r.mensaje)
                            }
                          } catch { /* handled */ }
                          finally { setAplicandoReglaId(null) }
                        }}
                        className="flex-1 h-8 rounded-lg text-[11px] font-semibold flex items-center justify-center gap-1 disabled:opacity-50"
                        style={{ backgroundColor: 'var(--primary)', color: '#fff' }}
                      >
                        {aplicandoReglaId === regla.id
                          ? <><Loader size={11} className="animate-spin" /> Aplicando…</>
                          : 'Confirmar N/A en dependientes'}
                      </button>
                      {reglaConflictos && reglaConflictos.length > 0 && (
                        <button
                          disabled={!reglaExplicacion.trim() || !!aplicandoReglaId}
                          onClick={async () => {
                            if (!reglaExplicacion.trim()) return
                            reglaEventIdRef.current = crypto.randomUUID()
                            setAplicandoReglaId(regla.id)
                            try {
                              const r = await handleAplicarRegla(regla.id, reglaExplicacion.trim(), reglaConfirmaciones, true, reglaEventIdRef.current)
                              if (r.estado === 'APLICADA') {
                                reglaEventIdRef.current = null
                                setReglaExpandidaId(null)
                                setReglaConflictos(null)
                              } else {
                                toast.warning(r.mensaje)
                              }
                            } catch { /* handled */ }
                            finally { setAplicandoReglaId(null) }
                          }}
                          className="flex-shrink-0 h-8 px-3 rounded-lg text-[11px] font-semibold flex items-center gap-1 disabled:opacity-50"
                          style={{ backgroundColor: 'var(--agro-warning-text)', color: '#fff' }}
                        >
                          Confirmar de todos modos
                        </button>
                      )}
                    </div>
                  </div>
                )}

                {/* Estado aplicado (clase A) */}
                {!esClaseB && estaAplicada && (
                  <div className="border-t border-border px-3 py-2" style={{ backgroundColor: 'var(--agro-success-fill)' }}>
                    <p className="text-[11px]" style={{ color: 'var(--agro-success-text)' }}>
                      N/A aplicado · {regla.dependientes.length} {regla.dependientes.length === 1 ? 'pregunta' : 'preguntas'} afectadas
                      {regla.dependientes_na.length > 0 && ` (${regla.dependientes_na.length} siguen N/A)`}
                    </p>
                  </div>
                )}

                {/* Clase B — lista de dependientes */}
                {esClaseB && regla.dependientes.length > 0 && (
                  <div className="border-t border-border px-3 py-2" style={{ backgroundColor: 'var(--muted)' }}>
                    <p className="text-[10px] font-mono" style={{ color: 'var(--muted-foreground)' }}>
                      {regla.dependientes.join(' · ')}
                    </p>
                  </div>
                )}

                {/* Panel de retiro */}
                {!esClaseB && retirandoEsta && (
                  <div
                    className="border-t border-border px-3 pb-3 pt-2 flex flex-col gap-2"
                    style={{ backgroundColor: 'var(--muted)' }}
                  >
                    {retiroResultado ? (
                      <div className="flex flex-col gap-1">
                        <p className="text-[11px] font-semibold" style={{ color: 'var(--agro-success-text)' }}>Regla retirada</p>
                        {retiroResultado.reactivadas.length > 0 && (
                          <p className="text-[10px]" style={{ color: 'var(--foreground)' }}>
                            Reactivadas: {retiroResultado.reactivadas.join(', ')}
                          </p>
                        )}
                        {retiroResultado.siguen_na_por_otra_causa.length > 0 && (
                          <p className="text-[10px]" style={{ color: 'var(--muted-foreground)' }}>
                            Siguen N/A por otra causa: {retiroResultado.siguen_na_por_otra_causa.join(', ')}
                          </p>
                        )}
                        {retiroResultado.revision_pendiente.length > 0 && (
                          <p className="text-[10px]" style={{ color: 'var(--agro-warning-text)' }}>
                            Pendientes de revisión: {retiroResultado.revision_pendiente.join(', ')}
                          </p>
                        )}
                        <button
                          onClick={() => { setRetirandoReglaId(null); setRetiroResultado(null) }}
                          className="self-start h-6 px-2 rounded text-[10px]"
                          style={{ backgroundColor: 'var(--card)', color: 'var(--foreground)', border: '1px solid var(--border)' }}
                        >
                          Cerrar
                        </button>
                      </div>
                    ) : (
                      <>
                        <label className="text-[10px] font-medium" style={{ color: 'var(--foreground)' }}>
                          Motivo del retiro (opcional)
                        </label>
                        <textarea
                          value={motivoRetiro}
                          onChange={e => setMotivoRetiro(e.target.value)}
                          rows={2}
                          placeholder="Describe el motivo…"
                          className="resize-none text-[0.8125rem] outline-none"
                          style={{
                            borderRadius: 'var(--radius)',
                            border: '1px solid var(--border)',
                            backgroundColor: 'var(--input-background)',
                            color: 'var(--foreground)',
                            padding: '0.375rem 0.625rem',
                          }}
                        />
                        <div className="flex gap-2">
                          <button
                            disabled={retirandoEnCurso}
                            onClick={async () => {
                              if (!retirarEventIdRef.current) retirarEventIdRef.current = crypto.randomUUID()
                              setRetirandoEnCurso(true)
                              try {
                                const r = await handleRetirarRegla(regla.id, motivoRetiro.trim(), retirarEventIdRef.current)
                                retirarEventIdRef.current = null
                                setRetiroResultado(r)
                              } catch { /* handled */ }
                              finally { setRetirandoEnCurso(false) }
                            }}
                            className="flex-1 h-7 rounded-lg text-[10px] font-semibold flex items-center justify-center gap-1 disabled:opacity-50"
                            style={{ backgroundColor: 'var(--primary)', color: '#fff' }}
                          >
                            {retirandoEnCurso
                              ? <><Loader size={10} className="animate-spin" /> Retirando…</>
                              : 'Confirmar retiro'}
                          </button>
                          <button
                            onClick={() => { setRetirandoReglaId(null); setMotivoRetiro('') }}
                            className="flex-1 h-7 rounded-lg text-[10px]"
                            style={{ backgroundColor: 'var(--muted)', color: 'var(--foreground)', border: '1px solid var(--border)' }}
                          >
                            Cancelar
                          </button>
                        </div>
                      </>
                    )}
                  </div>
                )}
              </div>
            )
          })}

          {/* ── N/A chip — excluida del denominador ── */}
          {!pregunta.es_cualitativa && respuesta === 'na' && pregunta.permite_na && !esNaPorRama && (
            <div
              className="rounded-lg px-3 py-2 text-[11px]"
              style={{ backgroundColor: 'var(--muted)', color: 'var(--muted-foreground)' }}
            >
              N/A — excluida del denominador de puntaje
            </div>
          )}

          {/* ── Chip de scoring matrix ── */}
          {!pregunta.es_cualitativa && hasValidMax && matrizMax && matrizClase && matrizObtenido != null && (() => {
            const esTotal = matrizClase === 'TOTAL'
            const esNC    = matrizClase === 'NON_COMPLIANCE'
            const bg      = esTotal ? 'var(--agro-success-fill)' : esNC ? 'var(--agro-danger-fill)' : 'var(--agro-warning-fill)'
            const color   = esTotal ? 'var(--agro-success-text)' : esNC ? 'var(--agro-danger-text)' : 'var(--agro-warning-text)'
            const desc    = matrizDescuento ?? 0
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

          {/* ── Chip de ajuste manual vigente ── */}
          {!pregunta.es_cualitativa && ajuste?.puntos_manual != null && matrizMax != null && (
            <div
              className="rounded-lg px-3 py-2 flex flex-col gap-1.5"
              style={{
                backgroundColor: ajuste.ajuste_estado === 'MANUAL_MATCHES_MATRIX' ? 'var(--agro-success-fill)' : 'var(--agro-warning-fill)',
                border: `1px solid ${ajuste.ajuste_estado === 'MANUAL_MATCHES_MATRIX' ? 'var(--agro-success-text)' : 'var(--agro-amber)'}`,
              }}
            >
              <div className="flex items-center justify-between gap-2">
                <div className="flex items-center gap-1.5">
                  <Pencil
                    size={11}
                    style={{
                      color: ajuste.ajuste_estado === 'MANUAL_MATCHES_MATRIX' ? 'var(--agro-success-text)' : 'var(--agro-warning-text)',
                      flexShrink: 0,
                    }}
                  />
                  <span
                    className="text-[11px] font-semibold"
                    style={{ color: ajuste.ajuste_estado === 'MANUAL_MATCHES_MATRIX' ? 'var(--agro-success-text)' : 'var(--agro-warning-text)' }}
                  >
                    Ajuste manual: {ajuste.puntos_manual}/{matrizMax}
                  </span>
                  <span
                    className="text-[10px] px-1.5 py-0.5 rounded"
                    style={{
                      backgroundColor: 'rgba(0,0,0,0.07)',
                      color: ajuste.ajuste_estado === 'MANUAL_MATCHES_MATRIX' ? 'var(--agro-success-text)' : 'var(--agro-warning-text)',
                    }}
                  >
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
                            handleRespuesta(preguntaId, resp)
                            hook.setAjustesMap(prev => { const next = new Map(prev); next.delete(preguntaId); return next })
                            onAjusteActualizado?.(preguntaId, null)
                            setAjusteWarning(null)
                          }
                        }}
                        className="self-start text-[10px] font-semibold px-2 py-0.5 rounded"
                        style={{ backgroundColor: 'var(--primary)', color: '#fff' }}
                      >
                        Cambiar clasificación a{' '}
                        {ajusteWarning.clasificacion_sugerida === 'MINOR' ? 'Menor'
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

          {/* Aviso OTHER_CATEGORY cuando el chip de ajuste aún no aparece */}
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
            <div
              className="rounded-xl p-3 flex flex-col gap-2.5"
              style={{ backgroundColor: 'var(--muted)', border: '1px solid var(--border)' }}
            >
              <div className="flex items-center justify-between">
                <p className="text-[11px] font-semibold" style={{ color: 'var(--foreground)' }}>
                  Ajuste manual de puntuación
                </p>
                <button onClick={() => setAjusteOpen(false)} style={{ color: 'var(--muted-foreground)' }}>
                  <X size={14} />
                </button>
              </div>
              <div className="flex gap-3">
                <div className="flex flex-col gap-1 flex-1">
                  <label className="text-[10px] font-medium" style={{ color: 'var(--muted-foreground)' }}>
                    Puntos otorgados
                  </label>
                  <input
                    type="number"
                    min={0}
                    max={matrizMax}
                    step={1}
                    value={puntosInput}
                    onChange={e => handlePuntosChange(e.target.value)}
                    className="h-9 rounded-lg px-2 text-sm outline-none text-center"
                    style={{
                      border: `1px solid ${errorPuntos ? 'var(--agro-red)' : 'var(--border)'}`,
                      backgroundColor: 'var(--input-background)',
                      color: 'var(--foreground)',
                    }}
                  />
                </div>
                <div className="flex flex-col gap-1 flex-1">
                  <label className="text-[10px] font-medium" style={{ color: 'var(--muted-foreground)' }}>
                    Descuento
                  </label>
                  <input
                    type="number"
                    min={0}
                    max={matrizMax}
                    step={1}
                    value={descuentoInput}
                    onChange={e => handleDescuentoChange(e.target.value)}
                    className="h-9 rounded-lg px-2 text-sm outline-none text-center"
                    style={{
                      border: `1px solid ${errorPuntos ? 'var(--agro-red)' : 'var(--border)'}`,
                      backgroundColor: 'var(--input-background)',
                      color: 'var(--foreground)',
                    }}
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
                  <p className="text-[10px]" style={{ color: 'var(--agro-danger-text)' }}>
                    El motivo es obligatorio cuando el valor difiere de la sugerencia.
                  </p>
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

          {/* ── Reincidencia banner ── */}
          {!pregunta.es_cualitativa && reincidencia?.reincidente && (
            <div
              className="flex items-start gap-2 rounded-lg px-3 py-2"
              style={{ backgroundColor: 'var(--agro-warning-fill)' }}
            >
              <History size={14} className="flex-shrink-0 mt-0.5" style={{ color: 'var(--agro-warning-text)' }} />
              <p className="text-[11px]" style={{ color: 'var(--agro-warning-text)' }}>
                {reincidencia.mensaje}
              </p>
            </div>
          )}

          {/* ── Falla automática banner ── */}
          {!pregunta.es_cualitativa && falla && (
            <div
              className="flex items-start gap-2 rounded-lg px-3 py-2"
              style={{ backgroundColor: 'var(--agro-warning-fill)' }}
            >
              <AlertTriangle size={14} className="flex-shrink-0 mt-0.5" style={{ color: 'var(--agro-warning-text)' }} />
              <p className="text-[11px] font-medium" style={{ color: 'var(--agro-warning-text)' }}>
                Control de falla automática — revisar con el auditor certificado.
              </p>
            </div>
          )}

          {/* ── Campos mínimos (esquema) con herencia full ── */}
          {esquemas.length > 0 && (
            <div className="flex flex-col gap-2.5">
              {esquemas.map(esq => {
                const h         = herenciaMap.get(`${preguntaId}:${esq.id}`)
                const ejec      = herenciaAcciones.get(esq.id)
                const esEscribiendo = escribiendoOtro.has(esq.id)

                if (!h || h.estado === 'rechazado' || esEscribiendo) {
                  return (
                    <div key={esq.id} className="flex flex-col gap-1">
                      <CampoEsquema
                        esquema={esq}
                        value={valores.get(esq.id) ?? ''}
                        onChange={v => handleValor(preguntaId, esq.id, v)}
                        onBlur={() => scheduleBlurSave(preguntaId)}
                        disabled={bloqueado}
                      />
                      {h?.estado === 'rechazado' && (
                        <p className="text-[10px]" style={{ color: 'var(--muted-foreground)' }}>
                          Propuesta de {h.origen_question_id ?? 'otra pregunta'} rechazada
                        </p>
                      )}
                    </div>
                  )
                }

                if (h.estado === 'sin_confirmar') {
                  return (
                    <div key={esq.id} className="flex flex-col gap-1.5">
                      <CampoEsquema
                        esquema={esq}
                        value={valores.get(esq.id) ?? ''}
                        onChange={v => handleValor(preguntaId, esq.id, v)}
                        onBlur={() => scheduleBlurSave(preguntaId)}
                        disabled={bloqueado}
                        herenciaEstado="sin_confirmar"
                      />
                      <p className="text-[10px] font-medium" style={{ color: 'var(--agro-blue)' }}>
                        Heredado de {h.origen_question_id ?? 'otra pregunta'}: sin confirmar
                      </p>
                      {!cerrada && (
                        <div className="flex gap-1.5 flex-wrap">
                          <button
                            disabled={!!ejec}
                            onClick={async () => {
                              setHerenciaAcciones(prev => new Map(prev).set(esq.id, 'cargando'))
                              try { await handleConfirmarHerencia(h.valor_id) }
                              finally { setHerenciaAcciones(prev => { const n = new Map(prev); n.delete(esq.id); return n }) }
                            }}
                            className="h-7 px-2.5 rounded-lg text-[10px] font-semibold disabled:opacity-50 flex items-center gap-1"
                            style={{ backgroundColor: 'var(--primary)', color: '#fff' }}
                          >
                            {ejec === 'cargando' ? <><Loader size={10} className="animate-spin" />…</> : 'Confirmar dato'}
                          </button>
                          <button
                            disabled={!!ejec}
                            onClick={() => setEscribiendoOtro(prev => new Set(prev).add(esq.id))}
                            className="h-7 px-2.5 rounded-lg text-[10px] font-medium disabled:opacity-50"
                            style={{ backgroundColor: 'var(--muted)', color: 'var(--foreground)', border: '1px solid var(--border)' }}
                          >
                            Escribir otro dato
                          </button>
                          <button
                            disabled={!!ejec}
                            onClick={async () => {
                              setHerenciaAcciones(prev => new Map(prev).set(esq.id, 'cargando'))
                              try { await handleRechazarHerencia(h.valor_id) }
                              finally { setHerenciaAcciones(prev => { const n = new Map(prev); n.delete(esq.id); return n }) }
                            }}
                            className="h-7 px-2.5 rounded-lg text-[10px] disabled:opacity-50"
                            style={{ color: 'var(--agro-danger-text)', border: '1px solid var(--agro-danger-text)' }}
                          >
                            Rechazar
                          </button>
                        </div>
                      )}
                    </div>
                  )
                }

                if (h.estado === 'confirmado') {
                  return (
                    <div key={esq.id} className="flex flex-col gap-1">
                      <CampoEsquema
                        esquema={esq}
                        value={valores.get(esq.id) ?? ''}
                        onChange={v => handleValor(preguntaId, esq.id, v)}
                        onBlur={() => scheduleBlurSave(preguntaId)}
                        disabled={bloqueado}
                      />
                      <p className="text-[10px]" style={{ color: 'var(--muted-foreground)' }}>
                        Heredado de {h.origen_question_id ?? 'otra pregunta'}
                        {(h.confirmado_por || h.confirmado_en)
                          ? ` · confirmado${h.confirmado_por ? ` por ${h.confirmado_por}` : ''}${h.confirmado_en ? `, ${fmtHerenciaTs(h.confirmado_en)}` : ''}`
                          : ''}
                      </p>
                    </div>
                  )
                }

                if (h.estado === 'revalidar') {
                  return (
                    <div key={esq.id} className="flex flex-col gap-1.5">
                      <CampoEsquema
                        esquema={esq}
                        value={valores.get(esq.id) ?? ''}
                        onChange={v => handleValor(preguntaId, esq.id, v)}
                        onBlur={() => scheduleBlurSave(preguntaId)}
                        disabled={bloqueado}
                        herenciaEstado="revalidar"
                      />
                      <div
                        className="rounded-lg px-3 py-2 flex flex-col gap-1.5"
                        style={{ backgroundColor: 'var(--agro-warning-fill)' }}
                      >
                        <p className="text-[10px] font-semibold" style={{ color: 'var(--agro-warning-text)' }}>
                          El dato cambió en {h.origen_question_id ?? 'otra pregunta'}
                        </p>
                        <p className="text-[10px]" style={{ color: 'var(--agro-warning-text)' }}>
                          Anterior: {h.valor ?? '—'} · Nuevo: {h.propuesto ?? '—'}
                        </p>
                        {!cerrada && (
                          <div className="flex gap-1.5 flex-wrap">
                            <button
                              disabled={!!ejec}
                              onClick={async () => {
                                setHerenciaAcciones(prev => new Map(prev).set(esq.id, 'cargando'))
                                try { await handleResolverHerencia(h.valor_id, 'propuesto') }
                                finally { setHerenciaAcciones(prev => { const n = new Map(prev); n.delete(esq.id); return n }) }
                              }}
                              className="h-7 px-2.5 rounded-lg text-[10px] font-semibold disabled:opacity-50 flex items-center gap-1"
                              style={{ backgroundColor: 'var(--primary)', color: '#fff' }}
                            >
                              {ejec === 'cargando' ? <><Loader size={10} className="animate-spin" />…</> : 'Confirmar nuevo'}
                            </button>
                            <button
                              disabled={!!ejec}
                              onClick={() => setEscribiendoOtro(prev => new Set(prev).add(esq.id))}
                              className="h-7 px-2.5 rounded-lg text-[10px] font-medium disabled:opacity-50"
                              style={{ backgroundColor: 'var(--muted)', color: 'var(--foreground)', border: '1px solid var(--border)' }}
                            >
                              Escribir otro dato
                            </button>
                          </div>
                        )}
                      </div>
                    </div>
                  )
                }

                if (h.estado === 'conflicto') {
                  return (
                    <div key={esq.id} className="flex flex-col gap-1.5">
                      <CampoEsquema
                        esquema={esq}
                        value={valores.get(esq.id) ?? ''}
                        onChange={v => handleValor(preguntaId, esq.id, v)}
                        onBlur={() => scheduleBlurSave(preguntaId)}
                        disabled={bloqueado}
                      />
                      <div
                        className="rounded-lg px-3 py-2 flex flex-col gap-1.5"
                        style={{ backgroundColor: 'var(--agro-warning-fill)' }}
                      >
                        <p className="text-[10px] font-semibold" style={{ color: 'var(--agro-warning-text)' }}>
                          Datos distintos en preguntas equivalentes
                        </p>
                        <p className="text-[10px]" style={{ color: 'var(--agro-warning-text)' }}>
                          Este: {h.valor ?? '—'} · En {h.origen_question_id ?? 'otra pregunta'}: {h.propuesto ?? '—'}
                        </p>
                        {!cerrada && (
                          <div className="flex gap-1.5 flex-wrap">
                            <button
                              disabled={!!ejec}
                              onClick={async () => {
                                setHerenciaAcciones(prev => new Map(prev).set(esq.id, 'cargando'))
                                try { await handleResolverHerencia(h.valor_id, 'propio') }
                                finally { setHerenciaAcciones(prev => { const n = new Map(prev); n.delete(esq.id); return n }) }
                              }}
                              className="h-7 px-2.5 rounded-lg text-[10px] font-semibold disabled:opacity-50 flex items-center gap-1"
                              style={{ backgroundColor: 'var(--muted)', color: 'var(--foreground)', border: '1px solid var(--border)' }}
                            >
                              {ejec === 'cargando' ? <><Loader size={10} className="animate-spin" />…</> : 'Conservar este'}
                            </button>
                            <button
                              disabled={!!ejec}
                              onClick={async () => {
                                setHerenciaAcciones(prev => new Map(prev).set(esq.id, 'cargando'))
                                try { await handleResolverHerencia(h.valor_id, 'propuesto') }
                                finally { setHerenciaAcciones(prev => { const n = new Map(prev); n.delete(esq.id); return n }) }
                              }}
                              className="h-7 px-2.5 rounded-lg text-[10px] font-semibold disabled:opacity-50 flex items-center gap-1"
                              style={{ backgroundColor: 'var(--primary)', color: '#fff' }}
                            >
                              Usar el de {h.origen_question_id ?? 'otra pregunta'}
                            </button>
                          </div>
                        )}
                      </div>
                    </div>
                  )
                }

                // Estado no reconocido — campo plano
                return (
                  <CampoEsquema
                    key={esq.id}
                    esquema={esq}
                    value={valores.get(esq.id) ?? ''}
                    onChange={v => handleValor(preguntaId, esq.id, v)}
                    onBlur={() => scheduleBlurSave(preguntaId)}
                    disabled={bloqueado}
                  />
                )
              })}
            </div>
          )}

          {/* ── Aviso NC sin observación ── */}
          {respuesta === 'no_conformidad' && !observacion && (
            <div
              className="flex items-start gap-2 rounded-lg px-3 py-2"
              style={{ backgroundColor: 'var(--agro-warning-fill)' }}
            >
              <AlertTriangle size={14} className="flex-shrink-0 mt-0.5" style={{ color: 'var(--agro-warning-text)' }} />
              <p className="text-[11px] font-medium" style={{ color: 'var(--agro-warning-text)' }}>
                Una no conformidad requiere observación del auditor.
              </p>
            </div>
          )}

          {/* ── Observación ── */}
          <div className="flex flex-col gap-1">
            <label className="text-[11px] font-medium" style={{ color: 'var(--muted-foreground)' }}>
              Observación del auditor
            </label>
            <textarea
              value={observacion}
              onChange={e => handleObservacion(preguntaId, e.target.value)}
              onBlur={() => scheduleBlurSave(preguntaId)}
              disabled={bloqueado}
              rows={3}
              placeholder="Observaciones del auditor…"
              className="resize-none text-[0.8125rem] outline-none"
              style={{
                borderRadius: 'var(--radius)',
                border: '1px solid var(--border)',
                backgroundColor: bloqueado ? 'var(--muted)' : 'var(--input-background)',
                color: 'var(--foreground)',
                padding: '0.375rem 0.625rem',
              }}
            />
          </div>

          {/* ── Info mínima ── */}
          {pregunta.info_minima && (
            <p className="text-[11px]" style={{ color: 'var(--muted-foreground)' }}>
              {pregunta.info_minima}
            </p>
          )}

          {/* ── Estado de guardado ── */}
          <div className="flex items-center gap-2 min-h-[18px]">
            {saveStatus === 'saving' && (
              <>
                <Loader size={12} className="animate-spin flex-shrink-0" style={{ color: 'var(--muted-foreground)' }} />
                <span className="text-[11px]" style={{ color: 'var(--muted-foreground)' }}>Guardando…</span>
              </>
            )}
            {saveStatus === 'saved' && (
              <>
                <CheckCircle size={12} className="flex-shrink-0" style={{ color: 'var(--agro-success-text)' }} />
                <span className="text-[11px]" style={{ color: 'var(--agro-success-text)' }}>Guardado</span>
              </>
            )}
            {saveStatus === 'error' && (
              <div className="field-error-shake flex items-center gap-2 w-full">
                <span className="flex items-center gap-1 text-[11px] flex-1 min-w-0" style={{ color: 'var(--agro-danger-text)' }}>
                  <XCircle size={12} className="flex-shrink-0" />
                  <span className="line-clamp-2">{saveMessage || 'No se pudo guardar. Reintenta.'}</span>
                </span>
              </div>
            )}
          </div>

          {/* ── Hallazgos ── */}
          {!pregunta.es_cualitativa &&
            (respuesta === 'deficiencia_menor' || respuesta === 'deficiencia_mayor' || respuesta === 'no_conformidad') && (
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
                  disabled={!instanciaId}
                  className="flex items-center gap-1 text-[10px] font-medium px-2 py-1 rounded-lg disabled:opacity-40"
                  style={{ backgroundColor: 'var(--muted)', color: 'var(--foreground)', border: '1px solid var(--border)' }}
                >
                  <Plus size={10} />
                  {!instanciaId ? 'Guardando…' : 'Registrar hallazgo'}
                </button>
              )}
            </div>
          )}

          {/* ── Botón de evidencia ── */}
          {instanciaId && (
            <button
              onClick={() => setEvidenciaOpen(true)}
              className="self-start flex items-center gap-1.5 text-[11px] font-medium px-2 py-1 rounded-lg"
              style={{ backgroundColor: 'var(--muted)', color: 'var(--muted-foreground)', border: '1px solid var(--border)' }}
            >
              <Paperclip size={12} />
              Evidencia
            </button>
          )}

          {/* ── Aviso cerrada ── */}
          {cerrada && (
            <div
              className="flex items-center gap-1.5 rounded-lg px-3 py-2"
              style={{ backgroundColor: 'var(--muted)', color: 'var(--muted-foreground)' }}
            >
              <AlertTriangle size={12} className="flex-shrink-0" />
              <span className="text-[11px]">Auditoría cerrada — solo lectura</span>
            </div>
          )}
        </div>

        {/* ── Bottom sheet de evidencia ── */}
        {instanciaId && (
          <BottomSheet open={evidenciaOpen} onClose={() => setEvidenciaOpen(false)} title="Evidencia">
            <div className="pb-6">
              <EvidenciaPanel
                entityType="INSTANCIA"
                entityId={instanciaId}
                orgId={auditoria?.org_id ?? ''}
                auditoriaId={auditoriaId}
                cerrada={cerrada}
                instanciaId={instanciaId}
                preguntaId={preguntaId}
              />
            </div>
          </BottomSheet>
        )}
      </div>
    )
  },
)

CapturaPreguntaAuditoria.displayName = 'CapturaPreguntaAuditoria'
