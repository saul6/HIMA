import { useState, useRef, useEffect, forwardRef, useImperativeHandle, useCallback } from 'react'
import { CheckCircle, AlertCircle, Loader, AlertTriangle } from 'lucide-react'
import { supabase } from '@/lib/supabase'
import { useAuditorAuditoria, GuardadoIncompleto } from '@/hooks/useAuditorAuditoria'
import type { AudRespuesta, AudPregunta, AudComentarioEsquema } from '@/types/database.types'

// eslint-disable-next-line @typescript-eslint/no-explicit-any
const tbl = (name: string) => (supabase as any).from(name)

type SaveStatus = 'idle' | 'saving' | 'saved' | 'error'

export interface CapturaPreguntaRef {
  flushPendientes: () => Promise<boolean>
  getSaveStatus: () => SaveStatus
}

interface Props {
  auditoriaId: string
  preguntaId: string
  onEstadoGuardado?: (status: SaveStatus) => void
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
        <select value={value} onChange={e => onChange(e.target.value)} onBlur={onBlur} disabled={disabled}
          style={{ ...base, height: '2.25rem' }}>
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

export const CapturaPreguntaAuditoria = forwardRef<CapturaPreguntaRef, Props>(
  function CapturaPreguntaAuditoria({ auditoriaId, preguntaId, onEstadoGuardado }, ref) {
    const hook = useAuditorAuditoria(auditoriaId)
    const {
      auditoria, modulosData, esquemaMap,
      respuestasMap, setRespuestasMap,
      valoresMap, setValoresMap,
      observacionesMap, setObservacionesMap,
      estadoAplicabilidadMap,
      herenciaMap, recargarHerencia,
      guardarRespuesta, guardarComentarios,
      cargando, errorMsg,
    } = hook

    const cerrada = auditoria?.estado === 'cerrada' || auditoria?.estado === 'completada'

    const pregunta = modulosData.flatMap(m => m.preguntas).find(p => p.id === preguntaId) as AudPregunta | undefined
    const esquemas = esquemaMap.get(preguntaId) ?? []

    const [saveStatus, setSaveStatus] = useState<SaveStatus>('idle')
    const [saveMessage, setSaveMessage] = useState('')

    const respRef   = useRef(respuestasMap)
    const valsRef   = useRef(valoresMap)
    const obsRef    = useRef(observacionesMap)
    useEffect(() => { respRef.current = respuestasMap }, [respuestasMap])
    useEffect(() => { valsRef.current = valoresMap }, [valoresMap])
    useEffect(() => { obsRef.current = observacionesMap }, [observacionesMap])

    // Reset save state when question changes
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
    }, [guardarRespuesta, modulosData, onEstadoGuardado]) // eslint-disable-line react-hooks/exhaustive-deps

