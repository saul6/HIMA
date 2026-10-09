import { useState, useEffect, useCallback } from 'react'
import { supabase } from '@/lib/supabase'
import { leerConCache } from '@/lib/offline/cacheLectura'

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

export function useM63UsoEpp(userId: string | null, orgId: string | null) {
  const [registros, setRegistros] = useState<M63UsoEpp[]>([])
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const fetch = useCallback(async () => {
    if (!orgId) return
    setLoading(true); setError(null)
    try {
      const { datos } = await leerConCache<M63UsoEpp[]>(
        'm63_uso_epp',
        userId,
        orgId,
        async () => {
          const { data, error: err } = await (supabase as any)
            .from('m63_uso_epp')
            .select('*, ranchos(nombre)')
            .eq('org_id', orgId)
            .order('fecha', { ascending: false })
            .order('created_at', { ascending: false })
          if (err) throw err
          return (data ?? []).map((r: any) => ({ ...r, rancho_nombre: r.ranchos?.nombre ?? '—' }))
        },
      )
      setRegistros(datos)
    } catch (e: any) {
      setError(e?.message ?? 'Error al cargar')
    } finally {
      setLoading(false)
    }
  }, [userId, orgId])

  useEffect(() => { fetch() }, [fetch])
  return { registros, loading, error, refetch: fetch }
}
