// M84 · Producto no conforme (papeleta PRO-07). Escritura solo por RPC.
import { useState, useEffect, useCallback } from 'react'
import { supabase } from '@/lib/supabase'
import { useAuthContext } from '@/context/AuthContext'

const tbl = (name: string) => (supabase as any).from(name)
const rpc = (fn: string, args: Record<string, unknown>) => (supabase as any).rpc(fn, args)

export type EstadoPapeleta = 'RETENIDA' | 'LIBERADA' | 'RECHAZADA'

export interface M84Papeleta {
  id: string
  rancho_id: string
  origen: 'INGRESO' | 'POSTERIOR'
  entrega_id: string
  linea_id: string
  empresa: string
  codigo: string
  embalaje: string
  cajas: number
  retenida_en: string
  fecha: string
  motivo: string
  retiene_nombre: string
  estado: EstadoPapeleta
  dictamen_en: string | null
  dictamen: string | null
  libera_nombre: string | null
  disposicion: string | null
}

/** Entregas de M82 en RETENIDA que aún no tienen papeletas. */
export interface M84EntregaRetenida {
  id: string
  rancho_id: string
  fecha: string
  hora: string
  empresa: string
  codigo_productor: string
  observaciones: string | null
  lineas: { codigo: string; cajas: number }[]
}

/** Fruta aceptada que se puede retener después. */
export interface M84LineaAceptada {
  linea_id: string
  rancho_id: string
  fecha: string
  hora: string
  empresa: string
  codigo_productor: string
  codigo: string
  cajas: number
  retenidas: number
}

export function useM84Papeletas() {
  const { profile } = useAuthContext()
  const orgId = profile?.org_id ?? null
  const [papeletas, setPapeletas] = useState<M84Papeleta[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  const refetch = useCallback(async () => {
    if (!orgId) return
    setLoading(true)
    try {
      const desde = new Date(Date.now() - 30 * 86400000).toLocaleDateString('en-CA', { timeZone: 'America/Mexico_City' })
      const [abiertas, recientes] = await Promise.all([
        tbl('m84_papeletas').select('*').eq('org_id', orgId).eq('estado', 'RETENIDA').order('retenida_en', { ascending: false }),
        tbl('m84_papeletas').select('*').eq('org_id', orgId).neq('estado', 'RETENIDA').gte('fecha', desde).order('dictamen_en', { ascending: false }),
      ])
      if (abiertas.error) throw abiertas.error
      if (recientes.error) throw recientes.error
      setPapeletas([...(abiertas.data ?? []), ...(recientes.data ?? [])])
      setError(null)
    } catch (e: any) {
      setError(e?.message ?? 'Error al cargar')
    } finally {
      setLoading(false)
    }
  }, [orgId])

  useEffect(() => { refetch() }, [refetch])
  return { papeletas, loading, error, refetch }
}

export async function cargarOrigenesM84(orgId: string): Promise<{ retenidas: M84EntregaRetenida[]; aceptadas: M84LineaAceptada[] }> {
  const desde = new Date(Date.now() - 7 * 86400000).toLocaleDateString('en-CA', { timeZone: 'America/Mexico_City' })
  const [ret, acc, pap] = await Promise.all([
    tbl('m82_entregas').select('id, rancho_id, fecha, hora, empresa, codigo_productor, observaciones, m82_entrega_lineas(codigo, cajas_declaradas, cajas_confirmadas)')
      .eq('org_id', orgId).eq('estado', 'RETENIDA').order('fecha', { ascending: false }),
    tbl('m82_entregas').select('id, rancho_id, fecha, hora, empresa, codigo_productor, m82_entrega_lineas(id, codigo, cajas_confirmadas)')
      .eq('org_id', orgId).eq('estado', 'ACEPTADA').gte('fecha', desde).order('fecha', { ascending: false }),
    tbl('m84_papeletas').select('entrega_id, linea_id, origen, cajas, estado').eq('org_id', orgId),
  ])
  if (ret.error) throw ret.error
  if (acc.error) throw acc.error
  const papel: any[] = pap.data ?? []
  const conIngreso = new Set(papel.filter((p) => p.origen === 'INGRESO').map((p) => p.entrega_id))
  const retenidasPorLinea = new Map<string, number>()
  for (const p of papel) if (p.origen === 'POSTERIOR' && p.estado !== 'LIBERADA')
    retenidasPorLinea.set(p.linea_id, (retenidasPorLinea.get(p.linea_id) ?? 0) + p.cajas)
  const retenidas: M84EntregaRetenida[] = (ret.data ?? []).filter((e: any) => !conIngreso.has(e.id)).map((e: any) => ({
    ...e, hora: String(e.hora ?? '').slice(0, 5),
    lineas: (e.m82_entrega_lineas ?? []).map((l: any) => ({ codigo: l.codigo, cajas: l.cajas_confirmadas ?? l.cajas_declaradas })),
  }))
  const aceptadas: M84LineaAceptada[] = []
  for (const e of acc.data ?? []) for (const l of e.m82_entrega_lineas ?? []) {
    const ret = retenidasPorLinea.get(l.id) ?? 0
    if ((l.cajas_confirmadas ?? 0) - ret > 0) aceptadas.push({
      linea_id: l.id, rancho_id: e.rancho_id, fecha: e.fecha, hora: String(e.hora ?? '').slice(0, 5), empresa: e.empresa,
      codigo_productor: e.codigo_productor, codigo: l.codigo, cajas: l.cajas_confirmadas, retenidas: ret,
    })
  }
  return { retenidas, aceptadas }
}

export async function retenerIngresoM84(entrega: string, motivo: string, retiene: string): Promise<number> {
  const { data, error } = await rpc('m84_retener_ingreso', { p_entrega: entrega, p_motivo: motivo, p_retiene: retiene })
  if (error) throw error
  return data as number
}

export async function retenerPosteriorM84(linea: string, cajas: number, motivo: string, retiene: string): Promise<string> {
  const { data, error } = await rpc('m84_retener_posterior', { p_linea: linea, p_cajas: cajas, p_motivo: motivo, p_retiene: retiene })
  if (error) throw error
  return data as string
}

export async function dictaminarM84(p: {
  papeleta: string; resultado: 'LIBERADA' | 'RECHAZADA'; dictamen: string; libera: string; disposicion?: string | null
}): Promise<{ estado: string; entrega: string | null }> {
  const { data, error } = await rpc('m84_dictaminar', {
    p_papeleta: p.papeleta, p_resultado: p.resultado, p_dictamen: p.dictamen, p_libera: p.libera, p_disposicion: p.disposicion ?? null,
  })
  if (error) throw error
  return data
}

export function mensajeErrorM84(e: any): { tipo: 'warning' | 'error'; texto: string } {
  const msg: string = e?.message ?? String(e ?? '')
  const m = /(M8[234]_[A-Z_]+|FORBIDDEN|VALOR_INVALIDO):\s*(.*)$/s.exec(msg)
  if (m) return { tipo: m[1] === 'FORBIDDEN' ? 'error' : 'warning', texto: m[2].trim() }
  return { tipo: 'error', texto: msg || 'Error al guardar' }
}
