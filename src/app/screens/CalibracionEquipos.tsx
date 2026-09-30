import { useState } from 'react'
import { Plus, FileDown, X, Loader2, Files } from 'lucide-react'
import { useNavigate } from 'react-router'
import { BottomSheet } from '@/app/components/BottomSheet'
import { toast } from 'sonner'
import { useAuthContext } from '@/context/AuthContext'
import { puedeEditarFechaLibre } from '@/lib/permisos'
import { codigoFormato } from '@/lib/codigoFormato'
import { hoyMX } from '@/lib/fecha'
import { useModulosContext } from '@/context/ModulosContext'
import { useRanchos } from '@/hooks/useRanchos'
import { useM50CalibracionEquipos } from '@/hooks/useM50CalibracionEquipos'
import { useOrganizacion } from '@/hooks/useOrganizacion'
import { supabase } from '@/lib/supabase'
import { generarCalibracionEquiposPDF, generarCalibracionEquiposConsolidadoPDF } from '@/lib/pdf/m50/generarCalibracionEquiposPDF'
import { Fab } from '@/app/components/Fab'
import { ModuloHeader } from '@/app/components/ModuloHeader'
import { useContextoTarea } from '@/hooks/useContextoTarea'
import { BannerTareaOrigen } from '@/app/components/BannerTareaOrigen'
import { useFirmasRegistro } from '@/hooks/useFirmasRegistro'
import { FirmasRegistro } from '@/app/components/FirmasRegistro'
import { FirmaGatePaso } from '@/app/components/FirmaGatePaso'
import { PasoFirmaRegistro } from '@/app/components/PasoFirmaRegistro'
import { useFirmaContext } from '@/context/FirmaContext'

function formatFecha(iso: string): string {
  try {
    return new Date(iso + 'T12:00:00').toLocaleDateString('es-MX', { day: 'numeric', month: 'short', year: 'numeric' })
  } catch { return iso }
}

type FormState = {
  rancho_id: string
  fecha: string
  num_equipo: string
  velocidad_kmh: string
  presion_trabajo_bar: string
  boquilla: string
  gasto_boquilla_ml: string
  resultado: string
  realizo: string
  observaciones: string
}

const FORM_VACIO: FormState = {
  rancho_id: '',
  fecha: hoyMX(),
  num_equipo: '',
  velocidad_kmh: '',
  presion_trabajo_bar: '',
  boquilla: '',
  gasto_boquilla_ml: '',
  resultado: '',
  realizo: '',
  observaciones: '',
}

