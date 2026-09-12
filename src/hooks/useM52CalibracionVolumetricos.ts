import { useState, useEffect, useCallback } from 'react'
import { supabase } from '@/lib/supabase'

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

export function useM52CalibracionVolumetricos(orgId: string | null) {
  const [registros, setRegistros] = useState<M52CalibracionVolumetrico[]>([])
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const fetch = useCallback(async () => {
    if (!orgId) return
    setLoading(true)
    setError(null)
    const { data, error: err } = await (supabase as any)
      .from('m52_calibracion_volumetricos')
      .select('*, ranchos(nombre)')
      .eq('org_id', orgId)
      .order('fecha', { ascending: false })
      .order('created_at', { ascending: false })
    if (err) { console.error(err); setError(err.message); setLoading(false); return }
    setRegistros(
      (data ?? []).map((r: any) => ({
        ...r,
        rancho_nombre: r.ranchos?.nombre ?? '—',
      }))
    )
    setLoading(false)
  }, [orgId])

  useEffect(() => { fetch() }, [fetch])

  return { registros, loading, error, refetch: fetch }
}
