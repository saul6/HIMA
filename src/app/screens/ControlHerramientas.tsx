import { useState } from 'react'
import { ChevronLeft, Wrench, Plus, FileDown, X, Loader2, Files } from 'lucide-react'
import { useNavigate } from 'react-router'
import { BottomSheet } from '@/app/components/BottomSheet'
import { toast } from 'sonner'
import { useAuthContext } from '@/context/AuthContext'
import { puedeEditarFechaLibre } from '@/lib/permisos'
import { useModulosContext } from '@/context/ModulosContext'
import { useRanchos } from '@/hooks/useRanchos'
import { useM64ControlHerramientas } from '@/hooks/useM64ControlHerramientas'
import { useOrganizacion } from '@/hooks/useOrganizacion'
import { supabase } from '@/lib/supabase'
import { generarControlHerramientasPDF, generarControlHerramientasConsolidadoPDF } from '@/lib/pdf/m64/generarControlHerramientasPDF'

const hoyMX = () => new Date().toLocaleDateString('en-CA', { timeZone: 'America/Mexico_City' })

function formatFecha(iso: string): string {
  try {
    return new Date(iso + 'T12:00:00').toLocaleDateString('es-MX', { day: 'numeric', month: 'short', year: 'numeric' })
  } catch { return iso }
}

type FormState = {
  rancho_id: string
  fecha: string
  trabajador: string
  herramienta: string
  cantidad: string
  entrega_nombre: string
  recibe_nombre: string
  devuelto: boolean
  fecha_devolucion: string
  realizo: string
  observaciones: string
}

const FORM_VACIO: FormState = {
  rancho_id: '',
  fecha: hoyMX(),
  trabajador: '',
  herramienta: '',
  cantidad: '1',
  entrega_nombre: '',
  recibe_nombre: '',
  devuelto: false,
  fecha_devolucion: '',
  realizo: '',
  observaciones: '',
}