    const flushPendientes = useCallback(async (): Promise<boolean> => {
      const p = pendingRef.current
      if (p.timer !== null) {
        clearTimeout(p.timer)
        p.timer = null
      }
      if (p.args !== null && p.pregId !== null) {
        const args = p.args
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
      const vals = valsRef.current.get(pregId) ?? new Map<string, string>()
      const obs = obsRef.current.get(pregId)
      const obsExistia = obsRef.current.has(pregId)
      const args = { resp, vals, obs, obsExistia }

      if (pendingRef.current.timer !== null) {
        clearTimeout(pendingRef.current.timer)
        pendingRef.current.timer = null
      }
      pendingRef.current.pregId = pregId
      pendingRef.current.args = args

      const timer = setTimeout(() => {
        pendingRef.current.args = null
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
        const vals = valsRef.current.get(pregId) ?? new Map<string, string>()
        const obs = obsRef.current.get(pregId)
        const obsExistia = obsRef.current.has(pregId)
        const args = { resp, vals, obs, obsExistia }
        pendingRef.current.pregId = pregId
        pendingRef.current.args = args
        const timer = setTimeout(() => {
          pendingRef.current.args = null
          pendingRef.current.timer = null
          executeSave(pregId, args).catch(() => { /* handled */ })
        }, 400)
        pendingRef.current.timer = timer
      } else {
        // sin respuesta — guardar solo comentarios
        const vals = valsRef.current.get(pregId) ?? new Map<string, string>()
        const obs = obsRef.current.get(pregId)
        const obsExistia = obsRef.current.has(pregId)
        if (vals.size === 0 && obs === undefined) return
        const timer = setTimeout(() => {
          setSaveStatus('saving')
          guardarComentarios({ preguntaId: pregId, valoresMap: vals, observacion: obs, obsExistia })
            .then(() => { setSaveStatus('saved'); setTimeout(() => setSaveStatus(s => s === 'saved' ? 'idle' : s), 2500) })
            .catch((err: unknown) => { setSaveStatus('error'); setSaveMessage(traducirError(err)) })
        }, 400)
        pendingRef.current.timer = timer
      }
    }

    function handleRespuesta(pregId: string, resp: AudRespuesta) {
      setRespuestasMap(prev => new Map(prev).set(pregId, resp))
      scheduleSave(pregId, resp)
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

    async function handleConfirmarHerencia(valorId: string) {
      try {
        const { error } = await supabase.rpc('aud_herencia_confirmar', { p_valor_id: valorId })
        if (error) throw error
        await recargarHerencia()
      } catch (e) {
        console.error('[CapturaPregunta] confirmarHerencia', e)
      }
    }

    async function handleRechazarHerencia(valorId: string) {
      try {
        const { error } = await supabase.rpc('aud_herencia_rechazar', { p_valor_id: valorId })
        if (error) throw error
        await recargarHerencia()
      } catch (e) {
        console.error('[CapturaPregunta] rechazarHerencia', e)
      }
    }

    async function handleResolverHerencia(valorId: string, res: 'propio' | 'propuesto') {
      try {
        const { error } = await supabase.rpc('aud_herencia_resolver', { p_valor_id: valorId, p_resolucion: res })
        if (error) throw error
        await recargarHerencia()
      } catch (e) {
        console.error('[CapturaPregunta] resolverHerencia', e)
      }
    }

    // ── Render ────────────────────────────────────────────────────────────────

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

    if (!pregunta) {
      return (
        <div className="rounded-xl border border-dashed border-border p-6">
          <p className="text-sm text-center" style={{ color: 'var(--muted-foreground)' }}>
            Selecciona una pregunta para capturar.
          </p>
        </div>
      )
    }

    const respuesta = respuestasMap.get(preguntaId)
    const valores = valoresMap.get(preguntaId) ?? new Map<string, string>()
    const observacion = observacionesMap.get(preguntaId) ?? ''
    const estadoAplicabilidad = estadoAplicabilidadMap.get(preguntaId)
    const esNaPorRama = estadoAplicabilidad === 'na_rama'
    const bloqueado = cerrada || esNaPorRama

    const opciones = pregunta.es_cualitativa ? RESP_OPTIONS_M9 : RESP_OPTIONS
    const falla = respuesta && respuesta !== 'na' &&
      ((pregunta.trigger_falla_automatica === 'cualquier_descuento' && respuesta !== 'cumplimiento_total') ||
       (pregunta.trigger_falla_automatica === 'solo_cero' && respuesta === 'no_conformidad'))

    return (
      <div className="flex flex-col gap-4">

        {/* ── Encabezado de la pregunta ── */}
        <div className="rounded-xl border border-border bg-card px-4 py-4 flex flex-col gap-3"
          style={falla ? { borderColor: 'var(--agro-red)', borderWidth: '1.5px' } : undefined}>

          <div className="flex items-start gap-2">
            <span className="text-[10px] font-mono flex-shrink-0 mt-0.5 px-1.5 py-0.5 rounded"
              style={{ backgroundColor: 'var(--muted)', color: 'var(--muted-foreground)' }}>
              {pregunta.question_id}
            </span>
            {pregunta.tipo === 'information_gathering' && (
              <span className="text-[10px] font-semibold flex-shrink-0 mt-0.5 px-1.5 py-0.5 rounded"
                style={{ backgroundColor: 'var(--agro-success-fill)', color: 'var(--agro-success-text)' }}>
                Informativa
              </span>
            )}
            {pregunta.trigger_falla_automatica !== 'ninguno' && (
              <span className="text-[10px] font-semibold flex-shrink-0 mt-0.5 px-1.5 py-0.5 rounded"
                style={{ backgroundColor: 'var(--agro-danger-fill)', color: 'var(--agro-danger-text)' }}>
                Falla automática
              </span>
            )}
            <p className="text-sm flex-1" style={{ color: 'var(--foreground)', lineHeight: '1.45' }}>
              {pregunta.texto}
            </p>
          </div>

          {/* ── Botones de respuesta ── */}
          {esNaPorRama ? (
            <div className="rounded-lg px-3 py-2 text-[11px] font-medium"
              style={{ backgroundColor: 'var(--muted)', color: 'var(--muted-foreground)' }}>
              N/A por regla de rama — no editable aquí. Abre la auditoría para gestionar.
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
                    className="flex-1 min-w-0 h-10 rounded-lg text-xs font-bold border transition-all disabled:opacity-50"
                    style={active
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

          {/* ── Campos mínimos ── */}
          {esquemas.length > 0 && (
            <div className="flex flex-col gap-3 pt-1">
              {esquemas.map(esq => {
                const herenciaKey = `${preguntaId}:${esq.id}`
                const herencia = herenciaMap.get(herenciaKey)
                const herenciaActiva = herencia?.estado === 'sin_confirmar' || herencia?.estado === 'revalidar'
                return (
                  <div key={esq.id} className="flex flex-col gap-1.5">
                    <CampoEsquema
                      esquema={esq}
                      value={valores.get(esq.id) ?? ''}
                      onChange={v => handleValor(preguntaId, esq.id, v)}
                      onBlur={() => scheduleBlurSave(preguntaId)}
                      disabled={bloqueado}
                      herenciaEstado={herenciaActiva ? herencia!.estado as 'sin_confirmar' | 'revalidar' : undefined}
                    />
                    {/* Herencia banner */}
                    {herencia && (herencia.estado === 'sin_confirmar' || herencia.estado === 'revalidar') && (
                      <div className="rounded-lg px-3 py-2 flex flex-col gap-2"
                        style={{ backgroundColor: 'var(--agro-success-fill)', border: '1px solid var(--agro-success-text)' }}>
                        <p className="text-[11px] font-medium" style={{ color: 'var(--agro-success-text)' }}>
                          {herencia.estado === 'revalidar' ? 'Dato por revalidar' : 'Dato por confirmar'}
                          {herencia.fuente ? ` · ${herencia.fuente}` : ''}
                        </p>
                        {herencia.propuesto != null && (
                          <p className="text-[11px]" style={{ color: 'var(--agro-success-text)' }}>
                            Valor sugerido: <strong>{herencia.propuesto}</strong>
                          </p>
                        )}
                        {herencia.estado === 'conflicto' ? (
                          <div className="flex gap-2">
                            <button onClick={() => handleResolverHerencia(herencia.valor_id, 'propio')}
                              className="flex-1 h-7 rounded-lg text-[10px] font-semibold"
                              style={{ backgroundColor: 'var(--primary)', color: '#fff' }}>
                              Mantener mío
                            </button>
                            <button onClick={() => handleResolverHerencia(herencia.valor_id, 'propuesto')}
                              className="flex-1 h-7 rounded-lg text-[10px] font-semibold"
                              style={{ backgroundColor: 'var(--muted)', color: 'var(--foreground)', border: '1px solid var(--border)' }}>
                              Usar sugerido
                            </button>
                          </div>
                        ) : (
                          <div className="flex gap-2">
                            <button onClick={() => handleConfirmarHerencia(herencia.valor_id)}
                              className="flex-1 h-7 rounded-lg text-[10px] font-semibold"
                              style={{ backgroundColor: 'var(--primary)', color: '#fff' }}>
                              Confirmar
                            </button>
                            <button onClick={() => handleRechazarHerencia(herencia.valor_id)}
                              className="flex-1 h-7 rounded-lg text-[10px]"
                              style={{ backgroundColor: 'var(--muted)', color: 'var(--foreground)', border: '1px solid var(--border)' }}>
                              No aplica
                            </button>
                          </div>
                        )}
                      </div>
                    )}
                    {herencia?.estado === 'confirmado' && (
                      <p className="text-[10px]" style={{ color: 'var(--agro-success-text)' }}>
                        ✓ Confirmado
                      </p>
                    )}
                  </div>
                )
              })}
            </div>
          )}

          {/* ── Observación ── */}
          <div className="flex flex-col gap-1">
            <label className="text-[11px] font-medium" style={{ color: 'var(--muted-foreground)' }}>
              Observación
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

          {/* ── Estado de guardado ── */}
          <div className="flex items-center gap-1.5 min-h-[18px]">
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
              <>
                <AlertCircle size={12} className="flex-shrink-0" style={{ color: 'var(--agro-danger-text)' }} />
                <span className="text-[11px]" style={{ color: 'var(--agro-danger-text)' }}>
                  {saveMessage || 'No se pudo guardar. Reintenta.'}
                </span>
              </>
            )}
          </div>

          {/* ── Info mínima de la pregunta ── */}
          {pregunta.info_minima && (
            <p className="text-[11px]" style={{ color: 'var(--muted-foreground)' }}>
              {pregunta.info_minima}
            </p>
          )}

          {/* ── Aviso cerrada ── */}
          {cerrada && (
            <div className="flex items-center gap-1.5 rounded-lg px-3 py-2"
              style={{ backgroundColor: 'var(--muted)', color: 'var(--muted-foreground)' }}>
              <AlertTriangle size={12} className="flex-shrink-0" />
              <span className="text-[11px]">Auditoría cerrada — solo lectura</span>
            </div>
          )}
        </div>

      </div>
    )
  }
)

CapturaPreguntaAuditoria.displayName = 'CapturaPreguntaAuditoria'
