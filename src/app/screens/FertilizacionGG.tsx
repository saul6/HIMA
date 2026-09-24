import { useState } from 'react'
import { ChevronLeft, Plus, FileDown, X, Loader2, Sprout, Files } from 'lucide-react'
import { useNavigate } from 'react-router'
import { BottomSheet } from '@/app/components/BottomSheet'
import { toast } from 'sonner'
import { useAuthContext } from '@/context/AuthContext'
import { puedeEditarFechaLibre } from '@/lib/permisos'
import { useModulosContext } from '@/context/ModulosContext'
import { useRanchos } from '@/hooks/useRanchos'
import { useM67FertilizacionGG } from '@/hooks/useM67FertilizacionGG'
import { useOrganizacion } from '@/hooks/useOrganizacion'
import { supabase } from '@/lib/supabase'
import {
  generarFertilizacionGGPDF,
  generarFertilizacionGGConsolidadoPDF,
} from '@/lib/pdf/m67/generarFertilizacionGGPDF'
import { Fab } from '@/app/components/Fab'

const hoyMX = () => new Date().toLocaleDateString('en-CA', { timeZone: 'America/Mexico_City' })

function formatFecha(iso: string): string {
  try {
    return new Date(iso + 'T12:00:00').toLocaleDateString('es-MX', {
      day: 'numeric', month: 'short', year: 'numeric',
    })
  } catch { return iso }
}

type FormState = {
  rancho_id: string
  fecha: string
  cultivo: string
  bloque: string
  superficie_ha: string
  producto: string
  fabricante: string
  formula: string
  cantidad_total: string
  unidad: string
  cantidad_ha: string
  maquinaria: string
  metodo_aplicacion: string
  operario: string
  observaciones: string
}

const FORM_VACIO: FormState = {
  rancho_id: '',
  fecha: hoyMX(),
  cultivo: '',
  bloque: '',
  superficie_ha: '',
  producto: '',
  fabricante: '',
  formula: '',
  cantidad_total: '',
  unidad: '',
  cantidad_ha: '',
  maquinaria: '',
  metodo_aplicacion: '',
  operario: '',
  observaciones: '',
}

