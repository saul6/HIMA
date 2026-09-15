import { useState, useEffect, useCallback } from 'react'
import { supabase } from '@/lib/supabase'
import { useAuthContext } from '@/context/AuthContext'

export interface M27Preparacion {
  id: string
  rancho_id: string
  rancho_nombre: string
  fecha: string
  area: string
  litros_agua: number
  ml_cloro: number
  responsable: string | null
  observaciones: string | null
}

export function useM27PreparacionCloro() {
  const { profile } = useAuthContext()
  const [preparaciones, setPreparaciones] = useState<M27Preparacion[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  const cargar = useCallback(async () => {
    if (!profile?.org_id) { setLoading(false); return }
    setLoading(true)
    setError(null)
    try {
      const { data, error: err } = await (supabase as any)
        .from('m27_preparaciones')
        .select('*, ranchos(nombre)')
        .eq('org_id', profile.org_id)
        .order('fecha', { ascending: false })
        .order('created_at', { ascending: false })
        .limit(500)
      if (err) throw err
      setPreparaciones(
        (data ?? []).map((r: any) => ({
          id: r.id,
          rancho_id: r.rancho_id,
          rancho_nombre: r.ranchos?.nombre ?? '—',
          fecha: r.fecha,
          area: r.area,
          litros_agua: r.litros_agua,
          ml_cloro: r.ml_cloro,
          responsable: r.responsable ?? null,
          observaciones: r.observaciones ?? null,
        }))
      )
    } catch (e: unknown) {
      setError(e instanceof Error ? e.message : 'Error al cargar registros')
    } finally {
      setLoading(false)
    }
  }, [profile?.org_id])

  useEffect(() => { cargar() }, [cargar])

  return { preparaciones, loading, error, refetch: cargar }
}
