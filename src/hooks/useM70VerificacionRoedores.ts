import { useState, useEffect, useCallback } from 'react'
import { supabase } from '@/lib/supabase'

export interface M70Verificacion {
  id: string
  rancho_id: string
  rancho_nombre: string
  fecha: string
  num_trampa: string
  roedor: boolean
  insectos: boolean
  otros: boolean
  cambio: boolean
  verifico: string | null
  observaciones: string | null
  created_at: string
}

export function useM70VerificacionRoedores(orgId: string | null) {
  const [registros, setRegistros] = useState<M70Verificacion[]>([])
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const fetch = useCallback(async () => {
    if (!orgId) return
    setLoading(true)
    setError(null)
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const { data, error: err } = await (supabase as any)
      .from('m70_verificacion_roedores')
      .select('*, ranchos(nombre)')
      .eq('org_id', orgId)
      .order('fecha', { ascending: false })
      .order('created_at', { ascending: false })
    if (err) { setError(err.message); setLoading(false); return }
    setRegistros(
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
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
