import { useState, useEffect, useCallback } from 'react'
import { supabase } from '@/lib/supabase'
import { useAuthContext } from '@/context/AuthContext'
import { leerConCache } from '@/lib/offline/cacheLectura'

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

  const { user } = useAuthContext()
  const userId = user?.id ?? null

  const fetch = useCallback(async () => {
    if (!orgId || !userId) return
    setLoading(true)
    setError(null)
    try {
      const resultado = await leerConCache(
        'm70_verificacion_roedores',
        userId,
        orgId,
        async () => {
          const { data, error: err } = await (supabase as any)
            .from('m70_verificacion_roedores')
            .select('*, ranchos(nombre)')
            .eq('org_id', orgId)
            .order('fecha', { ascending: false })
            .order('created_at', { ascending: false })
          if (err) throw err
          return data ?? []
        },
      )
      setRegistros(
        (resultado.datos as any[]).map((r: any) => ({
          ...r,
          rancho_nombre: r.ranchos?.nombre ?? '—',
        }))
      )
    } catch (e: unknown) {
      setError((e as { message?: string })?.message ?? 'Error al cargar registros')
    } finally {
      setLoading(false)
    }
  }, [orgId, userId])

  useEffect(() => { fetch() }, [fetch])

  return { registros, loading, error, refetch: fetch }
}
