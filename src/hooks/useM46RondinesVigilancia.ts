import { useState, useEffect, useCallback } from 'react'
import { supabase } from '@/lib/supabase'
import { useAuthContext } from '@/context/AuthContext'

export type ValorM46 = 'sin_novedad' | 'con_novedad'

export interface M46RondinResumen {
  id: string
  rancho_id: string
  rancho_nombre: string
  fecha: string
  turno: string | null
  vigilante: string
  jefe_seguridad: string | null
  observaciones: string | null
  num_novedades: number
}

export interface M46Item {
  id: string
  area: string
  nombre: string
  activo: boolean
  orden: number
}

const tbl = (name: string) => (supabase as any).from(name)

export function useM46Rondines() {
  const { profile } = useAuthContext()
  const [rondines, setRondines] = useState<M46RondinResumen[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  const cargar = useCallback(async () => {
    if (!profile?.org_id) { setLoading(false); return }
    setLoading(true); setError(null)
    try {
      const { data, error: err } = await tbl('m46_rondines')
        .select('*, ranchos(nombre), m46_resultados(valor)')
        .eq('org_id', profile.org_id)
        .order('fecha', { ascending: false })
        .order('created_at', { ascending: false })
      if (err) throw err
      setRondines(((data ?? []) as any[]).map((r) => ({
        id: r.id,
        rancho_id: r.rancho_id,
        rancho_nombre: r.ranchos?.nombre ?? '—',
        fecha: r.fecha as string,
        turno: r.turno ?? null,
        vigilante: r.vigilante ?? '—',
        jefe_seguridad: r.jefe_seguridad ?? null,
        observaciones: r.observaciones ?? null,
        num_novedades: ((r.m46_resultados ?? []) as any[]).filter(
          (x: any) => x.valor === 'con_novedad'
        ).length,
      })))
    } catch (e: unknown) {
      setError(e instanceof Error ? e.message : 'Error al cargar rondines')
    } finally { setLoading(false) }
  }, [profile?.org_id])

  useEffect(() => { cargar() }, [cargar])
  return { rondines, loading, error, refetch: cargar }
}

export function useM46Items(ranchoId: string | null, orgId: string | null) {
  const [items, setItems] = useState<M46Item[]>([])
  const [loading, setLoading] = useState(false)

  const cargar = useCallback(async () => {
    if (!ranchoId || !orgId) { setItems([]); return }
    setLoading(true)
    const { data } = await tbl('m46_items')
      .select('id, area, nombre, activo, orden')
      .eq('org_id', orgId)
      .eq('rancho_id', ranchoId)
      .order('orden')
    setItems((data ?? []) as M46Item[])
    setLoading(false)
  }, [ranchoId, orgId])

  useEffect(() => { cargar() }, [cargar])
  return { items, loading, refetch: cargar }
}
