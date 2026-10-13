import { useState, useEffect, useCallback } from 'react'
import { supabase } from '@/lib/supabase'
import { useAuthContext } from '@/context/AuthContext'
import { leerConCache } from '@/lib/offline/cacheLectura'

export interface M55Registro {
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

export interface M55Item {
  id: string
  numero: number
  texto: string
}

export function useM55MipIntervencion(orgId: string | null) {
  const [registros, setRegistros] = useState<M55Registro[]>([])
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
        'm55_registro',
        userId,
        orgId,
        async () => {
          const { data, error: err } = await (supabase as any)
            .from('m55_registro')
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

export function useM55Items() {
  const { user, profile } = useAuthContext()
  const userId = user?.id ?? null
  const orgId = profile?.org_id ?? null
  const [items, setItems] = useState<M55Item[]>([])
  const [loading, setLoading] = useState(false)

  useEffect(() => {
    if (!userId || !orgId) return
    setLoading(true)
    leerConCache(
      'm55_items_catalogo',
      userId,
      orgId,
      async () => {
        const { data, error } = await (supabase as any)
          .from('m55_items_catalogo')
          .select('id, numero, texto')
          .eq('activo', true)
          .order('numero', { ascending: true })
        if (error) throw error
        return (data ?? []) as M55Item[]
      },
    )
      .then((r) => setItems(r.datos))
      .catch(() => setItems([]))
      .finally(() => setLoading(false))
  }, [userId, orgId])

  return { items, loading }
}
