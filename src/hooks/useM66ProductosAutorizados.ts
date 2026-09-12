import { useState, useEffect, useCallback } from 'react'
import { supabase } from '@/lib/supabase'

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

export function useM66ProductosAutorizados(orgId: string | null) {
  const [productos, setProductos] = useState<M66ProductoAutorizado[]>([])
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const fetch = useCallback(async () => {
    if (!orgId) return
    setLoading(true); setError(null)
    const { data, error: err } = await (supabase as any)
      .from('m66_productos_autorizados')
      .select('*')
      .eq('org_id', orgId)
      .order('cultivo', { ascending: true })
      .order('nombre_comercial', { ascending: true })
    if (err) { setError(err.message); setLoading(false); return }
    setProductos(data ?? [])
    setLoading(false)
  }, [orgId])

  useEffect(() => { fetch() }, [fetch])
  return { productos, loading, error, refetch: fetch }
}
