import { useState, useEffect, useCallback } from 'react'
import { supabase } from '@/lib/supabase'

export interface M49CalibracionBomba {
  id: string
  org_id: string
  rancho_id: string
  rancho_nombre: string
  fecha: string
  equipo: string
  num_equipo: string
  cultivo: string
  parcela: string
  distancia_m: number | null
  velocidad_kmh: number | null
  presion_bar: number | null
  volumen_recolectado_ml: number | null
  gasto_l: number | null
  resultado: string | null
  realizo: string
  observaciones: string | null
  created_at: string
  creado_por: string | null
}

export function useM49CalibracionBombas(orgId: string | null) {
  const [registros, setRegistros] = useState<M49CalibracionBomba[]>([])
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const fetch = useCallback(async () => {
    if (!orgId) return
    setLoading(true)
    setError(null)
    const { data, error: err } = await (supabase as any)
      .from('m49_calibracion_bombas')
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
