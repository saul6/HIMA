import { useState, useEffect, useCallback } from 'react'
import { supabase } from '@/lib/supabase'

export interface M63UsoEpp {
  id: string
  org_id: string
  rancho_id: string
  rancho_nombre: string
  fecha: string
  aplicador: string
  momento: string
  botas_ok: boolean
  overol_ok: boolean
  guantes_ok: boolean
  lentes_ok: boolean
  mascarilla_ok: boolean
  realizo: string | null
  observaciones: string | null
  created_at: string
}

export function useM63UsoEpp(orgId: string | null) {
  const [registros, setRegistros] = useState<M63UsoEpp[]>([])
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const fetch = useCallback(async () => {
    if (!orgId) return
    setLoading(true); setError(null)
    const { data, error: err } = await (supabase as any)
      .from('m63_uso_epp')
      .select('*, ranchos(nombre)')
      .eq('org_id', orgId)
      .order('fecha', { ascending: false })
      .order('created_at', { ascending: false })
    if (err) { setError(err.message); setLoading(false); return }
    setRegistros((data ?? []).map((r: any) => ({ ...r, rancho_nombre: r.ranchos?.nombre ?? '—' })))
    setLoading(false)
  }, [orgId])

  useEffect(() => { fetch() }, [fetch])
  return { registros, loading, error, refetch: fetch }
}