export function ControlHerramientas() {
  const navigate = useNavigate()
  const { profile, user, codigoClave } = useAuthContext()
  const esSuperAdmin = profile?.rol === 'super_admin'
  const puedeEditarFecha = esSuperAdmin || puedeEditarFechaLibre(user?.email)
  const { terminosSitio } = useModulosContext()
  const orgId = profile?.org_id ?? null
  const { ranchos } = useRanchos(orgId)
  const { registros, loading, refetch } = useM64ControlHerramientas(orgId)
  const orgNombre = useOrganizacion(orgId)

  const [sheetOpen, setSheetOpen] = useState(false)
  const [consolidadoOpen, setConsolidadoOpen] = useState(false)
  const [form, setForm] = useState<FormState>(FORM_VACIO)
  const [guardando, setGuardando] = useState(false)
  const [pdfLoading, setPdfLoading] = useState<string | null>(null)
  const [consolidadoForm, setConsolidadoForm] = useState({ rancho_id: '', desde: hoyMX(), hasta: hoyMX() })
  const [exportando, setExportando] = useState(false)

  function abrirNuevo() {
    setForm({ ...FORM_VACIO, fecha: hoyMX() })
    setSheetOpen(true)
  }

  async function guardar() {
    if (!orgId) return
    if (!form.rancho_id) { toast.error(`Selecciona ${terminosSitio.singular}`); return }
    if (!form.trabajador.trim()) { toast.error('Ingresa el nombre del trabajador'); return }
    if (!form.herramienta.trim()) { toast.error('Ingresa la herramienta'); return }
    if (!form.entrega_nombre.trim()) { toast.error('Ingresa quien entrega'); return }
    if (!form.recibe_nombre.trim()) { toast.error('Ingresa quien recibe'); return }

    setGuardando(true)
    try {
      const { data, error } = await (supabase as any)
        .from('m64_control_herramientas')
        .insert({
          org_id: orgId,
          rancho_id: form.rancho_id,
          fecha: form.fecha,
          trabajador: form.trabajador.trim(),
          herramienta: form.herramienta.trim(),
          cantidad: parseInt(form.cantidad) || 1,
          entrega_nombre: form.entrega_nombre.trim(),
          recibe_nombre: form.recibe_nombre.trim(),
          devuelto: form.devuelto,
          fecha_devolucion: form.devuelto && form.fecha_devolucion ? form.fecha_devolucion : null,
          realizo: form.realizo.trim() || null,
          observaciones: form.observaciones.trim() || null,
          creado_por: user?.id,
        })
        .select('id')
        .single()
      if (error) throw error

      setSheetOpen(false)
      await refetch()
      toast.success('Registro guardado')

      try {
        await generarControlHerramientasPDF(data.id, orgId, codigoClave)
      } catch (e) {
        toast.error('PDF no generado')
        console.error(e)
      }
    } catch (e: any) {
      const msg: string = e?.message ?? 'Error al guardar'
      if (msg.includes('FECHA_SOLO_HOY')) {
        toast.warning('Solo puedes registrar con la fecha de hoy')
      } else {
        toast.error(msg)
      }
    } finally {
      setGuardando(false)
    }
  }

  async function descargarPDF(id: string) {
    if (!orgId) return
    setPdfLoading(id)
    try {
      await generarControlHerramientasPDF(id, orgId, codigoClave)
    } catch {
      toast.error('Error al generar PDF')
    } finally {
      setPdfLoading(null)
    }
  }

  async function exportarConsolidado() {
    if (!orgId) return
    setExportando(true)
    try {
      const rancho = ranchos.find(r => r.id === consolidadoForm.rancho_id)
      const instName = rancho?.nombre ?? terminosSitio.plural
      await generarControlHerramientasConsolidadoPDF(
        orgId,
        consolidadoForm.rancho_id || null,
        consolidadoForm.desde,
        consolidadoForm.hasta,
        instName,
        orgNombre,
        codigoClave,
      )
      setConsolidadoOpen(false)
    } catch (e: any) {
      toast.error(e.message ?? 'Error al exportar')
    } finally {
      setExportando(false)
    }
  }

  return (
    <div className="flex flex-col h-full bg-background">
      {/* Header */}
      <div className="flex items-center gap-3 px-4 pt-12 pb-4">
        <button onClick={() => navigate(-1)} className="p-1 -ml-1">
          <ChevronLeft className="w-5 h-5" />
        </button>
        <div className="flex-1">
          <h1 className="text-lg font-semibold leading-tight">Control de Herramientas</h1>
          <p className="text-xs text-muted-foreground">M64 · Por evento</p>
        </div>
        <Wrench className="w-5 h-5 text-muted-foreground" />
      </div>

      {/* Exportar consolidado */}
      <div className="px-4 mb-4">
        <button
          onClick={() => setConsolidadoOpen(true)}
          className="flex items-center gap-2 text-sm font-medium"
          style={{ color: 'var(--primary)' }}
        >
          <Files className="w-4 h-4" />
          Exportar consolidado
        </button>
      </div>

      {/* Lista */}
      <div className="flex-1 px-4 pb-32 space-y-3 overflow-y-auto">
        {loading && (
          <div className="flex items-center justify-center py-12">
            <Loader2 className="w-5 h-5 animate-spin text-muted-foreground" />
          </div>
        )}
        {!loading && registros.length === 0 && (
          <div className="text-center py-12 text-muted-foreground text-sm">
            Sin registros. Usa el botón + para agregar.
          </div>
        )}
        {registros.map(r => (
          <div key={r.id} className="bg-card border border-border rounded-[0.625rem] p-4">
            <div className="flex items-start justify-between gap-2">
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-1 flex-wrap mb-0.5">
                  {orgNombre && (
                    <span className="text-xs text-muted-foreground font-medium">{orgNombre} ·</span>
                  )}
                  <span className="text-sm font-semibold">{r.rancho_nombre}</span>
                </div>
                <p className="text-xs text-muted-foreground">{formatFecha(r.fecha)}</p>
                <p className="text-sm mt-1 font-medium">{r.herramienta} <span className="text-muted-foreground font-normal">x{r.cantidad}</span></p>
                <p className="text-xs text-muted-foreground mt-0.5">{r.trabajador}</p>
                <div className="flex items-center gap-2 mt-1.5 flex-wrap">
                  <span
                    className="text-xs px-2 py-0.5 rounded font-medium"
                    style={r.devuelto
                      ? { backgroundColor: 'var(--agro-success-fill)', color: 'var(--agro-success-text)' }
                      : { backgroundColor: 'var(--agro-warning-fill)', color: 'var(--agro-warning-text)' }
                    }
                  >
                    {r.devuelto ? 'Devuelto' : 'Pendiente'}
                  </span>
                </div>
              </div>
              <button
                onClick={() => descargarPDF(r.id)}
                disabled={pdfLoading === r.id}
                className="p-2 rounded-lg border border-border shrink-0"
              >
                {pdfLoading === r.id
                  ? <Loader2 className="w-4 h-4 animate-spin" />
                  : <FileDown className="w-4 h-4" style={{ color: 'var(--primary)' }} />
                }
              </button>
            </div>
          </div>
        ))}
      </div>

      {/* FAB */}
      <div className="fixed bottom-safe-fab left-1/2 -translate-x-1/2 w-full max-w-[390px] flex justify-end px-4 pointer-events-none z-10 md:bottom-6">
        <button
          onClick={abrirNuevo}
          className="pointer-events-auto w-14 h-14 rounded-full text-white flex items-center justify-center active:scale-95 transition-transform"
          style={{ backgroundColor: 'var(--primary)' }}
          aria-label="Nuevo registro"
        >
          <Plus className="w-6 h-6" />
        </button>
      </div>

      {/* Bottom sheet — Formulario */}
      <BottomSheet open={sheetOpen} onClose={() => setSheetOpen(false)}>
        <div className="flex items-center justify-between px-4 pt-4 pb-3 border-b border-border">
          <h2 className="text-base font-semibold">Nueva entrega de herramienta</h2>
          <button onClick={() => setSheetOpen(false)}>
            <X className="w-5 h-5" />
          </button>
        </div>
        <div className="overflow-y-auto flex-1 px-4 pt-4 pb-8 space-y-4">

          <div>
            <label className="block text-xs font-medium mb-1">{terminosSitio.singular}</label>
            <select
              className="w-full h-10 rounded-[0.625rem] border border-border bg-input-background px-3 text-sm"
              value={form.rancho_id}
              onChange={e => setForm(f => ({ ...f, rancho_id: e.target.value }))}
            >
              <option value="">Selecciona...</option>
              {ranchos.map(r => <option key={r.id} value={r.id}>{r.nombre}</option>)}
            </select>
          </div>

          <div>
            <label className="block text-xs font-medium mb-1">Fecha</label>
            <input
              type="date"
              className="w-full h-10 rounded-[0.625rem] border border-border bg-input-background px-3 text-sm"
              value={form.fecha}
              min={puedeEditarFecha ? undefined : hoyMX()}
              max={puedeEditarFecha ? undefined : hoyMX()}
              onChange={e => { if (puedeEditarFecha) setForm(f => ({ ...f, fecha: e.target.value })) }}
            />
          </div>

          <div>
            <label className="block text-xs font-medium mb-1">Trabajador</label>
            <input
              type="text"
              className="w-full h-10 rounded-[0.625rem] border border-border bg-input-background px-3 text-sm"
              placeholder="Nombre del trabajador"
              value={form.trabajador}
              onChange={e => setForm(f => ({ ...f, trabajador: e.target.value }))}
            />
          </div>

          <div>
            <label className="block text-xs font-medium mb-1">Herramienta</label>
            <input
              type="text"
              className="w-full h-10 rounded-[0.625rem] border border-border bg-input-background px-3 text-sm"
              placeholder="Ej. Tijeras de poda, cuchillo..."
              value={form.herramienta}
              onChange={e => setForm(f => ({ ...f, herramienta: e.target.value }))}
            />
          </div>

          <div>
            <label className="block text-xs font-medium mb-1">Cantidad</label>
            <input
              type="number"
              inputMode="numeric"
              min="1"
              step="1"
              className="w-full h-10 rounded-[0.625rem] border border-border bg-input-background px-3 text-sm"
              value={form.cantidad}
              onChange={e => setForm(f => ({ ...f, cantidad: e.target.value }))}
            />
          </div>

          <div>
            <label className="block text-xs font-medium mb-1">Quien entrega</label>
            <input
              type="text"
              className="w-full h-10 rounded-[0.625rem] border border-border bg-input-background px-3 text-sm"
              placeholder="Nombre de quien entrega"
              value={form.entrega_nombre}
              onChange={e => setForm(f => ({ ...f, entrega_nombre: e.target.value }))}
            />
          </div>

          <div>
            <label className="block text-xs font-medium mb-1">Quien recibe</label>
            <input
              type="text"
              className="w-full h-10 rounded-[0.625rem] border border-border bg-input-background px-3 text-sm"
              placeholder="Nombre de quien recibe"
              value={form.recibe_nombre}
              onChange={e => setForm(f => ({ ...f, recibe_nombre: e.target.value }))}
            />
          </div>

          <div className="flex items-center justify-between rounded-[0.625rem] border border-border bg-card px-4 py-3">
            <span className="text-sm font-medium">Devuelto</span>
            <button
              type="button"
              onClick={() => setForm(f => ({ ...f, devuelto: !f.devuelto }))}
              className="relative inline-flex h-6 w-11 items-center rounded-full transition-colors"
              style={{ backgroundColor: form.devuelto ? 'var(--primary)' : 'var(--switch-background)' }}
            >
              <span
                className="inline-block h-4 w-4 rounded-full bg-white transition-transform"
                style={{ transform: form.devuelto ? 'translateX(22px)' : 'translateX(4px)' }}
              />
            </button>
          </div>

          {form.devuelto && (
            <div>
              <label className="block text-xs font-medium mb-1">Fecha de devolucion</label>
              <input
                type="date"
                className="w-full h-10 rounded-[0.625rem] border border-border bg-input-background px-3 text-sm"
                value={form.fecha_devolucion}
                onChange={e => setForm(f => ({ ...f, fecha_devolucion: e.target.value }))}
              />
            </div>
          )}

          <div>
            <label className="block text-xs font-medium mb-1">
              Realizo <span className="text-muted-foreground">(opcional)</span>
            </label>
            <input
              type="text"
              className="w-full h-10 rounded-[0.625rem] border border-border bg-input-background px-3 text-sm"
              placeholder="Nombre de quien registro"
              value={form.realizo}
              onChange={e => setForm(f => ({ ...f, realizo: e.target.value }))}
            />
          </div>

          <div>
            <label className="block text-xs font-medium mb-1">
              Observaciones <span className="text-muted-foreground">(opcional)</span>
            </label>
            <textarea
              rows={3}
              className="w-full rounded-[0.625rem] border border-border bg-input-background px-3 py-2 text-sm resize-none"
              value={form.observaciones}
              onChange={e => setForm(f => ({ ...f, observaciones: e.target.value }))}
            />
          </div>

        </div>
        <div className="px-4 pb-6 pt-3 border-t border-border">
          <button
            onClick={guardar}
            disabled={guardando}
            className="w-full h-11 rounded-[0.625rem] bg-primary text-white font-semibold text-sm flex items-center justify-center gap-2 disabled:opacity-50"
          >
            {guardando && <Loader2 className="w-4 h-4 animate-spin" />}
            Guardar y generar PDF
          </button>
        </div>
      </BottomSheet>

      {/* Bottom sheet — Consolidado */}
      <BottomSheet open={consolidadoOpen} onClose={() => setConsolidadoOpen(false)}>
        <div className="flex items-center justify-between px-4 pt-4 pb-3 border-b border-border">
          <h2 className="text-base font-semibold">Exportar consolidado</h2>
          <button onClick={() => setConsolidadoOpen(false)}>
            <X className="w-5 h-5" />
          </button>
        </div>
        <div className="overflow-y-auto flex-1 px-4 pt-4 pb-8 space-y-4">
          <div>
            <label className="block text-xs font-medium mb-1">
              {terminosSitio.singular} <span className="text-muted-foreground">(opcional)</span>
            </label>
            <select
              className="w-full h-10 rounded-[0.625rem] border border-border bg-input-background px-3 text-sm"
              value={consolidadoForm.rancho_id}
              onChange={e => setConsolidadoForm(f => ({ ...f, rancho_id: e.target.value }))}
            >
              <option value="">{terminosSitio.plural}</option>
              {ranchos.map(r => <option key={r.id} value={r.id}>{r.nombre}</option>)}
            </select>
          </div>
          <div>
            <label className="block text-xs font-medium mb-1">Desde</label>
            <input
              type="date"
              className="w-full h-10 rounded-[0.625rem] border border-border bg-input-background px-3 text-sm"
              value={consolidadoForm.desde}
              onChange={e => setConsolidadoForm(f => ({ ...f, desde: e.target.value }))}
            />
          </div>
          <div>
            <label className="block text-xs font-medium mb-1">Hasta</label>
            <input
              type="date"
              className="w-full h-10 rounded-[0.625rem] border border-border bg-input-background px-3 text-sm"
              value={consolidadoForm.hasta}
              onChange={e => setConsolidadoForm(f => ({ ...f, hasta: e.target.value }))}
            />
          </div>
        </div>
        <div className="px-4 pb-6 pt-3 border-t border-border">
          <button
            onClick={exportarConsolidado}
            disabled={exportando}
            className="w-full h-11 rounded-[0.625rem] bg-primary text-white font-semibold text-sm flex items-center justify-center gap-2 disabled:opacity-50"
          >
            {exportando ? <Loader2 className="w-4 h-4 animate-spin" /> : <FileDown className="w-4 h-4" />}
            Exportar PDF
          </button>
        </div>
      </BottomSheet>
    </div>
  )
}
