import { useState, useMemo, useCallback } from 'react'
import { Link } from 'react-router'
import {
  ChevronLeft, Plus, FileDown, Loader2, TriangleAlert, Shield,
  Settings, X, AlertCircle,
} from 'lucide-react'
import { toast } from 'sonner'
import { supabase } from '@/lib/supabase'
import { useAuthContext } from '@/context/AuthContext'
import { useModulosContext } from '@/context/ModulosContext'
import { useRanchos } from '@/hooks/useRanchos'
import { hoyMX } from '@/lib/fecha'
import { codigoFormato } from '@/lib/codigoFormato'
import {
  useM46Rondines,
  useM46Items,
  type M46RondinResumen,
  type M46Item,
  type ValorM46,
} from '@/hooks/useM46RondinesVigilancia'
import {
  generarRondinesVigilanciaPDF,
  generarRondinesVigilanciaConsolidadoPDF,
} from '@/lib/pdf/m46/generarRondinesVigilanciaPDF'

// ── Constantes ────────────────────────────────────────────────────────────────

const PLANTILLA_ESTANDAR: { area: string; nombre: string; orden: number }[] = [
  { area: 'Oficinas administrativas', nombre: 'Puertas y cerraduras', orden: 1 },
  { area: 'Oficinas administrativas', nombre: 'Iluminacion', orden: 2 },
  { area: 'Oficinas administrativas', nombre: 'Ruidos extraños', orden: 3 },
  { area: 'Bodega / Almacen', nombre: 'Iluminacion', orden: 4 },
  { area: 'Bodega / Almacen', nombre: 'Mobiliario', orden: 5 },
  { area: 'Empaque', nombre: 'Iluminacion', orden: 6 },
  { area: 'Empaque', nombre: 'Mobiliario', orden: 7 },
  { area: 'Comedor', nombre: 'Iluminacion', orden: 8 },
  { area: 'Comedor', nombre: 'Ruidos extraños', orden: 9 },
  { area: 'Exteriores', nombre: 'Iluminacion', orden: 10 },
  { area: 'Exteriores', nombre: 'Ruidos extraños', orden: 11 },
]

const RONDAS = [1, 2, 3, 4] as const
const tbl = (name: string) => (supabase as any).from(name)

// ── Helpers ───────────────────────────────────────────────────────────────────

function fmtFecha(f: string): string {
  try {
    const [y, m, d] = f.split('-')
    return `${d}/${m}/${y}`
  } catch { return f }
}

// ── Subcomponente: tarjeta de rondín ────────────────────────────────────────

function RondinCard({
  rondin,
  onPDF,
  generando,
}: {
  rondin: M46RondinResumen
  onPDF: () => void
  generando: boolean
}) {
  return (
    <div className="bg-card border border-border rounded-xl p-4">
      <div className="flex items-start justify-between gap-2">
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2 flex-wrap mb-1">
            <span
              className="text-xs px-2 py-0.5 rounded"
              style={{ backgroundColor: 'var(--agro-success-fill)', color: 'var(--agro-success-text)', fontWeight: 600 }}
            >
              {fmtFecha(rondin.fecha)}
            </span>
            {rondin.turno && (
              <span
                className="text-xs px-2 py-0.5 rounded"
                style={{ backgroundColor: 'var(--muted)', color: 'var(--muted-foreground)', fontWeight: 600 }}
              >
                {rondin.turno}
              </span>
            )}
            {rondin.num_novedades > 0 && (
              <span
                className="text-xs px-2 py-0.5 rounded"
                style={{ backgroundColor: 'var(--agro-danger-fill)', color: 'var(--agro-danger-text)', fontWeight: 600 }}
              >
                {rondin.num_novedades} novedad{rondin.num_novedades > 1 ? 'es' : ''}
              </span>
            )}
          </div>
          <p className="text-sm text-foreground truncate" style={{ fontWeight: 600 }}>
            {rondin.rancho_nombre}
          </p>
          <p className="text-xs text-muted-foreground mt-0.5">Vigilante: {rondin.vigilante}</p>
        </div>
        <button
          onClick={onPDF}
          disabled={generando}
          className="flex-shrink-0 flex items-center gap-1 h-8 px-2.5 rounded-lg border border-border text-xs text-foreground disabled:opacity-50"
          style={{ fontWeight: 600 }}
          aria-label="Descargar PDF"
        >
          {generando ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <FileDown className="w-3.5 h-3.5" />}
        </button>
      </div>
    </div>
  )
}

// ── Subcomponente: ítem del checklist ────────────────────────────────────────