export function CalibracionEquipos() {
  const navigate = useNavigate()
  const { profile, user, codigoClave } = useAuthContext()
  const esSuperAdmin = profile?.rol === 'super_admin'
  const puedeEditarFecha = esSuperAdmin || puedeEditarFechaLibre(user?.email)
  const { terminosSitio } = useModulosContext()
  const orgId = profile?.org_id ?? null
  const { ranchos } = useRanchos(orgId)
  const { ranchoInicial, tareaId } = useContextoTarea(ranchos)
  const { registros, loading, refetch } = useM50CalibracionEquipos(orgId)
  const orgNombre = useOrganizacion(orgId)

  const { obligatoria, tengoFirma } = useFirmaContext()
  const todosIds = registros.map(r => r.id)
  const { firmas, loading: loadingFirmas, refetch: refetchFirmas } = useFirmasRegistro('M50', todosIds)

  const [sheetOpen, setSheetOpen] = useState(false)
  const [sheetPaso, setSheetPaso] = useState<'firma_gate' | 'form' | 'firma_decision'>('form')
  const [pendienteFirmaId, setPendienteFirmaId] = useState<string | null>(null)
  const [consolidadoOpen, setConsolidadoOpen] = useState(false)
  const [form, setForm] = useState<FormState>(FORM_VACIO)
  const [guardando, setGuardando] = useState(false)
  const [pdfLoading, setPdfLoading] = useState<string | null>(null)
  const [consolidadoForm, setConsolidadoForm] = useState({ rancho_id: '', desde: hoyMX(), hasta: hoyMX() })
  const [exportando, setExportando] = useState(false)

  function abrirNuevo() {
    setForm({ ...FORM_VACIO, rancho_id: ranchoInicial ?? '', fecha: hoyMX(), realizo: profile?.nombre_completo ?? '' })
    setPendienteFirmaId(null)
    setSheetPaso(obligatoria && !tengoFirma ? 'firma_gate' : 'form')
    setSheetOpen(true)
  }

  async function guardar() {
    if (!orgId) return
    if (!form.rancho_id) { toast.error(`Selecciona ${terminosSitio.genero === 'f' ? 'una' : 'un'} ${terminosSitio.singular}`); return }
    if (!form.num_equipo.trim()) { toast.error('Ingresa el número de equipo'); return }
    if (!form.realizo.trim()) { toast.error('Ingresa quién realizó la calibración'); return }

    setGuardando(true)
    try {
      const { data, error } = await (supabase as any)
        .from('m50_calibracion_equipos')
        .insert({
          org_id: orgId,
          rancho_id: form.rancho_id,
          fecha: form.fecha,
          num_equipo: form.num_equipo.trim(),
          velocidad_kmh: form.velocidad_kmh ? parseFloat(form.velocidad_kmh) : null,
          presion_trabajo_bar: form.presion_trabajo_bar ? parseFloat(form.presion_trabajo_bar) : null,
          boquilla: form.boquilla.trim() || null,
          gasto_boquilla_ml: form.gasto_boquilla_ml ? parseFloat(form.gasto_boquilla_ml) : null,
          resultado: form.resultado.trim() || null,
          realizo: form.realizo.trim(),
          observaciones: form.observaciones.trim() || null,
          creado_por: user?.id ?? null,
        })
        .select('id')
        .single()
      if (error) throw error

      toast.success('Calibración registrada')
      await refetch()
      setPendienteFirmaId(data.id as string)
      setSheetPaso('firma_decision')
    } catch (e: any) {
      const msg: string = e?.message ?? 'Error al guardar'
      if (msg.includes('FIRMA_REQUERIDA')) {
        setSheetPaso('firma_gate')
        return
      }
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
    if (obligatoria && !firmas[id]?.realizo) {
      toast.info('Firma este registro antes de descargar el PDF')
      return
    }
    setPdfLoading(id)
    try {
      await generarCalibracionEquiposPDF(id, orgId, codigoClave)
    } catch {
      toast.error('Error al generar PDF')
    } finally {
      setPdfLoading(null)
    }
  }

  function handleCerrarSheet() {
    setSheetOpen(false)
    setSheetPaso('form')
    setPendienteFirmaId(null)
  }

  async function exportarConsolidado() {
    if (!orgId) return
    setExportando(true)
    try {
      const rancho = ranchos.find(r => r.id === consolidadoForm.rancho_id)
      await generarCalibracionEquiposConsolidadoPDF(
        orgId,
        consolidadoForm.rancho_id || null,
        consolidadoForm.desde,
        consolidadoForm.hasta,
        rancho?.nombre ?? terminosSitio.plural,
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
      <ModuloHeader
        tituloFallback="Calibración de Equipos de Aplicación"
        subtitulo={`${codigoFormato('REG-ASIP-09', codigoClave)} · Por evento`}
      />

      <BannerTareaOrigen tareaId={tareaId} />

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
                <p className="text-sm mt-1 font-medium">Equipo {m.num_equipo}</p>
                {m.boquilla && <p className="text-xs text-muted-foreground mt-0.5">Boquilla: {m.boquilla}</p>}
                {m.resultado && (
                  <span
                    className="inline-block text-xs px-2 py-0.5 rounded font-medium mt-1"
                    style={{ backgroundColor: 'var(--agro-success-fill)', color: 'var(--agro-success-text)' }}
                  >
                    {m.resultado}
                  </span>
                )}
                <p className="text-xs text-muted-foreground mt-1">{m.realizo}</p>
                {obligatoria && !firmas[m.id]?.realizo && (
                  <span className="text-[10px] px-2 py-0.5 rounded bg-agro-danger-fill text-agro-danger-text mt-1 inline-block">
                    Pendiente de firma
                  </span>
                )}
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
            <FirmasRegistro
              modulo="M50"
              registroId={m.id}
              fechaRegistro={m.fecha}
              firma={firmas[m.id]}
              loadingFirmas={loadingFirmas}
              onFirmado={refetchFirmas}
            />
          </div>
        ))}
      </div>

            <Fab onClick={abrirNuevo} aria-label="Nueva calibración" />

      <BottomSheet open={sheetOpen} onClose={handleCerrarSheet} height="85%">
        <div className="flex justify-center pt-3 pb-1 flex-shrink-0">
          <div className="w-9 h-1 rounded-full bg-border" />
        </div>
        <div className="flex items-center justify-between px-4 pb-3 border-b border-border flex-shrink-0">
          <h2 className="text-base font-semibold">
            {sheetPaso === 'firma_gate' ? 'Registra tu firma' : sheetPaso === 'firma_decision' ? 'Firmar registro' : 'Nueva calibración de equipo'}
          </h2>
          <button onClick={handleCerrarSheet}><X className="w-5 h-5" /></button>
        </div>

        {sheetPaso === 'firma_gate' && (
          <FirmaGatePaso onFirmaGuardada={() => setSheetPaso('form')} />
        )}

        {sheetPaso === 'firma_decision' && pendienteFirmaId && (
          <PasoFirmaRegistro
            modulo="M50"
            ids={[pendienteFirmaId]}
            descripcion={`Calibración del ${formatFecha(form.fecha)}`}
            obligatoria={obligatoria}
            onFirmadoYPDF={async () => {
              await generarCalibracionEquiposPDF(pendienteFirmaId, orgId!, codigoClave)
              handleCerrarSheet()
              await refetchFirmas()
            }}
            onDespues={!obligatoria ? () => handleCerrarSheet() : undefined}
          />
        )}

        {sheetPaso === 'form' && (
          <>
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
              <label className="block text-xs font-medium mb-1">Velocidad (km/h)</label>
              <input
                type="number" inputMode="decimal" step="any" min="0"
                className="w-full h-10 rounded-[0.625rem] border border-border bg-input-background px-3 text-sm"
                placeholder="0.0"
                value={form.velocidad_kmh}
                onChange={e => setForm(f => ({ ...f, velocidad_kmh: e.target.value }))}
              />
            </div>
            <div>
              <label className="block text-xs font-medium mb-1">Presión trabajo (bar)</label>
              <input
                type="number" inputMode="decimal" step="any" min="0"
                className="w-full h-10 rounded-[0.625rem] border border-border bg-input-background px-3 text-sm"
                placeholder="0.00"
                value={form.presion_trabajo_bar}
                onChange={e => setForm(f => ({ ...f, presion_trabajo_bar: e.target.value }))}
              />
            </div>
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-xs font-medium mb-1">Boquilla <span className="text-muted-foreground">(opcional)</span></label>
              <input
                type="text"
                className="w-full h-10 rounded-[0.625rem] border border-border bg-input-background px-3 text-sm"
                placeholder="Tipo de boquilla"
                value={form.boquilla}
                onChange={e => setForm(f => ({ ...f, boquilla: e.target.value }))}
              />
            </div>
            <div>
              <label className="block text-xs font-medium mb-1">Gasto boquilla (ml)</label>
              <input
                type="number" inputMode="decimal" step="any" min="0"
                className="w-full h-10 rounded-[0.625rem] border border-border bg-input-background px-3 text-sm"
                placeholder="0.0"
                value={form.gasto_boquilla_ml}
                onChange={e => setForm(f => ({ ...f, gasto_boquilla_ml: e.target.value }))}
              />
            </div>
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
              readOnly
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
          </>
        )}
      </BottomSheet>

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
            <input type="date" className="w-full h-10 rounded-[0.625rem] border border-border bg-input-background px-3 text-sm"
              value={consolidadoForm.desde} onChange={e => setConsolidadoForm(f => ({ ...f, desde: e.target.value }))} />
          </div>
          <div>
            <label className="block text-xs font-medium mb-1">Hasta</label>
            <input type="date" className="w-full h-10 rounded-[0.625rem] border border-border bg-input-background px-3 text-sm"
              value={consolidadoForm.hasta} onChange={e => setConsolidadoForm(f => ({ ...f, hasta: e.target.value }))} />
          </div>
        </div>
        <div className="px-4 pb-6 pt-3 border-t border-border">
          <button onClick={exportarConsolidado} disabled={exportando}
            className="w-full h-11 rounded-[0.625rem] bg-primary text-white font-semibold text-sm flex items-center justify-center gap-2 disabled:opacity-50">
            {exportando ? <Loader2 className="w-4 h-4 animate-spin" /> : <FileDown className="w-4 h-4" />}
            Exportar PDF
          </button>
        </div>
      </BottomSheet>
    </div>
  )
}
