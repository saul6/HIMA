import { useState, useCallback } from 'react'
import { useNavigate } from 'react-router'
import {
  ChevronLeft, Plus, X, Loader2, Search, Printer, Eye, FileDown,
  Package, Truck, Layers, ArrowLeftRight, GitBranch,
} from 'lucide-react'
import { toast } from 'sonner'
import { useAuthContext } from '@/context/AuthContext'
import { useModulosContext } from '@/context/ModulosContext'
import { useRanchos } from '@/hooks/useRanchos'
import { supabase } from '@/lib/supabase'
import { hoyMX } from '@/lib/fecha'
import {
  useM48LotesRecepcion, useM48LotesProducto,
  useM48LotesCompuestos, useM48FoliosEmbarque,
  consultarTrazabilidad,
  type M48LoteRecepcion, type M48LoteProducto,
  type M48LoteCompuesto, type M48FolioEmbarque,
  type TrazabilidadNodo,
} from '@/hooks/useM48Trazabilidad'
import { registrarYGenerarEtiqueta, registrarEImprimirEtiqueta } from '@/lib/pdf/m48/generarM48PDF'
import QRCode from 'qrcode'

const tbl = (name: string) => (supabase as any).from(name)

type Tab = 'lr' | 'lpt' | 'lc' | 'fe' | 'trazabilidad'

const RESULTADO_OPTS = ['aceptado', 'rechazado', 'retenido', 'condicionado'] as const
const UNIDAD_OPTS = ['cajas', 'piezas', 'kg', 'toneladas'] as const

// ── Helpers ──────────────────────────────────────────────────────────────────

function fmtFecha(iso: string | null | undefined) {
  if (!iso) return '—'
  const [y, m, d] = iso.split('-')
  return `${d}/${m}/${y}`
}

function chipResultado(r: string | null) {
  if (!r) return null
  const map: Record<string, string> = {
    aceptado: 'var(--agro-success-text)',
    rechazado: 'var(--agro-danger-text)',
    retenido: 'var(--agro-warning-text)',
    condicionado: 'var(--agro-warning-text)',
  }
  return map[r] ?? 'var(--muted-foreground)'
}

// ── Balance de masas ─────────────────────────────────────────────────────────

function calcBalance(empacada: number, merma: number, pendiente: number) {
  return (empacada || 0) + (merma || 0) + (pendiente || 0)
}

// ── Formularios de estado ─────────────────────────────────────────────────────

interface LRForm {
  fecha: string; hora: string; proveedor_nombre: string; proveedor_origen: string
  proveedor_codigo: string; cantidad: string; unidad: string; condicion_vehiculo: string
  resultado: string; responsable: string; observaciones: string
}
const LR_VACÍO: LRForm = {
  fecha: hoyMX(), hora: '', proveedor_nombre: '', proveedor_origen: '',
  proveedor_codigo: 'P000', cantidad: '', unidad: 'cajas',
  condicion_vehiculo: '', resultado: 'aceptado', responsable: '', observaciones: '',
}

interface LPTForm {
  fecha_empaque: string; turno: string; presentacion: string
  origen_tipo: 'lr' | 'lc'; lr_id: string; lc_id: string
  hora_inicio: string; hora_termino: string
  cant_ingresada: string; cant_empacada: string; rechazo_merma: string
  pendiente_retenido: string; responsable: string; observaciones: string
}
const LPT_VACÍO: LPTForm = {
  fecha_empaque: hoyMX(), turno: '1', presentacion: '',
  origen_tipo: 'lr', lr_id: '', lc_id: '',
  hora_inicio: '', hora_termino: '',
  cant_ingresada: '', cant_empacada: '', rechazo_merma: '0',
  pendiente_retenido: '0', responsable: '', observaciones: '',
}

interface LCForm {
  fecha: string; motivo: string; observaciones: string; lr_ids: string[]
}
const LC_VACÍO: LCForm = { fecha: hoyMX(), motivo: '', observaciones: '', lr_ids: [] }

interface FELinea { lpt_id: string; numero_tarima: string; cantidad: string; cliente: string }
interface FEForm {
  fecha: string; cliente: string; transporte_linea: string; transporte_placas: string
  transporte_caja: string; chofer: string; condiciones_limpieza: string; sello: string
  equipo_temp: string; condiciones_embarque: string; total_embarcado: string; observaciones: string
  lineas: FELinea[]
}
const FE_VACÍO: FEForm = {
  fecha: hoyMX(), cliente: '', transporte_linea: '', transporte_placas: '',
  transporte_caja: '', chofer: '', condiciones_limpieza: '', sello: '',
  equipo_temp: '', condiciones_embarque: '', total_embarcado: '', observaciones: '',
  lineas: [{ lpt_id: '', numero_tarima: '', cantidad: '', cliente: '' }],
}

interface EtiquetaForm { verificado_por: string; cantidad_etiquetas: string }

interface PrintData {
  lptCodigo: string
  producto: string
  presentacion: string | null
  fechaEmpaque: string
  turno: number
  origenCodigo: string | null
  origenTipo: 'LR' | 'LC' | null
  proveedorCodigo: string | null
  clienteDestino: string
  cantEmpacada: number | null
  orgNombre: string
  ranchoNombre: string
  qrDataUrl: string
}

function buildQrText(d: Omit<PrintData, 'qrDataUrl'>): string {
  return [
    `LPT: ${d.lptCodigo}`,
    `Producto: ${d.producto}`,
    `Presentacion: ${d.presentacion ?? 'Caja / segun cliente'}`,
    `Turno: T${d.turno}`,
    `Fecha empaque: ${fmtFecha(d.fechaEmpaque)}`,
    `${d.origenTipo ?? 'LR'}: ${d.origenCodigo ?? '—'}`,
    `Proveedor: ${d.proveedorCodigo ?? '—'}`,
    `Cliente/destino: ${d.clienteDestino}`,
    `Empresa: ${d.orgNombre}`,
  ].join('\n')
}

// ── Componente principal ──────────────────────────────────────────────────────

