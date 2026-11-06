import { useState } from 'react'
import { motion } from 'motion/react'
import {
  ClipboardX, FileDown, Edit2,
  Link2, Unlink2,
} from 'lucide-react'
import { ModuloHeader } from '@/app/components/ModuloHeader'
import { BottomSheet } from '@/app/components/BottomSheet'
import { ListaSkeleton } from '@/app/components/ListaSkeleton'
import { Skeleton } from '@/app/components/ui/skeleton'
import { toast } from 'sonner'
import { useAuthContext } from '@/context/AuthContext'
import { puedeEditarFechaLibre } from '@/lib/permisos'
import { useModulosContext } from '@/context/ModulosContext'
import { useRanchos } from '@/hooks/useRanchos'
import {
  useAuditoriaVisitas,
  type AuditoriaVisitaConRancho,
  type AuditoriaItem,
} from '@/hooks/useAuditoriaVisitas'
import type { NoConformidad } from '@/types/database.types'
import { generarResumenNoConformidadesPDF } from '@/lib/pdf/m25/generarResumenNoConformidadesPDF'
import { Fab } from '@/app/components/Fab'
import { useContextoTarea } from '@/hooks/useContextoTarea'
import { BannerTareaOrigen } from '@/app/components/BannerTareaOrigen'
import { useAccionesCorrectivas, type NcBandejaItem } from '@/hooks/useAccionesCorrectivas'
import { useAsignacionHallazgos } from '@/hooks/useAsignacionHallazgos'
import { AsignarHallazgoSheet } from '@/app/components/hallazgos/AsignarHallazgoSheet'
import { resolverHallazgoVisita, formatFechaLimite } from '@/lib/hallazgos/asignacion'
import { useConexion } from '@/hooks/useConexion'
import { EstadoVacio } from '@/app/components/ui-mady/EstadoVacio'
import { ListaTarjetas } from '@/app/components/ui-mady/ListaTarjetas'
import { TarjetaRegistro } from '@/app/components/ui-mady/TarjetaRegistro'
import { Etiqueta } from '@/app/components/ui-mady/Etiqueta'
import { TituloSeccion } from '@/app/components/ui-mady/TituloSeccion'
import { Boton } from '@/app/components/ui-mady/Boton'
import { Campo } from '@/app/components/ui-mady/Campo'
import { PieFormulario } from '@/app/components/ui-mady/PieFormulario'
import { useEntradaPantalla } from '@/lib/motion'
import { fechaCorta, formatoPct } from '@/lib/formato'

// ── Constantes ────────────────────────────────────────────────────────────────

const TITULO_MODULO = 'Resumen de No-Conformidades'
const CLAVE_MODULO  = 'M25 — PrimusGFS'

// ── Helpers ───────────────────────────────────────────────────────────────────

const hoy = () => new Date().toLocaleDateString('en-CA', { timeZone: 'America/Mexico_City' })

function formatFecha(iso: string): string {
  try {
    return fechaCorta(iso)
  } catch { return iso }
}

// ── Pantalla principal ────────────────────────────────────────────────────────

