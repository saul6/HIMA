import { useState, useEffect, useCallback } from 'react'
import { supabase } from '@/lib/supabase'

export interface M50CalibracionEquipo {
  id: string
  org_id: string
  rancho_id: string
  rancho_nombre: string
  fecha: string
  num_equipo: string
  velocidad_kmh: number | null
  presion_trabajo_bar: number | null
  boquilla: string
  gasto_boquilla_ml: number | null
  resultado: string | null
  realizo: string
  observaciones: string | null
  created_at: string
  creado_por: string | null
}

export function useM50CalibracionEquipos(orgId: string | null) {
  const [registros, setRegistros] = useState<M50CalibracionEquipo[]>([])
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const fetch = useCallback(async () => {
    if (!orgId) return
    setLoading(true)
    setError(null)
    const { data, error: err } = await (supabase as any)
      .from('m50_calibracion_equipos')
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
