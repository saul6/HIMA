// M23 — Verificación de Insumos (F-FRUS-SAN-01, Cuarto Frío)
// Motor espejo de M19: lista de registros mensuales → detalle → días de inspección
// Diferencias: catálogo por instalación (m23_insumos), dos responsables (verificó/autorizó),
// gestión de catálogo con plantilla estándar de 30 ítems.

import { useState, useEffect, useCallback, useMemo } from 'react'
import {
  ChevronLeft, Plus, FileDown, Loader2, ClipboardCheck,
  TriangleAlert, CalendarDays, X, AlertCircle, Settings,
} from 'lucide-react'
import { Link } from 'react-router'
import { BottomSheet } from '@/app/components/BottomSheet'
import { toast } from 'sonner'
import { useAuthContext } from '@/context/AuthContext'
import { useModulosContext } from '@/context/ModulosContext'
import { useRanchos } from '@/hooks/useRanchos'
import {
  useM23VerificacionInsumos,
  useM23Insumos,
  type M23RegistroResumen,
  type M23DiaConResultados,
  type M23Insumo,
} from '@/hooks/useM23VerificacionInsumos'
import { supabase } from '@/lib/supabase'
import { generarVerificacionInsumosPDF } from '@/lib/pdf/m23/generarVerificacionInsumosPDF'
import { generarVerificacionInsumosConsolidadoPDF } from '@/lib/pdf/m23/generarVerificacionInsumosConsolidadoPDF'
import { useOrganizacion } from '@/hooks/useOrganizacion'

// eslint-disable-next-line @typescript-eslint/no-explicit-any
const tbl = (name: string) => (supabase as any).from(name)
const hoy = () => new Date().toLocaleDateString('en-CA', { timeZone: 'America/Mexico_City' })

// ── Plantilla estándar (30 ítems) ────────────────────────────────────────────

const PLANTILLA_ESTANDAR: { area: string; insumos: string[] }[] = [
  { area: 'Baño Hombres',  insumos: ['Agua en sanitarios', 'Papel sanitario', 'Agua en lavamanos', 'Jabón neutro', 'Gel antibacterial', 'Toallas de papel'] },
  { area: 'Baño Mujeres',  insumos: ['Agua en sanitarios', 'Papel sanitario', 'Agua en lavamanos', 'Jabón neutro', 'Gel antibacterial', 'Toallas de papel'] },
  { area: 'Aduana',        insumos: ['Agua en lavabo', 'Jabón neutro', 'Gel antibacterial', 'Toallas de papel', 'Cofias desechables', 'Cubrebocas'] },
  { area: 'Recepción',     insumos: ['Gel antibacterial'] },
  { area: 'Comedor',       insumos: ['Gel antibacterial'] },
  { area: 'Oficinas',      insumos: ['Gel antibacterial'] },
  { area: 'Botiquín',      insumos: ['Curitas azules', 'Alcohol', 'Agua oxigenada', 'Gasas', 'Cinta micropor', 'Vendas', 'Guantes', 'Meltiolate', 'Violeta'] },
]

// ── Tipos ─────────────────────────────────────────────────────────────────────

type ValorM23 = 'SI' | 'NO' | 'NA'
type Vista = 'lista' | 'detalle'

// ── Helpers ───────────────────────────────────────────────────────────────────

