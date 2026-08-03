// ╔══════════════════════════════════════════════════════════════════════╗
// ║  M9 — Monitoreo Perimetral de Plagas                                ║
// ║  Patrón: lista de registros mensuales (rancho+mes) → detalle        ║
// ║  → agregar días de inspección → matriz de 36 ítems (Sí/No)         ║
// ║  org_id SIEMPRE del contexto de auth, nunca del usuario             ║
// ╚══════════════════════════════════════════════════════════════════════╝

import { useState, useEffect, useCallback, useMemo } from 'react'
import {
  ChevronLeft, Plus, FileDown, Loader2, Navigation,
  TriangleAlert, CalendarDays, Warehouse, X,
} from 'lucide-react'
import { Link } from 'react-router'
import { BottomSheet } from '@/app/components/BottomSheet'
import { toast } from 'sonner'
import { useAuthContext } from '@/context/AuthContext'
import { useRanchos } from '@/hooks/useRanchos'
import { useM9Perimetral, type M9RegistroResumen, type M9DiaConResultados } from '@/hooks/useM9Perimetral'
import { supabase } from '@/lib/supabase'
import type { M9ItemCatalogo } from '@/types/database.types'
import { generarPerimetralPDF } from '@/lib/pdf/m9/generarPerimetralPDF'
import { generarPerimetralConsolidadoPDF } from '@/lib/pdf/m9/generarPerimetralConsolidadoPDF'
import { useModulosContext } from '@/context/ModulosContext'

// ── Helpers ───────────────────────────────────────────────────────────────────

function hoy(): string {
  return new Date().toISOString().split('T')[0]
}

