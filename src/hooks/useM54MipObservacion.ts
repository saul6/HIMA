import { useState, useEffect, useCallback } from 'react'
import { supabase } from '@/lib/supabase'
import { useAuthContext } from '@/context/AuthContext'
import { leerConCache } from '@/lib/offline/cacheLectura'

export interface M54Registro {
  id: string
  org_id: string
  rancho_id: string
  rancho_nombre: string
  fecha: string
  producto: string | null
  region: string | null
  realizo: string | null
  observaciones: string | null
  creado_por: string | null
  created_at: string
}

export interface M54Item {
  id: string
  numero: number
  texto: string
}

export function useM54MipObservacion(orgId: string | null) {
  const [registros, setRegistros] = useState<M54Registro[]>([])
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
        'm54_registro',
        userId,
        orgId,
        async () => {
          const { data, error: err } = await (supabase as any)
            .from('m54_registro')
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

export function useM54Items() {
  const { user, profile } = useAuthContext()
  const userId = user?.id ?? null
  const orgId = profile?.org_id ?? null
  const [items, setItems] = useState<M54Item[]>([])
  const [loading, setLoading] = useState(false)

  useEffect(() => {
    if (!userId || !orgId) return
    setLoading(true)
    leerConCache(
      'm54_items_catalogo',
      userId,
      orgId,
      async () => {
        const { data, error } = await (supabase as any)
          .from('m54_items_catalogo')
          .select('id, numero, texto')
          .eq('activo', true)
          .order('numero', { ascending: true })
        if (error) throw error
        return (data ?? []) as M54Item[]
      },
    )
      .then((r) => setItems(r.datos))
      .catch(() => setItems([]))
      .finally(() => setLoading(false))
  }, [userId, orgId])

  return { items, loading }
}
