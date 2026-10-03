import { useState } from 'react'
import { Plus, FileDown, X, Loader2 } from 'lucide-react'
import { BottomSheet } from '@/app/components/BottomSheet'
import { BotonExportarConsolidado } from '@/app/components/BotonExportarConsolidado'
import { toast } from 'sonner'
import { useAuthContext } from '@/context/AuthContext'
import { puedeEditarFechaLibre } from '@/lib/permisos'
import { codigoFormato } from '@/lib/codigoFormato'
import { useModulosContext } from '@/context/ModulosContext'
import { ModuloHeader } from '@/app/components/ModuloHeader'
import { useRanchos } from '@/hooks/useRanchos'
import { useM36Monitoreos } from '@/hooks/useM36Monitoreos'
import { useOrganizacion } from '@/hooks/useOrganizacion'
import { supabase } from '@/lib/supabase'
import { generarMonitoreoGermicidaPDF } from '@/lib/pdf/m36/generarMonitoreoGermicidaPDF'
import { generarMonitoreoGermicidaConsolidadoPDF } from '@/lib/pdf/m36/generarMonitoreoGermicidaConsolidadoPDF'
import { Fab } from '@/app/components/Fab'
import { useContextoTarea } from '@/hooks/useContextoTarea'
import { BannerTareaOrigen } from '@/app/components/BannerTareaOrigen'
import { useFirmasRegistro } from '@/hooks/useFirmasRegistro'
import { FirmasRegistro } from '@/app/components/FirmasRegistro'
import { FirmaGatePaso } from '@/app/components/FirmaGatePaso'
import { PasoFirmaRegistro } from '@/app/components/PasoFirmaRegistro'
import { useFirmaContext } from '@/context/FirmaContext'

const hoyMX = () => new Date().toLocaleDateString('en-CA', { timeZone: 'America/Mexico_City' })

function formatFecha(iso: string): string {
  try {
    return new Date(iso + 'T12:00:00').toLocaleDateString('es-MX', { day: 'numeric', month: 'short', year: 'numeric' })
  } catch { return iso }
}

type FormState = {
  rancho_id: string
  fecha: string
  tipo_germicida: string
  uso: string
  concentracion: string
  correccion: string
  preparado_por: string
}

const FORM_VACIO: FormState = {
  rancho_id: '',
  fecha: hoyMX(),
  tipo_germicida: '',
  uso: '',
  concentracion: '',
  correccion: '',
  preparado_por: '',
}

