import { useState, useEffect, useCallback } from 'react'
import { supabase } from '@/lib/supabase'

export interface M56Registro {
  id: string
  org_id: string
  creado_por: string | null
  tema: string
  anio: number
  mes: number
  capacitador: string | null
  realizado: boolean
  observaciones: string | null
  activo: boolean
  created_at: string
}

export function useM56FrecuenciaCapacitacion(orgId: string | null) {
  const [registros, setRegistros] = useState<M56Registro[]>([])
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const fetch = useCallback(async () => {
    if (!orgId) return
    setLoading(true)
    setError(null)
    const { data, error: err } = await (supabase as any)
      .from('m56_frecuencia_capacitacion')
      .select('*')
      .eq('org_id', orgId)
      .order('anio', { ascending: false })
      .order('mes', { ascending: true })
    if (err) { setError(err.message); setLoading(false); return }
    setRegistros(data ?? [])
    setLoading(false)
  }, [orgId])

  useEffect(() => { fetch() }, [fetch])

  return { registros, loading, error, refetch: fetch }
}
