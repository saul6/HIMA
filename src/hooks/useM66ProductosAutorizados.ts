import { useState, useEffect, useCallback } from 'react'
import { supabase } from '@/lib/supabase'
import { leerConCache } from '@/lib/offline/cacheLectura'

export interface M66ProductoAutorizado {
  id: string
  org_id: string
  cultivo: string
  ingrediente_activo: string
  nombre_comercial: string
  concentracion: string
  empresa: string
  dosis_ha: string
  intervalo_seguridad_dias: number | null
  plagas_control: string
  mercado: string
  activo: boolean
  creado_por: string | null
  created_at: string
}

export function useM66ProductosAutorizados(userId: string | null, orgId: string | null) {
  const [productos, setProductos] = useState<M66ProductoAutorizado[]>([])
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const fetch = useCallback(async () => {
    if (!orgId) return
    setLoading(true); setError(null)
    try {
      const { datos } = await leerConCache<M66ProductoAutorizado[]>(
        'm66_productos_autorizados',
        userId,
        orgId,
        async () => {
          const { data, error: err } = await (supabase as any)
            .from('m66_productos_autorizados')
            .select('*')
            .eq('org_id', orgId)
            .order('cultivo', { ascending: true })
            .order('nombre_comercial', { ascending: true })
          if (err) throw err
          return data ?? []
        },
      )
      setProductos(datos)
    } catch (e: any) {
      setError(e?.message ?? 'Error al cargar')
    } finally {
      setLoading(false)
    }
  }, [userId, orgId])

  useEffect(() => { fetch() }, [fetch])
  return { productos, loading, error, refetch: fetch }
}
