import { useState, useMemo, type ReactNode } from 'react'
import {
  ChevronLeft, Plus, FileDown, X, Loader2, Files, ChevronDown, AlertTriangle,
} from 'lucide-react'
import { useNavigate } from 'react-router'
import { BottomSheet } from '@/app/components/BottomSheet'
import { toast } from 'sonner'
import { useAuthContext } from '@/context/AuthContext'
import { puedeEditarFechaLibre } from '@/lib/permisos'
import { useModulosContext } from '@/context/ModulosContext'
import { useRanchos } from '@/hooks/useRanchos'
import { useAuditoriaV2, calcularProgresoCatalogo } from '@/hooks/useAuditoriaV2'
import { SeccionAccordion } from './SeccionAccordion'
import { ResumenPuntaje } from './ResumenPuntaje'
import { generarAuditoriaV2PDF, generarAuditoriaV2ConsolidadoPDF } from '@/lib/pdf/auditoria/generarAuditoriaPDF'
import type { ModuloAuditoria } from '@/hooks/useAuditoria'
import type { AudRespuesta, AudEstado, AudAuditoriaConRancho } from '@/types/database.types'

const hoy = () => new Date().toLocaleDateString('en-CA', { timeZone: 'America/Mexico_City' })

function formatFecha(iso: string): string {
  try {
    return new Date(iso + 'T12:00:00').toLocaleDateString('es-MX', {
      day: 'numeric', month: 'short', year: 'numeric',
    })
  } catch { return iso }
}