function ItemChecklist({
  item,
  valor,
  descripcion,
  onToggle,
  onDescripcion,
}: {
  item: M46Item
  valor: ValorM46
  descripcion: string
  onToggle: () => void
  onDescripcion: (v: string) => void
}) {
  const esNovedad = valor === 'con_novedad'
  return (
    <div
      className="border rounded-xl overflow-hidden"
      style={{ borderColor: esNovedad ? 'var(--agro-red)' : 'var(--border)' }}
    >
      <button
        type="button"
        onClick={onToggle}
        className="w-full flex items-center gap-3 p-3 text-left"
        style={{ backgroundColor: esNovedad ? 'var(--agro-danger-fill)' : 'var(--card)' }}
      >
        <p className="flex-1 text-xs text-foreground">{item.nombre}</p>
        <span
          className="text-xs px-2 py-1 rounded-lg flex-shrink-0"
          style={{
            fontWeight: 600,
            backgroundColor: esNovedad ? 'var(--agro-danger-fill)' : 'var(--agro-success-fill)',
            color: esNovedad ? 'var(--agro-danger-text)' : 'var(--agro-success-text)',
          }}
        >
          {esNovedad ? 'Con novedad' : 'Sin novedad'}
        </span>
      </button>
      {esNovedad && (
        <div className="px-3 pb-3 pt-0" style={{ backgroundColor: 'var(--card)' }}>
          <textarea
            value={descripcion}
            onChange={(e) => onDescripcion(e.target.value)}
            rows={2}
            placeholder="Descripcion de la novedad (opcional — si se llena, crea incidencia M13)"
            className="w-full rounded-lg border border-border bg-input-background px-3 py-2 text-xs resize-none"
            style={{ color: 'var(--foreground)' }}
          />
        </div>
      )}
    </div>
  )
}

// ── Pantalla principal ────────────────────────────────────────────────────────