export function TrazabilidadProducto() {
  const navigate = useNavigate()
  const { profile, codigoClave } = useAuthContext()
  const { terminosSitio } = useModulosContext()
  const orgId = profile?.org_id ?? null
  const { ranchos } = useRanchos()

  const [ranchoId, setRanchoId] = useState<string>('')
  const [tab, setTab] = useState<Tab>('lr')

  // Data hooks
  const { lotes: lotesLR, loading: loadingLR, refetch: refetchLR } = useM48LotesRecepcion(orgId, ranchoId || null)
  const { lotes: lotesLPT, loading: loadingLPT, refetch: refetchLPT } = useM48LotesProducto(orgId, ranchoId || null)
  const { lotes: lotesLC, loading: loadingLC, refetch: refetchLC } = useM48LotesCompuestos(orgId, ranchoId || null)
  const { folios: feFolios, loading: loadingFE, refetch: refetchFE } = useM48FoliosEmbarque(orgId, ranchoId || null)

  // Sheet states
  const [sheetLR, setSheetLR] = useState(false)
  const [sheetLPT, setSheetLPT] = useState(false)
  const [sheetLC, setSheetLC] = useState(false)
  const [sheetFE, setSheetFE] = useState(false)
  const [sheetEtiqueta, setSheetEtiqueta] = useState<{ lpt: M48LoteProducto } | null>(null)

  // Form states
  const [formLR, setFormLR] = useState<LRForm>(LR_VACÍO)
  const [formLPT, setFormLPT] = useState<LPTForm>(LPT_VACÍO)
  const [formLC, setFormLC] = useState<LCForm>(LC_VACÍO)
  const [formFE, setFormFE] = useState<FEForm>(FE_VACÍO)
  const [formEtiqueta, setFormEtiqueta] = useState<EtiquetaForm>({ verificado_por: '', cantidad_etiquetas: '1' })

  const [guardando, setGuardando] = useState(false)
  const [busqueda, setBusqueda] = useState('')
  const [resultadoTraz, setResultadoTraz] = useState<TrazabilidadNodo | null>(null)
  const [buscandoTraz, setBuscandoTraz] = useState(false)
  const [previewInfo, setPreviewInfo] = useState<PrintData | null>(null)
  const [loadingPreview, setLoadingPreview] = useState<string | null>(null)

  // Search filter
  const [filtroLR, setFiltroLR] = useState('')
  const [filtroLPT, setFiltroLPT] = useState('')

  const sTermino = terminosSitio.singular

  // ── Guardar LR ─────────────────────────────────────────────────────────────

  async function handleGuardarLR() {
    if (!orgId || !ranchoId) { toast.error(`Selecciona ${sTermino.toLowerCase()}`); return }
    if (!formLR.proveedor_nombre.trim()) { toast.error('El nombre del proveedor es requerido'); return }
    setGuardando(true)
    try {
      const payload: any = {
        org_id: orgId, rancho_id: ranchoId,
        fecha: formLR.fecha || hoyMX(),
        proveedor_nombre: formLR.proveedor_nombre.trim(),
        proveedor_origen: formLR.proveedor_origen.trim() || null,
        proveedor_codigo: formLR.proveedor_codigo.trim() || 'P000',
        hora: formLR.hora || null,
        cantidad: formLR.cantidad ? parseFloat(formLR.cantidad) : null,
        unidad: formLR.unidad || null,
        condicion_vehiculo: formLR.condicion_vehiculo.trim() || null,
        resultado: formLR.resultado || null,
        responsable: formLR.responsable.trim() || null,
        observaciones: formLR.observaciones.trim() || null,
      }
      const { data, error } = await tbl('m48_lotes_recepcion').insert(payload).select().single()
      if (error) throw error
      toast.success(`LR registrado: ${data.codigo}`)
      setSheetLR(false); setFormLR(LR_VACÍO); refetchLR()
    } catch (e: unknown) {
      toast.error(e instanceof Error ? e.message : 'Error al guardar LR')
    } finally { setGuardando(false) }
  }

  // ── Guardar LPT ────────────────────────────────────────────────────────────

  const balanceSuma = calcBalance(
    parseFloat(formLPT.cant_empacada) || 0,
    parseFloat(formLPT.rechazo_merma) || 0,
    parseFloat(formLPT.pendiente_retenido) || 0,
  )
  const ingresada = parseFloat(formLPT.cant_ingresada) || 0
  const desequilibrio = ingresada > 0 && Math.abs(balanceSuma - ingresada) > 0.001

  async function handleGuardarLPT() {
    if (!orgId || !ranchoId) { toast.error(`Selecciona ${sTermino.toLowerCase()}`); return }
    const origenId = formLPT.origen_tipo === 'lr' ? formLPT.lr_id : formLPT.lc_id
    if (!origenId) { toast.error('Selecciona el lote de origen'); return }
    setGuardando(true)
    try {
      const payload: any = {
        org_id: orgId, rancho_id: ranchoId,
        fecha_empaque: formLPT.fecha_empaque || hoyMX(),
        turno: parseInt(formLPT.turno) || 1,
        presentacion: formLPT.presentacion.trim() || null,
        lr_id: formLPT.origen_tipo === 'lr' ? formLPT.lr_id : null,
        lc_id: formLPT.origen_tipo === 'lc' ? formLPT.lc_id : null,
        hora_inicio: formLPT.hora_inicio || null,
        hora_termino: formLPT.hora_termino || null,
        cant_ingresada: formLPT.cant_ingresada ? parseFloat(formLPT.cant_ingresada) : null,
        cant_empacada: formLPT.cant_empacada ? parseFloat(formLPT.cant_empacada) : null,
        rechazo_merma: formLPT.rechazo_merma ? parseFloat(formLPT.rechazo_merma) : null,
        pendiente_retenido: formLPT.pendiente_retenido ? parseFloat(formLPT.pendiente_retenido) : null,
        responsable: formLPT.responsable.trim() || null,
        observaciones: formLPT.observaciones.trim() || null,
      }
      const { data, error } = await tbl('m48_lotes_producto').insert(payload).select().single()
      if (error) throw error
      toast.success(`LPT registrado: ${data.codigo}`)
      setSheetLPT(false); setFormLPT(LPT_VACÍO); refetchLPT()
    } catch (e: unknown) {
      toast.error(e instanceof Error ? e.message : 'Error al guardar LPT')
    } finally { setGuardando(false) }
  }

  // ── Guardar LC ─────────────────────────────────────────────────────────────

  async function handleGuardarLC() {
    if (!orgId || !ranchoId) { toast.error(`Selecciona ${sTermino.toLowerCase()}`); return }
    if (formLC.lr_ids.length < 2) { toast.error('Selecciona al menos 2 LR para componer'); return }
    setGuardando(true)
    try {
      const { data: lc, error } = await tbl('m48_lotes_compuestos').insert({
        org_id: orgId, rancho_id: ranchoId,
        fecha: formLC.fecha || hoyMX(),
        motivo: formLC.motivo.trim() || null,
        observaciones: formLC.observaciones.trim() || null,
      }).select().single()
      if (error) throw error
      // Insert relations
      const rels = formLC.lr_ids.map(lr_id => ({ lc_id: lc.id, lr_id }))
      const { error: relErr } = await tbl('m48_lc_lr').insert(rels)
      if (relErr) throw relErr
      toast.success(`LC registrado: ${lc.codigo}`)
      setSheetLC(false); setFormLC(LC_VACÍO); refetchLC()
    } catch (e: unknown) {
      toast.error(e instanceof Error ? e.message : 'Error al guardar LC')
    } finally { setGuardando(false) }
  }

  // ── Guardar FE ─────────────────────────────────────────────────────────────

  async function handleGuardarFE() {
    if (!orgId || !ranchoId) { toast.error(`Selecciona ${sTermino.toLowerCase()}`); return }
    const lineasValidas = formFE.lineas.filter(l => l.lpt_id)
    if (lineasValidas.length === 0) { toast.error('Agrega al menos un LPT al folio'); return }
    setGuardando(true)
    try {
      const { data: fe, error } = await tbl('m48_folios_embarque').insert({
        org_id: orgId, rancho_id: ranchoId,
        fecha: formFE.fecha || hoyMX(),
        cliente: formFE.cliente.trim() || null,
        transporte_linea: formFE.transporte_linea.trim() || null,
        transporte_placas: formFE.transporte_placas.trim() || null,
        transporte_caja: formFE.transporte_caja.trim() || null,
        chofer: formFE.chofer.trim() || null,
        condiciones_limpieza: formFE.condiciones_limpieza.trim() || null,
        sello: formFE.sello.trim() || null,
        equipo_temp: formFE.equipo_temp.trim() || null,
        condiciones_embarque: formFE.condiciones_embarque.trim() || null,
        total_embarcado: formFE.total_embarcado ? parseFloat(formFE.total_embarcado) : null,
        observaciones: formFE.observaciones.trim() || null,
      }).select().single()
      if (error) throw error
      const rels = lineasValidas.map(l => ({
        fe_id: fe.id, lpt_id: l.lpt_id,
        numero_tarima: l.numero_tarima ? parseInt(l.numero_tarima) : null,
        cantidad: l.cantidad ? parseFloat(l.cantidad) : null,
        cliente: l.cliente.trim() || null,
      }))
      const { error: relErr } = await tbl('m48_fe_lpt').insert(rels)
      if (relErr) throw relErr
      toast.success(`FE registrado: ${fe.codigo}`)
      setSheetFE(false); setFormFE(FE_VACÍO); refetchFE()
    } catch (e: unknown) {
      toast.error(e instanceof Error ? e.message : 'Error al guardar FE')
    } finally { setGuardando(false) }
  }

  // ── Generar etiqueta ────────────────────────────────────────────────────────

  async function handleGenerarEtiqueta() {
    if (!sheetEtiqueta || !orgId || !ranchoId) return
    if (!formEtiqueta.verificado_por.trim()) { toast.error('Ingresa quien verifica'); return }
    setGuardando(true)
    try {
      await registrarYGenerarEtiqueta(
        sheetEtiqueta.lpt.id, orgId, ranchoId,
        formEtiqueta.verificado_por.trim(),
        parseInt(formEtiqueta.cantidad_etiquetas) || 1,
      )
      toast.success('Etiqueta generada y liberacion registrada')
      setSheetEtiqueta(null)
      setFormEtiqueta({ verificado_por: '', cantidad_etiquetas: '1' })
    } catch (e: unknown) {
      toast.error(e instanceof Error ? e.message : 'Error al generar etiqueta')
    } finally { setGuardando(false) }
  }

  // ── Consulta de trazabilidad ────────────────────────────────────────────────

  const handleBuscarTraz = useCallback(async () => {
    if (!busqueda.trim() || !orgId) return
    setBuscandoTraz(true); setResultadoTraz(null)
    try {
      const result = await consultarTrazabilidad(busqueda.trim(), orgId)
      if (!result) { toast.warning('Codigo no encontrado en esta organizacion') }
      setResultadoTraz(result)
    } catch (e: unknown) {
      toast.error(e instanceof Error ? e.message : 'Error en la consulta')
    } finally { setBuscandoTraz(false) }
  }, [busqueda, orgId])

  // ── Imprimir etiqueta ───────────────────────────────────────────────────────

  async function handleImprimirEtiqueta() {
    if (!sheetEtiqueta || !orgId || !ranchoId) return
    if (!formEtiqueta.verificado_por.trim()) { toast.error('Ingresa quien verifica'); return }
    setGuardando(true)
    try {
      await registrarEImprimirEtiqueta(
        sheetEtiqueta.lpt.id, orgId, ranchoId,
        formEtiqueta.verificado_por.trim(),
        parseInt(formEtiqueta.cantidad_etiquetas) || 1,
      )
      toast.success('Liberacion registrada — selecciona la impresora en el dialogo')
      setSheetEtiqueta(null)
      setFormEtiqueta({ verificado_por: '', cantidad_etiquetas: '1' })
    } catch (e: unknown) {
      toast.error(e instanceof Error ? e.message : 'Error al imprimir')
    } finally { setGuardando(false) }
  }

  // ── Vista previa de etiqueta ────────────────────────────────────────────────

  async function handleVerPreview(lpt: M48LoteProducto) {
    if (!orgId) return
    setLoadingPreview(lpt.id)
    try {
      const orgRes = await tbl('organizaciones').select('nombre').eq('id', orgId).single()
      const orgNombre: string = orgRes.data?.nombre ?? '—'
      const ranchoNombre: string = ranchos.find((r: any) => r.id === ranchoId)?.nombre ?? '—'

      let proveedorCodigo: string | null = null
      if (lpt.lr_id) {
        const lrRes = await tbl('m48_lotes_recepcion').select('proveedor_codigo').eq('id', lpt.lr_id).single()
        proveedorCodigo = lrRes.data?.proveedor_codigo ?? null
      }

      const feRes = await tbl('m48_fe_lpt').select('m48_folios_embarque(cliente)').eq('lpt_id', lpt.id).maybeSingle()
      const clienteDestino: string = feRes.data?.m48_folios_embarque?.cliente ?? 'Segun programacion'

      const producto: string = lpt.codigo.split('-')[1] ?? '—'
      const base: Omit<PrintData, 'qrDataUrl'> = {
        lptCodigo: lpt.codigo,
        producto,
        presentacion: lpt.presentacion ?? null,
        fechaEmpaque: lpt.fecha_empaque,
        turno: lpt.turno,
        origenCodigo: lpt.lr_codigo ?? lpt.lc_codigo ?? null,
        origenTipo: lpt.lr_id ? 'LR' : lpt.lc_id ? 'LC' : null,
        proveedorCodigo,
        clienteDestino,
        cantEmpacada: lpt.cant_empacada ?? null,
        orgNombre,
        ranchoNombre,
      }
      const qrDataUrl = await QRCode.toDataURL(buildQrText(base), { width: 400, margin: 1, errorCorrectionLevel: 'M' })
      setPreviewInfo({ ...base, qrDataUrl })
    } catch (e: unknown) {
      toast.error(e instanceof Error ? e.message : 'Error al cargar vista previa')
    } finally {
      setLoadingPreview(null)
    }
  }

  // ── Filtros de lista ────────────────────────────────────────────────────────

  const lrFiltrados = filtroLR
    ? lotesLR.filter(r => r.codigo.toLowerCase().includes(filtroLR.toLowerCase()) || r.proveedor_nombre.toLowerCase().includes(filtroLR.toLowerCase()))
    : lotesLR

  const lptFiltrados = filtroLPT
    ? lotesLPT.filter(r => r.codigo.toLowerCase().includes(filtroLPT.toLowerCase()) || (r.presentacion ?? '').toLowerCase().includes(filtroLPT.toLowerCase()))
    : lotesLPT

  // ── Toggle LR en LC ─────────────────────────────────────────────────────────

  function toggleLRenLC(id: string) {
    setFormLC(f => ({
      ...f,
      lr_ids: f.lr_ids.includes(id) ? f.lr_ids.filter(x => x !== id) : [...f.lr_ids, id],
    }))
  }

  // ── Render ──────────────────────────────────────────────────────────────────

  const tabs: { key: Tab; label: string; icon: React.ReactNode }[] = [
    { key: 'lr', label: 'Recepcion', icon: <Package className="w-3.5 h-3.5" /> },
    { key: 'lpt', label: 'Empaque', icon: <Layers className="w-3.5 h-3.5" /> },
    { key: 'lc', label: 'Compuestos', icon: <GitBranch className="w-3.5 h-3.5" /> },
    { key: 'fe', label: 'Embarques', icon: <Truck className="w-3.5 h-3.5" /> },
    { key: 'trazabilidad', label: 'Trazabilidad', icon: <ArrowLeftRight className="w-3.5 h-3.5" /> },
  ]

  const showFAB = tab !== 'trazabilidad' && ranchoId

  return (
    <div className="min-h-full pb-safe-nav flex flex-col">
      {/* Header */}
      <header className="bg-card border-b border-border px-4 py-4 flex items-center gap-3 flex-shrink-0">
        <button onClick={() => navigate('/')} className="p-1 text-muted-foreground">
          <ChevronLeft className="w-5 h-5" />
        </button>
        <div className="flex-1 min-w-0">
          <h1 className="text-foreground text-sm truncate" style={{ fontWeight: 600 }}>
            Trazabilidad y Recuperacion del Producto
          </h1>
          <p className="text-xs text-muted-foreground">POE-COCO-CAL-13</p>
        </div>
      </header>

      {/* Instalacion selector */}
      <div className="px-4 pt-3 pb-2 flex-shrink-0">
        <select
          value={ranchoId}
          onChange={e => setRanchoId(e.target.value)}
          className="w-full h-10 px-3 rounded-lg bg-input-background border border-border text-sm focus:outline-none focus:border-primary focus:ring-1 focus:ring-primary"
        >
          <option value="">Seleccionar {sTermino.toLowerCase()}...</option>
          {ranchos.map(r => (
            <option key={r.id} value={r.id}>{r.nombre}</option>
          ))}
        </select>
      </div>

      {/* Tab bar */}
      <div className="flex gap-1 px-4 pb-2 overflow-x-auto flex-shrink-0">
        {tabs.map(t => (
          <button
            key={t.key}
            onClick={() => setTab(t.key)}
            className="flex items-center gap-1 px-2.5 py-1.5 rounded-full text-xs whitespace-nowrap transition-colors"
            style={{
              fontWeight: 600,
              background: tab === t.key ? 'var(--primary)' : 'var(--muted)',
              color: tab === t.key ? '#fff' : 'var(--muted-foreground)',
            }}
          >
            {t.icon}{t.label}
          </button>
        ))}
      </div>

      {/* Content */}
      <div className="flex-1 overflow-y-auto px-4 pb-24">

        {/* ── Tab: LR ─────────────────────────────────────────────────────── */}
        {tab === 'lr' && (
          <div className="space-y-2">
            <input
              value={filtroLR}
              onChange={e => setFiltroLR(e.target.value)}
              placeholder="Buscar por codigo o proveedor..."
              className="w-full h-9 px-3 rounded-lg bg-input-background border border-border text-sm focus:outline-none focus:border-primary"
            />
            {loadingLR ? (
              <div className="flex justify-center py-8"><Loader2 className="w-6 h-6 text-primary animate-spin" /></div>
            ) : lrFiltrados.length === 0 ? (
              <p className="text-center text-sm text-muted-foreground py-8">Sin lotes de recepcion</p>
            ) : lrFiltrados.map(lr => (
              <div key={lr.id} className="bg-card border border-border rounded-xl p-4">
                <div className="flex items-start justify-between gap-2">
                  <div className="min-w-0">
                    <p className="text-sm font-mono" style={{ fontWeight: 700, color: 'var(--primary)' }}>{lr.codigo}</p>
                    <p className="text-sm text-foreground" style={{ fontWeight: 600 }}>{lr.proveedor_nombre}</p>
                    <p className="text-xs text-muted-foreground">{fmtFecha(lr.fecha)}{lr.hora ? ` · ${lr.hora}` : ''}{lr.proveedor_origen ? ` · ${lr.proveedor_origen}` : ''}</p>
                    {lr.cantidad && <p className="text-xs text-muted-foreground">{lr.cantidad} {lr.unidad ?? ''}</p>}
                  </div>
                  {lr.resultado && (
                    <span className="text-xs px-2 py-0.5 rounded-full" style={{ color: chipResultado(lr.resultado) ?? undefined, background: 'var(--muted)', fontWeight: 600 }}>
                      {lr.resultado}
                    </span>
                  )}
                </div>
              </div>
            ))}
          </div>
        )}

        {/* ── Tab: LPT ────────────────────────────────────────────────────── */}
        {tab === 'lpt' && (
          <div className="space-y-2">
            <input
              value={filtroLPT}
              onChange={e => setFiltroLPT(e.target.value)}
              placeholder="Buscar por codigo o presentacion..."
              className="w-full h-9 px-3 rounded-lg bg-input-background border border-border text-sm focus:outline-none focus:border-primary"
            />
            {loadingLPT ? (
              <div className="flex justify-center py-8"><Loader2 className="w-6 h-6 text-primary animate-spin" /></div>
            ) : lptFiltrados.length === 0 ? (
              <p className="text-center text-sm text-muted-foreground py-8">Sin lotes de producto terminado</p>
            ) : lptFiltrados.map(lpt => {
              const ing = lpt.cant_ingresada ?? 0
              const suma = (lpt.cant_empacada ?? 0) + (lpt.rechazo_merma ?? 0) + (lpt.pendiente_retenido ?? 0)
              const deseq = ing > 0 && Math.abs(suma - ing) > 0.001
              return (
                <div key={lpt.id} className="bg-card border border-border rounded-xl p-4">
                  <div className="flex items-start justify-between gap-2 mb-2">
                    <div className="min-w-0">
                      <p className="text-sm font-mono" style={{ fontWeight: 700, color: 'var(--primary)' }}>{lpt.codigo}</p>
                      <p className="text-sm text-foreground">{lpt.presentacion ?? '—'}</p>
                      <p className="text-xs text-muted-foreground">
                        {fmtFecha(lpt.fecha_empaque)} · Turno {lpt.turno}
                        {lpt.lr_codigo ? ` · LR: ${lpt.lr_codigo}` : lpt.lc_codigo ? ` · LC: ${lpt.lc_codigo}` : ''}
                      </p>
                    </div>
                    <div className="flex items-center gap-1 flex-shrink-0">
                      <button
                        onClick={() => handleVerPreview(lpt)}
                        disabled={loadingPreview === lpt.id}
                        className="p-2 rounded-lg"
                        style={{ background: 'var(--muted)', color: 'var(--muted-foreground)' }}
                        title="Vista previa de etiqueta"
                      >
                        {loadingPreview === lpt.id
                          ? <Loader2 className="w-4 h-4 animate-spin" />
                          : <Eye className="w-4 h-4" />}
                      </button>
                      <button
                        onClick={() => { setSheetEtiqueta({ lpt }); setFormEtiqueta({ verificado_por: profile?.nombre_completo ?? '', cantidad_etiquetas: '1' }) }}
                        className="p-2 rounded-lg"
                        style={{ background: 'var(--muted)', color: 'var(--primary)' }}
                        title="Generar etiqueta PDF"
                      >
                        <FileDown className="w-4 h-4" />
                      </button>
                      <button
                        onClick={() => { setSheetEtiqueta({ lpt }); setFormEtiqueta({ verificado_por: profile?.nombre_completo ?? '', cantidad_etiquetas: '1' }) }}
                        className="p-2 rounded-lg"
                        style={{ background: 'var(--muted)', color: 'var(--primary)' }}
                        title="Imprimir etiqueta"
                      >
                        <Printer className="w-4 h-4" />
                      </button>
                    </div>
                  </div>
                  {deseq && (
                    <div className="rounded-lg px-3 py-1.5 text-xs" style={{ background: 'var(--agro-warning-fill)', color: 'var(--agro-warning-text)' }}>
                      Balance: ingresado {ing} ≠ suma {suma.toFixed(2)} — diferencia no justificada, investigar
                    </div>
                  )}
                  {lpt.cant_empacada != null && (
                    <p className="text-xs text-muted-foreground mt-1">
                      Empacado: {lpt.cant_empacada} · Merma: {lpt.rechazo_merma ?? 0} · Pendiente: {lpt.pendiente_retenido ?? 0}
                    </p>
                  )}
                </div>
              )
            })}
          </div>
        )}

        {/* ── Tab: LC ─────────────────────────────────────────────────────── */}
        {tab === 'lc' && (
          <div className="space-y-2">
            {loadingLC ? (
              <div className="flex justify-center py-8"><Loader2 className="w-6 h-6 text-primary animate-spin" /></div>
            ) : lotesLC.length === 0 ? (
              <p className="text-center text-sm text-muted-foreground py-8">Sin lotes compuestos</p>
            ) : lotesLC.map(lc => (
              <div key={lc.id} className="bg-card border border-border rounded-xl p-4">
                <p className="text-sm font-mono" style={{ fontWeight: 700, color: 'var(--primary)' }}>{lc.codigo}</p>
                <p className="text-xs text-muted-foreground">{fmtFecha(lc.fecha)}{lc.motivo ? ` · ${lc.motivo}` : ''}</p>
                <div className="mt-2 space-y-1">
                  {lc.lotes_recepcion.map(lr => (
                    <div key={lr.id} className="text-xs text-muted-foreground flex gap-2">
                      <span className="font-mono" style={{ color: 'var(--primary)' }}>{lr.codigo}</span>
                      <span>{lr.proveedor_nombre}</span>
                    </div>
                  ))}
                </div>
              </div>
            ))}
          </div>
        )}

        {/* ── Tab: FE ─────────────────────────────────────────────────────── */}
        {tab === 'fe' && (
          <div className="space-y-2">
            {loadingFE ? (
              <div className="flex justify-center py-8"><Loader2 className="w-6 h-6 text-primary animate-spin" /></div>
            ) : feFolios.length === 0 ? (
              <p className="text-center text-sm text-muted-foreground py-8">Sin folios de embarque</p>
            ) : feFolios.map(fe => (
              <div key={fe.id} className="bg-card border border-border rounded-xl p-4">
                <p className="text-sm font-mono" style={{ fontWeight: 700, color: 'var(--primary)' }}>{fe.codigo}</p>
                <p className="text-sm text-foreground" style={{ fontWeight: 600 }}>{fe.cliente ?? '—'}</p>
                <p className="text-xs text-muted-foreground">{fmtFecha(fe.fecha)}{fe.transporte_placas ? ` · ${fe.transporte_placas}` : ''}</p>
                {fe.lotes_producto.length > 0 && (
                  <div className="mt-2 space-y-1">
                    {fe.lotes_producto.map(rel => (
                      <div key={rel.lpt_id} className="text-xs text-muted-foreground flex gap-2">
                        <span className="font-mono" style={{ color: 'var(--primary)' }}>{rel.lpt_codigo}</span>
                        {rel.numero_tarima && <span>Tarima {rel.numero_tarima}</span>}
                        {rel.cantidad && <span>{rel.cantidad} uds</span>}
                      </div>
                    ))}
                  </div>
                )}
              </div>
            ))}
          </div>
        )}

        {/* ── Tab: Trazabilidad ───────────────────────────────────────────── */}
        {tab === 'trazabilidad' && (
          <div className="space-y-4">
            <div className="flex gap-2">
              <input
                value={busqueda}
                onChange={e => setBusqueda(e.target.value)}
                onKeyDown={e => { if (e.key === 'Enter') handleBuscarTraz() }}
                placeholder="LR-COC-... / LPT-COC-... / LC-COC-... / FE-..."
                className="flex-1 h-10 px-3 rounded-lg bg-input-background border border-border text-sm font-mono focus:outline-none focus:border-primary"
              />
              <button
                onClick={handleBuscarTraz}
                disabled={buscandoTraz || !busqueda.trim()}
                className="h-10 w-10 rounded-lg flex items-center justify-center disabled:opacity-50"
                style={{ background: 'var(--primary)', color: '#fff' }}
              >
                {buscandoTraz ? <Loader2 className="w-4 h-4 animate-spin" /> : <Search className="w-4 h-4" />}
              </button>
            </div>

            {resultadoTraz && <TrazabilidadResultado nodo={resultadoTraz} />}
          </div>
        )}
      </div>

      {/* FAB */}
      {showFAB && (
        <div className="fixed bottom-safe-fab left-1/2 -translate-x-1/2 w-full max-w-[390px] flex justify-end px-4 pointer-events-none z-10">
          <button
            onClick={() => {
              if (tab === 'lr') { setFormLR(LR_VACÍO); setSheetLR(true) }
              else if (tab === 'lpt') { setFormLPT(LPT_VACÍO); setSheetLPT(true) }
              else if (tab === 'lc') { setFormLC(LC_VACÍO); setSheetLC(true) }
              else if (tab === 'fe') { setFormFE(FE_VACÍO); setSheetFE(true) }
            }}
            className="w-14 h-14 rounded-full text-white flex items-center justify-center shadow-lg pointer-events-auto"
            style={{ background: 'var(--primary)' }}
          >
            <Plus className="w-6 h-6" />
          </button>
        </div>
      )}

      {/* ── Bottom Sheet: LR ─────────────────────────────────────────────── */}
      {sheetLR && (
        <BottomSheet title="Nuevo Lote de Recepcion (LR)" onClose={() => setSheetLR(false)}>
          <FormField label="FECHA">
            <input type="date" value={formLR.fecha} onChange={e => setFormLR(f => ({ ...f, fecha: e.target.value }))} className={inputCls} />
          </FormField>
          <FormField label="HORA">
            <input type="time" value={formLR.hora} onChange={e => setFormLR(f => ({ ...f, hora: e.target.value }))} className={inputCls} />
          </FormField>
          <FormField label="PROVEEDOR *">
            <input value={formLR.proveedor_nombre} onChange={e => setFormLR(f => ({ ...f, proveedor_nombre: e.target.value }))} placeholder="Nombre del proveedor" className={inputCls} />
          </FormField>
          <FormField label="ORIGEN">
            <input value={formLR.proveedor_origen} onChange={e => setFormLR(f => ({ ...f, proveedor_origen: e.target.value }))} placeholder="Municipio / region de origen" className={inputCls} />
          </FormField>
          <FormField label="CODIGO PROVEEDOR" hint="Provisional hasta tener catalogo">
            <input value={formLR.proveedor_codigo} onChange={e => setFormLR(f => ({ ...f, proveedor_codigo: e.target.value }))} placeholder="P007" className={inputCls} />
          </FormField>
          <div className="flex gap-2">
            <FormField label="CANTIDAD" className="flex-1">
              <input type="number" min="0" step="0.01" value={formLR.cantidad} onChange={e => setFormLR(f => ({ ...f, cantidad: e.target.value }))} placeholder="0" className={inputCls} />
            </FormField>
            <FormField label="UNIDAD" className="flex-1">
              <select value={formLR.unidad} onChange={e => setFormLR(f => ({ ...f, unidad: e.target.value }))} className={inputCls}>
                {UNIDAD_OPTS.map(u => <option key={u} value={u}>{u}</option>)}
              </select>
            </FormField>
          </div>
          <FormField label="CONDICION DEL VEHICULO">
            <input value={formLR.condicion_vehiculo} onChange={e => setFormLR(f => ({ ...f, condicion_vehiculo: e.target.value }))} placeholder="Limpio, sin contaminantes..." className={inputCls} />
          </FormField>
          <FormField label="RESULTADO">
            <select value={formLR.resultado} onChange={e => setFormLR(f => ({ ...f, resultado: e.target.value }))} className={inputCls}>
              {RESULTADO_OPTS.map(r => <option key={r} value={r}>{r.charAt(0).toUpperCase() + r.slice(1)}</option>)}
            </select>
          </FormField>
          <FormField label="RESPONSABLE">
            <input value={formLR.responsable} onChange={e => setFormLR(f => ({ ...f, responsable: e.target.value }))} placeholder="Nombre de quien recibe" className={inputCls} />
          </FormField>
          <FormField label="OBSERVACIONES">
            <textarea value={formLR.observaciones} onChange={e => setFormLR(f => ({ ...f, observaciones: e.target.value }))} rows={2} className={inputCls + ' resize-none'} />
          </FormField>
          <SaveBtn loading={guardando} onClick={handleGuardarLR} label="Registrar LR" />
        </BottomSheet>
      )}

      {/* ── Bottom Sheet: LPT ───────────────────────────────────────────── */}
      {sheetLPT && (
        <BottomSheet title="Nuevo Lote de Producto Terminado (LPT)" onClose={() => setSheetLPT(false)}>
          <div className="flex gap-2">
            <FormField label="FECHA EMPAQUE" className="flex-1">
              <input type="date" value={formLPT.fecha_empaque} onChange={e => setFormLPT(f => ({ ...f, fecha_empaque: e.target.value }))} className={inputCls} />
            </FormField>
            <FormField label="TURNO" className="w-24">
              <input type="number" min="1" value={formLPT.turno} onChange={e => setFormLPT(f => ({ ...f, turno: e.target.value }))} className={inputCls} />
            </FormField>
          </div>
          <FormField label="PRESENTACION">
            <input value={formLPT.presentacion} onChange={e => setFormLPT(f => ({ ...f, presentacion: e.target.value }))} placeholder="Coco natural 1 pza, Coco pelado 400g..." className={inputCls} />
          </FormField>
          <FormField label="TIPO DE ORIGEN">
            <div className="flex gap-2">
              {(['lr', 'lc'] as const).map(tipo => (
                <button key={tipo} onClick={() => setFormLPT(f => ({ ...f, origen_tipo: tipo }))}
                  className="flex-1 h-9 rounded-lg text-sm transition-colors"
                  style={{ fontWeight: 600, background: formLPT.origen_tipo === tipo ? 'var(--primary)' : 'var(--muted)', color: formLPT.origen_tipo === tipo ? '#fff' : 'var(--muted-foreground)' }}>
                  {tipo === 'lr' ? 'Lote de Recepcion (LR)' : 'Lote Compuesto (LC)'}
                </button>
              ))}
            </div>
          </FormField>
          {formLPT.origen_tipo === 'lr' ? (
            <FormField label="LOTE DE RECEPCION (LR) *">
              <select value={formLPT.lr_id} onChange={e => setFormLPT(f => ({ ...f, lr_id: e.target.value }))} className={inputCls}>
                <option value="">Seleccionar LR...</option>
                {lotesLR.map(lr => <option key={lr.id} value={lr.id}>{lr.codigo} — {lr.proveedor_nombre}</option>)}
              </select>
            </FormField>
          ) : (
            <FormField label="LOTE COMPUESTO (LC) *">
              <select value={formLPT.lc_id} onChange={e => setFormLPT(f => ({ ...f, lc_id: e.target.value }))} className={inputCls}>
                <option value="">Seleccionar LC...</option>
                {lotesLC.map(lc => <option key={lc.id} value={lc.id}>{lc.codigo}{lc.motivo ? ` — ${lc.motivo}` : ''}</option>)}
              </select>
            </FormField>
          )}
          <div className="flex gap-2">
            <FormField label="H. INICIO" className="flex-1">
              <input type="time" value={formLPT.hora_inicio} onChange={e => setFormLPT(f => ({ ...f, hora_inicio: e.target.value }))} className={inputCls} />
            </FormField>
            <FormField label="H. TERMINO" className="flex-1">
              <input type="time" value={formLPT.hora_termino} onChange={e => setFormLPT(f => ({ ...f, hora_termino: e.target.value }))} className={inputCls} />
            </FormField>
          </div>

          {/* Balance de masas */}
          <div className="rounded-xl p-3 space-y-2" style={{ background: 'var(--muted)' }}>
            <p className="text-xs" style={{ fontWeight: 700, color: 'var(--muted-foreground)' }}>BALANCE DE MASAS</p>
            <div className="flex gap-2">
              <FormField label="INGRESADA" className="flex-1">
                <input type="number" min="0" step="0.01" value={formLPT.cant_ingresada} onChange={e => setFormLPT(f => ({ ...f, cant_ingresada: e.target.value }))} className={inputCls} />
              </FormField>
              <FormField label="EMPACADA" className="flex-1">
                <input type="number" min="0" step="0.01" value={formLPT.cant_empacada} onChange={e => setFormLPT(f => ({ ...f, cant_empacada: e.target.value }))} className={inputCls} />
              </FormField>
            </div>
            <div className="flex gap-2">
              <FormField label="MERMA/RECHAZO" className="flex-1">
                <input type="number" min="0" step="0.01" value={formLPT.rechazo_merma} onChange={e => setFormLPT(f => ({ ...f, rechazo_merma: e.target.value }))} className={inputCls} />
              </FormField>
              <FormField label="PENDIENTE/RETENIDO" className="flex-1">
                <input type="number" min="0" step="0.01" value={formLPT.pendiente_retenido} onChange={e => setFormLPT(f => ({ ...f, pendiente_retenido: e.target.value }))} className={inputCls} />
              </FormField>
            </div>
            {ingresada > 0 && (
              <div className="rounded-lg px-3 py-1.5 text-xs" style={{ background: desequilibrio ? 'var(--agro-warning-fill)' : 'var(--agro-success-fill)', color: desequilibrio ? 'var(--agro-warning-text)' : 'var(--agro-success-text)' }}>
                {desequilibrio
                  ? `Diferencia: ${Math.abs(balanceSuma - ingresada).toFixed(2)} — toda diferencia no justificada debe investigarse (POE)`
                  : 'Balance correcto'}
              </div>
            )}
          </div>

          <FormField label="RESPONSABLE">
            <input value={formLPT.responsable} onChange={e => setFormLPT(f => ({ ...f, responsable: e.target.value }))} placeholder="Nombre del responsable de empaque" className={inputCls} />
          </FormField>
          <FormField label="OBSERVACIONES">
            <textarea value={formLPT.observaciones} onChange={e => setFormLPT(f => ({ ...f, observaciones: e.target.value }))} rows={2} className={inputCls + ' resize-none'} />
          </FormField>
          <SaveBtn loading={guardando} onClick={handleGuardarLPT} label="Registrar LPT" />
        </BottomSheet>
      )}

      {/* ── Bottom Sheet: LC ─────────────────────────────────────────────── */}
      {sheetLC && (
        <BottomSheet title="Nuevo Lote Compuesto (LC)" onClose={() => setSheetLC(false)}>
          <FormField label="FECHA">
            <input type="date" value={formLC.fecha} onChange={e => setFormLC(f => ({ ...f, fecha: e.target.value }))} className={inputCls} />
          </FormField>
          <FormField label="MOTIVO DE MEZCLA">
            <input value={formLC.motivo} onChange={e => setFormLC(f => ({ ...f, motivo: e.target.value }))} placeholder="Ej: Completar tarima, mezcla de turno..." className={inputCls} />
          </FormField>
          <FormField label="LOTES DE RECEPCION A INCLUIR (min. 2)">
            <div className="space-y-1 max-h-40 overflow-y-auto">
              {lotesLR.length === 0 ? (
                <p className="text-xs text-muted-foreground">Sin LR disponibles en esta {sTermino.toLowerCase()}</p>
              ) : lotesLR.map(lr => (
                <label key={lr.id} className="flex items-center gap-2 cursor-pointer">
                  <input
                    type="checkbox"
                    checked={formLC.lr_ids.includes(lr.id)}
                    onChange={() => toggleLRenLC(lr.id)}
                    className="rounded"
                  />
                  <span className="text-xs font-mono" style={{ color: 'var(--primary)' }}>{lr.codigo}</span>
                  <span className="text-xs text-muted-foreground">{lr.proveedor_nombre}</span>
                </label>
              ))}
            </div>
          </FormField>
          <FormField label="OBSERVACIONES">
            <textarea value={formLC.observaciones} onChange={e => setFormLC(f => ({ ...f, observaciones: e.target.value }))} rows={2} className={inputCls + ' resize-none'} />
          </FormField>
          <SaveBtn loading={guardando} onClick={handleGuardarLC} label="Registrar LC" />
        </BottomSheet>
      )}

      {/* ── Bottom Sheet: FE ─────────────────────────────────────────────── */}
      {sheetFE && (
        <BottomSheet title="Nuevo Folio de Embarque (FE)" onClose={() => setSheetFE(false)}>
          <FormField label="FECHA">
            <input type="date" value={formFE.fecha} onChange={e => setFormFE(f => ({ ...f, fecha: e.target.value }))} className={inputCls} />
          </FormField>
          <FormField label="CLIENTE / DESTINO">
            <input value={formFE.cliente} onChange={e => setFormFE(f => ({ ...f, cliente: e.target.value }))} placeholder="Nombre del cliente o destino" className={inputCls} />
          </FormField>
          <div className="flex gap-2">
            <FormField label="LINEA DE TRANSPORTE" className="flex-1">
              <input value={formFE.transporte_linea} onChange={e => setFormFE(f => ({ ...f, transporte_linea: e.target.value }))} className={inputCls} />
            </FormField>
            <FormField label="PLACAS" className="w-28">
              <input value={formFE.transporte_placas} onChange={e => setFormFE(f => ({ ...f, transporte_placas: e.target.value }))} className={inputCls} />
            </FormField>
          </div>
          <div className="flex gap-2">
            <FormField label="CAJA/REMOLQUE" className="flex-1">
              <input value={formFE.transporte_caja} onChange={e => setFormFE(f => ({ ...f, transporte_caja: e.target.value }))} className={inputCls} />
            </FormField>
            <FormField label="CHOFER" className="flex-1">
              <input value={formFE.chofer} onChange={e => setFormFE(f => ({ ...f, chofer: e.target.value }))} className={inputCls} />
            </FormField>
          </div>
          <FormField label="CONDICIONES DE LIMPIEZA">
            <input value={formFE.condiciones_limpieza} onChange={e => setFormFE(f => ({ ...f, condiciones_limpieza: e.target.value }))} placeholder="Limpio, aceptable..." className={inputCls} />
          </FormField>
          <div className="flex gap-2">
            <FormField label="SELLO" className="flex-1">
              <input value={formFE.sello} onChange={e => setFormFE(f => ({ ...f, sello: e.target.value }))} className={inputCls} />
            </FormField>
            <FormField label="EQUIPO TEMP." className="flex-1">
              <input value={formFE.equipo_temp} onChange={e => setFormFE(f => ({ ...f, equipo_temp: e.target.value }))} placeholder="°C / Estado" className={inputCls} />
            </FormField>
          </div>
          <FormField label="CONDICIONES DEL EMBARQUE">
            <input value={formFE.condiciones_embarque} onChange={e => setFormFE(f => ({ ...f, condiciones_embarque: e.target.value }))} className={inputCls} />
          </FormField>
          <FormField label="TOTAL EMBARCADO">
            <input type="number" min="0" step="0.01" value={formFE.total_embarcado} onChange={e => setFormFE(f => ({ ...f, total_embarcado: e.target.value }))} className={inputCls} />
          </FormField>

          {/* LPT lines */}
          <div>
            <p className="text-xs text-muted-foreground mb-2" style={{ fontWeight: 700 }}>LOTES DE PRODUCTO INCLUIDOS</p>
            {formFE.lineas.map((linea, idx) => (
              <div key={idx} className="flex gap-1 mb-2">
                <select
                  value={linea.lpt_id}
                  onChange={e => setFormFE(f => ({ ...f, lineas: f.lineas.map((l, i) => i === idx ? { ...l, lpt_id: e.target.value } : l) }))}
                  className="flex-1 h-9 px-2 rounded-lg bg-input-background border border-border text-xs focus:outline-none focus:border-primary"
                >
                  <option value="">LPT...</option>
                  {lotesLPT.map(lpt => <option key={lpt.id} value={lpt.id}>{lpt.codigo}</option>)}
                </select>
                <input
                  type="number" placeholder="Tarima" min="1"
                  value={linea.numero_tarima}
                  onChange={e => setFormFE(f => ({ ...f, lineas: f.lineas.map((l, i) => i === idx ? { ...l, numero_tarima: e.target.value } : l) }))}
                  className="w-16 h-9 px-2 rounded-lg bg-input-background border border-border text-xs focus:outline-none focus:border-primary"
                />
                <input
                  type="number" placeholder="Cant." min="0"
                  value={linea.cantidad}
                  onChange={e => setFormFE(f => ({ ...f, lineas: f.lineas.map((l, i) => i === idx ? { ...l, cantidad: e.target.value } : l) }))}
                  className="w-16 h-9 px-2 rounded-lg bg-input-background border border-border text-xs focus:outline-none focus:border-primary"
                />
                {formFE.lineas.length > 1 && (
                  <button onClick={() => setFormFE(f => ({ ...f, lineas: f.lineas.filter((_, i) => i !== idx) }))}
                    className="w-9 h-9 flex items-center justify-center text-muted-foreground">
                    <X className="w-3.5 h-3.5" />
                  </button>
                )}
              </div>
            ))}
            <button
              onClick={() => setFormFE(f => ({ ...f, lineas: [...f.lineas, { lpt_id: '', numero_tarima: '', cantidad: '', cliente: '' }] }))}
              className="text-xs px-3 py-1.5 rounded-lg"
              style={{ color: 'var(--primary)', background: 'var(--muted)' }}>
              + Agregar LPT
            </button>
          </div>

          <FormField label="OBSERVACIONES">
            <textarea value={formFE.observaciones} onChange={e => setFormFE(f => ({ ...f, observaciones: e.target.value }))} rows={2} className={inputCls + ' resize-none'} />
          </FormField>
          <SaveBtn loading={guardando} onClick={handleGuardarFE} label="Registrar FE" />
        </BottomSheet>
      )}

      {/* ── Modal: Vista previa de etiqueta 4x8 ─────────────────────────── */}
      {previewInfo && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center p-4"
          style={{ background: 'rgba(0,0,0,0.7)' }}
          onClick={() => setPreviewInfo(null)}
        >
          <div
            onClick={e => e.stopPropagation()}
            style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 10 }}
          >
            <button onClick={() => setPreviewInfo(null)} style={{ alignSelf: 'flex-end', color: '#fff', padding: 4 }}>
              <X className="w-5 h-5" />
            </button>
            {/* Container clipped to scaled size; inner div holds the real mm layout */}
            <div style={{ width: 258, height: 514, overflow: 'hidden', borderRadius: 8, boxShadow: '0 4px 32px rgba(0,0,0,0.5)' }}>
              <div style={{ transform: 'scale(0.67)', transformOrigin: 'top left', width: 385, height: 768, background: '#fff', fontFamily: 'Arial, Helvetica, sans-serif', padding: 0, boxSizing: 'border-box', display: 'flex', flexDirection: 'column' }}>
                <EtiquetaContent d={previewInfo} />
              </div>
            </div>
            <p style={{ color: 'rgba(255,255,255,0.55)', fontSize: 11, margin: 0 }}>
              Vista previa — proporcional 102×203 mm
            </p>
          </div>
        </div>
      )}


      {/* ── Bottom Sheet: Etiqueta ───────────────────────────────────────── */}
      {sheetEtiqueta && (
        <BottomSheet title={`Etiqueta ${sheetEtiqueta.lpt.codigo}`} onClose={() => setSheetEtiqueta(null)}>
          <div className="rounded-xl p-3 mb-2" style={{ background: 'var(--agro-success-fill)' }}>
            <p className="text-xs" style={{ color: 'var(--agro-success-text)', fontWeight: 600 }}>
              {sheetEtiqueta.lpt.presentacion ?? '—'} · Turno {sheetEtiqueta.lpt.turno} · {fmtFecha(sheetEtiqueta.lpt.fecha_empaque)}
            </p>
            {sheetEtiqueta.lpt.lr_codigo && <p className="text-xs mt-0.5" style={{ color: 'var(--agro-success-text)' }}>LR: {sheetEtiqueta.lpt.lr_codigo}</p>}
            {sheetEtiqueta.lpt.lc_codigo && <p className="text-xs mt-0.5" style={{ color: 'var(--agro-success-text)' }}>LC: {sheetEtiqueta.lpt.lc_codigo}</p>}
          </div>
          <p className="text-xs text-muted-foreground mb-3">
            Al generar o imprimir se registra la liberacion del producto (POE-COCO-CAL-13).
          </p>
          <FormField label="VERIFICADO POR *">
            <input value={formEtiqueta.verificado_por} onChange={e => setFormEtiqueta(f => ({ ...f, verificado_por: e.target.value }))} placeholder="Nombre del responsable de calidad" className={inputCls} />
          </FormField>
          <FormField label="CANTIDAD DE ETIQUETAS">
            <input type="number" min="1" value={formEtiqueta.cantidad_etiquetas} onChange={e => setFormEtiqueta(f => ({ ...f, cantidad_etiquetas: e.target.value }))} className={inputCls} />
          </FormField>
          <SaveBtn loading={guardando} onClick={handleImprimirEtiqueta} label="Imprimir etiqueta" icon={<Printer className="w-4 h-4" />} />
          <SaveBtn loading={guardando} onClick={handleGenerarEtiqueta} label="Generar etiqueta (PDF)" secondary />
          <p className="text-xs text-center" style={{ color: 'var(--muted-foreground)' }}>
            Al imprimir: elige "Tamano real / 100%" (sin ajustar a pagina) en el dialogo.
          </p>
        </BottomSheet>
      )}
    </div>
  )
}

