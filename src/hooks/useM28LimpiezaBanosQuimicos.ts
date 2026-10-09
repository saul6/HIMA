import { useState, useEffect, useCallback } from 'react'
import { supabase } from '@/lib/supabase'
import { useAuthContext } from '@/context/AuthContext'
import { leerConCache } from '@/lib/offline/cacheLectura'

export type ValorM28 = 'hecho' | 'no_hecho' | 'na'

export interface M28RegistroResumen {
  id: string
  rancho_id: string
  rancho_nombre: string
  anio: number
  mes: number
  observaciones: string | null
}

export interface M28Item {
  id: string
  nombre: string
  frecuencia: string
  activo: boolean
  orden: number
}

export interface M28DiaData {
  id?: string
  dia: number
  concentracion_cloro: number | null
  ajuste_cloro: string | null
  concentracion_acido: number | null
  ajuste_acido: string | null
  realizo: string | null
  aprobo: string | null
}

const tbl = (name: string) => (supabase as any).from(name)

export function useM28LimpiezaBanosQuimicos() {
  const { profile, user } = useAuthContext()
  const [registros, setRegistros] = useState<M28RegistroResumen[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  const cargar = useCallback(async () => {
    if (!profile?.org_id) { setLoading(false); return }
    setLoading(true); setError(null)
    try {
      const resultado = await leerConCache('m28_registros', user?.id ?? '', profile.org_id, async () => {
        const { data, error: err } = await tbl('m28_registro_mensual')
          .select('*, ranchos(nombre)')
          .eq('org_id', profile.org_id)
          .order('anio', { ascending: false })
          .order('mes', { ascending: false })
        if (err) throw err
        return data ?? []
      })
      setRegistros(((resultado.datos ?? []) as any[]).map((r) => ({
        id: r.id,
        rancho_id: r.rancho_id,
        rancho_nombre: r.ranchos?.nombre ?? '—',
        anio: r.anio as number,
        mes: r.mes as number,
        observaciones: r.observaciones ?? null,
      })))
    } catch (e: unknown) {
      setError(e instanceof Error ? e.message : 'Error al cargar registros M28')
    } finally { setLoading(false) }
  }, [profile?.org_id, user?.id])

  useEffect(() => { cargar() }, [cargar])
  return { registros, loading, error, refetch: cargar }
}

export function useM28Items(ranchoId: string | null, orgId: string | null) {
  const { user } = useAuthContext()
  const [items, setItems] = useState<M28Item[]>([])
  const [loading, setLoading] = useState(false)

  const cargar = useCallback(async () => {
    if (!ranchoId || !orgId || !user?.id) { setItems([]); return }
    setLoading(true)
    try {
      const resultado = await leerConCache(`m28_items_${ranchoId}`, user.id, orgId, async () => {
        const { data } = await tbl('m28_items')
          .select('id, nombre, frecuencia, activo, orden')
          .eq('org_id', orgId)
          .eq('rancho_id', ranchoId)
          .order('orden')
        return data ?? []
      })
      setItems((resultado.datos ?? []) as M28Item[])
    } catch {
      setItems([])
    } finally {
      setLoading(false)
    }
  }, [ranchoId, orgId, user?.id])

  useEffect(() => { cargar() }, [cargar])
  return { items, loading, refetch: cargar }
}