function mesActual(): string {
  const d = new Date()
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`
}

function formatMesLabel(isoDate: string): string {
  try {
    const label = new Date(isoDate + 'T12:00:00').toLocaleDateString('es-MX', { month: 'long', year: 'numeric' })
    return label.charAt(0).toUpperCase() + label.slice(1)
  } catch { return isoDate }
}

function formatFechaCorta(iso: string): string {
  try {
    return new Date(iso + 'T12:00:00').toLocaleDateString('es-MX', { day: 'numeric', month: 'short', year: 'numeric' })
  } catch { return iso }
}

function ultimoDiaMes(mesISO: string): string {
  try {
    const d = new Date(mesISO + 'T12:00:00')
    return new Date(d.getFullYear(), d.getMonth() + 1, 0).toISOString().split('T')[0]
  } catch { return mesISO }
}

function agruparPorArea(insumos: M23Insumo[]) {
  const grupos: { area: string; items: M23Insumo[] }[] = []
  let actual: { area: string; items: M23Insumo[] } | null = null
  for (const ins of insumos) {
    if (!actual || actual.area !== ins.area) {
      actual = { area: ins.area, items: [] }
      grupos.push(actual)
    }
    actual.items.push(ins)
  }
  return grupos
}

function siguienteValor(v: ValorM23): ValorM23 {
  if (v === 'SI') return 'NO'
  if (v === 'NO') return 'NA'
  return 'SI'
}

// ── Toggle 3 estados ──────────────────────────────────────────────────────────

function ToggleInsumo({
  label, valor, codigo, incidenciaDesc, onChange, onCodigo, onIncidenciaDesc,
}: {
  label: string; valor: ValorM23; codigo: string; incidenciaDesc: string
  onChange: (v: ValorM23) => void; onCodigo: (c: string) => void; onIncidenciaDesc: (d: string) => void
}) {
  const bgColor = valor === 'SI' ? 'var(--primary)' : valor === 'NO' ? 'var(--agro-red)' : 'var(--switch-background)'
  const textColor = valor === 'NA' ? 'var(--muted-foreground)' : '#fff'
  const displayLabel = valor === 'NA' ? 'N/A' : valor === 'NO' ? 'No' : 'Si'

  return (
    <div className="py-2.5 border-b border-border last:border-0">
      <div className="flex items-center justify-between">
        <span className="text-sm text-foreground flex-1 pr-3">{label}</span>
        <button
          type="button"
          onClick={() => onChange(siguienteValor(valor))}
          className="flex-shrink-0 w-16 h-7 rounded-full text-xs transition-colors"
          style={{ fontWeight: 600, backgroundColor: bgColor, color: textColor }}
        >
          {displayLabel}
        </button>
      </div>
      {valor === 'NO' && (
        <div className="mt-1.5 space-y-1.5">
          <input
            type="text"
            value={codigo}
            onChange={(e) => onCodigo(e.target.value)}
            placeholder="Cód. correctivo (opcional)"
            className="w-full h-8 px-2 rounded-lg border border-border bg-input-background text-xs"
          />
          <input
            type="text"
            value={incidenciaDesc}
            onChange={(e) => onIncidenciaDesc(e.target.value)}
            placeholder="Descripción de incidencia M13 (opcional)"
            className="w-full h-8 px-2 rounded-lg border border-border bg-input-background text-xs"
            style={{ borderColor: incidenciaDesc ? 'var(--agro-red)' : undefined }}
          />
          {incidenciaDesc && (
            <div className="flex items-center gap-1 text-xs" style={{ color: 'var(--agro-danger-text)' }}>
              <AlertCircle className="w-3 h-3 flex-shrink-0" />
              <span>Se creará un Reporte de Incidencias (M13) al guardar</span>
            </div>
          )}
        </div>
      )}
    </div>
  )
}

// ── Card de día ───────────────────────────────────────────────────────────────

function DiaCardM23({ dia }: { dia: M23DiaConResultados }) {
  const numSI  = dia.resultados.filter((r) => r.valor === 'SI').length
  const numNO  = dia.resultados.filter((r) => r.valor === 'NO').length
  const numNA  = dia.resultados.filter((r) => r.valor === 'NA').length
  const numInc = dia.resultados.filter((r) => r.incidencia_id).length

  return (
    <div className="bg-card border border-border rounded-xl p-4">
      <div className="flex items-center gap-2 mb-2">
        <CalendarDays className="w-4 h-4 text-primary flex-shrink-0" />
        <span className="text-sm text-foreground" style={{ fontWeight: 600 }}>
          {formatFechaCorta(dia.fecha)}
        </span>
      </div>
      <div className="flex gap-2 flex-wrap">
        <span className="text-xs px-2 py-0.5 rounded" style={{ backgroundColor: 'var(--agro-success-fill)', color: 'var(--agro-success-text)', fontWeight: 600 }}>
          {numSI} Si
        </span>
        <span className="text-xs px-2 py-0.5 rounded" style={{ backgroundColor: numNO > 0 ? 'var(--agro-danger-fill)' : 'var(--muted)', color: numNO > 0 ? 'var(--agro-danger-text)' : 'var(--muted-foreground)', fontWeight: 600 }}>
          {numNO} No
        </span>
        {numNA > 0 && (
          <span className="text-xs px-2 py-0.5 rounded" style={{ backgroundColor: 'var(--muted)', color: 'var(--muted-foreground)', fontWeight: 600 }}>
            {numNA} N/A
          </span>
        )}
        {numInc > 0 && (
          <span className="text-xs px-2 py-0.5 rounded" style={{ backgroundColor: 'var(--agro-danger-fill)', color: 'var(--agro-danger-text)', fontWeight: 600 }}>
            {numInc} incidencia{numInc !== 1 ? 's' : ''} M13
          </span>
        )}
      </div>
    </div>
  )
}

// ── Pantalla principal ────────────────────────────────────────────────────────

export function VerificacionInsumos() {
  const { profile, user } = useAuthContext()
  const esSuperAdmin = profile?.rol === 'super_admin'
  const { terminosSitio } = useModulosContext()
  const { ranchos } = useRanchos()
  const { registros, loading, error, refetch } = useM23VerificacionInsumos()
  const orgId = profile?.org_id ?? null
  const orgNombre = useOrganizacion(orgId)
  const termino = terminosSitio.singular

  // ── Navegación interna ──
  const [vista, setVista] = useState<Vista>('lista')
  const [registroActivo, setRegistroActivo] = useState<M23RegistroResumen | null>(null)

  // ── Insumos del registro activo (catálogo por instalación) ──
  const [catalogoRanchoId, setCatalogoRanchoId] = useState<string | null>(null)
  const { insumos: insumosActivos, loading: loadingInsumos, refetch: refetchInsumos } = useM23Insumos(
    registroActivo?.rancho_id ?? catalogoRanchoId,
    orgId
  )
  const insumosActivosFiltrados = insumosActivos.filter((i) => i.activo)

  // ── Días del registro activo ──
  const [dias, setDias] = useState<M23DiaConResultados[]>([])
  const [loadingDias, setLoadingDias] = useState(false)
  const [obsLocal, setObsLocal] = useState('')
  const [savingObs, setSavingObs] = useState(false)

  const cargarDias = useCallback(async (regId: string) => {
    if (!orgId) return
    setLoadingDias(true)
    try {
      const { data: diasData, error: dErr } = await tbl('m23_dias_inspeccion')
        .select('id, fecha')
        .eq('registro_id', regId)
        .eq('org_id', orgId)
        .order('fecha')
      if (dErr) throw dErr

      const diaIds = (diasData ?? []).map((d: any) => d.id as string)
      const diaFechaMap: Record<string, string> = {}
      for (const d of diasData ?? []) diaFechaMap[(d as any).id] = (d as any).fecha

      let resData: any[] = []
      if (diaIds.length > 0) {
        const { data: r, error: rErr } = await tbl('m23_resultados')
          .select('dia_id, insumo_id, valor, codigo_correctivo, incidencia_id')
          .in('dia_id', diaIds)
          .eq('org_id', orgId)
        if (rErr) throw rErr
        resData = r ?? []
      }

      const diaMap = new Map<string, M23DiaConResultados>()
      for (const d of diasData ?? []) {
        diaMap.set((d as any).id, { id: (d as any).id, fecha: (d as any).fecha, resultados: [] })
      }
      for (const r of resData) {
        diaMap.get(r.dia_id)?.resultados.push({
          insumo_id: r.insumo_id,
          valor: r.valor,
          codigo_correctivo: r.codigo_correctivo ?? null,
          incidencia_id: r.incidencia_id ?? null,
        })
      }
      setDias(Array.from(diaMap.values()))
    } catch (e: unknown) {
      toast.error(e instanceof Error ? e.message : 'Error al cargar días')
    } finally {
      setLoadingDias(false)
    }
  }, [orgId])

  const abrirDetalle = (reg: M23RegistroResumen) => {
    setRegistroActivo(reg)
    setObsLocal(reg.observaciones ?? '')
    setDias([])
    setVista('detalle')
    cargarDias(reg.id)
  }

  const volverALista = () => {
    setVista('lista')
    setRegistroActivo(null)
    setDias([])
    setCatalogoRanchoId(null)
  }

  async function handleGuardarObs() {
    if (!registroActivo || !orgId) return
    setSavingObs(true)
    try {
      const { error: e } = await tbl('m23_registro_mensual')
        .update({ observaciones: obsLocal || null })
        .eq('id', registroActivo.id)
        .eq('org_id', orgId)
      if (e) throw e
      setRegistroActivo((prev) => prev ? { ...prev, observaciones: obsLocal || null } : prev)
      refetch()
      toast.success('Observaciones guardadas')
    } catch (e: unknown) {
      toast.error(e instanceof Error ? e.message : 'Error al guardar')
    } finally {
      setSavingObs(false)
    }
  }

  // ── Sheets ──
  const [sheetNuevo, setSheetNuevo]         = useState(false)
  const [sheetDia, setSheetDia]             = useState(false)
  const [sheetConsolidado, setSheetConsolidado] = useState(false)
  const [sheetCatalogo, setSheetCatalogo]   = useState(false)

  // ── Sheet: nuevo registro mensual ──
  const [nRanchoId, setNRanchoId]           = useState('')
  const [nMes, setNMes]                     = useState(mesActual)
  const [nVerificoNombre, setNVerificoNombre] = useState('')
  const [nAutorizoNombre, setNAutorizoNombre] = useState('')
  const [nYaExiste, setNYaExiste]           = useState(false)
  const [nGuardando, setNGuardando]         = useState(false)
  const [nErrRancho, setNErrRancho]         = useState(false)

  useEffect(() => {
    if (!sheetNuevo || !nRanchoId || !nMes || !orgId) { setNYaExiste(false); return }
    let cancelado = false
    tbl('m23_registro_mensual')
      .select('id').eq('org_id', orgId).eq('rancho_id', nRanchoId).eq('mes', nMes + '-01')
      .maybeSingle()
      .then(({ data }: { data: any }) => { if (!cancelado) setNYaExiste(!!data) })
    return () => { cancelado = true }
  }, [sheetNuevo, nRanchoId, nMes, orgId])

  async function handleCrearRegistro() {
    if (!nRanchoId) { setNErrRancho(true); return }
    if (!orgId) { toast.error('Sin organización activa'); return }
    if (nYaExiste) { toast.warning('Ya existe un registro para este mes e instalación'); return }
    setNGuardando(true)
    try {
      const { data, error: e } = await tbl('m23_registro_mensual')
        .insert({
          rancho_id: nRanchoId,
          org_id: orgId,
          mes: nMes + '-01',
          verifico_nombre: nVerificoNombre.trim() || null,
          autorizo_nombre: nAutorizoNombre.trim() || null,
        })
        .select('*, ranchos(nombre, codigo)')
        .single()
      if (e) throw e
      toast.success('Registro mensual creado')
      setSheetNuevo(false)
      await refetch()
      const r = data as any
      const nuevo: M23RegistroResumen = {
        id: r.id,
        rancho_id: r.rancho_id,
        rancho_nombre: r.ranchos?.nombre ?? '—',
        rancho_codigo: r.ranchos?.codigo ?? '—',
        mes: r.mes,
        verifico_nombre: r.verifico_nombre ?? null,
        autorizo_nombre: r.autorizo_nombre ?? null,
        observaciones: null,
        created_at: r.created_at,
      }
      abrirDetalle(nuevo)
    } catch (e: unknown) {
      const msg = e instanceof Error ? e.message : 'Error al crear registro'
      if (msg.includes('23505') || msg.includes('unique') || msg.includes('duplicate')) {
        toast.warning('Ya existe un registro para este mes e instalación')
      } else {
        toast.error(msg)
      }
    } finally {
      setNGuardando(false)
    }
  }

  // ── Sheet: agregar día ──
  const [dFecha, setDFecha]               = useState('')
  const [dValores, setDValores]           = useState<Record<string, ValorM23>>({})
  const [dCodigos, setDCodigos]           = useState<Record<string, string>>({})
  const [dIncidencias, setDIncidencias]   = useState<Record<string, string>>({})
  const [dGuardando, setDGuardando]       = useState(false)
  const [dErrFecha, setDErrFecha]         = useState(false)
  const [dYaExiste, setDYaExiste]         = useState(false)

  const gruposActivos = useMemo(() => agruparPorArea(insumosActivosFiltrados), [insumosActivosFiltrados])

  useEffect(() => {
    if (!sheetDia || insumosActivosFiltrados.length === 0) return
    const init: Record<string, ValorM23> = {}
    insumosActivosFiltrados.forEach((i) => { init[i.id] = 'SI' })
    setDValores(init)
    setDCodigos({})
    setDIncidencias({})
    setDFecha(registroActivo ? (esSuperAdmin ? registroActivo.mes.slice(0, 7) + '-01' : hoy()) : '')
    setDErrFecha(false)
    setDYaExiste(false)
  }, [sheetDia, insumosActivosFiltrados.length, registroActivo])

  useEffect(() => {
    if (!sheetDia || !dFecha || !registroActivo || !orgId) { setDYaExiste(false); return }
    let cancelado = false
    tbl('m23_dias_inspeccion')
      .select('id').eq('registro_id', registroActivo.id).eq('org_id', orgId).eq('fecha', dFecha)
      .maybeSingle()
      .then(({ data }: { data: any }) => { if (!cancelado) setDYaExiste(!!data) })
    return () => { cancelado = true }
  }, [sheetDia, dFecha, registroActivo, orgId])

  async function handleGuardarDia() {
    if (!dFecha) { setDErrFecha(true); return }
    if (!registroActivo || !orgId) { toast.error('Sin registro activo'); return }
    if (dYaExiste) { toast.warning('Ya existe una verificación para esa fecha'); return }
    if (insumosActivosFiltrados.length === 0) { toast.error('No hay insumos activos en el catálogo de esta instalación'); return }

    const mes = registroActivo.mes.slice(0, 7)
    if (!dFecha.startsWith(mes)) {
      toast.error('La fecha debe estar dentro del mes del registro'); return
    }

    setDGuardando(true)
    try {
      // 1. Crear M13 incidencias para ítems NO con descripción
      const incItems = insumosActivosFiltrados.filter(
        (ins) => dValores[ins.id] === 'NO' && dIncidencias[ins.id]?.trim()
      )
      const incMap: Record<string, string> = {}

      if (incItems.length > 0) {
        const { data: reporteData, error: rErr } = await tbl('m13_reportes')
          .insert({
            rancho_id: registroActivo.rancho_id,
            org_id: orgId,
            fecha: dFecha,
            auditor_nombre: profile?.nombre_completo ?? null,
          })
          .select('id').single()
        if (rErr) throw rErr
        const reporteId = (reporteData as any).id as string

        for (let i = 0; i < incItems.length; i++) {
          const ins = incItems[i]
          const { data: incData, error: iErr } = await tbl('m13_incidencias')
            .insert({ reporte_id: reporteId, org_id: orgId, descripcion: dIncidencias[ins.id].trim(), orden: i + 1 })
            .select('id').single()
          if (iErr) throw iErr
          incMap[ins.id] = (incData as any).id as string
        }
      }

      // 2. Insertar día
      const { data: diaData, error: dErr } = await tbl('m23_dias_inspeccion')
        .insert({ registro_id: registroActivo.id, org_id: orgId, fecha: dFecha })
        .select('id').single()
      if (dErr) throw dErr
      const diaId = (diaData as any).id as string

      // 3. Batch insertar resultados
      const batchResultados = insumosActivosFiltrados.map((ins) => {
        const val: ValorM23 = dValores[ins.id] ?? 'SI'
        return {
          dia_id: diaId,
          insumo_id: ins.id,
          org_id: orgId,
          valor: val,
          codigo_correctivo: val === 'NO' ? (dCodigos[ins.id]?.trim() || null) : null,
          incidencia_id: incMap[ins.id] ?? null,
        }
      })
      const { error: bErr } = await tbl('m23_resultados').insert(batchResultados)
      if (bErr) throw bErr

      const numInc = Object.keys(incMap).length
      const msgExtra = numInc > 0 ? ` · ${numInc} incidencia${numInc > 1 ? 's' : ''} M13 vinculada${numInc > 1 ? 's' : ''}` : ''
      toast.success(`Día guardado${msgExtra}`)
      setSheetDia(false)
      cargarDias(registroActivo.id)
    } catch (e: unknown) {
      const msg = e instanceof Error ? e.message : 'Error al guardar día'
      if (msg.includes('FECHA_SOLO_HOY')) {
        toast.warning('Solo puedes registrar con la fecha de hoy')
      } else if (msg.includes('23505') || msg.includes('unique') || msg.includes('duplicate')) {
        toast.warning('Ya existe una verificación para esa fecha')
      } else {
        toast.error(msg)
      }
    } finally {
      setDGuardando(false)
    }
  }

  // ── Sheet: catálogo de insumos ──
  const [catRanchoId, setCatRanchoId]         = useState('')
  const [catNuevaArea, setCatNuevaArea]       = useState('')
  const [catNuevoInsumo, setCatNuevoInsumo]   = useState('')
  const [catAgregando, setCatAgregando]       = useState(false)
  const [catCargandoPlantilla, setCatCargandoPlantilla] = useState(false)
  const [catToggling, setCatToggling]         = useState<string | null>(null)

  const { insumos: insumosGestion, loading: loadingGestion, refetch: refetchGestion } = useM23Insumos(
    catRanchoId || null,
    orgId
  )

  const abrirCatalogo = () => {
    setCatRanchoId(registroActivo?.rancho_id ?? '')
    setCatNuevaArea('')
    setCatNuevoInsumo('')
    setSheetCatalogo(true)
  }

  async function handleAgregarInsumo() {
    if (!catRanchoId || !orgId) { toast.error(`Selecciona una ${termino}`); return }
    if (!catNuevaArea.trim()) { toast.error('Ingresa el área'); return }
    if (!catNuevoInsumo.trim()) { toast.error('Ingresa el insumo'); return }
    setCatAgregando(true)
    try {
      const maxOrden = insumosGestion
        .filter((i) => i.area === catNuevaArea.trim())
        .reduce((m, i) => Math.max(m, i.orden), 0)
      const { error: e } = await tbl('m23_insumos').insert({
        org_id: orgId,
        rancho_id: catRanchoId,
        area: catNuevaArea.trim(),
        insumo: catNuevoInsumo.trim(),
        activo: true,
        orden: maxOrden + 1,
      })
      if (e) {
        if (e.message.includes('23505') || e.message.includes('unique') || e.message.includes('duplicate')) {
          toast.warning('Ya existe ese insumo en esa área para esta instalación')
        } else throw e
      } else {
        setCatNuevoInsumo('')
        toast.success('Insumo agregado')
        refetchGestion()
        if (registroActivo?.rancho_id === catRanchoId) refetchInsumos()
      }
    } catch (e: unknown) {
      toast.error(e instanceof Error ? e.message : 'Error al agregar insumo')
    } finally {
      setCatAgregando(false)
    }
  }

  async function handleToggleActivo(ins: M23Insumo) {
    if (!orgId) return
    setCatToggling(ins.id)
    try {
      const { error: e } = await tbl('m23_insumos')
        .update({ activo: !ins.activo })
        .eq('id', ins.id)
        .eq('org_id', orgId)
      if (e) throw e
      refetchGestion()
      if (registroActivo?.rancho_id === catRanchoId) refetchInsumos()
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
      const rows: { org_id: string; rancho_id: string; area: string; insumo: string; activo: boolean; orden: number }[] = []
      for (const grupo of PLANTILLA_ESTANDAR) {
        grupo.insumos.forEach((insumo, idx) => {
          rows.push({ org_id: orgId, rancho_id: catRanchoId, area: grupo.area, insumo, activo: true, orden: idx + 1 })
        })
      }
      const { error: e } = await tbl('m23_insumos')
        .upsert(rows, { onConflict: 'rancho_id,area,insumo', ignoreDuplicates: true })
      if (e) throw e
      toast.success('Plantilla cargada (ítems nuevos insertados)')
      refetchGestion()
      if (registroActivo?.rancho_id === catRanchoId) refetchInsumos()
    } catch (e: unknown) {
      toast.error(e instanceof Error ? e.message : 'Error al cargar plantilla')
    } finally {
      setCatCargandoPlantilla(false)
    }
  }

  const insumosGestionGrupos = useMemo(() => agruparPorArea(insumosGestion), [insumosGestion])

  // ── PDF individual ──
  const [generandoPDF, setGenerandoPDF] = useState<string | null>(null)

  async function handlePDFIndividual(regId: string) {
    if (!orgId) return
    setGenerandoPDF(regId)
    try {
      await generarVerificacionInsumosPDF(regId, orgId)
      toast.success('PDF descargado')
    } catch (e: unknown) {
      toast.error(e instanceof Error ? e.message : 'Error al generar PDF')
    } finally {
      setGenerandoPDF(null)
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
    if (!orgId) { toast.error('Sin organización activa'); return }
    setCGenerando(true)
    try {
      const instalacionNombre = ranchos.find((r) => r.id === cRanchoId)?.nombre ?? cRanchoId
      await generarVerificacionInsumosConsolidadoPDF(cRanchoId, instalacionNombre, orgId, cDesde, cHasta)
      toast.success('PDF consolidado generado')
      setSheetConsolidado(false)
    } catch (e: unknown) {
      toast.error(e instanceof Error ? e.message : 'Error al generar PDF')
    } finally {
      setCGenerando(false)
    }
  }

  const numIncidenciasTotal = useMemo(
    () => dias.reduce((acc, d) => acc + d.resultados.filter((r) => r.incidencia_id).length, 0),
    [dias],
  )

  const ranchoOptions = ranchos.map((r) => ({ value: r.id, label: `${r.nombre} (${(r as any).codigo})` }))

  // ── Render ────────────────────────────────────────────────────────────────────

  return (
    <div className="min-h-full pb-[calc(72px+34px)]">

      {/* ── Header ── */}
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
          <div className="w-8 h-8 rounded-lg flex items-center justify-center flex-shrink-0" style={{ backgroundColor: 'var(--agro-success-fill)' }}>
            <ClipboardCheck className="w-4 h-4 text-primary" />
          </div>
          <div className="flex-1 min-w-0">
            {vista === 'lista' ? (
              <>
                <h1 className="text-sm text-foreground truncate" style={{ fontWeight: 600 }}>Verificación de Insumos</h1>
                <div className="text-xs text-muted-foreground">F-FRUS-SAN-01 · Diaria</div>
              </>
            ) : (
              <>
                <h1 className="text-sm text-foreground truncate" style={{ fontWeight: 600 }}>
                  {registroActivo ? formatMesLabel(registroActivo.mes) : '—'}
                </h1>
                <div className="text-xs text-muted-foreground truncate">{registroActivo?.rancho_nombre ?? '—'}</div>
              </>
            )}
          </div>
          {vista === 'lista' && (
            <div className="flex items-center gap-2">
              <button
                onClick={() => { setCatRanchoId(''); setCatNuevaArea(''); setCatNuevoInsumo(''); setSheetCatalogo(true) }}
                className="flex items-center gap-1 h-8 px-2.5 rounded-lg border border-border text-xs text-foreground"
              >
                <Settings className="w-3.5 h-3.5" />
              </button>
              <button
                onClick={() => setSheetConsolidado(true)}
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
                onClick={abrirCatalogo}
                className="flex items-center gap-1 h-8 px-2.5 rounded-lg border border-border text-xs text-foreground"
              >
                <Settings className="w-3.5 h-3.5" />
              </button>
              <button
                onClick={() => handlePDFIndividual(registroActivo.id)}
                disabled={generandoPDF === registroActivo.id || dias.length === 0}
                className="flex items-center gap-1.5 h-8 px-3 rounded-lg border border-border text-xs text-foreground disabled:opacity-50"
                style={{ fontWeight: 600 }}
              >
                {generandoPDF === registroActivo.id
                  ? <Loader2 className="w-3.5 h-3.5 animate-spin" />
                  : <FileDown className="w-3.5 h-3.5" />
                }
                PDF mes
              </button>
            </div>
          )}
        </div>
      </header>

      {/* ── LISTA ── */}
      {vista === 'lista' && (
        <div className="p-4 space-y-4">
          {error && (
            <div className="flex items-start gap-2 rounded-xl p-3" style={{ backgroundColor: 'var(--agro-danger-fill)', border: '1px solid var(--agro-red)' }}>
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
              <ClipboardCheck className="w-8 h-8 text-muted-foreground mx-auto mb-3" />
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
                      <div className="flex items-center gap-2 flex-wrap mb-1">
                        <span className="text-xs px-2 py-0.5 rounded" style={{ backgroundColor: 'var(--agro-success-fill)', color: 'var(--agro-success-text)', fontWeight: 600 }}>
                          {formatMesLabel(reg.mes)}
                        </span>
                      </div>
                      <div className="flex items-center gap-1 flex-wrap">
                        {orgNombre && (
                          <span className="text-xs text-muted-foreground font-medium">{orgNombre} ·</span>
                        )}
                        <span className="text-sm text-foreground truncate" style={{ fontWeight: 600 }}>{reg.rancho_nombre}</span>
                      </div>
                      {reg.verifico_nombre && (
                        <div className="text-xs text-muted-foreground mt-0.5">Verificó: {reg.verifico_nombre}</div>
                      )}
                      {reg.autorizo_nombre && (
                        <div className="text-xs text-muted-foreground">Autorizó: {reg.autorizo_nombre}</div>
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

      {/* ── DETALLE ── */}
      {vista === 'detalle' && registroActivo && (
        <div className="p-4 space-y-4">
          <div className="flex gap-2 flex-wrap">
            <span className="text-xs px-2 py-1 rounded" style={{ backgroundColor: 'var(--agro-success-fill)', color: 'var(--agro-success-text)' }}>
              {formatMesLabel(registroActivo.mes)}
            </span>
            <span className="text-xs px-2 py-1 rounded" style={{ backgroundColor: 'var(--muted)', color: 'var(--muted-foreground)' }}>
              {registroActivo.rancho_nombre} · {registroActivo.rancho_codigo}
            </span>
          </div>

          {numIncidenciasTotal > 0 && (
            <div className="flex items-start gap-2 rounded-xl p-3" style={{ backgroundColor: 'var(--agro-danger-fill)', border: '1px solid var(--agro-red)' }}>
              <AlertCircle className="w-4 h-4 flex-shrink-0 mt-0.5" style={{ color: 'var(--agro-danger-text)' }} />
              <p className="text-xs" style={{ color: 'var(--agro-danger-text)' }}>
                {numIncidenciasTotal} incidencia{numIncidenciasTotal !== 1 ? 's' : ''} M13 vinculada{numIncidenciasTotal !== 1 ? 's' : ''} este mes.
              </p>
            </div>
          )}

          {insumosActivosFiltrados.length === 0 && !loadingInsumos && (
            <div className="flex items-start gap-2 rounded-xl p-3" style={{ backgroundColor: 'var(--agro-warning-fill)', border: '1px solid var(--agro-amber)' }}>
              <TriangleAlert className="w-4 h-4 flex-shrink-0 mt-0.5" style={{ color: 'var(--agro-warning-text)' }} />
              <p className="text-xs" style={{ color: 'var(--agro-warning-text)' }}>
                No hay insumos activos. Configura el catálogo con el ícono de ajustes.
              </p>
            </div>
          )}

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

          <div>
            <h2 className="text-sm text-foreground mb-3" style={{ fontWeight: 600 }}>Días de verificación</h2>
            {loadingDias ? (
              <div className="flex justify-center py-6"><Loader2 className="w-5 h-5 text-primary animate-spin" /></div>
            ) : dias.length === 0 ? (
              <div className="bg-card border border-border rounded-xl p-6 text-center">
                <CalendarDays className="w-7 h-7 text-muted-foreground mx-auto mb-2" />
                <p className="text-sm text-muted-foreground">Sin días de verificación. Agrega el primer día con el botón +</p>
              </div>
            ) : (
              <div className="space-y-3">
                {dias.map((d) => <DiaCardM23 key={d.id} dia={d} />)}
              </div>
            )}
          </div>
        </div>
      )}

      {/* ── FAB ── */}
      <div className="fixed bottom-[calc(72px+34px+16px)] left-1/2 -translate-x-1/2 w-full max-w-[390px] flex justify-end px-4 pointer-events-none z-10">
        <button
          onClick={() => {
            if (vista === 'lista') {
              setNRanchoId(''); setNMes(mesActual())
              setNVerificoNombre(profile?.nombre_completo ?? '')
              setNAutorizoNombre('')
              setNErrRancho(false); setNYaExiste(false)
              setSheetNuevo(true)
            } else {
              setDFecha(''); setDErrFecha(false); setDYaExiste(false)
              setSheetDia(true)
            }
          }}
          className="pointer-events-auto w-14 h-14 bg-primary rounded-full flex items-center justify-center shadow-lg"
          aria-label={vista === 'lista' ? 'Nuevo registro mensual' : 'Agregar día de verificación'}
        >
          <Plus className="w-6 h-6 text-white" />
        </button>
      </div>

      {/* ═══ SHEET: NUEVO REGISTRO MENSUAL ═══════════════════════════════════════ */}
      <BottomSheet open={sheetNuevo} onClose={() => setSheetNuevo(false)} height="85%">
            <div className="flex justify-center pt-3 pb-1"><div className="w-9 h-1 rounded-full bg-border" /></div>
            <div className="px-4 pb-4">
              <div className="flex items-center justify-between mb-4">
                <h2 className="text-base text-foreground" style={{ fontWeight: 600 }}>Nuevo registro mensual</h2>
                <button onClick={() => setSheetNuevo(false)}><X className="w-5 h-5 text-muted-foreground" /></button>
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
                <div className="space-y-1">
                  <label className="text-xs text-muted-foreground" style={{ fontWeight: 600 }}>Mes *</label>
                  <input type="month" value={nMes} onChange={(e) => setNMes(e.target.value)}
                    className="w-full h-11 px-3 rounded-xl border border-border bg-input-background text-sm" />
                </div>
                <div className="space-y-1">
                  <label className="text-xs text-muted-foreground" style={{ fontWeight: 600 }}>Verificó (Jefe del Cooler)</label>
                  <input type="text" value={nVerificoNombre} onChange={(e) => setNVerificoNombre(e.target.value)}
                    placeholder="Nombre completo"
                    className="w-full h-11 px-3 rounded-xl border border-border bg-input-background text-sm" />
                </div>
                <div className="space-y-1">
                  <label className="text-xs text-muted-foreground" style={{ fontWeight: 600 }}>Autorizó (Gerente)</label>
                  <input type="text" value={nAutorizoNombre} onChange={(e) => setNAutorizoNombre(e.target.value)}
                    placeholder="Nombre completo"
                    className="w-full h-11 px-3 rounded-xl border border-border bg-input-background text-sm" />
                </div>
                {nYaExiste && (
                  <div className="flex items-start gap-2 rounded-xl p-3" style={{ backgroundColor: 'var(--agro-warning-fill)', border: '1px solid var(--agro-amber)' }}>
                    <TriangleAlert className="w-4 h-4 flex-shrink-0 mt-0.5" style={{ color: 'var(--agro-warning-text)' }} />
                    <p className="text-xs" style={{ color: 'var(--agro-warning-text)' }}>Ya existe un registro para esta {termino.toLowerCase()} y mes.</p>
                  </div>
                )}
                <button
                  onClick={handleCrearRegistro}
                  disabled={nGuardando || nYaExiste || !nRanchoId}
                  className="w-full h-11 rounded-xl text-sm text-white disabled:opacity-60"
                  style={{ backgroundColor: 'var(--primary)', fontWeight: 600 }}
                >
                  {nGuardando ? 'Creando…' : 'Crear registro'}
                </button>
              </div>
            </div>
      </BottomSheet>

      {/* ═══ SHEET: AGREGAR DÍA DE VERIFICACIÓN ═════════════════════════════════ */}
      <BottomSheet open={sheetDia && !!registroActivo} onClose={() => setSheetDia(false)} height="85%">
            <div className="flex justify-center pt-3 pb-1 flex-shrink-0"><div className="w-9 h-1 rounded-full bg-border" /></div>
            <div className="px-4 pb-2 flex-shrink-0">
              <div className="flex items-center justify-between mb-3">
                <h2 className="text-base text-foreground" style={{ fontWeight: 600 }}>Agregar día de verificación</h2>
                <button onClick={() => setSheetDia(false)}><X className="w-5 h-5 text-muted-foreground" /></button>
              </div>
              <div className="flex gap-2 mb-3 flex-wrap">
                <span className="text-xs px-2 py-0.5 rounded text-white" style={{ backgroundColor: 'var(--primary)', fontWeight: 600 }}>Si = disponible</span>
                <span className="text-xs px-2 py-0.5 rounded text-white" style={{ backgroundColor: 'var(--agro-red)', fontWeight: 600 }}>No = falta</span>
                <span className="text-xs px-2 py-0.5 rounded" style={{ backgroundColor: 'var(--switch-background)', color: 'var(--muted-foreground)', fontWeight: 600 }}>N/A</span>
              </div>
              <div className="space-y-1 mb-4">
                <label className="text-xs text-muted-foreground" style={{ fontWeight: 600 }}>Fecha *</label>
                <input
                  type="date"
                  value={dFecha}
                  min={esSuperAdmin ? registroActivo.mes : hoy()}
                  max={esSuperAdmin ? ultimoDiaMes(registroActivo.mes) : hoy()}
                  onChange={(e) => { if (esSuperAdmin) { setDFecha(e.target.value); setDErrFecha(false) } }}
                  className="w-full h-11 px-3 rounded-xl border border-border bg-input-background text-sm"
                  style={{ borderColor: dErrFecha ? 'var(--agro-red)' : undefined }}
                />
                {dErrFecha && <p className="text-xs" style={{ color: 'var(--agro-red)' }}>Fecha requerida</p>}
                {dYaExiste && (
                  <div className="flex items-start gap-2 rounded-xl p-3 mt-1" style={{ backgroundColor: 'var(--agro-warning-fill)', border: '1px solid var(--agro-amber)' }}>
                    <TriangleAlert className="w-4 h-4 flex-shrink-0 mt-0.5" style={{ color: 'var(--agro-warning-text)' }} />
                    <p className="text-xs" style={{ color: 'var(--agro-warning-text)' }}>Ya existe una verificación para esta fecha.</p>
                  </div>
                )}
              </div>
              {loadingInsumos && <div className="flex justify-center py-4"><Loader2 className="w-5 h-5 text-primary animate-spin" /></div>}
            </div>

            {!loadingInsumos && (
              <div className="flex-1 overflow-y-auto px-4">
                {insumosActivosFiltrados.length === 0 ? (
                  <div className="text-center py-8 text-sm text-muted-foreground">
                    Sin insumos activos. Configura el catálogo primero.
                  </div>
                ) : (
                  gruposActivos.map((grupo) => (
                    <div key={grupo.area} className="mb-4">
                      <div className="text-xs px-3 py-2 rounded-lg mb-1" style={{ backgroundColor: 'var(--primary)', color: '#fff', fontWeight: 600 }}>
                        {grupo.area}
                      </div>
                      <div className="bg-card border border-border rounded-xl px-3">
                        {grupo.items.map((ins) => (
                          <ToggleInsumo
                            key={ins.id}
                            label={ins.insumo}
                            valor={dValores[ins.id] ?? 'SI'}
                            codigo={dCodigos[ins.id] ?? ''}
                            incidenciaDesc={dIncidencias[ins.id] ?? ''}
                            onChange={(v) => setDValores((prev) => ({ ...prev, [ins.id]: v }))}
                            onCodigo={(c) => setDCodigos((prev) => ({ ...prev, [ins.id]: c }))}
                            onIncidenciaDesc={(d) => setDIncidencias((prev) => ({ ...prev, [ins.id]: d }))}
                          />
                        ))}
                      </div>
                    </div>
                  ))
                )}
              </div>
            )}

            <div className="px-4 py-4 border-t border-border flex-shrink-0">
              <button
                onClick={handleGuardarDia}
                disabled={dGuardando || dYaExiste || !dFecha || loadingInsumos || insumosActivosFiltrados.length === 0}
                className="w-full h-11 rounded-xl text-sm text-white disabled:opacity-60 flex items-center justify-center gap-2"
                style={{ backgroundColor: 'var(--primary)', fontWeight: 600 }}
              >
                {dGuardando
                  ? <><Loader2 className="w-4 h-4 animate-spin" /> Guardando…</>
                  : `Guardar ${insumosActivosFiltrados.length} insumos`
                }
              </button>
            </div>
      </BottomSheet>

      {/* ═══ SHEET: CATÁLOGO DE INSUMOS ══════════════════════════════════════════ */}
      <BottomSheet open={sheetCatalogo} onClose={() => setSheetCatalogo(false)} height="92%">
            <div className="flex justify-center pt-3 pb-1 flex-shrink-0"><div className="w-9 h-1 rounded-full bg-border" /></div>
            <div className="px-4 pb-3 flex-shrink-0 border-b border-border">
              <div className="flex items-center justify-between mb-3">
                <h2 className="text-base text-foreground" style={{ fontWeight: 600 }}>Catálogo de insumos</h2>
                <button onClick={() => setSheetCatalogo(false)}><X className="w-5 h-5 text-muted-foreground" /></button>
              </div>
              <select
                value={catRanchoId}
                onChange={(e) => setCatRanchoId(e.target.value)}
                className="w-full h-10 px-3 rounded-xl border border-border bg-input-background text-sm mb-3"
              >
                <option value="">Selecciona una {termino.toLowerCase()}</option>
                {ranchoOptions.map((o) => <option key={o.value} value={o.value}>{o.label}</option>)}
              </select>

              {catRanchoId && (
                <>
                  <button
                    onClick={handleCargarPlantilla}
                    disabled={catCargandoPlantilla}
                    className="w-full h-9 rounded-lg border-2 text-xs mb-2 flex items-center justify-center gap-1.5 disabled:opacity-50"
                    style={{ borderColor: 'var(--primary)', color: 'var(--primary)', fontWeight: 600 }}
                  >
                    {catCargandoPlantilla ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : null}
                    Cargar plantilla estándar (30 ítems)
                  </button>

                  <div className="flex gap-2">
                    <input
                      type="text"
                      value={catNuevaArea}
                      onChange={(e) => setCatNuevaArea(e.target.value)}
                      placeholder="Área"
                      className="flex-1 h-9 px-2 rounded-lg border border-border bg-input-background text-xs"
                    />
                    <input
                      type="text"
                      value={catNuevoInsumo}
                      onChange={(e) => setCatNuevoInsumo(e.target.value)}
                      placeholder="Insumo"
                      onKeyDown={(e) => { if (e.key === 'Enter') handleAgregarInsumo() }}
                      className="flex-1 h-9 px-2 rounded-lg border border-border bg-input-background text-xs"
                    />
                    <button
                      onClick={handleAgregarInsumo}
                      disabled={catAgregando || !catNuevaArea.trim() || !catNuevoInsumo.trim()}
                      className="h-9 w-9 rounded-lg flex items-center justify-center text-white disabled:opacity-50"
                      style={{ backgroundColor: 'var(--primary)' }}
                    >
                      {catAgregando ? <Loader2 className="w-4 h-4 animate-spin" /> : <Plus className="w-4 h-4" />}
                    </button>
                  </div>
                </>
              )}
            </div>

            <div className="flex-1 overflow-y-auto px-4 py-3">
              {loadingGestion ? (
                <div className="flex justify-center py-8"><Loader2 className="w-5 h-5 text-primary animate-spin" /></div>
              ) : !catRanchoId ? (
                <p className="text-sm text-muted-foreground text-center py-8">Selecciona una {termino.toLowerCase()} para ver su catálogo</p>
              ) : insumosGestion.length === 0 ? (
                <p className="text-sm text-muted-foreground text-center py-8">Sin insumos. Agrega uno o carga la plantilla estándar.</p>
              ) : (
                insumosGestionGrupos.map((grupo) => (
                  <div key={grupo.area} className="mb-4">
                    <div className="text-xs px-3 py-1.5 rounded-lg mb-1" style={{ backgroundColor: 'var(--muted)', color: 'var(--muted-foreground)', fontWeight: 600 }}>
                      {grupo.area}
                    </div>
                    <div className="bg-card border border-border rounded-xl divide-y divide-border">
                      {grupo.items.map((ins) => (
                        <div key={ins.id} className="flex items-center justify-between px-3 py-2.5">
                          <span className={`text-sm flex-1 ${!ins.activo ? 'line-through text-muted-foreground' : ''}`}>
                            {ins.insumo}
                          </span>
                          <button
                            onClick={() => handleToggleActivo(ins)}
                            disabled={catToggling === ins.id}
                            className="ml-2 text-xs px-2 py-1 rounded-lg border"
                            style={{
                              borderColor: ins.activo ? 'var(--primary)' : 'var(--border)',
                              color: ins.activo ? 'var(--primary)' : 'var(--muted-foreground)',
                              fontWeight: 600,
                            }}
                          >
                            {catToggling === ins.id
                              ? <Loader2 className="w-3 h-3 animate-spin" />
                              : ins.activo ? 'Activo' : 'Inactivo'
                            }
                          </button>
                        </div>
                      ))}
                    </div>
                  </div>
                ))
              )}
            </div>
      </BottomSheet>

      {/* ═══ SHEET: EXPORTAR CONSOLIDADO ═════════════════════════════════════════ */}
      <BottomSheet open={sheetConsolidado} onClose={() => setSheetConsolidado(false)} height="55%">
            <div className="flex justify-center pt-3 pb-1"><div className="w-9 h-1 rounded-full bg-border" /></div>
            <div className="px-4 pb-4">
              <div className="flex items-center justify-between mb-4">
                <h2 className="text-base text-foreground" style={{ fontWeight: 600 }}>Exportar consolidado</h2>
                <button onClick={() => setSheetConsolidado(false)}><X className="w-5 h-5 text-muted-foreground" /></button>
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
                <div className="grid grid-cols-2 gap-3">
                  <div className="space-y-1">
                    <label className="text-xs text-muted-foreground" style={{ fontWeight: 600 }}>Desde</label>
                    <input type="month" value={cDesde} onChange={(e) => setCDesde(e.target.value)}
                      className="w-full h-11 px-3 rounded-xl border border-border bg-input-background text-sm" />
                  </div>
                  <div className="space-y-1">
                    <label className="text-xs text-muted-foreground" style={{ fontWeight: 600 }}>Hasta</label>
                    <input type="month" value={cHasta} onChange={(e) => setCHasta(e.target.value)}
                      className="w-full h-11 px-3 rounded-xl border border-border bg-input-background text-sm" />
                  </div>
                </div>
                <button
                  onClick={handleConsolidado}
                  disabled={cGenerando || !cRanchoId}
                  className="w-full h-11 rounded-xl text-sm text-white disabled:opacity-60 flex items-center justify-center gap-2"
                  style={{ backgroundColor: 'var(--primary)', fontWeight: 600 }}
                >
                  {cGenerando
                    ? <><Loader2 className="w-4 h-4 animate-spin" /> Generando PDF…</>
                    : <><FileDown className="w-4 h-4" /> Descargar PDF</>
                  }
                </button>
            </div>
          </div>
      </BottomSheet>
    </div>
  )
}
