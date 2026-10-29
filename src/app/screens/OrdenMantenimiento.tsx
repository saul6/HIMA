import { crearIncidenciaDesdeOrigen, camposOrigen, CONFLICTO_INCIDENCIA_ORIGEN } from '@/lib/m13Origen'
import { useState, useCallback, useMemo } from 'react'
import { Wrench, Plus, FileText, Loader2, AlertTriangle, TriangleAlert, X } from 'lucide-react'
import { toast } from 'sonner'
import { supabase } from '@/lib/supabase'
import { useConexion } from '@/hooks/useConexion'
import { useGuardarOffline } from '@/hooks/useGuardarOffline'
import { opInsert, opUpdate, opUpsert } from '@/lib/offline/construirOperaciones'
import { useAuthContext } from '@/context/AuthContext'
import { puedeEditarFechaLibre } from '@/lib/permisos'
import { useModulosContext } from '@/context/ModulosContext'
import { ModuloHeader } from '@/app/components/ModuloHeader'
import { ListaSkeleton } from '@/app/components/ListaSkeleton'
import { useRanchos } from '@/hooks/useRanchos'
import {
  useM44OrdenesMantenimiento,
  type M44Orden,
  type PrioridadM44,
} from '@/hooks/useM44OrdenesMantenimiento'
import { generarOrdenMantenimientoPDF } from '@/lib/pdf/m44/generarOrdenMantenimientoPDF'
import { Fab } from '@/app/components/Fab'
import { useContextoTarea } from '@/hooks/useContextoTarea'
import { BannerTareaOrigen } from '@/app/components/BannerTareaOrigen'
import { useFirmasRegistro } from '@/hooks/useFirmasRegistro'
import { FirmasRegistro } from '@/app/components/FirmasRegistro'
import { FirmaGatePaso } from '@/app/components/FirmaGatePaso'
import { PasoFirmaRegistro } from '@/app/components/PasoFirmaRegistro'
import { useFirmaContext } from '@/context/FirmaContext'
import { BottomSheet } from '@/app/components/BottomSheet'
import { TextareaContador } from '@/app/components/TextareaContador'
import { limiteTexto } from '@/lib/limitesTexto'
import { PendientesOffline } from '@/app/components/PendientesOffline'
import { EstadoVacio } from '@/app/components/ui-mady/EstadoVacio'
import { Etiqueta } from '@/app/components/ui-mady/Etiqueta'
import { ListaTarjetas } from '@/app/components/ui-mady/ListaTarjetas'
import { TarjetaRegistro } from '@/app/components/ui-mady/TarjetaRegistro'
import { TextoColapsable } from '@/app/components/ui-mady/TextoColapsable'
import { resumenFirmas, textoResumenLista } from '@/hooks/resumenFirmas'
import { Boton } from '@/app/components/ui-mady/Boton'

// ── Helpers ───────────────────────────────────────────────────────────────────

const hoyMX = () => new Date().toLocaleDateString('en-CA', { timeZone: 'America/Mexico_City' })
const tbl   = (name: string) => (supabase as any).from(name)

function fmtFecha(iso: string): string {
  try { const [y, m, d] = iso.split('-'); return `${d}/${m}/${y}` } catch { return iso }
}

const PRIORIDAD_LABELS: Record<PrioridadM44, string> = {
  inmediata:       'Atención inmediata',
  turno:           'Atención durante el turno',
  siguientes_dias: 'Atención durante los siguientes días',
}

const PRIORIDAD_COLORES: Record<PrioridadM44, string> = {
  inmediata:       'var(--agro-danger-text)',
  turno:           'var(--agro-info-text)',
  siguientes_dias: 'var(--muted-foreground)',
}

const PRIORIDAD_FONDOS: Record<PrioridadM44, string> = {
  inmediata:       'var(--agro-danger-fill)',
  turno:           'var(--agro-info-fill)',
  siguientes_dias: 'var(--muted)',
}

// ── SiNoToggle ────────────────────────────────────────────────────────────────