function chipEstado(estado: AudEstado) {
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
      En proceso
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
  const { profile, user } = useAuthContext()
  const esSuperAdmin = profile?.rol === 'super_admin'
  const puedeEditarFecha = esSuperAdmin || puedeEditarFechaLibre(user?.email)
  const { terminosSitio } = useModulosContext()
  const { ranchos } = useRanchos()
  const { bloques, preguntas, esquemas, loadingCatalogo, auditorias, loading, refetch, cargarInstancias, guardar } =
    useAuditoriaV2(modulo)

  // Form state
  const [sheetAbierto, setSheetAbierto] = useState(false)
  const [editandoId, setEditandoId] = useState<string | null>(null)
  const [rancho_id, setRanchoId] = useState('')
  const [fecha, setFecha] = useState(hoy())
  const [auditor_nombre, setAuditorNombre] = useState('')
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const [portada, setPortada] = useState<any>({})
  const [respuestas, setRespuestas] = useState<Map<string, AudRespuesta>>(new Map())
  const [instanciaValores, setInstanciaValores] = useState<Map<string, Map<string, string>>>(new Map())
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

  const scoreTotal = useMemo(
    () => calcularProgresoCatalogo(preguntas, respuestas),
    [preguntas, respuestas]
  )

  const preguntasPorBloque = useMemo(() => {
    const map = new Map<string, typeof preguntas>()
    for (const b of bloques) map.set(b.id, [])
    for (const p of preguntas) {
      if (map.has(p.bloque_id)) map.get(p.bloque_id)!.push(p)
    }
    return map
  }, [bloques, preguntas])

  function setRespuesta(preguntaId: string, respuesta: AudRespuesta) {
    setRespuestas((prev) => new Map(prev).set(preguntaId, respuesta))
  }

  function setInstanciaValor(preguntaId: string, esquemaId: string, valor: string) {
    setInstanciaValores((prev) => {
      const next = new Map(prev)
      const pregMap = new Map(prev.get(preguntaId) ?? [])
      if (valor) pregMap.set(esquemaId, valor)
      else pregMap.delete(esquemaId)
      if (pregMap.size > 0) next.set(preguntaId, pregMap)
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
    setInstanciaValores(new Map())
    setErrRancho(false)
    setSheetAbierto(true)
  }

  async function abrirEdicion(auditoria: AudAuditoriaConRancho) {
    setCargandoEdicion(true)
    try {
      const { respuestasMap, valoresMap } = await cargarInstancias(auditoria.id)
      setEditandoId(auditoria.id)
      setRanchoId(auditoria.rancho_id)
      setFecha(auditoria.fecha)
      setAuditorNombre(auditoria.auditor_nombre ?? '')
      setPortada({})
      setRespuestas(respuestasMap)
      setInstanciaValores(valoresMap)
      setErrRancho(false)
      setSheetAbierto(true)
    } catch {
      toast.error('No se pudieron cargar las respuestas')
    } finally {
      setCargandoEdicion(false)
    }
  }

  async function handleGuardar(estado: AudEstado) {
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
      const auditoriaId = await guardar({
        auditoriaId: editandoId ?? undefined,
        rancho_id,
        fecha,
        auditor_nombre,
        estado,
        respuestasMap: respuestas,
        valoresMap: instanciaValores,
      })
      toast.success(estado === 'completada' ? 'Auditoría completada' : 'Guardado como borrador')
      setSheetAbierto(false)
      await refetch()

      if (estado === 'completada') {
        const rancho = ranchos.find((r) => r.id === rancho_id)
        const ranchoNombre = rancho?.nombre ?? '—'
        try {
          await generarAuditoriaV2PDF(auditoriaId, modulo, ranchoNombre, fecha)
        } catch {
          // PDF generation is non-blocking
        }
      }
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

  async function handleDescargarPDF(a: AudAuditoriaConRancho) {
    setGenerandoPDF(a.id)
    try {
      await generarAuditoriaV2PDF(a.id, modulo, a.rancho_nombre, a.fecha)
    } catch {
      toast.error('No se pudo generar el PDF')
    } finally {
      setGenerandoPDF(null)
    }
  }

  async function handleGenerarConsolidado() {
    if (!consDesde || !consHasta) {
      toast.warning('Selecciona el rango de fechas')
      return
    }
    setGenerandoConsolidado(true)
    try {
      await generarAuditoriaV2ConsolidadoPDF(
        modulo, consDesde, consHasta, consRanchoId || undefined
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
                  </div>
                  <p className="text-xs text-muted-foreground">{formatFecha(a.fecha)}</p>
                  {a.auditor_nombre && (
                    <p className="text-xs text-muted-foreground mt-0.5">Por: {a.auditor_nombre}</p>
                  )}
                </div>
                <div className="flex items-center gap-1 shrink-0">
                  {a.estado === 'en_proceso' && (
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
      <BottomSheet open={sheetConsAbierto} onClose={() => setSheetConsAbierto(false)}>
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
      </BottomSheet>

      {/* Bottom Sheet — formulario auditoría */}
      <BottomSheet open={sheetAbierto} onClose={() => setSheetAbierto(false)} height="95%">
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
            {errRancho && <p className="text-xs text-agro-red mt-1">Selecciona un {terminosSitio.singular.toLowerCase()}</p>}
          </div>

          <div>
            <label className="block text-xs text-muted-foreground mb-1.5" style={{ fontWeight: 600 }}>
              FECHA *
            </label>
            <input
              type="date"
              value={fecha}
              min={puedeEditarFecha ? undefined : hoy()}
              max={puedeEditarFecha ? undefined : hoy()}
              onChange={(e) => { if (puedeEditarFecha) setFecha(e.target.value) }}
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

          {/* Portada (M15/M16/M17 — datos informativos, no persisten en v1) */}
          {renderPortada && (
            <PortadaAccordion>
              {renderPortada({ portada, onChange: setPortada })}
            </PortadaAccordion>
          )}

          {/* Aviso PrimusGFS */}
          <div
            className="text-[10px] rounded-lg px-3 py-2 leading-relaxed"
            style={{ backgroundColor: 'var(--muted)', color: 'var(--muted-foreground)' }}
          >
            Informe interno de preparación. M.A.D.Y. no certifica, no sustituye al auditor
            autorizado ni al organismo de certificación.
          </div>

          {/* Resumen de puntaje */}
          {!loadingCatalogo && preguntas.length > 0 && (
            <ResumenPuntaje preguntas={preguntas} respuestas={respuestas} />
          )}

          {/* Checklist por bloque */}
          {loadingCatalogo ? (
            <div className="flex justify-center py-8">
              <Loader2 className="w-6 h-6 text-primary animate-spin" />
            </div>
          ) : bloques.length === 0 ? (
            <div className="bg-muted rounded-xl p-4 text-center">
              <p className="text-sm text-muted-foreground">No se encontró el catálogo de preguntas</p>
            </div>
          ) : (
            <div className="space-y-3">
              {bloques.map((bloque) => {
                const pregs = preguntasPorBloque.get(bloque.id) ?? []
                return (
                  <SeccionAccordion
                    key={bloque.id}
                    seccion={bloque}
                    preguntas={pregs}
                    esquemas={esquemas}
                    respuestas={respuestas}
                    instanciaValores={instanciaValores}
                    onRespuesta={setRespuesta}
                    onValor={setInstanciaValor}
                  />
                )
              })}
            </div>
          )}

          {/* Resumen inferior */}
          {!loadingCatalogo && preguntas.length > 0 && scoreTotal.puntos_posibles === 0 && (
            <div className="rounded-xl p-3 bg-muted text-center">
              <p className="text-xs text-muted-foreground">
                Total: <strong>{respuestas.size}/{preguntas.length} respondidas</strong>
              </p>
            </div>
          )}

        </div>

        {/* Footer — dos botones */}
        <div className="p-4 border-t border-border shrink-0 flex gap-2">
          <button
            onClick={() => handleGuardar('en_proceso')}
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
      </BottomSheet>
    </div>
  )
}
