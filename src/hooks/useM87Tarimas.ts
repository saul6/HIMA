// M87 · Tarimas: identidad permanente, ciclo de numeración y armado. Escritura solo por RPC.
import { useState, useEffect, useCallback } from 'react'
import { supabase } from '@/lib/supabase'
import { useAuthContext } from '@/context/AuthContext'

const tbl = (name: string) => (supabase as any).from(name)
const rpc = (fn: string, args: Record<string, unknown>) => (supabase as any).rpc(fn, args)

export interface M87Saldo {
  linea_id: string; entrega_id: string; fecha: string; hora: string; empresa: string; codigo_productor: string
  codigo: string; presentacion: string | null; fruta: string | null; clasificacion: 'ORG' | 'CONV'
  capacidad: number | null; capacidad_estado: 'DOCUMENTADA' | 'PENDIENTE'
  recibidas: number; en_tarimas: number; disponibles: number
}
export interface M87Ciclo { id: string; numero_ciclo: number; ultimo_numero: number; abierto_en: string }
export interface M87Tarima {
  id: string; numero: number; codigo: string; presentacion: string; fruta: string | null; clasificacion: 'ORG' | 'CONV'
  codigo_productor: string; empresa: string; tipo: 'COMPLETA' | 'PARCIAL_EXCEPCION'; origen: 'LLEGO_ARMADA' | 'ARMADA_EN_SITIO'
  capacidad_aplicada: number | null; excepcion_motivo: string | null; estado: string; creada_en: string; cajas: number
}

/** Agrupación autorizada para consolidar (P01/P02): mismo productor, ítem, clasificación y empresa. */
export interface M87Grupo { clave: string; empresa: string; codigo_productor: string; codigo: string; presentacion: string; fruta: string | null
  clasificacion: 'ORG' | 'CONV'; capacidad: number | null; disponibles: number; lineas: M87Saldo[] }

export function agrupar(saldos: M87Saldo[]): M87Grupo[] {
  const m = new Map<string, M87Grupo>()
  for (const s of saldos) {
    if (s.disponibles <= 0) continue
    const k = `${s.empresa}|${s.codigo_productor}|${s.codigo}|${s.clasificacion}`
    const g = m.get(k) ?? { clave: k, empresa: s.empresa, codigo_productor: s.codigo_productor, codigo: s.codigo, presentacion: s.presentacion ?? s.codigo,
      fruta: s.fruta, clasificacion: s.clasificacion, capacidad: s.capacidad, disponibles: 0, lineas: [] }
    g.disponibles += s.disponibles
    g.lineas.push(s)
    m.set(k, g)
  }
  return Array.from(m.values())
}

/** Reparte n tarimas completas de capacidad K tomando cajas de los renglones en orden (primero lo más antiguo). */
export function repartirCompletas(g: M87Grupo, n: number): { aportes: { linea_id: string; cajas: number }[] }[] {
  const K = g.capacidad ?? 0
  const restante = g.lineas.map(l => ({ id: l.linea_id, q: l.disponibles }))
  const out: { aportes: { linea_id: string; cajas: number }[] }[] = []
  for (let i = 0; i < n; i++) {
    let falta = K; const aportes: { linea_id: string; cajas: number }[] = []
    for (const r of restante) {
      if (falta === 0) break
      const t = Math.min(r.q, falta)
      if (t > 0) { aportes.push({ linea_id: r.id, cajas: t }); r.q -= t; falta -= t }
    }
    if (falta > 0) break
    out.push({ aportes })
  }
  return out
}

