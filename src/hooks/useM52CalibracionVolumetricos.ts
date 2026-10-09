import { useState, useEffect, useCallback } from 'react'
import { supabase } from '@/lib/supabase'
import { leerConCache } from '@/lib/offline/cacheLectura'

export interface M52CalibracionVolumetrico {
  id: string
  org_id: string
  rancho_id: string
  rancho_nombre: string
  fecha: string
  uso_articulo: string
  capacidad: number | null
  unidad: string
  lectura1_ml: number | null
  lectura2_ml: number | null
  lectura3_ml: number | null
  desviacion: number | null
  realizo: string
  observaciones: string | null
  created_at: string
  creado_por: string | null
}

export function useM52CalibracionVolumetricos(userId: string | null, orgId: string | null) {
  const [registros, setRegistros] = useState<M52CalibracionVolumetrico[]>([])
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const fetch = useCallback(async () => {
    if (!userId || !orgId) return
    setLoading(true)
    setError(null)
    try {
      const resultado = await leerConCache(
        'm52_calibracion_volumetricos',
        userId,
        orgId,
        async () => {
          const { data, error: err } = await (supabase as any)
            .from('m52_calibracion_volumetricos')
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
