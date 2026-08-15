import { useState, useCallback } from 'react'
import { Link } from 'react-router'
import { ChevronLeft, Wrench, Plus, FileText, Loader2, AlertTriangle, TriangleAlert } from 'lucide-react'
import { toast } from 'sonner'
import { supabase } from '@/lib/supabase'
import { useAuthContext } from '@/context/AuthContext'
import { puedeEditarFechaLibre } from '@/lib/permisos'
import { useModulosContext } from '@/context/ModulosContext'
import { useRanchos } from '@/hooks/useRanchos'
import {
  useM44OrdenesMantenimiento,
  type M44Orden,
  type PrioridadM44,
} from '@/hooks/useM44OrdenesMantenimiento'
import { generarOrdenMantenimientoPDF } from '@/lib/pdf/m44/generarOrdenMantenimientoPDF'

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
  turno:           'var(--agro-warning-text)',
  siguientes_dias: 'var(--muted-foreground)',
}

const PRIORIDAD_FONDOS: Record<PrioridadM44, string> = {
  inmediata:       'var(--agro-danger-fill)',
  turno:           'var(--agro-warning-fill)',
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
        className="px-3 py-1 rounded-full text-xs min-w-[40px]"
        style={{
          fontWeight: 600,
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
  const { ordenes, loading, error, refetch } = useM44OrdenesMantenimiento()

  const esSuperAdmin = profile?.rol === 'super_admin'
  const puedeEditarFecha = esSuperAdmin || puedeEditarFechaLibre(user?.email)
  const orgId        = profile?.org_id ?? ''
  const termino      = terminosSitio.singular

  // ── Formulario ──
  const [abierto,   setAbierto]   = useState(false)
  const [cargando,  setCargando]  = useState(false)
  const [form,      setForm]      = useState<FormState>(formInicial)
  const [errRancho, setErrRancho] = useState(false)

  const setF = (patch: Partial<FormState>) => setForm((f) => ({ ...f, ...patch }))

  const abrirFormulario = useCallback(() => {
    setForm(formInicial())
    setErrRancho(false)
    setAbierto(true)
  }, [])

  const guardar = useCallback(async () => {
    if (!orgId) return
    if (!form.rancho_id) { setErrRancho(true); return }

    setCargando(true)
    try {
      // INSERT orden sin incidencia_id aún
      const { data: ordenData, error: eOrd } = await tbl('m44_ordenes').insert({
        org_id:                orgId,
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
          const { data: rep, error: eR } = await tbl('m13_reportes').insert({
            org_id:         orgId,
            rancho_id:      form.rancho_id,
            fecha:          form.fecha,
            auditor_nombre: profile?.nombre_completo ?? null,
          }).select('id').single()
          if (eR) throw eR

          const { data: inc, error: eI } = await tbl('m13_incidencias').insert({
            reporte_id:  rep.id,
            org_id:      orgId,
            descripcion: 'Equipo de produccion reparado sin lavar y sanitizar despues del mantenimiento',
            orden:       1,
          }).select('id').single()
          if (eI) throw eI

          await tbl('m44_ordenes').update({ incidencia_id: inc.id }).eq('id', ordenId)
        } catch { /* best-effort — la orden ya fue guardada */ }
      }

      await refetch()
      setAbierto(false)
      toast.success('Orden de mantenimiento guardada')
      await generarOrdenMantenimientoPDF(ordenId, orgId, codigoClave)
    } catch (e: unknown) {
      const msg = e instanceof Error ? e.message : String(e)
      if (msg.includes('FECHA_SOLO_HOY')) {
        toast.warning('Solo puedes registrar con la fecha de hoy')
      } else {
        toast.error(msg || 'Error al guardar')
      }
    } finally {
      setCargando(false)
    }
  }, [orgId, form, profile?.nombre_completo, refetch])

  // ── PDF individual ──
  const [generandoPDF, setGenerandoPDF] = useState<string | null>(null)

  async function handlePDF(orden: M44Orden) {
    if (!orgId) return
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
      <header className="bg-card border-b border-border px-4 py-3 sticky top-0 z-30">
        <div className="flex items-center gap-3">
          <Link to="/" className="p-1 -ml-1">
            <ChevronLeft className="w-5 h-5 text-foreground" />
          </Link>
          <div className="w-8 h-8 bg-primary/10 rounded-lg flex items-center justify-center flex-shrink-0">
            <Wrench className="w-4 h-4 text-primary" />
          </div>
          <div className="flex-1 min-w-0">
            <h1 className="text-sm text-foreground truncate" style={{ fontWeight: 600 }}>
              Orden de Mantenimiento
            </h1>
            <div className="text-xs text-muted-foreground">Cuarto Frío · Por evento</div>
          </div>
        </div>
      </header>

      {/* Lista */}
      <div className="p-4 space-y-3">
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
          <div className="flex justify-center py-12">
            <Loader2 className="w-6 h-6 text-primary animate-spin" />
          </div>
        ) : ordenes.length === 0 ? (
          <div className="bg-card border border-border rounded-xl p-6 text-center">
            <Wrench className="w-8 h-8 text-muted-foreground mx-auto mb-3" />
            <p className="text-sm text-foreground" style={{ fontWeight: 600 }}>Sin órdenes aún</p>
            <p className="text-xs text-muted-foreground mt-1">Crea la primera orden con el botón +</p>
          </div>
        ) : (
          ordenes.map((o) => (
            <div
              key={o.id}
              className="bg-card rounded-xl p-4 border border-border"
            >
              <div className="flex items-start gap-2">
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2 flex-wrap mb-1">
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
                      <span className="text-xs text-muted-foreground">#{o.folio}</span>
                    )}
                  </div>
                  <p className="text-sm text-foreground truncate" style={{ fontWeight: 600 }}>
                    {o.rancho_nombre}
                  </p>
                  <p className="text-xs text-muted-foreground mt-0.5">{fmtFecha(o.fecha)}</p>
                  {o.descripcion_solicitud && (
                    <p className="text-xs text-muted-foreground mt-1 line-clamp-2">
                      {o.descripcion_solicitud}
                    </p>
                  )}
                  {o.equipo_produccion && !o.lavado_sanitizado && (
                    <div className="flex items-center gap-1 mt-1.5">
                      <AlertTriangle className="w-3 h-3 flex-shrink-0" style={{ color: 'var(--agro-danger-text)' }} />
                      <span className="text-xs" style={{ color: 'var(--agro-danger-text)', fontWeight: 600 }}>
                        Sin sanitizar — incidencia M13 generada
                      </span>
                    </div>
                  )}
                </div>
                <button
                  onClick={() => handlePDF(o)}
                  disabled={generandoPDF === o.id}
                  className="p-2 rounded-lg flex-shrink-0 disabled:opacity-50"
                  style={{ color: 'var(--primary)' }}
                  title="Descargar PDF"
                >
                  {generandoPDF === o.id ? (
                    <Loader2 className="w-5 h-5 animate-spin" />
                  ) : (
                    <FileText className="w-5 h-5" />
                  )}
                </button>
              </div>
            </div>
          ))
        )}
      </div>

      {/* FAB */}
      <button
        onClick={abrirFormulario}
        className="fixed bottom-[calc(72px+16px)] right-4 w-14 h-14 rounded-full flex items-center justify-center shadow-lg z-40"
        style={{ backgroundColor: 'var(--primary)' }}
        aria-label="Nueva orden"
      >
        <Plus className="w-6 h-6 text-white" />
      </button>

      {/* ── Sheet: nueva orden ─────────────────────────────────────────── */}
      {abierto && (
        <div
          className="fixed inset-0 z-50 flex flex-col justify-end"
          onClick={(e) => { if (e.target === e.currentTarget) setAbierto(false) }}
        >
          <div className="absolute inset-0 bg-black/40" />
          <div
            className="relative bg-card rounded-t-[10px] flex flex-col"
            style={{ maxHeight: '85dvh' }}
          >
            <div className="w-10 h-1 bg-border rounded-full mx-auto mt-3 mb-4 flex-shrink-0" />
            <div className="px-4 pb-2 flex-shrink-0">
              <h2 className="text-base text-foreground" style={{ fontWeight: 700 }}>
                Nueva Orden de Mantenimiento
              </h2>
            </div>
            <div className="flex-1 overflow-y-auto px-4 pb-6 space-y-4">

              {/* Instalación */}
              <div>
                <label className="block text-xs text-muted-foreground mb-1.5">{termino} *</label>
                <select
                  value={form.rancho_id}
                  onChange={(e) => { setF({ rancho_id: e.target.value }); setErrRancho(false) }}
                  className="w-full rounded-xl border bg-input-background px-3 py-2.5 text-sm text-foreground focus:outline-none focus:border-primary"
                  style={{ borderColor: errRancho ? 'var(--agro-red)' : 'var(--border)' }}
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
                    className="w-full rounded-xl border border-border bg-input-background px-3 py-2.5 text-sm text-foreground focus:outline-none focus:border-primary"
                  />
                </div>
                <div>
                  <label className="block text-xs text-muted-foreground mb-1.5">N° de Folio</label>
                  <input
                    type="text"
                    value={form.folio}
                    onChange={(e) => setF({ folio: e.target.value })}
                    placeholder="Ej. MTT-001"
                    className="w-full rounded-xl border border-border bg-input-background px-3 py-2.5 text-sm text-foreground placeholder:text-muted-foreground focus:outline-none focus:border-primary"
                  />
                </div>
              </div>

              {/* Descripción */}
              <div>
                <label className="block text-xs text-muted-foreground mb-1.5">Descripción de la solicitud</label>
                <textarea
                  value={form.descripcion_solicitud}
                  onChange={(e) => setF({ descripcion_solicitud: e.target.value })}
                  rows={3}
                  placeholder="Describe el trabajo de mantenimiento solicitado…"
                  className="w-full rounded-xl border border-border bg-input-background px-3 py-2 text-sm text-foreground placeholder:text-muted-foreground focus:outline-none focus:border-primary resize-none"
                />
              </div>

              {/* Prioridad */}
              <div>
                <label className="block text-xs text-muted-foreground mb-1.5">Prioridad</label>
                <select
                  value={form.prioridad}
                  onChange={(e) => setF({ prioridad: e.target.value as PrioridadM44 })}
                  className="w-full rounded-xl border border-border bg-input-background px-3 py-2.5 text-sm text-foreground focus:outline-none focus:border-primary"
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
                  <input
                    type="text"
                    value={form.solicita}
                    onChange={(e) => setF({ solicita: e.target.value })}
                    placeholder="Nombre"
                    className="w-full rounded-xl border border-border bg-input-background px-3 py-2.5 text-sm text-foreground placeholder:text-muted-foreground focus:outline-none focus:border-primary"
                  />
                </div>
                <div>
                  <label className="block text-xs text-muted-foreground mb-1.5">Recibe en Mtto</label>
                  <input
                    type="text"
                    value={form.recibe_mtto}
                    onChange={(e) => setF({ recibe_mtto: e.target.value })}
                    placeholder="Nombre"
                    className="w-full rounded-xl border border-border bg-input-background px-3 py-2.5 text-sm text-foreground placeholder:text-muted-foreground focus:outline-none focus:border-primary"
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
                <textarea
                  value={form.observaciones}
                  onChange={(e) => setF({ observaciones: e.target.value })}
                  rows={2}
                  placeholder="Observaciones adicionales…"
                  className="w-full rounded-xl border border-border bg-input-background px-3 py-2 text-sm text-foreground placeholder:text-muted-foreground focus:outline-none focus:border-primary resize-none"
                />
              </div>

              {/* Entrega en Mtto / Recibe */}
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs text-muted-foreground mb-1.5">Entrega en Mtto</label>
                  <input
                    type="text"
                    value={form.entrega_mtto}
                    onChange={(e) => setF({ entrega_mtto: e.target.value })}
                    placeholder="Nombre"
                    className="w-full rounded-xl border border-border bg-input-background px-3 py-2.5 text-sm text-foreground placeholder:text-muted-foreground focus:outline-none focus:border-primary"
                  />
                </div>
                <div>
                  <label className="block text-xs text-muted-foreground mb-1.5">Recibe</label>
                  <input
                    type="text"
                    value={form.recibe}
                    onChange={(e) => setF({ recibe: e.target.value })}
                    placeholder="Nombre"
                    className="w-full rounded-xl border border-border bg-input-background px-3 py-2.5 text-sm text-foreground placeholder:text-muted-foreground focus:outline-none focus:border-primary"
                  />
                </div>
              </div>

              <button
                onClick={guardar}
                disabled={cargando}
                className="w-full h-12 rounded-xl text-sm text-white disabled:opacity-60"
                style={{ backgroundColor: 'var(--primary)', fontWeight: 600 }}
              >
                {cargando ? (
                  <span className="flex items-center justify-center gap-2">
                    <Loader2 className="w-4 h-4 animate-spin" />
                    Guardando…
                  </span>
                ) : 'Guardar orden'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
