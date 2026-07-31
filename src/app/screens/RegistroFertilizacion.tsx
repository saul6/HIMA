// MÓDULO M8 — Registro de Fertilización
// Clave: MXA-F-SC-SIG-030.14 · Frecuencia: Por evento
// Patrón: dos tabs (Registros | Inventario), FAB contextual, bottom sheets.

import { useState, useEffect, useRef } from 'react'
import {
  ChevronLeft, Plus, FileDown, X, Loader2, Sprout,
  Files, AlertTriangle, Trash2, TrendingDown, Package,
} from 'lucide-react'
import { useNavigate } from 'react-router'
import { toast } from 'sonner'
import { useAuthContext } from '@/context/AuthContext'
import { useRanchos } from '@/hooks/useRanchos'
import { useM8Fertilizacion, type M8Registro } from '@/hooks/useM8Fertilizacion'
import { useFertilizantesOrg, type FertilizanteOrgItem } from '@/hooks/useFertilizantesOrg'
import { useInventarioFertilizantes } from '@/hooks/useInventarioFertilizantes'
import { supabase } from '@/lib/supabase'
import { generarFertilizacionPDF } from '@/lib/pdf/m8/generarFertilizacionPDF'
import { generarFertilizacionConsolidadoPDF } from '@/lib/pdf/m8/generarFertilizacionConsolidadoPDF'
import type { FertilizacionPDFProps } from '@/lib/pdf/m8/FertilizacionPDF'
import { useModulosContext } from '@/context/ModulosContext'

// ── Constantes ────────────────────────────────────────────────────────────────

const TITULO_MODULO = 'Registro de Fertilización'
const CLAVE_MODULO  = 'MXA-F-SC-SIG-030.14 · Por evento'

const METODOS = ['Fertirriego', 'Drench', 'Band'] as const
type Metodo = (typeof METODOS)[number]
type TipoMovimiento = 'entrada' | 'salida' | 'ajuste'

const hoy = () => new Date().toISOString().split('T')[0]

// ── Tipos ─────────────────────────────────────────────────────────────────────

type FilaFertilizante = {
  nombre_comercial: string
  ingrediente_activo: string
  concentracion: string
  unidad: 'kg' | 'L'
  metodo: Metodo
  superficie: string
  dosis: string
  cantidad: string
}

type ErrFila = { nombre: boolean; superficie: boolean; dosis: boolean }

const filaVacia = (): FilaFertilizante => ({
  nombre_comercial: '',
  ingrediente_activo: '',
  concentracion: '',
  unidad: 'kg',
  metodo: 'Fertirriego',
  superficie: '',
  dosis: '',
  cantidad: '',
})

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

function calcCantidad(superficie: string, dosis: string): string {
  const s = parseFloat(superficie)
  const d = parseFloat(dosis)
  if (!isNaN(s) && !isNaN(d) && s > 0 && d > 0) {
    return (s * d).toFixed(2)
  }
  return ''
}

// ── FertilizanteCombobox ──────────────────────────────────────────────────────
// Dropdown custom que muestra el catálogo filtrado y permite escribir nombres nuevos.

function FertilizanteCombobox({
  value,
  onChange,
  onSelect,
  catalogo,
  error,
}: {
  value: string
  onChange: (v: string) => void
  onSelect: (item: FertilizanteOrgItem) => void
  catalogo: FertilizanteOrgItem[]
  error?: boolean
}) {
  const [open, setOpen] = useState(false)
  const filtered = catalogo.filter((f) =>
    f.nombre_comercial.toLowerCase().includes(value.toLowerCase())
  )

  return (
    <div className="relative">
      <input
        type="text"
        value={value}
        onChange={(e) => { onChange(e.target.value); setOpen(true) }}
        onFocus={() => setOpen(true)}
        onBlur={() => setTimeout(() => setOpen(false), 150)}
        placeholder="Nombre comercial"
        className="w-full h-10 px-3 rounded-lg bg-card border text-sm text-foreground placeholder:text-muted-foreground focus:outline-none focus:border-primary focus:ring-1 focus:ring-primary"
        style={error ? { borderColor: 'var(--agro-red)' } : { borderColor: 'var(--border)' }}
      />
      {open && filtered.length > 0 && (
        <div className="absolute z-50 left-0 right-0 top-full mt-1 bg-card border border-border rounded-xl overflow-hidden shadow-lg max-h-40 overflow-y-auto">
          {filtered.slice(0, 8).map((f) => (
            <button
              key={f.id}
              type="button"
              onMouseDown={() => { onSelect(f); setOpen(false) }}
              className="w-full text-left px-3 py-2.5 hover:bg-muted transition-colors border-b border-border last:border-0"
            >
              <p className="text-sm text-foreground" style={{ fontWeight: 600 }}>
                {f.nombre_comercial}
              </p>
              {f.ingrediente_activo && (
                <p className="text-xs text-muted-foreground truncate">{f.ingrediente_activo}</p>
              )}
            </button>
          ))}
        </div>
      )}
    </div>
  )
}

// ── FilaFertilizanteForm ──────────────────────────────────────────────────────

