import { useState, useEffect, useCallback } from 'react'
import { supabase } from '@/lib/supabase'
import { leerConCache } from '@/lib/offline/cacheLectura'

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

export function useM56FrecuenciaCapacitacion(userId: string | null, orgId: string | null) {
  const [registros, setRegistros] = useState<M56Registro[]>([])
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const fetch = useCallback(async () => {
    if (!orgId) return
    setLoading(true)
    setError(null)
    try {
      const { datos } = await leerConCache<M56Registro[]>(
        'm56_frecuencia_capacitacion',
        userId,
        orgId,
        async () => {
          const { data, error: err } = await (supabase as any)
            .from('m56_frecuencia_capacitacion')
            .select('*')
            .eq('org_id', orgId)
            .order('anio', { ascending: false })
            .order('mes', { ascending: true })
          if (err) throw err
          return data ?? []
        },
      )
      setRegistros(datos)
    } catch (e: any) {
      setError(e?.message ?? 'Error al cargar')
    } finally {
      setLoading(false)
    }
  }, [userId, orgId])

  useEffect(() => { fetch() }, [fetch])

  return { registros, loading, error, refetch: fetch }
}