// ── Sub-componentes ───────────────────────────────────────────────────────────

const inputCls = 'w-full h-10 px-3 rounded-lg bg-input-background border border-border text-sm focus:outline-none focus:border-primary focus:ring-1 focus:ring-primary'

function FormField({ label, hint, children, className }: { label: string; hint?: string; children: React.ReactNode; className?: string }) {
  return (
    <div className={className}>
      <label className="block text-xs text-muted-foreground mb-1.5" style={{ fontWeight: 600 }}>{label}</label>
      {hint && <p className="text-xs text-muted-foreground mb-1">{hint}</p>}
      {children}
    </div>
  )
}

function SaveBtn({ loading, onClick, label, secondary, icon }: { loading: boolean; onClick: () => void; label: string; secondary?: boolean; icon?: React.ReactNode }) {
  return (
    <button
      onClick={onClick} disabled={loading}
      className="w-full h-12 rounded-3xl text-sm flex items-center justify-center gap-2 disabled:opacity-50 transition-colors"
      style={{ fontWeight: 600, background: secondary ? 'var(--muted)' : 'var(--primary)', color: secondary ? 'var(--primary)' : '#fff' }}
    >
      {loading ? <Loader2 className="w-4 h-4 animate-spin" /> : icon}
      {label}
    </button>
  )
}

