import { useState, useMemo, type ReactNode } from 'react'
import {
  ChevronLeft, Plus, FileDown, X, Loader2, Files, ChevronDown, AlertTriangle,
} from 'lucide-react'
import { useNavigate } from 'react-router'
import { toast } from 'sonner'
import { useAuthContext } from '@/context/AuthContext'
import { useModulosContext } from '@/context/ModulosContext'
import { useRanchos } from '@/hooks/useRanchos'
import { useAuditoria, calcularAgregados, type ModuloAuditoria, type AuditoriaConRancho } from '@/hooks/useAuditoria'
import { SeccionAccordion } from './SeccionAccordion'
import { ResumenPuntaje } from './ResumenPuntaje'
import { generarAuditoriaPDF, generarAuditoriaConsolidadoPDF } from '@/lib/pdf/auditoria/generarAuditoriaPDF'
import type { RespuestaAuditoria, EstadoAuditoria } from '@/types/database.types'

const hoy = () => new Date().toISOString().split('T')[0]

function formatFecha(iso: string): string {
  try {
    return new Date(iso + 'T12:00:00').toLocaleDateString('es-MX', {
      day: 'numeric', month: 'short', year: 'numeric',
    })
  } catch { return iso }
}

function chipEstado(estado: EstadoAuditoria) {
  if (estado === 'completada') {
    return (
      <span
        className="text-[11px] px-2 py-0.5 rounded shrink-0"
        style={{ backgroundColor: 'var(--agro-success-fill)', color: 'var(--agro-success-text)', fontWeight: 600 }}
      >
        Completada
      </span>
    )
  }
  return (
    <span
      className="text-[11px] px-2 py-0.5 rounded shrink-0"
      style={{ backgroundColor: 'var(--agro-warning-fill)', color: 'var(--agro-warning-text)', fontWeight: 600 }}
    >
      Borrador
    </span>
  )
}

function scoreChip(porcentaje: number, posibles: number) {
  if (posibles === 0) return null
  const cls =
    porcentaje >= 85
      ? 'bg-agro-success-fill text-agro-success-text'
      : porcentaje >= 70
      ? 'bg-agro-warning-fill text-agro-warning-text'
      : 'bg-agro-danger-fill text-agro-danger-text'
  return (
    <span className={`text-[11px] px-2 py-0.5 rounded shrink-0 ${cls}`} style={{ fontWeight: 600 }}>
      {porcentaje}%
    </span>
  )
}

// ── Portada accordion ─────────────────────────────────────────────────────────

function PortadaAccordion({ children }: { children: ReactNode }) {
  const [abierto, setAbierto] = useState(false)
  return (
    <div className="bg-card border border-border rounded-xl overflow-hidden">
      <button
        type="button"
        onClick={() => setAbierto((a) => !a)}
        className="w-full px-4 py-3 flex items-center justify-between"
      >
        <span className="text-sm text-foreground" style={{ fontWeight: 600 }}>
          Portada del reporte
        </span>
        <ChevronDown
          className={`w-4 h-4 text-muted-foreground transition-transform duration-200 ${abierto ? 'rotate-180' : ''}`}
        />
      </button>
      {abierto && (
        <div className="px-4 pb-4 border-t border-border pt-4 space-y-4">
          {children}
        </div>
      )}
    </div>
  )
}

// ── Props ─────────────────────────────────────────────────────────────────────

interface AuditoriaScreenProps {
  modulo: ModuloAuditoria
  titulo: string
  clave: string
  icono: ReactNode
  renderPortada?: (props: {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    portada: any
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    onChange: (p: any) => void
  }) => ReactNode
}

// ── Main screen ───────────────────────────────────────────────────────────────

