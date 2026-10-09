import { useState, useEffect, useCallback } from 'react'
import { supabase } from '@/lib/supabase'
import { leerConCache } from '@/lib/offline/cacheLectura'

export interface M61Registro {
  id: string
  org_id: string
  rancho_id: string
  rancho_nombre: string
  fecha: string
  fuente_residuo: string
  descripcion: string | null
  clasificacion: string | null
  destino_final: string | null
  cantidad: string | null
  realizo: string | null
  observaciones: string | null
  creado_por: string | null
  created_at: string
}

export function useM61GestionResiduos(userId: string | null, orgId: string | null) {
  const [registros, setRegistros] = useState<M61Registro[]>([])
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const fetch = useCallback(async () => {
    if (!orgId) return
    setLoading(true)
    setError(null)
    try {
      const { datos } = await leerConCache<M61Registro[]>(
        'm61_gestion_residuos',
        userId,
        orgId,
        async () => {
          const { data, error: err } = await (supabase as any)
            .from('m61_gestion_residuos')
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
