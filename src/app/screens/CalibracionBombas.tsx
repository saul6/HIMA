import { useState } from 'react'
import { ChevronLeft, Plus, FileDown, X, Loader2, Gauge, Files } from 'lucide-react'
import { useNavigate } from 'react-router'
import { BottomSheet } from '@/app/components/BottomSheet'
import { toast } from 'sonner'
import { useAuthContext } from '@/context/AuthContext'
import { puedeEditarFechaLibre } from '@/lib/permisos'
import { codigoFormato } from '@/lib/codigoFormato'
import { hoyMX } from '@/lib/fecha'
import { useModulosContext } from '@/context/ModulosContext'
import { useRanchos } from '@/hooks/useRanchos'
import { useM49CalibracionBombas } from '@/hooks/useM49CalibracionBombas'
import { useOrganizacion } from '@/hooks/useOrganizacion'
import { supabase } from '@/lib/supabase'
import { generarCalibracionBombasPDF, generarCalibracionBombasConsolidadoPDF } from '@/lib/pdf/m49/generarCalibracionBombasPDF'

function formatFecha(iso: string): string {
  try {
    return new Date(iso + 'T12:00:00').toLocaleDateString('es-MX', { day: 'numeric', month: 'short', year: 'numeric' })
  } catch { return iso }
}

type FormState = {
  rancho_id: string
  fecha: string
  equipo: string
  num_equipo: string
  cultivo: string
  parcela: string
  distancia_m: string
  velocidad_kmh: string
  presion_bar: string
  volumen_recolectado_ml: string
  gasto_l: string
  resultado: string
  realizo: string
  observaciones: string
}

const FORM_VACIO: FormState = {
  rancho_id: '',
  fecha: hoyMX(),
  equipo: '',
  num_equipo: '',
  cultivo: '',
  parcela: '',
  distancia_m: '',
  velocidad_kmh: '',
  presion_bar: '',
  volumen_recolectado_ml: '',
  gasto_l: '',
  resultado: '',
  realizo: '',
  observaciones: '',
}

