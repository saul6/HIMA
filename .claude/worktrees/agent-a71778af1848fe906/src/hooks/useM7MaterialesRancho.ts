// PATRÓN INOCUIDAD M7 — catálogo de materiales por rancho
// Carga los materiales activos de m7_materiales_rancho para un rancho dado.

import { useState, useEffect, useCallback } from 'react'
import { supabase } from '@/lib/supabase'
import { useAuthContext } from '@/context/AuthContext'

export interface M7MaterialCatalogo {
  id: string
  rancho_id: string
  org_id: string
  area: string
  material: string
  activo: boolean
  created_at: string
}

export function useM7MaterialesRancho(ranchoId: string | null) {
  const { profile } = useAuthContext()
  const [materiales, setMateriales] = useState<M7MaterialCatalogo[]>([])
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const cargar = useCallback(async () => {
    if (!profile?.org_id || !ranchoId) {
      setMateriales([])
      return
    }
    setLoading(true)
    setError(null)
    try {
      const { data, error: err } = await supabase
        .from('m7_materiales_rancho')
        .select('*')
        .eq('org_id', profile.org_id)
        .eq('rancho_id', ranchoId)
        .eq('activo', true)
        .order('area')
        .order('material')
      if (err) throw err
      setMateriales(data ?? [])
    } catch (e: unknown) {
      setError(e instanceof Error ? e.message : 'Error al cargar catálogo')
    } finally {
      setLoading(false)
    }
  }, [profile?.org_id, ranchoId])

  useEffect(() => {
    cargar()
  }, [cargar])

  return { materiales, loading, error, refetch: cargar }
}