export function useM87Tarimas(ranchoId: string) {
  const { profile } = useAuthContext()
  const orgId = profile?.org_id ?? null
  const [saldos, setSaldos] = useState<M87Saldo[]>([])
  const [ciclo, setCiclo] = useState<M87Ciclo | null>(null)
  const [tarimas, setTarimas] = useState<M87Tarima[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  const refetch = useCallback(async () => {
    if (!orgId || !ranchoId) return
    setLoading(true)
    try {
      const [s, c] = await Promise.all([
        rpc('m87_consolidacion', { p_rancho: ranchoId, p_dias: 7 }),
        tbl('m87_ciclos').select('id, numero_ciclo, ultimo_numero, abierto_en').eq('rancho_id', ranchoId).eq('estado', 'ABIERTO').maybeSingle(),
      ])
      if (s.error) throw s.error
      setSaldos((s.data ?? []).map((x: any) => ({ ...x, hora: String(x.hora ?? '').slice(0, 5) })))
      setCiclo(c.data ?? null)
      if (c.data) {
        const t = await tbl('m87_tarimas').select('*, m87_aportaciones(cajas, vigente)').eq('ciclo_id', c.data.id).order('numero', { ascending: false })
        if (t.error) throw t.error
        setTarimas((t.data ?? []).map((x: any) => ({ ...x, cajas: (x.m87_aportaciones ?? []).filter((a: any) => a.vigente || x.estado === 'ANULADA').reduce((a: number, b: any) => a + b.cajas, 0) })))
      } else setTarimas([])
      setError(null)
    } catch (e: any) { setError(e?.message ?? 'Error al cargar') } finally { setLoading(false) }
  }, [orgId, ranchoId])

  useEffect(() => { refetch() }, [refetch])
  return { saldos, ciclo, tarimas, loading, error, refetch }
}

export async function armarTarimas(rancho: string, key: string, tarimas: { aportes: { linea_id: string; cajas: number }[]; llego_armada?: boolean; excepcion_motivo?: string | null }[]) {
  const { data, error } = await rpc('m87_armar', { p_rancho: rancho, p_key: key, p_tarimas: tarimas })
  if (error) throw error
  return data as { ciclo: number; tarimas: { tarima_id: string; numero: number; tipo: string }[]; repetida: boolean }
}
export async function anularTarima(id: string, motivo: string) { const { error } = await rpc('m87_anular', { p_tarima: id, p_motivo: motivo }); if (error) throw error }
export async function editarNumeroTarima(id: string, numero: number, motivo: string) { const { error } = await rpc('m87_editar_numero', { p_tarima: id, p_numero: numero, p_motivo: motivo }); if (error) throw error }
export async function corregirRecepcion(linea: string, cajas: number, motivo: string) {
  const { data, error } = await rpc('m87_corregir_recepcion', { p_linea: linea, p_cajas: cajas, p_motivo: motivo }); if (error) throw error; return data
}

export function mensajeErrorM87(e: any): { tipo: 'warning' | 'error'; texto: string } {
  const msg: string = e?.message ?? String(e ?? '')
  const m = /(M87_[A-Z_]+|FORBIDDEN|VALOR_INVALIDO):\s*(.*)$/s.exec(msg)
  if (m) return { tipo: m[1] === 'FORBIDDEN' ? 'error' : 'warning', texto: m[2].trim() }
  if (/fetch|network/i.test(msg)) return { tipo: 'error', texto: 'Sin conexión: no se guardó. Vuelve a intentar (no se duplicará).' }
  return { tipo: 'error', texto: msg || 'Error al guardar' }
}

/** Ingreso directo al conservador (fruta ya preenfriada). */
export async function ingresarConservador(tarimas: string[], en?: string | null) {
  const { data, error } = await rpc('m87_conservador', { p_tarimas: tarimas, p_accion: 'INGRESO', p_motivo: null, p_en: en ?? null })
  if (error) throw error
  return data as number
}

export interface M87Disposicion { tarima_id: string; accion: 'TRASPASAR' | 'DISPONER'; motivo?: string }
export async function cerrarCiclo(p: { rancho: string; key: string; confirmoFin: boolean; disposiciones: M87Disposicion[]; justificacion?: string | null }) {
  const { data, error } = await rpc('m87_cerrar_ciclo', {
    p_rancho: p.rancho, p_key: p.key, p_confirmo_fin: p.confirmoFin, p_disposiciones: p.disposiciones, p_justificacion_saldos: p.justificacion ?? null,
  })
  if (error) throw error
  return data as { ciclo_cerrado: number; traspasadas: number; saldo_sin_armar: number; repetida: boolean }
}

export interface M87CuadreFila { codigo: string; presentacion: string | null; clasificacion: string; recibidas: number; sin_armar: number
  en_tarimas_no_cargadas: number; cargadas: number; dispuestas: number; prefrio_legado: number; retenidas: number }
export async function cargarCuadre(rancho: string, desde: string, hasta: string): Promise<M87CuadreFila[]> {
  const { data, error } = await rpc('m87_cuadre', { p_rancho: rancho, p_desde: desde, p_hasta: hasta })
  if (error) throw error
  return (data ?? []) as M87CuadreFila[]
}
