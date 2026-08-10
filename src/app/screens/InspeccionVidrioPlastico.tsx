// PATRÓN INOCUIDAD M7 — catálogo-primero (v2)
// Flujo: configurar catálogo de materiales por rancho una vez → al inspeccionar,
// todos los materiales se cargan automáticamente. El usuario solo ajusta estado.

import { useState, useEffect } from 'react'
import {
  ChevronLeft, Plus, FileDown, X, Loader2, Eye, Files,
  AlertTriangle, Trash2, Settings,
} from 'lucide-react'
import { useNavigate } from 'react-router'
import { BottomSheet } from '@/app/components/BottomSheet'
import { toast } from 'sonner'
import { useAuthContext } from '@/context/AuthContext'
import { useRanchos } from '@/hooks/useRanchos'
import { useVidrioPlastico, type M7Inspeccion } from '@/hooks/useVidrioPlastico'
import { useOrganizacion } from '@/hooks/useOrganizacion'
import { supabase } from '@/lib/supabase'
import { generarVidrioPlasticoPDF } from '@/lib/pdf/m7/generarVidrioPlasticoPDF'
import { generarVidrioPlasticoConsolidadoPDF } from '@/lib/pdf/m7/generarVidrioPlasticoConsolidadoPDF'
import type { VidrioPlasticoPDFProps } from '@/lib/pdf/m7/VidrioPlasticoPDF'
import { useModulosContext } from '@/context/ModulosContext'

// ── Constantes ───────────────────────────────────────────────────────────────

const TITULO_MODULO = 'Inspección de Vidrio y Plástico Duro'
const CLAVE_MODULO  = 'MXA-F-SC-SIG-029.14 · Quincenal'

const ESTADO_OPTIONS = ['Bueno', 'Deteriorado', 'Reemplazo'] as const
type Estado = (typeof ESTADO_OPTIONS)[number]

const ESTADO_CHIP: Record<Estado, { bg: string; text: string }> = {
  'Bueno':       { bg: 'var(--agro-success-fill)', text: 'var(--agro-success-text)' },
  'Deteriorado': { bg: 'var(--agro-warning-fill)', text: 'var(--agro-warning-text)' },
  'Reemplazo':   { bg: 'var(--agro-danger-fill)',  text: 'var(--agro-danger-text)'  },
}

// TODO: poblar SET_MATERIALES_DEFAULT con la lista oficial (área + material).
const SET_MATERIALES_DEFAULT: { area: string; material: string }[] = []

// ── Tipos ────────────────────────────────────────────────────────────────────

type FilaInspeccion = {
  catalogoId: string
  area: string
  material: string
  protegido: boolean
  estado: Estado
  observaciones: string
}

interface MaterialCatalogo {
  id: string
  area: string
  material: string
}

const hoy = () => new Date().toLocaleDateString('en-CA', { timeZone: 'America/Mexico_City' })

// ── Helpers ───────────────────────────────────────────────────────────────────

function formatFecha(iso: string): string {
  try {
    return new Date(iso + 'T12:00:00').toLocaleDateString('es-MX', {
      day: 'numeric', month: 'short', year: 'numeric',
    })
  } catch {
    return iso
  }
}

function resumirEstados(materiales: M7Inspeccion['materiales']): Partial<Record<Estado, number>> {
  const counts: Partial<Record<Estado, number>> = {}
  for (const m of materiales) {
    counts[m.estado] = (counts[m.estado] ?? 0) + 1
  }
  return counts
}

function parsearErrorLimite(mensaje: string, singular = 'rancho'): string {
  const fechas = mensaje.match(/\d{2}\/\d{2}\/\d{4}/g)
  const proxima = fechas ? fechas[fechas.length - 1] : null
  return proxima
    ? `Ya se registró una inspección esta quincena. Próxima disponible: ${proxima}.`
    : `Solo se permite una inspección de vidrio y plástico cada 14 días por ${singular}.`
}

// ── SuggestionInput ───────────────────────────────────────────────────────────
// Input con dropdown custom — no usa <datalist> nativo (desborda en 390px).

function SuggestionInput({
  value,
  onChange,
  suggestions,
  placeholder,
  error,
}: {
  value: string
  onChange: (v: string) => void
  suggestions: string[]
  placeholder?: string
  error?: boolean
}) {
  const [open, setOpen] = useState(false)
  const filtered = suggestions.filter(
    (s) =>
      s.toLowerCase().includes(value.toLowerCase()) &&
      s.toLowerCase() !== value.toLowerCase()
  )

  return (
    <div className="relative">
      <input
        type="text"
        value={value}
        onChange={(e) => { onChange(e.target.value); setOpen(true) }}
        onFocus={() => setOpen(true)}
        onBlur={() => setTimeout(() => setOpen(false), 150)}
        placeholder={placeholder}
        className={`w-full h-10 px-3 rounded-lg bg-card border text-sm text-foreground placeholder:text-muted-foreground focus:outline-none focus:border-primary focus:ring-1 focus:ring-primary ${
          error ? 'border-agro-red' : 'border-border'
        }`}
      />
      {open && filtered.length > 0 && (
        <div className="absolute z-50 left-0 right-0 top-full mt-1 bg-card border border-border rounded-xl overflow-hidden shadow-lg max-h-36 overflow-y-auto">
          {filtered.slice(0, 8).map((s) => (
            <button
              key={s}
              type="button"
              onMouseDown={() => { onChange(s); setOpen(false) }}
              className="w-full text-left px-3 py-2 text-sm text-foreground hover:bg-muted transition-colors"
            >
              {s}
            </button>
          ))}
        </div>
      )}
    </div>
  )
}

// ── MaterialRowInspeccion ─────────────────────────────────────────────────────
// Fila compacta: nombre del material + protegido toggle + chips de estado + obs.