function FilaFertilizanteForm({
  fila,
  errores,
  catalogo,
  puedeEliminar,
  onChange,
  onRemove,
}: {
  fila: FilaFertilizante
  errores: ErrFila
  catalogo: FertilizanteOrgItem[]
  puedeEliminar: boolean
  onChange: (f: FilaFertilizante) => void
  onRemove: () => void
}) {
  function handleSelect(item: FertilizanteOrgItem) {
    onChange({
      ...fila,
      nombre_comercial: item.nombre_comercial,
      ingrediente_activo: item.ingrediente_activo ?? '',
      concentracion: item.concentracion ?? '',
      unidad: item.unidad ?? 'kg',
    })
  }

  function handleSuperficieChange(v: string) {
    const nueva = { ...fila, superficie: v }
    nueva.cantidad = calcCantidad(v, fila.dosis)
    onChange(nueva)
  }

  function handleDosisChange(v: string) {
    const nueva = { ...fila, dosis: v }
    nueva.cantidad = calcCantidad(fila.superficie, v)
    onChange(nueva)
  }

  const cantidadCalc = calcCantidad(fila.superficie, fila.dosis)
  const cantidadMostrada = fila.cantidad || cantidadCalc

  return (
    <div className="border border-border rounded-xl p-3 space-y-3 bg-card">
      {/* Encabezado fila */}
      <div className="flex items-center justify-between">
        <span className="text-xs text-muted-foreground" style={{ fontWeight: 600 }}>
          Fertilizante
        </span>
        {puedeEliminar && (
          <button
            type="button"
            onClick={onRemove}
            className="p-1 transition-colors"
            style={{ color: 'var(--agro-red)' }}
          >
            <Trash2 className="w-4 h-4" />
          </button>
        )}
      </div>

      {/* Nombre comercial */}
      <FertilizanteCombobox
        value={fila.nombre_comercial}
        onChange={(v) => onChange({ ...fila, nombre_comercial: v })}
        onSelect={handleSelect}
        catalogo={catalogo}
        error={errores.nombre}
      />
      {errores.nombre && (
        <p className="text-xs" style={{ color: 'var(--agro-red)', marginTop: -8 }}>Nombre requerido</p>
      )}

      {/* Ingrediente activo + Concentración */}
      <div className="grid grid-cols-2 gap-2">
        <input
          type="text"
          value={fila.ingrediente_activo}
          onChange={(e) => onChange({ ...fila, ingrediente_activo: e.target.value })}
          placeholder="Ingrediente activo"
          className="h-9 px-3 rounded-lg bg-input-background border border-border text-sm text-foreground placeholder:text-muted-foreground focus:outline-none focus:border-primary"
        />
        <input
          type="text"
          value={fila.concentracion}
          onChange={(e) => onChange({ ...fila, concentracion: e.target.value })}
          placeholder="Concentración"
          className="h-9 px-3 rounded-lg bg-input-background border border-border text-sm text-foreground placeholder:text-muted-foreground focus:outline-none focus:border-primary"
        />
      </div>

      {/* Unidad */}
      <div className="flex items-center gap-3">
        <span className="text-xs text-muted-foreground flex-shrink-0" style={{ minWidth: 56 }}>Unidad</span>
        <div className="flex gap-1.5">
          {(['kg', 'L'] as const).map((u) => (
            <button
              key={u}
              type="button"
              onClick={() => onChange({ ...fila, unidad: u })}
              className="h-7 px-3 rounded-lg text-xs transition-colors"
              style={
                fila.unidad === u
                  ? { backgroundColor: 'var(--primary)', color: '#fff', fontWeight: 600 }
                  : { backgroundColor: 'var(--input-background)', color: 'var(--muted-foreground)', border: '1px solid var(--border)' }
              }
            >
              {u}
            </button>
          ))}
        </div>
      </div>

      {/* Método */}
      <div className="flex items-center gap-3">
        <span className="text-xs text-muted-foreground flex-shrink-0" style={{ minWidth: 56 }}>Método</span>
        <div className="flex gap-1.5 flex-wrap">
          {METODOS.map((m) => (
            <button
              key={m}
              type="button"
              onClick={() => onChange({ ...fila, metodo: m })}
              className="h-7 px-2.5 rounded-lg text-xs transition-colors"
              style={
                fila.metodo === m
                  ? { backgroundColor: 'var(--primary)', color: '#fff', fontWeight: 600 }
                  : { backgroundColor: 'var(--input-background)', color: 'var(--muted-foreground)', border: '1px solid var(--border)' }
              }
            >
              {m}
            </button>
          ))}
        </div>
      </div>

      {/* Superficie + Dosis */}
      <div className="grid grid-cols-2 gap-2">
        <div>
          <label className="text-xs text-muted-foreground mb-1 block">Superficie (ha)</label>
          <input
            type="number"
            min="0"
            step="0.01"
            value={fila.superficie}
            onChange={(e) => handleSuperficieChange(e.target.value)}
            placeholder="0.00"
            className="w-full h-9 px-3 rounded-lg bg-input-background border text-sm text-foreground placeholder:text-muted-foreground focus:outline-none focus:border-primary"
            style={errores.superficie ? { borderColor: 'var(--agro-red)' } : { borderColor: 'var(--border)' }}
          />
          {errores.superficie && (
            <p className="text-xs mt-0.5" style={{ color: 'var(--agro-red)' }}>Requerido</p>
          )}
        </div>
        <div>
          <label className="text-xs text-muted-foreground mb-1 block">Dosis ({fila.unidad}/ha)</label>
          <input
            type="number"
            min="0"
            step="0.001"
            value={fila.dosis}
            onChange={(e) => handleDosisChange(e.target.value)}
            placeholder="0.000"
            className="w-full h-9 px-3 rounded-lg bg-input-background border text-sm text-foreground placeholder:text-muted-foreground focus:outline-none focus:border-primary"
            style={errores.dosis ? { borderColor: 'var(--agro-red)' } : { borderColor: 'var(--border)' }}
          />
          {errores.dosis && (
            <p className="text-xs mt-0.5" style={{ color: 'var(--agro-red)' }}>Requerido</p>
          )}
        </div>
      </div>

      {/* Cantidad total (auto-calculada, editable) */}
      <div
        className="rounded-lg px-3 py-2.5 flex items-center justify-between"
        style={{ backgroundColor: 'var(--agro-success-fill)' }}
      >
        <span className="text-xs" style={{ color: 'var(--agro-success-text)', fontWeight: 600 }}>
          Cantidad total ({fila.unidad})
        </span>
        <input
          type="number"
          min="0"
          step="0.01"
          value={cantidadMostrada}
          onChange={(e) => onChange({ ...fila, cantidad: e.target.value })}
          placeholder={cantidadCalc || '0.00'}
          className="w-24 text-right bg-transparent border-b border-current text-sm focus:outline-none"
          style={{ color: 'var(--agro-success-text)', fontWeight: 600 }}
        />
      </div>
    </div>
  )
}

// ── Pantalla principal ────────────────────────────────────────────────────────

