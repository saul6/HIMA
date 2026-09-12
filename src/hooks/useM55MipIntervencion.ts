import { useState, useEffect, useCallback } from 'react'
import { supabase } from '@/lib/supabase'

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

  const fetch = useCallback(async () => {
    if (!orgId) return
    setLoading(true)
    setError(null)
    const { data, error: err } = await (supabase as any)
      .from('m55_registro')
      .select('*, ranchos(nombre)')
      .eq('org_id', orgId)
      .order('fecha', { ascending: false })
      .order('created_at', { ascending: false })
    if (err) { setError(err.message); setLoading(false); return }
    setRegistros(
      (data ?? []).map((r: any) => ({
        ...r,
        rancho_nombre: r.ranchos?.nombre ?? '—',
      }))
    )
    setLoading(false)
  }, [orgId])

  useEffect(() => { fetch() }, [fetch])

  return { registros, loading, error, refetch: fetch }
}

export function useM55Items() {
  const [items, setItems] = useState<M55Item[]>([])
  const [loading, setLoading] = useState(false)

  useEffect(() => {
    setLoading(true)
    ;(supabase as any)
      .from('m55_items_catalogo')
      .select('id, numero, texto')
      .eq('activo', true)
      .order('numero', { ascending: true })
      .then(({ data }: { data: M55Item[] | null }) => {
        setItems(data ?? [])
        setLoading(false)
      })
  }, [])

  return { items, loading }
}