export function CalibracionBombas() {
  const navigate = useNavigate()
  const { profile, user, codigoClave } = useAuthContext()
  const esSuperAdmin = profile?.rol === 'super_admin'
  const puedeEditarFecha = esSuperAdmin || puedeEditarFechaLibre(user?.email)
  const { terminosSitio } = useModulosContext()
  const orgId = profile?.org_id ?? null
  const { ranchos } = useRanchos(orgId)
  const { registros, loading, refetch } = useM49CalibracionBombas(orgId)
  const orgNombre = useOrganizacion(orgId)

  const [sheetOpen, setSheetOpen] = useState(false)
  const [consolidadoOpen, setConsolidadoOpen] = useState(false)
  const [form, setForm] = useState<FormState>(FORM_VACIO)
  const [guardando, setGuardando] = useState(false)
  const [pdfLoading, setPdfLoading] = useState<string | null>(null)
  const [consolidadoForm, setConsolidadoForm] = useState({ rancho_id: '', desde: hoyMX(), hasta: hoyMX() })
  const [exportando, setExportando] = useState(false)

  function abrirNuevo() {
    setForm({ ...FORM_VACIO, fecha: hoyMX(), realizo: profile?.nombre_completo ?? '' })
    setSheetOpen(true)
  }

  async function guardar() {
    if (!orgId) return
    if (!form.rancho_id) { toast.error(`Selecciona ${terminosSitio.genero === 'f' ? 'una' : 'un'} ${terminosSitio.singular}`); return }
    if (!form.equipo.trim()) { toast.error('Ingresa el tipo de equipo'); return }
    if (!form.num_equipo.trim()) { toast.error('Ingresa el número de equipo'); return }
    if (!form.realizo.trim()) { toast.error('Ingresa quién realizó la calibración'); return }

    setGuardando(true)
    try {
      const { data, error } = await (supabase as any)
        .from('m49_calibracion_bombas')
        .insert({
          org_id: orgId,
          rancho_id: form.rancho_id,
          fecha: form.fecha,
          equipo: form.equipo.trim(),
          num_equipo: form.num_equipo.trim(),
          cultivo: form.cultivo.trim() || null,
          parcela: form.parcela.trim() || null,
          distancia_m: form.distancia_m ? parseFloat(form.distancia_m) : null,
          velocidad_kmh: form.velocidad_kmh ? parseFloat(form.velocidad_kmh) : null,
          presion_bar: form.presion_bar ? parseFloat(form.presion_bar) : null,
          volumen_recolectado_ml: form.volumen_recolectado_ml ? parseFloat(form.volumen_recolectado_ml) : null,
          gasto_l: form.gasto_l ? parseFloat(form.gasto_l) : null,
          resultado: form.resultado.trim() || null,
          realizo: form.realizo.trim(),
          observaciones: form.observaciones.trim() || null,
          creado_por: user?.id ?? null,
        })
        .select('id')
        .single()
      if (error) throw error

      setSheetOpen(false)
      await refetch()
      toast.success('Calibración registrada')

      try {
        await generarCalibracionBombasPDF(data.id, orgId, codigoClave)
      } catch (e) {
        toast.error('PDF no generado')
        console.error(e)
      }
    } catch (e: any) {
      const msg: string = e?.message ?? 'Error al guardar'
      if (msg.includes('FECHA_SOLO_HOY')) {
        toast.warning('Solo puedes registrar con la fecha de hoy')
      } else {
        console.error(e)
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
      await generarCalibracionBombasPDF(id, orgId, codigoClave)
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
      await generarCalibracionBombasConsolidadoPDF(
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
      <div className="flex items-center gap-3 px-4 pt-12 pb-4">
        <button onClick={() => navigate('/')} className="p-1 -ml-1">
          <ChevronLeft className="w-5 h-5" />
        </button>
        <div className="flex-1">
          <h1 className="text-lg font-semibold leading-tight">Calibración de Bombas</h1>
          <p className="text-xs text-muted-foreground">{codigoFormato('REG-07', codigoClave)} · Por evento</p>
        </div>
        <Gauge className="w-5 h-5 text-muted-foreground" />
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
        {registros.map(m => (
          <div key={m.id} className="bg-card border border-border rounded-[0.625rem] p-4">
            <div className="flex items-start justify-between gap-2">
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-1 flex-wrap mb-0.5">
                  {orgNombre && <span className="text-xs text-muted-foreground font-medium">{orgNombre} ·</span>}
                  <span className="text-sm font-semibold">{m.rancho_nombre}</span>
                </div>
                <p className="text-xs text-muted-foreground">{formatFecha(m.fecha)}</p>
                <p className="text-sm mt-1 font-medium">{m.equipo} — {m.num_equipo}</p>
                {m.resultado && (
                  <span
                    className="inline-block text-xs px-2 py-0.5 rounded font-medium mt-1"
                    style={{ backgroundColor: 'var(--agro-success-fill)', color: 'var(--agro-success-text)' }}
                  >
                    {m.resultado}
                  </span>
                )}
                <p className="text-xs text-muted-foreground mt-1">{m.realizo}</p>
              </div>
              <button
                onClick={() => descargarPDF(m.id)}
                disabled={pdfLoading === m.id}
                className="p-2 rounded-lg border border-border shrink-0"
              >
                {pdfLoading === m.id
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
          aria-label="Nueva calibración"
        >
          <Plus className="w-6 h-6" />
        </button>
      </div>

      {/* Formulario */}
      <BottomSheet open={sheetOpen} onClose={() => setSheetOpen(false)}>
        <div className="flex items-center justify-between px-4 pt-4 pb-3 border-b border-border">
          <h2 className="text-base font-semibold">Nueva calibración de bomba</h2>
          <button onClick={() => setSheetOpen(false)}><X className="w-5 h-5" /></button>
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
            <label className="block text-xs font-medium mb-1">Tipo de equipo / bomba</label>
            <input
              type="text"
              className="w-full h-10 rounded-[0.625rem] border border-border bg-input-background px-3 text-sm"
              placeholder="Ej. Aspersora de mochila"
              value={form.equipo}
              onChange={e => setForm(f => ({ ...f, equipo: e.target.value }))}
            />
          </div>
          <div>
            <label className="block text-xs font-medium mb-1">N° de equipo</label>
            <input
              type="text"
              className="w-full h-10 rounded-[0.625rem] border border-border bg-input-background px-3 text-sm"
              placeholder="Ej. 001"
              value={form.num_equipo}
              onChange={e => setForm(f => ({ ...f, num_equipo: e.target.value }))}
            />
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-xs font-medium mb-1">Cultivo <span className="text-muted-foreground">(opcional)</span></label>
              <input
                type="text"
                className="w-full h-10 rounded-[0.625rem] border border-border bg-input-background px-3 text-sm"
                placeholder="Ej. Zarzamora"
                value={form.cultivo}
                onChange={e => setForm(f => ({ ...f, cultivo: e.target.value }))}
              />
            </div>
            <div>
              <label className="block text-xs font-medium mb-1">Parcela <span className="text-muted-foreground">(opcional)</span></label>
              <input
                type="text"
                className="w-full h-10 rounded-[0.625rem] border border-border bg-input-background px-3 text-sm"
                placeholder="Ej. A-1"
                value={form.parcela}
                onChange={e => setForm(f => ({ ...f, parcela: e.target.value }))}
              />
            </div>
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-xs font-medium mb-1">Distancia (m)</label>
              <input
                type="number" inputMode="decimal" step="any" min="0"
                className="w-full h-10 rounded-[0.625rem] border border-border bg-input-background px-3 text-sm"
                placeholder="0.0"
                value={form.distancia_m}
                onChange={e => setForm(f => ({ ...f, distancia_m: e.target.value }))}
              />
            </div>
            <div>
              <label className="block text-xs font-medium mb-1">Velocidad (km/h)</label>
              <input
                type="number" inputMode="decimal" step="any" min="0"
                className="w-full h-10 rounded-[0.625rem] border border-border bg-input-background px-3 text-sm"
                placeholder="0.0"
                value={form.velocidad_kmh}
                onChange={e => setForm(f => ({ ...f, velocidad_kmh: e.target.value }))}
              />
            </div>
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-xs font-medium mb-1">Presión (bar)</label>
              <input
                type="number" inputMode="decimal" step="any" min="0"
                className="w-full h-10 rounded-[0.625rem] border border-border bg-input-background px-3 text-sm"
                placeholder="0.00"
                value={form.presion_bar}
                onChange={e => setForm(f => ({ ...f, presion_bar: e.target.value }))}
              />
            </div>
            <div>
              <label className="block text-xs font-medium mb-1">Vol. recolectado (ml)</label>
              <input
                type="number" inputMode="decimal" step="any" min="0"
                className="w-full h-10 rounded-[0.625rem] border border-border bg-input-background px-3 text-sm"
                placeholder="0.0"
                value={form.volumen_recolectado_ml}
                onChange={e => setForm(f => ({ ...f, volumen_recolectado_ml: e.target.value }))}
              />
            </div>
          </div>
          <div>
            <label className="block text-xs font-medium mb-1">Gasto (L) <span className="text-muted-foreground">(opcional)</span></label>
            <input
              type="number" inputMode="decimal" step="any" min="0"
              className="w-full h-10 rounded-[0.625rem] border border-border bg-input-background px-3 text-sm"
              placeholder="0.00"
              value={form.gasto_l}
              onChange={e => setForm(f => ({ ...f, gasto_l: e.target.value }))}
            />
          </div>
          <div>
            <label className="block text-xs font-medium mb-1">Resultado <span className="text-muted-foreground">(opcional)</span></label>
            <input
              type="text"
              className="w-full h-10 rounded-[0.625rem] border border-border bg-input-background px-3 text-sm"
              placeholder="Ej. Aprobado, Requiere ajuste..."
              value={form.resultado}
              onChange={e => setForm(f => ({ ...f, resultado: e.target.value }))}
            />
          </div>
          <div>
            <label className="block text-xs font-medium mb-1">Realizó</label>
            <input
              type="text"
              className="w-full h-10 rounded-[0.625rem] border border-border bg-input-background px-3 text-sm"
              placeholder="Nombre completo"
              value={form.realizo}
              onChange={e => setForm(f => ({ ...f, realizo: e.target.value }))}
            />
          </div>
          <div>
            <label className="block text-xs font-medium mb-1">Observaciones <span className="text-muted-foreground">(opcional)</span></label>
            <textarea
              className="w-full rounded-[0.625rem] border border-border bg-input-background px-3 py-2 text-sm resize-none"
              rows={2}
              placeholder="Notas adicionales..."
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

      {/* Consolidado */}
      <BottomSheet open={consolidadoOpen} onClose={() => setConsolidadoOpen(false)}>
        <div className="flex items-center justify-between px-4 pt-4 pb-3 border-b border-border">
          <h2 className="text-base font-semibold">Exportar consolidado</h2>
          <button onClick={() => setConsolidadoOpen(false)}><X className="w-5 h-5" /></button>
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
