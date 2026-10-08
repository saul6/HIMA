import { useState, useEffect, useCallback } from 'react'
import { supabase } from '@/lib/supabase'
import { leerConCache } from '@/lib/offline/cacheLectura'

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

export function useM36Monitoreos(userId: string | null, orgId: string | null) {
  const [monitoreos, setMonitoreos] = useState<M36Monitoreo[]>([])
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const fetch = useCallback(async () => {
    if (!userId || !orgId) return
    setLoading(true)
    setError(null)
    try {
      const resultado = await leerConCache(
        'm36_monitoreos',
        userId,
        orgId,
        async () => {
          const { data, error: err } = await (supabase as any)
            .from('m36_monitoreos')
            .select('*, ranchos(nombre)')
            .eq('org_id', orgId)
            .order('fecha', { ascending: false })
            .order('created_at', { ascending: false })
          if (err) throw err
          return data ?? []
        },
      )
      setMonitoreos(
        (resultado.datos as any[]).map((r: any) => ({
          ...r,
          rancho_nombre: r.ranchos?.nombre ?? '—',
        }))
      )
    } catch (e: unknown) {
      setError(e instanceof Error ? e.message : 'Error al cargar monitoreos')
    } finally {
      setLoading(false)
    }
  }, [userId, orgId])

  useEffect(() => { fetch() }, [fetch])

  return { monitoreos, loading, error, refetch: fetch }
}