function SiNoToggle({
  value, onChange, label, danger,
}: {
  value: boolean; onChange: (v: boolean) => void; label: string; danger?: boolean
}) {
  return (
    <div className="flex items-center justify-between py-1.5">
      <span className="text-xs" style={{ color: !value && danger ? 'var(--agro-danger-text)' : 'inherit' }}>
        {label}
      </span>
      <button
        type="button"
        onClick={() => onChange(!value)}
        className="px-3 py-1 rounded-full text-xs min-w-[40px] font-semibold"
        style={{
          backgroundColor: value ? 'var(--agro-success-fill)' : 'var(--agro-danger-fill)',
          color:           value ? 'var(--agro-success-text)' : 'var(--agro-danger-text)',
        }}
      >
        {value ? 'Sí' : 'No'}
      </button>
    </div>
  )
}

// ── Form state ────────────────────────────────────────────────────────────────

interface FormState {
  rancho_id:             string
  fecha:                 string
  folio:                 string
  descripcion_solicitud: string
  prioridad:             PrioridadM44
  solicita:              string
  recibe_mtto:           string
  equipo_produccion:     boolean
  lavado_sanitizado:     boolean
  observaciones:         string
  entrega_mtto:          string
  recibe:                string
}

function formInicial(): FormState {
  return {
    rancho_id:             '',
    fecha:                 hoyMX(),
    folio:                 '',
    descripcion_solicitud: '',
    prioridad:             'turno',
    solicita:              '',
    recibe_mtto:           '',
    equipo_produccion:     false,
    lavado_sanitizado:     false,
    observaciones:         '',
    entrega_mtto:          '',
    recibe:                '',
  }
}

// ── Screen ────────────────────────────────────────────────────────────────────

