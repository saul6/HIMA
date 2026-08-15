import { useState, useEffect, useCallback, useMemo } from 'react'
import {
  ChevronLeft, Plus, FileDown, Loader2, PackageOpen,
  TriangleAlert, X, Settings, ChevronDown, ChevronUp,
} from 'lucide-react'
import { Link } from 'react-router'
import { BottomSheet } from '@/app/components/BottomSheet'
import { toast } from 'sonner'
import { useAuthContext } from '@/context/AuthContext'
import { codigoFormato } from '@/lib/codigoFormato'
import { useModulosContext } from '@/context/ModulosContext'
import { useRanchos } from '@/hooks/useRanchos'
import {
  useM33LimpiezaRecepcion,
  useM33Items,
  type M33RegistroResumen,
  type M33Item,
  type ValorM33,
} from '@/hooks/useM33LimpiezaRecepcion'
import { supabase } from '@/lib/supabase'
import { generarLimpiezaRecepcionPDF } from '@/lib/pdf/m33/generarLimpiezaRecepcionPDF'
import { generarLimpiezaRecepcionConsolidadoPDF } from '@/lib/pdf/m33/generarLimpiezaRecepcionConsolidadoPDF'
import type { M33ItemPDF, M33DiaDataPDF, ValorM33PDF } from '@/lib/pdf/m33/LimpiezaRecepcionPDF'

const tbl = (name: string) => (supabase as any).from(name)

const PLANTILLA_ESTANDAR: { nombre: string; frecuencia: string; orden: number }[] = [
  { nombre: 'Mesas de inspección',                            frecuencia: 'diario',   orden: 1  },
  { nombre: 'Mesas, sillas, accesorios y equipos electrónicos', frecuencia: 'diario', orden: 2  },
  { nombre: 'Puertas',                                        frecuencia: 'semanal',  orden: 3  },
  { nombre: 'Cortinas hawaianas y mallasombra',               frecuencia: 'semanal',  orden: 4  },
  { nombre: 'Techos',                                         frecuencia: 'mensual',  orden: 5  },
  { nombre: 'Lámparas',                                       frecuencia: 'mensual',  orden: 6  },
  { nombre: 'Paredes',                                        frecuencia: 'semanal',  orden: 7  },
  { nombre: 'Botiquín',                                       frecuencia: 'mensual',  orden: 8  },
  { nombre: 'Desagüe',                                        frecuencia: 'diario',   orden: 9  },
  { nombre: 'Pisos',                                          frecuencia: 'diario',   orden: 10 },
  { nombre: 'Patines',                                        frecuencia: 'semanal',  orden: 11 },
]

const FRECUENCIA_OPTS = [
  { label: 'Diario',     value: 'diario'     },
  { label: 'Tercer día', value: 'tercer_dia' },
  { label: 'Semanal',    value: 'semanal'    },
  { label: 'Quincenal',  value: 'quincenal'  },
  { label: 'Mensual',    value: 'mensual'    },
  { label: '6 meses',    value: 'semestral'  },
]

const FRECUENCIA_LABELS: Record<string, string> = {
  diario: 'Diario', tercer_dia: 'Tercer día', semanal: 'Semanal',
  quincenal: 'Quincenal', mensual: 'Mensual', semestral: '6 meses',
}

const MESES = ['Enero','Febrero','Marzo','Abril','Mayo','Junio','Julio','Agosto','Septiembre','Octubre','Noviembre','Diciembre']

type Vista = 'lista' | 'detalle'

interface DiaDataLocal {
  concentracion_cloro: number | null
  ajuste_cloro: number | null
  concentracion_acido: number | null
  ajuste_acido: number | null
  realizo: string | null
  aprobo: string | null
}

