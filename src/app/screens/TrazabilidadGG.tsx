// ╔══════════════════════════════════════════════════════════════════════╗
// ║  M78 — Nota de Trazabilidad (salida de producto)                    ║
// ║  Bitácora plana de movimientos de salida                            ║
// ║  org_id SIEMPRE del contexto de auth, nunca del input               ║
// ╚══════════════════════════════════════════════════════════════════════╝

import { useState } from 'react'
import {
  Plus, X, Loader2, Truck, TriangleAlert, FileDown,
} from 'lucide-react'
import { BottomSheet } from '@/app/components/BottomSheet'
import { ModuloHeader } from '@/app/components/ModuloHeader'
import { BotonExportarConsolidado } from '@/app/components/BotonExportarConsolidado'
import { toast } from 'sonner'
import { useAuthContext } from '@/context/AuthContext'
import { useModulosContext } from '@/context/ModulosContext'
import { useRanchos } from '@/hooks/useRanchos'
import { useM78TrazabilidadGG } from '@/hooks/useM78TrazabilidadGG'
import { supabase } from '@/lib/supabase'
import { Fab } from '@/app/components/Fab'
import { useContextoTarea } from '@/hooks/useContextoTarea'
import { BannerTareaOrigen } from '@/app/components/BannerTareaOrigen'
import { useFirmasRegistro } from '@/hooks/useFirmasRegistro'
import { FirmasRegistro } from '@/app/components/FirmasRegistro'
import { FirmaGatePaso } from '@/app/components/FirmaGatePaso'
import { PasoFirmaRegistro } from '@/app/components/PasoFirmaRegistro'
import { ListaSkeleton } from '@/app/components/ListaSkeleton'
import { useFirmaContext } from '@/context/FirmaContext'
import {
  generarNotaTrazabilidadPDF,
  generarNotaTrazabilidadConsolidadoPDF,
} from '@/lib/pdf/m78/generarNotaTrazabilidadPDF'
import { useOrganizacion } from '@/hooks/useOrganizacion'

// eslint-disable-next-line @typescript-eslint/no-explicit-any
const tbl = (name: string) => (supabase as any).from(name)

function formatFecha(iso: string): string {
  try {
    return new Date(iso + 'T12:00:00').toLocaleDateString('es-MX', {
      day: 'numeric', month: 'short', year: 'numeric',
    })
  } catch { return iso }
}

function hoy(): string {
  return new Date().toLocaleDateString('en-CA', { timeZone: 'America/Mexico_City' })
}

type Presentacion = 'Caja' | 'Tote' | 'Granel' | 'Otro'

interface FormState {
  rancho_id: string
  folio: string
  fecha: string
  productor: string
  hora_salida: string
  num_camion: string
  zona: string
  sector: string
  cultivo: string
  presentacion: Presentacion
  otro_presentacion: string
  peso_bruto: string
  peso_neto: string
  total_producto: string
  embarco: string
  chofer: string
  recibio: string
  observaciones: string
}

function formInicial(): FormState {
  return {
    rancho_id: '',
    folio: '',
    fecha: hoy(),
    productor: '',
    hora_salida: '',
    num_camion: '',
    zona: '',
    sector: '',
    cultivo: '',
    presentacion: 'Caja',
    otro_presentacion: '',
    peso_bruto: '',
    peso_neto: '',
    total_producto: '',
    embarco: '',
    chofer: '',
    recibio: '',
    observaciones: '',
  }
}

