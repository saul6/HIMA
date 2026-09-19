import { useState, useEffect, useRef } from 'react'
import { useParams, useNavigate, Navigate } from 'react-router'
import { ChevronLeft, AlertTriangle, CheckCircle, Loader, XCircle, AlertCircle } from 'lucide-react'
import { toast } from 'sonner'
import { useAuthContext } from '@/context/AuthContext'
import { useAuditoriasPGFS } from '@/hooks/useAuditoriasPGFS'
import type { AuditoriaDetalle } from '@/hooks/useAuditoriasPGFS'
import type { AudBloque, AudPregunta, AudComentarioEsquema, AudRespuesta } from '@/types/database.types'
import { LEYENDA_LEGAL_PGFS } from '@/lib/auditoriasPGFS'

const ROLES_PERMITIDOS = ['auditor', 'admin_org', 'super_admin']

// ── Respuesta buttons ────────────────────────────────────────────────────────

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

function mensajeErrorSeguro(err: unknown): string {
  if (!err || typeof err !== 'object') return 'No se pudo guardar. Reintenta.'
  const e = err as { code?: string; message?: string }
  if (e.code === '42501' || e.message?.includes('permission') || e.message?.includes('RLS')) {
    return 'No tienes permiso para guardar en esta empresa.'
  }
  if (e.message?.includes('fetch') || e.message?.includes('network') || e.message?.toLowerCase().includes('timeout')) {
    return 'Sin conexión; no se guardó. Reintenta.'
  }
  return 'No se pudo guardar. Reintenta.'
}

type SaveStatus = 'idle' | 'saving' | 'saved' | 'error'

// ── Diccionario de etiquetas legibles por campo_clave ───────────────────────

const ETIQUETA_CAMPO: Record<string, string> = {
  document_name_code:   'Nombre y/o código del documento',
  responsible_person:   'Responsable / firma',
  date_latest:          'Fecha (más reciente)',
  frequency:            'Frecuencia',
  location:             'Ubicación',
  quantity_count:       'Cantidad / número',
  parameter_range:      'Parámetro / rango',
  test_result:          'Resultado',
  method:               'Método',
  scope:                'Alcance',
  corrective_action:    'Acción correctiva',
  sample_example:       'Ejemplo verificable',
  na_justification:     'Justificación de N/A',
  confirmacion_general: 'Información requerida',
}

// ── Campo de comentario (esquema) ────────────────────────────────────────────

function CampoEsquema({
  esquema, value, onChange, onBlur, disabled,
}: {
  esquema: AudComentarioEsquema
  value: string
  onChange: (v: string) => void
  onBlur: () => void
  disabled: boolean
}) {
  const etiqueta = ETIQUETA_CAMPO[esquema.campo_clave] ?? esquema.campo_clave
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
        {etiqueta}
        {esquema.requerido && <span style={{ color: 'var(--agro-red)' }}> *</span>}
      </label>
      <input
        type={esquema.tipo_campo}
        value={value}
        onChange={(e) => onChange(e.target.value)}
        onBlur={onBlur}
        disabled={disabled}
        placeholder={esquema.regla_validacion ?? undefined}
        style={{ ...base, height: '2.25rem' }}
      />
      {esquema.regla_validacion && (
        <p className="text-[10px] leading-snug" style={{ color: 'var(--muted-foreground)' }}>
          {esquema.regla_validacion}
        </p>
      )}
    </div>
  )
}

// ── Tarjeta de pregunta ──────────────────────────────────────────────────────