export function RondinesVigilancia() {
  const { profile, codigoClave } = useAuthContext()
  const { terminosSitio } = useModulosContext()
  const { ranchos } = useRanchos()
  const { rondines, loading, error, refetch } = useM46Rondines()

  const orgId = profile?.org_id ?? null
  const esSuperAdmin = profile?.rol === 'super_admin'
  const termino = terminosSitio.singular

  const ranchoOptions = ranchos.map((r) => ({ value: r.id, label: r.nombre }))

  // ── PDF individual ──
  const [generandoPDF, setGenerandoPDF] = useState<string | null>(null)

  async function handlePDFIndividual(rondin: M46RondinResumen) {
    if (!orgId) return
    setGenerandoPDF(rondin.id)
    try {
      await generarRondinesVigilanciaPDF(rondin.id, orgId, codigoClave)
      toast.success('PDF descargado')
    } catch (e: unknown) {
      toast.error(e instanceof Error ? e.message : 'Error al generar PDF')
    } finally { setGenerandoPDF(null) }
  }

  // ── Sheet: nuevo rondín ──
  const [sheetNuevo, setSheetNuevo] = useState(false)
  const [nRanchoId, setNRanchoId] = useState('')
  const [nFecha, setNFecha] = useState(hoyMX())
  const [nTurno, setNTurno] = useState('')
  const [nVigilante, setNVigilante] = useState('')
  const [nJefe, setNJefe] = useState('')
  const [nObs, setNObs] = useState('')
  const [nRondaActiva, setNRondaActiva] = useState<1 | 2 | 3 | 4>(1)
  const [nHoras, setNHoras] = useState<Record<number, string>>({ 1: '', 2: '', 3: '', 4: '' })
  const [nValores, setNValores] = useState<Record<string, Record<number, ValorM46>>>({})
  const [nDescs, setNDescs] = useState<Record<string, string>>({})
  const [nGuardando, setNGuardando] = useState(false)
  const [nErrRancho, setNErrRancho] = useState(false)
  const [nErrVigilante, setNErrVigilante] = useState(false)

  const { items: formItems, loading: loadingFormItems } = useM46Items(nRanchoId || null, orgId)
  const activeFormItems = useMemo(() => formItems.filter((i) => i.activo), [formItems])

  const areaGroups = useMemo(() => {
    const areas = Array.from(new Set(activeFormItems.map((i) => i.area)))
    return areas.map((area) => ({
      area,
      items: activeFormItems.filter((i) => i.area === area),
    }))
  }, [activeFormItems])

  function getValor(itemId: string, ronda: number): ValorM46 {
    return nValores[itemId]?.[ronda] ?? 'sin_novedad'
  }

  function toggleValor(itemId: string, ronda: number) {
    const current = getValor(itemId, ronda)
    const next: ValorM46 = current === 'sin_novedad' ? 'con_novedad' : 'sin_novedad'
    setNValores((prev) => ({
      ...prev,
      [itemId]: { ...(prev[itemId] ?? {}), [ronda]: next },
    }))
    if (next === 'sin_novedad') {
      const key = `${itemId}|${ronda}`
      setNDescs((prev) => {
        const copy = { ...prev }
        delete copy[key]
        return copy
      })
    }
  }

  function abrirNuevo() {
    setNRanchoId('')
    setNFecha(hoyMX())
    setNTurno('')
    setNVigilante('')
    setNJefe('')
    setNObs('')
    setNRondaActiva(1)
    setNHoras({ 1: '', 2: '', 3: '', 4: '' })
    setNValores({})
    setNDescs({})
    setNErrRancho(false)
    setNErrVigilante(false)
    setSheetNuevo(true)
  }

  const novedadesEnRonda = useCallback((ronda: number) => {
    return activeFormItems.some((i) => nValores[i.id]?.[ronda] === 'con_novedad')
  }, [activeFormItems, nValores])

  async function handleGuardar() {
    let hasErr = false
    if (!nRanchoId) { setNErrRancho(true); hasErr = true }
    if (!nVigilante.trim()) { setNErrVigilante(true); hasErr = true }
    if (hasErr) return
    if (!esSuperAdmin && nFecha !== hoyMX()) {
      toast.warning('Solo puedes registrar con la fecha de hoy')
      return
    }
    if (!orgId) return
    setNGuardando(true)
    try {
      // 1. INSERT rondín
      const { data: rondinData, error: eRondin } = await tbl('m46_rondines')
        .insert({
          org_id: orgId,
          rancho_id: nRanchoId,
          fecha: nFecha,
          turno: nTurno.trim() || null,
          vigilante: nVigilante.trim(),
          jefe_seguridad: nJefe.trim() || null,
          observaciones: nObs.trim() || null,
        })
        .select('id')
        .single()
      if (eRondin) throw eRondin
      const rondinId = (rondinData as any).id as string

      // 2. INSERT rondas (4 filas)
      const { error: eRondas } = await tbl('m46_rondas').insert(
        RONDAS.map((n) => ({
          rondin_id: rondinId,
          org_id: orgId,
          numero: n,
          hora: nHoras[n]?.trim() || null,
        }))
      )
      if (eRondas) throw eRondas

      // 3. M13: un reporte + una incidencia por cada (item, ronda) con novedad y descripción
      const conDescripcion: Array<{ itemId: string; ronda: number; item: M46Item; desc: string }> = []
      for (const item of activeFormItems) {
        for (const ronda of RONDAS) {
          const val = nValores[item.id]?.[ronda] ?? 'sin_novedad'
          const desc = nDescs[`${item.id}|${ronda}`]?.trim()
          if (val === 'con_novedad' && desc) {
            conDescripcion.push({ itemId: item.id, ronda, item, desc })
          }
        }
      }

      const incMap: Record<string, string> = {}
      if (conDescripcion.length > 0) {
        const { data: repData, error: eRep } = await tbl('m13_reportes')
          .insert({
            org_id: orgId,
            rancho_id: nRanchoId,
            fecha: nFecha,
            auditor_nombre: nVigilante.trim(),
          })
          .select('id')
          .single()
        if (eRep) throw eRep
        const repId = (repData as any).id as string

        for (let i = 0; i < conDescripcion.length; i++) {
          const { itemId, ronda, item, desc } = conDescripcion[i]
          const { data: incData, error: eInc } = await tbl('m13_incidencias')
            .insert({
              reporte_id: repId,
              org_id: orgId,
              descripcion: `[Ronda ${ronda}] ${item.area} - ${item.nombre}: ${desc}`,
              orden: i + 1,
            })
            .select('id')
            .single()
          if (eInc) throw eInc
          incMap[`${itemId}|${ronda}`] = (incData as any).id as string
        }
      }

      // 4. INSERT resultados (todos los items × todas las rondas)
      if (activeFormItems.length > 0) {
        const batch: any[] = []
        for (const item of activeFormItems) {
          for (const ronda of RONDAS) {
            batch.push({
              rondin_id: rondinId,
              org_id: orgId,
              item_id: item.id,
              ronda,
              valor: nValores[item.id]?.[ronda] ?? 'sin_novedad',
              incidencia_id: incMap[`${item.id}|${ronda}`] ?? null,
            })
          }
        }
        const { error: eRes } = await tbl('m46_resultados').insert(batch)
        if (eRes) throw eRes
      }

      const numInc = Object.keys(incMap).length
      const msgExtra = numInc > 0
        ? ` · ${numInc} novedad${numInc > 1 ? 'es' : ''} vinculada${numInc > 1 ? 's' : ''} a M13`
        : ''
      toast.success(`Rondín guardado${msgExtra}`)
      setSheetNuevo(false)
      await refetch()
      generarRondinesVigilanciaPDF(rondinId, orgId, codigoClave).catch(() => {})
    } catch (e: unknown) {
      const msg = e instanceof Error ? e.message : 'Error al guardar'
      if (msg.includes('FECHA_SOLO_HOY')) {
        toast.warning('Solo puedes registrar con la fecha de hoy')
      } else {
        toast.error(msg)
      }
    } finally { setNGuardando(false) }
  }

  // ── Sheet: configurar catálogo ──
  const [sheetConf, setSheetConf] = useState(false)
  const [confRanchoId, setConfRanchoId] = useState('')
  const [confArea, setConfArea] = useState('')
  const [confNombre, setConfNombre] = useState('')
  const [confAgregando, setConfAgregando] = useState(false)
  const [confToggling, setConfToggling] = useState<string | null>(null)
  const [confCargandoPlantilla, setConfCargandoPlantilla] = useState(false)

  const { items: confItems, loading: loadingConf, refetch: refetchConf } = useM46Items(
    confRanchoId || null, orgId
  )

  const confAreas = useMemo(
    () => Array.from(new Set(confItems.map((i) => i.area))),
    [confItems]
  )

  async function handleAgregarItem() {
    if (!confRanchoId || !orgId) { toast.error(`Selecciona una ${termino}`); return }
    if (!confArea.trim()) { toast.error('Ingresa el área'); return }
    if (!confNombre.trim()) { toast.error('Ingresa el nombre del punto'); return }
    setConfAgregando(true)
    try {
      const maxOrden = confItems.reduce((m, i) => Math.max(m, i.orden), 0)
      const { error: e } = await tbl('m46_items').insert({
        org_id: orgId,
        rancho_id: confRanchoId,
        area: confArea.trim(),
        nombre: confNombre.trim(),
        activo: true,
        orden: maxOrden + 1,
      })
      if (e) {
        if (e.message?.includes('23505') || e.message?.includes('unique') || e.message?.includes('duplicate')) {
          toast.warning('Ya existe ese punto para esta instalación')
        } else throw e
      } else {
        setConfArea('')
        setConfNombre('')
        toast.success('Punto agregado')
        refetchConf()
      }
    } catch (e: unknown) {
      toast.error(e instanceof Error ? e.message : 'Error al agregar')
    } finally { setConfAgregando(false) }
  }

  async function handleToggleActivo(item: M46Item) {
    if (!orgId) return
    setConfToggling(item.id)
    try {
      const { error: e } = await tbl('m46_items')
        .update({ activo: !item.activo })
        .eq('id', item.id)
        .eq('org_id', orgId)
      if (e) throw e
      refetchConf()
    } catch (e: unknown) {
      toast.error(e instanceof Error ? e.message : 'Error al actualizar')
    } finally { setConfToggling(null) }
  }

  async function handleCargarPlantilla() {
    if (!confRanchoId || !orgId) { toast.error(`Selecciona una ${termino}`); return }
    setConfCargandoPlantilla(true)
    try {
      const rows = PLANTILLA_ESTANDAR.map((item) => ({
        org_id: orgId,
        rancho_id: confRanchoId,
        area: item.area,
        nombre: item.nombre,
        activo: true,
        orden: item.orden,
      }))
      const { error: e } = await tbl('m46_items')
        .upsert(rows, { onConflict: 'rancho_id,area,nombre', ignoreDuplicates: true })
      if (e) throw e
      toast.success('11 puntos estándar cargados')
      refetchConf()
    } catch (e: unknown) {
      toast.error(e instanceof Error ? e.message : 'Error al cargar plantilla')
    } finally { setConfCargandoPlantilla(false) }
  }

  // ── Sheet: consolidado ──
  const [sheetConsolidado, setSheetConsolidado] = useState(false)
  const [cRanchoId, setCRanchoId] = useState('')
  const [cDesde, setCDesde] = useState(hoyMX())
  const [cHasta, setCHasta] = useState(hoyMX())
  const [cGenerando, setCGenerando] = useState(false)
  const [cErrRancho, setCErrRancho] = useState(false)

  async function handleConsolidado() {
    if (!cRanchoId) { setCErrRancho(true); return }
    if (!orgId) return
    setCGenerando(true)
    try {
      await generarRondinesVigilanciaConsolidadoPDF(cRanchoId, orgId, cDesde, cHasta, codigoClave)
      toast.success('PDF consolidado generado')
      setSheetConsolidado(false)
    } catch (e: unknown) {
      toast.error(e instanceof Error ? e.message : 'Error al generar PDF')
    } finally { setCGenerando(false) }
  }

  // ── Render ────────────────────────────────────────────────────────────────

  return (
    <div className="min-h-full pb-safe-nav">

      {/* Header */}
      <header className="bg-card border-b border-border px-4 py-3 sticky top-0 z-30">
        <div className="flex items-center gap-3">
          <Link to="/" className="p-1 -ml-1">
            <ChevronLeft className="w-5 h-5 text-foreground" />
          </Link>
          <div className="w-8 h-8 rounded-lg flex items-center justify-center flex-shrink-0 bg-primary/10">
            <Shield className="w-4 h-4 text-primary" />
          </div>
          <div className="flex-1 min-w-0">
            <h1 className="text-sm text-foreground truncate" style={{ fontWeight: 600 }}>
              Bitácora de Rondines de Vigilancia
            </h1>
            <div className="text-xs text-muted-foreground">
              {codigoFormato('F-FRUS-ADM-07', codigoClave)}
            </div>
          </div>
          <div className="flex items-center gap-2">
            <button
              onClick={() => { setConfRanchoId(''); setSheetConf(true) }}
              className="flex items-center gap-1 h-8 px-2.5 rounded-lg border border-border text-xs text-foreground"
              aria-label="Configurar puntos"
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
        </div>
      </header>

      {/* Lista */}
      <div className="p-4 space-y-4">
        {error && (
          <div
            className="flex items-start gap-2 rounded-xl p-3"
            style={{ backgroundColor: 'var(--agro-danger-fill)', border: '1px solid var(--agro-red)' }}
          >
            <TriangleAlert className="w-4 h-4 flex-shrink-0 mt-0.5" style={{ color: 'var(--agro-danger-text)' }} />
            <p className="text-xs" style={{ color: 'var(--agro-danger-text)' }}>
              Error al cargar rondines. Verifica tu conexión.
            </p>
          </div>
        )}

        {loading ? (
          <div className="flex justify-center py-12">
            <Loader2 className="w-6 h-6 text-primary animate-spin" />
          </div>
        ) : rondines.length === 0 ? (
          <div className="bg-card border border-border rounded-xl p-6 text-center">
            <Shield className="w-8 h-8 text-muted-foreground mx-auto mb-3" />
            <p className="text-sm text-foreground" style={{ fontWeight: 600 }}>Sin rondines aún</p>
            <p className="text-xs text-muted-foreground mt-1">
              Registra el primer rondín con el botón +
            </p>
          </div>
        ) : (
          <div className="space-y-3">
            {rondines.map((r) => (
              <RondinCard
                key={r.id}
                rondin={r}
                onPDF={() => handlePDFIndividual(r)}
                generando={generandoPDF === r.id}
              />
            ))}
          </div>
        )}
      </div>

      {/* FAB */}
      <button
        onClick={abrirNuevo}
        className="fixed bottom-safe-fab left-1/2 -translate-x-1/2 w-full max-w-[390px] flex justify-end px-4 pointer-events-none z-10"
        style={{ bottom: 'calc(72px + 16px)' }}
      >
        <span
          className="pointer-events-auto w-14 h-14 rounded-full flex items-center justify-center"
          style={{ backgroundColor: 'var(--primary)', boxShadow: '0 2px 12px rgba(43,122,181,0.35)' }}
          aria-label="Nuevo rondín"
        >
          <Plus className="w-6 h-6 text-white" />
        </span>
      </button>

      {/* ═══ SHEET: NUEVO RONDÍN ══════════════════════════════════════════════ */}
      {sheetNuevo && (
        <div
          className="fixed inset-0 z-50 flex flex-col justify-end"
          onClick={(e) => { if (e.target === e.currentTarget && !nGuardando) setSheetNuevo(false) }}
        >
          <div className="absolute inset-0 bg-black/40" />
          <div
            className="relative bg-card flex flex-col"
            style={{ borderRadius: '10px 10px 0 0', maxHeight: '92dvh' }}
          >
            <div className="w-10 h-1 bg-border rounded-full mx-auto mt-3 mb-1 flex-shrink-0" />
            <div className="px-4 py-3 flex items-center justify-between flex-shrink-0 border-b border-border">
              <h2 className="text-base text-foreground" style={{ fontWeight: 700 }}>Nuevo rondín</h2>
              <button onClick={() => { if (!nGuardando) setSheetNuevo(false) }}>
                <X className="w-5 h-5 text-muted-foreground" />
              </button>
            </div>

            <div className="flex-1 overflow-y-auto px-4 pb-6 space-y-4 pt-4">

              {/* Encabezado */}
              <div className="space-y-3">
                <p className="text-xs text-muted-foreground uppercase tracking-wide" style={{ fontWeight: 700 }}>
                  Datos del rondín
                </p>

                <div className="space-y-1">
                  <label className="text-xs text-muted-foreground" style={{ fontWeight: 600 }}>
                    {termino} *
                  </label>
                  <select
                    value={nRanchoId}
                    onChange={(e) => { setNRanchoId(e.target.value); setNErrRancho(false) }}
                    className="w-full h-11 px-3 rounded-xl border bg-input-background text-sm"
                    style={{ borderColor: nErrRancho ? 'var(--agro-red)' : 'var(--border)' }}
                  >
                    <option value="">Seleccionar…</option>
                    {ranchoOptions.map((o) => (
                      <option key={o.value} value={o.value}>{o.label}</option>
                    ))}
                  </select>
                  {nErrRancho && (
                    <p className="text-xs" style={{ color: 'var(--agro-red)' }}>
                      Selecciona una {termino.toLowerCase()}
                    </p>
                  )}
                </div>

                <div className="grid grid-cols-2 gap-3">
                  <div className="space-y-1">
                    <label className="text-xs text-muted-foreground" style={{ fontWeight: 600 }}>Fecha</label>
                    <input
                      type="date"
                      value={nFecha}
                      min={esSuperAdmin ? undefined : hoyMX()}
                      max={esSuperAdmin ? undefined : hoyMX()}
                      onChange={(e) => { if (esSuperAdmin) setNFecha(e.target.value) }}
                      className="w-full h-11 px-3 rounded-xl border border-border bg-input-background text-sm"
                    />
                  </div>
                  <div className="space-y-1">
                    <label className="text-xs text-muted-foreground" style={{ fontWeight: 600 }}>Turno</label>
                    <input
                      type="text"
                      value={nTurno}
                      onChange={(e) => setNTurno(e.target.value)}
                      placeholder="Ej: Nocturno"
                      className="w-full h-11 px-3 rounded-xl border border-border bg-input-background text-sm"
                    />
                  </div>
                </div>

                <div className="grid grid-cols-2 gap-3">
                  <div className="space-y-1">
                    <label className="text-xs text-muted-foreground" style={{ fontWeight: 600 }}>Vigilante *</label>
                    <input
                      type="text"
                      value={nVigilante}
                      onChange={(e) => { setNVigilante(e.target.value); setNErrVigilante(false) }}
                      placeholder="Nombre"
                      className="w-full h-11 px-3 rounded-xl border bg-input-background text-sm"
                      style={{ borderColor: nErrVigilante ? 'var(--agro-red)' : 'var(--border)' }}
                    />
                    {nErrVigilante && (
                      <p className="text-xs" style={{ color: 'var(--agro-red)' }}>Requerido</p>
                    )}
                  </div>
                  <div className="space-y-1">
                    <label className="text-xs text-muted-foreground" style={{ fontWeight: 600 }}>Jefe de Seguridad</label>
                    <input
                      type="text"
                      value={nJefe}
                      onChange={(e) => setNJefe(e.target.value)}
                      placeholder="Nombre"
                      className="w-full h-11 px-3 rounded-xl border border-border bg-input-background text-sm"
                    />
                  </div>
                </div>
              </div>

              {/* Rondas */}
              <div className="space-y-3">
                <p className="text-xs text-muted-foreground uppercase tracking-wide" style={{ fontWeight: 700 }}>
                  Rondas
                </p>

                {/* Selector de ronda activa */}
                <div className="flex gap-1.5">
                  {RONDAS.map((n) => {
                    const isActive = nRondaActiva === n
                    const tieneNovedad = novedadesEnRonda(n)
                    const tieneHora = !!nHoras[n]?.trim()
                    return (
                      <button
                        key={n}
                        type="button"
                        onClick={() => setNRondaActiva(n as 1 | 2 | 3 | 4)}
                        className="flex-1 py-2 rounded-xl text-xs transition-colors relative"
                        style={{
                          backgroundColor: isActive ? 'var(--primary)' : 'var(--card)',
                          color: isActive ? '#fff' : 'var(--foreground)',
                          border: isActive ? 'none' : '1px solid var(--border)',
                          fontWeight: isActive ? 700 : 400,
                        }}
                      >
                        Ronda {n}
                        {tieneNovedad && (
                          <span
                            className="absolute top-0.5 right-1 w-1.5 h-1.5 rounded-full"
                            style={{ backgroundColor: isActive ? '#fff' : 'var(--agro-red)' }}
                          />
                        )}
                        {tieneHora && !tieneNovedad && (
                          <span
                            className="absolute top-0.5 right-1 w-1.5 h-1.5 rounded-full"
                            style={{ backgroundColor: isActive ? 'rgba(255,255,255,0.6)' : 'var(--agro-success-text)' }}
                          />
                        )}
                      </button>
                    )
                  })}
                </div>

                {/* Hora de la ronda activa */}
                <div className="space-y-1">
                  <label className="text-xs text-muted-foreground" style={{ fontWeight: 600 }}>
                    Hora — Ronda {nRondaActiva}
                  </label>
                  <input
                    type="time"
                    value={nHoras[nRondaActiva]}
                    onChange={(e) => setNHoras((prev) => ({ ...prev, [nRondaActiva]: e.target.value }))}
                    className="w-full h-11 px-3 rounded-xl border border-border bg-input-background text-sm"
                  />
                </div>

                {/* Checklist de puntos para la ronda activa */}
                {nRanchoId ? (
                  loadingFormItems ? (
                    <div className="flex justify-center py-4">
                      <Loader2 className="w-5 h-5 text-primary animate-spin" />
                    </div>
                  ) : activeFormItems.length === 0 ? (
                    <div
                      className="flex items-start gap-2 rounded-xl p-3"
                      style={{ backgroundColor: 'var(--agro-warning-fill)' }}
                    >
                      <AlertCircle className="w-4 h-4 flex-shrink-0 mt-0.5" style={{ color: 'var(--agro-warning-text)' }} />
                      <p className="text-xs" style={{ color: 'var(--agro-warning-text)' }}>
                        Sin puntos configurados. Usa el botón de ajustes para configurar el catálogo.
                      </p>
                    </div>
                  ) : (
                    <div className="space-y-2">
                      <p className="text-xs text-muted-foreground" style={{ fontWeight: 600 }}>
                        Puntos de supervisión — Ronda {nRondaActiva}
                      </p>
                      {areaGroups.map(({ area, items: aItems }) => (
                        <div key={area}>
                          <p
                            className="text-xs px-2 py-1 rounded mb-1.5"
                            style={{
                              backgroundColor: 'var(--muted)',
                              color: 'var(--muted-foreground)',
                              fontWeight: 700,
                            }}
                          >
                            {area}
                          </p>
                          <div className="space-y-1.5">
                            {aItems.map((item) => (
                              <ItemChecklist
                                key={item.id}
                                item={item}
                                valor={getValor(item.id, nRondaActiva)}
                                descripcion={nDescs[`${item.id}|${nRondaActiva}`] ?? ''}
                                onToggle={() => toggleValor(item.id, nRondaActiva)}
                                onDescripcion={(v) =>
                                  setNDescs((prev) => ({ ...prev, [`${item.id}|${nRondaActiva}`]: v }))
                                }
                              />
                            ))}
                          </div>
                        </div>
                      ))}
                    </div>
                  )
                ) : (
                  <p className="text-xs text-muted-foreground text-center py-2">
                    Selecciona una {termino.toLowerCase()} para ver los puntos
                  </p>
                )}
              </div>

              {/* Observaciones */}
              <div className="space-y-1">
                <label className="text-xs text-muted-foreground" style={{ fontWeight: 600 }}>
                  Observaciones generales
                </label>
                <textarea
                  value={nObs}
                  onChange={(e) => setNObs(e.target.value)}
                  rows={2}
                  placeholder="Novedades adicionales del turno…"
                  className="w-full rounded-xl border border-border bg-input-background px-3 py-2 text-sm resize-none"
                />
              </div>

              {/* Aviso incidencias */}
              {activeFormItems.some((item) =>
                RONDAS.some((r) => nValores[item.id]?.[r] === 'con_novedad')
              ) && (
                <div
                  className="flex items-start gap-2 rounded-xl p-3"
                  style={{ backgroundColor: 'var(--agro-warning-fill)' }}
                >
                  <AlertCircle className="w-4 h-4 flex-shrink-0 mt-0.5" style={{ color: 'var(--agro-warning-text)' }} />
                  <p className="text-xs" style={{ color: 'var(--agro-warning-text)' }}>
                    Los puntos con "Con novedad" y descripción generarán una incidencia M13 automáticamente.
                  </p>
                </div>
              )}

              <button
                type="button"
                onClick={handleGuardar}
                disabled={nGuardando}
                className="w-full h-12 rounded-xl text-sm text-white disabled:opacity-60 flex items-center justify-center gap-2"
                style={{ backgroundColor: 'var(--primary)', fontWeight: 600 }}
              >
                {nGuardando ? (
                  <><Loader2 className="w-4 h-4 animate-spin" />Guardando…</>
                ) : 'Guardar rondín'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ═══ SHEET: CONFIGURAR CATÁLOGO ══════════════════════════════════════ */}
      {sheetConf && (
        <div
          className="fixed inset-0 z-50 flex flex-col justify-end"
          onClick={(e) => { if (e.target === e.currentTarget) setSheetConf(false) }}
        >
          <div className="absolute inset-0 bg-black/40" />
          <div
            className="relative bg-card flex flex-col"
            style={{ borderRadius: '10px 10px 0 0', maxHeight: '92dvh' }}
          >
            <div className="w-10 h-1 bg-border rounded-full mx-auto mt-3 mb-1 flex-shrink-0" />
            <div className="px-4 py-3 flex items-center justify-between flex-shrink-0 border-b border-border">
              <h2 className="text-base text-foreground" style={{ fontWeight: 700 }}>Configurar puntos</h2>
              <button onClick={() => setSheetConf(false)}><X className="w-5 h-5 text-muted-foreground" /></button>
            </div>
            <div className="flex-1 overflow-y-auto px-4 pb-6 space-y-4 pt-4">
              <div className="space-y-1">
                <label className="text-xs text-muted-foreground" style={{ fontWeight: 600 }}>{termino}</label>
                <select
                  value={confRanchoId}
                  onChange={(e) => setConfRanchoId(e.target.value)}
                  className="w-full h-11 px-3 rounded-xl border border-border bg-input-background text-sm"
                >
                  <option value="">Seleccionar…</option>
                  {ranchoOptions.map((o) => <option key={o.value} value={o.value}>{o.label}</option>)}
                </select>
              </div>

              {confRanchoId && (
                <>
                  <button
                    type="button"
                    onClick={handleCargarPlantilla}
                    disabled={confCargandoPlantilla}
                    className="w-full h-9 rounded-xl border border-border text-xs flex items-center justify-center gap-1.5 disabled:opacity-60"
                    style={{ fontWeight: 600 }}
                  >
                    {confCargandoPlantilla
                      ? <Loader2 className="w-3.5 h-3.5 animate-spin" />
                      : <Plus className="w-3.5 h-3.5" />}
                    Cargar 11 puntos estándar
                  </button>

                  {loadingConf ? (
                    <div className="flex justify-center py-4"><Loader2 className="w-5 h-5 text-primary animate-spin" /></div>
                  ) : confItems.length === 0 ? (
                    <p className="text-xs text-muted-foreground text-center py-2">Sin puntos configurados.</p>
                  ) : (
                    <div className="space-y-3">
                      {confAreas.map((area) => (
                        <div key={area}>
                          <p
                            className="text-xs px-2 py-1 rounded mb-1"
                            style={{ backgroundColor: 'var(--muted)', color: 'var(--muted-foreground)', fontWeight: 700 }}
                          >
                            {area}
                          </p>
                          <div className="bg-card border border-border rounded-xl divide-y divide-border">
                            {confItems.filter((i) => i.area === area).map((item) => (
                              <div key={item.id} className="flex items-center gap-3 px-3 py-2.5">
                                <p className="flex-1 text-xs text-foreground truncate">{item.nombre}</p>
                                <button
                                  type="button"
                                  onClick={() => handleToggleActivo(item)}
                                  disabled={confToggling === item.id}
                                  className="flex-shrink-0 w-16 h-6 rounded-full text-xs transition-colors disabled:opacity-60"
                                  style={{
                                    backgroundColor: item.activo ? 'var(--primary)' : 'var(--switch-background)',
                                    color: item.activo ? '#fff' : 'var(--muted-foreground)',
                                    fontWeight: 600,
                                  }}
                                >
                                  {confToggling === item.id ? '…' : item.activo ? 'Activo' : 'Inactivo'}
                                </button>
                              </div>
                            ))}
                          </div>
                        </div>
                      ))}
                    </div>
                  )}

                  {/* Formulario agregar */}
                  <div className="bg-card border border-border rounded-xl p-3 space-y-3">
                    <p className="text-xs text-foreground" style={{ fontWeight: 600 }}>Agregar punto personalizado</p>
                    <div className="space-y-1">
                      <label className="text-xs text-muted-foreground">Área</label>
                      <input
                        type="text"
                        value={confArea}
                        onChange={(e) => setConfArea(e.target.value)}
                        placeholder="Ej: Bodega / Almacén"
                        className="w-full h-10 px-3 rounded-xl border border-border bg-input-background text-sm"
                      />
                    </div>
                    <div className="space-y-1">
                      <label className="text-xs text-muted-foreground">Nombre del punto</label>
                      <input
                        type="text"
                        value={confNombre}
                        onChange={(e) => setConfNombre(e.target.value)}
                        placeholder="Ej: Puertas y cerraduras"
                        className="w-full h-10 px-3 rounded-xl border border-border bg-input-background text-sm"
                      />
                    </div>
                    <button
                      type="button"
                      onClick={handleAgregarItem}
                      disabled={confAgregando}
                      className="w-full h-9 rounded-xl text-sm text-white disabled:opacity-60"
                      style={{ backgroundColor: 'var(--primary)', fontWeight: 600 }}
                    >
                      {confAgregando ? 'Agregando…' : 'Agregar'}
                    </button>
                  </div>
                </>
              )}
            </div>
          </div>
        </div>
      )}

      {/* ═══ SHEET: CONSOLIDADO ══════════════════════════════════════════════ */}
      {sheetConsolidado && (
        <div
          className="fixed inset-0 z-50 flex flex-col justify-end"
          onClick={(e) => { if (e.target === e.currentTarget) setSheetConsolidado(false) }}
        >
          <div className="absolute inset-0 bg-black/40" />
          <div
            className="relative bg-card flex flex-col"
            style={{ borderRadius: '10px 10px 0 0', maxHeight: '85dvh' }}
          >
            <div className="w-10 h-1 bg-border rounded-full mx-auto mt-3 mb-1 flex-shrink-0" />
            <div className="px-4 py-3 flex items-center justify-between flex-shrink-0 border-b border-border">
              <h2 className="text-base text-foreground" style={{ fontWeight: 700 }}>Exportar consolidado</h2>
              <button onClick={() => setSheetConsolidado(false)}><X className="w-5 h-5 text-muted-foreground" /></button>
            </div>
            <div className="flex-1 overflow-y-auto px-4 pb-6 space-y-4 pt-4">
              <div className="space-y-1">
                <label className="text-xs text-muted-foreground" style={{ fontWeight: 600 }}>{termino} *</label>
                <select
                  value={cRanchoId}
                  onChange={(e) => { setCRanchoId(e.target.value); setCErrRancho(false) }}
                  className="w-full h-11 px-3 rounded-xl border bg-input-background text-sm"
                  style={{ borderColor: cErrRancho ? 'var(--agro-red)' : 'var(--border)' }}
                >
                  <option value="">Seleccionar…</option>
                  {ranchoOptions.map((o) => <option key={o.value} value={o.value}>{o.label}</option>)}
                </select>
                {cErrRancho && <p className="text-xs" style={{ color: 'var(--agro-red)' }}>Requerido</p>}
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div className="space-y-1">
                  <label className="text-xs text-muted-foreground" style={{ fontWeight: 600 }}>Desde</label>
                  <input
                    type="date"
                    value={cDesde}
                    onChange={(e) => setCDesde(e.target.value)}
                    className="w-full h-11 px-3 rounded-xl border border-border bg-input-background text-sm"
                  />
                </div>
                <div className="space-y-1">
                  <label className="text-xs text-muted-foreground" style={{ fontWeight: 600 }}>Hasta</label>
                  <input
                    type="date"
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
                className="w-full h-12 rounded-xl text-sm text-white disabled:opacity-60 flex items-center justify-center gap-2"
                style={{ backgroundColor: 'var(--primary)', fontWeight: 600 }}
              >
                {cGenerando
                  ? <><Loader2 className="w-4 h-4 animate-spin" />Generando…</>
                  : 'Descargar PDF'}
              </button>
            </div>
          </div>
        </div>
      )}

    </div>
  )
}
