import { useState, useEffect, useCallback, useMemo } from 'react'
import { Link } from 'react-router'
import {
  ChevronLeft, Plus, FileDown, Loader2, TriangleAlert, Settings,
} from 'lucide-react'
import { toast } from 'sonner'
import { supabase } from '@/lib/supabase'
import { useAuthContext } from '@/context/AuthContext'
import { codigoFormato } from '@/lib/codigoFormato'
import { useModulosContext } from '@/context/ModulosContext'
import { useRanchos } from '@/hooks/useRanchos'
import {
  useM45MttoPreventivo,
  type M45RegistroMensual,
  type M45Item,
  type ValorM45,
} from '@/hooks/useM45MttoPreventivo'
import { generarMttoPreventivoPDF } from '@/lib/pdf/m45/generarMttoPreventivoPDF'
import { generarMttoPreventivoConsolidadoPDF } from '@/lib/pdf/m45/generarMttoPreventivoPDF'

// ── Helpers ───────────────────────────────────────────────────────────────────

function hoyMX() {
  return new Date().toLocaleDateString('en-CA', { timeZone: 'America/Mexico_City' })
}

function mesLabel(anio: number, mes: number): string {
  try {
    return new Date(anio, mes - 1, 1).toLocaleDateString('es-MX', { month: 'long', year: 'numeric' })
  } catch { return `${anio}-${String(mes).padStart(2, '0')}` }
}

function siguienteValor(v: ValorM45): ValorM45 {
  if (v === 'hecho')    return 'no_hecho'
  if (v === 'no_hecho') return 'na'
  return 'hecho'
}

function valorLabel(v: ValorM45): string {
  if (v === 'hecho')    return 'Hecho'
  if (v === 'no_hecho') return 'No hecho'
  return 'N/A'
}

function frecuenciaLabel(f: string): string {
  if (f === 'diario')     return 'Diario'
  if (f === 'tercer_dia') return 'Cada 3 días'
  if (f === 'semanal')    return 'Semanal'
  if (f === 'quincenal')  return 'Quincenal'
  return f
}

function ultimoDiaMes(anio: number, mes: number): string {
  const d = new Date(anio, mes, 0).getDate()
  return `${anio}-${String(mes).padStart(2, '0')}-${String(d).padStart(2, '0')}`
}

function defaultDiaFecha(anio: number, mes: number): string {
  const hoy = hoyMX()
  if (parseInt(hoy.slice(0, 4)) === anio && parseInt(hoy.slice(5, 7)) === mes) return hoy
  return `${anio}-${String(mes).padStart(2, '0')}-01`
}

// ── Types ─────────────────────────────────────────────────────────────────────

interface AccionesRow {
  revision_general: boolean
  cambio_aceites: boolean
  cambio_piezas: boolean
  revision_electrico: boolean
}

// ── Sub-components ────────────────────────────────────────────────────────────

function DiaCard({
  dia, h, n, na, onClick,
}: { dia: number; h: number; n: number; na: number; onClick: () => void }) {
  return (
    <button
      onClick={onClick}
      className="w-full text-left bg-card rounded-xl p-3 border border-border"
    >
      <div className="flex items-center gap-3">
        <div
          className="w-10 h-10 rounded-lg flex items-center justify-center flex-shrink-0"
          style={{ backgroundColor: 'var(--agro-success-fill)' }}
        >
          <span style={{ fontSize: 16, fontWeight: 700, color: 'var(--agro-success-text)', lineHeight: 1 }}>
            {dia}
          </span>
        </div>
        <div className="flex flex-wrap gap-1.5 flex-1">
          {h > 0 && (
            <span
              className="text-xs px-1.5 py-0.5 rounded"
              style={{ backgroundColor: 'var(--agro-success-fill)', color: 'var(--agro-success-text)', fontWeight: 600 }}
            >
              H: {h}
            </span>
          )}
          {n > 0 && (
            <span
              className="text-xs px-1.5 py-0.5 rounded"
              style={{ backgroundColor: 'var(--agro-danger-fill)', color: 'var(--agro-danger-text)', fontWeight: 600 }}
            >
              N: {n}
            </span>
          )}
          {na > 0 && (
            <span
              className="text-xs px-1.5 py-0.5 rounded"
              style={{ backgroundColor: 'var(--muted)', color: 'var(--muted-foreground)', fontWeight: 600 }}
            >
              N/A: {na}
            </span>
          )}
        </div>
        <ChevronLeft className="w-4 h-4 text-muted-foreground rotate-180 flex-shrink-0" />
      </div>
    </button>
  )
}

function AccionToggle({
  label, value, onChange,
}: { label: string; value: boolean; onChange: (v: boolean) => void }) {
  return (
    <button
      onClick={() => onChange(!value)}
      className="flex flex-col items-center gap-0.5 flex-shrink-0"
    >
      <span
        className="rounded text-xs flex items-center justify-center"
        style={{
          width: 36, height: 24, fontWeight: 600,
          backgroundColor: value ? 'var(--agro-success-fill)' : 'var(--muted)',
          color: value ? 'var(--agro-success-text)' : 'var(--muted-foreground)',
        }}
      >
        {value ? 'Si' : 'No'}
      </span>
      <span className="text-center leading-tight" style={{ fontSize: 9, color: 'var(--muted-foreground)', maxWidth: 36 }}>
        {label}
      </span>
    </button>
  )
}