function mesActual(): string {
  const d = new Date()
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`
}

function formatMesLabel(isoDate: string): string {
  try {
    const label = new Date(isoDate + 'T12:00:00').toLocaleDateString('es-MX', {
      month: 'long', year: 'numeric',
    })
    return label.charAt(0).toUpperCase() + label.slice(1)
  } catch { return isoDate }
}

function formatFechaCorta(iso: string): string {
  try {
    return new Date(iso + 'T12:00:00').toLocaleDateString('es-MX', {
      day: 'numeric', month: 'short', year: 'numeric',
    })
  } catch { return iso }
}

function ultimoDiaMes(mesISO: string): string {
  try {
    const d = new Date(mesISO + 'T12:00:00')
    const ultimo = new Date(d.getFullYear(), d.getMonth() + 1, 0)
    return ultimo.toISOString().split('T')[0]
  } catch { return mesISO }
}

function agruparItemsPorSeccion(items: M9ItemCatalogo[]) {
  const grupos: { label: string; items: M9ItemCatalogo[] }[] = []
  let actual: { label: string; items: M9ItemCatalogo[] } | null = null
  for (const item of items) {
    if (!actual || actual.label !== item.seccion_label) {
      actual = { label: item.seccion_label, items: [] }
      grupos.push(actual)
    }
    actual.items.push(item)
  }
  return grupos
}

// ── Toggle de ítem ────────────────────────────────────────────────────────────

function ToggleItem({
  label,
  valor,
  onChange,
}: {
  label: string
  valor: boolean
  onChange: (v: boolean) => void
}) {
  return (
    <div className="flex items-center justify-between py-2.5 border-b border-border last:border-0">
      <span className="text-sm text-foreground flex-1 pr-3">{label}</span>
      <button
        type="button"
        onClick={() => onChange(!valor)}
        className="flex-shrink-0 w-16 h-7 rounded-full text-xs transition-colors"
        style={{
          fontWeight: 600,
          backgroundColor: valor ? 'var(--primary)' : 'var(--switch-background)',
          color: valor ? '#fff' : 'var(--muted-foreground)',
        }}
      >
        {valor ? 'Sí' : 'No'}
      </button>
    </div>
  )
}

// ── Card de día de inspección ─────────────────────────────────────────────────

function DiaCard({
  dia,
  items,
}: {
  dia: M9DiaConResultados
  items: M9ItemCatalogo[]
}) {
  const numSi  = dia.resultados.filter((r) => r.valor).length
  const numNo  = dia.resultados.filter((r) => !r.valor).length

  return (
    <div className="bg-card border border-border rounded-xl p-4">
      <div className="flex items-center gap-2 mb-2">
        <CalendarDays className="w-4 h-4 text-primary flex-shrink-0" />
        <span className="text-sm text-foreground" style={{ fontWeight: 600 }}>
          {formatFechaCorta(dia.fecha)}
        </span>
      </div>
      <div className="flex gap-2">
        <span
          className="text-xs px-2 py-0.5 rounded"
          style={{
            backgroundColor: 'var(--agro-success-fill)',
            color: 'var(--agro-success-text)',
            fontWeight: 600,
          }}
        >
          {numSi} Sí
        </span>
        <span
          className="text-xs px-2 py-0.5 rounded"
          style={{
            backgroundColor: numNo > 0 ? 'var(--agro-danger-fill)' : 'var(--muted)',
            color: numNo > 0 ? 'var(--agro-danger-text)' : 'var(--muted-foreground)',
            fontWeight: 600,
          }}
        >
          {numNo} No
        </span>
        {dia.resultados.length === 0 && (
          <span className="text-xs text-muted-foreground">{items.length} ítems registrados</span>
        )}
      </div>
    </div>
  )
}

// ── Pantalla principal ────────────────────────────────────────────────────────

type Vista = 'lista' | 'detalle'

export function InspeccionPerimetral() {
  const { profile, user } = useAuthContext()
  const { ranchos } = useRanchos()
  const { registros, loading, error, refetch } = useM9Perimetral()
  const { terminosSitio } = useModulosContext()

  // ── Navegación interna ──
  const [vista, setVista] = useState<Vista>('lista')
  const [registroActivo, setRegistroActivo] = useState<M9RegistroResumen | null>(null)

  // ── Catálogo global de ítems (cargado una vez) ──
  const [items, setItems] = useState<M9ItemCatalogo[]>([])
  const [loadingItems, setLoadingItems] = useState(false)

  useEffect(() => {
    let cancelado = false
    setLoadingItems(true)
    supabase
      .from('m9_items_catalogo')
      .select('*')
      .order('orden')
      .then(({ data }) => {
        if (!cancelado) { setItems((data ?? []) as M9ItemCatalogo[]); setLoadingItems(false) }
      })
    return () => { cancelado = true }
  }, [])

  // ── Datos del detalle ──
  const [dias, setDias] = useState<M9DiaConResultados[]>([])
  const [loadingDias, setLoadingDias] = useState(false)
  const [obsLocal, setObsLocal] = useState('')
  const [otroLocal, setOtroLocal] = useState('')
  const [savingObs, setSavingObs] = useState(false)

  const cargarDias = useCallback(async (regId: string) => {
    if (!profile?.org_id) return
    setLoadingDias(true)
    try {
      const { data: diasData, error: dErr } = await supabase
        .from('m9_dias_inspeccion')
        .select('id, fecha')
        .eq('registro_id', regId)
        .eq('org_id', profile.org_id)
        .order('fecha')
      if (dErr) throw dErr

      const diaIds = (diasData ?? []).map((d: any) => d.id as string)
      const diaFechaMap: Record<string, string> = {}
      for (const d of diasData ?? []) diaFechaMap[(d as any).id] = (d as any).fecha

      let resData: any[] = []
      if (diaIds.length > 0) {
        const { data: r, error: rErr } = await supabase
          .from('m9_resultados')
          .select('dia_id, item_id, valor')
          .in('dia_id', diaIds)
          .eq('org_id', profile.org_id)
        if (rErr) throw rErr
        resData = r ?? []
      }

      const diaMap = new Map<string, M9DiaConResultados>()
      for (const d of diasData ?? []) {
        diaMap.set((d as any).id, { id: (d as any).id, fecha: (d as any).fecha, resultados: [] })
      }
      for (const r of resData) {
        diaMap.get(r.dia_id)?.resultados.push({ item_id: r.item_id, valor: r.valor })
      }

      setDias(Array.from(diaMap.values()))
    } catch (e: unknown) {
      toast.error(e instanceof Error ? e.message : 'Error al cargar días')
    } finally {
      setLoadingDias(false)
    }
  }, [profile?.org_id])

  const abrirDetalle = (reg: M9RegistroResumen) => {
    setRegistroActivo(reg)
    setObsLocal(reg.observaciones ?? '')
    setOtroLocal(reg.otro ?? '')
    setDias([])
    setVista('detalle')
    cargarDias(reg.id)
  }

  const volverALista = () => {
    setVista('lista')
    setRegistroActivo(null)
    setDias([])
  }

  async function handleGuardarObs() {
    if (!registroActivo || !profile?.org_id) return
    setSavingObs(true)
    try {
      const { error: e } = await supabase
        .from('m9_registro_mensual')
        .update({ observaciones: obsLocal || null, otro: otroLocal || null })
        .eq('id', registroActivo.id)
        .eq('org_id', profile.org_id)
      if (e) throw e
      setRegistroActivo((prev) =>
        prev ? { ...prev, observaciones: obsLocal || null, otro: otroLocal || null } : prev
      )
      refetch()
      toast.success('Observaciones guardadas')
    } catch (e: unknown) {
      toast.error(e instanceof Error ? e.message : 'Error al guardar')
    } finally {
      setSavingObs(false)
    }
  }

  // ── Sheets ──
  const [sheetNuevo, setSheetNuevo] = useState(false)
  const [sheetDia, setSheetDia] = useState(false)
  const [sheetConsolidado, setSheetConsolidado] = useState(false)

  // ── Sheet: nuevo registro mensual ──
  const [nRanchoId, setNRanchoId]     = useState('')
  const [nMes, setNMes]               = useState(mesActual)
  const [nAlmacen, setNAlmacen]       = useState(false)
  const [nYaExiste, setNYaExiste]     = useState(false)
  const [nGuardando, setNGuardando]   = useState(false)
  const [nErrRancho, setNErrRancho]   = useState(false)

  useEffect(() => {
    if (!sheetNuevo) { setNYaExiste(false); return }
    if (!nRanchoId || !nMes || !profile?.org_id) { setNYaExiste(false); return }
    let cancelado = false
    supabase
      .from('m9_registro_mensual')
      .select('id')
      .eq('org_id', profile.org_id)
      .eq('rancho_id', nRanchoId)
      .eq('mes', nMes + '-01')
      .maybeSingle()
      .then(({ data }) => { if (!cancelado) setNYaExiste(!!data) })
    return () => { cancelado = true }
  }, [sheetNuevo, nRanchoId, nMes, profile?.org_id])

  async function handleCrearRegistro() {
    if (!nRanchoId) { setNErrRancho(true); return }
    if (!profile?.org_id) { toast.error('Sin organización activa'); return }
    if (nYaExiste) { toast.warning(`Ya existe un registro para este mes y ${terminosSitio.singular.toLowerCase()}`); return }
    setNGuardando(true)
    try {
      const { data, error: e } = await supabase
        .from('m9_registro_mensual')
        .insert({
          rancho_id: nRanchoId,
          org_id: profile.org_id,
          mes: nMes + '-01',
          tiene_almacen: nAlmacen,
          responsable_id: user?.id ?? null,
        })
        .select('*, ranchos(nombre, codigo), profiles!responsable_id(nombre_completo)')
        .single()
      if (e) throw e
      toast.success('Registro mensual creado')
      setSheetNuevo(false)
      await refetch()
      // Abrir detalle del nuevo registro
      const r = data as any
      const nuevo: M9RegistroResumen = {
        id: r.id,
        rancho_id: r.rancho_id,
        rancho_nombre: r.ranchos?.nombre ?? '—',
        rancho_codigo: r.ranchos?.codigo ?? '—',
        mes: r.mes,
        tiene_almacen: r.tiene_almacen,
        responsable_id: r.responsable_id,
        responsable_nombre: r.profiles?.nombre_completo ?? null,
        observaciones: null,
        otro: null,
        created_at: r.created_at,
      }
      abrirDetalle(nuevo)
    } catch (e: unknown) {
      const msg = e instanceof Error ? e.message : 'Error al crear registro'
      if (msg.includes('23505') || msg.includes('unique') || msg.includes('duplicate')) {
        toast.warning(`Ya existe un registro para este mes y ${terminosSitio.singular.toLowerCase()}`)
      } else {
        toast.error(msg)
      }
    } finally {
      setNGuardando(false)
    }
  }

  // ── Sheet: agregar día de inspección ──
  const [dFecha, setDFecha]         = useState('')
  const [dValores, setDValores]     = useState<Record<string, boolean>>({})
  const [dGuardando, setDGuardando] = useState(false)
  const [dErrFecha, setDErrFecha]   = useState(false)
  const [dYaExiste, setDYaExiste]   = useState(false)

  const itemsVisibles = useMemo(() => {
    if (!registroActivo) return []
    return registroActivo.tiene_almacen ? items : items.filter((i) => !i.es_almacen)
  }, [items, registroActivo])

  const seccionesAgrupadas = useMemo(() => agruparItemsPorSeccion(itemsVisibles), [itemsVisibles])

  useEffect(() => {
    if (!sheetDia || itemsVisibles.length === 0) return
    const init: Record<string, boolean> = {}
    itemsVisibles.forEach((i) => { init[i.id] = i.default_valor })
    setDValores(init)
    setDFecha(registroActivo ? registroActivo.mes.slice(0, 7) + '-01' : hoy())
    setDErrFecha(false)
    setDYaExiste(false)
  }, [sheetDia, itemsVisibles, registroActivo])

  useEffect(() => {
    if (!sheetDia || !dFecha || !registroActivo || !profile?.org_id) {
      setDYaExiste(false); return
    }
    let cancelado = false
    supabase
      .from('m9_dias_inspeccion')
      .select('id')
      .eq('registro_id', registroActivo.id)
      .eq('org_id', profile.org_id)
      .eq('fecha', dFecha)
      .maybeSingle()
      .then(({ data }) => { if (!cancelado) setDYaExiste(!!data) })
    return () => { cancelado = true }
  }, [sheetDia, dFecha, registroActivo, profile?.org_id])

  async function handleGuardarDia() {
    if (!dFecha) { setDErrFecha(true); return }
    if (!registroActivo || !profile?.org_id) { toast.error('Sin registro activo'); return }
    if (dYaExiste) { toast.warning('Ya existe una inspección para esa fecha en este registro'); return }

    // Validar fecha dentro del mes
    const mes = registroActivo.mes.slice(0, 7)
    if (!dFecha.startsWith(mes)) {
      toast.error('La fecha debe estar dentro del mes del registro')
      return
    }

    setDGuardando(true)
    try {
      // INSERT día
      const { data: diaData, error: dErr } = await supabase
        .from('m9_dias_inspeccion')
        .insert({ registro_id: registroActivo.id, org_id: profile.org_id, fecha: dFecha })
        .select('id')
        .single()
      if (dErr) throw dErr
      const diaId = (diaData as any).id as string

      // Batch INSERT resultados
      const batchResultados = itemsVisibles.map((item) => ({
        dia_id: diaId,
        item_id: item.id,
        org_id: profile.org_id,
        valor: dValores[item.id] ?? item.default_valor,
      }))
      const { error: rErr } = await supabase.from('m9_resultados').insert(batchResultados)
      if (rErr) throw rErr

      toast.success('Día de inspección guardado')
      setSheetDia(false)
      cargarDias(registroActivo.id)
    } catch (e: unknown) {
      const msg = e instanceof Error ? e.message : 'Error al guardar día'
      if (msg.includes('23505') || msg.includes('unique') || msg.includes('duplicate')) {
        toast.warning('Ya existe una inspección para esa fecha')
      } else {
        toast.error(msg)
      }
    } finally {
      setDGuardando(false)
    }
  }

  // ── Sheet: exportar consolidado ──
  const [cRanchoId, setCRanchoId]   = useState('')
  const [cDesde, setCDesde]         = useState(mesActual)
  const [cHasta, setCHasta]         = useState(mesActual)
  const [cGenerando, setCGenerando] = useState(false)
  const [cErrRancho, setCErrRancho] = useState(false)

  async function handleConsolidado() {
    if (!cRanchoId) { setCErrRancho(true); return }
    if (!profile?.org_id) { toast.error('Sin organización activa'); return }
    setCGenerando(true)
    try {
      const ranchoNombre = ranchos.find((r) => r.id === cRanchoId)?.nombre ?? cRanchoId
      await generarPerimetralConsolidadoPDF(cRanchoId, ranchoNombre, profile.org_id, cDesde, cHasta)
      toast.success('PDF consolidado generado')
      setSheetConsolidado(false)
    } catch (e: unknown) {
      toast.error(e instanceof Error ? e.message : 'Error al generar PDF')
    } finally {
      setCGenerando(false)
    }
  }

  // ── PDF individual ──
  const [generandoPDF, setGenerandoPDF] = useState<string | null>(null)

  async function handlePDFIndividual(regId: string) {
    if (!profile?.org_id) return
    setGenerandoPDF(regId)
    try {
      await generarPerimetralPDF(regId, profile.org_id)
      toast.success('PDF descargado')
    } catch (e: unknown) {
      toast.error(e instanceof Error ? e.message : 'Error al generar PDF')
    } finally {
      setGenerandoPDF(null)
    }
  }

  // ── Render ────────────────────────────────────────────────────────────────

  const ranchoOptions = ranchos.map((r) => ({ value: r.id, label: `${r.nombre} (${r.codigo})` }))

  return (
    <div className="min-h-full pb-[calc(72px+34px)]">

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
            <Navigation className="w-4 h-4 text-primary" />
          </div>
          <div className="flex-1 min-w-0">
            {vista === 'lista' ? (
              <>
                <h1 className="text-sm text-foreground truncate" style={{ fontWeight: 600 }}>
                  Monitoreo Perimetral
                </h1>
                <div className="text-xs text-muted-foreground">Semanal</div>
              </>
            ) : (
              <>
                <h1 className="text-sm text-foreground truncate" style={{ fontWeight: 600 }}>
                  {registroActivo ? formatMesLabel(registroActivo.mes) : '—'}
                </h1>
                <div className="text-xs text-muted-foreground truncate">
                  {registroActivo?.rancho_nombre ?? '—'}
                </div>
              </>
            )}
          </div>
          {vista === 'lista' && (
            <button
              onClick={() => { setSheetConsolidado(true) }}
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
              disabled={generandoPDF === registroActivo.id || dias.length === 0}
              className="flex items-center gap-1.5 h-8 px-3 rounded-lg border border-border text-xs text-foreground disabled:opacity-50"
              style={{ fontWeight: 600 }}
            >
              {generandoPDF === registroActivo.id ? (
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
              <Navigation className="w-8 h-8 text-muted-foreground mx-auto mb-3" />
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
                          style={{
                            backgroundColor: 'var(--agro-success-fill)',
                            color: 'var(--agro-success-text)',
                            fontWeight: 600,
                          }}
                        >
                          {formatMesLabel(reg.mes)}
                        </span>
                        {reg.tiene_almacen && (
                          <span
                            className="text-xs px-2 py-0.5 rounded flex items-center gap-1"
                            style={{
                              backgroundColor: 'var(--muted)',
                              color: 'var(--muted-foreground)',
                            }}
                          >
                            <Warehouse className="w-3 h-3" />
                            Almacén
                          </span>
                        )}
                      </div>
                      <div className="text-sm text-foreground truncate" style={{ fontWeight: 600 }}>
                        {reg.rancho_nombre}
                      </div>
                      {reg.responsable_nombre && (
                        <div className="text-xs text-muted-foreground mt-0.5">
                          Resp: {reg.responsable_nombre}
                        </div>
                      )}
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

          {/* Chips de meta */}
          <div className="flex gap-2 flex-wrap">
            <span
              className="text-xs px-2 py-1 rounded"
              style={{ backgroundColor: 'var(--agro-success-fill)', color: 'var(--agro-success-text)' }}
            >
              {formatMesLabel(registroActivo.mes)}
            </span>
            <span
              className="text-xs px-2 py-1 rounded"
              style={{ backgroundColor: 'var(--muted)', color: 'var(--muted-foreground)' }}
            >
              {registroActivo.rancho_nombre} · {registroActivo.rancho_codigo}
            </span>
            <span
              className="text-xs px-2 py-1 rounded flex items-center gap-1"
              style={{
                backgroundColor: registroActivo.tiene_almacen ? 'var(--agro-success-fill)' : 'var(--muted)',
                color: registroActivo.tiene_almacen ? 'var(--agro-success-text)' : 'var(--muted-foreground)',
              }}
            >
              <Warehouse className="w-3 h-3" />
              Almacén: {registroActivo.tiene_almacen ? 'Sí' : 'No'}
            </span>
          </div>

          {/* Observaciones y Otro */}
          <div className="bg-card border border-border rounded-xl p-4 space-y-3">
            <h2 className="text-sm text-foreground" style={{ fontWeight: 600 }}>
              Notas del registro
            </h2>
            <div className="space-y-1">
              <label className="text-xs text-muted-foreground" style={{ fontWeight: 600 }}>
                Observaciones
              </label>
              <textarea
                value={obsLocal}
                onChange={(e) => setObsLocal(e.target.value)}
                rows={2}
                placeholder="Observaciones generales del mes…"
                className="w-full rounded-lg border border-border bg-input-background px-3 py-2 text-sm text-foreground placeholder:text-muted-foreground focus:outline-none focus:border-primary resize-none"
              />
            </div>
            <div className="space-y-1">
              <label className="text-xs text-muted-foreground" style={{ fontWeight: 600 }}>
                Otro
              </label>
              <textarea
                value={otroLocal}
                onChange={(e) => setOtroLocal(e.target.value)}
                rows={2}
                placeholder="Otro comentario relevante…"
                className="w-full rounded-lg border border-border bg-input-background px-3 py-2 text-sm text-foreground placeholder:text-muted-foreground focus:outline-none focus:border-primary resize-none"
              />
            </div>
            <button
              onClick={handleGuardarObs}
              disabled={savingObs}
              className="h-9 px-4 rounded-xl text-sm text-white disabled:opacity-60 transition-colors"
              style={{ backgroundColor: 'var(--primary)', fontWeight: 600 }}
            >
              {savingObs ? 'Guardando…' : 'Guardar notas'}
            </button>
          </div>

          {/* Días de inspección */}
          <div>
            <h2 className="text-sm text-foreground mb-3" style={{ fontWeight: 600 }}>
              Días de inspección
            </h2>

            {loadingDias ? (
              <div className="flex justify-center py-6">
                <Loader2 className="w-5 h-5 text-primary animate-spin" />
              </div>
            ) : dias.length === 0 ? (
              <div className="bg-card border border-border rounded-xl p-6 text-center">
                <CalendarDays className="w-7 h-7 text-muted-foreground mx-auto mb-2" />
                <p className="text-sm text-muted-foreground">
                  Sin días de inspección aún. Agrega el primer día con el botón +
                </p>
              </div>
            ) : (
              <div className="space-y-3">
                {dias.map((d) => (
                  <DiaCard key={d.id} dia={d} items={itemsVisibles} />
                ))}
              </div>
            )}
          </div>
        </div>
      )}

      {/* ── FAB ────────────────────────────────────────────────────────── */}
      <div className="fixed bottom-[calc(72px+34px+16px)] left-1/2 -translate-x-1/2 w-full max-w-[390px] flex justify-end px-4 pointer-events-none z-10">
        <button
          onClick={() => {
            if (vista === 'lista') {
              setNRanchoId(''); setNMes(mesActual()); setNAlmacen(false)
              setNErrRancho(false); setNYaExiste(false)
              setSheetNuevo(true)
            } else {
              setDFecha(''); setDErrFecha(false); setDYaExiste(false)
              setSheetDia(true)
            }
          }}
          className="pointer-events-auto w-14 h-14 bg-primary rounded-full flex items-center justify-center shadow-lg hover:bg-agro-blue transition-colors"
          aria-label={vista === 'lista' ? 'Nuevo registro mensual' : 'Agregar día de inspección'}
        >
          <Plus className="w-6 h-6 text-white" />
        </button>
      </div>

      {/* ═══ SHEET: NUEVO REGISTRO MENSUAL ═══════════════════════════════ */}
      <BottomSheet open={sheetNuevo} onClose={() => setSheetNuevo(false)} height="85%">
            {/* Handle */}
            <div className="flex justify-center pt-3 pb-1">
              <div className="w-9 h-1 rounded-full bg-border" />
            </div>

            <div className="px-4 pb-4">
              <div className="flex items-center justify-between mb-4">
                <h2 className="text-base text-foreground" style={{ fontWeight: 600 }}>
                  Nuevo registro mensual
                </h2>
                <button onClick={() => setSheetNuevo(false)}>
                  <X className="w-5 h-5 text-muted-foreground" />
                </button>
              </div>

              <div className="space-y-4">
                {/* Rancho */}
                <div className="space-y-1">
                  <label className="text-xs text-muted-foreground" style={{ fontWeight: 600 }}>
                    {terminosSitio.singular} *
                  </label>
                  <select
                    value={nRanchoId}
                    onChange={(e) => { setNRanchoId(e.target.value); setNErrRancho(false) }}
                    className="w-full h-11 px-3 rounded-xl border border-border bg-input-background text-sm text-foreground focus:outline-none focus:border-primary"
                    style={{ borderColor: nErrRancho ? 'var(--agro-red)' : undefined }}
                  >
                    <option value="">Selecciona {terminosSitio.genero === 'f' ? 'una' : 'un'} {terminosSitio.singular.toLowerCase()}</option>
                    {ranchoOptions.map((o) => (
                      <option key={o.value} value={o.value}>{o.label}</option>
                    ))}
                  </select>
                  {nErrRancho && (
                    <p className="text-xs" style={{ color: 'var(--agro-red)' }}>Requerido</p>
                  )}
                </div>

                {/* Mes */}
                <div className="space-y-1">
                  <label className="text-xs text-muted-foreground" style={{ fontWeight: 600 }}>
                    Mes de registro *
                  </label>
                  <input
                    type="month"
                    value={nMes}
                    onChange={(e) => setNMes(e.target.value)}
                    className="w-full h-11 px-3 rounded-xl border border-border bg-input-background text-sm text-foreground focus:outline-none focus:border-primary"
                  />
                </div>

                {/* Almacén toggle */}
                <div className="flex items-center justify-between rounded-xl border border-border bg-card p-4">
                  <div>
                    <div className="text-sm text-foreground" style={{ fontWeight: 600 }}>
                      ¿{terminosSitio.genero === 'f' ? 'La' : 'El'} {terminosSitio.singular.toLowerCase()} tiene almacén?
                    </div>
                    <div className="text-xs text-muted-foreground mt-0.5">
                      Activa si hay almacén de empaque y/o agroquímicos
                    </div>
                  </div>
                  <button
                    type="button"
                    onClick={() => setNAlmacen((v) => !v)}
                    className="w-16 h-7 rounded-full text-xs transition-colors flex-shrink-0"
                    style={{
                      fontWeight: 600,
                      backgroundColor: nAlmacen ? 'var(--primary)' : 'var(--switch-background)',
                      color: nAlmacen ? '#fff' : 'var(--muted-foreground)',
                    }}
                  >
                    {nAlmacen ? 'Sí' : 'No'}
                  </button>
                </div>

                {/* Aviso duplicado */}
                {nYaExiste && (
                  <div
                    className="flex items-start gap-2 rounded-xl p-3"
                    style={{ backgroundColor: 'var(--agro-warning-fill)', border: '1px solid var(--agro-amber)' }}
                  >
                    <TriangleAlert className="w-4 h-4 flex-shrink-0 mt-0.5" style={{ color: 'var(--agro-warning-text)' }} />
                    <p className="text-xs" style={{ color: 'var(--agro-warning-text)' }}>
                      Ya existe un registro para {terminosSitio.genero === 'f' ? 'esta' : 'este'} {terminosSitio.singular.toLowerCase()} y mes.
                    </p>
                  </div>
                )}

                <button
                  onClick={handleCrearRegistro}
                  disabled={nGuardando || nYaExiste || !nRanchoId}
                  className="w-full h-11 rounded-xl text-sm text-white disabled:opacity-60 transition-colors"
                  style={{ backgroundColor: 'var(--primary)', fontWeight: 600 }}
                >
                  {nGuardando ? 'Creando…' : 'Crear registro'}
                </button>
            </div>
          </div>
      </BottomSheet>

      {/* ═══ SHEET: AGREGAR DÍA DE INSPECCIÓN ═══════════════════════════ */}
      <BottomSheet open={sheetDia && !!registroActivo} onClose={() => setSheetDia(false)} height="85%">
            {/* Handle */}
            <div className="flex justify-center pt-3 pb-1 flex-shrink-0">
              <div className="w-9 h-1 rounded-full bg-border" />
            </div>

            <div className="px-4 pb-2 flex-shrink-0">
              <div className="flex items-center justify-between mb-3">
                <h2 className="text-base text-foreground" style={{ fontWeight: 600 }}>
                  Agregar día de inspección
                </h2>
                <button onClick={() => setSheetDia(false)}>
                  <X className="w-5 h-5 text-muted-foreground" />
                </button>
              </div>

              {/* Fecha */}
              <div className="space-y-1 mb-4">
                <label className="text-xs text-muted-foreground" style={{ fontWeight: 600 }}>
                  Fecha de inspección *
                </label>
                <input
                  type="date"
                  value={dFecha}
                  min={registroActivo.mes}
                  max={ultimoDiaMes(registroActivo.mes)}
                  onChange={(e) => { setDFecha(e.target.value); setDErrFecha(false) }}
                  className="w-full h-11 px-3 rounded-xl border border-border bg-input-background text-sm text-foreground focus:outline-none focus:border-primary"
                  style={{ borderColor: dErrFecha ? 'var(--agro-red)' : undefined }}
                />
                {dErrFecha && (
                  <p className="text-xs" style={{ color: 'var(--agro-red)' }}>Fecha requerida</p>
                )}
                {dYaExiste && (
                  <div
                    className="flex items-start gap-2 rounded-xl p-3"
                    style={{ backgroundColor: 'var(--agro-warning-fill)', border: '1px solid var(--agro-amber)' }}
                  >
                    <TriangleAlert className="w-4 h-4 flex-shrink-0 mt-0.5" style={{ color: 'var(--agro-warning-text)' }} />
                    <p className="text-xs" style={{ color: 'var(--agro-warning-text)' }}>
                      Ya existe una inspección para esta fecha en el registro actual.
                    </p>
                  </div>
                )}
              </div>

              {loadingItems && (
                <div className="flex justify-center py-4">
                  <Loader2 className="w-5 h-5 text-primary animate-spin" />
                </div>
              )}
            </div>

            {/* Lista de ítems — scrollable */}
            {!loadingItems && (
              <div className="flex-1 overflow-y-auto px-4">
                {seccionesAgrupadas.map((sec) => (
                  <div key={sec.label} className="mb-4">
                    <div
                      className="text-xs px-3 py-2 rounded-lg mb-1"
                      style={{
                        backgroundColor: 'var(--primary)',
                        color: '#fff',
                        fontWeight: 600,
                      }}
                    >
                      {sec.label}
                    </div>
                    <div className="bg-card border border-border rounded-xl px-3">
                      {sec.items.map((item) => (
                        <ToggleItem
                          key={item.id}
                          label={item.item}
                          valor={dValores[item.id] ?? item.default_valor}
                          onChange={(v) => setDValores((prev) => ({ ...prev, [item.id]: v }))}
                        />
                      ))}
                    </div>
                  </div>
                ))}
              </div>
            )}

            {/* Botón guardar */}
            <div className="px-4 py-4 border-t border-border flex-shrink-0">
              <button
                onClick={handleGuardarDia}
                disabled={dGuardando || dYaExiste || !dFecha || loadingItems}
                className="w-full h-11 rounded-xl text-sm text-white disabled:opacity-60 transition-colors flex items-center justify-center gap-2"
                style={{ backgroundColor: 'var(--primary)', fontWeight: 600 }}
              >
                {dGuardando ? (
                  <><Loader2 className="w-4 h-4 animate-spin" /> Guardando…</>
                ) : (
                  `Guardar ${itemsVisibles.length} ítems`
                )}
              </button>
            </div>
      </BottomSheet>

      {/* ═══ SHEET: EXPORTAR CONSOLIDADO ═════════════════════════════════ */}
      <BottomSheet open={sheetConsolidado} onClose={() => setSheetConsolidado(false)} height="55%">
            <div className="flex justify-center pt-3 pb-1">
              <div className="w-9 h-1 rounded-full bg-border" />
            </div>
            <div className="px-4 pb-4">
              <div className="flex items-center justify-between mb-4">
                <h2 className="text-base text-foreground" style={{ fontWeight: 600 }}>
                  Exportar consolidado
                </h2>
                <button onClick={() => setSheetConsolidado(false)}>
                  <X className="w-5 h-5 text-muted-foreground" />
                </button>
              </div>

              <div className="space-y-4">
                {/* Rancho */}
                <div className="space-y-1">
                  <label className="text-xs text-muted-foreground" style={{ fontWeight: 600 }}>
                    {terminosSitio.singular} *
                  </label>
                  <select
                    value={cRanchoId}
                    onChange={(e) => { setCRanchoId(e.target.value); setCErrRancho(false) }}
                    className="w-full h-11 px-3 rounded-xl border border-border bg-input-background text-sm text-foreground focus:outline-none focus:border-primary"
                    style={{ borderColor: cErrRancho ? 'var(--agro-red)' : undefined }}
                  >
                    <option value="">Selecciona {terminosSitio.genero === 'f' ? 'una' : 'un'} {terminosSitio.singular.toLowerCase()}</option>
                    {ranchoOptions.map((o) => (
                      <option key={o.value} value={o.value}>{o.label}</option>
                    ))}
                  </select>
                  {cErrRancho && (
                    <p className="text-xs" style={{ color: 'var(--agro-red)' }}>Requerido</p>
                  )}
                </div>

                {/* Rango de meses */}
                <div className="grid grid-cols-2 gap-3">
                  <div className="space-y-1">
                    <label className="text-xs text-muted-foreground" style={{ fontWeight: 600 }}>
                      Desde
                    </label>
                    <input
                      type="month"
                      value={cDesde}
                      onChange={(e) => setCDesde(e.target.value)}
                      className="w-full h-11 px-3 rounded-xl border border-border bg-input-background text-sm text-foreground focus:outline-none focus:border-primary"
                    />
                  </div>
                  <div className="space-y-1">
                    <label className="text-xs text-muted-foreground" style={{ fontWeight: 600 }}>
                      Hasta
                    </label>
                    <input
                      type="month"
                      value={cHasta}
                      onChange={(e) => setCHasta(e.target.value)}
                      className="w-full h-11 px-3 rounded-xl border border-border bg-input-background text-sm text-foreground focus:outline-none focus:border-primary"
                    />
                  </div>
                </div>

                <button
                  onClick={handleConsolidado}
                  disabled={cGenerando || !cRanchoId}
                  className="w-full h-11 rounded-xl text-sm text-white disabled:opacity-60 transition-colors flex items-center justify-center gap-2"
                  style={{ backgroundColor: 'var(--primary)', fontWeight: 600 }}
                >
                  {cGenerando ? (
                    <><Loader2 className="w-4 h-4 animate-spin" /> Generando PDF…</>
                  ) : (
                    <><FileDown className="w-4 h-4" /> Descargar PDF</>
                  )}
                </button>
            </div>
          </div>
      </BottomSheet>
    </div>
  )
}
