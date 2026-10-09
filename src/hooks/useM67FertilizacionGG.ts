import { useState, useEffect, useCallback } from 'react'
import { supabase } from '@/lib/supabase'
import { leerConCache } from '@/lib/offline/cacheLectura'

export interface M67FertilizacionGG {
  id: string
  org_id: string
  rancho_id: string
  rancho_nombre: string
  creado_por: string | null
  fecha: string
  cultivo: string
  bloque: string | null
  superficie_ha: number | null
  producto: string
  fabricante: string | null
  formula: string | null
  cantidad_total: number | null
  unidad: string | null
  cantidad_ha: string | null
  maquinaria: string | null
  metodo_aplicacion: string | null
  operario: string | null
  observaciones: string | null
  created_at: string
}

export function useM67FertilizacionGG(userId: string | null, orgId: string | null) {
  const [registros, setRegistros] = useState<M67FertilizacionGG[]>([])
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const fetch = useCallback(async () => {
    if (!orgId) return
    setLoading(true)
    setError(null)
    try {
      const { datos } = await leerConCache<M67FertilizacionGG[]>(
        'm67_fertilizacion_gg',
        userId,
        orgId,
        async () => {
          const { data, error: err } = await (supabase as any)
            .from('m67_fertilizacion_gg')
            .select('*, ranchos(nombre)')
            .eq('org_id', orgId)
            .order('fecha', { ascending: false })
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