export function ResumenNoConformidades() {
  const { profile, user } = useAuthContext()
  const esSuperAdmin = profile?.rol === 'super_admin'
  const puedeEditarFecha = esSuperAdmin || puedeEditarFechaLibre(user?.email)
  const { terminosSitio } = useModulosContext()
  const { ranchos } = useRanchos()
  const { ranchoInicial, tareaId } = useContextoTarea(ranchos)
  const {
    visitas, loading, error, refetch,
    crearVisita, actualizarVisita,
    cargarNcrs, cargarAuditoriasVinculadas, cargarAuditoriasDisponibles,
    vincularAuditoria, desvincularAuditoria,
  } = useAuditoriaVisitas()

  const ent = useEntradaPantalla(!loading)
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

  // ── Asignación de hallazgos (solo con el detalle abierto) ──────────────────

  const { online } = useConexion()
  const bandeja = useAccionesCorrectivas(sheetDetalleAbierto)
  const itemsVisita = bandeja.items.filter((i) => i.visita_id === visitaDetalle?.id)
  const asig = useAsignacionHallazgos(itemsVisita, sheetDetalleAbierto)
  const [itemAsignar, setItemAsignar] = useState<NcBandejaItem | null>(null)

  function abrirAsignar(item: NcBandejaItem) {
    if (!online) { toast.warning('Necesitas conexión para asignar un hallazgo'); return }
    setItemAsignar(item)
    asig.cargarColaboradores()
  }

  // ── Funciones de apertura ──────────────────────────────────────────────────

  function abrirNuevo() {
    setEditandoVisita(null)
    setRanchoId(ranchoInicial ?? '')
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
    <div className="min-h-full pb-safe-nav">

      {/* Header */}
      <ModuloHeader
        tituloFallback={TITULO_MODULO}
        subtitulo={CLAVE_MODULO}
      />
      <BannerTareaOrigen tareaId={tareaId} />

      {/* Lista de visitas */}
      <div className="p-4 space-y-3">
        {loading ? (
          <ListaSkeleton rejilla onReintentar={refetch} />
        ) : error ? (
          <div className="bg-card border border-border rounded-xl p-6 text-center">
            <ClipboardX className="w-10 h-10 text-muted-foreground mx-auto mb-2" />
            <p className="text-sm text-muted-foreground">No se pudieron cargar las visitas</p>
          </div>
        ) : visitas.length === 0 ? (
          <EstadoVacio icono={ClipboardX} titulo="Sin visitas registradas aún" ayuda="Toca + para registrar la primera visita de auditoría" />
        ) : (
          <ListaTarjetas>
            {visitas.map((v, index) => (
              <motion.div key={v.id} {...ent(index)}>
                <TarjetaRegistro
                  sinFirmas
                  meta={[formatFecha(v.fecha)]}
                  titulo={v.rancho_nombre}
                  tituloTexto={v.rancho_nombre}
                  chips={(
                    <>
                      {v.pa_pgfs && <Etiqueta tono="neutral" className="font-normal">PA-PGFS: {v.pa_pgfs}</Etiqueta>}
                      <Etiqueta tono="neutral" className="font-normal">{v.auditor_nombre}</Etiqueta>
                    </>
                  )}
                  acciones={(
                    <>
                      <button
                        onClick={() => abrirEdicion(v)}
                        className="p-2 text-muted-foreground hover:text-primary transition-colors"
                        title="Editar visita"
                      >
                        <Edit2 className="w-4 h-4" />
                      </button>
                      <Boton variante="secundario" tamano="sm" onClick={() => abrirDetalle(v)}>
                        Ver detalles
                      </Boton>
                    </>
                  )}
                />
              </motion.div>
            ))}
          </ListaTarjetas>
        )}
      </div>

      {/* FAB */}
      <Fab onClick={abrirNuevo} aria-label="Nueva visita" />

      {/* ── Bottom Sheet — Formulario ────────────────────────────────────────── */}
      <BottomSheet
        open={sheetFormAbierto}
        onClose={() => !guardando && setSheetFormAbierto(false)}
        height="95%"
        title={editandoVisita ? 'Editar visita' : 'Nueva visita'}
      >
        {/* Campos */}
        <div className="flex-1 overflow-y-auto p-4 space-y-4">

          {/* Instalación / Rancho */}
          <Campo etiqueta={terminosSitio.singular} requerido error={errRancho ? `Selecciona ${terminosSitio.singular.toLowerCase()}` : undefined} className="gap-1.5">
            {({ id, describedBy, invalid }) => (
              <select
                id={id}
                aria-describedby={describedBy}
                aria-invalid={invalid}
                value={rancho_id}
                onChange={(e) => { setRanchoId(e.target.value); setErrRancho(false) }}
                className={`w-full h-11 px-3 rounded-lg bg-input-background border text-sm focus:outline-none focus:border-primary focus:ring-1 focus:ring-primary ${
                  errRancho ? 'border-agro-red' : 'border-border-control'
                } ${!rancho_id ? 'text-muted-foreground' : 'text-foreground'}`}
              >
                <option value="" disabled>
                  Seleccionar {terminosSitio.singular.toLowerCase()}
                </option>
                {ranchoOptions.map((o) => (
                  <option key={o.value} value={o.value}>{o.label}</option>
                ))}
              </select>
            )}
          </Campo>

          {/* Fecha */}
          <Campo etiqueta="Fecha" requerido className="gap-1.5">
            {({ id }) => (
              <input
                id={id}
                type="date"
                value={fecha}
                min={puedeEditarFecha ? undefined : hoy()}
                max={puedeEditarFecha ? undefined : hoy()}
                onChange={(e) => { if (puedeEditarFecha) setFecha(e.target.value) }}
                className="w-full h-11 px-3 rounded-lg bg-input-background border border-border-control text-sm text-foreground focus:outline-none focus:border-primary focus:ring-1 focus:ring-primary"
              />
            )}
          </Campo>

          {/* Auditor */}
          <Campo etiqueta="Auditor" className="gap-1.5">
            {({ id }) => (
              <input
                id={id}
                type="text"
                value={auditor_nombre}
                onChange={(e) => setAuditorNombre(e.target.value)}
                placeholder={profile?.nombre_completo ?? 'Nombre del auditor'}
                className="w-full h-11 px-3 rounded-lg bg-input-background border border-border-control text-sm text-foreground focus:outline-none focus:border-primary focus:ring-1 focus:ring-primary"
              />
            )}
          </Campo>

          {/* Cliente / Representante */}
          <Campo etiqueta="Cliente / representante" className="gap-1.5">
            {({ id }) => (
              <input
                id={id}
                type="text"
                value={cliente_nombre}
                onChange={(e) => setClienteNombre(e.target.value)}
                placeholder="Nombre del cliente o representante"
                className="w-full h-11 px-3 rounded-lg bg-input-background border border-border-control text-sm text-foreground focus:outline-none focus:border-primary focus:ring-1 focus:ring-primary"
              />
            )}
          </Campo>

          {/* PA-PGFS */}
          <Campo etiqueta="PA-PGFS (folio)" className="gap-1.5">
            {({ id }) => (
              <input
                id={id}
                type="text"
                value={pa_pgfs}
                onChange={(e) => setPaPgfs(e.target.value)}
                placeholder="Opcional"
                className="w-full h-11 px-3 rounded-lg bg-input-background border border-border-control text-sm text-foreground focus:outline-none focus:border-primary focus:ring-1 focus:ring-primary"
              />
            )}
          </Campo>

          {/* Observaciones */}
          <Campo etiqueta="Observaciones" className="gap-1.5">
            {({ id }) => (
              <textarea
                id={id}
                value={observaciones}
                onChange={(e) => setObservaciones(e.target.value)}
                placeholder="Observaciones generales de la visita..."
                rows={3}
                className="w-full px-3 py-2.5 rounded-lg bg-input-background border border-border-control text-sm text-foreground focus:outline-none focus:border-primary focus:ring-1 focus:ring-primary resize-none"
              />
            )}
          </Campo>

        </div>

        <PieFormulario
          textoPrincipal="Guardar"
          onPrincipal={handleGuardar}
          onCancelar={() => setSheetFormAbierto(false)}
          cargando={guardando}
        />
      </BottomSheet>

      {/* ── Bottom Sheet — Detalle ───────────────────────────────────────────── */}
      <BottomSheet
        open={sheetDetalleAbierto}
        onClose={() => setSheetDetalleAbierto(false)}
        height="95%"
        title={visitaDetalle?.rancho_nombre ?? ''}
      >

        {/* Contenido scrollable */}
        <div className="flex-1 overflow-y-auto p-4 space-y-5">

          {visitaDetalle && (
            <p className="text-xs text-muted-foreground -mb-2">{formatFecha(visitaDetalle.fecha)}</p>
          )}

          {/* Información de la visita */}
          {visitaDetalle && (
            <section>
              <TituloSeccion variante="subtitulo" className="mb-2">Información de la visita</TituloSeccion>
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
            <TituloSeccion variante="subtitulo" className="mb-2">Auditorías vinculadas</TituloSeccion>

            {loadingVinculadas ? (
              <Skeleton className="h-9 w-48 rounded-full" />
            ) : (
              <div className="space-y-2">
                {/* Chips de vinculadas */}
                {auditoriasVinculadas.length > 0 && (
                  <div className="flex flex-wrap gap-2">
                    {auditoriasVinculadas.map((item) => (
                      <div
                        key={item.id}
                        className="flex items-center gap-1.5 pl-3 pr-2 py-1.5 rounded-full border border-border text-xs font-semibold"
                      >
                        <span className="text-foreground">{item.modulo_label}</span>
                        <span
                          className="px-1.5 py-0.5 rounded text-caption"
                          style={{
                            backgroundColor: 'var(--agro-success-fill)',
                            color: 'var(--agro-success-text)',
                          }}
                        >
                          {formatoPct(item.porcentaje)}
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
                    className="mt-2 flex items-center gap-2 text-xs text-primary hover:opacity-70 transition-opacity font-semibold"
                  >
                    <Link2 className="w-3.5 h-3.5" />
                    Buscar auditorías disponibles
                  </button>
                )}

                {/* Disponibles para vincular */}
                {buscandoDisponibles && (
                  <div className="mt-3">
                    <TituloSeccion variante="subtitulo" className="mb-2">Disponibles para vincular</TituloSeccion>
                    {loadingDisponibles ? (
                      <Skeleton className="h-9 w-48 rounded-full" />
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
                            className="flex items-center gap-1.5 pl-3 pr-2 py-1.5 rounded-full border border-primary text-xs hover:bg-primary/5 transition-colors font-semibold"
                            style={{ color: 'var(--primary)' }}
                          >
                            {item.modulo_label}
                            <span
                              className="px-1.5 py-0.5 rounded text-caption"
                              style={{
                                backgroundColor: 'var(--muted)',
                                color: 'var(--muted-foreground)',
                              }}
                            >
                              {formatoPct(item.porcentaje)}
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
            <TituloSeccion variante="subtitulo" className="mb-2">No-conformidades</TituloSeccion>

            {loadingNcrs ? (
              <Skeleton className="h-24 w-full rounded-xl" />
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
                        className="text-left px-3 py-2 text-muted-foreground border-b border-border whitespace-nowrap font-semibold"
                      >
                        No. NCR
                      </th>
                      <th
                        className="text-left px-3 py-2 text-muted-foreground border-b border-border whitespace-nowrap font-semibold"
                      >
                        Módulo
                      </th>
                      <th
                        className="text-left px-3 py-2 text-muted-foreground border-b border-border whitespace-nowrap font-semibold"
                      >
                        Código
                      </th>
                      <th
                        className="text-left px-3 py-2 text-muted-foreground border-b border-border font-semibold"
                      >
                        Pregunta
                      </th>
                      <th
                        className="text-left px-3 py-2 text-muted-foreground border-b border-border font-semibold"
                      >
                        Comentario
                      </th>
                      <th
                        className="text-left px-3 py-2 text-muted-foreground border-b border-border whitespace-nowrap font-semibold"
                      >
                        Responsable · Fecha límite
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
                        <td className="px-3 py-2 text-foreground whitespace-nowrap font-semibold">
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
                        <td className="px-3 py-2 text-foreground" style={{ minWidth: '170px' }}>
                          {(() => {
                            if (bandeja.loading) return <Skeleton className="h-4 w-28" />
                            const origen = resolverHallazgoVisita(ncr, itemsVisita, visitaDetalle?.id)
                            if (!origen) return <span className="text-muted-foreground">Origen pendiente de verificar</span>
                            const est = asig.estados[origen.respuesta_id]
                            return (
                              <div className="space-y-1.5">
                                <p>
                                  {est?.owner_user_id
                                    ? `${est.owner_nombre ?? 'Colaborador'}${est.fecha_limite ? ` · ${formatFechaLimite(est.fecha_limite)}` : ''}`
                                    : 'Sin asignar'}
                                </p>
                                {asig.puedeAsignar && origen.estado !== 'cerrada' && (
                                  <button
                                    type="button"
                                    onClick={() => abrirAsignar(origen)}
                                    className="h-8 px-3 rounded-lg text-xs text-primary border border-primary hover:bg-primary/5 transition-colors font-semibold"
                                  >
                                    {est?.owner_user_id ? 'Editar asignación' : 'Asignar'}
                                  </button>
                                )}
                              </div>
                            )
                          })()}
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
        <div className="px-4 py-3 border-t border-border flex-shrink-0">
          <Boton className="w-full" onClick={handleDescargarPDF} cargando={generandoPDF}>
            <FileDown className="w-4 h-4" />
            Descargar PDF
          </Boton>
        </div>
      </BottomSheet>

      <AsignarHallazgoSheet
        item={itemAsignar}
        colaboradores={asig.colaboradores}
        cargandoColab={asig.cargandoColab}
        errorColab={asig.errorColab}
        onRecargarColab={asig.cargarColaboradores}
        onGuardado={async () => { await Promise.all([asig.recargarEstados(), bandeja.refetch()]) }}
        onClose={() => setItemAsignar(null)}
      />

    </div>
  )
}
