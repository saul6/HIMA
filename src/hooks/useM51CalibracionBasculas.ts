import { useState, useEffect, useCallback } from 'react'
import { supabase } from '@/lib/supabase'
import { leerConCache } from '@/lib/offline/cacheLectura'

export interface M51CalibracionBascula {
  id: string
  org_id: string
  rancho_id: string
  rancho_nombre: string
  fecha: string
  uso_bascula: string
  pesa_patron_kg: number | null
  punto_calibracion: string
  peso_medido_kg: number | null
  desviacion: number | null
  dentro_tolerancia: boolean | null
  realizo: string
  observaciones: string | null
  created_at: string
  creado_por: string | null
}

export function useM51CalibracionBasculas(userId: string | null, orgId: string | null) {
  const [registros, setRegistros] = useState<M51CalibracionBascula[]>([])
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const fetch = useCallback(async () => {
    if (!userId || !orgId) return
    setLoading(true)
    setError(null)
    try {
      const resultado = await leerConCache(
        'm51_calibracion_basculas',
        userId,
        orgId,
        async () => {
          const { data, error: err } = await (supabase as any)
            .from('m51_calibracion_basculas')
            .select('*, ranchos(nombre)')
            .eq('org_id', orgId)
            .order('fecha', { ascending: false })
            .order('created_at', { ascending: false })
          if (err) throw err
          return data ?? []
        },
      )
      setRegistros(
        (resultado.datos as any[]).map((r: any) => ({
          ...r,
          rancho_nombre: r.ranchos?.nombre ?? '—',
        }))
      )
    } catch (e: unknown) {
      setError(e instanceof Error ? e.message : 'Error al cargar registros')
    } finally {
      setLoading(false)
    }
  }, [userId, orgId])

  useEffect(() => { fetch() }, [fetch])

  return { registros, loading, error, refetch: fetch }
}