export function OrdenMantenimiento() {
  const { profile, user, codigoClave } = useAuthContext()
  const { terminosSitio } = useModulosContext()
  const { ranchos }       = useRanchos()
  const { ranchoInicial, tareaId } = useContextoTarea(ranchos)
  const { ordenes, loading, error, refetch } = useM44OrdenesMantenimiento()
  const { obligatoria, tengoFirma } = useFirmaContext()
  const { online } = useConexion()
  const { guardar: guardarOffline } = useGuardarOffline('M44')

  const todosIds = useMemo(() => ordenes.map(o => o.id), [ordenes])
  const { firmas, loading: loadingFirmas, refetch: refetchFirmas } = useFirmasRegistro('M44', todosIds)
  // Sin datos de firmas todavía (cargando): franja neutra y sin conteo de pendientes.
  const sinDatosFirmas = loadingFirmas || (ordenes.length > 0 && Object.keys(firmas).length === 0)
  const pendientesFirma = sinDatosFirmas
    ? null
    : ordenes.filter(o => resumenFirmas(firmas[o.id]).estado === 'pendiente').length

  const esSuperAdmin = profile?.rol === 'super_admin'
  const puedeEditarFecha = esSuperAdmin || puedeEditarFechaLibre(user?.email)
  const orgId        = profile?.org_id ?? ''
  const termino      = terminosSitio.singular

  // ── Formulario ──
  const [abierto,   setAbierto]   = useState(false)
  const [sheetPaso, setSheetPaso] = useState<'firma_gate' | 'form' | 'firma_decision'>('form')
  const [pendienteFirmaId, setPendienteFirmaId] = useState<string | null>(null)
  const [cargando,  setCargando]  = useState(false)
  const [form,      setForm]      = useState<FormState>(formInicial)
  const [errRancho, setErrRancho] = useState(false)

  const setF = (patch: Partial<FormState>) => setForm((f) => ({ ...f, ...patch }))

  function handleCerrarModal() {
    setAbierto(false)
    setSheetPaso('form')
    setPendienteFirmaId(null)
  }

  const abrirFormulario = useCallback(() => {
    setForm({ ...formInicial(), rancho_id: ranchoInicial ?? '' })
    setErrRancho(false)
    setPendienteFirmaId(null)
    setSheetPaso(obligatoria && !tengoFirma ? 'firma_gate' : 'form')
    setAbierto(true)
  }, [ranchoInicial, obligatoria, tengoFirma])

  function camposOrden() {
    return {
      rancho_id:             form.rancho_id,
      fecha:                 form.fecha,
      folio:                 form.folio.trim() || null,
      descripcion_solicitud: form.descripcion_solicitud.trim() || null,
      prioridad:             form.prioridad,
      solicita:              form.solicita.trim() || null,
      recibe_mtto:           form.recibe_mtto.trim() || null,
      equipo_produccion:     form.equipo_produccion,
      lavado_sanitizado:     form.lavado_sanitizado,
      observaciones:         form.observaciones.trim() || null,
      entrega_mtto:          form.entrega_mtto.trim() || null,
      recibe:                form.recibe.trim() || null,
    }
  }

  const guardar = useCallback(async () => {
    if (!orgId) return
    if (!form.rancho_id) { setErrRancho(true); return }

    setCargando(true)
    try {
      if (!online) {
        const ordenIdOff = crypto.randomUUID()
        const conIncidencia = form.equipo_produccion && !form.lavado_sanitizado
        const reporteIdOff = conIncidencia ? crypto.randomUUID() : null
        const incidenciaIdOff = conIncidencia ? crypto.randomUUID() : null
        const rancho = ranchos.find(r => r.id === form.rancho_id)
        const ok = await guardarOffline({
          descripcion: `Orden de mantenimiento · ${rancho?.nombre ?? ''} · ${form.fecha}`,
          metadatos: { rancho_id: form.rancho_id, rancho_nombre: rancho?.nombre, fecha: form.fecha },
          operaciones: [
            opInsert('m44_ordenes', { id: ordenIdOff, rancho_id: form.rancho_id, ...camposOrden() }),
            ...(reporteIdOff && incidenciaIdOff ? [
              opInsert('m13_reportes', {
                id: reporteIdOff,
                rancho_id: form.rancho_id,
                org_id: orgId,
                fecha: form.fecha,
                auditor_nombre: profile?.nombre_completo ?? null,
              }),
              opUpsert('m13_incidencias', {
                id: incidenciaIdOff,
                ...camposOrigen('M44', ordenIdOff, `M44:${ordenIdOff}`),
                reporte_id: reporteIdOff,
                org_id: orgId,
                descripcion: 'Equipo de produccion reparado sin lavar y sanitizar despues del mantenimiento',
                orden: 1,
              }, CONFLICTO_INCIDENCIA_ORIGEN),
              // Igual que con red: la incidencia se enlaza con un UPDATE posterior a la orden
              opUpdate('m44_ordenes', ordenIdOff, { incidencia_id: incidenciaIdOff }),
            ] : []),
          ],
        })
        if (ok) handleCerrarModal()
        return
      }

      // INSERT orden sin incidencia_id aún
      const { data: ordenData, error: eOrd } = await tbl('m44_ordenes').insert({
        org_id:                orgId,
        ...camposOrden(),
      }).select('id').single()

      if (eOrd) {
        const msg = (eOrd as any).message ?? String(eOrd)
        if (msg.includes('FECHA_SOLO_HOY')) {
          toast.warning('Solo puedes registrar con la fecha de hoy')
          return
        }
        throw eOrd
      }

      const ordenId = ordenData.id as string

      // Regla de inocuidad: equipo de producción reparado sin sanitizar → M13
      if (form.equipo_produccion && !form.lavado_sanitizado) {
        try {
          const inc = await crearIncidenciaDesdeOrigen({
            ranchoId: form.rancho_id,
            fecha: form.fecha,
            origenModulo: 'M44',
            origenRegistroId: ordenId,
            origenClave: `M44:${ordenId}`,
            descripcion: 'Equipo de produccion reparado sin lavar y sanitizar despues del mantenimiento',
          })

          await tbl('m44_ordenes').update({ incidencia_id: inc.incidencia_id }).eq('id', ordenId)
        } catch { /* best-effort — la orden ya fue guardada */ }
      }

      await refetch()
      toast.success('Orden de mantenimiento guardada')
      setPendienteFirmaId(ordenId)
      setSheetPaso('firma_decision')
    } catch (e: unknown) {
      const msg = e instanceof Error ? e.message : String(e)
      if (msg.includes('FIRMA_REQUERIDA')) { setSheetPaso('firma_gate'); return }
      if (msg.includes('FECHA_SOLO_HOY')) {
        toast.warning('Solo puedes registrar con la fecha de hoy')
      } else {
        toast.error(msg || 'Error al guardar')
      }
    } finally {
      setCargando(false)
    }
  }, [orgId, form, profile?.nombre_completo, refetch, online, guardarOffline, ranchos])

  // ── PDF individual ──
  const [generandoPDF, setGenerandoPDF] = useState<string | null>(null)

  async function handlePDF(orden: M44Orden) {
    if (!orgId) return
    if (!online) { toast.warning('Necesitas conexión para generar el PDF'); return }
    if (obligatoria && !firmas[orden.id]?.realizo) {
      toast.info('Firma este registro antes de descargar el PDF')
      return
    }
    setGenerandoPDF(orden.id)
    try {
      await generarOrdenMantenimientoPDF(orden.id, orgId, codigoClave)
      toast.success('PDF descargado')
    } catch (e: unknown) {
      toast.error(e instanceof Error ? e.message : 'Error al generar PDF')
    } finally {
      setGenerandoPDF(null)
    }
  }

  const ranchoOptions = ranchos.map((r) => ({ value: r.id, label: `${r.nombre} (${r.codigo})` }))

  // ── Render ────────────────────────────────────────────────────────────────

  return (
    <div className="min-h-full pb-safe-nav" style={{ backgroundColor: 'var(--background)' }}>

      {/* Header */}
      <ModuloHeader
        tituloFallback="Orden de Mantenimiento"
        subtitulo="Cuarto Frío · Por evento"
        subtituloEscritorio={loading ? undefined : `Cuarto Frío · Por evento · ${textoResumenLista(ordenes.length, pendientesFirma)}`}
      />
      <BannerTareaOrigen tareaId={tareaId} />

      {/* Lista */}
      <div className="p-4 space-y-3">
        <PendientesOffline modulo="M44" />
        {error && (
          <div
            className="flex items-start gap-2 rounded-xl p-3"
            style={{ backgroundColor: 'var(--agro-danger-fill)', border: '1px solid var(--agro-red)' }}
          >
            <TriangleAlert className="w-4 h-4 flex-shrink-0 mt-0.5" style={{ color: 'var(--agro-danger-text)' }} />
            <p className="text-xs" style={{ color: 'var(--agro-danger-text)' }}>
              {error}
            </p>
          </div>
        )}

        {loading ? (
          <ListaSkeleton rejilla />
        ) : ordenes.length === 0 ? (
          <EstadoVacio icono={Wrench} titulo="Sin órdenes aún" ayuda="Crea la primera orden con el botón +" />
        ) : (
          <ListaTarjetas>
            {ordenes.map((o) => {
              const resumen = resumenFirmas(firmas[o.id], sinDatosFirmas)
              return (
                <TarjetaRegistro
                  key={o.id}
                  // requiere_correccion no viene en la consulta de M44: no se usa el estado "correccion"
                  estado={resumen.estado}
                  firmas={resumen.estado === 'neutro' ? null : resumen}
                  // En celular (< 972 px) la tarjeta es la de siempre: prioridad + #folio, rancho, fecha, descripción.
                  // En escritorio: folio como título y "rancho · fecha" arriba. Lo propio de cada ancho se oculta con clases.
                  etiquetas={(
                    <>
                      <span
                        className="text-xs px-2 py-0.5 rounded"
                        style={{
                          backgroundColor: PRIORIDAD_FONDOS[o.prioridad],
                          color:           PRIORIDAD_COLORES[o.prioridad],
                          fontWeight:      600,
                        }}
                      >
                        {PRIORIDAD_LABELS[o.prioridad]}
                      </span>
                      {o.folio && (
                        <span className="text-xs text-muted-foreground @min-[972px]/lista:hidden">#{o.folio}</span>
                      )}
                    </>
                  )}
                  meta={[
                    o.folio ? <span className="hidden @min-[972px]/lista:inline"><span className="font-semibold text-foreground">{o.rancho_nombre}</span></span> : null,
                    <span className="hidden @min-[972px]/lista:inline">{fmtFecha(o.fecha)}</span>,
                  ]}
                  titulo={(
                    <>
                      <span className="@min-[972px]/lista:hidden">{o.rancho_nombre}</span>
                      <span className="hidden @min-[972px]/lista:inline">{o.folio ? `#${o.folio}` : o.rancho_nombre}</span>
                    </>
                  )}
                  tituloTexto={o.folio ?? o.rancho_nombre}
                  tituloClassName="truncate @min-[972px]/lista:whitespace-normal"
                  contenido={(
                    <div className="@min-[972px]/lista:hidden">
                      <p className="text-xs text-muted-foreground mt-0.5">{fmtFecha(o.fecha)}</p>
                      {o.descripcion_solicitud && (
                        <div className="mt-1">
                          <TextoColapsable texto={o.descripcion_solicitud} className="text-xs text-muted-foreground" />
                        </div>
                      )}
                      {o.equipo_produccion && !o.lavado_sanitizado && (
                        <div className="flex items-center gap-1 mt-1.5">
                          <AlertTriangle className="w-3 h-3 flex-shrink-0" style={{ color: 'var(--agro-danger-text)' }} />
                          <span className="text-xs font-semibold" style={{ color: 'var(--agro-danger-text)' }}>
                            Sin sanitizar — incidencia M13 generada
                          </span>
                        </div>
                      )}
                      {obligatoria && !firmas[o.id]?.realizo && (
                        <Etiqueta tono="error" className="mt-1">
                          Pendiente de firma
                        </Etiqueta>
                      )}
                    </div>
                  )}
                  acciones={(
                    <button
                      onClick={() => handlePDF(o)}
                      disabled={generandoPDF === o.id}
                      className="p-2 rounded-lg flex-shrink-0 disabled:opacity-50"
                      style={{ color: 'var(--primary)' }}
                      title="Descargar PDF"
                      aria-label="Descargar PDF"
                    >
                      {generandoPDF === o.id ? (
                        <Loader2 className="w-5 h-5 animate-spin" />
                      ) : (
                        <FileText className="w-5 h-5" />
                      )}
                    </button>
                  )}
                  pie={(
                    <FirmasRegistro
                      variante="escritorio"
                      modulo="M44"
                      registroId={o.id}
                      fechaRegistro={o.fecha}
                      firma={firmas[o.id]}
                      loadingFirmas={loadingFirmas}
                      onFirmado={async () => { await refetch(); await refetchFirmas() }}
                    />
                  )}
                >
                  {/* Escritorio: descripción y aviso a ancho completo bajo el encabezado (en celular van en `contenido`) */}
                  <div className="hidden @min-[972px]/lista:block">
                    {o.descripcion_solicitud && (
                      <div className="mt-2">
                        <TextoColapsable texto={o.descripcion_solicitud} className="text-xs text-muted-foreground" />
                      </div>
                    )}
                    {o.equipo_produccion && !o.lavado_sanitizado && (
                      <div className="flex items-center gap-1 mt-1.5">
                        <AlertTriangle className="w-3 h-3 flex-shrink-0" style={{ color: 'var(--agro-danger-text)' }} />
                        <span className="text-xs font-semibold" style={{ color: 'var(--agro-danger-text)' }}>
                          Sin sanitizar — incidencia M13 generada
                        </span>
                      </div>
                    )}
                  </div>
                </TarjetaRegistro>
              )
            })}
          </ListaTarjetas>
        )}
      </div>

      {/* FAB */}
            <Fab onClick={abrirFormulario} aria-label="Nueva orden" />

      {/* ── Modal: nueva orden ─────────────────────────────────────────── */}
      <BottomSheet open={abierto} onClose={handleCerrarModal}>
            <div className="pt-4 px-4 pb-2 flex-shrink-0 flex items-center justify-between">
              <h2 className="text-base text-foreground" style={{ fontWeight: 700 }}>
                Nueva Orden de Mantenimiento
              </h2>
              <button aria-label="Cerrar" type="button" onClick={handleCerrarModal}><X className="w-5 h-5 text-muted-foreground" /></button>
            </div>

            {sheetPaso === 'firma_gate' && <FirmaGatePaso onFirmaGuardada={() => setSheetPaso('form')} />}
            {sheetPaso === 'firma_decision' && pendienteFirmaId && (
              <PasoFirmaRegistro
                modulo="M44"
                ids={[pendienteFirmaId]}
                descripcion={`Orden del ${form.fecha}`}
                obligatoria={obligatoria}
                onFirmadoYPDF={async () => {
                  await generarOrdenMantenimientoPDF(pendienteFirmaId, orgId, codigoClave)
                  handleCerrarModal()
                  await refetchFirmas()
                }}
                onDespues={!obligatoria ? () => handleCerrarModal() : undefined}
              />
            )}
            {sheetPaso === 'form' && <div className="flex-1 overflow-y-auto px-4 pb-6 space-y-4">

              {/* Instalación */}
              <div>
                <label className="block text-xs text-muted-foreground mb-1.5">{termino} *</label>
                <select
                  value={form.rancho_id}
                  onChange={(e) => { setF({ rancho_id: e.target.value }); setErrRancho(false) }}
                  className="w-full rounded-xl border bg-input-background px-3 py-2.5 text-sm text-foreground focus:outline-none focus:border-primary"
                  style={{ borderColor: errRancho ? 'var(--agro-red)' : 'var(--border-control)' }}
                >
                  <option value="">Seleccionar…</option>
                  {ranchoOptions.map((o) => (
                    <option key={o.value} value={o.value}>{o.label}</option>
                  ))}
                </select>
                {errRancho && (
                  <p className="text-xs mt-1" style={{ color: 'var(--agro-danger-text)' }}>
                    Selecciona una {termino.toLowerCase()}
                  </p>
                )}
              </div>

              {/* Fecha + Folio */}
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs text-muted-foreground mb-1.5">Fecha</label>
                  <input
                    type="date"
                    value={form.fecha}
                    min={puedeEditarFecha ? undefined : hoyMX()}
                    max={puedeEditarFecha ? undefined : hoyMX()}
                    onChange={(e) => { if (puedeEditarFecha) setF({ fecha: e.target.value }) }}
                    className="w-full rounded-xl border border-border-control bg-input-background px-3 py-2.5 text-sm text-foreground focus:outline-none focus:border-primary"
                  />
                </div>
                <div>
                  <label className="block text-xs text-muted-foreground mb-1.5">N° de Folio</label>
                  <input maxLength={limiteTexto('m44_ordenes', 'folio')}
                    type="text"
                    value={form.folio}
                    onChange={(e) => setF({ folio: e.target.value })}
                    placeholder="Ej. MTT-001"
                    className="w-full rounded-xl border border-border-control bg-input-background px-3 py-2.5 text-sm text-foreground placeholder:text-muted-foreground focus:outline-none focus:border-primary"
                  />
                </div>
              </div>

              {/* Descripción */}
              <div>
                <label className="block text-xs text-muted-foreground mb-1.5">Descripción de la solicitud</label>
                <TextareaContador limite={limiteTexto('m44_ordenes', 'descripcion_solicitud')}
                  value={form.descripcion_solicitud}
                  onChange={(e) => setF({ descripcion_solicitud: e.target.value })}
                  rows={3}
                  placeholder="Describe el trabajo de mantenimiento solicitado…"
                  className="w-full rounded-xl border border-border-control bg-input-background px-3 py-2 text-sm text-foreground placeholder:text-muted-foreground focus:outline-none focus:border-primary resize-none"
                />
              </div>

              {/* Prioridad */}
              <div>
                <label className="block text-xs text-muted-foreground mb-1.5">Prioridad</label>
                <select
                  value={form.prioridad}
                  onChange={(e) => setF({ prioridad: e.target.value as PrioridadM44 })}
                  className="w-full rounded-xl border border-border-control bg-input-background px-3 py-2.5 text-sm text-foreground focus:outline-none focus:border-primary"
                >
                  <option value="inmediata">Atención inmediata</option>
                  <option value="turno">Atención durante el turno</option>
                  <option value="siguientes_dias">Atención durante los siguientes días</option>
                </select>
              </div>

              {/* Solicita / Recibe en Mtto */}
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs text-muted-foreground mb-1.5">Solicita</label>
                  <input maxLength={limiteTexto('m44_ordenes', 'solicita')}
                    type="text"
                    value={form.solicita}
                    onChange={(e) => setF({ solicita: e.target.value })}
                    placeholder="Nombre"
                    className="w-full rounded-xl border border-border-control bg-input-background px-3 py-2.5 text-sm text-foreground placeholder:text-muted-foreground focus:outline-none focus:border-primary"
                  />
                </div>
                <div>
                  <label className="block text-xs text-muted-foreground mb-1.5">Recibe en Mtto</label>
                  <input maxLength={limiteTexto('m44_ordenes', 'recibe_mtto')}
                    type="text"
                    value={form.recibe_mtto}
                    onChange={(e) => setF({ recibe_mtto: e.target.value })}
                    placeholder="Nombre"
                    className="w-full rounded-xl border border-border-control bg-input-background px-3 py-2.5 text-sm text-foreground placeholder:text-muted-foreground focus:outline-none focus:border-primary"
                  />
                </div>
              </div>

              {/* Equipo de producción / Lavado */}
              <div
                className="rounded-xl border border-border p-4 space-y-1"
                style={{ backgroundColor: 'var(--card)' }}
              >
                <p className="text-xs text-muted-foreground mb-2">Condiciones de entrega</p>
                <SiNoToggle
                  value={form.equipo_produccion}
                  onChange={(v) => setF({ equipo_produccion: v })}
                  label="¿Se reparó un equipo de producción?"
                />
                <SiNoToggle
                  value={form.lavado_sanitizado}
                  onChange={(v) => setF({ lavado_sanitizado: v })}
                  label="¿El equipo fue lavado y sanitizado?"
                  danger
                />
              </div>

              {/* Aviso de incidencia */}
              {form.equipo_produccion && !form.lavado_sanitizado && (
                <div
                  className="flex items-start gap-2 rounded-xl p-3"
                  style={{ backgroundColor: 'var(--agro-danger-fill)', border: '1px solid var(--agro-red)' }}
                >
                  <AlertTriangle className="w-4 h-4 flex-shrink-0 mt-0.5" style={{ color: 'var(--agro-danger-text)' }} />
                  <p className="text-xs" style={{ color: 'var(--agro-danger-text)' }}>
                    Se generará una incidencia M13 automáticamente: equipo de producción reparado sin lavar y sanitizar.
                  </p>
                </div>
              )}

              {/* Observaciones */}
              <div>
                <label className="block text-xs text-muted-foreground mb-1.5">Observaciones (opcional)</label>
                <TextareaContador limite={limiteTexto('m44_ordenes', 'observaciones')}
                  value={form.observaciones}
                  onChange={(e) => setF({ observaciones: e.target.value })}
                  rows={2}
                  placeholder="Observaciones adicionales…"
                  className="w-full rounded-xl border border-border-control bg-input-background px-3 py-2 text-sm text-foreground placeholder:text-muted-foreground focus:outline-none focus:border-primary resize-none"
                />
              </div>

              {/* Entrega en Mtto / Recibe */}
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs text-muted-foreground mb-1.5">Entrega en Mtto</label>
                  <input maxLength={limiteTexto('m44_ordenes', 'entrega_mtto')}
                    type="text"
                    value={form.entrega_mtto}
                    onChange={(e) => setF({ entrega_mtto: e.target.value })}
                    placeholder="Nombre"
                    className="w-full rounded-xl border border-border-control bg-input-background px-3 py-2.5 text-sm text-foreground placeholder:text-muted-foreground focus:outline-none focus:border-primary"
                  />
                </div>
                <div>
                  <label className="block text-xs text-muted-foreground mb-1.5">Recibe</label>
                  <input maxLength={limiteTexto('m44_ordenes', 'recibe')}
                    type="text"
                    value={form.recibe}
                    onChange={(e) => setF({ recibe: e.target.value })}
                    placeholder="Nombre"
                    className="w-full rounded-xl border border-border-control bg-input-background px-3 py-2.5 text-sm text-foreground placeholder:text-muted-foreground focus:outline-none focus:border-primary"
                  />
                </div>
              </div>

              <Boton onClick={guardar} cargando={cargando} className="w-full">
                {cargando ? (
                  <span className="flex items-center justify-center gap-2">
                    <Loader2 className="w-4 h-4 animate-spin" />
                    Guardando…
                  </span>
                ) : online ? 'Guardar orden' : 'Guardar sin conexión'}
              </Boton>
            </div>}
      </BottomSheet>
    </div>
  )
}
