// M86 · Manifiesto de embarque por tarima (formato PRO-01). Escritura solo por RPC (m86_crear / m86_accion).
import { useState, useEffect, useCallback } from 'react'
import { supabase } from '@/lib/supabase'
import { useAuthContext } from '@/context/AuthContext'

const tbl = (name: string) => (supabase as any).from(name)
const rpc = (fn: string, args: Record<string, unknown>) => (supabase as any).rpc(fn, args)

export type EstadoManifiesto = 'BORRADOR' | 'LLEGADA_INSPECCIONADA' | 'EN_CARGA' | 'CARGA_COMPLETA' | 'PENDIENTE_CONFORMIDADES' | 'CIERRE_LOCAL_SELLO_PENDIENTE' | 'CERRADO' | 'SUSPENDIDO'

export interface M86Manifiesto {
  id: string
  rancho_id: string
  fecha: string
  folio: string | null
  empresa: string
  transportista: string | null
  chofer: string | null
  tractor_placas: string | null
  tractor_economico: string | null
  caja_pies: string | null
  caja_economico: string | null
  estado: EstadoManifiesto
  temp_unidad: 'C' | 'F'
  llegada_en: string | null; llegada_temp: number | null
  carga_en: string | null; carga_temp: number | null
  salida_en: string | null; salida_temp: number | null
  it_buen_estado: boolean | null; it_limpio: boolean | null; it_plagas: boolean | null
  itar_remontado: boolean | null; itar_flejado: boolean | null; itar_limpieza: boolean | null; itar_condicion: boolean | null; itar_distribucion: boolean | null
  termografo_folio: string | null
  sello_estado: 'COLOCADO' | 'PENDIENTE_CONSOLIDADO' | null
  sello_folio: string | null
  observaciones: string | null
  conf_emergent_nombre: string | null; conf_emergent_en: string | null
  conf_cliente_nombre: string | null; conf_cliente_en: string | null
  conf_chofer_nombre: string | null; conf_chofer_en: string | null
  suspendido_motivo: string | null
  papel_resguardo: string | null
  papel_registrado_en: string | null
}

export interface M86Linea { id: string; codigo: string; fruta: string | null; presentacion: string; clasificacion: string; cajas: number; orden: number }
export interface M86Tarima {
  id: string; numero: string; clasificacion: 'ORG' | 'CONV'; estado: 'CARGADA' | 'RETIRADA'
  confirmada_en: string; retirada_en: string | null; retiro_motivo: string | null; lineas: M86Linea[]
  cotejo_retencion: boolean; papeleta_id: string | null; papeleta_codigo?: string | null
  tarima_id?: string | null; origen: { codigo: string; codigo_productor: string; cajas: number }[]
}
/** Tarima registrada (M87) disponible o reservada para este manifiesto. */
export interface M86TarimaReg { id: string; numero: number; codigo: string; presentacion: string; clasificacion: 'ORG' | 'CONV'; codigo_productor: string; estado: string; manifiesto_id: string | null; cajas: number }
export interface M86Muestra { id: string; tarima_numero: string; superior: number; medio: number; inferior: number; unidad: 'C' | 'F'; medida_en: string; capturo?: string }
export interface M86SelloEvidencia {
  id: string; sello_folio: string; unidad_referencia: string; informa: string; soporte: string; fecha_informada: string | null
  recibido_en: string; estado: 'POR_VERIFICAR' | 'VERIFICADA' | 'RECHAZADA'; verificado_en: string | null; nota: string | null; verifico?: string
}
export interface M86Detalle { m: M86Manifiesto; tarimas: M86Tarima[]; muestras: M86Muestra[]; evidencias: M86SelloEvidencia[] }
export interface M86PapeletaRef { id: string; codigo: string; embalaje: string; cajas: number; estado: string; fecha: string; empresa: string }

const numOrNull = (v: any) => (v === null || v === undefined ? null : Number(v))
const normM = (m: any): M86Manifiesto => ({
  ...m, llegada_temp: numOrNull(m.llegada_temp), carga_temp: numOrNull(m.carga_temp), salida_temp: numOrNull(m.salida_temp),
})

export async function cargarDetalleM86(id: string): Promise<M86Detalle> {
  const [m, t, mu, ev] = await Promise.all([
    tbl('m86_manifiestos').select('*').eq('id', id).single(),
    tbl('m86_tarimas').select('*, m86_tarima_lineas(*), m84_papeletas(codigo), m86_tarima_origen(codigo, codigo_productor, cajas)').eq('manifiesto_id', id).order('confirmada_en'),
    tbl('m86_muestras').select('*').eq('manifiesto_id', id).order('medida_en'),
    tbl('m86_sello_evidencias').select('*').eq('manifiesto_id', id).order('recibido_en'),
  ])
  if (m.error) throw m.error
  if (t.error) throw t.error
  const ids = Array.from(new Set([...(mu.data ?? []).map((x: any) => x.creado_por), ...(ev.data ?? []).map((x: any) => x.verificado_por)].filter(Boolean)))
  const nombres: Record<string, string> = {}
  if (ids.length) { const { data } = await tbl('profiles').select('id, nombre_completo').in('id', ids); for (const p of data ?? []) nombres[p.id] = p.nombre_completo ?? '' }
  return {
    m: normM(m.data),
    tarimas: (t.data ?? []).map((x: any) => ({
      ...x, papeleta_codigo: x.m84_papeletas?.codigo ?? null, origen: x.m86_tarima_origen ?? [],
      lineas: ((x.m86_tarima_lineas ?? []) as M86Linea[]).slice().sort((a, b) => a.orden - b.orden),
    })),
    muestras: (mu.data ?? []).map((x: any) => ({ ...x, superior: Number(x.superior), medio: Number(x.medio), inferior: Number(x.inferior), capturo: nombres[x.creado_por] ?? '' })),
    evidencias: (ev.data ?? []).map((x: any) => ({ ...x, verifico: nombres[x.verificado_por] ?? '' })),
  }
}

