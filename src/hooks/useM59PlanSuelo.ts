import { useState, useEffect, useCallback } from 'react'
import { supabase } from '@/lib/supabase'

export interface M59Registro {
  id: string
  org_id: string
  rancho_id: string
  rancho_nombre: string
  fecha: string
  realizo: string | null
  observaciones: string | null
  creado_por: string | null
  created_at: string
}

export interface M59Item {
  id: string
  numero: number
  descripcion: string
}

export function useM59PlanSuelo(orgId: string | null) {
  const [registros, setRegistros] = useState<M59Registro[]>([])
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const fetch = useCallback(async () => {
    if (!orgId) return
    setLoading(true)
    setError(null)
    const { data, error: err } = await (supabase as any)
      .from('m59_registro')
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

export function useM59Items() {
  const [items, setItems] = useState<M59Item[]>([])
  const [loading, setLoading] = useState(false)

  useEffect(() => {
    setLoading(true)
    ;(supabase as any)
      .from('m59_items_catalogo')
      .select('id, numero, descripcion')
      .eq('activo', true)
      .order('numero', { ascending: true })
      .then(({ data }: { data: M59Item[] | null }) => {
        setItems(data ?? [])
        setLoading(false)
      })
  }, [])

  return { items, loading }
}
