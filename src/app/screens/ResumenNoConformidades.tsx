import { useState } from 'react'
import {
  ChevronLeft, Plus, X, Loader2, ClipboardX, FileDown, Edit2,
  Link2, Unlink2,
} from 'lucide-react'
import { useNavigate } from 'react-router'
import { BottomSheet } from '@/app/components/BottomSheet'
import { toast } from 'sonner'
import { useAuthContext } from '@/context/AuthContext'
import { useModulosContext } from '@/context/ModulosContext'
import { useRanchos } from '@/hooks/useRanchos'
import {
  useAuditoriaVisitas,
  type AuditoriaVisitaConRancho,
  type AuditoriaItem,
} from '@/hooks/useAuditoriaVisitas'
import type { NoConformidad } from '@/types/database.types'
import { generarResumenNoConformidadesPDF } from '@/lib/pdf/m25/generarResumenNoConformidadesPDF'

// ── Constantes ────────────────────────────────────────────────────────────────

const TITULO_MODULO = 'Resumen de No-Conformidades'
const CLAVE_MODULO  = 'M25 — PrimusGFS'

// ── Helpers ───────────────────────────────────────────────────────────────────

const hoy = () => new Date().toISOString().split('T')[0]

function formatFecha(iso: string): string {
  try {
    return new Date(iso + 'T12:00:00').toLocaleDateString('es-MX', {
      day: 'numeric', month: 'short', year: 'numeric',
    })
  } catch { return iso }
}

// ── Pantalla principal ────────────────────────────────────────────────────────