function PreguntaCard({
  pregunta, esquemas, respuesta, valores, observacion,
  saveStatus, saveErrorMsg, onRespuesta, onValor, onObservacion, onBlur, onRetry, cerrada,
}: {
  pregunta: AudPregunta
  esquemas: AudComentarioEsquema[]
  respuesta: AudRespuesta | undefined
  valores: Map<string, string>
  observacion: string
  saveStatus: SaveStatus
  saveErrorMsg?: string
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

  const incompleta =
    !!respuesta &&
    respuesta !== 'cumplimiento_total' &&
    respuesta !== 'na' &&
    !observacion.trim()

  return (
    <div
      className="rounded-xl border border-border bg-card px-4 py-4 flex flex-col gap-3"
      style={falla ? { borderColor: 'var(--agro-red)', borderWidth: '1.5px' } : undefined}
    >
      {/* Encabezado */}
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

      {/* Información mínima para validar */}
      {pregunta.info_minima && (
        <div className="rounded-lg px-3 py-2 flex flex-col gap-0.5" style={{ backgroundColor: 'var(--agro-success-fill)' }}>
          <p className="text-[10px] font-semibold" style={{ color: 'var(--agro-success-text)' }}>
            Para validar, registra:
          </p>
          <p className="text-[11px] leading-relaxed whitespace-pre-wrap" style={{ color: 'var(--agro-success-text)' }}>
            {pregunta.info_minima}
          </p>
        </div>
      )}

      {/* Respuesta */}
      <div className="flex gap-1.5">
        {RESP_OPTIONS.map((opt) => {
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

      {/* Alerta falla automática */}
      {falla && (
        <div className="flex items-start gap-2 rounded-lg px-3 py-2" style={{ backgroundColor: 'var(--agro-warning-fill)' }}>
          <AlertTriangle size={14} className="flex-shrink-0 mt-0.5" style={{ color: 'var(--agro-warning-text)' }} />
          <p className="text-[11px] font-medium" style={{ color: 'var(--agro-warning-text)' }}>
            Alerta interna: esta pregunta activa un control de falla automática. Revisar con el auditor certificado.
          </p>
        </div>
      )}

      {/* Alerta incompleta */}
      {incompleta && !cerrada && (
        <div className="flex items-start gap-2 rounded-lg px-3 py-2" style={{ backgroundColor: 'var(--agro-warning-fill)' }}>
          <AlertTriangle size={14} className="flex-shrink-0 mt-0.5" style={{ color: 'var(--agro-warning-text)' }} />
          <div className="flex flex-col gap-0.5">
            <p className="text-[11px] font-semibold" style={{ color: 'var(--agro-warning-text)' }}>
              Incompleta — registra la observación para validar esta respuesta
            </p>
            {pregunta.info_minima && (
              <p className="text-[11px] whitespace-pre-wrap" style={{ color: 'var(--agro-warning-text)' }}>
                {pregunta.info_minima}
              </p>
            )}
          </div>
        </div>
      )}

      {/* Campos de comentario (esquema) */}
      {esquemas.length > 0 && (
        <div className="flex flex-col gap-2.5">
          {esquemas.map((esq) => (
            <CampoEsquema
              key={esq.id}
              esquema={esq}
              value={valores.get(esq.id) ?? ''}
              onChange={(v) => onValor(esq.id, v)}
              onBlur={onBlur}
              disabled={cerrada}
            />
          ))}
        </div>
      )}

      {/* Observación libre */}
      <div className="flex flex-col gap-1">
        <label className="text-[11px] font-medium" style={{ color: 'var(--muted-foreground)' }}>
          Observación del auditor
        </label>
        <textarea
          value={observacion}
          onChange={(e) => onObservacion(e.target.value)}
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

      {/* Save status */}
      <div className="flex justify-end items-center gap-2 min-h-[1rem]">
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
          <>
            <span className="flex items-center gap-1 text-[10px]" style={{ color: 'var(--agro-danger-text)' }}>
              <XCircle size={11} /> {saveErrorMsg ?? 'No se pudo guardar. Reintenta.'}
            </span>
            <button
              onClick={onRetry}
              className="text-[10px] underline flex-shrink-0"
              style={{ color: 'var(--agro-danger-text)' }}
            >
              Reintentar
            </button>
          </>
        )}
      </div>
    </div>
  )
}

// ── Pantalla ─────────────────────────────────────────────────────────────────

const ESTADO_LABELS: Record<string, string> = {
  en_proceso: 'En proceso',
  completada: 'Completada',
  cerrada: 'Cerrada',
}
const ESTADO_STYLE: Record<string, { bg: string; color: string }> = {
  en_proceso: { bg: 'var(--agro-warning-fill)', color: 'var(--agro-warning-text)' },
  completada:  { bg: 'var(--agro-success-fill)', color: 'var(--agro-success-text)' },
  cerrada:     { bg: 'var(--muted)',              color: 'var(--muted-foreground)'  },
}

function formatFecha(f: string) {
  const [y, m, d] = f.split('-')
  return `${d}/${m}/${y}`
}

export function CapturaAuditoriaPGFS() {
  const { auditoriaId } = useParams<{ auditoriaId: string }>()
  const navigate = useNavigate()
  const { profile } = useAuthContext()
  const hook = useAuditoriasPGFS()

  const [auditoria, setAuditoria]   = useState<AuditoriaDetalle | null>(null)
  const [bloques, setBloques]       = useState<AudBloque[]>([])
  const [preguntas, setPreguntas]   = useState<AudPregunta[]>([])
  const [esquemaMap, setEsquemaMap] = useState<Map<string, AudComentarioEsquema[]>>(new Map())

  const [respuestasMap, setRespuestasMap]       = useState<Map<string, AudRespuesta>>(new Map())
  const [valoresMap, setValoresMap]             = useState<Map<string, Map<string, string>>>(new Map())
  const [observacionesMap, setObservacionesMap] = useState<Map<string, string>>(new Map())
  const [savingMap, setSavingMap]               = useState<Record<string, SaveStatus>>({})
  const [saveErrorMap, setSaveErrorMap]         = useState<Record<string, string>>({})

  // Refs para capturar el estado actual en callbacks diferidos sin closures rancias
  const respuestasRef   = useRef(respuestasMap)
  const valoresRef      = useRef(valoresMap)
  const observacionesRef = useRef(observacionesMap)
  useEffect(() => { respuestasRef.current   = respuestasMap }, [respuestasMap])
  useEffect(() => { valoresRef.current      = valoresMap    }, [valoresMap])
  useEffect(() => { observacionesRef.current = observacionesMap }, [observacionesMap])

  const [cargando, setCargando] = useState(true)
  const [cerrando, setCerrando] = useState(false)
  const [errorMsg, setErrorMsg] = useState<string | null>(null)

  const debounceTimers = useRef<Record<string, ReturnType<typeof setTimeout>>>({})

  if (!ROLES_PERMITIDOS.includes(profile?.rol ?? '')) {
    return <Navigate to="/" replace />
  }

  // Carga inicial
  useEffect(() => {
    if (!auditoriaId) return
    let cancelado = false
    async function cargar() {
      try {
        const aud = await hook.cargarAuditoria(auditoriaId!)
        if (cancelado) return
        setAuditoria(aud)

        const { bloques: bl, preguntas: pr, esquemas: eq } = await hook.cargarCatalogo(aud.modulo_norma_id)
        if (cancelado) return
        setBloques(bl)
        setPreguntas(pr)
        const eqMap = new Map<string, AudComentarioEsquema[]>()
        for (const e of eq) {
          if (!eqMap.has(e.pregunta_id)) eqMap.set(e.pregunta_id, [])
          eqMap.get(e.pregunta_id)!.push(e)
        }
        setEsquemaMap(eqMap)

        const { respuestasMap: rm, valoresMap: vm, observacionesMap: om } =
          await hook.cargarInstancias(auditoriaId!)
        if (cancelado) return
        setRespuestasMap(rm)
        setValoresMap(vm)
        setObservacionesMap(om)
      } catch (e: unknown) {
        console.error('[CapturaAuditoriaPGFS] cargar:', e)
        if (!cancelado) setErrorMsg('No se pudo cargar la auditoría. Verifica tu conexión y recarga.')
      } finally {
        if (!cancelado) setCargando(false)
      }
    }
    cargar()
    return () => { cancelado = true }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [auditoriaId])

  const cerrada = auditoria?.estado === 'cerrada' || auditoria?.estado === 'completada'

  // Guarda una pregunta usando los refs (siempre tiene el estado más reciente)
  function dispatchSave(pregId: string, forceResp?: AudRespuesta) {
    const resp = forceResp ?? respuestasRef.current.get(pregId)
    if (!resp || !auditoriaId || !auditoria) return
    const vals = valoresRef.current.get(pregId) ?? new Map<string, string>()
    const obs  = observacionesRef.current.get(pregId)

    setSavingMap((prev) => ({ ...prev, [pregId]: 'saving' }))
    hook.guardarRespuesta({
      auditoriaId,
      preguntaId: pregId,
      respuesta: resp,
      valoresMap: vals,
      observacion: obs,
      orgId: auditoria.org_id,
    })
      .then(() => {
        setSavingMap((prev) => ({ ...prev, [pregId]: 'saved' }))
        setTimeout(() => setSavingMap((prev) => ({ ...prev, [pregId]: 'idle' })), 2500)
      })
      .catch((err) => {
        console.error('[CapturaAuditoriaPGFS] guardarRespuesta:', err)
        setSavingMap((prev) => ({ ...prev, [pregId]: 'error' }))
        setSaveErrorMap((prev) => ({ ...prev, [pregId]: mensajeErrorSeguro(err) }))
      })
  }

  function handleRespuesta(pregId: string, resp: AudRespuesta) {
    setRespuestasMap((prev) => new Map(prev).set(pregId, resp))
    clearTimeout(debounceTimers.current[pregId])
    // Pasa resp directamente para no depender del ref que aún no se actualizó
    debounceTimers.current[pregId] = setTimeout(() => dispatchSave(pregId, resp), 50)
  }

  function handleValor(pregId: string, esquemaId: string, v: string) {
    setValoresMap((prev) => {
      const next = new Map(prev)
      const campos = new Map(next.get(pregId) ?? [])
      campos.set(esquemaId, v)
      next.set(pregId, campos)
      return next
    })
  }

  function handleObservacion(pregId: string, v: string) {
    setObservacionesMap((prev) => new Map(prev).set(pregId, v))
  }

  function handleBlur(pregId: string) {
    clearTimeout(debounceTimers.current[pregId])
    debounceTimers.current[pregId] = setTimeout(() => dispatchSave(pregId), 400)
  }

  async function handleCompletar() {
    if (!auditoriaId) return
    if (!window.confirm('¿Cerrar esta auditoría? No podrás editar las respuestas después.')) return
    setCerrando(true)
    try {
      await hook.completarAuditoria(auditoriaId)
      toast.success('Auditoría cerrada')
      setAuditoria((prev) => prev ? { ...prev, estado: 'cerrada' } : prev)
    } catch (e: unknown) {
      console.error('[CapturaAuditoriaPGFS] completarAuditoria:', e)
      toast.error('No se pudo cerrar la auditoría. Reintenta.')
    } finally {
      setCerrando(false)
    }
  }

  const estadoStyle = ESTADO_STYLE[auditoria?.estado ?? ''] ?? ESTADO_STYLE.cerrada

  return (
    <div className="flex flex-col min-h-screen bg-background pb-8">
      {/* Header */}
      <header className="sticky top-0 z-10 bg-card border-b border-border flex items-center gap-3 px-4 py-3">
        <button onClick={() => navigate(-1)} className="text-muted-foreground flex-shrink-0">
          <ChevronLeft size={24} />
        </button>
        <div className="flex-1 min-w-0">
          <p className="text-sm font-semibold truncate" style={{ color: 'var(--foreground)' }}>
            {auditoria ? auditoria.modulo_nombre : 'Cargando…'}
          </p>
          {auditoria && (
            <p className="text-xs" style={{ color: 'var(--muted-foreground)' }}>
              {auditoria.rancho_nombre} · {formatFecha(auditoria.fecha)}
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
        {!cerrada && !cargando && (
          <button
            onClick={handleCompletar}
            disabled={cerrando}
            className="text-xs font-semibold px-3 py-1.5 rounded-lg flex-shrink-0 disabled:opacity-50"
            style={{ backgroundColor: 'var(--primary)', color: '#fff' }}
          >
            {cerrando ? 'Cerrando…' : 'Completar'}
          </button>
        )}
      </header>

      {/* Leyenda legal */}
      <div className="mx-4 mt-3 rounded-xl border border-border bg-card px-4 py-3 flex gap-3">
        <AlertCircle size={14} className="flex-shrink-0 mt-0.5" style={{ color: 'var(--agro-warning-text)' }} />
        <p className="text-[11px] leading-relaxed" style={{ color: 'var(--muted-foreground)' }}>
          {LEYENDA_LEGAL_PGFS}
        </p>
      </div>

      {/* Contenido */}
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
          bloques.map((bloque) => {
            const preguntasBloque = preguntas.filter((p) => p.bloque_id === bloque.id)
            if (preguntasBloque.length === 0) return null
            return (
              <section key={bloque.id}>
                <div
                  className="rounded-t-xl px-4 py-2.5 flex items-center gap-2 mb-2"
                  style={{ backgroundColor: 'var(--muted)' }}
                >
                  <span
                    className="text-[10px] font-mono px-1.5 py-0.5 rounded"
                    style={{ backgroundColor: 'var(--primary)', color: '#fff' }}
                  >
                    {bloque.codigo}
                  </span>
                  <p className="text-xs font-semibold flex-1" style={{ color: 'var(--foreground)' }}>
                    {bloque.nombre}
                  </p>
                  <span className="text-[10px]" style={{ color: 'var(--muted-foreground)' }}>
                    {preguntasBloque.length} preg.
                  </span>
                </div>
                <div className="flex flex-col gap-2">
                  {preguntasBloque.map((preg) => (
                    <PreguntaCard
                      key={preg.id}
                      pregunta={preg}
                      esquemas={esquemaMap.get(preg.id) ?? []}
                      respuesta={respuestasMap.get(preg.id)}
                      valores={valoresMap.get(preg.id) ?? new Map()}
                      observacion={observacionesMap.get(preg.id) ?? ''}
                      saveStatus={savingMap[preg.id] ?? 'idle'}
                      saveErrorMsg={saveErrorMap[preg.id]}
                      onRespuesta={(r) => handleRespuesta(preg.id, r)}
                      onValor={(eid, v) => handleValor(preg.id, eid, v)}
                      onObservacion={(v) => handleObservacion(preg.id, v)}
                      onBlur={() => handleBlur(preg.id)}
                      onRetry={() => dispatchSave(preg.id)}
                      cerrada={cerrada}
                    />
                  ))}
                </div>
              </section>
            )
          })
        )}

        {!cerrada && !cargando && preguntas.length > 0 && (
          <button
            onClick={handleCompletar}
            disabled={cerrando}
            className="w-full h-11 rounded-xl text-sm font-semibold mt-2 disabled:opacity-50"
            style={{ backgroundColor: 'var(--primary)', color: '#fff' }}
          >
            {cerrando ? 'Cerrando…' : 'Completar auditoría'}
          </button>
        )}

        {cerrada && (
          <div className="rounded-xl px-4 py-3 text-center" style={{ backgroundColor: 'var(--muted)' }}>
            <p className="text-xs font-semibold" style={{ color: 'var(--muted-foreground)' }}>
              Auditoría cerrada — solo lectura
            </p>
          </div>
        )}
      </main>
    </div>
  )
}