function BottomSheet({ title, onClose, children }: { title: string; onClose: () => void; children: React.ReactNode }) {
  return (
    <>
      <div className="fixed inset-0 bg-black/40 z-30" onClick={onClose} />
      <div
        className="fixed bottom-0 left-0 right-0 z-40 bg-card flex flex-col overflow-hidden"
        style={{ height: '85%', borderRadius: '0.625rem 0.625rem 0 0', maxWidth: 390, margin: '0 auto' }}
      >
        <div className="flex justify-center pt-3 pb-1 flex-shrink-0">
          <div className="w-10 h-1 rounded-full bg-border" />
        </div>
        <div className="flex items-center justify-between px-4 py-3 border-b border-border flex-shrink-0">
          <h2 className="text-base text-foreground" style={{ fontWeight: 600 }}>{title}</h2>
          <button onClick={onClose} className="p-1"><X className="w-5 h-5 text-muted-foreground" /></button>
        </div>
        <div className="flex-1 overflow-y-auto p-4 space-y-4">{children}</div>
      </div>
    </>
  )
}

function TrazabilidadResultado({ nodo }: { nodo: TrazabilidadNodo }) {
  const { tipo, registro } = nodo
  return (
    <div className="space-y-3">
      {/* Nodo principal */}
      <div className="bg-card border border-border rounded-xl p-4">
        <p className="text-xs text-muted-foreground mb-1" style={{ fontWeight: 700 }}>TIPO: {tipo}</p>
        <p className="text-base font-mono" style={{ fontWeight: 700, color: 'var(--primary)' }}>{registro.codigo}</p>
        {tipo === 'LR' && (
          <div className="mt-2 space-y-1 text-xs text-muted-foreground">
            <p>Proveedor: <span className="text-foreground">{registro.proveedor_nombre}</span></p>
            {registro.proveedor_origen && <p>Origen: {registro.proveedor_origen}</p>}
            <p>Fecha: {registro.fecha ? `${registro.fecha.split('-').reverse().join('/')}` : '—'}</p>
            {registro.cantidad && <p>Cantidad: {registro.cantidad} {registro.unidad ?? ''}</p>}
            {registro.resultado && <p>Resultado: {registro.resultado}</p>}
          </div>
        )}
        {tipo === 'LPT' && (
          <div className="mt-2 space-y-1 text-xs text-muted-foreground">
            <p>Presentacion: <span className="text-foreground">{registro.presentacion ?? '—'}</span></p>
            <p>Fecha empaque: {registro.fecha_empaque?.split('-').reverse().join('/') ?? '—'} · Turno {registro.turno}</p>
            {registro.cant_empacada != null && <p>Empacado: {registro.cant_empacada}</p>}
          </div>
        )}
        {tipo === 'LC' && (
          <div className="mt-2 space-y-1 text-xs text-muted-foreground">
            <p>Fecha: {registro.fecha?.split('-').reverse().join('/') ?? '—'}</p>
            {registro.motivo && <p>Motivo: {registro.motivo}</p>}
          </div>
        )}
        {tipo === 'FE' && (
          <div className="mt-2 space-y-1 text-xs text-muted-foreground">
            <p>Fecha: {registro.fecha?.split('-').reverse().join('/') ?? '—'}</p>
            {registro.cliente && <p>Cliente: <span className="text-foreground">{registro.cliente}</span></p>}
            {registro.transporte_placas && <p>Placas: {registro.transporte_placas}</p>}
            {registro.total_embarcado && <p>Total embarcado: {registro.total_embarcado}</p>}
          </div>
        )}
      </div>

      {/* Origen (para LPT) */}
      {nodo.origen && (
        <TrazSection title="Origen" icon="←">
          <TrazChip label={nodo.origen.tipo} code={(nodo.origen.registro as any).codigo} />
          {nodo.origen.tipo === 'LR' && (
            <p className="text-xs text-muted-foreground mt-1">
              Proveedor: {(nodo.origen.registro as any).proveedor_nombre}{' '}
              {(nodo.origen.registro as any).proveedor_origen ? `· ${(nodo.origen.registro as any).proveedor_origen}` : ''}
            </p>
          )}
          {nodo.origen.tipo === 'LC' && nodo.origen.lrs && (
            <div className="mt-1 space-y-1">
              {nodo.origen.lrs.map((lr: any) => <TrazChip key={lr.id} label="LR" code={lr.codigo} sub={lr.proveedor_nombre} />)}
            </div>
          )}
        </TrazSection>
      )}

      {/* LRs componentes (para LC) */}
      {nodo.lrs && nodo.lrs.length > 0 && (
        <TrazSection title="Lotes de Recepcion incluidos" icon="←">
          {nodo.lrs.map((lr: any) => <TrazChip key={lr.id} label="LR" code={lr.codigo} sub={lr.proveedor_nombre} />)}
        </TrazSection>
      )}

      {/* LPTs generados (para LR o LC) */}
      {nodo.lpts && nodo.lpts.length > 0 && (
        <TrazSection title="Lotes de Producto Terminado generados" icon="→">
          {nodo.lpts.map((lpt: any) => (
            <TrazChip key={lpt.id} label="LPT" code={lpt.codigo} sub={`${lpt.presentacion ?? ''} · T${lpt.turno}`} />
          ))}
        </TrazSection>
      )}

      {/* Folios de embarque */}
      {nodo.folios && nodo.folios.length > 0 && (
        <TrazSection title="Folios de Embarque" icon="→">
          {nodo.folios.map((fe: any) => (
            <TrazChip key={fe.id} label="FE" code={fe.codigo} sub={fe.cliente ?? ''} />
          ))}
        </TrazSection>
      )}

      {/* LPTs en FE */}
      {nodo.lptsDeFe && nodo.lptsDeFe.length > 0 && (
        <TrazSection title="Lotes de Producto incluidos" icon="←">
          {nodo.lptsDeFe.map((rel: any) => (
            <TrazChip key={rel.lpt_id} label="LPT" code={rel.lpt_codigo}
              sub={`${rel.lpt?.presentacion ?? ''} · T${rel.lpt?.turno ?? ''} · ${rel.cantidad ?? ''} uds`} />
          ))}
        </TrazSection>
      )}
    </div>
  )
}

