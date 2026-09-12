import { useState, useEffect, useCallback } from 'react'
import { supabase } from '@/lib/supabase'

export interface M57Registro {
  id: string
  org_id: string
  creado_por: string | null
  cargo: string
  tematica: string
  periodicidad: string
  mes_programado: string
  observaciones: string | null
  activo: boolean
  created_at: string
}

export function useM57CronogramaCapacitacion(orgId: string | null) {
  const [registros, setRegistros] = useState<M57Registro[]>([])
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const fetch = useCallback(async () => {
    if (!orgId) return
    setLoading(true)
    setError(null)
    const { data, error: err } = await (supabase as any)
      .from('m57_cronograma_capacitacion')
      .select('*')
      .eq('org_id', orgId)
      .order('created_at', { ascending: false })
    if (err) { setError(err.message); setLoading(false); return }
    setRegistros(data ?? [])
    setLoading(false)
  }, [orgId])

  useEffect(() => { fetch() }, [fetch])

  return { registros, loading, error, refetch: fetch }
}