export function FertilizacionGG() {
  const navigate = useNavigate()
  const { profile, user } = useAuthContext()
  const esSuperAdmin = profile?.rol === 'super_admin'
  const puedeEditarFecha = esSuperAdmin || puedeEditarFechaLibre(user?.email)
  const { terminosSitio } = useModulosContext()
  const orgId = profile?.org_id ?? null
  const { ranchos } = useRanchos(orgId)
  const { registros, loading, refetch } = useM67FertilizacionGG(orgId)
  const orgNombre = useOrganizacion(orgId)

  const [sheetOpen, setSheetOpen] = useState(false)
  const [consolidadoOpen, setConsolidadoOpen] = useState(false)
  const [form, setForm] = useState<FormState>(FORM_VACIO)
  const [guardando, setGuardando] = useState(false)
  const [pdfLoading, setPdfLoading] = useState<string | null>(null)
  const [consolidadoForm, setConsolidadoForm] = useState({ rancho_id: '', desde: hoyMX(), hasta: hoyMX() })
  const [exportando, setExportando] = useState(false)

  function set(field: keyof FormState) {
    return (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement | HTMLTextAreaElement>) =>
      setForm(f => ({ ...f, [field]: e.target.value }))
  }

  function abrirNuevo() {
    setForm({ ...FORM_VACIO, fecha: hoyMX(), operario: profile?.nombre_completo ?? '' })
    setSheetOpen(true)
  }

  async function guardar() {
    if (!orgId) return
    if (!form.rancho_id) {
      toast.error(`Selecciona ${terminosSitio.genero === 'f' ? 'una' : 'un'} ${terminosSitio.singular}`)
      return
    }
    if (!form.cultivo.trim()) { toast.error('Ingresa el cultivo'); return }
    if (!form.superficie_ha || isNaN(parseFloat(form.superficie_ha))) {
      toast.error('Ingresa la superficie en hectáreas')
      return
    }
    if (!form.producto.trim()) { toast.error('Ingresa el nombre comercial del producto'); return }
    if (!form.cantidad_total || isNaN(parseFloat(form.cantidad_total))) {
      toast.error('Ingresa la cantidad total')
      return
    }
    if (!form.unidad.trim()) { toast.error('Ingresa las unidades (L, Kg, mL)'); return }
    if (!form.operario.trim()) { toast.error('Ingresa el nombre del operario'); return }

    setGuardando(true)
    try {
      const { data, error } = await (supabase as any)
        .from('m67_fertilizacion_gg')
        .insert({
          org_id: orgId,
          rancho_id: form.rancho_id,
          creado_por: user?.id ?? null,
          fecha: form.fecha,
          cultivo: form.cultivo.trim(),
          bloque: form.bloque.trim() || null,
          superficie_ha: parseFloat(form.superficie_ha),
          producto: form.producto.trim(),
          fabricante: form.fabricante.trim() || null,
          formula: form.formula.trim() || null,
          cantidad_total: parseFloat(form.cantidad_total),
          unidad: form.unidad.trim(),
          cantidad_ha: form.cantidad_ha.trim() || null,
          maquinaria: form.maquinaria.trim() || null,
          metodo_aplicacion: form.metodo_aplicacion.trim() || null,
          operario: form.operario.trim(),
          observaciones: form.observaciones.trim() || null,
        })
        .select('id')
        .single()
      if (error) throw error

      setSheetOpen(false)
      await refetch()
      toast.success('Registro guardado')

      try {
        await generarFertilizacionGGPDF(data.id, orgId)
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
        console.error(e)
      }
    } finally {
      setGuardando(false)
    }
  }

  async function descargarPDF(id: string) {
    if (!orgId) return
    setPdfLoading(id)
    try {
      await generarFertilizacionGGPDF(id, orgId)
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
      const ranchoNombre = rancho?.nombre ?? terminosSitio.plural
      await generarFertilizacionGGConsolidadoPDF(
        orgId,
        consolidadoForm.rancho_id || null,
        consolidadoForm.desde,
        consolidadoForm.hasta,
        ranchoNombre,
        orgNombre,
      )
      setConsolidadoOpen(false)
    } catch (e: any) {
      toast.error(e.message ?? 'Error al exportar')
    } finally {
      setExportando(false)
    }
  }

  const inputCls = 'w-full h-10 rounded-[0.625rem] border border-border bg-input-background px-3 text-sm'
  const labelCls = 'block text-xs font-medium mb-1'
  const optionalSpan = <span className="text-muted-foreground font-normal">(opcional)</span>

  return (
    <div className="flex flex-col h-full bg-background">
      {/* Header */}
      <div className="flex items-center gap-3 px-4 pt-12 pb-4">
        <button onClick={() => navigate('/')} className="p-1 -ml-1">
          <ChevronLeft className="w-5 h-5" />
        </button>
        <div className="flex-1">
          <h1 className="text-lg font-semibold leading-tight">Aplicación de Fertilizantes</h1>
          <p className="text-xs text-muted-foreground">REG-18 · GlobalG.A.P. v6 · Por evento</p>
        </div>
        <Sprout className="w-5 h-5 text-muted-foreground" />
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
        {registros.map(reg => (
          <div key={reg.id} className="bg-card border border-border rounded-[0.625rem] p-4">
            <div className="flex items-start justify-between gap-2">
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-1 flex-wrap mb-0.5">
                  {orgNombre && (
                    <span className="text-xs text-muted-foreground font-medium">{orgNombre} ·</span>
                  )}
                  <span className="text-sm font-semibold">{reg.rancho_nombre}</span>
                </div>
                <p className="text-xs text-muted-foreground">{formatFecha(reg.fecha)}</p>
                <p className="text-sm font-medium mt-1">{reg.producto}</p>
                <p className="text-xs text-muted-foreground mt-0.5">
                  {reg.cultivo}{reg.bloque ? ` · ${reg.bloque}` : ''}
                </p>
                <div className="flex items-center gap-3 mt-1.5 flex-wrap">
                  {reg.cantidad_total != null && (
                    <span
                      className="text-xs px-2 py-0.5 rounded font-medium"
                      style={{ backgroundColor: 'var(--agro-success-fill)', color: 'var(--agro-success-text)' }}
                    >
                      {reg.cantidad_total} {reg.unidad ?? ''}
                    </span>
                  )}
                  {reg.superficie_ha != null && (
                    <span className="text-xs text-muted-foreground">{reg.superficie_ha} ha</span>
                  )}
                  {reg.operario && (
                    <span className="text-xs text-muted-foreground">{reg.operario}</span>
                  )}
                </div>
                {reg.metodo_aplicacion && (
                  <p className="text-xs mt-1 text-muted-foreground">{reg.metodo_aplicacion}</p>
                )}
              </div>
              <button
                onClick={() => descargarPDF(reg.id)}
                disabled={pdfLoading === reg.id}
                className="p-2 rounded-lg border border-border shrink-0"
              >
                {pdfLoading === reg.id
                  ? <Loader2 className="w-4 h-4 animate-spin" />
                  : <FileDown className="w-4 h-4" style={{ color: 'var(--primary)' }} />
                }
              </button>
            </div>
          </div>
        ))}
      </div>

      {/* FAB */}
            <Fab onClick={abrirNuevo} aria-label="Nuevo registro" />

      {/* Bottom sheet — Formulario */}
      <BottomSheet open={sheetOpen} onClose={() => setSheetOpen(false)}>
        <div className="flex items-center justify-between px-4 pt-4 pb-3 border-b border-border">
          <h2 className="text-base font-semibold">Nuevo registro</h2>
          <button onClick={() => setSheetOpen(false)}>
            <X className="w-5 h-5" />
          </button>
        </div>
        <div className="overflow-y-auto flex-1 px-4 pt-4 pb-8 space-y-4">

          {/* Sitio */}
          <div>
            <label className={labelCls}>{terminosSitio.singular}</label>
            <select className={inputCls} value={form.rancho_id} onChange={set('rancho_id')}>
              <option value="">Selecciona...</option>
              {ranchos.map(r => <option key={r.id} value={r.id}>{r.nombre}</option>)}
            </select>
          </div>

          {/* Fecha */}
          <div>
            <label className={labelCls}>Fecha</label>
            <input
              type="date"
              className={inputCls}
              value={form.fecha}
              min={puedeEditarFecha ? undefined : hoyMX()}
              max={puedeEditarFecha ? undefined : hoyMX()}
              onChange={e => { if (puedeEditarFecha) setForm(f => ({ ...f, fecha: e.target.value })) }}
            />
          </div>

          {/* Cultivo */}
          <div>
            <label className={labelCls}>Cultivo</label>
            <input
              type="text"
              className={inputCls}
              placeholder="Ej. Zarzamora, Fresa..."
              value={form.cultivo}
              onChange={set('cultivo')}
            />
          </div>

          {/* Bloque */}
          <div>
            <label className={labelCls}>Bloque / Sector {optionalSpan}</label>
            <input
              type="text"
              className={inputCls}
              placeholder="Ej. Bloque A, Sector 3..."
              value={form.bloque}
              onChange={set('bloque')}
            />
          </div>

          {/* Ha */}
          <div>
            <label className={labelCls}>Ha (superficie)</label>
            <input
              type="number"
              inputMode="decimal"
              step="any"
              min="0"
              className={inputCls}
              placeholder="Ej. 2.5"
              value={form.superficie_ha}
              onChange={set('superficie_ha')}
            />
          </div>

          {/* Producto */}
          <div>
            <label className={labelCls}>Nombre comercial</label>
            <input
              type="text"
              className={inputCls}
              placeholder="Nombre del producto"
              value={form.producto}
              onChange={set('producto')}
            />
          </div>

          {/* Fabricante */}
          <div>
            <label className={labelCls}>Fabricante {optionalSpan}</label>
            <input
              type="text"
              className={inputCls}
              placeholder="Empresa fabricante"
              value={form.fabricante}
              onChange={set('fabricante')}
            />
          </div>

          {/* Fórmula */}
          <div>
            <label className={labelCls}>Fórmula del fertilizante {optionalSpan}</label>
            <input
              type="text"
              className={inputCls}
              placeholder="Ej. 20-10-20, NPK 15-15-15..."
              value={form.formula}
              onChange={set('formula')}
            />
          </div>

          {/* Cantidad total */}
          <div>
            <label className={labelCls}>Cantidad total</label>
            <input
              type="number"
              inputMode="decimal"
              step="any"
              min="0"
              className={inputCls}
              placeholder="Ej. 50"
              value={form.cantidad_total}
              onChange={set('cantidad_total')}
            />
          </div>

          {/* Unidades */}
          <div>
            <label className={labelCls}>Unidades (L, Kg, mL)</label>
            <input
              type="text"
              className={inputCls}
              placeholder="L / Kg / mL / g..."
              value={form.unidad}
              onChange={set('unidad')}
            />
          </div>

          {/* Fertilizante cantidad/ha */}
          <div>
            <label className={labelCls}>Fertilizante cantidad/ha {optionalSpan}</label>
            <input
              type="text"
              className={inputCls}
              placeholder="Ej. 25 L/ha"
              value={form.cantidad_ha}
              onChange={set('cantidad_ha')}
            />
          </div>

          {/* Maquinaria */}
          <div>
            <label className={labelCls}>Maquinaria {optionalSpan}</label>
            <input
              type="text"
              className={inputCls}
              placeholder="Ej. Bomba de mochila, tractor..."
              value={form.maquinaria}
              onChange={set('maquinaria')}
            />
          </div>

          {/* Método de aplicación */}
          <div>
            <label className={labelCls}>Método de aplicación {optionalSpan}</label>
            <input
              type="text"
              className={inputCls}
              placeholder="Ej. Fertirriego, foliar, drench..."
              value={form.metodo_aplicacion}
              onChange={set('metodo_aplicacion')}
            />
          </div>

          {/* Operario */}
          <div>
            <label className={labelCls}>Operario</label>
            <input
              type="text"
              className={inputCls}
              placeholder="Nombre completo"
              value={form.operario}
              onChange={set('operario')}
            />
          </div>

          {/* Observaciones */}
          <div>
            <label className={labelCls}>Observaciones {optionalSpan}</label>
            <textarea
              className="w-full rounded-[0.625rem] border border-border bg-input-background px-3 py-2 text-sm resize-none"
              rows={3}
              placeholder="Notas adicionales..."
              value={form.observaciones}
              onChange={set('observaciones')}
            />
          </div>

        </div>
        <div className="px-4 pb-6 pt-3 border-t border-border">
          <button
            onClick={guardar}
            disabled={guardando}
            className="w-full h-11 rounded-[0.625rem] text-white font-semibold text-sm flex items-center justify-center gap-2 disabled:opacity-50"
            style={{ backgroundColor: 'var(--primary)' }}
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
            <label className={labelCls}>
              {terminosSitio.singular} <span className="text-muted-foreground font-normal">(opcional)</span>
            </label>
            <select
              className={inputCls}
              value={consolidadoForm.rancho_id}
              onChange={e => setConsolidadoForm(f => ({ ...f, rancho_id: e.target.value }))}
            >
              <option value="">{terminosSitio.plural}</option>
              {ranchos.map(r => <option key={r.id} value={r.id}>{r.nombre}</option>)}
            </select>
          </div>
          <div>
            <label className={labelCls}>Desde</label>
            <input
              type="date"
              className={inputCls}
              value={consolidadoForm.desde}
              onChange={e => setConsolidadoForm(f => ({ ...f, desde: e.target.value }))}
            />
          </div>
          <div>
            <label className={labelCls}>Hasta</label>
            <input
              type="date"
              className={inputCls}
              value={consolidadoForm.hasta}
              onChange={e => setConsolidadoForm(f => ({ ...f, hasta: e.target.value }))}
            />
          </div>
        </div>
        <div className="px-4 pb-6 pt-3 border-t border-border">
          <button
            onClick={exportarConsolidado}
            disabled={exportando}
            className="w-full h-11 rounded-[0.625rem] text-white font-semibold text-sm flex items-center justify-center gap-2 disabled:opacity-50"
            style={{ backgroundColor: 'var(--primary)' }}
          >
            {exportando ? <Loader2 className="w-4 h-4 animate-spin" /> : <FileDown className="w-4 h-4" />}
            Exportar PDF
          </button>
        </div>
      </BottomSheet>
    </div>
  )
}
