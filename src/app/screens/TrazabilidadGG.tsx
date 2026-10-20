// ╔══════════════════════════════════════════════════════════════════════╗
// ║  M78 — Nota de Trazabilidad (salida de producto)                    ║
// ║  Bitácora plana de movimientos de salida                            ║
// ║  org_id SIEMPRE del contexto de auth, nunca del input               ║
// ╚══════════════════════════════════════════════════════════════════════╝

import { useState } from 'react'
import {
  Plus, X, Loader2, Truck, TriangleAlert, FileDown, WifiOff,
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
import { useConexion } from '@/hooks/useConexion'
import { useGuardarOffline } from '@/hooks/useGuardarOffline'
import { opInsert } from '@/lib/offline/construirOperaciones'
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
import { TextareaContador } from '@/app/components/TextareaContador'
import { limiteTexto } from '@/lib/limitesTexto'
import { InputContador } from '@/app/components/InputContador'
import { PendientesOffline } from '@/app/components/PendientesOffline'
import { EstadoVacio } from '@/app/components/ui-mady/EstadoVacio'
import { Boton } from '@/app/components/ui-mady/Boton'
import { fechaCorta } from '@/lib/formato'

// eslint-disable-next-line @typescript-eslint/no-explicit-any
const tbl = (name: string) => (supabase as any).from(name)

function formatFecha(iso: string): string {
  try {
    return fechaCorta(iso)
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
  const { online } = useConexion()
  const { guardar: guardarOffline } = useGuardarOffline('M78')
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
    if (!online) { toast.warning('Necesitas conexión para generar el PDF'); return }
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
    if (!online) { toast.warning('Necesitas conexión para generar el PDF'); return }
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
      if (!online) {
        const rancho = ranchos.find((r) => r.id === form.rancho_id)
        const ok = await guardarOffline({
          descripcion: `Nota de trazabilidad · ${rancho?.nombre ?? ''} · ${form.fecha}`,
          metadatos: { rancho_id: form.rancho_id, rancho_nombre: rancho?.nombre, fecha: form.fecha },
          operaciones: [
            opInsert('m78_nota_trazabilidad', {
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
            }),
          ],
        })
        if (ok) handleCerrarSheet()
        return
      }

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
        <PendientesOffline modulo="M78" />
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
          <EstadoVacio icono={Truck} titulo="Sin notas aún" ayuda="Registra la primera nota de trazabilidad con el botón +" />
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
                        className="text-xs px-2 py-0.5 rounded font-semibold"
                        style={{ backgroundColor: 'var(--agro-success-fill)', color: 'var(--agro-success-text)' }}
                      >
                        {formatFecha(reg.fecha)}
                      </span>
                      {reg.folio && (
                        <span
                          className="text-xs px-2 py-0.5 rounded font-mono font-semibold"
                          style={{ backgroundColor: 'var(--muted)', color: 'var(--foreground)' }}
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
                    <span className="text-sm text-foreground font-semibold">{reg.rancho_nombre}</span>
                    {reg.cultivo && (
                      <div className="text-xs mt-0.5" style={{ color: 'var(--muted-foreground)' }}>
                        Cultivo: {reg.cultivo}
                      </div>
                    )}
                    {reg.peso_neto !== null && (
                      <div className="text-xs mt-0.5" style={{ color: 'var(--muted-foreground)' }}>
                        Peso neto: <span style={{ color: 'var(--foreground)' }} className="font-semibold">{reg.peso_neto} Ton</span>
                      </div>
                    )}
                    {reg.chofer && (
                      <div className="text-xs mt-0.5" style={{ color: 'var(--muted-foreground)' }}>
                        Chofer: {reg.chofer}
                      </div>
                    )}
                    {obligatoria && !firmas[reg.id]?.realizo && (
                      <span className="text-xs px-2 py-0.5 rounded font-medium mt-2 inline-block"
                        style={{ backgroundColor: 'var(--agro-info-fill)', color: 'var(--agro-info-text)' }}>
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
          <h2 className="text-base text-foreground font-semibold">
            {sheetPaso === 'firma_gate' ? 'Registra tu firma' : sheetPaso === 'firma_decision' ? 'Firmar registro' : 'Nueva nota de trazabilidad'}
          </h2>
          <button aria-label="Cerrar" onClick={handleCerrarSheet}>
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
            <label className="text-xs font-semibold" style={{ color: 'var(--muted-foreground)' }}>
              {termino.toUpperCase()} *
            </label>
            <select
              value={form.rancho_id}
              onChange={(e) => { setForm((f) => ({ ...f, rancho_id: e.target.value })); setErrRancho(false) }}
              className="w-full h-11 px-3 rounded-xl border text-sm text-foreground"
              style={{ borderColor: errRancho ? 'var(--agro-red)' : 'var(--border-control)', backgroundColor: 'var(--input-background)' }}
            >
              <option value="">Selecciona {termino.toLowerCase()}…</option>
              {ranchoOptions.map((o) => <option key={o.value} value={o.value}>{o.label}</option>)}
            </select>
            {errRancho && <p className="text-xs" style={{ color: 'var(--agro-red)' }}>Requerido</p>}
          </div>

          {/* Folio, fecha, productor */}
          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-1">
              <label className="text-xs font-semibold" style={{ color: 'var(--muted-foreground)' }}>FOLIO</label>
              <input maxLength={limiteTexto('m78_nota_trazabilidad', 'folio')} type="text" value={form.folio} onChange={setF('folio')} placeholder="Ej: NT-001"
                className="w-full h-11 px-3 rounded-xl border text-sm text-foreground"
                style={{ borderColor: 'var(--border-control)', backgroundColor: 'var(--input-background)' }} />
            </div>
            <div className="space-y-1">
              <label className="text-xs font-semibold" style={{ color: 'var(--muted-foreground)' }}>FECHA</label>
              <input type="date" value={form.fecha} onChange={setF('fecha')}
                className="w-full h-11 px-3 rounded-xl border text-sm text-foreground"
                style={{ borderColor: 'var(--border-control)', backgroundColor: 'var(--input-background)' }} />
            </div>
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-1">
              <label className="text-xs font-semibold" style={{ color: 'var(--muted-foreground)' }}>PRODUCTOR</label>
              <input maxLength={limiteTexto('m78_nota_trazabilidad', 'productor')} type="text" value={form.productor} onChange={setF('productor')} placeholder="Nombre"
                className="w-full h-11 px-3 rounded-xl border text-sm text-foreground"
                style={{ borderColor: 'var(--border-control)', backgroundColor: 'var(--input-background)' }} />
            </div>
            <div className="space-y-1">
              <label className="text-xs font-semibold" style={{ color: 'var(--muted-foreground)' }}>HORA SALIDA</label>
              <input type="time" value={form.hora_salida} onChange={setF('hora_salida')}
                className="w-full h-11 px-3 rounded-xl border text-sm text-foreground"
                style={{ borderColor: 'var(--border-control)', backgroundColor: 'var(--input-background)' }} />
            </div>
          </div>

          {/* Num camion, zona, sector, cultivo */}
          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-1">
              <label className="text-xs font-semibold" style={{ color: 'var(--muted-foreground)' }}>N° CAMIÓN</label>
              <input maxLength={limiteTexto('m78_nota_trazabilidad', 'num_camion')} type="text" value={form.num_camion} onChange={setF('num_camion')} placeholder="Placas o número"
                className="w-full h-11 px-3 rounded-xl border text-sm text-foreground"
                style={{ borderColor: 'var(--border-control)', backgroundColor: 'var(--input-background)' }} />
            </div>
            <div className="space-y-1">
              <label className="text-xs font-semibold" style={{ color: 'var(--muted-foreground)' }}>ZONA</label>
              <input maxLength={limiteTexto('m78_nota_trazabilidad', 'zona')} type="text" value={form.zona} onChange={setF('zona')} placeholder="Zona"
                className="w-full h-11 px-3 rounded-xl border text-sm text-foreground"
                style={{ borderColor: 'var(--border-control)', backgroundColor: 'var(--input-background)' }} />
            </div>
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-1">
              <label className="text-xs font-semibold" style={{ color: 'var(--muted-foreground)' }}>SECTOR</label>
              <input maxLength={limiteTexto('m78_nota_trazabilidad', 'sector')} type="text" value={form.sector} onChange={setF('sector')} placeholder="Sector"
                className="w-full h-11 px-3 rounded-xl border text-sm text-foreground"
                style={{ borderColor: 'var(--border-control)', backgroundColor: 'var(--input-background)' }} />
            </div>
            <div className="space-y-1">
              <label className="text-xs font-semibold" style={{ color: 'var(--muted-foreground)' }}>CULTIVO</label>
              <input maxLength={limiteTexto('m78_nota_trazabilidad', 'cultivo')} type="text" value={form.cultivo} onChange={setF('cultivo')} placeholder="Ej: Zarzamora"
                className="w-full h-11 px-3 rounded-xl border text-sm text-foreground"
                style={{ borderColor: 'var(--border-control)', backgroundColor: 'var(--input-background)' }} />
            </div>
          </div>

          {/* Presentación */}
          <div className="space-y-2">
            <label className="text-xs font-semibold" style={{ color: 'var(--muted-foreground)' }}>PRESENTACIÓN</label>
            <div className="flex gap-2 flex-wrap">
              {(['Caja', 'Tote', 'Granel', 'Otro'] as Presentacion[]).map((p) => (
                <button
                  key={p}
                  type="button"
                  onClick={() => setForm((f) => ({ ...f, presentacion: p }))}
                  className="h-9 px-3 rounded-xl text-xs transition-colors font-semibold"
                  style={{
                    backgroundColor: form.presentacion === p ? 'var(--primary)' : 'var(--muted)',
                    color: form.presentacion === p ? '#fff' : 'var(--muted-foreground)',
                  }}
                >
                  {p}
                </button>
              ))}
            </div>
            {form.presentacion === 'Otro' && (
              <InputContador limite={limiteTexto('m78_nota_trazabilidad', 'otro_presentacion')} type="text" value={form.otro_presentacion} onChange={setF('otro_presentacion')} placeholder="Especifica la presentación"
                className="w-full h-11 px-3 rounded-xl border text-sm text-foreground"
                style={{ borderColor: 'var(--border)', backgroundColor: 'var(--input-background)' }} />
            )}
          </div>

          {/* Pesos y total */}
          <div className="grid grid-cols-3 gap-2">
            <div className="space-y-1">
              <label className="text-xs font-semibold" style={{ color: 'var(--muted-foreground)' }}>PESO BRUTO (Ton)</label>
              <input type="number" min="0" step="0.001" value={form.peso_bruto} onChange={setF('peso_bruto')} placeholder="0.000"
                className="w-full h-11 px-2 rounded-xl border text-sm text-foreground"
                style={{ borderColor: 'var(--border-control)', backgroundColor: 'var(--input-background)' }} />
            </div>
            <div className="space-y-1">
              <label className="text-xs font-semibold" style={{ color: 'var(--muted-foreground)' }}>PESO NETO (Ton)</label>
              <input type="number" min="0" step="0.001" value={form.peso_neto} onChange={setF('peso_neto')} placeholder="0.000"
                className="w-full h-11 px-2 rounded-xl border text-sm text-foreground"
                style={{ borderColor: 'var(--border-control)', backgroundColor: 'var(--input-background)' }} />
            </div>
            <div className="space-y-1">
              <label className="text-xs font-semibold" style={{ color: 'var(--muted-foreground)' }}>TOTAL PRODUCTO</label>
              <input maxLength={limiteTexto('m78_nota_trazabilidad', 'total_producto')} type="text" value={form.total_producto} onChange={setF('total_producto')} placeholder="Ej: 500 cajas"
                className="w-full h-11 px-2 rounded-xl border text-sm text-foreground"
                style={{ borderColor: 'var(--border-control)', backgroundColor: 'var(--input-background)' }} />
            </div>
          </div>

          {/* Embarco, chofer, recibió */}
          <div className="grid grid-cols-3 gap-2">
            <div className="space-y-1">
              <label className="text-xs font-semibold" style={{ color: 'var(--muted-foreground)' }}>EMBARCÓ</label>
              <input maxLength={limiteTexto('m78_nota_trazabilidad', 'embarco')} type="text" value={form.embarco} onChange={setF('embarco')} placeholder="Nombre"
                className="w-full h-11 px-2 rounded-xl border text-sm text-foreground"
                style={{ borderColor: 'var(--border-control)', backgroundColor: 'var(--input-background)' }} />
            </div>
            <div className="space-y-1">
              <label className="text-xs font-semibold" style={{ color: 'var(--muted-foreground)' }}>CHOFER</label>
              <input maxLength={limiteTexto('m78_nota_trazabilidad', 'chofer')} type="text" value={form.chofer} onChange={setF('chofer')} placeholder="Nombre"
                className="w-full h-11 px-2 rounded-xl border text-sm text-foreground"
                style={{ borderColor: 'var(--border-control)', backgroundColor: 'var(--input-background)' }} />
            </div>
            <div className="space-y-1">
              <label className="text-xs font-semibold" style={{ color: 'var(--muted-foreground)' }}>RECIBIÓ</label>
              <input maxLength={limiteTexto('m78_nota_trazabilidad', 'recibio')} type="text" value={form.recibio} onChange={setF('recibio')} placeholder="Nombre"
                className="w-full h-11 px-2 rounded-xl border text-sm text-foreground"
                style={{ borderColor: 'var(--border-control)', backgroundColor: 'var(--input-background)' }} />
            </div>
          </div>

          {/* Observaciones */}
          <div className="space-y-1">
            <label className="text-xs font-semibold" style={{ color: 'var(--muted-foreground)' }}>OBSERVACIONES</label>
            <TextareaContador limite={limiteTexto('m78_nota_trazabilidad', 'observaciones')} value={form.observaciones} onChange={setF('observaciones')} rows={2}
              placeholder="Observaciones adicionales…"
              className="w-full rounded-xl border px-3 py-2 text-sm resize-none"
              style={{ borderColor: 'var(--border)', backgroundColor: 'var(--input-background)' }} />
          </div>
        </div>

        <div className="p-4 border-t" style={{ borderColor: 'var(--border)' }}>
          <Boton onClick={handleGuardar} cargando={guardando} disabled={!form.rancho_id} className="w-full">
            {guardando ? <><Loader2 className="w-4 h-4 animate-spin" /> Guardando…</> : online ? 'Guardar nota' : <><WifiOff className="w-4 h-4" /> Guardar sin conexión</>}
          </Boton>
        </div>
        </>)}
      </BottomSheet>

      {/* Sheet — Exportar consolidado */}
      <BottomSheet open={consolidadoOpen} onClose={() => setConsolidadoOpen(false)}>
        <div className="flex items-center justify-between px-4 pt-4 pb-3 border-b" style={{ borderColor: 'var(--border)' }}>
          <h2 className="text-base text-foreground font-semibold">Exportar consolidado</h2>
          <button aria-label="Cerrar" onClick={() => setConsolidadoOpen(false)}>
            <X className="w-5 h-5" style={{ color: 'var(--muted-foreground)' }} />
          </button>
        </div>
        <div className="flex-1 overflow-y-auto px-4 pt-4 pb-4 space-y-4">
          <div className="space-y-1">
            <label className="text-xs font-semibold" style={{ color: 'var(--muted-foreground)' }}>
              {termino.toUpperCase()} (opcional)
            </label>
            <select
              value={consolidadoForm.rancho_id}
              onChange={(e) => setConsolidadoForm(f => ({ ...f, rancho_id: e.target.value }))}
              className="w-full h-11 px-3 rounded-xl border text-sm text-foreground"
              style={{ borderColor: 'var(--border-control)', backgroundColor: 'var(--input-background)' }}
            >
              <option value="">Todos los {terminosSitio.plural.toLowerCase()}</option>
              {ranchos.map(r => <option key={r.id} value={r.id}>{r.nombre}</option>)}
            </select>
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-1">
              <label className="text-xs font-semibold" style={{ color: 'var(--muted-foreground)' }}>DESDE</label>
              <input type="date" value={consolidadoForm.desde}
                onChange={(e) => setConsolidadoForm(f => ({ ...f, desde: e.target.value }))}
                className="w-full h-11 px-3 rounded-xl border text-sm text-foreground"
                style={{ borderColor: 'var(--border-control)', backgroundColor: 'var(--input-background)' }} />
            </div>
            <div className="space-y-1">
              <label className="text-xs font-semibold" style={{ color: 'var(--muted-foreground)' }}>HASTA</label>
              <input type="date" value={consolidadoForm.hasta}
                onChange={(e) => setConsolidadoForm(f => ({ ...f, hasta: e.target.value }))}
                className="w-full h-11 px-3 rounded-xl border text-sm text-foreground"
                style={{ borderColor: 'var(--border-control)', backgroundColor: 'var(--input-background)' }} />
            </div>
          </div>
          <Boton onClick={exportarConsolidado} cargando={exportando} className="w-full">
            {exportando ? <><Loader2 className="w-4 h-4 animate-spin" /> Exportando…</> : 'Exportar PDF'}
          </Boton>
        </div>
      </BottomSheet>
    </div>
  )
}
