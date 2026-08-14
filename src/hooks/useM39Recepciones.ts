import { useState, useEffect, useCallback } from 'react'
import { supabase } from '@/lib/supabase'
import { useAuthContext } from '@/context/AuthContext'

export interface M39RecepcionResumen {
  id: string
  rancho_id: string
  rancho_nombre: string
  fecha: string
  empresa: string | null
  hoja_no: string | null
  total_6oz: number
  total_12oz: number
  total_18oz: number
  total_cajas: number
  total_piezas: number
}

const tbl = (name: string) => (supabase as any).from(name)

export function useM39Recepciones() {
  const { profile } = useAuthContext()
  const [recepciones, setRecepciones] = useState<M39RecepcionResumen[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  const cargar = useCallback(async () => {
    if (!profile?.org_id) { setLoading(false); return }
    setLoading(true); setError(null)
    try {
      const { data, error: err } = await tbl('m39_recepciones')
        .select('id, rancho_id, fecha, empresa, hoja_no, ranchos(nombre), m39_lineas(cant_6oz, cant_12oz, cant_18oz, cajas, piezas)')
        .eq('org_id', profile.org_id)
        .order('fecha', { ascending: false })
        .order('created_at', { ascending: false })
      if (err) throw err
      setRecepciones(((data ?? []) as any[]).map((r) => {
        const lineas: any[] = r.m39_lineas ?? []
        const sum = (field: string) => lineas.reduce((s: number, l: any) => s + (l[field] ?? 0), 0)
        return {
          id: r.id,
          rancho_id: r.rancho_id,
          rancho_nombre: r.ranchos?.nombre ?? '—',
          fecha: r.fecha,
          empresa: r.empresa ?? null,
          hoja_no: r.hoja_no ?? null,
          total_6oz: sum('cant_6oz'),
          total_12oz: sum('cant_12oz'),
          total_18oz: sum('cant_18oz'),
          total_cajas: sum('cajas'),
          total_piezas: sum('piezas'),
        }
      }))
    } catch (e: unknown) {
      setError(e instanceof Error ? e.message : 'Error al cargar recepciones M39')
    } finally { setLoading(false) }
  }, [profile?.org_id])

  useEffect(() => { cargar() }, [cargar])
  return { recepciones, loading, error, refetch: cargar }
}
