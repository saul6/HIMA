import { useState, useEffect, useCallback } from 'react'
import { supabase } from '@/lib/supabase'

export interface M24SaldoQuimico {
  quimico_id: string
  nombre: string
  unidad: string
  stock_minimo: number | null
  saldo: number
  ultimo_movimiento: string | null
  rancho_id: string
  org_id: string
}

export interface M24Movimiento {
  id: string
  org_id: string
  rancho_id: string
  quimico_id: string
  fecha: string
  persona_solicita: string
  area: string
  tipo: 'entrada' | 'salida'
  cantidad: number
  created_at: string
}

export interface M24Quimico {
  id: string
  org_id: string
  rancho_id: string
  nombre: string
  unidad: string
  stock_minimo: number | null
  activo: boolean
  orden: number
}

export function useM24Saldos(orgId: string | null) {
  const [saldos, setSaldos] = useState<M24SaldoQuimico[]>([])
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const fetch = useCallback(async () => {
    if (!orgId) return
    setLoading(true)
    setError(null)
    const { data, error: err } = await (supabase as any)
      .from('v_m24_saldo_quimico')
      .select('*')
      .eq('org_id', orgId)
      .order('nombre')
    if (err) { setError(err.message); setLoading(false); return }
    setSaldos(data ?? [])
    setLoading(false)
  }, [orgId])

  useEffect(() => { fetch() }, [fetch])

  return { saldos, loading, error, refetch: fetch }
}

export function useM24Movimientos(quimicoId: string | null, orgId: string | null) {
  const [movimientos, setMovimientos] = useState<M24Movimiento[]>([])
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const fetch = useCallback(async () => {
    if (!quimicoId || !orgId) { setMovimientos([]); return }
    setLoading(true)
    setError(null)
    const { data, error: err } = await (supabase as any)
      .from('m24_movimientos')
      .select('*')
      .eq('org_id', orgId)
      .eq('quimico_id', quimicoId)
      .order('fecha', { ascending: true })
      .order('created_at', { ascending: true })
    if (err) { setError(err.message); setLoading(false); return }
    setMovimientos(data ?? [])
    setLoading(false)
  }, [quimicoId, orgId])

  useEffect(() => { fetch() }, [fetch])

  return { movimientos, loading, error, refetch: fetch }
}

export function useM24QuimicosRancho(ranchoId: string | null, orgId: string | null) {
  const [quimicos, setQuimicos] = useState<M24Quimico[]>([])
  const [loading, setLoading] = useState(false)

  const fetch = useCallback(async () => {
    if (!ranchoId || !orgId) { setQuimicos([]); return }
    setLoading(true)
    const { data } = await (supabase as any)
      .from('m24_quimicos')
      .select('*')
      .eq('org_id', orgId)
      .eq('rancho_id', ranchoId)
      .order('orden')
      .order('nombre')
    setQuimicos(data ?? [])
    setLoading(false)
  }, [ranchoId, orgId])

  useEffect(() => { fetch() }, [fetch])

  return { quimicos, loading, refetch: fetch }
}