export function TrazabilidadGG() {
  const { profile, user } = useAuthContext()
  const { terminosSitio } = useModulosContext()
  const { ranchos } = useRanchos()
  const { ranchoInicial, tareaId } = useContextoTarea(ranchos)
  const { registros, loading, error, refetch } = useM78TrazabilidadGG()
  const { obligatoria, tengoFirma } = useFirmaContext()
  const todosIds = registros.map(r => r.id)
  const { firmas, loading: loadingFirmas, refetch: refetchFirmas } = useFirmasRegistro('M78', todosIds)

  const orgId = profile?.org_id
  const orgNombre = useOrganizacion(orgId)
  const termino = terminosSitio.singular
  const [sheetNuevo, setSheetNuevo] = useState(false)
  const [sheetPaso, setSheetPaso] = useState<'firma_gate' | 'form' | 'firma_decision'>('form')
  const [pendienteFirmaId, setPendienteFirmaId] = useState<string | null>(null)
  const [form, setForm] = useState<FormState>(formInicial)
  const [errRancho, setErrRancho] = useState(false)
  const [guardando, setGuardando] = useState(false)
  const [pdfLoading, setPdfLoading] = useState<string | null>(null)
  const [consolidadoOpen, setConsolidadoOpen] = useState(false)
  const [exportando, setExportando] = useState(false)
  const hoyStr = () => new Date().toLocaleDateString('en-CA', { timeZone: 'America/Mexico_City' })
  const [consolidadoForm, setConsolidadoForm] = useState({ rancho_id: '', desde: hoyStr(), hasta: hoyStr() })

  function handleCerrarSheet() {
    setSheetNuevo(false)
    setSheetPaso('form')
    setPendienteFirmaId(null)
  }

  async function descargarPDF(id: string) {
    if (!orgId) return
    if (obligatoria && !firmas[id]?.realizo) {
      toast.info('Firma este registro antes de descargar el PDF')
      return
    }
    setPdfLoading(id)
    try {
      await generarNotaTrazabilidadPDF(id, orgId)
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
      await generarNotaTrazabilidadConsolidadoPDF(
        orgId,
        consolidadoForm.rancho_id || null,
        consolidadoForm.desde,
        consolidadoForm.hasta,
        ranchoNombre,
        orgNombre,
      )
      setConsolidadoOpen(false)
    } catch (e: unknown) {
      toast.error(e instanceof Error ? e.message : 'Error al exportar')
    } finally {
      setExportando(false)
    }
  }

  const setF = (k: keyof FormState) => (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement | HTMLSelectElement>) =>
    setForm((f) => ({ ...f, [k]: e.target.value }))

  function abrirSheet() {
    setForm({ ...formInicial(), rancho_id: ranchoInicial ?? '' })
    setErrRancho(false)
    setPendienteFirmaId(null)
    setSheetPaso(obligatoria && !tengoFirma ? 'firma_gate' : 'form')
    setSheetNuevo(true)
  }

  async function handleGuardar() {
    if (!form.rancho_id) { setErrRancho(true); return }
    if (!profile?.org_id) { toast.error('Sin organización activa'); return }
    setGuardando(true)
    try {
      const { data, error: e } = await tbl('m78_nota_trazabilidad').insert({
        org_id: profile.org_id,
        rancho_id: form.rancho_id,
        folio: form.folio.trim() || null,
        fecha: form.fecha,
        productor: form.productor.trim() || null,
        hora_salida: form.hora_salida || null,
        num_camion: form.num_camion.trim() || null,
        zona: form.zona.trim() || null,
        sector: form.sector.trim() || null,
        cultivo: form.cultivo.trim() || null,
        presentacion: form.presentacion,
        otro_presentacion: form.presentacion === 'Otro' ? (form.otro_presentacion.trim() || null) : null,
        peso_bruto: form.peso_bruto ? parseFloat(form.peso_bruto) : null,
        peso_neto: form.peso_neto ? parseFloat(form.peso_neto) : null,
        total_producto: form.total_producto.trim() || null,
        embarco: form.embarco.trim() || null,
        chofer: form.chofer.trim() || null,
        recibio: form.recibio.trim() || null,
        observaciones: form.observaciones.trim() || null,
        creado_por: user?.id ?? null,
      }).select('id').single()
      if (e) throw e
      toast.success('Nota de trazabilidad guardada')
      await refetch()
      setPendienteFirmaId(data.id as string)
      setSheetPaso('firma_decision')
    } catch (e: unknown) {
      const msg = e instanceof Error ? e.message : String(e)
      if (msg.includes('FIRMA_REQUERIDA')) {
        setSheetPaso('firma_gate')
        return
      }
      if (msg.includes('FECHA_SOLO_HOY')) {
        toast.warning('Solo puedes registrar con la fecha de hoy')
      } else {
        toast.error(msg || 'Error al guardar')
      }
    } finally {
      setGuardando(false)
    }
  }

  const ranchoOptions = ranchos.map((r) => ({ value: r.id, label: r.nombre }))

  return (
    <div className="min-h-full pb-safe-nav">

      <ModuloHeader tituloFallback="Nota de Trazabilidad" subtitulo="M78 · Salida de producto · GlobalGAP" />
      <BannerTareaOrigen tareaId={tareaId} />

      {/* Exportar consolidado */}
      <div className="px-4 pt-3 pb-4">
        <BotonExportarConsolidado onClick={() => setConsolidadoOpen(true)} />
      </div>

      {/* Lista */}
      <div className="px-4 pb-32 space-y-3">
        {error && (
          <div
            className="flex items-start gap-2 rounded-xl p-3"
            style={{ backgroundColor: 'var(--agro-danger-fill)', border: '1px solid var(--agro-red)' }}
          >
            <TriangleAlert className="w-4 h-4 flex-shrink-0 mt-0.5" style={{ color: 'var(--agro-danger-text)' }} />
            <p className="text-xs" style={{ color: 'var(--agro-danger-text)' }}>{error}</p>
          </div>
        )}

        {loading ? (
          <ListaSkeleton />
        ) : registros.length === 0 ? (
          <div
            className="border rounded-xl p-6 text-center"
            style={{ backgroundColor: 'var(--card)', borderColor: 'var(--border)' }}
          >
            <Truck className="w-8 h-8 mx-auto mb-3" style={{ color: 'var(--muted-foreground)' }} />
            <p className="text-sm text-foreground" style={{ fontWeight: 600 }}>Sin notas aún</p>
            <p className="text-xs mt-1" style={{ color: 'var(--muted-foreground)' }}>
              Registra la primera nota de trazabilidad con el botón +
            </p>
          </div>
        ) : (
          <div className="space-y-3">
            {registros.map((reg) => (
              <div
                key={reg.id}
                className="rounded-xl p-4 border"
                style={{ backgroundColor: 'var(--card)', borderColor: 'var(--border)' }}
              >
                <div className="flex items-start justify-between gap-2">
                  <div className="flex-1 min-w-0">
                    <div className="flex items-start gap-2 mb-1 flex-wrap">
                      <span
                        className="text-xs px-2 py-0.5 rounded"
                        style={{ backgroundColor: 'var(--agro-success-fill)', color: 'var(--agro-success-text)', fontWeight: 600 }}
                      >
                        {formatFecha(reg.fecha)}
                      </span>
                      {reg.folio && (
                        <span
                          className="text-xs px-2 py-0.5 rounded font-mono"
                          style={{ backgroundColor: 'var(--muted)', color: 'var(--foreground)', fontWeight: 600 }}
                        >
                          {reg.folio}
                        </span>
                      )}
                      {reg.presentacion && (
                        <span
                          className="text-xs px-2 py-0.5 rounded"
                          style={{ backgroundColor: 'var(--muted)', color: 'var(--muted-foreground)' }}
                        >
                          {reg.presentacion === 'Otro' ? reg.otro_presentacion || 'Otro' : reg.presentacion}
                        </span>
                      )}
                    </div>
                    <span className="text-sm text-foreground" style={{ fontWeight: 600 }}>{reg.rancho_nombre}</span>
                    {reg.cultivo && (
                      <div className="text-xs mt-0.5" style={{ color: 'var(--muted-foreground)' }}>
                        Cultivo: {reg.cultivo}
                      </div>
                    )}
                    {reg.peso_neto !== null && (
                      <div className="text-xs mt-0.5" style={{ color: 'var(--muted-foreground)' }}>
                        Peso neto: <span style={{ fontWeight: 600, color: 'var(--foreground)' }}>{reg.peso_neto} Ton</span>
                      </div>
                    )}
                    {reg.chofer && (
                      <div className="text-xs mt-0.5" style={{ color: 'var(--muted-foreground)' }}>
                        Chofer: {reg.chofer}
                      </div>
                    )}
                    {obligatoria && !firmas[reg.id]?.realizo && (
                      <span className="text-xs px-2 py-0.5 rounded font-medium mt-2 inline-block"
                        style={{ backgroundColor: 'var(--agro-warning-fill)', color: 'var(--agro-warning-text)' }}>
                        Pendiente de firma
                      </span>
                    )}
                  </div>
                  <button
                    onClick={() => descargarPDF(reg.id)}
                    disabled={pdfLoading === reg.id}
                    className="p-2 rounded-lg border shrink-0"
                    style={{ borderColor: 'var(--border)' }}
                  >
                    {pdfLoading === reg.id
                      ? <Loader2 className="w-4 h-4 animate-spin" />
                      : <FileDown className="w-4 h-4" style={{ color: 'var(--primary)' }} />
                    }
                  </button>
                </div>
                <FirmasRegistro
                  modulo="M78"
                  registroId={reg.id}
                  fechaRegistro={reg.fecha}
                  firma={firmas[reg.id]}
                  loadingFirmas={loadingFirmas}
                  onFirmado={refetchFirmas}
                />
              </div>
            ))}
          </div>
        )}
      </div>

      {/* FAB */}
            <Fab onClick={abrirSheet} aria-label="Nueva nota" />

      {/* Sheet */}
      <BottomSheet open={sheetNuevo} onClose={handleCerrarSheet} height="85%">
        <div className="flex items-center justify-between px-4 pt-4 pb-3 border-b" style={{ borderColor: 'var(--border)' }}>
          <h2 className="text-base text-foreground" style={{ fontWeight: 600 }}>
            {sheetPaso === 'firma_gate' ? 'Registra tu firma' : sheetPaso === 'firma_decision' ? 'Firmar registro' : 'Nueva nota de trazabilidad'}
          </h2>
          <button onClick={handleCerrarSheet}>
            <X className="w-5 h-5" style={{ color: 'var(--muted-foreground)' }} />
          </button>
        </div>

        {sheetPaso === 'firma_gate' && (
          <FirmaGatePaso onFirmaGuardada={() => setSheetPaso('form')} />
        )}

        {sheetPaso === 'firma_decision' && pendienteFirmaId && (
          <PasoFirmaRegistro
            modulo="M78"
            ids={[pendienteFirmaId]}
            descripcion={`Nota de trazabilidad · ${form.fecha}`}
            obligatoria={obligatoria}
            onFirmadoYPDF={async () => {
              if (orgId) await generarNotaTrazabilidadPDF(pendienteFirmaId!, orgId)
              handleCerrarSheet()
              await refetchFirmas()
            }}
            onDespues={!obligatoria ? () => handleCerrarSheet() : undefined}
          />
        )}

        {sheetPaso === 'form' && (<><div className="flex-1 overflow-y-auto px-4 pb-4 space-y-4 pt-4">
          {/* Rancho */}
          <div className="space-y-1">
            <label className="text-xs" style={{ color: 'var(--muted-foreground)', fontWeight: 600 }}>
              {termino.toUpperCase()} *
            </label>
            <select
              value={form.rancho_id}
              onChange={(e) => { setForm((f) => ({ ...f, rancho_id: e.target.value })); setErrRancho(false) }}
              className="w-full h-11 px-3 rounded-xl border text-sm text-foreground focus:outline-none"
              style={{ borderColor: errRancho ? 'var(--agro-red)' : 'var(--border)', backgroundColor: 'var(--input-background)' }}
            >
              <option value="">Selecciona {termino.toLowerCase()}…</option>
              {ranchoOptions.map((o) => <option key={o.value} value={o.value}>{o.label}</option>)}
            </select>
            {errRancho && <p className="text-xs" style={{ color: 'var(--agro-red)' }}>Requerido</p>}
          </div>

          {/* Folio, fecha, productor */}
          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-1">
              <label className="text-xs" style={{ color: 'var(--muted-foreground)', fontWeight: 600 }}>FOLIO</label>
              <input type="text" value={form.folio} onChange={setF('folio')} placeholder="Ej: NT-001"
                className="w-full h-11 px-3 rounded-xl border text-sm text-foreground focus:outline-none"
                style={{ borderColor: 'var(--border)', backgroundColor: 'var(--input-background)' }} />
            </div>
            <div className="space-y-1">
              <label className="text-xs" style={{ color: 'var(--muted-foreground)', fontWeight: 600 }}>FECHA</label>
              <input type="date" value={form.fecha} onChange={setF('fecha')}
                className="w-full h-11 px-3 rounded-xl border text-sm text-foreground focus:outline-none"
                style={{ borderColor: 'var(--border)', backgroundColor: 'var(--input-background)' }} />
            </div>
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-1">
              <label className="text-xs" style={{ color: 'var(--muted-foreground)', fontWeight: 600 }}>PRODUCTOR</label>
              <input type="text" value={form.productor} onChange={setF('productor')} placeholder="Nombre"
                className="w-full h-11 px-3 rounded-xl border text-sm text-foreground focus:outline-none"
                style={{ borderColor: 'var(--border)', backgroundColor: 'var(--input-background)' }} />
            </div>
            <div className="space-y-1">
              <label className="text-xs" style={{ color: 'var(--muted-foreground)', fontWeight: 600 }}>HORA SALIDA</label>
              <input type="time" value={form.hora_salida} onChange={setF('hora_salida')}
                className="w-full h-11 px-3 rounded-xl border text-sm text-foreground focus:outline-none"
                style={{ borderColor: 'var(--border)', backgroundColor: 'var(--input-background)' }} />
            </div>
          </div>

          {/* Num camion, zona, sector, cultivo */}
          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-1">
              <label className="text-xs" style={{ color: 'var(--muted-foreground)', fontWeight: 600 }}>N° CAMIÓN</label>
              <input type="text" value={form.num_camion} onChange={setF('num_camion')} placeholder="Placas o número"
                className="w-full h-11 px-3 rounded-xl border text-sm text-foreground focus:outline-none"
                style={{ borderColor: 'var(--border)', backgroundColor: 'var(--input-background)' }} />
            </div>
            <div className="space-y-1">
              <label className="text-xs" style={{ color: 'var(--muted-foreground)', fontWeight: 600 }}>ZONA</label>
              <input type="text" value={form.zona} onChange={setF('zona')} placeholder="Zona"
                className="w-full h-11 px-3 rounded-xl border text-sm text-foreground focus:outline-none"
                style={{ borderColor: 'var(--border)', backgroundColor: 'var(--input-background)' }} />
            </div>
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-1">
              <label className="text-xs" style={{ color: 'var(--muted-foreground)', fontWeight: 600 }}>SECTOR</label>
              <input type="text" value={form.sector} onChange={setF('sector')} placeholder="Sector"
                className="w-full h-11 px-3 rounded-xl border text-sm text-foreground focus:outline-none"
                style={{ borderColor: 'var(--border)', backgroundColor: 'var(--input-background)' }} />
            </div>
            <div className="space-y-1">
              <label className="text-xs" style={{ color: 'var(--muted-foreground)', fontWeight: 600 }}>CULTIVO</label>
              <input type="text" value={form.cultivo} onChange={setF('cultivo')} placeholder="Ej: Zarzamora"
                className="w-full h-11 px-3 rounded-xl border text-sm text-foreground focus:outline-none"
                style={{ borderColor: 'var(--border)', backgroundColor: 'var(--input-background)' }} />
            </div>
          </div>

          {/* Presentación */}
          <div className="space-y-2">
            <label className="text-xs" style={{ color: 'var(--muted-foreground)', fontWeight: 600 }}>PRESENTACIÓN</label>
            <div className="flex gap-2 flex-wrap">
              {(['Caja', 'Tote', 'Granel', 'Otro'] as Presentacion[]).map((p) => (
                <button
                  key={p}
                  type="button"
                  onClick={() => setForm((f) => ({ ...f, presentacion: p }))}
                  className="h-9 px-3 rounded-xl text-xs transition-colors"
                  style={{
                    fontWeight: 600,
                    backgroundColor: form.presentacion === p ? 'var(--primary)' : 'var(--muted)',
                    color: form.presentacion === p ? '#fff' : 'var(--muted-foreground)',
                  }}
                >
                  {p}
                </button>
              ))}
            </div>
            {form.presentacion === 'Otro' && (
              <input type="text" value={form.otro_presentacion} onChange={setF('otro_presentacion')} placeholder="Especifica la presentación"
                className="w-full h-11 px-3 rounded-xl border text-sm text-foreground focus:outline-none"
                style={{ borderColor: 'var(--border)', backgroundColor: 'var(--input-background)' }} />
            )}
          </div>

          {/* Pesos y total */}
          <div className="grid grid-cols-3 gap-2">
            <div className="space-y-1">
              <label className="text-xs" style={{ color: 'var(--muted-foreground)', fontWeight: 600 }}>PESO BRUTO (Ton)</label>
              <input type="number" min="0" step="0.001" value={form.peso_bruto} onChange={setF('peso_bruto')} placeholder="0.000"
                className="w-full h-11 px-2 rounded-xl border text-sm text-foreground focus:outline-none"
                style={{ borderColor: 'var(--border)', backgroundColor: 'var(--input-background)' }} />
            </div>
            <div className="space-y-1">
              <label className="text-xs" style={{ color: 'var(--muted-foreground)', fontWeight: 600 }}>PESO NETO (Ton)</label>
              <input type="number" min="0" step="0.001" value={form.peso_neto} onChange={setF('peso_neto')} placeholder="0.000"
                className="w-full h-11 px-2 rounded-xl border text-sm text-foreground focus:outline-none"
                style={{ borderColor: 'var(--border)', backgroundColor: 'var(--input-background)' }} />
            </div>
            <div className="space-y-1">
              <label className="text-xs" style={{ color: 'var(--muted-foreground)', fontWeight: 600 }}>TOTAL PRODUCTO</label>
              <input type="text" value={form.total_producto} onChange={setF('total_producto')} placeholder="Ej: 500 cajas"
                className="w-full h-11 px-2 rounded-xl border text-sm text-foreground focus:outline-none"
                style={{ borderColor: 'var(--border)', backgroundColor: 'var(--input-background)' }} />
            </div>
          </div>

          {/* Embarco, chofer, recibió */}
          <div className="grid grid-cols-3 gap-2">
            <div className="space-y-1">
              <label className="text-xs" style={{ color: 'var(--muted-foreground)', fontWeight: 600 }}>EMBARCÓ</label>
              <input type="text" value={form.embarco} onChange={setF('embarco')} placeholder="Nombre"
                className="w-full h-11 px-2 rounded-xl border text-sm text-foreground focus:outline-none"
                style={{ borderColor: 'var(--border)', backgroundColor: 'var(--input-background)' }} />
            </div>
            <div className="space-y-1">
              <label className="text-xs" style={{ color: 'var(--muted-foreground)', fontWeight: 600 }}>CHOFER</label>
              <input type="text" value={form.chofer} onChange={setF('chofer')} placeholder="Nombre"
                className="w-full h-11 px-2 rounded-xl border text-sm text-foreground focus:outline-none"
                style={{ borderColor: 'var(--border)', backgroundColor: 'var(--input-background)' }} />
            </div>
            <div className="space-y-1">
              <label className="text-xs" style={{ color: 'var(--muted-foreground)', fontWeight: 600 }}>RECIBIÓ</label>
              <input type="text" value={form.recibio} onChange={setF('recibio')} placeholder="Nombre"
                className="w-full h-11 px-2 rounded-xl border text-sm text-foreground focus:outline-none"
                style={{ borderColor: 'var(--border)', backgroundColor: 'var(--input-background)' }} />
            </div>
          </div>

          {/* Observaciones */}
          <div className="space-y-1">
            <label className="text-xs" style={{ color: 'var(--muted-foreground)', fontWeight: 600 }}>OBSERVACIONES</label>
            <textarea value={form.observaciones} onChange={setF('observaciones')} rows={2}
              placeholder="Observaciones adicionales…"
              className="w-full rounded-xl border px-3 py-2 text-sm focus:outline-none resize-none"
              style={{ borderColor: 'var(--border)', backgroundColor: 'var(--input-background)' }} />
          </div>
        </div>

        <div className="p-4 border-t" style={{ borderColor: 'var(--border)' }}>
          <button
            onClick={handleGuardar}
            disabled={guardando || !form.rancho_id}
            className="w-full h-11 rounded-xl text-sm text-white disabled:opacity-60 flex items-center justify-center gap-2"
            style={{ backgroundColor: 'var(--primary)', fontWeight: 600 }}
          >
            {guardando ? <><Loader2 className="w-4 h-4 animate-spin" /> Guardando…</> : 'Guardar nota'}
          </button>
        </div>
        </>)}
      </BottomSheet>

      {/* Sheet — Exportar consolidado */}
      <BottomSheet open={consolidadoOpen} onClose={() => setConsolidadoOpen(false)}>
        <div className="flex items-center justify-between px-4 pt-4 pb-3 border-b" style={{ borderColor: 'var(--border)' }}>
          <h2 className="text-base text-foreground" style={{ fontWeight: 600 }}>Exportar consolidado</h2>
          <button onClick={() => setConsolidadoOpen(false)}>
            <X className="w-5 h-5" style={{ color: 'var(--muted-foreground)' }} />
          </button>
        </div>
        <div className="flex-1 overflow-y-auto px-4 pt-4 pb-4 space-y-4">
          <div className="space-y-1">
            <label className="text-xs" style={{ color: 'var(--muted-foreground)', fontWeight: 600 }}>
              {termino.toUpperCase()} (opcional)
            </label>
            <select
              value={consolidadoForm.rancho_id}
              onChange={(e) => setConsolidadoForm(f => ({ ...f, rancho_id: e.target.value }))}
              className="w-full h-11 px-3 rounded-xl border text-sm text-foreground focus:outline-none"
              style={{ borderColor: 'var(--border)', backgroundColor: 'var(--input-background)' }}
            >
              <option value="">Todos los {terminosSitio.plural.toLowerCase()}</option>
              {ranchos.map(r => <option key={r.id} value={r.id}>{r.nombre}</option>)}
            </select>
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-1">
              <label className="text-xs" style={{ color: 'var(--muted-foreground)', fontWeight: 600 }}>DESDE</label>
              <input type="date" value={consolidadoForm.desde}
                onChange={(e) => setConsolidadoForm(f => ({ ...f, desde: e.target.value }))}
                className="w-full h-11 px-3 rounded-xl border text-sm text-foreground focus:outline-none"
                style={{ borderColor: 'var(--border)', backgroundColor: 'var(--input-background)' }} />
            </div>
            <div className="space-y-1">
              <label className="text-xs" style={{ color: 'var(--muted-foreground)', fontWeight: 600 }}>HASTA</label>
              <input type="date" value={consolidadoForm.hasta}
                onChange={(e) => setConsolidadoForm(f => ({ ...f, hasta: e.target.value }))}
                className="w-full h-11 px-3 rounded-xl border text-sm text-foreground focus:outline-none"
                style={{ borderColor: 'var(--border)', backgroundColor: 'var(--input-background)' }} />
            </div>
          </div>
          <button
            onClick={exportarConsolidado}
            disabled={exportando}
            className="w-full h-11 rounded-xl text-sm text-white disabled:opacity-60 flex items-center justify-center gap-2"
            style={{ backgroundColor: 'var(--primary)', fontWeight: 600 }}
          >
            {exportando ? <><Loader2 className="w-4 h-4 animate-spin" /> Exportando…</> : 'Exportar PDF'}
          </button>
        </div>
      </BottomSheet>
    </div>
  )
}