// ── Screen ────────────────────────────────────────────────────────────────────

type Vista = 'lista' | 'detalle'

export function MantenimientoPreventivo() {
  const { profile, codigoClave } = useAuthContext()
  const { terminosSitio } = useModulosContext()
  const { ranchos }       = useRanchos()
  const { registros, loading, error, refetch } = useM45MttoPreventivo()

  const mesActual    = hoyMX().slice(0, 7)  // YYYY-MM
  const termino      = terminosSitio.singular

  // ── Catálogo global de items ──
  const [items, setItems]               = useState<M45Item[]>([])
  const [areasOrdenadas, setAreasOrdenadas] = useState<string[]>([])

  useEffect(() => {
    const tbl = supabase as any
    tbl.from('m45_items')
      .select('id, area, nombre, frecuencia, orden')
      .eq('activo', true)
      .order('area')
      .order('orden')
      .then(({ data }: any) => {
        if (!data) return
        const list = data as M45Item[]
        setItems(list)
        const areas: string[] = []
        const seen = new Set<string>()
        for (const item of list) {
          if (!seen.has(item.area)) { seen.add(item.area); areas.push(item.area) }
        }
        setAreasOrdenadas(areas)
      })
  }, [])

  // ── Vista ──
  const [vista, setVista]                   = useState<Vista>('lista')
  const [registroActivo, setRegistroActivo] = useState<M45RegistroMensual | null>(null)
  const [loadingDetalle, setLoadingDetalle] = useState(false)
  const [resultadosMap, setResultadosMap]   = useState<Record<string, Record<number, ValorM45>>>({})
  const [accionesMap, setAccionesMap]       = useState<Record<string, AccionesRow>>({})

  const diasConData = useMemo(() => {
    const map = new Map<number, { h: number; n: number; na: number }>()
    for (const diaMap of Object.values(resultadosMap)) {
      for (const [diaStr, valor] of Object.entries(diaMap)) {
        const d = parseInt(diaStr)
        const e = map.get(d) ?? { h: 0, n: 0, na: 0 }
        if (valor === 'hecho')    e.h++
        else if (valor === 'no_hecho') e.n++
        else                      e.na++
        map.set(d, e)
      }
    }
    return Array.from(map.entries()).sort((a, b) => a[0] - b[0])
  }, [resultadosMap])

  const cargarDetalle = useCallback(async (regId: string) => {
    if (!profile?.org_id) return
    setLoadingDetalle(true)
    setResultadosMap({})
    setAccionesMap({})
    const tbl = supabase as any
    const [resData, accData] = await Promise.all([
      tbl.from('m45_resultados')
        .select('item_id, dia, valor')
        .eq('registro_id', regId)
        .eq('org_id', profile.org_id),
      tbl.from('m45_acciones')
        .select('item_id, revision_general, cambio_aceites, cambio_piezas, revision_electrico')
        .eq('registro_id', regId)
        .eq('org_id', profile.org_id),
    ])
    if (!resData.error && resData.data) {
      const map: Record<string, Record<number, ValorM45>> = {}
      for (const r of resData.data as any[]) {
        if (!map[r.item_id]) map[r.item_id] = {}
        map[r.item_id][r.dia as number] = r.valor as ValorM45
      }
      setResultadosMap(map)
    }
    if (!accData.error && accData.data) {
      const map: Record<string, AccionesRow> = {}
      for (const a of accData.data as any[]) {
        map[a.item_id] = {
          revision_general:  a.revision_general,
          cambio_aceites:    a.cambio_aceites,
          cambio_piezas:     a.cambio_piezas,
          revision_electrico: a.revision_electrico,
        }
      }
      setAccionesMap(map)
    }
    setLoadingDetalle(false)
  }, [profile?.org_id])

  function abrirDetalle(reg: M45RegistroMensual) {
    setRegistroActivo(reg)
    setObsLocal(reg.observaciones ?? '')
    setVista('detalle')
    cargarDetalle(reg.id)
  }

  function volverALista() {
    setVista('lista')
    setRegistroActivo(null)
    setResultadosMap({})
    setAccionesMap({})
  }

  // ── Observaciones del registro ──
  const [obsLocal,   setObsLocal]   = useState('')
  const [savingMeta, setSavingMeta] = useState(false)

  async function handleActualizarObs() {
    if (!registroActivo || !profile?.org_id) return
    setSavingMeta(true)
    try {
      const { error: err } = await (supabase as any)
        .from('m45_registro_mensual')
        .update({ observaciones: obsLocal.trim() || null })
        .eq('id', registroActivo.id)
        .eq('org_id', profile.org_id)
      if (err) throw err
      toast.success('Guardado')
      setRegistroActivo((prev) => prev ? { ...prev, observaciones: obsLocal.trim() || null } : null)
      await refetch()
    } catch (e: unknown) {
      toast.error(e instanceof Error ? e.message : 'Error al guardar')
    } finally {
      setSavingMeta(false)
    }
  }

  // ── Sheet: crear registro mensual ──
  const [sheetCrear, setSheetCrear] = useState(false)
  const [nRanchoId, setNRanchoId]   = useState('')
  const [nMes, setNMes]             = useState(mesActual)
  const [creando, setCreando]       = useState(false)
  const [errRancho, setErrRancho]   = useState(false)

  async function handleCrearRegistro() {
    if (!nRanchoId) { setErrRancho(true); return }
    if (!profile?.org_id) return
    setCreando(true)
    try {
      const [yearStr, mesStr] = nMes.split('-')
      const { error: err } = await (supabase as any)
        .from('m45_registro_mensual')
        .insert({
          org_id:    profile.org_id,
          rancho_id: nRanchoId,
          anio:      parseInt(yearStr),
          mes:       parseInt(mesStr),
        })
      if (err) {
        const msg = err.message as string
        if (msg.includes('23505') || msg.includes('unique') || msg.includes('duplicate')) {
          toast.warning('Ya existe un registro para ese mes e instalación')
        } else {
          toast.error(msg)
        }
        return
      }
      toast.success('Registro mensual creado')
      setSheetCrear(false)
      setNRanchoId('')
      setNMes(mesActual)
      await refetch()
    } catch (e: unknown) {
      toast.error(e instanceof Error ? e.message : 'Error al crear registro')
    } finally {
      setCreando(false)
    }
  }

  // ── Sheet: capturar día ──
  const [sheetDia, setSheetDia]           = useState(false)
  const [dFecha, setDFecha]               = useState('')
  const [dValores, setDValores]           = useState<Record<string, ValorM45>>({})
  const [expandedAreasDia, setExpandedAreasDia] = useState<Set<string>>(new Set())
  const [dGuardando, setDGuardando]       = useState(false)

  function toggleAreaDia(area: string) {
    setExpandedAreasDia((prev) => {
      const next = new Set(prev)
      next.has(area) ? next.delete(area) : next.add(area)
      return next
    })
  }

  function abrirSheetDia(editarDia?: number) {
    if (!registroActivo) return
    let fecha: string
    if (editarDia !== undefined) {
      fecha = `${registroActivo.anio}-${String(registroActivo.mes).padStart(2, '0')}-${String(editarDia).padStart(2, '0')}`
    } else {
      fecha = defaultDiaFecha(registroActivo.anio, registroActivo.mes)
    }
    setDFecha(fecha)
    const dia = new Date(fecha + 'T12:00:00').getDate()
    const init: Record<string, ValorM45> = {}
    for (const item of items) {
      init[item.id] = (resultadosMap[item.id]?.[dia] as ValorM45 | undefined) ?? 'hecho'
    }
    setDValores(init)
    setExpandedAreasDia(new Set(areasOrdenadas))
    setSheetDia(true)
  }

  async function handleGuardarDia() {
    if (!registroActivo || !profile?.org_id || !dFecha) return
    const dia = new Date(dFecha + 'T12:00:00').getDate()
    setDGuardando(true)
    try {
      const batch = items.map((item) => ({
        registro_id: registroActivo.id,
        org_id:      profile.org_id,
        item_id:     item.id,
        dia,
        valor:       dValores[item.id] ?? 'hecho',
      }))
      const { error: err } = await (supabase as any)
        .from('m45_resultados')
        .upsert(batch, { onConflict: 'registro_id,item_id,dia' })
      if (err) throw err
      toast.success(`Día ${dia} guardado`)
      setSheetDia(false)
      cargarDetalle(registroActivo.id)
    } catch (e: unknown) {
      toast.error(e instanceof Error ? e.message : 'Error al guardar día')
    } finally {
      setDGuardando(false)
    }
  }

  // ── Sheet: acciones del mes ──
  const [sheetAcciones, setSheetAcciones]       = useState(false)
  const [accionesLocal, setAccionesLocal]       = useState<Record<string, AccionesRow>>({})
  const [expandedAreasAcc, setExpandedAreasAcc] = useState<Set<string>>(new Set())
  const [savingAcciones, setSavingAcciones]     = useState(false)

  function toggleAreaAcc(area: string) {
    setExpandedAreasAcc((prev) => {
      const next = new Set(prev)
      next.has(area) ? next.delete(area) : next.add(area)
      return next
    })
  }

  function abrirSheetAcciones() {
    const copy: Record<string, AccionesRow> = {}
    for (const item of items) {
      copy[item.id] = accionesMap[item.id] ?? {
        revision_general: false, cambio_aceites: false,
        cambio_piezas: false, revision_electrico: false,
      }
    }
    setAccionesLocal(copy)
    setExpandedAreasAcc(new Set(areasOrdenadas))
    setSheetAcciones(true)
  }

  function setAccion(itemId: string, campo: keyof AccionesRow, val: boolean) {
    setAccionesLocal((prev) => ({
      ...prev,
      [itemId]: {
        ...(prev[itemId] ?? { revision_general: false, cambio_aceites: false, cambio_piezas: false, revision_electrico: false }),
        [campo]: val,
      },
    }))
  }

  async function handleGuardarAcciones() {
    if (!registroActivo || !profile?.org_id) return
    setSavingAcciones(true)
    try {
      const batch = items.map((item) => {
        const acc = accionesLocal[item.id] ?? {
          revision_general: false, cambio_aceites: false,
          cambio_piezas: false, revision_electrico: false,
        }
        return { registro_id: registroActivo.id, org_id: profile.org_id, item_id: item.id, ...acc }
      })
      const { error: err } = await (supabase as any)
        .from('m45_acciones')
        .upsert(batch, { onConflict: 'registro_id,item_id' })
      if (err) throw err
      toast.success('Acciones del mes guardadas')
      setSheetAcciones(false)
      setAccionesMap({ ...accionesLocal })
    } catch (e: unknown) {
      toast.error(e instanceof Error ? e.message : 'Error al guardar')
    } finally {
      setSavingAcciones(false)
    }
  }

  const itemsConAccion = useMemo(
    () => Object.values(accionesMap).filter((a) => a.revision_general || a.cambio_aceites || a.cambio_piezas || a.revision_electrico).length,
    [accionesMap],
  )

  // ── PDF individual ──
  const [generandoPDF, setGenerandoPDF] = useState<string | null>(null)

  async function handlePDFIndividual(regId: string) {
    if (!profile?.org_id) return
    setGenerandoPDF(regId)
    try {
      await generarMttoPreventivoPDF(regId, profile.org_id, codigoClave)
      toast.success('PDF descargado')
    } catch (e: unknown) {
      toast.error(e instanceof Error ? e.message : 'Error al generar PDF')
    } finally {
      setGenerandoPDF(null)
    }
  }

  // ── Sheet: consolidado ──
  const [sheetConsolidado, setSheetConsolidado] = useState(false)
  const [cRanchoId, setCRanchoId]               = useState('')
  const [cDesde, setCDesde]                     = useState(mesActual)
  const [cHasta, setCHasta]                     = useState(mesActual)
  const [cGenerando, setCGenerando]             = useState(false)
  const [cErrRancho, setCErrRancho]             = useState(false)

  async function handleConsolidado() {
    if (!cRanchoId) { setCErrRancho(true); return }
    if (!profile?.org_id) return
    setCGenerando(true)
    try {
      const nombre = ranchos.find((r) => r.id === cRanchoId)?.nombre ?? cRanchoId
      await generarMttoPreventivoConsolidadoPDF(cRanchoId, nombre, profile.org_id, cDesde, cHasta, codigoClave)
      toast.success('PDF consolidado generado')
      setSheetConsolidado(false)
    } catch (e: unknown) {
      toast.error(e instanceof Error ? e.message : 'Error al generar PDF')
    } finally {
      setCGenerando(false)
    }
  }

  const ranchoOptions = ranchos.map((r) => ({ value: r.id, label: `${r.nombre} (${r.codigo})` }))

  // ── Render ────────────────────────────────────────────────────────────────

  return (
    <div className="min-h-full pb-safe-nav">

      {/* ── Header ─────────────────────────────────────────────────────── */}
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
          <div className="w-8 h-8 bg-primary/10 rounded-lg flex items-center justify-center flex-shrink-0">
            <Settings className="w-4 h-4 text-primary" />
          </div>
          <div className="flex-1 min-w-0">
            {vista === 'lista' ? (
              <>
                <h1 className="text-sm text-foreground truncate" style={{ fontWeight: 600 }}>
                  Mantenimiento Preventivo
                </h1>
                <div className="text-xs text-muted-foreground">Cuarto Frío · Mensual · {codigoFormato('F-FRUS-MTT-03', codigoClave)}</div>
              </>
            ) : (
              <>
                <h1 className="text-sm text-foreground truncate" style={{ fontWeight: 600 }}>
                  {registroActivo ? mesLabel(registroActivo.anio, registroActivo.mes) : '—'}
                </h1>
                <div className="text-xs text-muted-foreground truncate">
                  {registroActivo?.rancho_nombre ?? '—'}
                </div>
              </>
            )}
          </div>
          {vista === 'lista' && (
            <button
              onClick={() => setSheetConsolidado(true)}
              className="flex items-center gap-1.5 h-8 px-3 rounded-lg border border-border text-xs text-foreground"
              style={{ fontWeight: 600 }}
            >
              <FileDown className="w-3.5 h-3.5" />
              Consolidado
            </button>
          )}
          {vista === 'detalle' && registroActivo && (
            <button
              onClick={() => handlePDFIndividual(registroActivo.id)}
              disabled={!!generandoPDF}
              className="flex items-center gap-1.5 h-8 px-3 rounded-lg border border-border text-xs text-foreground disabled:opacity-50"
              style={{ fontWeight: 600 }}
            >
              {generandoPDF ? (
                <Loader2 className="w-3.5 h-3.5 animate-spin" />
              ) : (
                <FileDown className="w-3.5 h-3.5" />
              )}
              PDF mes
            </button>
          )}
        </div>
      </header>

      {/* ── LISTA ──────────────────────────────────────────────────────── */}
      {vista === 'lista' && (
        <div className="p-4 space-y-4">
          {error && (
            <div
              className="flex items-start gap-2 rounded-xl p-3"
              style={{ backgroundColor: 'var(--agro-danger-fill)', border: '1px solid var(--agro-red)' }}
            >
              <TriangleAlert className="w-4 h-4 flex-shrink-0 mt-0.5" style={{ color: 'var(--agro-danger-text)' }} />
              <p className="text-xs" style={{ color: 'var(--agro-danger-text)' }}>
                Error al cargar registros. Verifica tu conexión.
              </p>
            </div>
          )}

          {loading ? (
            <div className="flex justify-center py-12">
              <Loader2 className="w-6 h-6 text-primary animate-spin" />
            </div>
          ) : registros.length === 0 ? (
            <div className="bg-card border border-border rounded-xl p-6 text-center">
              <Settings className="w-8 h-8 text-muted-foreground mx-auto mb-3" />
              <p className="text-sm text-foreground" style={{ fontWeight: 600 }}>Sin registros aún</p>
              <p className="text-xs text-muted-foreground mt-1">
                Crea el primer registro mensual con el botón +
              </p>
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
                      <div className="flex items-center gap-2 flex-wrap mb-1">
                        <span
                          className="text-xs px-2 py-0.5 rounded"
                          style={{ backgroundColor: 'var(--agro-success-fill)', color: 'var(--agro-success-text)', fontWeight: 600 }}
                        >
                          {mesLabel(reg.anio, reg.mes)}
                        </span>
                      </div>
                      <span className="text-sm text-foreground truncate block" style={{ fontWeight: 600 }}>
                        {reg.rancho_nombre}
                      </span>
                      <span className="text-xs text-muted-foreground">{reg.rancho_codigo}</span>
                    </div>
                    <ChevronLeft className="w-4 h-4 text-muted-foreground rotate-180 flex-shrink-0 mt-0.5" />
                  </div>
                </button>
              ))}
            </div>
          )}
        </div>
      )}

      {/* ── DETALLE ────────────────────────────────────────────────────── */}
      {vista === 'detalle' && registroActivo && (
        <div className="p-4 space-y-4">
          <div className="flex gap-2 flex-wrap">
            <span
              className="text-xs px-2 py-1 rounded"
              style={{ backgroundColor: 'var(--agro-success-fill)', color: 'var(--agro-success-text)' }}
            >
              {mesLabel(registroActivo.anio, registroActivo.mes)}
            </span>
            <span
              className="text-xs px-2 py-1 rounded"
              style={{ backgroundColor: 'var(--muted)', color: 'var(--muted-foreground)' }}
            >
              {registroActivo.rancho_nombre} · {registroActivo.rancho_codigo}
            </span>
          </div>

          {/* Observaciones */}
          <div className="bg-card border border-border rounded-xl p-4 space-y-3">
            <h2 className="text-sm text-foreground" style={{ fontWeight: 600 }}>Observaciones del mes</h2>
            <textarea
              value={obsLocal}
              onChange={(e) => setObsLocal(e.target.value)}
              rows={2}
              placeholder="Observaciones generales…"
              className="w-full rounded-lg border border-border bg-input-background px-3 py-2 text-sm text-foreground placeholder:text-muted-foreground focus:outline-none focus:border-primary resize-none"
            />
            <button
              onClick={handleActualizarObs}
              disabled={savingMeta}
              className="h-9 px-4 rounded-xl text-sm text-white disabled:opacity-60"
              style={{ backgroundColor: 'var(--primary)', fontWeight: 600 }}
            >
              {savingMeta ? 'Guardando…' : 'Guardar observaciones'}
            </button>
          </div>

          {/* Acciones del mes */}
          <button
            onClick={abrirSheetAcciones}
            className="w-full flex items-center justify-between bg-card border border-border rounded-xl px-4 py-3"
          >
            <span className="text-sm text-foreground" style={{ fontWeight: 600 }}>Acciones del mes</span>
            <div className="flex items-center gap-2">
              {itemsConAccion > 0 && (
                <span
                  className="text-xs px-2 py-0.5 rounded"
                  style={{ backgroundColor: 'var(--agro-success-fill)', color: 'var(--agro-success-text)', fontWeight: 600 }}
                >
                  {itemsConAccion} con acción
                </span>
              )}
              <ChevronLeft className="w-4 h-4 text-muted-foreground rotate-180" />
            </div>
          </button>

          {/* Días registrados */}
          <div>
            <h2 className="text-sm text-foreground mb-3" style={{ fontWeight: 600 }}>
              Días registrados
            </h2>
            {loadingDetalle ? (
              <div className="flex justify-center py-6">
                <Loader2 className="w-5 h-5 text-primary animate-spin" />
              </div>
            ) : diasConData.length === 0 ? (
              <div className="bg-card border border-border rounded-xl p-6 text-center">
                <p className="text-sm text-foreground" style={{ fontWeight: 600 }}>Sin días aún</p>
                <p className="text-xs text-muted-foreground mt-1">
                  Registra el primer día con el botón +
                </p>
              </div>
            ) : (
              <div className="space-y-2">
                {diasConData.map(([dia, cnt]) => (
                  <DiaCard
                    key={dia}
                    dia={dia}
                    h={cnt.h}
                    n={cnt.n}
                    na={cnt.na}
                    onClick={() => abrirSheetDia(dia)}
                  />
                ))}
              </div>
            )}
          </div>
        </div>
      )}

      {/* ── FAB ────────────────────────────────────────────────────────── */}
      <button
        onClick={() => {
          if (vista === 'lista') {
            setSheetCrear(true)
            setErrRancho(false)
          } else {
            abrirSheetDia()
          }
        }}
        className="fixed bottom-[calc(72px+16px)] right-4 w-14 h-14 rounded-full flex items-center justify-center shadow-lg z-40"
        style={{ backgroundColor: 'var(--primary)' }}
        aria-label="Agregar"
      >
        <Plus className="w-6 h-6 text-white" />
      </button>

      {/* ── Sheet: crear registro ──────────────────────────────────────── */}
      {sheetCrear && (
        <div className="fixed inset-0 z-50 flex flex-col justify-end" onClick={(e) => { if (e.target === e.currentTarget) setSheetCrear(false) }}>
          <div className="absolute inset-0 bg-black/40" />
          <div className="relative bg-card rounded-t-[10px] flex flex-col" style={{ maxHeight: '85dvh' }}>
            <div className="w-10 h-1 bg-border rounded-full mx-auto mt-3 mb-4 flex-shrink-0" />
            <div className="px-4 pb-2 flex-shrink-0">
              <h2 className="text-base text-foreground" style={{ fontWeight: 700 }}>Nuevo registro mensual</h2>
            </div>
            <div className="flex-1 overflow-y-auto px-4 pb-6 space-y-4">
              <div>
                <label className="block text-xs text-muted-foreground mb-1.5">{termino} *</label>
                <select
                  value={nRanchoId}
                  onChange={(e) => { setNRanchoId(e.target.value); setErrRancho(false) }}
                  className="w-full rounded-xl border bg-input-background px-3 py-2.5 text-sm text-foreground focus:outline-none focus:border-primary"
                  style={{ borderColor: errRancho ? 'var(--agro-red)' : 'var(--border)' }}
                >
                  <option value="">Seleccionar…</option>
                  {ranchoOptions.map((o) => (
                    <option key={o.value} value={o.value}>{o.label}</option>
                  ))}
                </select>
                {errRancho && (
                  <p className="text-xs mt-1" style={{ color: 'var(--agro-danger-text)' }}>
                    Selecciona una {termino.toLowerCase()}
                  </p>
                )}
              </div>
              <div>
                <label className="block text-xs text-muted-foreground mb-1.5">Mes</label>
                <input
                  type="month"
                  value={nMes}
                  onChange={(e) => setNMes(e.target.value)}
                  className="w-full rounded-xl border border-border bg-input-background px-3 py-2.5 text-sm text-foreground focus:outline-none focus:border-primary"
                />
              </div>
              <button
                onClick={handleCrearRegistro}
                disabled={creando}
                className="w-full h-12 rounded-xl text-sm text-white disabled:opacity-60"
                style={{ backgroundColor: 'var(--primary)', fontWeight: 600 }}
              >
                {creando ? 'Creando…' : 'Crear registro'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ── Sheet: capturar día ───────────────────────────────────────── */}
      {sheetDia && registroActivo && (
        <div className="fixed inset-0 z-50 flex flex-col justify-end" onClick={(e) => { if (e.target === e.currentTarget) setSheetDia(false) }}>
          <div className="absolute inset-0 bg-black/40" />
          <div className="relative bg-card rounded-t-[10px] flex flex-col" style={{ maxHeight: '85dvh' }}>
            <div className="w-10 h-1 bg-border rounded-full mx-auto mt-3 mb-4 flex-shrink-0" />
            <div className="px-4 pb-2 flex-shrink-0">
              <h2 className="text-base text-foreground" style={{ fontWeight: 700 }}>Capturar día</h2>
              <p className="text-xs text-muted-foreground mt-0.5">
                Toca cada elemento para cambiar su estado. Se guarda con UPSERT (sobrescribe si ya existe).
              </p>
            </div>
            <div className="flex-1 overflow-y-auto px-4 pb-6 space-y-3">
              <div>
                <label className="block text-xs text-muted-foreground mb-1.5">Fecha</label>
                <input
                  type="date"
                  value={dFecha}
                  min={`${registroActivo.anio}-${String(registroActivo.mes).padStart(2, '0')}-01`}
                  max={ultimoDiaMes(registroActivo.anio, registroActivo.mes)}
                  onChange={(e) => {
                    if (!e.target.value) return
                    setDFecha(e.target.value)
                    const newDia = new Date(e.target.value + 'T12:00:00').getDate()
                    const init: Record<string, ValorM45> = {}
                    for (const item of items) {
                      init[item.id] = (resultadosMap[item.id]?.[newDia] as ValorM45 | undefined) ?? 'hecho'
                    }
                    setDValores(init)
                  }}
                  className="w-full rounded-xl border border-border bg-input-background px-3 py-2.5 text-sm text-foreground focus:outline-none focus:border-primary"
                />
              </div>

              {/* Areas colapsables */}
              {areasOrdenadas.map((area) => {
                const areaItems = items.filter((i) => i.area === area)
                if (!areaItems.length) return null
                const expanded = expandedAreasDia.has(area)
                return (
                  <div key={area} className="border border-border rounded-xl overflow-hidden">
                    <button
                      onClick={() => toggleAreaDia(area)}
                      className="w-full flex items-center justify-between px-3 py-2.5 text-xs"
                      style={{ backgroundColor: 'var(--muted)', fontWeight: 600 }}
                    >
                      <span className="text-foreground">{area}</span>
                      <ChevronLeft
                        className="w-4 h-4 text-muted-foreground flex-shrink-0"
                        style={{ transform: expanded ? 'rotate(-90deg)' : 'rotate(90deg)', transition: 'transform 0.15s' }}
                      />
                    </button>
                    {expanded && (
                      <div>
                        {areaItems.map((item) => {
                          const v = dValores[item.id] ?? 'hecho'
                          return (
                            <button
                              key={item.id}
                              onClick={() =>
                                setDValores((prev) => ({ ...prev, [item.id]: siguienteValor(prev[item.id] ?? 'hecho') }))
                              }
                              className="w-full flex items-center gap-2 px-3 py-2 text-left border-t border-border"
                            >
                              <span className="flex-1 text-xs text-foreground">{item.nombre}</span>
                              {item.frecuencia && (
                                <span className="text-[10px] text-muted-foreground flex-shrink-0">
                                  {frecuenciaLabel(item.frecuencia)}
                                </span>
                              )}
                              <span
                                className="text-xs px-2 py-0.5 rounded flex-shrink-0"
                                style={{
                                  fontWeight: 600,
                                  backgroundColor: v === 'hecho'
                                    ? 'var(--agro-success-fill)'
                                    : v === 'no_hecho'
                                    ? 'var(--agro-danger-fill)'
                                    : 'var(--muted)',
                                  color: v === 'hecho'
                                    ? 'var(--agro-success-text)'
                                    : v === 'no_hecho'
                                    ? 'var(--agro-danger-text)'
                                    : 'var(--muted-foreground)',
                                }}
                              >
                                {valorLabel(v)}
                              </span>
                            </button>
                          )
                        })}
                      </div>
                    )}
                  </div>
                )
              })}

              <button
                onClick={handleGuardarDia}
                disabled={dGuardando || items.length === 0}
                className="w-full h-12 rounded-xl text-sm text-white disabled:opacity-60"
                style={{ backgroundColor: 'var(--primary)', fontWeight: 600 }}
              >
                {dGuardando ? 'Guardando…' : 'Guardar día'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ── Sheet: acciones del mes ────────────────────────────────────── */}
      {sheetAcciones && registroActivo && (
        <div className="fixed inset-0 z-50 flex flex-col justify-end" onClick={(e) => { if (e.target === e.currentTarget) setSheetAcciones(false) }}>
          <div className="absolute inset-0 bg-black/40" />
          <div className="relative bg-card rounded-t-[10px] flex flex-col" style={{ maxHeight: '85dvh' }}>
            <div className="w-10 h-1 bg-border rounded-full mx-auto mt-3 mb-4 flex-shrink-0" />
            <div className="px-4 pb-2 flex-shrink-0">
              <h2 className="text-base text-foreground" style={{ fontWeight: 700 }}>Acciones del mes</h2>
              <p className="text-xs text-muted-foreground mt-0.5">
                Rev.Gral · Cam.Aceites · Cam.Piezas · Rev.Eléctrico
              </p>
            </div>
            <div className="flex-1 overflow-y-auto px-4 pb-6 space-y-3">
              {areasOrdenadas.map((area) => {
                const areaItems = items.filter((i) => i.area === area)
                if (!areaItems.length) return null
                const expanded = expandedAreasAcc.has(area)
                return (
                  <div key={area} className="border border-border rounded-xl overflow-hidden">
                    <button
                      onClick={() => toggleAreaAcc(area)}
                      className="w-full flex items-center justify-between px-3 py-2.5 text-xs"
                      style={{ backgroundColor: 'var(--muted)', fontWeight: 600 }}
                    >
                      <span className="text-foreground">{area}</span>
                      <ChevronLeft
                        className="w-4 h-4 text-muted-foreground flex-shrink-0"
                        style={{ transform: expanded ? 'rotate(-90deg)' : 'rotate(90deg)', transition: 'transform 0.15s' }}
                      />
                    </button>
                    {expanded && (
                      <div>
                        {areaItems.map((item) => {
                          const acc = accionesLocal[item.id] ?? {
                            revision_general: false, cambio_aceites: false,
                            cambio_piezas: false, revision_electrico: false,
                          }
                          return (
                            <div key={item.id} className="flex items-center gap-3 px-3 py-2.5 border-t border-border">
                              <p className="flex-1 text-xs text-foreground leading-snug">{item.nombre}</p>
                              <div className="flex gap-2 flex-shrink-0">
                                <AccionToggle label="Rev.G" value={acc.revision_general}  onChange={(v) => setAccion(item.id, 'revision_general',  v)} />
                                <AccionToggle label="C.Ac"  value={acc.cambio_aceites}    onChange={(v) => setAccion(item.id, 'cambio_aceites',    v)} />
                                <AccionToggle label="C.Pz"  value={acc.cambio_piezas}     onChange={(v) => setAccion(item.id, 'cambio_piezas',     v)} />
                                <AccionToggle label="Rev.E" value={acc.revision_electrico} onChange={(v) => setAccion(item.id, 'revision_electrico', v)} />
                              </div>
                            </div>
                          )
                        })}
                      </div>
                    )}
                  </div>
                )
              })}

              <button
                onClick={handleGuardarAcciones}
                disabled={savingAcciones}
                className="w-full h-12 rounded-xl text-sm text-white disabled:opacity-60"
                style={{ backgroundColor: 'var(--primary)', fontWeight: 600 }}
              >
                {savingAcciones ? (
                  <span className="flex items-center justify-center gap-2">
                    <Loader2 className="w-4 h-4 animate-spin" />
                    Guardando…
                  </span>
                ) : 'Guardar acciones'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ── Sheet: consolidado ─────────────────────────────────────────── */}
      {sheetConsolidado && (
        <div className="fixed inset-0 z-50 flex flex-col justify-end" onClick={(e) => { if (e.target === e.currentTarget) setSheetConsolidado(false) }}>
          <div className="absolute inset-0 bg-black/40" />
          <div className="relative bg-card rounded-t-[10px] flex flex-col" style={{ maxHeight: '85dvh' }}>
            <div className="w-10 h-1 bg-border rounded-full mx-auto mt-3 mb-4 flex-shrink-0" />
            <div className="px-4 pb-2 flex-shrink-0">
              <h2 className="text-base text-foreground" style={{ fontWeight: 700 }}>Exportar PDF consolidado</h2>
            </div>
            <div className="flex-1 overflow-y-auto px-4 pb-6 space-y-4">
              <div>
                <label className="block text-xs text-muted-foreground mb-1.5">{termino} *</label>
                <select
                  value={cRanchoId}
                  onChange={(e) => { setCRanchoId(e.target.value); setCErrRancho(false) }}
                  className="w-full rounded-xl border bg-input-background px-3 py-2.5 text-sm text-foreground focus:outline-none focus:border-primary"
                  style={{ borderColor: cErrRancho ? 'var(--agro-red)' : 'var(--border)' }}
                >
                  <option value="">Seleccionar…</option>
                  {ranchoOptions.map((o) => (
                    <option key={o.value} value={o.value}>{o.label}</option>
                  ))}
                </select>
                {cErrRancho && (
                  <p className="text-xs mt-1" style={{ color: 'var(--agro-danger-text)' }}>
                    Selecciona una {termino.toLowerCase()}
                  </p>
                )}
              </div>
              <div>
                <label className="block text-xs text-muted-foreground mb-1.5">Desde (mes)</label>
                <input
                  type="month"
                  value={cDesde}
                  onChange={(e) => setCDesde(e.target.value)}
                  className="w-full rounded-xl border border-border bg-input-background px-3 py-2.5 text-sm text-foreground focus:outline-none focus:border-primary"
                />
              </div>
              <div>
                <label className="block text-xs text-muted-foreground mb-1.5">Hasta (mes)</label>
                <input
                  type="month"
                  value={cHasta}
                  onChange={(e) => setCHasta(e.target.value)}
                  className="w-full rounded-xl border border-border bg-input-background px-3 py-2.5 text-sm text-foreground focus:outline-none focus:border-primary"
                />
              </div>
              <button
                onClick={handleConsolidado}
                disabled={cGenerando}
                className="w-full h-12 rounded-xl text-sm text-white disabled:opacity-60"
                style={{ backgroundColor: 'var(--primary)', fontWeight: 600 }}
              >
                {cGenerando ? (
                  <span className="flex items-center justify-center gap-2">
                    <Loader2 className="w-4 h-4 animate-spin" />
                    Generando PDF…
                  </span>
                ) : 'Generar PDF consolidado'}
              </button>
            </div>
          </div>
        </div>
      )}

    </div>
  )
}
