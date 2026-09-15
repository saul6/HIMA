import { useState, useEffect, useCallback } from 'react'
import { supabase } from '@/lib/supabase'
import { useAuthContext } from '@/context/AuthContext'

export interface M42MovimientoResumen {
  id: string
  rancho_id: string
  rancho_nombre: string
  fecha: string
  empresa: string | null
  descripcion_material: string | null
  entrada: number | null
  salida: number | null
  total: number | null
  mat_libre_plagas: boolean
  tr_libre_plagas: boolean
  incidencia_id: string | null
}

const tbl = (name: string) => (supabase as any).from(name)

export function useM42Movimientos() {
  const { profile } = useAuthContext()
  const [movimientos, setMovimientos] = useState<M42MovimientoResumen[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  const cargar = useCallback(async () => {
    if (!profile?.org_id) { setLoading(false); return }
    setLoading(true); setError(null)
    try {
      const { data, error: err } = await tbl('m42_movimientos')
        .select('id, rancho_id, fecha, empresa, descripcion_material, entrada, salida, total, mat_libre_plagas, tr_libre_plagas, incidencia_id, ranchos(nombre)')
        .eq('org_id', profile.org_id)
        .order('fecha', { ascending: false })
        .order('created_at', { ascending: false })
      if (err) throw err
      setMovimientos(((data ?? []) as any[]).map((r) => ({
        id: r.id,
        rancho_id: r.rancho_id,
        rancho_nombre: r.ranchos?.nombre ?? '—',
        fecha: r.fecha,
        empresa: r.empresa ?? null,
        descripcion_material: r.descripcion_material ?? null,
        entrada: r.entrada ?? null,
        salida: r.salida ?? null,
        total: r.total ?? null,
        mat_libre_plagas: r.mat_libre_plagas ?? true,
        tr_libre_plagas: r.tr_libre_plagas ?? true,
        incidencia_id: r.incidencia_id ?? null,
      })))
    } catch (e: unknown) {
      setError(e instanceof Error ? e.message : 'Error al cargar movimientos M42')
    } finally { setLoading(false) }
  }, [profile?.org_id])

  useEffect(() => { cargar() }, [cargar])
  return { movimientos, loading, error, refetch: cargar }
}
