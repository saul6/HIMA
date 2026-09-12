import { useState, useEffect, useCallback } from 'react'
import { supabase } from '@/lib/supabase'

export interface M60Registro {
  id: string
  org_id: string
  rancho_id: string
  rancho_nombre: string
  mes: string
  tipo_combustible: string | null
  costo_combustible: number | null
  cantidad_litros: number | null
  actividad: string | null
  luz_costo: number | null
  luz_kwh: number | null
  realizo: string | null
  observaciones: string | null
  creado_por: string | null
  created_at: string
}

export function useM60ConsumoEnergia(orgId: string | null) {
  const [registros, setRegistros] = useState<M60Registro[]>([])
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const fetch = useCallback(async () => {
    if (!orgId) return
    setLoading(true)
    setError(null)
    const { data, error: err } = await (supabase as any)
      .from('m60_consumo_energia')
      .select('*, ranchos(nombre)')
      .eq('org_id', orgId)
      .order('mes', { ascending: false })
      .order('created_at', { ascending: false })
    if (err) { setError(err.message); setLoading(false); return }
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
