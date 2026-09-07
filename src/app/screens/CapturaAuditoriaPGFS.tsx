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

type SaveStatus = 'idle' | 'saving' | 'saved' | 'error'

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
        <select value={value} onChange={(e) => onChange(e.target.value)} onBlur={onBlur} disabled={disabled}
          style={{ ...base, height: '2.25rem' }}>
          <option value="">Seleccionar…</option>
          {esquema.opciones.map((op) => <option key={op} value={op}>{op}</option>)}
        </select>
      ) : (
        <input
          type={esquema.tipo === 'fecha' ? 'date' : esquema.tipo === 'numero' ? 'number' : 'text'}
          value={value}
          onChange={(e) => onChange(e.target.value)}
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
  saveStatus, onRespuesta, onValor, onObservacion, onBlur, cerrada,
}: {
  pregunta: AudPregunta
  esquemas: AudComentarioEsquema[]
  respuesta: AudRespuesta | undefined
  valores: Map<string, string>
  observacion: string
  saveStatus: SaveStatus
  onRespuesta: (r: AudRespuesta) => void
  onValor: (esquemaId: string, v: string) => void
  onObservacion: (v: string) => void
  onBlur: () => void
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
      {/* Encabezado */}
      <div className="flex items-start gap-2">
        <span
          className="text-[10px] font-mono flex-shrink-0 mt-0.5 px-1.5 py-0.5 rounded"
          style={{ backgroundColor: 'var(--muted)', color: 'var(--muted-foreground)' }}
        >
          {pregunta.codigo}
        </span>
        {pregunta.tipo === 'informativa' && (
          <span
            className="text-[10px] font-semibold flex-shrink-0 mt-0.5 px-1.5 py-0.5 rounded"
            style={{ backgroundColor: 'var(--agro-success-fill)', color: 'var(--agro-success-text)' }}
          >
            Informativa
          </span>
        )}
        <p className="text-sm flex-1" style={{ color: 'var(--foreground)', lineHeight: '1.45' }}>
          {pregunta.prompt_texto}
        </p>
      </div>

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
      <div className="flex justify-end h-4">
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
          <span className="flex items-center gap-1 text-[10px]" style={{ color: 'var(--agro-danger-text)' }}>
            <XCircle size={11} /> Error al guardar
          </span>
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

  // Refs para capturar el estado actual en callbacks diferidos sin closures rancias
  const respuestasRef   = useRef(respuestasMap)
  const valoresRef      = useRef(valoresMap)
  const observacionesRef = useRef(observacionesMap)
  const preguntasRef    = useRef(preguntas)
  useEffect(() => { respuestasRef.current   = respuestasMap }, [respuestasMap])
  useEffect(() => { valoresRef.current      = valoresMap    }, [valoresMap])
  useEffect(() => { observacionesRef.current = observacionesMap }, [observacionesMap])
  useEffect(() => { preguntasRef.current    = preguntas     }, [preguntas])

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
        if (!cancelado) setErrorMsg(e instanceof Error ? e.message : 'Error al cargar')
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
    if (!resp || !auditoriaId) return
    const preg = preguntasRef.current.find((p) => p.id === pregId)
    const vals = valoresRef.current.get(pregId) ?? new Map<string, string>()
    const obs  = observacionesRef.current.get(pregId)

    setSavingMap((prev) => ({ ...prev, [pregId]: 'saving' }))
    hook.guardarRespuesta({
      auditoriaId,
      preguntaId: pregId,
      respuesta: resp,
      trigger: preg?.trigger_falla_automatica ?? 'ninguno',
      valoresMap: vals,
      observacion: obs,
    })
      .then(() => {
        setSavingMap((prev) => ({ ...prev, [pregId]: 'saved' }))
        setTimeout(() => setSavingMap((prev) => ({ ...prev, [pregId]: 'idle' })), 2500)
      })
      .catch(() => setSavingMap((prev) => ({ ...prev, [pregId]: 'error' })))
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
      toast.error(e instanceof Error ? e.message : 'Error al cerrar auditoría')
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
                      onRespuesta={(r) => handleRespuesta(preg.id, r)}
                      onValor={(eid, v) => handleValor(preg.id, eid, v)}
                      onObservacion={(v) => handleObservacion(preg.id, v)}
                      onBlur={() => handleBlur(preg.id)}
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
