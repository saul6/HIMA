import { useState } from 'react'
import { ChevronLeft, Plus, FileDown, X, Loader2, Zap, Files } from 'lucide-react'
import { useNavigate } from 'react-router'
import { BottomSheet } from '@/app/components/BottomSheet'
import { toast } from 'sonner'
import { useAuthContext } from '@/context/AuthContext'
import { useModulosContext } from '@/context/ModulosContext'
import { useRanchos } from '@/hooks/useRanchos'
import { useM60ConsumoEnergia } from '@/hooks/useM60ConsumoEnergia'
import { useOrganizacion } from '@/hooks/useOrganizacion'
import { supabase } from '@/lib/supabase'
import { generarConsumoEnergiaPDF } from '@/lib/pdf/m60/generarConsumoEnergiaPDF'
import { generarConsumoEnergiaConsolidadoPDF } from '@/lib/pdf/m60/generarConsumoEnergiaPDF'

function mesActual(): string {
  const d = new Date()
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`
}

function formatMes(iso: string): string {
  try {
    const label = new Date(iso + 'T12:00:00').toLocaleDateString('es-MX', { month: 'long', year: 'numeric' })
    return label.charAt(0).toUpperCase() + label.slice(1)
  } catch { return iso }
}

type FormState = {
  rancho_id: string
  mes: string
  tipo_combustible: string
  cantidad_litros: string
  costo_combustible: string
  actividad: string
  luz_costo: string
  luz_kwh: string
  realizo: string
  observaciones: string
}

const FORM_VACIO: FormState = {
  rancho_id: '',
  mes: mesActual(),
  tipo_combustible: '',
  cantidad_litros: '',
  costo_combustible: '',
  actividad: '',
  luz_costo: '',
  luz_kwh: '',
  realizo: '',
  observaciones: '',
}

export function ConsumoEnergia() {
  const navigate = useNavigate()
  const { profile, user, codigoClave } = useAuthContext()
  const { terminosSitio } = useModulosContext()
  const orgId = profile?.org_id ?? null
  const { ranchos } = useRanchos(orgId)
  const { registros, loading, refetch } = useM60ConsumoEnergia(orgId)
  const orgNombre = useOrganizacion(orgId)

  const [sheetOpen, setSheetOpen] = useState(false)
  const [consolidadoOpen, setConsolidadoOpen] = useState(false)
  const [form, setForm] = useState<FormState>(FORM_VACIO)
  const [guardando, setGuardando] = useState(false)
  const [pdfLoading, setPdfLoading] = useState<string | null>(null)
  const [consolidadoForm, setConsolidadoForm] = useState({ rancho_id: '', desde: mesActual(), hasta: mesActual() })
  const [exportando, setExportando] = useState(false)

  function abrirNuevo() {
    setForm({ ...FORM_VACIO, mes: mesActual(), realizo: profile?.nombre_completo ?? '' })
    setSheetOpen(true)
  }

  async function guardar() {
    if (!orgId) return
    if (!form.rancho_id) { toast.error(`Selecciona ${terminosSitio.genero === 'f' ? 'una' : 'un'} ${terminosSitio.singular}`); return }

    setGuardando(true)
    try {
      const { data, error } = await (supabase as any)
        .from('m60_consumo_energia')
        .insert({
          org_id: orgId,
          rancho_id: form.rancho_id,
          mes: form.mes + '-01',
          tipo_combustible: form.tipo_combustible.trim() || null,
          cantidad_litros: form.cantidad_litros ? parseFloat(form.cantidad_litros) : null,
          costo_combustible: form.costo_combustible ? parseFloat(form.costo_combustible) : null,
          actividad: form.actividad.trim() || null,
          luz_costo: form.luz_costo ? parseFloat(form.luz_costo) : null,
          luz_kwh: form.luz_kwh ? parseFloat(form.luz_kwh) : null,
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
        await generarConsumoEnergiaPDF(data.id, orgId, codigoClave)
      } catch {
        toast.error('PDF no generado')
      }
    } catch (e: any) {
      toast.error(e?.message ?? 'Error al guardar')
    } finally {
      setGuardando(false)
    }
  }

  async function descargarPDF(id: string) {
    if (!orgId) return
    setPdfLoading(id)
    try {
      await generarConsumoEnergiaPDF(id, orgId, codigoClave)
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
      await generarConsumoEnergiaConsolidadoPDF(
        orgId,
        consolidadoForm.rancho_id || null,
        consolidadoForm.desde + '-01',
        consolidadoForm.hasta + '-01',
        instName,
        orgNombre,
        codigoClave,
      )
      setConsolidadoOpen(false)
    } catch (e: any) {
      toast.error(e?.message ?? 'Error al exportar')
    } finally {
      setExportando(false)
    }
  }

  return (
    <div className="flex flex-col h-full bg-background">
      <div className="flex items-center gap-3 px-4 pt-12 pb-4">
        <button onClick={() => navigate('/')} className="p-1 -ml-1">
          <ChevronLeft className="w-5 h-5" />
        </button>
        <div className="flex-1">
          <h1 className="text-lg font-semibold leading-tight">Consumo de Combustible y Energía</h1>
          <p className="text-xs text-muted-foreground">M60 · Por mes</p>
        </div>
        <Zap className="w-5 h-5 text-muted-foreground" />
      </div>

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
                <p className="text-xs text-muted-foreground">{formatMes(r.mes)}</p>
                {r.tipo_combustible && (
                  <p className="text-sm mt-1 font-medium">{r.tipo_combustible}</p>
                )}
                <div className="flex items-center gap-3 mt-1.5 flex-wrap">
                  {r.cantidad_litros != null && (
                    <span
                      className="text-xs px-2 py-0.5 rounded font-medium"
                      style={{ backgroundColor: 'var(--agro-success-fill)', color: 'var(--agro-success-text)' }}
                    >
                      {r.cantidad_litros} L
                    </span>
                  )}
                  {r.realizo && <span className="text-xs text-muted-foreground">{r.realizo}</span>}
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

      <BottomSheet open={sheetOpen} onClose={() => setSheetOpen(false)}>
        <div className="flex items-center justify-between px-4 pt-4 pb-3 border-b border-border">
          <h2 className="text-base font-semibold">Nuevo registro</h2>
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
            <label className="block text-xs font-medium mb-1">Mes</label>
            <input
              type="month"
              className="w-full h-10 rounded-[0.625rem] border border-border bg-input-background px-3 text-sm"
              value={form.mes}
              onChange={e => setForm(f => ({ ...f, mes: e.target.value }))}
            />
          </div>

          <div>
            <label className="block text-xs font-medium mb-1">
              Tipo de combustible <span className="text-muted-foreground">(opcional)</span>
            </label>
            <input
              type="text"
              className="w-full h-10 rounded-[0.625rem] border border-border bg-input-background px-3 text-sm"
              placeholder="Ej. Diesel, Gas LP..."
              value={form.tipo_combustible}
              onChange={e => setForm(f => ({ ...f, tipo_combustible: e.target.value }))}
            />
          </div>

          <div>
            <label className="block text-xs font-medium mb-1">
              Litros <span className="text-muted-foreground">(opcional)</span>
            </label>
            <input
              type="number"
              inputMode="decimal"
              step="any"
              min="0"
              className="w-full h-10 rounded-[0.625rem] border border-border bg-input-background px-3 text-sm"
              placeholder="0"
              value={form.cantidad_litros}
              onChange={e => setForm(f => ({ ...f, cantidad_litros: e.target.value }))}
            />
          </div>

          <div>
            <label className="block text-xs font-medium mb-1">
              Costo combustible <span className="text-muted-foreground">(opcional)</span>
            </label>
            <input
              type="number"
              inputMode="decimal"
              step="any"
              min="0"
              className="w-full h-10 rounded-[0.625rem] border border-border bg-input-background px-3 text-sm"
              placeholder="$0.00"
              value={form.costo_combustible}
              onChange={e => setForm(f => ({ ...f, costo_combustible: e.target.value }))}
            />
          </div>

          <div>
            <label className="block text-xs font-medium mb-1">
              Actividad <span className="text-muted-foreground">(opcional)</span>
            </label>
            <input
              type="text"
              className="w-full h-10 rounded-[0.625rem] border border-border bg-input-background px-3 text-sm"
              placeholder="Ej. Riego, Bombeo..."
              value={form.actividad}
              onChange={e => setForm(f => ({ ...f, actividad: e.target.value }))}
            />
          </div>

          <div>
            <label className="block text-xs font-medium mb-1">
              Costo luz <span className="text-muted-foreground">(opcional)</span>
            </label>
            <input
              type="number"
              inputMode="decimal"
              step="any"
              min="0"
              className="w-full h-10 rounded-[0.625rem] border border-border bg-input-background px-3 text-sm"
              placeholder="$0.00"
              value={form.luz_costo}
              onChange={e => setForm(f => ({ ...f, luz_costo: e.target.value }))}
            />
          </div>

          <div>
            <label className="block text-xs font-medium mb-1">
              kWh <span className="text-muted-foreground">(opcional)</span>
            </label>
            <input
              type="number"
              inputMode="decimal"
              step="any"
              min="0"
              className="w-full h-10 rounded-[0.625rem] border border-border bg-input-background px-3 text-sm"
              placeholder="0"
              value={form.luz_kwh}
              onChange={e => setForm(f => ({ ...f, luz_kwh: e.target.value }))}
            />
          </div>

          <div>
            <label className="block text-xs font-medium mb-1">
              Realizó <span className="text-muted-foreground">(opcional)</span>
            </label>
            <input
              type="text"
              className="w-full h-10 rounded-[0.625rem] border border-border bg-input-background px-3 text-sm"
              placeholder="Nombre completo"
              value={form.realizo}
              onChange={e => setForm(f => ({ ...f, realizo: e.target.value }))}
            />
          </div>

          <div>
            <label className="block text-xs font-medium mb-1">
              Observaciones <span className="text-muted-foreground">(opcional)</span>
            </label>
            <textarea
              rows={2}
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
            className="w-full h-11 rounded-[0.625rem] text-white font-semibold text-sm flex items-center justify-center gap-2 disabled:opacity-50"
            style={{ backgroundColor: 'var(--primary)' }}
          >
            {guardando && <Loader2 className="w-4 h-4 animate-spin" />}
            Guardar y generar PDF
          </button>
        </div>
      </BottomSheet>

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
              type="month"
              className="w-full h-10 rounded-[0.625rem] border border-border bg-input-background px-3 text-sm"
              value={consolidadoForm.desde}
              onChange={e => setConsolidadoForm(f => ({ ...f, desde: e.target.value }))}
            />
          </div>
          <div>
            <label className="block text-xs font-medium mb-1">Hasta</label>
            <input
              type="month"
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
