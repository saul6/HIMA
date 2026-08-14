import { useState, useEffect, useCallback } from 'react'
import { supabase } from '@/lib/supabase'
import { useAuthContext } from '@/context/AuthContext'

export interface M47Item {
  id: string
  tipo: 'documento' | 'capacitacion'
  nombre: string
  activo: boolean
  orden: number
}

export interface M47ChecklistRow {
  item_id: string
  valor: boolean
}

export interface M47Trabajador {
  id: string
  rancho_id: string
  rancho_nombre: string
  fecha: string
  puesto: string | null
  nombre: string
  celular: string | null
  telefono_casa: string | null
  direccion: string | null
  fecha_nacimiento: string | null
  emergencia_nombre: string | null
  emergencia_parentesco: string | null
  emergencia_telefono: string | null
  observaciones: string | null
  checklist: M47ChecklistRow[]
}

const tbl = (name: string) => (supabase as any).from(name)

export function useM47Trabajadores() {
  const { profile } = useAuthContext()
  const [trabajadores, setTrabajadores] = useState<M47Trabajador[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  const cargar = useCallback(async () => {
    if (!profile?.org_id) { setLoading(false); return }
    setLoading(true); setError(null)
    try {
      const { data, error: err } = await tbl('m47_trabajadores')
        .select('*, ranchos(nombre), m47_checklist(item_id, valor)')
        .eq('org_id', profile.org_id)
        .order('nombre')
      if (err) throw err
      setTrabajadores(((data ?? []) as any[]).map((r) => ({
        id: r.id,
        rancho_id: r.rancho_id,
        rancho_nombre: r.ranchos?.nombre ?? '—',
        fecha: r.fecha,
        puesto: r.puesto ?? null,
        nombre: r.nombre,
        celular: r.celular ?? null,
        telefono_casa: r.telefono_casa ?? null,
        direccion: r.direccion ?? null,
        fecha_nacimiento: r.fecha_nacimiento ?? null,
        emergencia_nombre: r.emergencia_nombre ?? null,
        emergencia_parentesco: r.emergencia_parentesco ?? null,
        emergencia_telefono: r.emergencia_telefono ?? null,
        observaciones: r.observaciones ?? null,
        checklist: ((r.m47_checklist ?? []) as any[]).map((c: any) => ({
          item_id: c.item_id as string,
          valor: c.valor as boolean,
        })),
      })))
    } catch (e: unknown) {
      setError(e instanceof Error ? e.message : 'Error al cargar trabajadores')
    } finally { setLoading(false) }
  }, [profile?.org_id])

  useEffect(() => { cargar() }, [cargar])
  return { trabajadores, loading, error, refetch: cargar }
}

export function useM47Items(ranchoId: string | null, orgId: string | null) {
  const [items, setItems] = useState<M47Item[]>([])
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const cargar = useCallback(async () => {
    if (!ranchoId || !orgId) { setItems([]); return }
    setLoading(true); setError(null)
    try {
      const { data, error: err } = await tbl('m47_items')
        .select('id, tipo, nombre, activo, orden')
        .eq('org_id', orgId)
        .eq('rancho_id', ranchoId)
        .order('tipo')
        .order('orden')
      if (err) throw err
      setItems(((data ?? []) as any[]).map((r) => ({
        id: r.id as string,
        tipo: r.tipo as 'documento' | 'capacitacion',
        nombre: r.nombre as string,
        activo: r.activo as boolean,
        orden: r.orden as number,
      })))
    } catch (e: unknown) {
      setError(e instanceof Error ? e.message : 'Error al cargar ítems M47')
    } finally { setLoading(false) }
  }, [ranchoId, orgId])

  useEffect(() => { cargar() }, [cargar])
  return { items, loading, error, refetch: cargar }
}