function mesActual(): string {
  const d = new Date()
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`
}

function formatMesLabel(anio: number, mes: number): string {
  try {
    const label = new Date(anio, mes - 1, 1).toLocaleDateString('es-MX', { month: 'long', year: 'numeric' })
    return label.charAt(0).toUpperCase() + label.slice(1)
  } catch { return `${mes}/${anio}` }
}

function frecuenciaLabel(f: string): string {
  return FRECUENCIA_LABELS[f] ?? f
}

export function LimpiezaRecepcion() {
  const { profile, codigoClave } = useAuthContext()
  const { terminosSitio } = useModulosContext()
  const { ranchos } = useRanchos()
  const { registros, loading, error, refetch } = useM33LimpiezaRecepcion()
  const orgId = profile?.org_id ?? null
  const termino = terminosSitio.singular

  const [vista, setVista] = useState<Vista>('lista')
  const [registroActivo, setRegistroActivo] = useState<M33RegistroResumen | null>(null)
  const [diaSeleccionado, setDiaSeleccionado] = useState(1)

  const [resultados, setResultados] = useState<Record<number, Record<string, ValorM33>>>({})
  const [diasData, setDiasData] = useState<Record<number, DiaDataLocal>>({})
  const [loadingDetalle, setLoadingDetalle] = useState(false)
  const [obsLocal, setObsLocal] = useState('')
  const [savingObs, setSavingObs] = useState(false)
  const [togglingCells, setTogglingCells] = useState<Set<string>>(new Set())

  const detalleRanchoId = registroActivo?.rancho_id ?? null
  const { items, refetch: refetchItems } = useM33Items(detalleRanchoId, orgId)
  const activeItems = useMemo(() => items.filter((i) => i.activo), [items])

  const numDias = registroActivo ? new Date(registroActivo.anio, registroActivo.mes, 0).getDate() : 0
  const days = useMemo(() => Array.from({ length: numDias }, (_, i) => i + 1), [numDias])

  const diasConDatos = useMemo(() => {
    const s = new Set<number>()
    for (const d of Object.keys(resultados).map(Number)) {
      if (Object.keys(resultados[d] ?? {}).length > 0) s.add(d)
    }
    for (const d of Object.keys(diasData).map(Number)) s.add(d)
    return s
  }, [resultados, diasData])

  const [diaConcCloro, setDiaConcCloro] = useState('')
  const [diaAjCloro, setDiaAjCloro] = useState('')
  const [diaConcAcido, setDiaConcAcido] = useState('')
  const [diaAjAcido, setDiaAjAcido] = useState('')
  const [diaRealizo, setDiaRealizo] = useState('')
  const [diaAprobo, setDiaAprobo] = useState('')
  const [diaSaving, setDiaSaving] = useState(false)

  useEffect(() => {
    if (vista !== 'detalle') return
    const d = diasData[diaSeleccionado]
    setDiaConcCloro(d?.concentracion_cloro != null ? String(d.concentracion_cloro) : '')
    setDiaAjCloro(d?.ajuste_cloro != null ? String(d.ajuste_cloro) : '')
    setDiaConcAcido(d?.concentracion_acido != null ? String(d.concentracion_acido) : '')
    setDiaAjAcido(d?.ajuste_acido != null ? String(d.ajuste_acido) : '')
    setDiaRealizo(d?.realizo ?? '')
    setDiaAprobo(d?.aprobo ?? '')
  }, [diaSeleccionado, diasData, vista])

  const [mostrarResumen, setMostrarResumen] = useState(false)

  const resumenItems = useMemo(() => activeItems.map((item) => {
    let hecho = 0, noHecho = 0, na = 0
    for (const d of days) {
      const v = resultados[d]?.[item.id]
      if (v === 'hecho') hecho++
      else if (v === 'no_hecho') noHecho++
      else if (v === 'na') na++
    }
    return { item, hecho, noHecho, na }
  }), [activeItems, resultados, days])

  const cargarDetalle = useCallback(async (regId: string) => {
    if (!orgId) return
    setLoadingDetalle(true)
    try {
      const [resultadosRes, diasRes] = await Promise.all([
        tbl('m33_resultados').select('item_id, dia, valor').eq('registro_id', regId).eq('org_id', orgId),
        tbl('m33_dias').select('*').eq('registro_id', regId),
      ])
      if (resultadosRes.error) throw resultadosRes.error
      if (diasRes.error) throw diasRes.error

      const res: Record<number, Record<string, ValorM33>> = {}
      for (const r of (resultadosRes.data ?? []) as any[]) {
        if (!res[r.dia]) res[r.dia] = {}
        res[r.dia][r.item_id] = r.valor as ValorM33
      }
      setResultados(res)

      const dd: Record<number, DiaDataLocal> = {}
      for (const d of (diasRes.data ?? []) as any[]) {
        dd[d.dia] = {
          concentracion_cloro: d.concentracion_cloro ?? null,
          ajuste_cloro: d.ajuste_cloro ?? null,
          concentracion_acido: d.concentracion_acido ?? null,
          ajuste_acido: d.ajuste_acido ?? null,
          realizo: d.realizo ?? null,
          aprobo: d.aprobo ?? null,
        }
      }
      setDiasData(dd)
    } catch (e: unknown) {
      toast.error(e instanceof Error ? e.message : 'Error al cargar detalle')
    } finally {
      setLoadingDetalle(false)
    }
  }, [orgId])

  const abrirDetalle = (reg: M33RegistroResumen) => {
    setRegistroActivo(reg)
    setObsLocal(reg.observaciones ?? '')
    setResultados({})
    setDiasData({})
    const totalDias = new Date(reg.anio, reg.mes, 0).getDate()
    const now = new Date()
    const esEsteMes = reg.anio === now.getFullYear() && reg.mes === now.getMonth() + 1
    setDiaSeleccionado(esEsteMes ? Math.min(now.getDate(), totalDias) : 1)
    setVista('detalle')
    cargarDetalle(reg.id)
  }

  const volverALista = () => {
    setVista('lista')
    setRegistroActivo(null)
    setResultados({})
    setDiasData({})
  }

  async function handleGuardarObs() {
    if (!registroActivo || !orgId) return
    setSavingObs(true)
    try {
      const { error: e } = await tbl('m33_registro_mensual')
        .update({ observaciones: obsLocal || null })
        .eq('id', registroActivo.id)
        .eq('org_id', orgId)
      if (e) throw e
      toast.success('Observaciones guardadas')
    } catch (e: unknown) {
      toast.error(e instanceof Error ? e.message : 'Error al guardar')
    } finally {
      setSavingObs(false)
    }
  }

  async function handleSetValor(itemId: string, dia: number, valor: ValorM33) {
    if (!registroActivo || !orgId) return
    const cellKey = `${dia}|${itemId}`
    if (togglingCells.has(cellKey)) return
    const current = resultados[dia]?.[itemId]
    setTogglingCells((prev) => new Set(prev).add(cellKey))
    try {
      if (current === valor) {
        const { error: e } = await tbl('m33_resultados')
          .delete()
          .eq('registro_id', registroActivo.id)
          .eq('item_id', itemId)
          .eq('dia', dia)
          .eq('org_id', orgId)
        if (e) throw e
        setResultados((prev) => {
          const copy = { ...prev }
          if (copy[dia]) {
            const dayMap = { ...copy[dia] }
            delete dayMap[itemId]
            copy[dia] = dayMap
          }
          return copy
        })
      } else {
        const { error: e } = await tbl('m33_resultados')
          .upsert(
            { registro_id: registroActivo.id, item_id: itemId, dia, org_id: orgId, valor },
            { onConflict: 'registro_id,item_id,dia' }
          )
        if (e) throw e
        setResultados((prev) => ({
          ...prev,
          [dia]: { ...(prev[dia] ?? {}), [itemId]: valor },
        }))
      }
    } catch (e: unknown) {
      toast.error(e instanceof Error ? e.message : 'Error al guardar resultado')
    } finally {
      setTogglingCells((prev) => {
        const s = new Set(prev)
        s.delete(cellKey)
        return s
      })
    }
  }

  async function handleGuardarDia() {
    if (!registroActivo || !orgId) return
    setDiaSaving(true)
    try {
      const payload: any = {
        registro_id: registroActivo.id,
        dia: diaSeleccionado,
        concentracion_cloro: diaConcCloro !== '' ? parseFloat(diaConcCloro) : null,
        ajuste_cloro: diaAjCloro !== '' ? parseFloat(diaAjCloro) : null,
        concentracion_acido: diaConcAcido !== '' ? parseFloat(diaConcAcido) : null,
        ajuste_acido: diaAjAcido !== '' ? parseFloat(diaAjAcido) : null,
        realizo: diaRealizo.trim() || null,
        aprobo: diaAprobo.trim() || null,
      }
      const { error: e } = await tbl('m33_dias')
        .upsert(payload, { onConflict: 'registro_id,dia' })
      if (e) throw e
      setDiasData((prev) => ({
        ...prev,
        [diaSeleccionado]: {
          concentracion_cloro: payload.concentracion_cloro,
          ajuste_cloro: payload.ajuste_cloro,
          concentracion_acido: payload.concentracion_acido,
          ajuste_acido: payload.ajuste_acido,
          realizo: payload.realizo,
          aprobo: payload.aprobo,
        },
      }))
      toast.success(`Día ${diaSeleccionado} guardado`)
    } catch (e: unknown) {
      toast.error(e instanceof Error ? e.message : 'Error al guardar día')
    } finally {
      setDiaSaving(false)
    }
  }

  // ── Sheet: nuevo registro ─────────────────────────────────────────────────────
  const [sheetNuevo, setSheetNuevo] = useState(false)
  const [nRanchoId, setNRanchoId] = useState('')
  const [nAnio, setNAnio] = useState(new Date().getFullYear())
  const [nMes, setNMes] = useState(new Date().getMonth() + 1)
  const [nGuardando, setNGuardando] = useState(false)
  const [nErrRancho, setNErrRancho] = useState(false)

  async function handleCrearRegistro() {
    if (!nRanchoId) { setNErrRancho(true); return }
    if (!orgId) { toast.error('Sin organización activa'); return }
    setNGuardando(true)
    try {
      const { data, error: e } = await tbl('m33_registro_mensual')
        .insert({ rancho_id: nRanchoId, org_id: orgId, anio: nAnio, mes: nMes, area: 'Área de recepción' })
        .select('*, ranchos(nombre)')
        .single()
      if (e) throw e
      toast.success('Registro mensual creado')
      setSheetNuevo(false)
      await refetch()
      const r = data as any
      const nuevo: M33RegistroResumen = {
        id: r.id, rancho_id: r.rancho_id,
        rancho_nombre: r.ranchos?.nombre ?? '—',
        anio: r.anio, mes: r.mes, area: r.area ?? 'Área de recepción',
        observaciones: null,
      }
      abrirDetalle(nuevo)
    } catch (e: unknown) {
      const msg = e instanceof Error ? e.message : 'Error al crear registro'
      if (msg.includes('23505') || msg.includes('unique') || msg.includes('duplicate')) {
        toast.warning('Ya existe un registro para ese mes e instalación')
      } else {
        toast.error(msg)
      }
    } finally {
      setNGuardando(false)
    }
  }

  // ── Sheet: configurar catálogo ────────────────────────────────────────────────
  const [sheetConfigurar, setSheetConfigurar] = useState(false)
  const [catRanchoId, setCatRanchoId] = useState('')
  const [catNombre, setCatNombre] = useState('')
  const [catFrecuencia, setCatFrecuencia] = useState('diario')
  const [catAgregando, setCatAgregando] = useState(false)
  const [catCargandoPlantilla, setCatCargandoPlantilla] = useState(false)
  const [catToggling, setCatToggling] = useState<string | null>(null)

  const { items: itemsGestion, loading: loadingGestion, refetch: refetchGestion } = useM33Items(
    catRanchoId || null, orgId
  )

  function abrirConfigurar() {
    setCatRanchoId(registroActivo?.rancho_id ?? '')
    setCatNombre('')
    setCatFrecuencia('diario')
    setSheetConfigurar(true)
  }

  async function handleAgregarItem() {
    if (!catRanchoId || !orgId) { toast.error(`Selecciona una ${termino}`); return }
    if (!catNombre.trim()) { toast.error('Ingresa el nombre de la actividad'); return }
    setCatAgregando(true)
    try {
      const maxOrden = itemsGestion.reduce((m, i) => Math.max(m, i.orden), 0)
      const { error: e } = await tbl('m33_items').insert({
        org_id: orgId, rancho_id: catRanchoId,
        nombre: catNombre.trim(), frecuencia: catFrecuencia,
        activo: true, orden: maxOrden + 1,
      })
      if (e) {
        if (e.message.includes('23505') || e.message.includes('unique') || e.message.includes('duplicate')) {
          toast.warning('Ya existe ese ítem para esta instalación')
        } else throw e
      } else {
        setCatNombre('')
        toast.success('Ítem agregado')
        refetchGestion()
        if (registroActivo?.rancho_id === catRanchoId) refetchItems()
      }
    } catch (e: unknown) {
      toast.error(e instanceof Error ? e.message : 'Error al agregar ítem')
    } finally {
      setCatAgregando(false)
    }
  }

  async function handleToggleActivo(item: M33Item) {
    if (!orgId) return
    setCatToggling(item.id)
    try {
      const { error: e } = await tbl('m33_items')
        .update({ activo: !item.activo })
        .eq('id', item.id).eq('org_id', orgId)
      if (e) throw e
      refetchGestion()
      if (registroActivo?.rancho_id === catRanchoId) refetchItems()
    } catch (e: unknown) {
      toast.error(e instanceof Error ? e.message : 'Error al actualizar')
    } finally {
      setCatToggling(null)
    }
  }

  async function handleCargarPlantilla() {
    if (!catRanchoId || !orgId) { toast.error(`Selecciona una ${termino}`); return }
    setCatCargandoPlantilla(true)
    try {
      const rows = PLANTILLA_ESTANDAR.map((item) => ({
        org_id: orgId, rancho_id: catRanchoId,
        nombre: item.nombre, frecuencia: item.frecuencia,
        activo: true, orden: item.orden,
      }))
      const { error: e } = await tbl('m33_items')
        .upsert(rows, { onConflict: 'rancho_id,nombre', ignoreDuplicates: true })
      if (e) throw e
      toast.success('11 ítems estándar cargados')
      refetchGestion()
      if (registroActivo?.rancho_id === catRanchoId) refetchItems()
    } catch (e: unknown) {
      const msg = e instanceof Error ? e.message : 'Error desconocido'
      toast.error(`Error al sembrar plantilla: ${msg}`)
    } finally {
      setCatCargandoPlantilla(false)
    }
  }

  // ── Sheet: consolidado ────────────────────────────────────────────────────────
  const [sheetConsolidado, setSheetConsolidado] = useState(false)
  const [cRanchoId, setCRanchoId] = useState('')
  const [cDesde, setCDesde] = useState(mesActual())
  const [cHasta, setCHasta] = useState(mesActual())
  const [cGenerando, setCGenerando] = useState(false)
  const [cErrRancho, setCErrRancho] = useState(false)

  async function handleConsolidado() {
    if (!cRanchoId) { setCErrRancho(true); return }
    if (!orgId) { toast.error('Sin organización activa'); return }
    setCGenerando(true)
    try {
      const instalacionNombre = ranchos.find((r) => r.id === cRanchoId)?.nombre ?? cRanchoId
      await generarLimpiezaRecepcionConsolidadoPDF(cRanchoId, instalacionNombre, orgId, cDesde, cHasta)
      toast.success('PDF consolidado generado')
      setSheetConsolidado(false)
    } catch (e: unknown) {
      toast.error(e instanceof Error ? e.message : 'Error al generar PDF')
    } finally {
      setCGenerando(false)
    }
  }

  // ── PDF individual ────────────────────────────────────────────────────────────
  const [generandoPDF, setGenerandoPDF] = useState(false)

  async function handlePDFIndividual() {
    if (!registroActivo || !orgId) return
    setGenerandoPDF(true)
    try {
      const ranchoCodigo = (ranchos.find((r) => r.id === registroActivo.rancho_id) as any)?.codigo ?? '—'
      const pdfItems: M33ItemPDF[] = activeItems.map((i) => ({ id: i.id, nombre: i.nombre, frecuencia: i.frecuencia }))
      const res: Record<number, Record<string, ValorM33PDF>> = resultados as any
      const dd: Record<number, M33DiaDataPDF> = {}
      for (const [k, v] of Object.entries(diasData)) {
        dd[Number(k)] = {
          concentracion_cloro: v.concentracion_cloro,
          ajuste_cloro: v.ajuste_cloro,
          concentracion_acido: v.concentracion_acido,
          ajuste_acido: v.ajuste_acido,
          realizo: v.realizo,
          aprobo: v.aprobo,
        }
      }
      await generarLimpiezaRecepcionPDF(registroActivo, ranchoCodigo, pdfItems, res, dd)
      toast.success('PDF descargado')
    } catch (e: unknown) {
      toast.error(e instanceof Error ? e.message : 'Error al generar PDF')
    } finally {
      setGenerandoPDF(false)
    }
  }

  const anioOpts = useMemo(() => {
    const y = new Date().getFullYear()
    return [y - 1, y, y + 1]
  }, [])

  const ranchoOptions = ranchos.map((r) => ({
    value: r.id,
    label: `${r.nombre}${(r as any).codigo ? ` (${(r as any).codigo})` : ''}`,
  }))

  function esHoyEnMes(d: number): boolean {
    if (!registroActivo) return false
    const now = new Date()
    return registroActivo.anio === now.getFullYear()
      && registroActivo.mes === now.getMonth() + 1
      && d === now.getDate()
  }

  return (
    <div className="min-h-full pb-safe-nav">

      <header className="bg-card border-b border-border px-4 py-3 sticky top-0 z-30">
        <div className="flex items-center gap-3">
          {vista === 'detalle' ? (
            <button onClick={volverALista} className="p-1 -ml-1">
              <ChevronLeft className="w-5 h-5 text-foreground" />
            </button>
          ) : (
            <Link to="/" className="p-1 -ml-1">
              <ChevronLeft className="w-5 h-5 text-foreground" />
            </Link>
          )}
          <div className="w-8 h-8 rounded-lg flex items-center justify-center flex-shrink-0"
            style={{ backgroundColor: 'var(--agro-success-fill)' }}>
            <PackageOpen className="w-4 h-4" style={{ color: 'var(--agro-success-text)' }} />
          </div>
          <div className="flex-1 min-w-0">
            {vista === 'lista' ? (
              <>
                <h1 className="text-sm text-foreground truncate" style={{ fontWeight: 600 }}>
                  Limpieza del Área de Recepción
                </h1>
                <div className="text-xs text-muted-foreground">{codigoFormato('F-FRUS-SAN-11', codigoClave)}</div>
              </>
            ) : (
              <>
                <h1 className="text-sm text-foreground truncate" style={{ fontWeight: 600 }}>
                  {registroActivo ? formatMesLabel(registroActivo.anio, registroActivo.mes) : '—'}
                </h1>
                <div className="text-xs text-muted-foreground truncate">{registroActivo?.rancho_nombre ?? '—'}</div>
              </>
            )}
          </div>

          {vista === 'lista' && (
            <div className="flex items-center gap-2">
              <button
                onClick={() => { setCatRanchoId(''); setCatNombre(''); setCatFrecuencia('diario'); setSheetConfigurar(true) }}
                className="flex items-center gap-1 h-8 px-2.5 rounded-lg border border-border text-xs text-foreground"
              >
                <Settings className="w-3.5 h-3.5" />
              </button>
              <button
                onClick={() => { setCRanchoId(''); setCErrRancho(false); setSheetConsolidado(true) }}
                className="flex items-center gap-1.5 h-8 px-3 rounded-lg border border-border text-xs text-foreground"
                style={{ fontWeight: 600 }}
              >
                <FileDown className="w-3.5 h-3.5" />
                Consolidado
              </button>
            </div>
          )}

          {vista === 'detalle' && registroActivo && (
            <div className="flex items-center gap-2">
              <button
                onClick={abrirConfigurar}
                className="flex items-center gap-1 h-8 px-2.5 rounded-lg border border-border text-xs text-foreground"
              >
                <Settings className="w-3.5 h-3.5" />
              </button>
              <button
                onClick={handlePDFIndividual}
                disabled={generandoPDF}
                className="flex items-center gap-1.5 h-8 px-3 rounded-lg border border-border text-xs text-foreground disabled:opacity-50"
                style={{ fontWeight: 600 }}
              >
                {generandoPDF ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <FileDown className="w-3.5 h-3.5" />}
                PDF
              </button>
            </div>
          )}
        </div>
      </header>

      {/* ── LISTA ────────────────────────────────────────────────────────────── */}
      {vista === 'lista' && (
        <div className="p-4 space-y-4">
          {error && (
            <div className="flex items-start gap-2 rounded-xl p-3"
              style={{ backgroundColor: 'var(--agro-danger-fill)', border: '1px solid var(--agro-red)' }}>
              <TriangleAlert className="w-4 h-4 flex-shrink-0 mt-0.5" style={{ color: 'var(--agro-danger-text)' }} />
              <p className="text-xs" style={{ color: 'var(--agro-danger-text)' }}>Error al cargar registros.</p>
            </div>
          )}
          {loading ? (
            <div className="flex justify-center py-12">
              <Loader2 className="w-6 h-6 text-primary animate-spin" />
            </div>
          ) : registros.length === 0 ? (
            <div className="bg-card border border-border rounded-xl p-6 text-center">
              <PackageOpen className="w-8 h-8 text-muted-foreground mx-auto mb-3" />
              <p className="text-sm text-foreground" style={{ fontWeight: 600 }}>Sin registros aún</p>
              <p className="text-xs text-muted-foreground mt-1">Crea el primer registro mensual con el botón +</p>
            </div>
          ) : (
            <div className="space-y-3">
              {registros.map((reg) => (
                <button
                  key={reg.id}
                  onClick={() => abrirDetalle(reg)}
                  className="w-full text-left bg-card rounded-xl p-4 border border-border"
                >
                  <div className="flex items-start justify-between gap-2">
                    <div className="flex-1 min-w-0">
                      <div className="mb-1">
                        <span className="text-xs px-2 py-0.5 rounded"
                          style={{ backgroundColor: 'var(--agro-success-fill)', color: 'var(--agro-success-text)', fontWeight: 600 }}>
                          {formatMesLabel(reg.anio, reg.mes)}
                        </span>
                      </div>
                      <span className="text-sm text-foreground" style={{ fontWeight: 600 }}>{reg.rancho_nombre}</span>
                    </div>
                    <ChevronLeft className="w-4 h-4 text-muted-foreground rotate-180 flex-shrink-0 mt-0.5" />
                  </div>
                </button>
              ))}
            </div>
          )}
        </div>
      )}

      {/* ── DETALLE ──────────────────────────────────────────────────────────── */}
      {vista === 'detalle' && registroActivo && (
        <div className="p-4 space-y-4">
          <div className="flex gap-2 flex-wrap">
            <span className="text-xs px-2 py-1 rounded"
              style={{ backgroundColor: 'var(--agro-success-fill)', color: 'var(--agro-success-text)' }}>
              {formatMesLabel(registroActivo.anio, registroActivo.mes)}
            </span>
            <span className="text-xs px-2 py-1 rounded"
              style={{ backgroundColor: 'var(--muted)', color: 'var(--muted-foreground)' }}>
              {registroActivo.rancho_nombre}
            </span>
          </div>

          {activeItems.length === 0 && !loadingDetalle && (
            <div className="flex items-start gap-2 rounded-xl p-3"
              style={{ backgroundColor: 'var(--agro-warning-fill)', border: '1px solid var(--agro-amber)' }}>
              <TriangleAlert className="w-4 h-4 flex-shrink-0 mt-0.5" style={{ color: 'var(--agro-warning-text)' }} />
              <p className="text-xs" style={{ color: 'var(--agro-warning-text)' }}>
                No hay ítems activos. Configura el catálogo con el ícono de ajustes.
              </p>
            </div>
          )}

          {loadingDetalle ? (
            <div className="flex justify-center py-8">
              <Loader2 className="w-5 h-5 text-primary animate-spin" />
            </div>
          ) : (
            <>
              {/* Selector de día */}
              <div className="bg-card border border-border rounded-xl p-3">
                <p className="text-xs text-muted-foreground mb-2" style={{ fontWeight: 600 }}>Selecciona el día</p>
                <div className="overflow-x-auto pb-1" style={{ WebkitOverflowScrolling: 'touch' } as React.CSSProperties}>
                  <div className="flex gap-1.5" style={{ minWidth: 'max-content' }}>
                    {days.map((d) => {
                      const isSelected = d === diaSeleccionado
                      const hasDatos = diasConDatos.has(d)
                      const isToday = esHoyEnMes(d)
                      return (
                        <button
                          key={d}
                          type="button"
                          onClick={() => setDiaSeleccionado(d)}
                          style={{
                            width: 34, height: 34, flexShrink: 0, borderRadius: 8,
                            border: isToday && !isSelected ? '2px solid var(--primary)' : '1px solid var(--border)',
                            backgroundColor: isSelected ? 'var(--primary)'
                              : hasDatos ? 'var(--agro-success-fill)' : 'var(--card)',
                            color: isSelected ? '#fff'
                              : hasDatos ? 'var(--agro-success-text)'
                              : isToday ? 'var(--primary)' : 'var(--foreground)',
                            fontWeight: isSelected || isToday ? 700 : 400,
                            fontSize: 12, cursor: 'pointer',
                          }}
                        >
                          {d}
                        </button>
                      )
                    })}
                  </div>
                </div>
              </div>

              {/* Actividades del día seleccionado */}
              {activeItems.length > 0 && (
                <div className="space-y-2">
                  <p className="text-sm text-foreground px-1" style={{ fontWeight: 600 }}>
                    Actividades · Día {diaSeleccionado}
                  </p>
                  {activeItems.map((item) => {
                    const v = resultados[diaSeleccionado]?.[item.id]
                    const isLoading = togglingCells.has(`${diaSeleccionado}|${item.id}`)
                    return (
                      <div key={item.id} className="bg-card border border-border rounded-xl p-3">
                        <div className="flex items-start gap-2 mb-2.5">
                          <div className="flex-1 min-w-0">
                            <p className="text-xs text-foreground leading-tight" style={{ fontWeight: 600 }}>
                              {item.nombre}
                            </p>
                            <p className="text-xs text-muted-foreground mt-0.5">
                              {frecuenciaLabel(item.frecuencia)}
                            </p>
                          </div>
                          {isLoading && (
                            <Loader2 className="w-3.5 h-3.5 text-muted-foreground animate-spin flex-shrink-0 mt-0.5" />
                          )}
                        </div>
                        <div className="flex gap-1.5">
                          {(['hecho', 'no_hecho', 'na'] as ValorM33[]).map((opcion) => {
                            const isActive = v === opcion
                            return (
                              <button
                                key={opcion}
                                type="button"
                                onClick={() => handleSetValor(item.id, diaSeleccionado, opcion)}
                                disabled={isLoading}
                                style={{
                                  flex: 1, height: 32, borderRadius: 8,
                                  border: isActive ? 'none' : '1px solid var(--border)',
                                  backgroundColor: isActive
                                    ? opcion === 'hecho' ? 'var(--agro-success-fill)'
                                      : opcion === 'no_hecho' ? 'var(--agro-danger-fill)'
                                      : 'var(--muted)'
                                    : 'var(--card)',
                                  color: isActive
                                    ? opcion === 'hecho' ? 'var(--agro-success-text)'
                                      : opcion === 'no_hecho' ? 'var(--agro-danger-text)'
                                      : 'var(--muted-foreground)'
                                    : 'var(--muted-foreground)',
                                  fontSize: 11, fontWeight: isActive ? 700 : 400,
                                  cursor: 'pointer', opacity: isLoading ? 0.5 : 1,
                                }}
                              >
                                {opcion === 'hecho' ? 'Hecho' : opcion === 'no_hecho' ? 'No hecho' : 'N/A'}
                              </button>
                            )
                          })}
                        </div>
                      </div>
                    )
                  })}
                </div>
              )}

              {/* Desinfección del día */}
              <div className="bg-card border border-border rounded-xl p-4 space-y-3">
                <p className="text-sm text-foreground" style={{ fontWeight: 600 }}>
                  Desinfección · Día {diaSeleccionado}
                </p>
                <div className="flex gap-3">
                  <div className="flex-1 space-y-1">
                    <label className="text-xs text-muted-foreground" style={{ fontWeight: 600 }}>Conc. Cloro (ppm)</label>
                    <input
                      type="number"
                      value={diaConcCloro}
                      onChange={(e) => setDiaConcCloro(e.target.value)}
                      placeholder="0"
                      className="w-full h-10 px-3 rounded-xl border border-border bg-input-background text-sm"
                    />
                  </div>
                  <div className="flex-1 space-y-1">
                    <label className="text-xs text-muted-foreground" style={{ fontWeight: 600 }}>Ajuste Cloro</label>
                    <input
                      type="number"
                      value={diaAjCloro}
                      onChange={(e) => setDiaAjCloro(e.target.value)}
                      placeholder="0"
                      className="w-full h-10 px-3 rounded-xl border border-border bg-input-background text-sm"
                    />
                  </div>
                </div>
                <div className="flex gap-3">
                  <div className="flex-1 space-y-1">
                    <label className="text-xs text-muted-foreground" style={{ fontWeight: 600 }}>Conc. Ác. Peracético (ppm)</label>
                    <input
                      type="number"
                      value={diaConcAcido}
                      onChange={(e) => setDiaConcAcido(e.target.value)}
                      placeholder="0"
                      className="w-full h-10 px-3 rounded-xl border border-border bg-input-background text-sm"
                    />
                  </div>
                  <div className="flex-1 space-y-1">
                    <label className="text-xs text-muted-foreground" style={{ fontWeight: 600 }}>Ajuste Ác. Peracético</label>
                    <input
                      type="number"
                      value={diaAjAcido}
                      onChange={(e) => setDiaAjAcido(e.target.value)}
                      placeholder="0"
                      className="w-full h-10 px-3 rounded-xl border border-border bg-input-background text-sm"
                    />
                  </div>
                </div>
                <div className="flex gap-3">
                  <div className="flex-1 space-y-1">
                    <label className="text-xs text-muted-foreground" style={{ fontWeight: 600 }}>Realizó</label>
                    <input
                      type="text"
                      value={diaRealizo}
                      onChange={(e) => setDiaRealizo(e.target.value)}
                      placeholder="Nombre"
                      className="w-full h-10 px-3 rounded-xl border border-border bg-input-background text-sm"
                    />
                  </div>
                  <div className="flex-1 space-y-1">
                    <label className="text-xs text-muted-foreground" style={{ fontWeight: 600 }}>Aprobó</label>
                    <input
                      type="text"
                      value={diaAprobo}
                      onChange={(e) => setDiaAprobo(e.target.value)}
                      placeholder="Nombre"
                      className="w-full h-10 px-3 rounded-xl border border-border bg-input-background text-sm"
                    />
                  </div>
                </div>
                <button
                  type="button"
                  onClick={handleGuardarDia}
                  disabled={diaSaving}
                  className="w-full h-10 rounded-xl text-sm text-white disabled:opacity-60"
                  style={{ backgroundColor: 'var(--primary)', fontWeight: 600 }}
                >
                  {diaSaving ? 'Guardando…' : `Guardar día ${diaSeleccionado}`}
                </button>
              </div>

              {/* Resumen mensual (solo lectura, colapsable) */}
              {activeItems.length > 0 && (
                <div className="bg-card border border-border rounded-xl overflow-hidden">
                  <button
                    type="button"
                    onClick={() => setMostrarResumen((v) => !v)}
                    className="w-full flex items-center justify-between px-4 py-3"
                  >
                    <span className="text-sm text-foreground" style={{ fontWeight: 600 }}>Resumen mensual</span>
                    {mostrarResumen
                      ? <ChevronUp className="w-4 h-4 text-muted-foreground" />
                      : <ChevronDown className="w-4 h-4 text-muted-foreground" />}
                  </button>
                  {mostrarResumen && (
                    <div className="divide-y divide-border border-t border-border">
                      {resumenItems.map(({ item, hecho, noHecho, na }) => (
                        <div key={item.id} className="flex items-center gap-3 px-4 py-2.5">
                          <p className="flex-1 text-xs text-foreground truncate">{item.nombre}</p>
                          <div className="flex items-center gap-1.5 flex-shrink-0">
                            {hecho > 0 && (
                              <span className="text-xs px-1.5 py-0.5 rounded"
                                style={{ backgroundColor: 'var(--agro-success-fill)', color: 'var(--agro-success-text)', fontWeight: 600 }}>
                                {hecho} ✓
                              </span>
                            )}
                            {noHecho > 0 && (
                              <span className="text-xs px-1.5 py-0.5 rounded"
                                style={{ backgroundColor: 'var(--agro-danger-fill)', color: 'var(--agro-danger-text)', fontWeight: 600 }}>
                                {noHecho} ✗
                              </span>
                            )}
                            {na > 0 && (
                              <span className="text-xs px-1.5 py-0.5 rounded"
                                style={{ backgroundColor: 'var(--muted)', color: 'var(--muted-foreground)', fontWeight: 600 }}>
                                {na} N/A
                              </span>
                            )}
                            {hecho === 0 && noHecho === 0 && na === 0 && (
                              <span className="text-xs text-muted-foreground">—</span>
                            )}
                          </div>
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              )}

              {/* Observaciones del mes */}
              <div className="bg-card border border-border rounded-xl p-4 space-y-3">
                <h2 className="text-sm text-foreground" style={{ fontWeight: 600 }}>Observaciones del mes</h2>
                <textarea
                  value={obsLocal}
                  onChange={(e) => setObsLocal(e.target.value)}
                  rows={2}
                  placeholder="Observaciones generales…"
                  className="w-full rounded-lg border border-border bg-input-background px-3 py-2 text-sm resize-none"
                />
                <button
                  onClick={handleGuardarObs}
                  disabled={savingObs}
                  className="h-9 px-4 rounded-xl text-sm text-white disabled:opacity-60"
                  style={{ backgroundColor: 'var(--primary)', fontWeight: 600 }}
                >
                  {savingObs ? 'Guardando…' : 'Guardar observaciones'}
                </button>
              </div>
            </>
          )}
        </div>
      )}

      {/* ── FAB ──────────────────────────────────────────────────────────────── */}
      {vista === 'lista' && (
        <div className="fixed bottom-safe-fab left-1/2 -translate-x-1/2 w-full max-w-[390px] flex justify-end px-4 pointer-events-none z-10">
          <button
            type="button"
            onClick={() => {
              setNRanchoId(''); setNAnio(new Date().getFullYear()); setNMes(new Date().getMonth() + 1)
              setNErrRancho(false); setSheetNuevo(true)
            }}
            className="pointer-events-auto w-14 h-14 bg-primary rounded-full flex items-center justify-center"
            style={{ boxShadow: '0 2px 12px rgba(43,122,181,0.35)' }}
            aria-label="Nuevo registro mensual"
          >
            <Plus className="w-6 h-6 text-white" />
          </button>
        </div>
      )}

      {/* ═══ SHEET: NUEVO REGISTRO ══════════════════════════════════════════════ */}
      <BottomSheet open={sheetNuevo} onClose={() => setSheetNuevo(false)} height="85%">
        <div className="flex justify-center pt-3 pb-1"><div className="w-9 h-1 rounded-full bg-border" /></div>
        <div className="px-4 pb-4">
          <div className="flex items-center justify-between mb-4">
            <h2 className="text-base text-foreground" style={{ fontWeight: 600 }}>Nuevo registro mensual</h2>
            <button type="button" onClick={() => setSheetNuevo(false)}><X className="w-5 h-5 text-muted-foreground" /></button>
          </div>
          <div className="space-y-4">
            <div className="space-y-1">
              <label className="text-xs text-muted-foreground" style={{ fontWeight: 600 }}>{termino} *</label>
              <select
                value={nRanchoId}
                onChange={(e) => { setNRanchoId(e.target.value); setNErrRancho(false) }}
                className="w-full h-11 px-3 rounded-xl border border-border bg-input-background text-sm"
                style={{ borderColor: nErrRancho ? 'var(--agro-red)' : undefined }}
              >
                <option value="">Selecciona una {termino.toLowerCase()}</option>
                {ranchoOptions.map((o) => <option key={o.value} value={o.value}>{o.label}</option>)}
              </select>
              {nErrRancho && <p className="text-xs" style={{ color: 'var(--agro-red)' }}>Requerido</p>}
            </div>
            <div className="flex gap-3">
              <div className="flex-1 space-y-1">
                <label className="text-xs text-muted-foreground" style={{ fontWeight: 600 }}>Año *</label>
                <select
                  value={nAnio}
                  onChange={(e) => setNAnio(Number(e.target.value))}
                  className="w-full h-11 px-3 rounded-xl border border-border bg-input-background text-sm"
                >
                  {anioOpts.map((y) => <option key={y} value={y}>{y}</option>)}
                </select>
              </div>
              <div className="flex-1 space-y-1">
                <label className="text-xs text-muted-foreground" style={{ fontWeight: 600 }}>Mes *</label>
                <select
                  value={nMes}
                  onChange={(e) => setNMes(Number(e.target.value))}
                  className="w-full h-11 px-3 rounded-xl border border-border bg-input-background text-sm"
                >
                  {MESES.map((m, i) => <option key={i + 1} value={i + 1}>{m}</option>)}
                </select>
              </div>
            </div>
            <button
              type="button"
              onClick={handleCrearRegistro}
              disabled={nGuardando}
              className="w-full h-11 rounded-xl text-sm text-white disabled:opacity-60"
              style={{ backgroundColor: 'var(--primary)', fontWeight: 600 }}
            >
              {nGuardando ? 'Guardando…' : 'Crear registro'}
            </button>
          </div>
        </div>
      </BottomSheet>

      {/* ═══ SHEET: CONFIGURAR CATÁLOGO ══════════════════════════════════════════ */}
      <BottomSheet open={sheetConfigurar} onClose={() => setSheetConfigurar(false)} height="85%">
        <div className="flex justify-center pt-3 pb-1"><div className="w-9 h-1 rounded-full bg-border" /></div>
        <div className="px-4 pb-4 overflow-y-auto h-full">
          <div className="flex items-center justify-between mb-4">
            <h2 className="text-base text-foreground" style={{ fontWeight: 600 }}>Configurar ítems</h2>
            <button type="button" onClick={() => setSheetConfigurar(false)}><X className="w-5 h-5 text-muted-foreground" /></button>
          </div>
          <div className="space-y-4">
            <div className="space-y-1">
              <label className="text-xs text-muted-foreground" style={{ fontWeight: 600 }}>{termino}</label>
              <select
                value={catRanchoId}
                onChange={(e) => setCatRanchoId(e.target.value)}
                className="w-full h-11 px-3 rounded-xl border border-border bg-input-background text-sm"
              >
                <option value="">Selecciona una {termino.toLowerCase()}</option>
                {ranchoOptions.map((o) => <option key={o.value} value={o.value}>{o.label}</option>)}
              </select>
            </div>

            {catRanchoId && (
              <>
                <button
                  type="button"
                  onClick={handleCargarPlantilla}
                  disabled={catCargandoPlantilla}
                  className="w-full h-9 rounded-xl border border-border text-xs text-foreground flex items-center justify-center gap-1.5 disabled:opacity-60"
                  style={{ fontWeight: 600 }}
                >
                  {catCargandoPlantilla ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Plus className="w-3.5 h-3.5" />}
                  Sembrar 11 ítems estándar
                </button>

                {loadingGestion ? (
                  <div className="flex justify-center py-4"><Loader2 className="w-5 h-5 text-primary animate-spin" /></div>
                ) : itemsGestion.length === 0 ? (
                  <p className="text-xs text-muted-foreground text-center py-2">Sin ítems configurados.</p>
                ) : (
                  <div className="bg-card border border-border rounded-xl divide-y divide-border">
                    {itemsGestion.map((item) => (
                      <div key={item.id} className="flex items-center gap-3 px-3 py-2.5">
                        <div className="flex-1 min-w-0">
                          <p className="text-xs text-foreground truncate">{item.nombre}</p>
                          <p className="text-xs text-muted-foreground">{frecuenciaLabel(item.frecuencia)}</p>
                        </div>
                        <button
                          type="button"
                          onClick={() => handleToggleActivo(item)}
                          disabled={catToggling === item.id}
                          className="flex-shrink-0 w-16 h-6 rounded-full text-xs transition-colors disabled:opacity-60"
                          style={{
                            backgroundColor: item.activo ? 'var(--primary)' : 'var(--switch-background)',
                            color: item.activo ? '#fff' : 'var(--muted-foreground)',
                            fontWeight: 600,
                          }}
                        >
                          {catToggling === item.id ? '…' : item.activo ? 'Activo' : 'Inactivo'}
                        </button>
                      </div>
                    ))}
                  </div>
                )}

                <div className="bg-card border border-border rounded-xl p-3 space-y-3">
                  <p className="text-xs text-foreground" style={{ fontWeight: 600 }}>Agregar ítem personalizado</p>
                  <div className="space-y-1">
                    <label className="text-xs text-muted-foreground">Nombre de actividad</label>
                    <input
                      type="text"
                      value={catNombre}
                      onChange={(e) => setCatNombre(e.target.value)}
                      placeholder="Ej: Limpieza de pisos"
                      className="w-full h-10 px-3 rounded-xl border border-border bg-input-background text-sm"
                    />
                  </div>
                  <div className="space-y-1">
                    <label className="text-xs text-muted-foreground">Frecuencia</label>
                    <select
                      value={catFrecuencia}
                      onChange={(e) => setCatFrecuencia(e.target.value)}
                      className="w-full h-10 px-3 rounded-xl border border-border bg-input-background text-sm"
                    >
                      {FRECUENCIA_OPTS.map((opt) => (
                        <option key={opt.value} value={opt.value}>{opt.label}</option>
                      ))}
                    </select>
                  </div>
                  <button
                    type="button"
                    onClick={handleAgregarItem}
                    disabled={catAgregando}
                    className="w-full h-9 rounded-xl text-sm text-white disabled:opacity-60"
                    style={{ backgroundColor: 'var(--primary)', fontWeight: 600 }}
                  >
                    {catAgregando ? 'Agregando…' : 'Agregar'}
                  </button>
                </div>
              </>
            )}
          </div>
        </div>
      </BottomSheet>

      {/* ═══ SHEET: CONSOLIDADO ══════════════════════════════════════════════════ */}
      <BottomSheet open={sheetConsolidado} onClose={() => setSheetConsolidado(false)} height="85%">
        <div className="flex justify-center pt-3 pb-1"><div className="w-9 h-1 rounded-full bg-border" /></div>
        <div className="px-4 pb-4">
          <div className="flex items-center justify-between mb-4">
            <h2 className="text-base text-foreground" style={{ fontWeight: 600 }}>Exportar consolidado</h2>
            <button type="button" onClick={() => setSheetConsolidado(false)}><X className="w-5 h-5 text-muted-foreground" /></button>
          </div>
          <div className="space-y-4">
            <div className="space-y-1">
              <label className="text-xs text-muted-foreground" style={{ fontWeight: 600 }}>{termino} *</label>
              <select
                value={cRanchoId}
                onChange={(e) => { setCRanchoId(e.target.value); setCErrRancho(false) }}
                className="w-full h-11 px-3 rounded-xl border border-border bg-input-background text-sm"
                style={{ borderColor: cErrRancho ? 'var(--agro-red)' : undefined }}
              >
                <option value="">Selecciona una {termino.toLowerCase()}</option>
                {ranchoOptions.map((o) => <option key={o.value} value={o.value}>{o.label}</option>)}
              </select>
              {cErrRancho && <p className="text-xs" style={{ color: 'var(--agro-red)' }}>Requerido</p>}
            </div>
            <div className="flex gap-3">
              <div className="flex-1 space-y-1">
                <label className="text-xs text-muted-foreground" style={{ fontWeight: 600 }}>Desde</label>
                <input
                  type="month"
                  value={cDesde}
                  onChange={(e) => setCDesde(e.target.value)}
                  className="w-full h-11 px-3 rounded-xl border border-border bg-input-background text-sm"
                />
              </div>
              <div className="flex-1 space-y-1">
                <label className="text-xs text-muted-foreground" style={{ fontWeight: 600 }}>Hasta</label>
                <input
                  type="month"
                  value={cHasta}
                  onChange={(e) => setCHasta(e.target.value)}
                  className="w-full h-11 px-3 rounded-xl border border-border bg-input-background text-sm"
                />
              </div>
            </div>
            <button
              type="button"
              onClick={handleConsolidado}
              disabled={cGenerando}
              className="w-full h-11 rounded-xl text-sm text-white disabled:opacity-60 flex items-center justify-center gap-2"
              style={{ backgroundColor: 'var(--primary)', fontWeight: 600 }}
            >
              {cGenerando ? <><Loader2 className="w-4 h-4 animate-spin" />Generando…</> : 'Descargar PDF'}
            </button>
          </div>
        </div>
      </BottomSheet>

    </div>
  )
}
