import { useState, useEffect, useCallback } from 'react'
import { supabase } from '@/lib/supabase'
import { leerConCache } from '@/lib/offline/cacheLectura'

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

export function useM60ConsumoEnergia(userId: string | null, orgId: string | null) {
  const [registros, setRegistros] = useState<M60Registro[]>([])
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const fetch = useCallback(async () => {
    if (!orgId) return
    setLoading(true)
    setError(null)
    try {
      const { datos } = await leerConCache<M60Registro[]>(
        'm60_consumo_energia',
        userId,
        orgId,
        async () => {
          const { data, error: err } = await (supabase as any)
            .from('m60_consumo_energia')
            .select('*, ranchos(nombre)')
            .eq('org_id', orgId)
            .order('mes', { ascending: false })
            .order('created_at', { ascending: false })
          if (err) throw err
          return (data ?? []).map((r: any) => ({
            ...r,
            rancho_nombre: r.ranchos?.nombre ?? '—',
          }))
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
