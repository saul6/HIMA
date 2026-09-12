import { useState, useEffect, useCallback } from 'react'
import { supabase } from '@/lib/supabase'

export interface M62Registro {
  id: string
  org_id: string
  rancho_id: string
  rancho_nombre: string
  fecha: string
  tipo_fuente: string | null
  realizo: string | null
  observaciones: string | null
  creado_por: string | null
  created_at: string
}

export interface M62Item {
  id: string
  numero: number
  descripcion: string
}

export function useM62FuentesAgua(orgId: string | null) {
  const [registros, setRegistros] = useState<M62Registro[]>([])
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const fetch = useCallback(async () => {
    if (!orgId) return
    setLoading(true)
    setError(null)
    const { data, error: err } = await (supabase as any)
      .from('m62_registro')
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

export function useM62Items() {
  const [items, setItems] = useState<M62Item[]>([])
  const [loading, setLoading] = useState(false)

  useEffect(() => {
    setLoading(true)
    ;(supabase as any)
      .from('m62_items_catalogo')
      .select('id, numero, descripcion')
      .order('numero', { ascending: true })
      .then(({ data }: { data: M62Item[] | null }) => {
        setItems(data ?? [])
        setLoading(false)
      })
  }, [])

  return { items, loading }
}
