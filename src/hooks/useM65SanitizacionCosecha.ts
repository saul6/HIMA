import { useState, useEffect, useCallback } from 'react'
import { supabase } from '@/lib/supabase'
import { leerConCache } from '@/lib/offline/cacheLectura'

export interface M65SanitizacionCosecha {
  id: string
  org_id: string
  rancho_id: string
  rancho_nombre: string
  fecha: string
  sector: string
  empaque_o_granel: string
  cantidad_ton: number
  canastos: number
  herramientas_sanitizadas: number
  producto_sanitizante: string
  ppm: number
  hora: string | null
  realizo: string | null
  observaciones: string | null
  created_at: string
}

export function useM65SanitizacionCosecha(userId: string | null, orgId: string | null) {
  const [registros, setRegistros] = useState<M65SanitizacionCosecha[]>([])
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const fetch = useCallback(async () => {
    if (!orgId) return
    setLoading(true); setError(null)
    try {
      const { datos } = await leerConCache<M65SanitizacionCosecha[]>(
        'm65_sanitizacion_cosecha',
        userId,
        orgId,
        async () => {
          const { data, error: err } = await (supabase as any)
            .from('m65_sanitizacion_cosecha')
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