export function MonitoreoGermicida() {
  const { profile, user, codigoClave } = useAuthContext()
  const esSuperAdmin = profile?.rol === 'super_admin'
  const puedeEditarFecha = esSuperAdmin || puedeEditarFechaLibre(user?.email)
  const { terminosSitio } = useModulosContext()
  const { obligatoria, tengoFirma } = useFirmaContext()
  const orgId = profile?.org_id ?? null
  const { ranchos } = useRanchos()
  const { ranchoInicial, tareaId } = useContextoTarea(ranchos)
  const { monitoreos, loading, refetch } = useM36Monitoreos(orgId)
  const orgNombre = useOrganizacion(orgId)

  const todosIds = monitoreos.map(m => m.id)
  const { firmas, loading: loadingFirmas, refetch: refetchFirmas } = useFirmasRegistro('M36', todosIds)

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
    setForm({ ...FORM_VACIO, rancho_id: ranchoInicial ?? '', fecha: hoyMX(), preparado_por: profile?.nombre_completo ?? '' })
    setPendienteFirmaId(null)
    setSheetPaso(obligatoria && !tengoFirma ? 'firma_gate' : 'form')
    setSheetOpen(true)
  }

  async function guardar() {
    if (!orgId) return
    if (!form.rancho_id) { toast.error(`Selecciona ${terminosSitio.genero === 'f' ? 'una' : 'un'} ${terminosSitio.singular}`); return }
    if (!form.tipo_germicida.trim()) { toast.error('Ingresa el tipo de germicida'); return }
    if (!form.uso.trim()) { toast.error('Ingresa el uso'); return }
    const conc = parseFloat(form.concentracion)
    if (!form.concentracion || isNaN(conc)) { toast.error('Ingresa una concentración válida'); return }
    if (!form.preparado_por.trim()) { toast.error('Ingresa quién preparó la solución'); return }

    setGuardando(true)
    try {
      const { data, error } = await (supabase as any)
        .from('m36_monitoreos')
        .insert({
          org_id: orgId,
          rancho_id: form.rancho_id,
          fecha: form.fecha,
          tipo_germicida: form.tipo_germicida.trim(),
          uso: form.uso.trim(),
          concentracion: conc,
          correccion: form.correccion.trim() || null,
          preparado_por: form.preparado_por.trim(),
        })
        .select('id')
        .single()
      if (error) throw error

      toast.success('Monitoreo registrado')
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
      await generarMonitoreoGermicidaPDF(id, orgId, codigoClave)
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
      await generarMonitoreoGermicidaConsolidadoPDF(
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

  function handleCerrarSheet() {
    setSheetOpen(false)
    setSheetPaso('form')
    setPendienteFirmaId(null)
  }

  return (
    <div className="flex flex-col h-full bg-background">
      {/* Header */}
      <ModuloHeader
        tituloFallback="Monitoreo de Solución Germicida"
        subtitulo={`${codigoFormato('F-FRUS-SAN-14', codigoClave)} · Por evento`}
      />

      <BannerTareaOrigen tareaId={tareaId} />

      {/* Exportar consolidado */}
      <div className="px-4 pt-3 pb-4">
        <BotonExportarConsolidado onClick={() => setConsolidadoOpen(true)} />
      </div>

      {/* Lista */}
      <div className="flex-1 px-4 pb-32 space-y-3 overflow-y-auto">
        {loading && (
          <div className="flex items-center justify-center py-12">
            <Loader2 className="w-5 h-5 animate-spin text-muted-foreground" />
          </div>
        )}
        {!loading && monitoreos.length === 0 && (
          <div className="text-center py-12 text-muted-foreground text-sm">
            Sin registros. Usa el botón + para agregar.
          </div>
        )}
        {monitoreos.map(m => (
          <div key={m.id} className="bg-card border border-border rounded-[0.625rem] p-4">
            <div className="flex items-start justify-between gap-2">
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-1 flex-wrap mb-0.5">
                  {orgNombre && (
                    <span className="text-xs text-muted-foreground font-medium">{orgNombre} ·</span>
                  )}
                  <span className="text-sm font-semibold">{m.rancho_nombre}</span>
                </div>
                <p className="text-xs text-muted-foreground">{formatFecha(m.fecha)}</p>
                <p className="text-sm mt-1 font-medium">{m.tipo_germicida}</p>
                <p className="text-xs text-muted-foreground mt-0.5">{m.uso}</p>
                <div className="flex items-center gap-3 mt-1.5 flex-wrap">
                  <span
                    className="text-xs px-2 py-0.5 rounded font-medium"
                    style={{ backgroundColor: 'var(--agro-success-fill)', color: 'var(--agro-success-text)' }}
                  >
                    {m.concentracion} ppm
                  </span>
                  <span className="text-xs text-muted-foreground">{m.preparado_por}</span>
                </div>
                {m.correccion && (
                  <p className="text-xs mt-1" style={{ color: 'var(--agro-warning-text)' }}>
                    Corrección: {m.correccion}
                  </p>
                )}
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
              modulo="M36"
              registroId={m.id}
              fechaRegistro={m.fecha}
              firma={firmas[m.id]}
              loadingFirmas={loadingFirmas}
              onFirmado={async () => { await refetch(); await refetchFirmas() }}
            />
          </div>
        ))}
      </div>

      {/* FAB */}
      <Fab onClick={abrirNuevo} aria-label="Nuevo monitoreo" />

      {/* Bottom sheet — Formulario / firma */}
      <BottomSheet open={sheetOpen} onClose={handleCerrarSheet} height="85%">
        <div className="flex justify-center pt-3 pb-1 flex-shrink-0">
          <div className="w-9 h-1 rounded-full bg-border" />
        </div>
        <div className="flex items-center justify-between px-4 pb-3 border-b border-border flex-shrink-0">
          <h2 className="text-base font-semibold">
            {sheetPaso === 'firma_gate' ? 'Registra tu firma' : sheetPaso === 'firma_decision' ? 'Firmar registro' : 'Nuevo monitoreo'}
          </h2>
          <button onClick={handleCerrarSheet}>
            <X className="w-5 h-5" />
          </button>
        </div>

        {sheetPaso === 'firma_gate' && (
          <FirmaGatePaso onFirmaGuardada={() => setSheetPaso('form')} />
        )}

        {sheetPaso === 'firma_decision' && pendienteFirmaId && (
          <PasoFirmaRegistro
            modulo="M36"
            ids={[pendienteFirmaId]}
            descripcion={`Monitoreo del ${formatFecha(form.fecha)}`}
            obligatoria={obligatoria}
            onFirmadoYPDF={async () => {
              await generarMonitoreoGermicidaPDF(pendienteFirmaId, orgId!, codigoClave)
              setSheetOpen(false)
              setSheetPaso('form')
              await refetchFirmas()
            }}
            onDespues={!obligatoria ? () => { setSheetOpen(false); setSheetPaso('form') } : undefined}
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
                <label className="block text-xs font-medium mb-1">Tipo de germicida</label>
                <input
                  type="text"
                  className="w-full h-10 rounded-[0.625rem] border border-border bg-input-background px-3 text-sm"
                  placeholder="Ej. Cloro, Amonio cuaternario..."
                  value={form.tipo_germicida}
                  onChange={e => setForm(f => ({ ...f, tipo_germicida: e.target.value }))}
                />
              </div>

              <div>
                <label className="block text-xs font-medium mb-1">Uso</label>
                <input
                  type="text"
                  className="w-full h-10 rounded-[0.625rem] border border-border bg-input-background px-3 text-sm"
                  placeholder="Para qué o dónde se usó"
                  value={form.uso}
                  onChange={e => setForm(f => ({ ...f, uso: e.target.value }))}
                />
              </div>

              <div>
                <label className="block text-xs font-medium mb-1">Concentración (ppm)</label>
                <input
                  type="number"
                  inputMode="decimal"
                  step="any"
                  min="0"
                  className="w-full h-10 rounded-[0.625rem] border border-border bg-input-background px-3 text-sm"
                  placeholder="Ej. 200"
                  value={form.concentracion}
                  onChange={e => setForm(f => ({ ...f, concentracion: e.target.value }))}
                />
              </div>

              <div>
                <label className="block text-xs font-medium mb-1">
                  Corrección <span className="text-muted-foreground">(opcional)</span>
                </label>
                <input
                  type="text"
                  className="w-full h-10 rounded-[0.625rem] border border-border bg-input-background px-3 text-sm"
                  placeholder="Ajuste realizado si estuvo fuera de rango"
                  value={form.correccion}
                  onChange={e => setForm(f => ({ ...f, correccion: e.target.value }))}
                />
              </div>

              <div>
                <label className="block text-xs font-medium mb-1">Preparado por</label>
                <input
                  type="text"
                  className="w-full h-10 rounded-[0.625rem] border border-border bg-input-background px-3 text-sm"
                  placeholder="Nombre completo"
                  value={form.preparado_por}
                  onChange={e => setForm(f => ({ ...f, preparado_por: e.target.value }))}
                />
              </div>

            </div>
            <div className="px-4 pb-6 pt-3 border-t border-border flex-shrink-0">
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