function TrazSection({ title, icon, children }: { title: string; icon: string; children: React.ReactNode }) {
  return (
    <div className="bg-card border border-border rounded-xl p-3">
      <p className="text-xs mb-2" style={{ fontWeight: 700, color: 'var(--muted-foreground)' }}>{icon} {title.toUpperCase()}</p>
      <div className="space-y-1.5">{children}</div>
    </div>
  )
}

function TrazChip({ label, code, sub }: { label: string; code: string; sub?: string }) {
  return (
    <div className="flex items-start gap-2">
      <span className="text-xs px-1.5 py-0.5 rounded" style={{ background: 'var(--primary)', color: '#fff', fontWeight: 700, flexShrink: 0 }}>{label}</span>
      <div className="min-w-0">
        <span className="text-xs font-mono" style={{ fontWeight: 600, color: 'var(--primary)' }}>{code}</span>
        {sub && <p className="text-xs text-muted-foreground">{sub}</p>}
      </div>
    </div>
  )
}

const BD_HTML = '1px solid #2a2a2a'

function Cel({ label, value, border, small }: { label: string; value: string; border?: boolean; small?: boolean }) {
  return (
    <div style={{ flex: 1, padding: '1.5mm 2mm', ...(border ? { borderRight: BD_HTML } : {}) }}>
      <div style={{ fontSize: '5.5pt', fontWeight: 700, color: '#555', marginBottom: '0.8mm', letterSpacing: '0.04em' }}>{label}</div>
      <div style={{ fontSize: small ? '6.5pt' : '8pt', fontWeight: 700, color: '#111', lineHeight: 1.2 }}>{value}</div>
    </div>
  )
}

