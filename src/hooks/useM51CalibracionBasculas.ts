import { useState, useEffect, useCallback } from 'react'
import { supabase } from '@/lib/supabase'

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

export function useM51CalibracionBasculas(orgId: string | null) {
  const [registros, setRegistros] = useState<M51CalibracionBascula[]>([])
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const fetch = useCallback(async () => {
    if (!orgId) return
    setLoading(true)
    setError(null)
    const { data, error: err } = await (supabase as any)
      .from('m51_calibracion_basculas')
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