export function AuditoriaScreen({
  modulo,
  titulo,
  clave,
  icono,
  renderPortada,
}: AuditoriaScreenProps) {
  const navigate = useNavigate()
  const { profile } = useAuthContext()
  const esSuperAdmin = profile?.rol === 'super_admin'
  const { terminosSitio } = useModulosContext()
  const { ranchos } = useRanchos()
  const { secciones, preguntas, loadingCatalogo, auditorias, loading, refetch, cargarRespuestas, guardar } =
    useAuditoria(modulo)

  // Form state
  const [sheetAbierto, setSheetAbierto] = useState(false)
  const [editandoId, setEditandoId] = useState<string | null>(null)
  const [rancho_id, setRanchoId] = useState('')
  const [fecha, setFecha] = useState(hoy())
  const [auditor_nombre, setAuditorNombre] = useState('')
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const [portada, setPortada] = useState<any>({})
  const [respuestas, setRespuestas] = useState<Map<string, RespuestaAuditoria>>(new Map())
  const [comentarios, setComentarios] = useState<Map<string, string>>(new Map())
  const [errRancho, setErrRancho] = useState(false)
  const [guardando, setGuardando] = useState(false)
  const [cargandoEdicion, setCargandoEdicion] = useState(false)
  const [generandoPDF, setGenerandoPDF] = useState<string | null>(null)

  // Consolidado sheet
  const [sheetConsAbierto, setSheetConsAbierto] = useState(false)
  const [consRanchoId, setConsRanchoId] = useState('')
  const [consDesde, setConsDesde] = useState('')
  const [consHasta, setConsHasta] = useState(hoy())
  const [generandoConsolidado, setGenerandoConsolidado] = useState(false)

  const ranchoOptions = ranchos.map((r) => ({ value: r.id, label: r.nombre }))

  // Live score
  const scoreTotal = useMemo(
    () => calcularAgregados(preguntas, respuestas),
    [preguntas, respuestas]
  )

  // Group preguntas by seccion
  const preguntasPorSeccion = useMemo(() => {
    const map = new Map<string, typeof preguntas>()
    for (const s of secciones) map.set(s.id, [])
    for (const p of preguntas) {
      if (map.has(p.seccion_id)) map.get(p.seccion_id)!.push(p)
    }
    return map
  }, [secciones, preguntas])

  function setRespuesta(preguntaId: string, respuesta: RespuestaAuditoria) {
    setRespuestas((prev) => new Map(prev).set(preguntaId, respuesta))
  }

  function setComentario(preguntaId: string, comentario: string) {
    setComentarios((prev) => {
      const next = new Map(prev)
      if (comentario) next.set(preguntaId, comentario)
      else next.delete(preguntaId)
      return next
    })
  }

  function abrirNuevo() {
    setEditandoId(null)
    setRanchoId('')
    setFecha(hoy())
    setAuditorNombre(profile?.nombre_completo ?? '')
    setPortada({})
    setRespuestas(new Map())
    setComentarios(new Map())
    setErrRancho(false)
    setSheetAbierto(true)
  }

  async function abrirEdicion(auditoria: AuditoriaConRancho) {
    setCargandoEdicion(true)
    try {
      const existentes = await cargarRespuestas(auditoria.id)
      const rMap = new Map<string, RespuestaAuditoria>()
      const cMap = new Map<string, string>()
      for (const r of existentes) {
        rMap.set(r.pregunta_id, r.respuesta)
        if (r.comentario) cMap.set(r.pregunta_id, r.comentario)
      }
      setEditandoId(auditoria.id)
      setRanchoId(auditoria.rancho_id)
      setFecha(auditoria.fecha)
      setAuditorNombre(auditoria.auditor_nombre ?? '')
      setPortada(auditoria.portada ?? {})
      setRespuestas(rMap)
      setComentarios(cMap)
      setErrRancho(false)
      setSheetAbierto(true)
    } catch {
      toast.error('No se pudieron cargar las respuestas')
    } finally {
      setCargandoEdicion(false)
    }
  }

  async function handleGuardar(estado: EstadoAuditoria) {
    if (!rancho_id) { setErrRancho(true); return }
    if (!profile?.org_id) { toast.error('Sin organización activa'); return }

    if (estado === 'completada') {
      const sinResponder = preguntas.filter((p) => !respuestas.has(p.id)).length
      if (sinResponder > 0) {
        const continuar = window.confirm(
          `Hay ${sinResponder} pregunta${sinResponder > 1 ? 's' : ''} sin responder. ¿Completar de todas formas?`
        )
        if (!continuar) return
      }
    }

    setGuardando(true)
    try {
      await guardar({
        auditoriaId: editandoId ?? undefined,
        rancho_id,
        fecha,
        auditor_nombre,
        portada: renderPortada ? portada : undefined,
        estado,
        respuestasMap: respuestas,
        comentariosMap: comentarios,
      })
      toast.success(estado === 'completada' ? 'Auditoría completada' : 'Borrador guardado')
      setSheetAbierto(false)
      await refetch()
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : 'No se pudo guardar'
      if (msg.includes('FECHA_SOLO_HOY')) {
        toast.warning('Solo puedes registrar con la fecha de hoy')
      } else {
        toast.error(msg)
      }
    } finally {
      setGuardando(false)
    }
  }

  async function handleDescargarPDF(a: AuditoriaConRancho) {
    if (!profile?.org_id) return
    setGenerandoPDF(a.id)
    try {
      await generarAuditoriaPDF(a.id, profile.org_id, modulo, a.rancho_nombre, a.fecha)
    } catch {
      toast.error('No se pudo generar el PDF')
    } finally {
      setGenerandoPDF(null)
    }
  }

  async function handleGenerarConsolidado() {
    if (!profile?.org_id) return
    if (!consDesde || !consHasta) {
      toast.warning('Selecciona el rango de fechas')
      return
    }
    setGenerandoConsolidado(true)
    try {
      await generarAuditoriaConsolidadoPDF(
        modulo, profile.org_id, consDesde, consHasta,
        consRanchoId || undefined
      )
      setSheetConsAbierto(false)
    } catch (err: unknown) {
      toast.error(err instanceof Error ? err.message : 'No se pudo generar el consolidado')
    } finally {
      setGenerandoConsolidado(false)
    }
  }

  // ── Render ──────────────────────────────────────────────────────────────────

  return (
    <div className="min-h-full pb-[calc(72px+34px)]">

      {/* Header */}
      <header className="bg-card border-b border-border px-4 py-4 sticky top-0 z-20">
        <div className="flex items-center gap-3">
          <button onClick={() => navigate('/')} className="p-1 text-muted-foreground shrink-0">
            <ChevronLeft className="w-5 h-5" />
          </button>
          <div className="flex-1 min-w-0">
            <h1 className="text-foreground truncate" style={{ fontWeight: 600 }}>
              {titulo}
            </h1>
            <p className="text-xs text-muted-foreground">{clave}</p>
          </div>
          <div className="w-9 h-9 bg-primary/10 rounded-lg flex items-center justify-center shrink-0 text-primary">
            {icono}
          </div>
        </div>
      </header>

      {/* Botón consolidado */}
      <div className="px-4 pt-3">
        <button
          onClick={() => {
            setConsRanchoId('')
            setConsDesde('')
            setConsHasta(hoy())
            setSheetConsAbierto(true)
          }}
          className="w-full h-10 flex items-center justify-center gap-2 rounded-xl border border-primary text-primary text-sm hover:bg-primary/5 transition-colors"
          style={{ fontWeight: 600 }}
        >
          <Files className="w-4 h-4" />
          Exportar consolidado
        </button>
      </div>

      {/* Lista */}
      <div className="p-4 space-y-3">
        {loading ? (
          <div className="flex justify-center py-12">
            <Loader2 className="w-8 h-8 text-primary animate-spin" />
          </div>
        ) : auditorias.length === 0 ? (
          <div className="bg-card border border-border rounded-xl p-6 text-center">
            <div className="w-10 h-10 bg-primary/10 rounded-lg flex items-center justify-center mx-auto mb-2 text-primary">
              {icono}
            </div>
            <p className="text-sm text-muted-foreground">Sin auditorías aún</p>
            <p className="text-xs text-muted-foreground mt-1">Toca + para registrar la primera</p>
          </div>
        ) : (
          auditorias.map((a) => (
            <div
              key={a.id}
              className="bg-card rounded-xl p-4 border"
              style={{
                borderColor: a.requiere_correccion ? 'var(--agro-amber)' : 'var(--border)',
                backgroundColor: a.requiere_correccion ? 'var(--agro-warning-fill)' : undefined,
              }}
            >
              {a.requiere_correccion && a.comentario_correccion && (
                <div
                  className="flex items-start gap-2 mb-3 text-xs rounded-lg px-3 py-2"
                  style={{ backgroundColor: 'rgba(0,0,0,0.05)', color: 'var(--agro-warning-text)' }}
                >
                  <AlertTriangle className="w-3 h-3 shrink-0 mt-0.5" />
                  {a.comentario_correccion}
                </div>
              )}
              <div className="flex items-start justify-between gap-3">
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2 flex-wrap mb-1">
                    <span className="text-sm text-foreground truncate" style={{ fontWeight: 600 }}>
                      {a.rancho_nombre}
                    </span>
                    {chipEstado(a.estado)}
                    {scoreChip(a.porcentaje, a.puntos_posibles)}
                  </div>
                  <p className="text-xs text-muted-foreground">{formatFecha(a.fecha)}</p>
                  {a.auditor_nombre && (
                    <p className="text-xs text-muted-foreground mt-0.5">Por: {a.auditor_nombre}</p>
                  )}
                  {a.puntos_posibles > 0 && (
                    <p className="text-xs text-muted-foreground mt-0.5">
                      {a.puntos_obtenidos}/{a.puntos_posibles} pts
                    </p>
                  )}
                </div>
                <div className="flex items-center gap-1 shrink-0">
                  {a.estado === 'borrador' && (
                    <button
                      onClick={() => abrirEdicion(a)}
                      disabled={cargandoEdicion}
                      className="text-xs px-3 py-1.5 rounded-lg border border-primary text-primary hover:bg-primary/5 transition-colors disabled:opacity-50"
                      style={{ fontWeight: 600 }}
                    >
                      {cargandoEdicion ? <Loader2 className="w-3 h-3 animate-spin" /> : 'Continuar'}
                    </button>
                  )}
                  <button
                    onClick={() => handleDescargarPDF(a)}
                    disabled={generandoPDF === a.id}
                    className="p-2 text-muted-foreground hover:text-primary transition-colors disabled:opacity-40"
                    title="Descargar PDF"
                  >
                    {generandoPDF === a.id
                      ? <Loader2 className="w-4 h-4 animate-spin" />
                      : <FileDown className="w-4 h-4" />
                    }
                  </button>
                </div>
              </div>
            </div>
          ))
        )}
      </div>

      {/* FAB */}
      <div className="fixed bottom-[calc(72px+34px+16px)] left-1/2 -translate-x-1/2 w-full max-w-[390px] flex justify-end px-4 pointer-events-none z-10">
        <button
          onClick={abrirNuevo}
          className="w-14 h-14 rounded-full bg-primary text-white flex items-center justify-center shadow-lg pointer-events-auto hover:bg-agro-blue transition-colors"
          aria-label="Nueva auditoría"
        >
          <Plus className="w-6 h-6" />
        </button>
      </div>

      {/* Bottom Sheet — consolidado */}
      {sheetConsAbierto && (
        <>
          <div className="fixed inset-0 bg-black/40 z-30" onClick={() => setSheetConsAbierto(false)} />
          <div
            className="fixed bottom-0 left-0 right-0 z-40 bg-card flex flex-col"
            style={{ borderRadius: '0.625rem 0.625rem 0 0', maxWidth: 390, margin: '0 auto' }}
          >
            <div className="flex justify-center pt-3 pb-1 shrink-0">
              <div className="w-10 h-1 rounded-full bg-border" />
            </div>
            <div className="flex items-center justify-between px-4 py-3 border-b border-border shrink-0">
              <h2 className="text-base text-foreground" style={{ fontWeight: 600 }}>
                Exportar consolidado
              </h2>
              <button onClick={() => setSheetConsAbierto(false)} className="p-1">
                <X className="w-5 h-5 text-muted-foreground" />
              </button>
            </div>
            <div className="overflow-y-auto p-4 space-y-4">
              <div>
                <label className="block text-xs text-muted-foreground mb-1.5" style={{ fontWeight: 600 }}>
                  {terminosSitio.singular.toUpperCase()}
                </label>
                <select
                  value={consRanchoId}
                  onChange={(e) => setConsRanchoId(e.target.value)}
                  className={`w-full h-11 px-3 rounded-lg bg-input-background border text-sm focus:outline-none focus:border-primary focus:ring-1 focus:ring-primary ${!consRanchoId ? 'text-muted-foreground' : 'text-foreground'} border-border`}
                >
                  <option value="">{terminosSitio.plural}</option>
                  {ranchoOptions.map((o) => <option key={o.value} value={o.value}>{o.label}</option>)}
                </select>
              </div>
              <div>
                <label className="block text-xs text-muted-foreground mb-1.5" style={{ fontWeight: 600 }}>
                  DESDE *
                </label>
                <input type="date" value={consDesde} onChange={(e) => setConsDesde(e.target.value)}
                  className="w-full h-11 px-3 rounded-lg bg-input-background border border-border text-sm text-foreground focus:outline-none focus:border-primary focus:ring-1 focus:ring-primary"
                />
              </div>
              <div>
                <label className="block text-xs text-muted-foreground mb-1.5" style={{ fontWeight: 600 }}>
                  HASTA *
                </label>
                <input type="date" value={consHasta} onChange={(e) => setConsHasta(e.target.value)}
                  className="w-full h-11 px-3 rounded-lg bg-input-background border border-border text-sm text-foreground focus:outline-none focus:border-primary focus:ring-1 focus:ring-primary"
                />
              </div>
            </div>
            <div className="p-4 border-t border-border shrink-0">
              <button
                onClick={handleGenerarConsolidado}
                disabled={generandoConsolidado}
                className="w-full h-14 bg-primary text-white rounded-3xl flex items-center justify-center gap-2 hover:bg-agro-blue transition-colors disabled:opacity-50"
                style={{ fontWeight: 600 }}
              >
                {generandoConsolidado && <Loader2 className="w-4 h-4 animate-spin" />}
                Generar PDF consolidado
              </button>
            </div>
          </div>
        </>
      )}

      {/* Bottom Sheet — formulario auditoría */}
      {sheetAbierto && (
        <>
          <div className="fixed inset-0 bg-black/40 z-30" onClick={() => setSheetAbierto(false)} />
          <div
            className="fixed bottom-0 left-0 right-0 z-40 bg-card flex flex-col"
            style={{
              height: '95%',
              borderRadius: '0.625rem 0.625rem 0 0',
              maxWidth: 390,
              margin: '0 auto',
            }}
          >
            {/* Handle */}
            <div className="flex justify-center pt-3 pb-1 shrink-0">
              <div className="w-10 h-1 rounded-full bg-border" />
            </div>

            {/* Header */}
            <div className="flex items-center justify-between px-4 py-3 border-b border-border shrink-0">
              <h2 className="text-base text-foreground" style={{ fontWeight: 600 }}>
                {editandoId ? 'Continuar auditoría' : 'Nueva auditoría'}
              </h2>
              <button onClick={() => setSheetAbierto(false)} className="p-1">
                <X className="w-5 h-5 text-muted-foreground" />
              </button>
            </div>

            {/* Contenido scrollable */}
            <div className="flex-1 overflow-y-auto p-4 space-y-4">

              {/* Sitio */}
              <div>
                <label className="block text-xs text-muted-foreground mb-1.5" style={{ fontWeight: 600 }}>
                  {terminosSitio.singular.toUpperCase()} *
                </label>
                <select
                  value={rancho_id}
                  onChange={(e) => { setRanchoId(e.target.value); setErrRancho(false) }}
                  className={`w-full h-11 px-3 rounded-lg bg-input-background border text-sm focus:outline-none focus:border-primary focus:ring-1 focus:ring-primary ${errRancho ? 'border-agro-red' : 'border-border'} ${!rancho_id ? 'text-muted-foreground' : 'text-foreground'}`}
                >
                  <option value="" disabled>Seleccionar {terminosSitio.singular.toLowerCase()}</option>
                  {ranchoOptions.map((o) => <option key={o.value} value={o.value}>{o.label}</option>)}
                </select>
                {errRancho && <p className="text-xs text-agro-red mt-1">Selecciona {terminosSitio.genero === 'f' ? 'una' : 'un'} {terminosSitio.singular.toLowerCase()}</p>}
              </div>

              <div>
                <label className="block text-xs text-muted-foreground mb-1.5" style={{ fontWeight: 600 }}>
                  FECHA *
                </label>
                <input
                  type="date"
                  value={fecha}
                  min={esSuperAdmin ? undefined : hoy()}
                  max={esSuperAdmin ? undefined : hoy()}
                  onChange={(e) => { if (esSuperAdmin) setFecha(e.target.value) }}
                  className="w-full h-11 px-3 rounded-lg bg-input-background border border-border text-sm text-foreground focus:outline-none focus:border-primary focus:ring-1 focus:ring-primary"
                />
              </div>

              <div>
                <label className="block text-xs text-muted-foreground mb-1.5" style={{ fontWeight: 600 }}>
                  AUDITOR
                </label>
                <input
                  type="text"
                  placeholder="Nombre del auditor"
                  value={auditor_nombre}
                  onChange={(e) => setAuditorNombre(e.target.value)}
                  className="w-full h-11 px-3 rounded-lg bg-input-background border border-border text-sm text-foreground placeholder:text-muted-foreground focus:outline-none focus:border-primary focus:ring-1 focus:ring-primary"
                />
              </div>

              {/* Portada (solo M15/M16) */}
              {renderPortada && (
                <PortadaAccordion>
                  {renderPortada({ portada, onChange: setPortada })}
                </PortadaAccordion>
              )}

              {/* Resumen de puntaje */}
              {!loadingCatalogo && preguntas.length > 0 && (
                <ResumenPuntaje preguntas={preguntas} respuestas={respuestas} />
              )}

              {/* Checklist por sección */}
              {loadingCatalogo ? (
                <div className="flex justify-center py-8">
                  <Loader2 className="w-6 h-6 text-primary animate-spin" />
                </div>
              ) : secciones.length === 0 ? (
                <div className="bg-muted rounded-xl p-4 text-center">
                  <p className="text-sm text-muted-foreground">No se encontró el catálogo de preguntas</p>
                </div>
              ) : (
                <div className="space-y-3">
                  {secciones.map((sec) => {
                    const pregs = preguntasPorSeccion.get(sec.id) ?? []
                    return (
                      <SeccionAccordion
                        key={sec.id}
                        seccion={sec}
                        preguntas={pregs}
                        respuestas={respuestas}
                        comentarios={comentarios}
                        onRespuesta={setRespuesta}
                        onComentario={setComentario}
                      />
                    )
                  })}
                </div>
              )}

              {/* Resumen inferior */}
              {!loadingCatalogo && preguntas.length > 0 && scoreTotal.puntos_posibles > 0 && (
                <div className="rounded-xl p-3 bg-muted text-center">
                  <p className="text-xs text-muted-foreground">
                    Total: <strong>{scoreTotal.puntos_obtenidos}/{scoreTotal.puntos_posibles} pts · {scoreTotal.porcentaje}%</strong>
                  </p>
                </div>
              )}

            </div>

            {/* Footer — dos botones */}
            <div className="p-4 border-t border-border shrink-0 flex gap-2">
              <button
                onClick={() => handleGuardar('borrador')}
                disabled={guardando}
                className="flex-1 h-12 rounded-3xl border border-primary text-primary text-sm flex items-center justify-center gap-2 disabled:opacity-50 hover:bg-primary/5 transition-colors"
                style={{ fontWeight: 600 }}
              >
                {guardando && <Loader2 className="w-4 h-4 animate-spin" />}
                Guardar borrador
              </button>
              <button
                onClick={() => handleGuardar('completada')}
                disabled={guardando}
                className="flex-1 h-12 bg-primary text-white rounded-3xl text-sm flex items-center justify-center gap-2 disabled:opacity-50 hover:bg-agro-blue transition-colors"
                style={{ fontWeight: 600 }}
              >
                {guardando && <Loader2 className="w-4 h-4 animate-spin" />}
                Completar
              </button>
            </div>
          </div>
        </>
      )}
    </div>
  )
}