function EtiquetaContent({ d }: { d: PrintData }) {
  const origenLabel = d.origenTipo ? `LR/LC (${d.origenTipo})` : 'LR / LC'
  return (
    <div style={{ display: 'flex', flexDirection: 'column', border: BD_HTML, flex: 1 }}>

      {/* Header: logo cliente | titulo */}
      <div style={{ display: 'flex', flexDirection: 'row', height: '18mm', borderBottom: BD_HTML, flexShrink: 0 }}>
        <div style={{ width: '26mm', display: 'flex', alignItems: 'center', justifyContent: 'center', borderRight: BD_HTML, padding: '1.5mm' }}>
          <img
            src="/images/logo-los-gemelos.png"
            alt="Logo"
            style={{ maxWidth: '22mm', maxHeight: '14mm', objectFit: 'contain' }}
            onError={(e: any) => { e.target.style.display = 'none' }}
          />
        </div>
        <div style={{ flex: 1, display: 'flex', flexDirection: 'column', justifyContent: 'center', padding: '2mm 3mm' }}>
          <div style={{ fontSize: '9.5pt', fontWeight: 800, color: '#111', marginBottom: '1mm' }}>Etiqueta de trazabilidad</div>
          <div style={{ fontSize: '7.5pt', color: '#444' }}>{d.orgNombre}</div>
        </div>
      </div>

      {/* Fila 1: Producto | Presentacion | Turno */}
      <div style={{ display: 'flex', flexDirection: 'row', height: '13mm', borderBottom: BD_HTML, flexShrink: 0 }}>
        <Cel label="PRODUCTO" value={d.producto} border />
        <Cel label="PRESENTACION" value={d.presentacion ?? 'Caja / segun cliente'} border small />
        <Cel label="TURNO" value={`T${d.turno}`} />
      </div>

      {/* Fila 2: Fecha empaque | LR/LC | Proveedor */}
      <div style={{ display: 'flex', flexDirection: 'row', height: '13mm', borderBottom: BD_HTML, flexShrink: 0 }}>
        <Cel label="FECHA DE EMPAQUE" value={fmtFecha(d.fechaEmpaque)} border />
        <Cel label={origenLabel} value={d.origenCodigo ?? '—'} border small />
        <Cel label="ORIGEN / PROVEEDOR" value={d.proveedorCodigo ?? '—'} />
      </div>

      {/* Fila 3: LPT en grande | Cliente/destino */}
      <div style={{ display: 'flex', flexDirection: 'row', height: '18mm', borderBottom: BD_HTML, flexShrink: 0 }}>
        <div style={{ flex: 3, padding: '2mm', borderRight: BD_HTML, display: 'flex', flexDirection: 'column', justifyContent: 'center' }}>
          <div style={{ fontSize: '5.5pt', fontWeight: 700, color: '#555', marginBottom: '1.5mm', letterSpacing: '0.04em' }}>LOTE DE PRODUCTO TERMINADO</div>
          <div style={{ fontSize: '11pt', fontWeight: 800, color: '#111', lineHeight: 1.1 }}>{d.lptCodigo}</div>
        </div>
        <div style={{ flex: 2, padding: '2mm', display: 'flex', flexDirection: 'column', justifyContent: 'center' }}>
          <div style={{ fontSize: '5.5pt', fontWeight: 700, color: '#555', marginBottom: '1.5mm', letterSpacing: '0.04em' }}>CLIENTE / DESTINO</div>
          <div style={{ fontSize: '7pt', fontWeight: 700, color: '#111' }}>{d.clienteDestino}</div>
        </div>
      </div>

      {/* Seccion QR */}
      <div style={{ flex: 1, display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', padding: '3mm' }}>
        <div style={{ fontSize: '6.5pt', fontWeight: 700, color: '#555', letterSpacing: '0.05em', marginBottom: '2mm' }}>CODIGO VISUAL DEL LOTE</div>
        <img src={d.qrDataUrl} style={{ width: '58mm', height: '58mm' }} alt="" />
        <div style={{ fontSize: '7.5pt', fontWeight: 800, color: '#111', marginTop: '2mm', textAlign: 'center' }}>{d.lptCodigo}</div>
      </div>

    </div>
  )
}