function MaterialRowInspeccion({
  fila,
  onChange,
}: {
  fila: FilaInspeccion
  onChange: (f: FilaInspeccion) => void
}) {
  return (
    <div className="border border-border rounded-xl p-3 space-y-2 bg-card">
      <p className="text-sm text-foreground" style={{ fontWeight: 600 }}>
        {fila.material}
      </p>

      <div className="flex items-center gap-3">
        <span className="text-xs text-muted-foreground flex-shrink-0" style={{ minWidth: 72 }}>
          Protegido
        </span>
        <div className="flex gap-1.5">
          <button
            type="button"
            onClick={() => onChange({ ...fila, protegido: true })}
            className={`h-7 px-3 rounded-lg text-xs transition-colors ${
              fila.protegido
                ? 'bg-primary text-white'
                : 'bg-input-background text-muted-foreground border border-border'
            }`}
            style={{ fontWeight: fila.protegido ? 600 : 400 }}
          >
            Sí
          </button>
          <button
            type="button"
            onClick={() => onChange({ ...fila, protegido: false })}
            className={`h-7 px-3 rounded-lg text-xs transition-colors ${
              !fila.protegido ? 'text-white' : 'bg-input-background text-muted-foreground border border-border'
            }`}
            style={
              !fila.protegido
                ? { backgroundColor: 'var(--agro-red)', fontWeight: 600 }
                : { fontWeight: 400 }
            }
          >
            No
          </button>
        </div>
      </div>

      <div className="flex items-center gap-3">
        <span className="text-xs text-muted-foreground flex-shrink-0" style={{ minWidth: 72 }}>
          Estado
        </span>
        <div className="flex gap-1.5 flex-wrap">
          {ESTADO_OPTIONS.map((e) => (
            <button
              key={e}
              type="button"
              onClick={() => onChange({ ...fila, estado: e })}
              className="h-7 px-2.5 rounded-lg text-xs transition-colors"
              style={
                fila.estado === e
                  ? { backgroundColor: ESTADO_CHIP[e].bg, color: ESTADO_CHIP[e].text, fontWeight: 600 }
                  : {
                      backgroundColor: 'var(--input-background)',
                      color: 'var(--muted-foreground)',
                      border: '1px solid var(--border)',
                      fontWeight: 400,
                    }
              }
            >
              {e}
            </button>
          ))}
        </div>
      </div>

      <input
        type="text"
        value={fila.observaciones}
        onChange={(e) => onChange({ ...fila, observaciones: e.target.value })}
        placeholder="Observaciones (opcional)"
        className="w-full h-8 px-3 rounded-lg bg-muted border border-border text-xs text-foreground placeholder:text-muted-foreground focus:outline-none focus:border-primary"
      />
    </div>
  )
}

// ── Pantalla principal ────────────────────────────────────────────────────────