export function useM86Lista() {
  const { profile } = useAuthContext()
  const orgId = profile?.org_id ?? null
  const [manifiestos, setManifiestos] = useState<M86Manifiesto[]>([])
  const [historial, setHistorial] = useState<Record<string, string[]>>({})
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  const refetch = useCallback(async () => {
    if (!orgId) return
    setLoading(true)
    try {
      const desde = new Date(Date.now() - 30 * 86400000).toLocaleDateString('en-CA', { timeZone: 'America/Mexico_City' })
      const { data, error } = await tbl('m86_manifiestos').select('*').eq('org_id', orgId)
        .or(`fecha.gte.${desde},estado.neq.CERRADO`).order('created_at', { ascending: false }).limit(200)
      if (error) throw error
      const lista = (data ?? []).map(normM)
      setManifiestos(lista)
      // Historial de transporte: solo sugerencias (siempre se confirma contra la unidad real)
      const campos = ['empresa', 'transportista', 'chofer', 'tractor_placas', 'tractor_economico', 'caja_pies', 'caja_economico'] as const
      const h: Record<string, string[]> = {}
      for (const c of campos) h[c] = Array.from(new Set(lista.map((x: any) => x[c]).filter(Boolean))).slice(0, 30) as string[]
      setHistorial(h)
      setError(null)
    } catch (e: any) {
      setError(e?.message ?? 'Error al cargar')
    } finally {
      setLoading(false)
    }
  }, [orgId])

  useEffect(() => { refetch() }, [refetch])
  return { manifiestos, historial, loading, error, refetch }
}

/** Papeletas PRO-07 recientes de la organización, para referenciar el cotejo de retención de una tarima. */
export async function cargarPapeletasM86(orgId: string): Promise<M86PapeletaRef[]> {
  const desde = new Date(Date.now() - 30 * 86400000).toLocaleDateString('en-CA', { timeZone: 'America/Mexico_City' })
  const { data } = await tbl('m84_papeletas').select('id, codigo, embalaje, cajas, estado, fecha, empresa').eq('org_id', orgId).gte('fecha', desde).order('fecha', { ascending: false })
  return data ?? []
}

export async function cargarTarimasRegM86(rancho: string, empresa: string, manifiesto: string): Promise<M86TarimaReg[]> {
  const { data, error } = await tbl('m87_tarimas').select('id, numero, codigo, presentacion, clasificacion, codigo_productor, estado, manifiesto_id, m87_aportaciones(cajas, vigente)')
    .eq('rancho_id', rancho).eq('empresa', empresa).in('estado', ['ARMADA', 'EN_CONSERVADOR', 'RESERVADA']).order('numero')
  if (error) throw error
  return (data ?? [])
    .filter((x: any) => x.estado !== 'RESERVADA' || x.manifiesto_id === manifiesto)
    .map((x: any) => ({ ...x, cajas: (x.m87_aportaciones ?? []).filter((a: any) => a.vigente).reduce((a: number, b: any) => a + b.cajas, 0) }))
}

/** Productores de una línea cargada desde tarima registrada (vacío si fue captura manual). */
export function productoresDe(t: M86Tarima, codigo: string): string {
  return Array.from(new Set((t.origen ?? []).filter(o => o.codigo === codigo).map(o => o.codigo_productor))).join(', ')
}

export async function crearManifiestoM86(rancho: string, datos: Record<string, string>): Promise<string> {
  const { data, error } = await rpc('m86_crear', { p_rancho: rancho, p_datos: datos })
  if (error) throw error
  return data as string
}

export async function accionM86(id: string, accion: string, datos: Record<string, unknown> = {}): Promise<any> {
  const { data, error } = await rpc('m86_accion', { p_manifiesto: id, p_accion: accion, p_datos: datos })
  if (error) throw error
  return data
}

export function mensajeErrorM86(e: any): { tipo: 'warning' | 'error'; texto: string } {
  const msg: string = e?.message ?? String(e ?? '')
  const m = /(M86_[A-Z_]+|FORBIDDEN|VALOR_INVALIDO):\s*(.*)$/s.exec(msg)
  if (m) return { tipo: m[1] === 'FORBIDDEN' ? 'error' : 'warning', texto: m[2].trim() }
  if (/fetch|network/i.test(msg)) return { tipo: 'error', texto: 'Sin conexión: no se guardó. Vuelve a intentar.' }
  return { tipo: 'error', texto: msg || 'Error al guardar' }
}

export { totalesPorPresentacion } from '@/lib/pdf/m86/manifiestoLogica'