export function RegistroFertilizacion() {
  const navigate = useNavigate()
  const { profile } = useAuthContext()
  const esSuperAdmin = profile?.rol === 'super_admin'
  const { ranchos } = useRanchos()
  const { registros, loading, refetch: refetchRegistros } = useM8Fertilizacion()
  const { fertilizantes: catalogo, refetch: refetchCatalogo } = useFertilizantesOrg()
  const { saldos, refetch: refetchSaldos } = useInventarioFertilizantes()
  const { terminosSitio } = useModulosContext()

  // ── Tab ─────────────────────────────────────────────────────────────────
  const [tab, setTab] = useState<'registros' | 'inventario'>('registros')

  // ── Estado nuevo registro ────────────────────────────────────────────────
  const [sheetNuevoAbierto, setSheetNuevoAbierto] = useState(false)
  const [ranchoId, setRanchoId] = useState('')
  const [fecha, setFecha] = useState(hoy())
  const [sector, setSector] = useState('')
  const [filas, setFilas] = useState<FilaFertilizante[]>([filaVacia()])
  const [errFilas, setErrFilas] = useState<ErrFila[]>([{ nombre: false, superficie: false, dosis: false }])
  const [errRancho, setErrRancho] = useState(false)
  const [guardando, setGuardando] = useState(false)
  const [generandoPDF, setGenerandoPDF] = useState<string | null>(null)

  // ── Estado consolidado ───────────────────────────────────────────────────
  const [sheetConsolidadoAbierto, setSheetConsolidadoAbierto] = useState(false)
  const [consRanchoId, setConsRanchoId] = useState('')
  const [consDesde, setConsDesde] = useState('')
  const [consHasta, setConsHasta] = useState(hoy())
  const [generandoConsolidado, setGenerandoConsolidado] = useState(false)
  const [errConsRancho, setErrConsRancho] = useState(false)
  const [errConsFechas, setErrConsFechas] = useState(false)

  // ── Estado movimiento manual inventario ─────────────────────────────────
  const [sheetMovAbierto, setSheetMovAbierto] = useState(false)
  const [movRanchoId, setMovRanchoId] = useState('')
  const [movNombreComercial, setMovNombreComercial] = useState('')
  const [movIngActivo, setMovIngActivo] = useState('')
  const [movConcentracion, setMovConcentracion] = useState('')
  const [movUnidad, setMovUnidad] = useState<'kg' | 'L'>('kg')
  const [movTipo, setMovTipo] = useState<TipoMovimiento>('entrada')
  const [movCantidad, setMovCantidad] = useState('')
  const [movFecha, setMovFecha] = useState(hoy())
  const [movReferencia, setMovReferencia] = useState('')
  const [guardandoMov, setGuardandoMov] = useState(false)
  const [errMovRancho, setErrMovRancho] = useState(false)
  const [errMovNombre, setErrMovNombre] = useState(false)
  const [errMovCantidad, setErrMovCantidad] = useState(false)
  const [movSaldoActual, setMovSaldoActual] = useState<number | null>(null)
  const saldoFetchKey = useRef('')

  // ── Fetch saldo actual para movimiento manual (salida) ──────────────────
  useEffect(() => {
    if (!movRanchoId || !movNombreComercial.trim() || !profile?.org_id) {
      setMovSaldoActual(null)
      return
    }
    const key = `${movRanchoId}|${movNombreComercial.trim()}`
    if (saldoFetchKey.current === key) return
    saldoFetchKey.current = key

    supabase
      .from('v_inventario_fertilizantes_saldo')
      .select('saldo')
      .eq('org_id', profile.org_id)
      .eq('rancho_id', movRanchoId)
      .ilike('nombre_comercial', movNombreComercial.trim())
      .limit(1)
      .then(({ data }) => {
        setMovSaldoActual(data?.[0]?.saldo ?? null)
      })
  }, [movRanchoId, movNombreComercial, profile?.org_id])

  // ── Handlers nuevo registro ──────────────────────────────────────────────

  function abrirSheetNuevo() {
    setRanchoId('')
    setFecha(hoy())
    setSector('')
    setFilas([filaVacia()])
    setErrFilas([{ nombre: false, superficie: false, dosis: false }])
    setErrRancho(false)
    setSheetNuevoAbierto(true)
  }

  function updateFila(idx: number, f: FilaFertilizante) {
    setFilas((prev) => prev.map((x, i) => (i === idx ? f : x)))
    setErrFilas((prev) =>
      prev.map((e, i) => (i === idx ? { nombre: false, superficie: false, dosis: false } : e))
    )
  }

  function agregarFila() {
    setFilas((prev) => [...prev, filaVacia()])
    setErrFilas((prev) => [...prev, { nombre: false, superficie: false, dosis: false }])
  }

  function eliminarFila(idx: number) {
    if (filas.length <= 1) return
    setFilas((prev) => prev.filter((_, i) => i !== idx))
    setErrFilas((prev) => prev.filter((_, i) => i !== idx))
  }

  async function handleGuardar() {
    let valido = true

    if (!ranchoId) { setErrRancho(true); valido = false }
    if (!profile?.org_id) { toast.error('Sin organización activa'); return }

    const nuevosErrFilas: ErrFila[] = filas.map((f) => ({
      nombre: !f.nombre_comercial.trim(),
      superficie: !f.superficie || parseFloat(f.superficie) <= 0,
      dosis: !f.dosis || parseFloat(f.dosis) <= 0,
    }))
    const hayErrFila = nuevosErrFilas.some((e) => e.nombre || e.superficie || e.dosis)
    if (hayErrFila) { setErrFilas(nuevosErrFilas); valido = false }
    if (!valido) return

    setGuardando(true)
    try {
      // 1. Upsert fertilizantes únicos en el catálogo (ignorar duplicados)
      const uniqueNames = [...new Set(filas.map((f) => f.nombre_comercial.trim()))]
      const upsertRows = uniqueNames.map((nombre) => {
        const fila = filas.find((f) => f.nombre_comercial.trim() === nombre)!
        return {
          org_id: profile.org_id,
          nombre_comercial: nombre,
          ingrediente_activo: fila.ingrediente_activo.trim() || null,
          concentracion: fila.concentracion.trim() || null,
          unidad: fila.unidad,
          activo: true,
        }
      })

      if (upsertRows.length > 0) {
        await supabase
          .from('fertilizantes_org')
          .upsert(upsertRows, { onConflict: 'org_id,nombre_comercial', ignoreDuplicates: true })
      }

      // 2. Obtener IDs de fertilizantes por nombre
      const { data: fertData } = await supabase
        .from('fertilizantes_org')
        .select('id, nombre_comercial')
        .eq('org_id', profile.org_id)
        .in('nombre_comercial', uniqueNames)

      const fertMap = new Map<string, string>()
      for (const f of fertData ?? []) {
        fertMap.set(f.nombre_comercial, f.id)
      }

      // 3. Insertar filas en m8_fertilizacion
      const m8Rows = filas.map((f) => ({
        rancho_id: ranchoId,
        org_id: profile.org_id,
        fecha,
        sector: sector.trim() || null,
        nombre_comercial: f.nombre_comercial.trim(),
        ingrediente_activo: f.ingrediente_activo.trim() || null,
        concentracion: f.concentracion.trim() || null,
        metodo: f.metodo as 'Fertirriego' | 'Drench' | 'Band',
        superficie_ha: parseFloat(f.superficie),
        dosis_kg_l_ha: parseFloat(f.dosis),
        cantidad_total: parseFloat(f.cantidad || calcCantidad(f.superficie, f.dosis) || '0'),
        operario_id: profile.id,
        verificacion_semanal: false,
      }))

      const { data: m8Data, error: m8Err } = await supabase
        .from('m8_fertilizacion')
        .insert(m8Rows)
        .select('id, nombre_comercial, cantidad_total')

      if (m8Err) throw m8Err

      // 4. Fire-and-forget: salidas en inventario_fertilizantes
      if (m8Data && m8Data.length > 0) {
        const invRows = (m8Data as any[])
          .map((row) => {
            const fertId = fertMap.get(row.nombre_comercial)
            if (!fertId) return null
            return {
              rancho_id: ranchoId,
              fertilizante_id: fertId,
              org_id: profile.org_id,
              tipo: 'salida' as const,
              cantidad: row.cantidad_total,
              m8_id: row.id,
              fecha,
              registrado_por: profile.id,
            }
          })
          .filter(Boolean)

        if (invRows.length > 0) {
          supabase
            .from('inventario_fertilizantes')
            .insert(invRows)
            .then(({ error }) => {
              if (error) console.warn('[M8] inventario_fertilizantes salida:', error.message)
            })
        }
      }

      toast.success('Registro guardado')
      setSheetNuevoAbierto(false)
      await refetchRegistros()
      await refetchSaldos()
      await refetchCatalogo()

      // 5. Generar PDF automáticamente
      const rancho = ranchos.find((r) => r.id === ranchoId)
      if (rancho && m8Data) {
        const folio = ((m8Data as any[])[0]?.id as string)?.slice(0, 8).toUpperCase() ?? '—'
        const pdfProps: FertilizacionPDFProps = {
          folio,
          rancho: rancho.nombre,
          ranchoCodigo: rancho.codigo,
          fecha,
          sector: sector.trim() || null,
          responsableNombre: profile.nombre_completo,
          fertilizantes: filas.map((f) => ({
            nombre_comercial: f.nombre_comercial.trim(),
            ingrediente_activo: f.ingrediente_activo.trim() || null,
            concentracion: f.concentracion.trim() || null,
            metodo: f.metodo,
            superficie_ha: parseFloat(f.superficie),
            dosis_kg_l_ha: parseFloat(f.dosis),
            cantidad_total: parseFloat(f.cantidad || calcCantidad(f.superficie, f.dosis) || '0'),
          })),
        }
        try {
          await generarFertilizacionPDF(pdfProps, rancho.nombre, fecha)
        } catch {
          toast.warning('Registro guardado — el PDF no se pudo generar. Descárgalo desde el historial.')
        }
      }
    } catch (err: unknown) {
      const mensaje = (err instanceof Error ? err.message : (err as any)?.message) ?? ''
      if (mensaje.includes('FECHA_SOLO_HOY')) {
        toast.warning('Solo puedes registrar con la fecha de hoy')
      } else {
        toast.error(mensaje || 'No se pudo guardar el registro')
      }
    } finally {
      setGuardando(false)
    }
  }

  // ── Handler descarga PDF individual ─────────────────────────────────────

  async function handleDescargarPDF(reg: M8Registro) {
    const key = `${reg.rancho_id}|${reg.fecha}`
    setGenerandoPDF(key)
    try {
      const folio = reg.fertilizantes[0]?.id.slice(0, 8).toUpperCase() ?? '—'
      const pdfProps: FertilizacionPDFProps = {
        folio,
        rancho: reg.rancho_nombre,
        ranchoCodigo: reg.rancho_codigo,
        fecha: reg.fecha,
        sector: reg.sector,
        responsableNombre: profile?.nombre_completo ?? 'Responsable',
        fertilizantes: reg.fertilizantes.map((f) => ({
          nombre_comercial: f.nombre_comercial,
          ingrediente_activo: f.ingrediente_activo,
          concentracion: f.concentracion,
          metodo: f.metodo,
          superficie_ha: f.superficie_ha,
          dosis_kg_l_ha: f.dosis_kg_l_ha,
          cantidad_total: f.cantidad_total,
        })),
      }
      await generarFertilizacionPDF(pdfProps, reg.rancho_nombre, reg.fecha)
    } catch {
      toast.error('No se pudo generar el PDF')
    } finally {
      setGenerandoPDF(null)
    }
  }

  // ── Handler consolidado ──────────────────────────────────────────────────

  async function handleGenerarConsolidado() {
    let valido = true
    if (!consRanchoId) { setErrConsRancho(true); valido = false }
    if (!consDesde || !consHasta) { setErrConsFechas(true); valido = false }
    if (!valido) return
    if (!profile?.org_id) { toast.error('Sin organización activa'); return }

    setGenerandoConsolidado(true)
    try {
      const { data, error } = await supabase
        .from('m8_fertilizacion')
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

      const grouped = new Map<string, FertilizacionPDFProps>()
      for (const row of data as any[]) {
        if (!grouped.has(row.fecha)) {
          grouped.set(row.fecha, {
            folio: (row.id as string).slice(0, 8).toUpperCase(),
            rancho: row.ranchos?.nombre ?? ranchoNombre,
            ranchoCodigo: row.ranchos?.codigo ?? rancho?.codigo ?? '—',
            fecha: row.fecha,
            sector: row.sector,
            responsableNombre: profile.nombre_completo,
            fertilizantes: [],
          })
        }
        grouped.get(row.fecha)!.fertilizantes.push({
          nombre_comercial: row.nombre_comercial,
          ingrediente_activo: row.ingrediente_activo,
          concentracion: row.concentracion,
          metodo: row.metodo,
          superficie_ha: row.superficie_ha,
          dosis_kg_l_ha: row.dosis_kg_l_ha,
          cantidad_total: row.cantidad_total,
        })
      }

      await generarFertilizacionConsolidadoPDF(
        Array.from(grouped.values()), ranchoNombre, consDesde, consHasta
      )
      setSheetConsolidadoAbierto(false)
    } catch (err: unknown) {
      toast.error(err instanceof Error ? err.message : 'No se pudo generar el PDF consolidado')
    } finally {
      setGenerandoConsolidado(false)
    }
  }

  // ── Handler movimiento manual ────────────────────────────────────────────

  function abrirSheetMov() {
    setMovRanchoId('')
    setMovNombreComercial('')
    setMovIngActivo('')
    setMovConcentracion('')
    setMovUnidad('kg')
    setMovTipo('entrada')
    setMovCantidad('')
    setMovFecha(hoy())
    setMovReferencia('')
    setErrMovRancho(false)
    setErrMovNombre(false)
    setErrMovCantidad(false)
    setMovSaldoActual(null)
    saldoFetchKey.current = ''
    setSheetMovAbierto(true)
  }

  function handleSelectFertilizanteMovimiento(item: FertilizanteOrgItem) {
    setMovNombreComercial(item.nombre_comercial)
    setMovIngActivo(item.ingrediente_activo ?? '')
    setMovConcentracion(item.concentracion ?? '')
    setMovUnidad(item.unidad ?? 'kg')
    setErrMovNombre(false)
    setMovSaldoActual(null)
    saldoFetchKey.current = ''
  }

  async function handleGuardarMovimiento() {
    let valido = true
    if (!movRanchoId) { setErrMovRancho(true); valido = false }
    if (!movNombreComercial.trim()) { setErrMovNombre(true); valido = false }
    if (!movCantidad || parseFloat(movCantidad) <= 0) { setErrMovCantidad(true); valido = false }
    if (!valido) return
    if (!profile?.org_id) { toast.error('Sin organización activa'); return }

    setGuardandoMov(true)
    try {
      // 1. Upsert fertilizante en catálogo → obtener id
      const { data: fertUpsert, error: upsertErr } = await supabase
        .from('fertilizantes_org')
        .upsert(
          {
            org_id: profile.org_id,
            nombre_comercial: movNombreComercial.trim(),
            ingrediente_activo: movIngActivo.trim() || null,
            concentracion: movConcentracion.trim() || null,
            unidad: movUnidad,
            activo: true,
          },
          { onConflict: 'org_id,nombre_comercial' }
        )
        .select('id')
        .single()

      let fertId: string
      if (upsertErr || !fertUpsert) {
        // Si el upsert no devuelve fila, buscar manualmente
        const { data: existing } = await supabase
          .from('fertilizantes_org')
          .select('id')
          .eq('org_id', profile.org_id)
          .eq('nombre_comercial', movNombreComercial.trim())
          .single()
        if (!existing) throw new Error('No se pudo resolver el fertilizante en catálogo')
        fertId = existing.id
      } else {
        fertId = fertUpsert.id
      }

      const cantidad = parseFloat(movCantidad)

      // 2. Si es salida, verificar saldo suficiente
      if (movTipo === 'salida') {
        const { data: saldoData } = await supabase
          .from('v_inventario_fertilizantes_saldo')
          .select('saldo')
          .eq('org_id', profile.org_id)
          .eq('rancho_id', movRanchoId)
          .eq('fertilizante_id', fertId)
          .limit(1)

        const saldoActual = saldoData?.[0]?.saldo ?? 0
        if (saldoActual < cantidad) {
          toast.error(
            `Saldo insuficiente. Stock actual: ${saldoActual.toFixed(2)} ${movUnidad}. Salida solicitada: ${cantidad.toFixed(2)} ${movUnidad}.`
          )
          return
        }
      }

      // 3. Insertar movimiento
      const { error: movErr } = await supabase
        .from('inventario_fertilizantes')
        .insert({
          rancho_id: movRanchoId,
          fertilizante_id: fertId,
          org_id: profile.org_id,
          tipo: movTipo,
          cantidad,
          m8_id: null,
          referencia: movReferencia.trim() || null,
          notas: null,
          fecha: movFecha,
          registrado_por: profile.id,
        })

      if (movErr) throw movErr

      toast.success('Movimiento registrado')
      setSheetMovAbierto(false)
      await refetchSaldos()
      await refetchCatalogo()
    } catch (err: unknown) {
      const mensaje = (err instanceof Error ? err.message : (err as any)?.message) ?? ''
      toast.error(mensaje || 'No se pudo registrar el movimiento')
    } finally {
      setGuardandoMov(false)
    }
  }

  // ── Render ────────────────────────────────────────────────────────────────

  return (
    <div className="min-h-full pb-[calc(72px+34px)]">

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
          <div
            className="w-9 h-9 rounded-lg flex items-center justify-center flex-shrink-0"
            style={{ backgroundColor: 'var(--agro-success-fill)' }}
          >
            <Sprout className="w-5 h-5" style={{ color: 'var(--agro-success-text)' }} />
          </div>
        </div>
      </header>

      {/* Tabs */}
      <div className="px-4 pt-3 flex gap-1 bg-card border-b border-border">
        {(['registros', 'inventario'] as const).map((t) => (
          <button
            key={t}
            onClick={() => setTab(t)}
            className="flex-1 h-9 text-sm rounded-t-lg transition-colors"
            style={
              tab === t
                ? { backgroundColor: 'var(--primary)', color: '#fff', fontWeight: 600 }
                : { color: 'var(--muted-foreground)', fontWeight: 400 }
            }
          >
            {t === 'registros' ? 'Registros' : 'Inventario'}
          </button>
        ))}
      </div>

      {/* ── TAB: Registros ───────────────────────────────────────────────────── */}
      {tab === 'registros' && (
        <>
          {/* Botón consolidado */}
          <div className="px-4 pt-3">
            <button
              onClick={() => {
                setConsRanchoId('')
                setConsDesde('')
                setConsHasta(hoy())
                setErrConsRancho(false)
                setErrConsFechas(false)
                setSheetConsolidadoAbierto(true)
              }}
              className="w-full h-10 flex items-center justify-center gap-1.5 rounded-xl border text-sm transition-colors"
              style={{ borderColor: 'var(--primary)', color: 'var(--primary)', fontWeight: 600 }}
            >
              <Files className="w-4 h-4" />
              Exportar consolidado
            </button>
          </div>

          {/* Lista */}
          <div className="p-4 space-y-3">
            {loading ? (
              <div className="flex justify-center py-12">
                <Loader2 className="w-8 h-8 text-primary animate-spin" />
              </div>
            ) : registros.length === 0 ? (
              <div className="bg-card border border-border rounded-xl p-6 text-center">
                <Sprout className="w-10 h-10 mx-auto mb-2" style={{ color: 'var(--muted-foreground)' }} />
                <p className="text-sm text-muted-foreground">Sin registros aún</p>
                <p className="text-xs text-muted-foreground mt-1">Toca + para agregar el primero</p>
              </div>
            ) : (
              registros.map((reg) => {
                const key = `${reg.rancho_id}|${reg.fecha}`
                return (
                  <div key={key} className="bg-card border border-border rounded-xl p-4">
                    <div className="flex items-start justify-between gap-3">
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-2 mb-1 flex-wrap">
                          <span className="text-sm text-foreground truncate" style={{ fontWeight: 600 }}>
                            {reg.rancho_nombre}
                          </span>
                          <span
                            className="text-[11px] px-2 py-0.5 rounded flex-shrink-0"
                            style={{
                              backgroundColor: 'var(--muted)',
                              color: 'var(--muted-foreground)',
                              fontWeight: 600,
                            }}
                          >
                            {reg.fertilizantes.length} fertilizante{reg.fertilizantes.length !== 1 ? 's' : ''}
                          </span>
                          {reg.sector && (
                            <span
                              className="text-[11px] px-2 py-0.5 rounded flex-shrink-0"
                              style={{
                                backgroundColor: 'var(--agro-success-fill)',
                                color: 'var(--agro-success-text)',
                                fontWeight: 600,
                              }}
                            >
                              {reg.sector}
                            </span>
                          )}
                        </div>
                        <p className="text-xs text-muted-foreground">{formatFecha(reg.fecha)}</p>
                      </div>
                      <button
                        onClick={() => handleDescargarPDF(reg)}
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
                    <div className="mt-2 space-y-1">
                      {reg.fertilizantes.map((f, i) => (
                        <div key={i} className="flex items-center gap-2 text-xs text-muted-foreground">
                          <span className="truncate">{f.nombre_comercial}</span>
                          <span className="flex-shrink-0 opacity-50">·</span>
                          <span className="flex-shrink-0">{f.metodo}</span>
                          <span className="flex-shrink-0 opacity-50">·</span>
                          <span className="flex-shrink-0">{f.cantidad_total.toFixed(2)}</span>
                        </div>
                      ))}
                    </div>
                  </div>
                )
              })
            )}
          </div>
        </>
      )}

      {/* ── TAB: Inventario ─────────────────────────────────────────────────── */}
      {tab === 'inventario' && (
        <div className="p-4 space-y-3">
          {saldos.length === 0 ? (
            <div className="bg-card border border-border rounded-xl p-6 text-center">
              <Package className="w-10 h-10 mx-auto mb-2" style={{ color: 'var(--muted-foreground)' }} />
              <p className="text-sm text-muted-foreground">Sin saldos registrados</p>
              <p className="text-xs text-muted-foreground mt-1">
                Los saldos aparecen al registrar entradas de inventario
              </p>
            </div>
          ) : (
            saldos.map((s) => (
              <div
                key={`${s.rancho_id}|${s.fertilizante_id}`}
                className="bg-card border border-border rounded-xl p-4"
              >
                <div className="flex items-start justify-between gap-3">
                  <div className="flex-1 min-w-0">
                    <p className="text-sm text-foreground truncate" style={{ fontWeight: 600 }}>
                      {s.nombre_comercial}
                    </p>
                    {s.ingrediente_activo && (
                      <p className="text-xs text-muted-foreground truncate">{s.ingrediente_activo}</p>
                    )}
                    <p className="text-xs text-muted-foreground mt-0.5">{s.rancho_nombre ?? '—'}</p>
                  </div>
                  <div className="text-right flex-shrink-0">
                    <p
                      className="text-base"
                      style={{
                        fontWeight: 700,
                        color: s.saldo < 0 ? 'var(--agro-red)' : 'var(--foreground)',
                      }}
                    >
                      {s.saldo.toFixed(2)}
                    </p>
                    <p className="text-xs text-muted-foreground">{s.unidad ?? 'kg'}</p>
                  </div>
                </div>
                {s.saldo < 0 && (
                  <div
                    className="mt-2 flex items-center gap-1.5 text-xs"
                    style={{ color: 'var(--agro-danger-text)' }}
                  >
                    <AlertTriangle className="w-3.5 h-3.5 flex-shrink-0" />
                    <span>Saldo negativo</span>
                  </div>
                )}
              </div>
            ))
          )}
        </div>
      )}

      {/* FAB contextual */}
      <div className="fixed bottom-[calc(72px+34px+16px)] left-1/2 -translate-x-1/2 w-full max-w-[390px] flex justify-end px-4 pointer-events-none z-10">
        <button
          onClick={tab === 'registros' ? abrirSheetNuevo : abrirSheetMov}
          className="w-14 h-14 rounded-full text-white flex items-center justify-center shadow-lg pointer-events-auto transition-colors"
          style={{ backgroundColor: 'var(--primary)' }}
          aria-label={tab === 'registros' ? 'Nuevo registro' : 'Movimiento de inventario'}
        >
          {tab === 'inventario' ? <TrendingDown className="w-6 h-6" /> : <Plus className="w-6 h-6" />}
        </button>
      </div>

      {/* ── Sheet: Nuevo registro ─────────────────────────────────────────────── */}
      {sheetNuevoAbierto && (
        <>
          <div
            className="fixed inset-0 bg-black/40 z-30"
            onClick={() => !guardando && setSheetNuevoAbierto(false)}
          />
          <div
            className="fixed bottom-0 left-0 right-0 z-40 bg-card flex flex-col"
            style={{ height: '85%', borderRadius: '0.625rem 0.625rem 0 0', maxWidth: 390, margin: '0 auto' }}
          >
            <div className="flex justify-center pt-3 pb-1 flex-shrink-0">
              <div className="w-10 h-1 rounded-full bg-border" />
            </div>
            <div className="flex items-center justify-between px-4 py-3 border-b border-border flex-shrink-0">
              <h2 className="text-base text-foreground" style={{ fontWeight: 600 }}>Nuevo registro</h2>
              <button onClick={() => !guardando && setSheetNuevoAbierto(false)} className="p-1">
                <X className="w-5 h-5 text-muted-foreground" />
              </button>
            </div>

            <div className="flex-1 overflow-y-auto px-4 py-4 space-y-4">
              {/* Rancho */}
              <div>
                <label
                  className="text-xs text-muted-foreground mb-1 block"
                  style={{ fontWeight: 600 }}
                >
                  {terminosSitio.singular} *
                </label>
                <select
                  value={ranchoId}
                  onChange={(e) => { setRanchoId(e.target.value); setErrRancho(false) }}
                  className="w-full h-10 px-3 rounded-lg bg-card border text-sm text-foreground focus:outline-none focus:border-primary focus:ring-1 focus:ring-primary"
                  style={errRancho ? { borderColor: 'var(--agro-red)' } : { borderColor: 'var(--border)' }}
                >
                  <option value="">Selecciona {terminosSitio.genero === 'f' ? 'una' : 'un'} {terminosSitio.singular.toLowerCase()}</option>
                  {ranchos.map((r) => (
                    <option key={r.id} value={r.id}>{r.nombre}</option>
                  ))}
                </select>
                {errRancho && (
                  <p className="text-xs mt-0.5" style={{ color: 'var(--agro-red)' }}>{terminosSitio.singular} requerido{terminosSitio.genero === 'f' ? 'a' : ''}</p>
                )}
              </div>

              {/* Fecha + Sector */}
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="text-xs text-muted-foreground mb-1 block" style={{ fontWeight: 600 }}>
                    Fecha *
                  </label>
                  <input
                    type="date"
                    value={fecha}
                    min={esSuperAdmin ? undefined : hoy()}
                    max={esSuperAdmin ? undefined : hoy()}
                    onChange={(e) => { if (esSuperAdmin) setFecha(e.target.value) }}
                    className="w-full h-10 px-3 rounded-lg bg-input-background border border-border text-sm text-foreground focus:outline-none focus:border-primary"
                  />
                </div>
                <div>
                  <label className="text-xs text-muted-foreground mb-1 block" style={{ fontWeight: 600 }}>
                    Sector
                  </label>
                  <input
                    type="text"
                    value={sector}
                    onChange={(e) => setSector(e.target.value)}
                    placeholder="Ej. Bloque A"
                    className="w-full h-10 px-3 rounded-lg bg-input-background border border-border text-sm text-foreground placeholder:text-muted-foreground focus:outline-none focus:border-primary"
                  />
                </div>
              </div>

              {/* Filas de fertilizantes */}
              <div className="space-y-3">
                <div className="flex items-center justify-between">
                  <p className="text-xs text-muted-foreground" style={{ fontWeight: 600 }}>
                    Fertilizantes ({filas.length})
                  </p>
                </div>
                {filas.map((fila, idx) => (
                  <FilaFertilizanteForm
                    key={idx}
                    fila={fila}
                    errores={errFilas[idx] ?? { nombre: false, superficie: false, dosis: false }}
                    catalogo={catalogo}
                    puedeEliminar={filas.length > 1}
                    onChange={(f) => updateFila(idx, f)}
                    onRemove={() => eliminarFila(idx)}
                  />
                ))}
                <button
                  type="button"
                  onClick={agregarFila}
                  className="w-full h-9 border border-dashed rounded-xl text-sm flex items-center justify-center gap-1.5 transition-colors hover:bg-muted"
                  style={{ borderColor: 'var(--border)', color: 'var(--muted-foreground)' }}
                >
                  <Plus className="w-4 h-4" />
                  Agregar fertilizante
                </button>
              </div>
            </div>

            <div className="px-4 py-4 border-t border-border flex-shrink-0">
              <button
                onClick={handleGuardar}
                disabled={guardando}
                className="w-full h-11 rounded-xl text-white text-sm flex items-center justify-center gap-2 disabled:opacity-60 transition-colors"
                style={{ backgroundColor: 'var(--primary)', fontWeight: 600 }}
              >
                {guardando && <Loader2 className="w-4 h-4 animate-spin" />}
                {guardando ? 'Guardando...' : 'Guardar y generar PDF'}
              </button>
            </div>
          </div>
        </>
      )}

      {/* ── Sheet: Exportar consolidado ───────────────────────────────────────── */}
      {sheetConsolidadoAbierto && (
        <>
          <div
            className="fixed inset-0 bg-black/40 z-30"
            onClick={() => !generandoConsolidado && setSheetConsolidadoAbierto(false)}
          />
          <div
            className="fixed bottom-0 left-0 right-0 z-40 bg-card flex flex-col"
            style={{ height: '85%', borderRadius: '0.625rem 0.625rem 0 0', maxWidth: 390, margin: '0 auto' }}
          >
            <div className="flex justify-center pt-3 pb-1 flex-shrink-0">
              <div className="w-10 h-1 rounded-full bg-border" />
            </div>
            <div className="flex items-center justify-between px-4 py-3 border-b border-border flex-shrink-0">
              <h2 className="text-base text-foreground" style={{ fontWeight: 600 }}>Exportar consolidado</h2>
              <button
                onClick={() => !generandoConsolidado && setSheetConsolidadoAbierto(false)}
                className="p-1"
              >
                <X className="w-5 h-5 text-muted-foreground" />
              </button>
            </div>

            <div className="flex-1 overflow-y-auto px-4 py-4 space-y-4">
              <div>
                <label className="text-xs text-muted-foreground mb-1 block" style={{ fontWeight: 600 }}>
                  {terminosSitio.singular} *
                </label>
                <select
                  value={consRanchoId}
                  onChange={(e) => { setConsRanchoId(e.target.value); setErrConsRancho(false) }}
                  className="w-full h-10 px-3 rounded-lg bg-card border text-sm text-foreground focus:outline-none focus:border-primary"
                  style={errConsRancho ? { borderColor: 'var(--agro-red)' } : { borderColor: 'var(--border)' }}
                >
                  <option value="">Selecciona {terminosSitio.genero === 'f' ? 'una' : 'un'} {terminosSitio.singular.toLowerCase()}</option>
                  {ranchos.map((r) => (
                    <option key={r.id} value={r.id}>{r.nombre}</option>
                  ))}
                </select>
                {errConsRancho && (
                  <p className="text-xs mt-0.5" style={{ color: 'var(--agro-red)' }}>{terminosSitio.singular} requerido{terminosSitio.genero === 'f' ? 'a' : ''}</p>
                )}
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="text-xs text-muted-foreground mb-1 block" style={{ fontWeight: 600 }}>
                    Desde *
                  </label>
                  <input
                    type="date"
                    value={consDesde}
                    onChange={(e) => { setConsDesde(e.target.value); setErrConsFechas(false) }}
                    className="w-full h-10 px-3 rounded-lg bg-input-background border text-sm text-foreground focus:outline-none focus:border-primary"
                    style={errConsFechas ? { borderColor: 'var(--agro-red)' } : { borderColor: 'var(--border)' }}
                  />
                </div>
                <div>
                  <label className="text-xs text-muted-foreground mb-1 block" style={{ fontWeight: 600 }}>
                    Hasta *
                  </label>
                  <input
                    type="date"
                    value={consHasta}
                    onChange={(e) => { setConsHasta(e.target.value); setErrConsFechas(false) }}
                    className="w-full h-10 px-3 rounded-lg bg-input-background border text-sm text-foreground focus:outline-none focus:border-primary"
                    style={errConsFechas ? { borderColor: 'var(--agro-red)' } : { borderColor: 'var(--border)' }}
                  />
                </div>
              </div>
              {errConsFechas && (
                <p className="text-xs" style={{ color: 'var(--agro-red)' }}>Ambas fechas son requeridas</p>
              )}
            </div>

            <div className="px-4 py-4 border-t border-border flex-shrink-0">
              <button
                onClick={handleGenerarConsolidado}
                disabled={generandoConsolidado}
                className="w-full h-11 rounded-xl text-white text-sm flex items-center justify-center gap-2 disabled:opacity-60 transition-colors"
                style={{ backgroundColor: 'var(--primary)', fontWeight: 600 }}
              >
                {generandoConsolidado
                  ? <Loader2 className="w-4 h-4 animate-spin" />
                  : <FileDown className="w-4 h-4" />
                }
                {generandoConsolidado ? 'Generando...' : 'Generar PDF consolidado'}
              </button>
            </div>
          </div>
        </>
      )}

      {/* ── Sheet: Movimiento manual de inventario ───────────────────────────── */}
      {sheetMovAbierto && (
        <>
          <div
            className="fixed inset-0 bg-black/40 z-30"
            onClick={() => !guardandoMov && setSheetMovAbierto(false)}
          />
          <div
            className="fixed bottom-0 left-0 right-0 z-40 bg-card flex flex-col"
            style={{ height: '85%', borderRadius: '0.625rem 0.625rem 0 0', maxWidth: 390, margin: '0 auto' }}
          >
            <div className="flex justify-center pt-3 pb-1 flex-shrink-0">
              <div className="w-10 h-1 rounded-full bg-border" />
            </div>
            <div className="flex items-center justify-between px-4 py-3 border-b border-border flex-shrink-0">
              <h2 className="text-base text-foreground" style={{ fontWeight: 600 }}>
                Movimiento de inventario
              </h2>
              <button onClick={() => !guardandoMov && setSheetMovAbierto(false)} className="p-1">
                <X className="w-5 h-5 text-muted-foreground" />
              </button>
            </div>

            <div className="flex-1 overflow-y-auto px-4 py-4 space-y-4">
              {/* Rancho */}
              <div>
                <label className="text-xs text-muted-foreground mb-1 block" style={{ fontWeight: 600 }}>
                  {terminosSitio.singular} *
                </label>
                <select
                  value={movRanchoId}
                  onChange={(e) => {
                    setMovRanchoId(e.target.value)
                    setErrMovRancho(false)
                    setMovSaldoActual(null)
                    saldoFetchKey.current = ''
                  }}
                  className="w-full h-10 px-3 rounded-lg bg-card border text-sm text-foreground focus:outline-none focus:border-primary"
                  style={errMovRancho ? { borderColor: 'var(--agro-red)' } : { borderColor: 'var(--border)' }}
                >
                  <option value="">Selecciona {terminosSitio.genero === 'f' ? 'una' : 'un'} {terminosSitio.singular.toLowerCase()}</option>
                  {ranchos.map((r) => (
                    <option key={r.id} value={r.id}>{r.nombre}</option>
                  ))}
                </select>
                {errMovRancho && (
                  <p className="text-xs mt-0.5" style={{ color: 'var(--agro-red)' }}>{terminosSitio.singular} requerido{terminosSitio.genero === 'f' ? 'a' : ''}</p>
                )}
              </div>

              {/* Fertilizante */}
              <div>
                <label className="text-xs text-muted-foreground mb-1 block" style={{ fontWeight: 600 }}>
                  Fertilizante *
                </label>
                <FertilizanteCombobox
                  value={movNombreComercial}
                  onChange={(v) => {
                    setMovNombreComercial(v)
                    setErrMovNombre(false)
                    setMovSaldoActual(null)
                    saldoFetchKey.current = ''
                  }}
                  onSelect={handleSelectFertilizanteMovimiento}
                  catalogo={catalogo}
                  error={errMovNombre}
                />
                {errMovNombre && (
                  <p className="text-xs mt-0.5" style={{ color: 'var(--agro-red)' }}>Nombre requerido</p>
                )}
              </div>

              {/* Ing. activo + Concentración */}
              <div className="grid grid-cols-2 gap-2">
                <input
                  type="text"
                  value={movIngActivo}
                  onChange={(e) => setMovIngActivo(e.target.value)}
                  placeholder="Ingrediente activo"
                  className="h-9 px-3 rounded-lg bg-input-background border border-border text-sm text-foreground placeholder:text-muted-foreground focus:outline-none focus:border-primary"
                />
                <input
                  type="text"
                  value={movConcentracion}
                  onChange={(e) => setMovConcentracion(e.target.value)}
                  placeholder="Concentración"
                  className="h-9 px-3 rounded-lg bg-input-background border border-border text-sm text-foreground placeholder:text-muted-foreground focus:outline-none focus:border-primary"
                />
              </div>

              {/* Unidad */}
              <div className="flex items-center gap-3">
                <span
                  className="text-xs text-muted-foreground flex-shrink-0"
                  style={{ minWidth: 56 }}
                >
                  Unidad
                </span>
                <div className="flex gap-1.5">
                  {(['kg', 'L'] as const).map((u) => (
                    <button
                      key={u}
                      type="button"
                      onClick={() => setMovUnidad(u)}
                      className="h-7 px-3 rounded-lg text-xs transition-colors"
                      style={
                        movUnidad === u
                          ? { backgroundColor: 'var(--primary)', color: '#fff', fontWeight: 600 }
                          : { backgroundColor: 'var(--input-background)', color: 'var(--muted-foreground)', border: '1px solid var(--border)' }
                      }
                    >
                      {u}
                    </button>
                  ))}
                </div>
              </div>

              {/* Tipo movimiento */}
              <div>
                <label className="text-xs text-muted-foreground mb-2 block" style={{ fontWeight: 600 }}>
                  Tipo de movimiento
                </label>
                <div className="flex gap-2">
                  {(['entrada', 'salida', 'ajuste'] as TipoMovimiento[]).map((t) => (
                    <button
                      key={t}
                      type="button"
                      onClick={() => setMovTipo(t)}
                      className="flex-1 h-9 rounded-lg text-xs transition-colors capitalize"
                      style={
                        movTipo === t
                          ? { backgroundColor: 'var(--primary)', color: '#fff', fontWeight: 600 }
                          : { backgroundColor: 'var(--input-background)', color: 'var(--muted-foreground)', border: '1px solid var(--border)' }
                      }
                    >
                      {t}
                    </button>
                  ))}
                </div>
              </div>

              {/* Cantidad */}
              <div>
                <label className="text-xs text-muted-foreground mb-1 block" style={{ fontWeight: 600 }}>
                  Cantidad ({movUnidad}) *
                </label>
                <input
                  type="number"
                  min="0"
                  step="0.01"
                  value={movCantidad}
                  onChange={(e) => { setMovCantidad(e.target.value); setErrMovCantidad(false) }}
                  placeholder="0.00"
                  className="w-full h-10 px-3 rounded-lg bg-input-background border text-sm text-foreground placeholder:text-muted-foreground focus:outline-none focus:border-primary"
                  style={errMovCantidad ? { borderColor: 'var(--agro-red)' } : { borderColor: 'var(--border)' }}
                />
                {errMovCantidad && (
                  <p className="text-xs mt-0.5" style={{ color: 'var(--agro-red)' }}>
                    Cantidad requerida (mayor a 0)
                  </p>
                )}
                {movTipo === 'salida' && movSaldoActual !== null && (
                  <p className="text-xs mt-1 text-muted-foreground">
                    Stock actual:{' '}
                    <strong>{movSaldoActual.toFixed(2)} {movUnidad}</strong>
                  </p>
                )}
              </div>

              {/* Fecha */}
              <div>
                <label className="text-xs text-muted-foreground mb-1 block" style={{ fontWeight: 600 }}>
                  Fecha
                </label>
                <input
                  type="date"
                  value={movFecha}
                  onChange={(e) => setMovFecha(e.target.value)}
                  className="w-full h-10 px-3 rounded-lg bg-input-background border border-border text-sm text-foreground focus:outline-none focus:border-primary"
                />
              </div>

              {/* Referencia */}
              <div>
                <label className="text-xs text-muted-foreground mb-1 block" style={{ fontWeight: 600 }}>
                  Referencia (opcional)
                </label>
                <input
                  type="text"
                  value={movReferencia}
                  onChange={(e) => setMovReferencia(e.target.value)}
                  placeholder="Ej. Factura #123"
                  className="w-full h-10 px-3 rounded-lg bg-input-background border border-border text-sm text-foreground placeholder:text-muted-foreground focus:outline-none focus:border-primary"
                />
              </div>
            </div>

            <div className="px-4 py-4 border-t border-border flex-shrink-0">
              <button
                onClick={handleGuardarMovimiento}
                disabled={guardandoMov}
                className="w-full h-11 rounded-xl text-white text-sm flex items-center justify-center gap-2 disabled:opacity-60 transition-colors"
                style={{ backgroundColor: 'var(--primary)', fontWeight: 600 }}
              >
                {guardandoMov && <Loader2 className="w-4 h-4 animate-spin" />}
                {guardandoMov ? 'Guardando...' : 'Registrar movimiento'}
              </button>
            </div>
          </div>
        </>
      )}

    </div>
  )
}