export function InspeccionVidrioPlastico() {
  const navigate = useNavigate()
  const { profile } = useAuthContext()
  const esSuperAdmin = profile?.rol === 'super_admin'
  const { ranchos } = useRanchos()
  const { inspecciones, loading, refetch } = useVidrioPlastico()
  const { terminosSitio } = useModulosContext()
  const orgNombre = useOrganizacion(profile?.org_id)

  const ranchoOptions = ranchos.map((r) => ({ value: r.id, label: r.nombre }))

  // ── Estado inspección ───────────────────────────────────────────────────
  const [sheetInspeccionAbierto, setSheetInspeccionAbierto] = useState(false)
  const [ranchoId, setRanchoId] = useState('')
  const [fecha, setFecha] = useState(hoy())
  const [filasInspeccion, setFilasInspeccion] = useState<FilaInspeccion[]>([])
  const [cargandoMateriales, setCargandoMateriales] = useState(false)
  const [errRancho, setErrRancho] = useState(false)
  const [guardando, setGuardando] = useState(false)
  const [limiteInfo, setLimiteInfo] = useState<{ proxima: string } | null>(null)
  const [generandoPDF, setGenerandoPDF] = useState<string | null>(null)

  // ── Estado configuración ────────────────────────────────────────────────
  const [sheetConfigAbierto, setSheetConfigAbierto] = useState(false)
  const [configRanchoId, setConfigRanchoId] = useState('')
  const [configMateriales, setConfigMateriales] = useState<MaterialCatalogo[]>([])
  const [cargandoConfig, setCargandoConfig] = useState(false)
  const [nuevaArea, setNuevaArea] = useState('')
  const [nuevaMaterial, setNuevaMaterial] = useState('')
  const [errNuevaArea, setErrNuevaArea] = useState(false)
  const [errNuevaMaterial, setErrNuevaMaterial] = useState(false)
  const [guardandoNuevo, setGuardandoNuevo] = useState(false)

  // ── Estado consolidado ──────────────────────────────────────────────────
  const [sheetConsolidadoAbierto, setSheetConsolidadoAbierto] = useState(false)
  const [consRanchoId, setConsRanchoId] = useState('')
  const [consDesde, setConsDesde] = useState('')
  const [consHasta, setConsHasta] = useState(hoy())
  const [generandoConsolidado, setGenerandoConsolidado] = useState(false)
  const [errConsRancho, setErrConsRancho] = useState(false)
  const [errConsFechas, setErrConsFechas] = useState(false)

  // ── Carga de materiales del catálogo al cambiar rancho en inspección ────
  useEffect(() => {
    if (!sheetInspeccionAbierto || !ranchoId || !profile?.org_id) {
      setFilasInspeccion([])
      setCargandoMateriales(false)
      return
    }
    let cancelado = false
    setFilasInspeccion([])
    setCargandoMateriales(true)

    supabase
      .from('m7_materiales_rancho')
      .select('id, area, material')
      .eq('org_id', profile.org_id)
      .eq('rancho_id', ranchoId)
      .eq('activo', true)
      .order('area')
      .order('material')
      .then(({ data, error }) => {
        if (cancelado) return
        if (error) {
          toast.error('Error al cargar materiales del catálogo')
          setCargandoMateriales(false)
          return
        }
        setFilasInspeccion(
          (data ?? []).map((m) => ({
            catalogoId: m.id,
            area: m.area,
            material: m.material,
            protegido: true,
            estado: 'Bueno' as Estado,
            observaciones: '',
          }))
        )
        setCargandoMateriales(false)
      })

    return () => { cancelado = true }
  }, [sheetInspeccionAbierto, ranchoId, profile?.org_id])

  // ── Carga de materiales al cambiar rancho en configuración ───────────────
  useEffect(() => {
    if (!sheetConfigAbierto || !configRanchoId || !profile?.org_id) {
      setConfigMateriales([])
      return
    }
    let cancelado = false
    setCargandoConfig(true)

    supabase
      .from('m7_materiales_rancho')
      .select('id, area, material')
      .eq('org_id', profile.org_id)
      .eq('rancho_id', configRanchoId)
      .eq('activo', true)
      .order('area')
      .order('material')
      .then(({ data }) => {
        if (!cancelado) {
          setConfigMateriales(data ?? [])
          setCargandoConfig(false)
        }
      })

    return () => { cancelado = true }
  }, [sheetConfigAbierto, configRanchoId, profile?.org_id])

  // ── Verificación proactiva del límite quincenal ──────────────────────────
  useEffect(() => {
    if (!sheetInspeccionAbierto || !ranchoId || !fecha || !profile?.org_id) {
      setLimiteInfo(null)
      return
    }
    let cancelado = false
    const fechaDate = new Date(fecha + 'T12:00:00')
    const inicio = new Date(fechaDate)
    inicio.setDate(inicio.getDate() - 13)
    const inicioStr = inicio.toISOString().split('T')[0]

    supabase
      .from('m7_vidrio_plastico')
      .select('fecha')
      .eq('org_id', profile.org_id)
      .eq('rancho_id', ranchoId)
      .gte('fecha', inicioStr)
      .lt('fecha', fecha)
      .order('fecha', { ascending: false })
      .limit(1)
      .then(({ data }) => {
        if (cancelado) return
        if (data && data.length > 0) {
          const ultimoDate = new Date(data[0].fecha + 'T12:00:00')
          const proximaDate = new Date(ultimoDate)
          proximaDate.setDate(proximaDate.getDate() + 14)
          setLimiteInfo({ proxima: formatFecha(proximaDate.toISOString().split('T')[0]) })
        } else {
          setLimiteInfo(null)
        }
      })

    return () => { cancelado = true }
  }, [sheetInspeccionAbierto, ranchoId, fecha, profile?.org_id])

  // ── Sugerencias dinámicas para config (solo lo ya configurado en este rancho) ──
  const areasSugerencias = [...new Set(configMateriales.map((m) => m.area))]
  const materialesSugerencias = [...new Set(configMateriales.map((m) => m.material))]

  // ── Materiales agrupados por área (para inspección) ──────────────────────
  const materialesGrouped = filasInspeccion.reduce<Record<string, { fila: FilaInspeccion; idx: number }[]>>(
    (acc, fila, idx) => {
      if (!acc[fila.area]) acc[fila.area] = []
      acc[fila.area].push({ fila, idx })
      return acc
    },
    {}
  )

  // ── Handlers inspección ──────────────────────────────────────────────────

  function abrirSheetInspeccion() {
    setRanchoId('')
    setFecha(hoy())
    setFilasInspeccion([])
    setErrRancho(false)
    setLimiteInfo(null)
    setSheetInspeccionAbierto(true)
  }

  function updateFilaInspeccion(idx: number, f: FilaInspeccion) {
    setFilasInspeccion((prev) => prev.map((x, i) => (i === idx ? f : x)))
  }

  async function handleGuardar() {
    if (!ranchoId) { setErrRancho(true); return }
    if (!profile?.org_id) { toast.error('Sin organización activa'); return }
    if (filasInspeccion.length === 0) {
      toast.error('Configura al menos un material antes de inspeccionar')
      return
    }

    setGuardando(true)
    try {
      const rows = filasInspeccion.map((f) => ({
        rancho_id: ranchoId,
        org_id: profile.org_id,
        fecha,
        registrado_por: profile.id,
        area: f.area,
        material_equipo: f.material,
        protegido: f.protegido,
        estado: f.estado,
        observaciones: f.observaciones.trim() || null,
      }))

      const { data, error } = await supabase
        .from('m7_vidrio_plastico')
        .insert(rows)
        .select('id')

      if (error) throw error

      toast.success('Inspección guardada')
      setSheetInspeccionAbierto(false)
      await refetch()

      const rancho = ranchos.find((r) => r.id === ranchoId)
      if (rancho) {
        const folio = (data?.[0]?.id as string)?.slice(0, 8).toUpperCase() ?? '—'
        const pdfProps: VidrioPlasticoPDFProps = {
          folio,
          rancho: rancho.nombre,
          ranchoCodigo: rancho.codigo,
          fecha,
          responsableNombre: profile.nombre_completo,
          materiales: filasInspeccion.map((f) => ({
            area: f.area,
            material_equipo: f.material,
            protegido: f.protegido,
            estado: f.estado,
            observaciones: f.observaciones.trim() || null,
          })),
        }
        try {
          await generarVidrioPlasticoPDF(pdfProps, rancho.nombre, fecha)
        } catch {
          toast.warning('Inspección guardada — el PDF no se pudo generar. Descárgalo desde el historial.')
        }
      }
    } catch (err: unknown) {
      const mensaje = (err instanceof Error ? err.message : (err as any)?.message) ?? ''
      if (mensaje.includes('FECHA_SOLO_HOY')) {
        toast.warning('Solo puedes registrar con la fecha de hoy')
      } else if (mensaje.includes('M7_LIMITE_QUINCENAL')) {
        toast.warning(parsearErrorLimite(mensaje, terminosSitio.singular.toLowerCase()), { duration: 7000 })
      } else {
        toast.error(mensaje || 'No se pudo guardar la inspección')
      }
    } finally {
      setGuardando(false)
    }
  }

  async function handleDescargarPDF(insp: M7Inspeccion) {
    const key = `${insp.rancho_id}|${insp.fecha}`
    setGenerandoPDF(key)
    try {
      const folio = insp.materiales[0]?.id.slice(0, 8).toUpperCase() ?? '—'
      const pdfProps: VidrioPlasticoPDFProps = {
        folio,
        rancho: insp.rancho_nombre,
        ranchoCodigo: insp.rancho_codigo,
        fecha: insp.fecha,
        responsableNombre: profile?.nombre_completo ?? 'Responsable',
        materiales: insp.materiales.map((m) => ({
          area: m.area,
          material_equipo: m.material_equipo,
          protegido: m.protegido,
          estado: m.estado,
          observaciones: m.observaciones,
        })),
      }
      await generarVidrioPlasticoPDF(pdfProps, insp.rancho_nombre, insp.fecha)
    } catch {
      toast.error('No se pudo generar el PDF')
    } finally {
      setGenerandoPDF(null)
    }
  }

  // ── Handlers configuración ───────────────────────────────────────────────

  function abrirSheetConfig(ranchoPreset?: string) {
    setConfigRanchoId(ranchoPreset ?? '')
    setConfigMateriales([])
    setNuevaArea('')
    setNuevaMaterial('')
    setErrNuevaArea(false)
    setErrNuevaMaterial(false)
    setSheetConfigAbierto(true)
  }

  async function handleCargarSetEstandar() {
    if (!profile?.org_id || SET_MATERIALES_DEFAULT.length === 0) return
    setGuardandoNuevo(true)
    try {
      const rows = SET_MATERIALES_DEFAULT.map((item) => ({
        rancho_id: configRanchoId,
        org_id: profile.org_id,
        area: item.area,
        material: item.material,
        activo: true,
      }))
      const { error } = await supabase
        .from('m7_materiales_rancho')
        .upsert(rows, { onConflict: 'rancho_id,area,material' })
      if (error) throw error
      const { data } = await supabase
        .from('m7_materiales_rancho')
        .select('id, area, material')
        .eq('org_id', profile.org_id)
        .eq('rancho_id', configRanchoId)
        .eq('activo', true)
        .order('area')
        .order('material')
      setConfigMateriales(data ?? [])
      toast.success('Set estándar cargado')
    } catch (e: unknown) {
      toast.error(e instanceof Error ? e.message : 'Error al cargar set estándar')
    } finally {
      setGuardandoNuevo(false)
    }
  }

  async function handleAgregarMaterial() {
    let err = false
    if (!nuevaArea.trim()) { setErrNuevaArea(true); err = true }
    if (!nuevaMaterial.trim()) { setErrNuevaMaterial(true); err = true }
    if (err || !profile?.org_id) return

    setGuardandoNuevo(true)
    try {
      const { error } = await supabase
        .from('m7_materiales_rancho')
        .upsert(
          {
            rancho_id: configRanchoId,
            org_id: profile.org_id,
            area: nuevaArea.trim(),
            material: nuevaMaterial.trim(),
            activo: true,
          },
          { onConflict: 'rancho_id,area,material' }
        )
      if (error) throw error

      setNuevaArea('')
      setNuevaMaterial('')

      const { data } = await supabase
        .from('m7_materiales_rancho')
        .select('id, area, material')
        .eq('org_id', profile.org_id)
        .eq('rancho_id', configRanchoId)
        .eq('activo', true)
        .order('area')
        .order('material')
      setConfigMateriales(data ?? [])
    } catch (e: unknown) {
      toast.error(e instanceof Error ? e.message : 'Error al agregar material')
    } finally {
      setGuardandoNuevo(false)
    }
  }

  async function handleEliminarMaterial(id: string) {
    try {
      const { error } = await supabase
        .from('m7_materiales_rancho')
        .update({ activo: false })
        .eq('id', id)
      if (error) throw error
      setConfigMateriales((prev) => prev.filter((m) => m.id !== id))
    } catch (e: unknown) {
      toast.error(e instanceof Error ? e.message : 'Error al eliminar material')
    }
  }

  // ── Handlers consolidado ─────────────────────────────────────────────────

  async function handleGenerarConsolidado() {
    let valido = true
    if (!consRanchoId) { setErrConsRancho(true); valido = false }
    if (!consDesde || !consHasta) { setErrConsFechas(true); valido = false }
    if (!valido) return
    if (!profile?.org_id) { toast.error('Sin organización activa'); return }

    setGenerandoConsolidado(true)
    try {
      const { data, error } = await supabase
        .from('m7_vidrio_plastico')
        .select('*, ranchos(nombre, codigo)')
        .eq('org_id', profile.org_id)
        .eq('rancho_id', consRanchoId)
        .gte('fecha', consDesde)
        .lte('fecha', consHasta)
        .order('fecha', { ascending: true })
        .order('created_at', { ascending: true })

      if (error) throw error
      if (!data || data.length === 0) {
        toast.warning(`No hay registros en ese rango para ${terminosSitio.genero === 'f' ? 'la' : 'el'} ${terminosSitio.singular.toLowerCase()} seleccionado${terminosSitio.genero === 'f' ? 'a' : ''}`)
        return
      }

      const rancho = ranchos.find((r) => r.id === consRanchoId)
      const ranchoNombre = rancho?.nombre ?? 'Rancho'

      const grouped = new Map<string, VidrioPlasticoPDFProps>()
      for (const row of data as any[]) {
        if (!grouped.has(row.fecha)) {
          grouped.set(row.fecha, {
            folio: (row.id as string).slice(0, 8).toUpperCase(),
            rancho: row.ranchos?.nombre ?? ranchoNombre,
            ranchoCodigo: row.ranchos?.codigo ?? rancho?.codigo ?? '—',
            fecha: row.fecha,
            responsableNombre: profile.nombre_completo,
            materiales: [],
          })
        }
        grouped.get(row.fecha)!.materiales.push({
          area: row.area,
          material_equipo: row.material_equipo,
          protegido: row.protegido,
          estado: row.estado,
          observaciones: row.observaciones,
        })
      }

      await generarVidrioPlasticoConsolidadoPDF(
        Array.from(grouped.values()), ranchoNombre, consDesde, consHasta
      )
      setSheetConsolidadoAbierto(false)
    } catch (err: unknown) {
      toast.error(err instanceof Error ? err.message : 'No se pudo generar el PDF consolidado')
    } finally {
      setGenerandoConsolidado(false)
    }
  }

  // ── Render ───────────────────────────────────────────────────────────────────

  return (
    <div className="min-h-full pb-safe-nav">

      {/* Header */}
      <header className="bg-card border-b border-border px-4 py-4 sticky top-0 z-20">
        <div className="flex items-center gap-3">
          <button onClick={() => navigate('/')} className="p-1 text-muted-foreground flex-shrink-0">
            <ChevronLeft className="w-5 h-5" />
          </button>
          <div className="flex-1 min-w-0">
            <h1 className="text-foreground truncate" style={{ fontWeight: 600 }}>{TITULO_MODULO}</h1>
            <p className="text-xs text-muted-foreground">{CLAVE_MODULO}</p>
          </div>
          <div className="w-9 h-9 bg-primary/10 rounded-lg flex items-center justify-center flex-shrink-0">
            <Eye className="w-5 h-5 text-primary" />
          </div>
        </div>
      </header>

      {/* Botones de acción */}
      <div className="px-4 pt-3 grid grid-cols-2 gap-2">
        <button
          onClick={() => abrirSheetConfig()}
          className="h-10 flex items-center justify-center gap-1.5 rounded-xl border border-border text-foreground text-sm hover:bg-muted transition-colors"
          style={{ fontWeight: 600 }}
        >
          <Settings className="w-4 h-4 text-muted-foreground" />
          Configurar
        </button>
        <button
          onClick={() => {
            setConsRanchoId('')
            setConsDesde('')
            setConsHasta(hoy())
            setErrConsRancho(false)
            setErrConsFechas(false)
            setSheetConsolidadoAbierto(true)
          }}
          className="h-10 flex items-center justify-center gap-1.5 rounded-xl border border-primary text-primary text-sm hover:bg-primary/5 transition-colors"
          style={{ fontWeight: 600 }}
        >
          <Files className="w-4 h-4" />
          Consolidado
        </button>
      </div>

      {/* Historial */}
      <div className="p-4 space-y-3">
        {loading ? (
          <div className="flex justify-center py-12">
            <Loader2 className="w-8 h-8 text-primary animate-spin" />
          </div>
        ) : inspecciones.length === 0 ? (
          <div className="bg-card border border-border rounded-xl p-6 text-center">
            <Eye className="w-10 h-10 text-muted-foreground mx-auto mb-2" />
            <p className="text-sm text-muted-foreground">Sin inspecciones aún</p>
            <p className="text-xs text-muted-foreground mt-1">Toca + para registrar la primera</p>
          </div>
        ) : (
          inspecciones.map((insp) => {
            const key = `${insp.rancho_id}|${insp.fecha}`
            const estadoResumen = resumirEstados(insp.materiales)
            return (
              <div key={key} className="bg-card border border-border rounded-xl p-4">
                <div className="flex items-start justify-between gap-3">
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 mb-1 flex-wrap">
                      {orgNombre && (
                        <span className="text-xs text-muted-foreground font-medium">{orgNombre} ·</span>
                      )}
                      <span className="text-sm text-foreground truncate" style={{ fontWeight: 600 }}>
                        {insp.rancho_nombre}
                      </span>
                      <span
                        className="text-[11px] px-2 py-0.5 rounded bg-muted text-muted-foreground flex-shrink-0"
                        style={{ fontWeight: 600 }}
                      >
                        {insp.materiales.length} materiales
                      </span>
                    </div>
                    <p className="text-xs text-muted-foreground">{formatFecha(insp.fecha)}</p>
                  </div>
                  <button
                    onClick={() => handleDescargarPDF(insp)}
                    disabled={generandoPDF === key}
                    className="p-2 text-muted-foreground hover:text-primary transition-colors flex-shrink-0 disabled:opacity-50"
                    title="Descargar PDF"
                  >
                    {generandoPDF === key ? (
                      <Loader2 className="w-4 h-4 animate-spin" />
                    ) : (
                      <FileDown className="w-4 h-4" />
                    )}
                  </button>
                </div>
                <div className="flex flex-wrap gap-1 mt-2">
                  {(Object.entries(estadoResumen) as [Estado, number][]).map(([estado, count]) => (
                    <span
                      key={estado}
                      className="text-[10px] px-2 py-0.5 rounded"
                      style={{
                        backgroundColor: ESTADO_CHIP[estado].bg,
                        color: ESTADO_CHIP[estado].text,
                        fontWeight: 600,
                      }}
                    >
                      {estado}: {count}
                    </span>
                  ))}
                </div>
              </div>
            )
          })
        )}
      </div>

      {/* FAB */}
      <div className="fixed bottom-safe-fab left-1/2 -translate-x-1/2 w-full max-w-[390px] flex justify-end px-4 pointer-events-none z-10">
        <button
          onClick={abrirSheetInspeccion}
          className="w-14 h-14 rounded-full bg-primary text-white flex items-center justify-center shadow-lg pointer-events-auto hover:bg-agro-blue transition-colors"
          aria-label="Nueva inspección"
        >
          <Plus className="w-6 h-6" />
        </button>
      </div>

      {/* ── Sheet: configurar materiales ───────────────────────────────────── */}
      <BottomSheet open={sheetConfigAbierto} onClose={() => setSheetConfigAbierto(false)} height="85%">
            <div className="flex justify-center pt-3 pb-1 flex-shrink-0">
              <div className="w-10 h-1 rounded-full bg-border" />
            </div>
            <div className="flex items-center justify-between px-4 py-3 border-b border-border flex-shrink-0">
              <h2 className="text-base text-foreground" style={{ fontWeight: 600 }}>Configurar materiales</h2>
              <button onClick={() => setSheetConfigAbierto(false)} className="p-1">
                <X className="w-5 h-5 text-muted-foreground" />
              </button>
            </div>

            <div className="flex-1 overflow-y-auto p-4 space-y-4">
              {/* Rancho */}
              <div>
                <label className="block text-xs text-muted-foreground mb-1.5" style={{ fontWeight: 600 }}>
                  {terminosSitio.singular.toUpperCase()}
                </label>
                <select
                  value={configRanchoId}
                  onChange={(e) => setConfigRanchoId(e.target.value)}
                  className={`w-full h-11 px-3 rounded-lg bg-input-background border border-border text-sm focus:outline-none focus:border-primary focus:ring-1 focus:ring-primary ${
                    !configRanchoId ? 'text-muted-foreground' : 'text-foreground'
                  }`}
                >
                  <option value="" disabled>Seleccionar {terminosSitio.singular.toLowerCase()}</option>
                  {ranchoOptions.map((o) => (
                    <option key={o.value} value={o.value}>{o.label}</option>
                  ))}
                </select>
              </div>

              {configRanchoId && (
                <>
                  {/* Lista de materiales configurados */}
                  {cargandoConfig ? (
                    <div className="flex justify-center py-6">
                      <Loader2 className="w-6 h-6 text-primary animate-spin" />
                    </div>
                  ) : configMateriales.length === 0 ? (
                    <div className="bg-muted rounded-xl p-4 text-center">
                      <p className="text-sm text-muted-foreground">Sin materiales configurados aún</p>
                      <p className="text-xs text-muted-foreground mt-1">
                        Agrega materiales con el formulario de abajo
                      </p>
                      {SET_MATERIALES_DEFAULT.length > 0 && (
                        <button
                          type="button"
                          onClick={handleCargarSetEstandar}
                          disabled={guardandoNuevo}
                          className="mt-3 h-9 px-4 rounded-xl text-sm border border-primary text-primary hover:bg-primary/5 transition-colors disabled:opacity-50 flex items-center gap-2 mx-auto"
                          style={{ fontWeight: 600 }}
                        >
                          {guardandoNuevo && <Loader2 className="w-3.5 h-3.5 animate-spin" />}
                          Cargar set estándar
                        </button>
                      )}
                    </div>
                  ) : (
                    <div>
                      <p className="text-xs text-muted-foreground mb-2" style={{ fontWeight: 600 }}>
                        MATERIALES ({configMateriales.length})
                      </p>
                      {[...new Set(configMateriales.map((m) => m.area))].map((area) => (
                        <div key={area} className="mb-3">
                          <p
                            className="text-muted-foreground px-1 pb-1"
                            style={{ fontWeight: 600, fontSize: 10, textTransform: 'uppercase' }}
                          >
                            {area}
                          </p>
                          <div className="space-y-1">
                            {configMateriales.filter((m) => m.area === area).map((m) => (
                              <div
                                key={m.id}
                                className="flex items-center justify-between bg-muted rounded-lg px-3 py-2"
                              >
                                <span className="text-sm text-foreground">{m.material}</span>
                                <button
                                  type="button"
                                  onClick={() => handleEliminarMaterial(m.id)}
                                  className="p-1 text-muted-foreground hover:text-agro-red transition-colors"
                                  aria-label="Eliminar"
                                >
                                  <Trash2 className="w-3.5 h-3.5" />
                                </button>
                              </div>
                            ))}
                          </div>
                        </div>
                      ))}
                    </div>
                  )}

                  {/* Agregar nuevo material */}
                  <div className="border-t border-border pt-4">
                    <p className="text-xs text-muted-foreground mb-2" style={{ fontWeight: 600 }}>
                      AGREGAR NUEVO MATERIAL
                    </p>
                    <div className="space-y-2">
                      <div>
                        <SuggestionInput
                          value={nuevaArea}
                          onChange={(v) => { setNuevaArea(v); setErrNuevaArea(false) }}
                          suggestions={areasSugerencias}
                          placeholder="Área (ej: Camionetas)"
                          error={errNuevaArea}
                        />
                        {errNuevaArea && (
                          <p className="text-xs mt-1" style={{ color: 'var(--agro-red)' }}>
                            Indica el área
                          </p>
                        )}
                      </div>
                      <div>
                        <SuggestionInput
                          value={nuevaMaterial}
                          onChange={(v) => { setNuevaMaterial(v); setErrNuevaMaterial(false) }}
                          suggestions={materialesSugerencias}
                          placeholder="Material / Equipo (ej: Faros)"
                          error={errNuevaMaterial}
                        />
                        {errNuevaMaterial && (
                          <p className="text-xs mt-1" style={{ color: 'var(--agro-red)' }}>
                            Indica el material
                          </p>
                        )}
                      </div>
                      <button
                        type="button"
                        onClick={handleAgregarMaterial}
                        disabled={guardandoNuevo}
                        className="w-full h-10 bg-primary text-white rounded-xl flex items-center justify-center gap-2 disabled:opacity-50 hover:bg-agro-blue transition-colors text-sm"
                        style={{ fontWeight: 600 }}
                      >
                        {guardandoNuevo ? (
                          <Loader2 className="w-4 h-4 animate-spin" />
                        ) : (
                          <Plus className="w-4 h-4" />
                        )}
                        Agregar
                      </button>
                    </div>
                  </div>
                </>
              )}
            </div>
      </BottomSheet>

      {/* ── Sheet: exportar consolidado ────────────────────────────────────── */}
      <BottomSheet open={sheetConsolidadoAbierto} onClose={() => setSheetConsolidadoAbierto(false)}>
            <div className="flex justify-center pt-3 pb-1 flex-shrink-0">
              <div className="w-10 h-1 rounded-full bg-border" />
            </div>
            <div className="flex items-center justify-between px-4 py-3 border-b border-border flex-shrink-0">
              <h2 className="text-base text-foreground" style={{ fontWeight: 600 }}>Exportar consolidado</h2>
              <button onClick={() => setSheetConsolidadoAbierto(false)} className="p-1">
                <X className="w-5 h-5 text-muted-foreground" />
              </button>
            </div>

            <div className="overflow-y-auto p-4 space-y-4">
              <div>
                <label className="block text-xs text-muted-foreground mb-1.5" style={{ fontWeight: 600 }}>
                  {terminosSitio.singular.toUpperCase()} *
                </label>
                <select
                  value={consRanchoId}
                  onChange={(e) => { setConsRanchoId(e.target.value); setErrConsRancho(false) }}
                  className={`w-full h-11 px-3 rounded-lg bg-input-background border text-sm focus:outline-none focus:border-primary focus:ring-1 focus:ring-primary ${
                    errConsRancho ? 'border-agro-red' : 'border-border'
                  } ${!consRanchoId ? 'text-muted-foreground' : 'text-foreground'}`}
                >
                  <option value="" disabled>Seleccionar {terminosSitio.singular.toLowerCase()}</option>
                  {ranchoOptions.map((o) => (
                    <option key={o.value} value={o.value}>{o.label}</option>
                  ))}
                </select>
                {errConsRancho && <p className="text-xs text-agro-red mt-1">Selecciona {terminosSitio.genero === 'f' ? 'una' : 'un'} {terminosSitio.singular.toLowerCase()}</p>}
              </div>

              <div>
                <label className="block text-xs text-muted-foreground mb-1.5" style={{ fontWeight: 600 }}>
                  DESDE *
                </label>
                <input
                  type="date"
                  value={consDesde}
                  onChange={(e) => { setConsDesde(e.target.value); setErrConsFechas(false) }}
                  className={`w-full h-11 px-3 rounded-lg bg-input-background border text-sm text-foreground focus:outline-none focus:border-primary focus:ring-1 focus:ring-primary ${
                    errConsFechas && !consDesde ? 'border-agro-red' : 'border-border'
                  }`}
                />
              </div>

              <div>
                <label className="block text-xs text-muted-foreground mb-1.5" style={{ fontWeight: 600 }}>
                  HASTA *
                </label>
                <input
                  type="date"
                  value={consHasta}
                  onChange={(e) => { setConsHasta(e.target.value); setErrConsFechas(false) }}
                  className={`w-full h-11 px-3 rounded-lg bg-input-background border text-sm text-foreground focus:outline-none focus:border-primary focus:ring-1 focus:ring-primary ${
                    errConsFechas && !consHasta ? 'border-agro-red' : 'border-border'
                  }`}
                />
                {errConsFechas && <p className="text-xs text-agro-red mt-1">Indica el rango de fechas</p>}
              </div>
            </div>

            <div className="p-4 border-t border-border flex-shrink-0">
              <button
                onClick={handleGenerarConsolidado}
                disabled={generandoConsolidado}
                className="w-full h-14 bg-primary text-white rounded-3xl flex items-center justify-center gap-2 disabled:opacity-50 hover:bg-agro-blue transition-colors"
                style={{ fontWeight: 600 }}
              >
                {generandoConsolidado && <Loader2 className="w-4 h-4 animate-spin" />}
                Generar PDF consolidado
              </button>
            </div>
      </BottomSheet>

      {/* ── Sheet: nueva inspección ────────────────────────────────────────── */}
      <BottomSheet open={sheetInspeccionAbierto} onClose={() => setSheetInspeccionAbierto(false)} height="85%">
            <div className="flex justify-center pt-3 pb-1 flex-shrink-0">
              <div className="w-10 h-1 rounded-full bg-border" />
            </div>
            <div className="flex items-center justify-between px-4 py-3 border-b border-border flex-shrink-0">
              <h2 className="text-base text-foreground" style={{ fontWeight: 600 }}>Nueva inspección</h2>
              <button onClick={() => setSheetInspeccionAbierto(false)} className="p-1">
                <X className="w-5 h-5 text-muted-foreground" />
              </button>
            </div>

            <div className="flex-1 overflow-y-auto p-4 space-y-4">

              {/* Rancho */}
              <div>
                <label className="block text-xs text-muted-foreground mb-1.5" style={{ fontWeight: 600 }}>
                  {terminosSitio.singular.toUpperCase()} *
                </label>
                <select
                  value={ranchoId}
                  onChange={(e) => { setRanchoId(e.target.value); setErrRancho(false) }}
                  className={`w-full h-11 px-3 rounded-lg bg-input-background border text-sm focus:outline-none focus:border-primary focus:ring-1 focus:ring-primary ${
                    errRancho ? 'border-agro-red' : 'border-border'
                  } ${!ranchoId ? 'text-muted-foreground' : 'text-foreground'}`}
                >
                  <option value="" disabled>Seleccionar {terminosSitio.singular.toLowerCase()}</option>
                  {ranchoOptions.map((o) => (
                    <option key={o.value} value={o.value}>{o.label}</option>
                  ))}
                </select>
                {errRancho && <p className="text-xs text-agro-red mt-1">Selecciona {terminosSitio.genero === 'f' ? 'una' : 'un'} {terminosSitio.singular.toLowerCase()}</p>}
              </div>

              {/* Fecha */}
              <div>
                <label className="block text-xs text-muted-foreground mb-1.5" style={{ fontWeight: 600 }}>
                  FECHA DE INSPECCIÓN *
                </label>
                <input
                  type="date"
                  value={fecha}
                  min={esSuperAdmin ? undefined : hoy()}
                  max={esSuperAdmin ? undefined : hoy()}
                  onChange={(e) => { if (esSuperAdmin) setFecha(e.target.value) }}
                  className="w-full h-11 px-3 rounded-lg bg-input-background border border-border text-sm text-foreground focus:outline-none focus:border-primary focus:ring-1 focus:ring-primary"
                />
              </div>

              {/* Aviso límite quincenal */}
              {limiteInfo && (
                <div
                  className="flex items-start gap-2 rounded-xl p-3"
                  style={{ backgroundColor: 'var(--agro-warning-fill)', border: '1px solid #F5A623' }}
                >
                  <AlertTriangle className="w-4 h-4 flex-shrink-0 mt-0.5" style={{ color: 'var(--agro-warning-text)' }} />
                  <p className="text-xs" style={{ color: 'var(--agro-warning-text)' }}>
                    Ya existe una inspección para {terminosSitio.genero === 'f' ? 'esta' : 'este'} {terminosSitio.singular.toLowerCase()} en los últimos 14 días.{' '}
                    Próxima disponible:{' '}
                    <span style={{ fontWeight: 600 }}>{limiteInfo.proxima}</span>
                  </p>
                </div>
              )}

              {/* Materiales del catálogo */}
              {ranchoId && (
                <>
                  {cargandoMateriales ? (
                    <div className="flex justify-center py-6">
                      <Loader2 className="w-6 h-6 text-primary animate-spin" />
                    </div>
                  ) : filasInspeccion.length === 0 ? (
                    <div
                      className="rounded-xl p-4 text-center"
                      style={{ backgroundColor: 'var(--agro-warning-fill)', border: '1px solid #F5A623' }}
                    >
                      <AlertTriangle className="w-8 h-8 mx-auto mb-2" style={{ color: 'var(--agro-warning-text)' }} />
                      <p className="text-sm" style={{ color: 'var(--agro-warning-text)', fontWeight: 600 }}>
                        Sin materiales configurados
                      </p>
                      <p className="text-xs mt-1" style={{ color: 'var(--agro-warning-text)' }}>
                        Configura el catálogo de materiales de {terminosSitio.genero === 'f' ? 'esta' : 'este'} {terminosSitio.singular.toLowerCase()} antes de inspeccionar.
                      </p>
                      <button
                        type="button"
                        onClick={() => {
                          setSheetInspeccionAbierto(false)
                          setTimeout(() => abrirSheetConfig(ranchoId), 200)
                        }}
                        className="mt-3 h-9 px-4 rounded-xl text-sm text-white hover:bg-agro-blue transition-colors"
                        style={{ backgroundColor: 'var(--primary)', fontWeight: 600 }}
                      >
                        Configurar materiales
                      </button>
                    </div>
                  ) : (
                    <div className="space-y-4">
                      <p className="text-xs text-muted-foreground" style={{ fontWeight: 600 }}>
                        MATERIALES A INSPECCIONAR ({filasInspeccion.length})
                      </p>
                      {Object.entries(materialesGrouped).map(([area, filas]) => (
                        <div key={area}>
                          <p
                            className="text-muted-foreground mb-1.5 px-1"
                            style={{ fontWeight: 600, fontSize: 10, textTransform: 'uppercase' }}
                          >
                            {area}
                          </p>
                          <div className="space-y-2">
                            {filas.map(({ fila, idx }) => (
                              <MaterialRowInspeccion
                                key={fila.catalogoId}
                                fila={fila}
                                onChange={(f) => updateFilaInspeccion(idx, f)}
                              />
                            ))}
                          </div>
                        </div>
                      ))}
                    </div>
                  )}
                </>
              )}

              {/* Registrado por */}
              <div>
                <label className="block text-xs text-muted-foreground mb-1.5" style={{ fontWeight: 600 }}>
                  REGISTRADO POR
                </label>
                <div className="h-11 px-3 rounded-lg bg-muted border border-border flex items-center">
                  <span className="text-sm text-muted-foreground">{profile?.nombre_completo ?? '—'}</span>
                </div>
              </div>

            </div>

            {/* Guardar */}
            <div className="p-4 border-t border-border flex-shrink-0">
              <button
                onClick={handleGuardar}
                disabled={guardando || !!limiteInfo || filasInspeccion.length === 0 || cargandoMateriales}
                className="w-full h-14 bg-primary text-white rounded-3xl flex items-center justify-center gap-2 disabled:opacity-50 hover:bg-agro-blue transition-colors"
                style={{ fontWeight: 600 }}
              >
                {guardando && <Loader2 className="w-4 h-4 animate-spin" />}
                Guardar y generar PDF
              </button>
            </div>
      </BottomSheet>
    </div>
  )
}
