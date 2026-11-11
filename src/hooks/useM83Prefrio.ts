// M83 · Prefrío por grupo y turbina (formato PRO-04). Escritura solo por RPC (m83_iniciar / m83_finalizar / m83_cancelar).
import { useState, useEffect, useCallback } from 'react'
import { supabase } from '@/lib/supabase'
import { useAuthContext } from '@/context/AuthContext'

export { isoDesdeHoraLocal, horaLocal, fechaLocal, duracionHHMM, fmtTemp } from '@/lib/pdf/m83/formatoPrefrio'

const tbl = (name: string) => (supabase as any).from(name)
const rpc = (fn: string, args: Record<string, unknown>) => (supabase as any).rpc(fn, args)

export type Unidad = 'C' | 'F'

export interface M83Config { camara_nombre: string; turbinas_conv: number[]; turbinas_org: number[] }

export interface M83Disponible {
  linea_id: string
  entrega_id: string
  fecha: string
  hora: string
  empresa: string
  codigo_productor: string
  codigo: string
  presentacion: string | null
  fruta: string | null
  clasificacion: 'ORG' | 'CONV'
  cajas_confirmadas: number
  asignadas: number
  saldo: number
}

export interface M83Salida {
  id: string
  salida_en: string
  tarimas: number
  cajas: number
  temp_salida_valor: number
  temp_salida_unidad: Unidad
  duracion_min: number
}

export interface M83Grupo {
  id: string
  rancho_id: string
  empresa: string
  codigo: string
  fruta: string | null
  presentacion: string
  clasificacion: 'ORG' | 'CONV'
  camara: string
  turbina: number
  tarimas: number
  cajas: number
  entrada_en: string
  fecha: string
  modo_temp: 'GUIADO' | 'COMPACTO'
  temp_entrada_valor: number
  temp_entrada_unidad: Unidad
  muestra_minima: number
  estado: 'EN_PRE_FRIO' | 'FINALIZADO' | 'CANCELADO'
  creado_por: string | null
  salidas: M83Salida[]
  quedan_tarimas: number
  quedan_cajas: number
}

function normalizar(g: any): M83Grupo {
  const salidas: M83Salida[] = ((g.m83_salidas ?? []) as M83Salida[]).slice()
    .sort((a, b) => a.salida_en.localeCompare(b.salida_en))
  const st = salidas.reduce((a, s) => a + s.tarimas, 0)
  const sc = salidas.reduce((a, s) => a + s.cajas, 0)
  return {
    ...g,
    temp_entrada_valor: Number(g.temp_entrada_valor),
    salidas: salidas.map((s) => ({ ...s, temp_salida_valor: Number(s.temp_salida_valor) })),
    quedan_tarimas: g.tarimas - st,
    quedan_cajas: g.cajas - sc,
  }
}

const SELECT_GRUPO = '*, m83_salidas(id, salida_en, tarimas, cajas, temp_salida_valor, temp_salida_unidad, duracion_min)'

export async function cargarGruposM83(orgId: string, fecha: string): Promise<M83Grupo[]> {
  const { data, error } = await tbl('m83_grupos').select(SELECT_GRUPO)
    .eq('org_id', orgId).eq('fecha', fecha).neq('estado', 'CANCELADO').order('entrada_en')
  if (error) throw error
  return (data ?? []).map(normalizar)
}

export function useM83Prefrio(fecha: string) {
  const { profile } = useAuthContext()
  const orgId = profile?.org_id ?? null
  const [activos, setActivos] = useState<M83Grupo[]>([])
  const [delDia, setDelDia] = useState<M83Grupo[]>([])
  const [config, setConfig] = useState<M83Config>({ camara_nombre: 'Cámara de prefrío', turbinas_conv: [1, 2, 3], turbinas_org: [4] })
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  const refetch = useCallback(async () => {
    if (!orgId) return
    setLoading(true)
    try {
      const [a, d, c] = await Promise.all([
        tbl('m83_grupos').select(SELECT_GRUPO).eq('org_id', orgId).eq('estado', 'EN_PRE_FRIO').order('entrada_en'),
        cargarGruposM83(orgId, fecha),
        tbl('m83_config').select('camara_nombre, turbinas_conv, turbinas_org').eq('org_id', orgId).maybeSingle(),
      ])
      if (a.error) throw a.error
      setActivos((a.data ?? []).map(normalizar))
      setDelDia(d)
      if (c.data) setConfig(c.data as M83Config)
      setError(null)
    } catch (e: any) {
      setError(e?.message ?? 'Error al cargar')
    } finally {
      setLoading(false)
    }
  }, [orgId, fecha])

  useEffect(() => { refetch() }, [refetch])

  return { activos, delDia, config, loading, error, refetch }
}

export async function cargarDisponiblesM83(ranchoId: string): Promise<M83Disponible[]> {
  const { data, error } = await rpc('m83_disponibles', { p_rancho: ranchoId, p_dias: 3 })
  if (error) throw error
  return (data ?? []).map((d: any) => ({ ...d, hora: String(d.hora ?? '').slice(0, 5) }))
}

export interface Lectura { tarima: string; posicion: 'SUPERIOR' | 'MEDIO' | 'INFERIOR'; valor: number }

export async function iniciarPrefrioM83(p: {
  rancho: string; turbina: number; tarimas: number; origen: { linea_id: string; cajas: number }[]
  unidad: Unidad; lecturas?: Lectura[] | null; temp?: number | null; entradaEn?: string | null
}): Promise<string> {
  const { data, error } = await rpc('m83_iniciar', {
    p_rancho: p.rancho, p_turbina: p.turbina, p_tarimas: p.tarimas, p_origen: p.origen, p_unidad: p.unidad,
    p_lecturas: p.lecturas && p.lecturas.length ? p.lecturas : null,
    p_temp: p.lecturas && p.lecturas.length ? null : p.temp ?? null,
    p_entrada_en: p.entradaEn ?? null,
  })
  if (error) throw error
  return data as string
}

export async function finalizarPrefrioM83(p: {
  grupo: string; tarimas: number; cajas: number; temp: number; unidad: Unidad; salidaEn?: string | null
}): Promise<{ duracion_min: number; finalizado: boolean; quedan_tarimas: number; quedan_cajas: number }> {
  const { data, error } = await rpc('m83_finalizar', {
    p_grupo: p.grupo, p_tarimas: p.tarimas, p_cajas: p.cajas, p_temp: p.temp, p_unidad: p.unidad, p_salida_en: p.salidaEn ?? null,
  })
  if (error) throw error
  return data
}

export async function cancelarPrefrioM83(grupo: string, motivo: string): Promise<void> {
  const { error } = await rpc('m83_cancelar', { p_grupo: grupo, p_motivo: motivo })
  if (error) throw error
}

export function mensajeErrorM83(e: any): { tipo: 'warning' | 'error'; texto: string } {
  const msg: string = e?.message ?? String(e ?? '')
  const m = /(M83_[A-Z_]+|FORBIDDEN|VALOR_INVALIDO):\s*(.*)$/s.exec(msg)
  if (m) return { tipo: m[1] === 'FORBIDDEN' ? 'error' : 'warning', texto: m[2].trim() }
  return { tipo: 'error', texto: msg || 'Error al guardar' }
}