export function ResumenNoConformidades() {
  const navigate = useNavigate()
  const { profile } = useAuthContext()
  const esSuperAdmin = profile?.rol === 'super_admin'
  const { terminosSitio } = useModulosContext()
  const { ranchos } = useRanchos()
  const {
    visitas, loading, error, refetch,
    crearVisita, actualizarVisita,
    cargarNcrs, cargarAuditoriasVinculadas, cargarAuditoriasDisponibles,
    vincularAuditoria, desvincularAuditoria,
  } = useAuditoriaVisitas()

  const ranchoOptions = ranchos.map((r) => ({ value: r.id, label: r.nombre }))

  // ── State: form sheet ──────────────────────────────────────────────────────

  const [sheetFormAbierto, setSheetFormAbierto] = useState(false)
  const [editandoVisita, setEditandoVisita] = useState<AuditoriaVisitaConRancho | null>(null)
  const [rancho_id, setRanchoId] = useState('')
  const [fecha, setFecha] = useState(hoy())
  const [auditor_nombre, setAuditorNombre] = useState('')
  const [cliente_nombre, setClienteNombre] = useState('')
  const [pa_pgfs, setPaPgfs] = useState('')
  const [observaciones, setObservaciones] = useState('')
  const [guardando, setGuardando] = useState(false)
  const [errRancho, setErrRancho] = useState(false)

  // ── State: detalle sheet ───────────────────────────────────────────────────

  const [sheetDetalleAbierto, setSheetDetalleAbierto] = useState(false)
  const [visitaDetalle, setVisitaDetalle] = useState<AuditoriaVisitaConRancho | null>(null)
  const [ncrs, setNcrs] = useState<NoConformidad[]>([])
  const [loadingNcrs, setLoadingNcrs] = useState(false)
  const [auditoriasVinculadas, setAuditoriasVinculadas] = useState<AuditoriaItem[]>([])
  const [loadingVinculadas, setLoadingVinculadas] = useState(false)
  const [auditoriasDisponibles, setAuditoriasDisponibles] = useState<AuditoriaItem[]>([])
  const [loadingDisponibles, setLoadingDisponibles] = useState(false)
  const [buscandoDisponibles, setBuscandoDisponibles] = useState(false)
  const [generandoPDF, setGenerandoPDF] = useState(false)

  // ── Funciones de apertura ──────────────────────────────────────────────────

  function abrirNuevo() {
    setEditandoVisita(null)
    setRanchoId('')
    setFecha(hoy())
    setAuditorNombre(profile?.nombre_completo ?? '')
    setClienteNombre('')
    setPaPgfs('')
    setObservaciones('')
    setErrRancho(false)
    setSheetFormAbierto(true)
  }

  function abrirEdicion(v: AuditoriaVisitaConRancho) {
    setEditandoVisita(v)
    setRanchoId(v.rancho_id)
    setFecha(v.fecha)
    setAuditorNombre(v.auditor_nombre)
    setClienteNombre(v.cliente_nombre)
    setPaPgfs(v.pa_pgfs ?? '')
    setObservaciones(v.observaciones ?? '')
    setErrRancho(false)
    setSheetFormAbierto(true)
  }

  async function abrirDetalle(v: AuditoriaVisitaConRancho) {
    setVisitaDetalle(v)
    setNcrs([])
    setAuditoriasVinculadas([])
    setAuditoriasDisponibles([])
    setBuscandoDisponibles(false)
    setSheetDetalleAbierto(true)
    setLoadingNcrs(true)
    setLoadingVinculadas(true)
    try {
      const [ncrData, vinculadas] = await Promise.all([
        cargarNcrs(v.id),
        cargarAuditoriasVinculadas(v.id),
      ])
      setNcrs(ncrData)
      setAuditoriasVinculadas(vinculadas)
    } catch {
      toast.error('No se pudo cargar el detalle')
    } finally {
      setLoadingNcrs(false)
      setLoadingVinculadas(false)
    }
  }

  // ── Guardar ────────────────────────────────────────────────────────────────

  async function handleGuardar() {
    if (!rancho_id) { setErrRancho(true); return }
    setGuardando(true)
    try {
      const params = {
        rancho_id,
        fecha,
        auditor_nombre,
        cliente_nombre,
        pa_pgfs: pa_pgfs.trim() || null,
        observaciones: observaciones.trim() || null,
      }
      if (editandoVisita) {
        await actualizarVisita(editandoVisita.id, params)
      } else {
        await crearVisita(params)
      }
      toast.success(editandoVisita ? 'Visita actualizada' : 'Visita creada')
      setSheetFormAbierto(false)
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

  // ── Buscar disponibles ─────────────────────────────────────────────────────

  async function handleBuscarDisponibles() {
    if (!visitaDetalle) return
    setLoadingDisponibles(true)
    setBuscandoDisponibles(true)
    try {
      const disponibles = await cargarAuditoriasDisponibles(visitaDetalle.rancho_id, visitaDetalle.fecha)
      setAuditoriasDisponibles(disponibles)
    } catch {
      toast.error('No se pudieron cargar las auditorías disponibles')
    } finally {
      setLoadingDisponibles(false)
    }
  }

  // ── Vincular ───────────────────────────────────────────────────────────────

  async function handleVincular(item: AuditoriaItem) {
    if (!visitaDetalle) return
    try {
      await vincularAuditoria(item.id, item.modulo, visitaDetalle.id)
      const [ncrData, vinculadas, disponibles] = await Promise.all([
        cargarNcrs(visitaDetalle.id),
        cargarAuditoriasVinculadas(visitaDetalle.id),
        buscandoDisponibles
          ? cargarAuditoriasDisponibles(visitaDetalle.rancho_id, visitaDetalle.fecha)
          : Promise.resolve(auditoriasDisponibles),
      ])
      setNcrs(ncrData)
      setAuditoriasVinculadas(vinculadas)
      if (buscandoDisponibles) setAuditoriasDisponibles(disponibles)
      toast.success(`${item.modulo_label} vinculada`)
    } catch {
      toast.error('No se pudo vincular la auditoría')
    }
  }

  // ── Desvincular ────────────────────────────────────────────────────────────

  async function handleDesvincular(item: AuditoriaItem) {
    if (!visitaDetalle) return
    try {
      await desvincularAuditoria(item.id, item.modulo)
      const [ncrData, vinculadas] = await Promise.all([
        cargarNcrs(visitaDetalle.id),
        cargarAuditoriasVinculadas(visitaDetalle.id),
      ])
      setNcrs(ncrData)
      setAuditoriasVinculadas(vinculadas)
      if (buscandoDisponibles) {
        const disponibles = await cargarAuditoriasDisponibles(visitaDetalle.rancho_id, visitaDetalle.fecha)
        setAuditoriasDisponibles(disponibles)
      }
      toast.success(`${item.modulo_label} desvinculada`)
    } catch {
      toast.error('No se pudo desvincular la auditoría')
    }
  }

  // ── PDF ────────────────────────────────────────────────────────────────────

  async function handleDescargarPDF() {
    if (!visitaDetalle || !profile?.org_id) return
    setGenerandoPDF(true)
    try {
      await generarResumenNoConformidadesPDF(visitaDetalle.id, profile.org_id, visitaDetalle.fecha)
    } catch {
      toast.error('No se pudo generar el PDF')
    } finally {
      setGenerandoPDF(false)
    }
  }

  // ── Render ─────────────────────────────────────────────────────────────────

  return (
    <div className="min-h-full pb-[calc(72px+34px)]">

      {/* Header */}
      <header className="bg-card border-b border-border px-4 py-4 sticky top-0 z-20">
        <div className="flex items-center gap-3">
          <button
            onClick={() => navigate('/')}
            className="p-1 text-muted-foreground flex-shrink-0"
          >
            <ChevronLeft className="w-5 h-5" />
          </button>
          <div className="flex-1 min-w-0">
            <h1 className="text-foreground truncate" style={{ fontWeight: 600 }}>
              {TITULO_MODULO}
            </h1>
            <p className="text-xs text-muted-foreground">{CLAVE_MODULO}</p>
          </div>
          <div className="w-9 h-9 bg-primary/10 rounded-lg flex items-center justify-center flex-shrink-0 text-primary">
            <ClipboardX className="w-5 h-5" />
          </div>
        </div>
      </header>

      {/* Lista de visitas */}
      <div className="p-4 space-y-3">
        {loading ? (
          <div className="flex justify-center py-12">
            <Loader2 className="w-8 h-8 text-primary animate-spin" />
          </div>
        ) : error ? (
          <div className="bg-card border border-border rounded-xl p-6 text-center">
            <ClipboardX className="w-10 h-10 text-muted-foreground mx-auto mb-2" />
            <p className="text-sm text-muted-foreground">No se pudieron cargar las visitas</p>
          </div>
        ) : visitas.length === 0 ? (
          <div className="bg-card border border-border rounded-xl p-6 text-center">
            <ClipboardX className="w-10 h-10 text-muted-foreground mx-auto mb-2" />
            <p className="text-sm text-muted-foreground">Sin visitas registradas aún</p>
            <p className="text-xs text-muted-foreground mt-1">
              Toca + para registrar la primera visita de auditoría
            </p>
          </div>
        ) : (
          visitas.map((v) => (
            <div key={v.id} className="bg-card border border-border rounded-xl p-4">
              <div className="flex items-start justify-between gap-3">
                <div className="flex-1 min-w-0">
                  <p className="text-sm text-foreground truncate" style={{ fontWeight: 600 }}>
                    {v.rancho_nombre}
                  </p>
                  <p className="text-xs text-muted-foreground mt-0.5">
                    {formatFecha(v.fecha)}
                    {v.pa_pgfs ? ` · PA-PGFS: ${v.pa_pgfs}` : ''}
                  </p>
                  <p className="text-xs text-muted-foreground mt-0.5">{v.auditor_nombre}</p>
                </div>
                <div className="flex items-center gap-1 flex-shrink-0">
                  {/* Editar */}
                  <button
                    onClick={() => abrirEdicion(v)}
                    className="p-2 text-muted-foreground hover:text-primary transition-colors"
                    title="Editar visita"
                  >
                    <Edit2 className="w-4 h-4" />
                  </button>
                  {/* Ver detalles */}
                  <button
                    onClick={() => abrirDetalle(v)}
                    className="h-8 px-3 rounded-lg text-xs text-primary border border-primary hover:bg-primary/5 transition-colors flex-shrink-0"
                    style={{ fontWeight: 600 }}
                  >
                    Ver detalles
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
          className="w-14 h-14 rounded-full bg-primary text-white flex items-center justify-center pointer-events-auto hover:bg-agro-blue transition-colors"
          aria-label="Nueva visita"
        >
          <Plus className="w-6 h-6" />
        </button>
      </div>

      {/* ── Bottom Sheet — Formulario ────────────────────────────────────────── */}
      <BottomSheet
        open={sheetFormAbierto}
        onClose={() => !guardando && setSheetFormAbierto(false)}
        height="95%"
      >
        {/* Handle */}
        <div className="flex justify-center pt-3 pb-1 flex-shrink-0">
          <div className="w-10 h-1 rounded-full bg-border" />
        </div>

        {/* Header sheet */}
        <div className="flex items-center justify-between px-4 py-3 border-b border-border flex-shrink-0">
          <h2 className="text-base text-foreground" style={{ fontWeight: 600 }}>
            {editandoVisita ? 'Editar visita' : 'Nueva visita'}
          </h2>
          <button
            onClick={() => !guardando && setSheetFormAbierto(false)}
            className="p-1"
          >
            <X className="w-5 h-5 text-muted-foreground" />
          </button>
        </div>

        {/* Campos */}
        <div className="flex-1 overflow-y-auto p-4 space-y-4">

          {/* Instalación / Rancho */}
          <div>
            <label className="block text-xs text-muted-foreground mb-1.5" style={{ fontWeight: 600 }}>
              {terminosSitio.singular.toUpperCase()} *
            </label>
            <select
              value={rancho_id}
              onChange={(e) => { setRanchoId(e.target.value); setErrRancho(false) }}
              className={`w-full h-11 px-3 rounded-lg bg-input-background border text-sm focus:outline-none focus:border-primary focus:ring-1 focus:ring-primary ${
                errRancho ? 'border-agro-red' : 'border-border'
              } ${!rancho_id ? 'text-muted-foreground' : 'text-foreground'}`}
            >
              <option value="" disabled>
                Seleccionar {terminosSitio.singular.toLowerCase()}
              </option>
              {ranchoOptions.map((o) => (
                <option key={o.value} value={o.value}>{o.label}</option>
              ))}
            </select>
            {errRancho && (
              <p className="text-xs mt-1" style={{ color: 'var(--agro-red)' }}>
                Selecciona {terminosSitio.singular.toLowerCase()}
              </p>
            )}
          </div>

          {/* Fecha */}
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

          {/* Auditor */}
          <div>
            <label className="block text-xs text-muted-foreground mb-1.5" style={{ fontWeight: 600 }}>
              AUDITOR
            </label>
            <input
              type="text"
              value={auditor_nombre}
              onChange={(e) => setAuditorNombre(e.target.value)}
              placeholder={profile?.nombre_completo ?? 'Nombre del auditor'}
              className="w-full h-11 px-3 rounded-lg bg-input-background border border-border text-sm text-foreground focus:outline-none focus:border-primary focus:ring-1 focus:ring-primary"
            />
          </div>

          {/* Cliente / Representante */}
          <div>
            <label className="block text-xs text-muted-foreground mb-1.5" style={{ fontWeight: 600 }}>
              CLIENTE / REPRESENTANTE
            </label>
            <input
              type="text"
              value={cliente_nombre}
              onChange={(e) => setClienteNombre(e.target.value)}
              placeholder="Nombre del cliente o representante"
              className="w-full h-11 px-3 rounded-lg bg-input-background border border-border text-sm text-foreground focus:outline-none focus:border-primary focus:ring-1 focus:ring-primary"
            />
          </div>

          {/* PA-PGFS */}
          <div>
            <label className="block text-xs text-muted-foreground mb-1.5" style={{ fontWeight: 600 }}>
              PA-PGFS (FOLIO)
            </label>
            <input
              type="text"
              value={pa_pgfs}
              onChange={(e) => setPaPgfs(e.target.value)}
              placeholder="Opcional"
              className="w-full h-11 px-3 rounded-lg bg-input-background border border-border text-sm text-foreground focus:outline-none focus:border-primary focus:ring-1 focus:ring-primary"
            />
          </div>

          {/* Observaciones */}
          <div>
            <label className="block text-xs text-muted-foreground mb-1.5" style={{ fontWeight: 600 }}>
              OBSERVACIONES
            </label>
            <textarea
              value={observaciones}
              onChange={(e) => setObservaciones(e.target.value)}
              placeholder="Observaciones generales de la visita..."
              rows={3}
              className="w-full px-3 py-2.5 rounded-lg bg-input-background border border-border text-sm text-foreground focus:outline-none focus:border-primary focus:ring-1 focus:ring-primary resize-none"
            />
          </div>

        </div>

        {/* Footer */}
        <div className="px-4 pb-6 pt-4 border-t border-border flex-shrink-0">
          <button
            onClick={handleGuardar}
            disabled={guardando}
            className="w-full h-14 bg-primary text-white rounded-3xl flex items-center justify-center gap-2 disabled:opacity-50 hover:bg-agro-blue transition-colors"
            style={{ fontWeight: 600 }}
          >
            {guardando && <Loader2 className="w-4 h-4 animate-spin" />}
            {guardando ? 'Guardando...' : 'Guardar'}
          </button>
        </div>
      </BottomSheet>

      {/* ── Bottom Sheet — Detalle ───────────────────────────────────────────── */}
      <BottomSheet
        open={sheetDetalleAbierto}
        onClose={() => setSheetDetalleAbierto(false)}
        height="95%"
      >
        {/* Handle */}
        <div className="flex justify-center pt-3 pb-1 flex-shrink-0">
          <div className="w-10 h-1 rounded-full bg-border" />
        </div>

        {/* Header detalle */}
        <div className="flex items-start justify-between px-4 py-3 border-b border-border flex-shrink-0">
          <div className="flex-1 min-w-0 pr-3">
            <h2 className="text-base text-foreground truncate" style={{ fontWeight: 600 }}>
              {visitaDetalle?.rancho_nombre ?? ''}
            </h2>
            {visitaDetalle && (
              <p className="text-xs text-muted-foreground mt-0.5">
                {formatFecha(visitaDetalle.fecha)}
              </p>
            )}
          </div>
          <button
            onClick={() => setSheetDetalleAbierto(false)}
            className="p-1 flex-shrink-0"
          >
            <X className="w-5 h-5 text-muted-foreground" />
          </button>
        </div>

        {/* Contenido scrollable */}
        <div className="flex-1 overflow-y-auto p-4 space-y-5">

          {/* Información de la visita */}
          {visitaDetalle && (
            <section>
              <p className="text-xs text-muted-foreground mb-2" style={{ fontWeight: 600 }}>
                INFORMACIÓN DE LA VISITA
              </p>
              <div className="rounded-xl p-4 space-y-2" style={{ backgroundColor: 'var(--muted)' }}>
                <div className="flex gap-2 text-sm">
                  <span className="text-muted-foreground flex-shrink-0 w-24">Auditor</span>
                  <span className="text-foreground">{visitaDetalle.auditor_nombre}</span>
                </div>
                <div className="flex gap-2 text-sm">
                  <span className="text-muted-foreground flex-shrink-0 w-24">Cliente</span>
                  <span className="text-foreground">{visitaDetalle.cliente_nombre}</span>
                </div>
                {visitaDetalle.pa_pgfs && (
                  <div className="flex gap-2 text-sm">
                    <span className="text-muted-foreground flex-shrink-0 w-24">PA-PGFS</span>
                    <span className="text-foreground">{visitaDetalle.pa_pgfs}</span>
                  </div>
                )}
                {visitaDetalle.observaciones && (
                  <div className="flex gap-2 text-sm">
                    <span className="text-muted-foreground flex-shrink-0 w-24">Observaciones</span>
                    <span className="text-foreground">{visitaDetalle.observaciones}</span>
                  </div>
                )}
              </div>
            </section>
          )}

          {/* Auditorías vinculadas */}
          <section>
            <p className="text-xs text-muted-foreground mb-2" style={{ fontWeight: 600 }}>
              AUDITORÍAS VINCULADAS
            </p>

            {loadingVinculadas ? (
              <div className="flex justify-center py-4">
                <Loader2 className="w-5 h-5 text-primary animate-spin" />
              </div>
            ) : (
              <div className="space-y-2">
                {/* Chips de vinculadas */}
                {auditoriasVinculadas.length > 0 && (
                  <div className="flex flex-wrap gap-2">
                    {auditoriasVinculadas.map((item) => (
                      <div
                        key={item.id}
                        className="flex items-center gap-1.5 pl-3 pr-2 py-1.5 rounded-full border border-border text-xs"
                        style={{ fontWeight: 600 }}
                      >
                        <span className="text-foreground">{item.modulo_label}</span>
                        <span
                          className="px-1.5 py-0.5 rounded text-[10px]"
                          style={{
                            backgroundColor: 'var(--agro-success-fill)',
                            color: 'var(--agro-success-text)',
                          }}
                        >
                          {item.porcentaje}%
                        </span>
                        <button
                          onClick={() => handleDesvincular(item)}
                          className="p-0.5 text-muted-foreground hover:text-agro-red transition-colors"
                          title="Desvincular"
                        >
                          <Unlink2 className="w-3 h-3" />
                        </button>
                      </div>
                    ))}
                  </div>
                )}

                {auditoriasVinculadas.length === 0 && !buscandoDisponibles && (
                  <p className="text-xs text-muted-foreground">
                    Ninguna auditoría vinculada.
                  </p>
                )}

                {/* Botón buscar disponibles */}
                {!buscandoDisponibles && (
                  <button
                    onClick={handleBuscarDisponibles}
                    className="mt-2 flex items-center gap-2 text-xs text-primary hover:opacity-70 transition-opacity"
                    style={{ fontWeight: 600 }}
                  >
                    <Link2 className="w-3.5 h-3.5" />
                    Buscar auditorías disponibles
                  </button>
                )}

                {/* Disponibles para vincular */}
                {buscandoDisponibles && (
                  <div className="mt-3">
                    <p className="text-xs text-muted-foreground mb-2" style={{ fontWeight: 600 }}>
                      DISPONIBLES PARA VINCULAR
                    </p>
                    {loadingDisponibles ? (
                      <div className="flex justify-center py-3">
                        <Loader2 className="w-5 h-5 text-primary animate-spin" />
                      </div>
                    ) : auditoriasDisponibles.length === 0 ? (
                      <p className="text-xs text-muted-foreground">
                        No hay auditorías disponibles para esta fecha e instalación.
                      </p>
                    ) : (
                      <div className="flex flex-wrap gap-2">
                        {auditoriasDisponibles.map((item) => (
                          <button
                            key={item.id}
                            onClick={() => handleVincular(item)}
                            className="flex items-center gap-1.5 pl-3 pr-2 py-1.5 rounded-full border border-primary text-xs hover:bg-primary/5 transition-colors"
                            style={{ fontWeight: 600, color: 'var(--primary)' }}
                          >
                            {item.modulo_label}
                            <span
                              className="px-1.5 py-0.5 rounded text-[10px]"
                              style={{
                                backgroundColor: 'var(--muted)',
                                color: 'var(--muted-foreground)',
                              }}
                            >
                              {item.porcentaje}%
                            </span>
                            <Link2 className="w-3 h-3" />
                          </button>
                        ))}
                      </div>
                    )}
                  </div>
                )}
              </div>
            )}
          </section>

          {/* No-Conformidades */}
          <section>
            <p className="text-xs text-muted-foreground mb-2" style={{ fontWeight: 600 }}>
              NO-CONFORMIDADES
            </p>

            {loadingNcrs ? (
              <div className="flex justify-center py-4">
                <Loader2 className="w-5 h-5 text-primary animate-spin" />
              </div>
            ) : ncrs.length === 0 ? (
              <div className="rounded-xl border border-border p-4 text-center">
                <p className="text-xs text-muted-foreground">
                  Sin no-conformidades en esta visita
                </p>
              </div>
            ) : (
              <div className="overflow-x-auto rounded-xl border border-border">
                <table className="w-full text-xs border-collapse">
                  <thead>
                    <tr style={{ backgroundColor: 'var(--muted)' }}>
                      <th
                        className="text-left px-3 py-2 text-muted-foreground border-b border-border whitespace-nowrap"
                        style={{ fontWeight: 600 }}
                      >
                        No. NCR
                      </th>
                      <th
                        className="text-left px-3 py-2 text-muted-foreground border-b border-border whitespace-nowrap"
                        style={{ fontWeight: 600 }}
                      >
                        Módulo
                      </th>
                      <th
                        className="text-left px-3 py-2 text-muted-foreground border-b border-border whitespace-nowrap"
                        style={{ fontWeight: 600 }}
                      >
                        Código
                      </th>
                      <th
                        className="text-left px-3 py-2 text-muted-foreground border-b border-border"
                        style={{ fontWeight: 600 }}
                      >
                        Pregunta
                      </th>
                      <th
                        className="text-left px-3 py-2 text-muted-foreground border-b border-border"
                        style={{ fontWeight: 600 }}
                      >
                        Comentario
                      </th>
                    </tr>
                  </thead>
                  <tbody>
                    {ncrs.map((ncr, idx) => (
                      <tr
                        key={`${ncr.ncr}-${idx}`}
                        className="border-b border-border last:border-0"
                        style={{ backgroundColor: idx % 2 === 0 ? 'var(--card)' : 'var(--muted)' }}
                      >
                        <td className="px-3 py-2 text-foreground whitespace-nowrap" style={{ fontWeight: 600 }}>
                          {ncr.ncr}
                        </td>
                        <td className="px-3 py-2 text-muted-foreground whitespace-nowrap">
                          {ncr.modulo}
                        </td>
                        <td className="px-3 py-2 text-muted-foreground whitespace-nowrap">
                          {ncr.codigo_pregunta}
                        </td>
                        <td className="px-3 py-2 text-foreground" style={{ minWidth: '160px' }}>
                          {ncr.texto_pregunta}
                        </td>
                        <td className="px-3 py-2 text-muted-foreground" style={{ minWidth: '140px' }}>
                          {ncr.comentario}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </section>

        </div>

        {/* Footer detalle */}
        <div className="px-4 pb-6 pt-4 border-t border-border flex-shrink-0">
          <button
            onClick={handleDescargarPDF}
            disabled={generandoPDF}
            className="w-full h-12 bg-primary text-white rounded-3xl flex items-center justify-center gap-2 disabled:opacity-50 hover:bg-agro-blue transition-colors"
            style={{ fontWeight: 600 }}
          >
            {generandoPDF
              ? <Loader2 className="w-4 h-4 animate-spin" />
              : <FileDown className="w-4 h-4" />
            }
            {generandoPDF ? 'Generando PDF...' : 'Descargar PDF'}
          </button>
        </div>
      </BottomSheet>

    </div>
  )
}
