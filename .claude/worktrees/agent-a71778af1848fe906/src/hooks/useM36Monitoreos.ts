import { useState, useEffect, useCallback } from 'react'
import { supabase } from '@/lib/supabase'

export interface M36Monitoreo {
  id: string
  org_id: string
  rancho_id: string
  rancho_nombre: string
  fecha: string
  tipo_germicida: string
  uso: string
  concentracion: number
  correccion: string | null
  preparado_por: string
  created_at: string
  creado_por: string | null
}

export function useM36Monitoreos(orgId: string | null) {
  const [monitoreos, setMonitoreos] = useState<M36Monitoreo[]>([])
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const fetch = useCallback(async () => {
    if (!orgId) return
    setLoading(true)
    setError(null)
    const { data, error: err } = await (supabase as any)
      .from('m36_monitoreos')
      .select('*, ranchos(nombre)')
      .eq('org_id', orgId)
      .order('fecha', { ascending: false })
      .order('created_at', { ascending: false })
    if (err) { setError(err.message); setLoading(false); return }
    setMonitoreos(
      (data ?? []).map((r: any) => ({
        ...r,
        rancho_nombre: r.ranchos?.nombre ?? '—',
      }))
    )
    setLoading(false)
  }, [orgId])

  useEffect(() => { fetch() }, [fetch])

  return { monitoreos, loading, error, refetch: fetch }
}
