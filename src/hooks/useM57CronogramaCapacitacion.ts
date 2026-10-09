import { useState, useEffect, useCallback } from 'react'
import { supabase } from '@/lib/supabase'
import { leerConCache } from '@/lib/offline/cacheLectura'

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

export function useM57CronogramaCapacitacion(userId: string | null, orgId: string | null) {
  const [registros, setRegistros] = useState<M57Registro[]>([])
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const fetch = useCallback(async () => {
    if (!orgId) return
    setLoading(true)
    setError(null)
    try {
      const { datos } = await leerConCache<M57Registro[]>(
        'm57_cronograma_capacitacion',
        userId,
        orgId,
        async () => {
          const { data, error: err } = await (supabase as any)
            .from('m57_cronograma_capacitacion')
            .select('*')
            .eq('org_id', orgId)
            .order('created_at', { ascending: false })
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
