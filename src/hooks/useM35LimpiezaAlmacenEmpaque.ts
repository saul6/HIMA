import { useState, useEffect, useCallback } from 'react'
import { supabase } from '@/lib/supabase'
import { useAuthContext } from '@/context/AuthContext'

export type ValorM35 = 'hecho' | 'no_hecho' | 'na'

export interface M35RegistroResumen {
  id: string
  rancho_id: string
  rancho_nombre: string
  anio: number
  mes: number
  area: string
  observaciones: string | null
}

export interface M35Item {
  id: string
  nombre: string
  frecuencia: string
  genera_incidencia: boolean
  activo: boolean
  orden: number
}

const tbl = (name: string) => (supabase as any).from(name)

export function useM35LimpiezaAlmacenEmpaque() {
  const { profile } = useAuthContext()
  const [registros, setRegistros] = useState<M35RegistroResumen[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  const cargar = useCallback(async () => {
    if (!profile?.org_id) { setLoading(false); return }
    setLoading(true); setError(null)
    try {
      const { data, error: err } = await tbl('m35_registro_mensual')
        .select('*, ranchos(nombre)')
        .eq('org_id', profile.org_id)
        .order('anio', { ascending: false })
        .order('mes', { ascending: false })
      if (err) throw err
      setRegistros(((data ?? []) as any[]).map((r) => ({
        id: r.id,
        rancho_id: r.rancho_id,
        rancho_nombre: r.ranchos?.nombre ?? '—',
        anio: r.anio as number,
        mes: r.mes as number,
        area: r.area ?? 'Almacén de material de empaque',
        observaciones: r.observaciones ?? null,
      })))
    } catch (e: unknown) {
      setError(e instanceof Error ? e.message : 'Error al cargar registros M35')
    } finally { setLoading(false) }
  }, [profile?.org_id])

  useEffect(() => { cargar() }, [cargar])
  return { registros, loading, error, refetch: cargar }
}

export function useM35Items(ranchoId: string | null, orgId: string | null) {
  const [items, setItems] = useState<M35Item[]>([])
  const [loading, setLoading] = useState(false)

  const cargar = useCallback(async () => {
    if (!ranchoId || !orgId) { setItems([]); return }
    setLoading(true)
    const { data } = await tbl('m35_items')
      .select('id, nombre, frecuencia, genera_incidencia, activo, orden')
      .eq('org_id', orgId)
      .eq('rancho_id', ranchoId)
      .order('orden')
    setItems((data ?? []) as M35Item[])
    setLoading(false)
  }, [ranchoId, orgId])

  useEffect(() => { cargar() }, [cargar])
  return { items, loading, refetch: cargar }
}
