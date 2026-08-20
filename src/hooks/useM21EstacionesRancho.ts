import { useState, useCallback, useEffect } from 'react'
import { supabase } from '@/lib/supabase'
import { useAuthContext } from '@/context/AuthContext'

export type TipoTrampa = 'cebo' | 'interior' | 'mecanica' | 'pegamento' | 'luz'

export interface M21Estacion {
  id: string
  rancho_id: string
  org_id: string
  tipo_trampa: TipoTrampa
  numero: string
  activo: boolean
  orden: number
  created_at: string
}

export function useM21EstacionesRancho(ranchoId: string | null) {
  const { profile } = useAuthContext()
  const [estaciones, setEstaciones] = useState<M21Estacion[]>([])
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const cargar = useCallback(async () => {
    if (!profile?.org_id || !ranchoId) {
      setEstaciones([])
      return
    }

    setLoading(true)
    setError(null)
    try {
      const { data, error: err } = await (supabase as any)
        .from('m21_estaciones')
        .select('*')
        .eq('org_id', profile.org_id)
        .eq('rancho_id', ranchoId)
        .order('tipo_trampa')
        .order('orden')
        .order('numero')

      if (err) throw err
      setEstaciones(data ?? [])
    } catch (err: any) {
      setError(err?.message ?? 'Error al cargar estaciones')
    } finally {
      setLoading(false)
    }
  }, [profile?.org_id, ranchoId])

  useEffect(() => {
    cargar()
  }, [cargar])

  return { estaciones, loading, error, refetch: cargar }
}
