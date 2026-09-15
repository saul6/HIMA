import { useState, useEffect, useCallback } from 'react'
import { supabase } from '@/lib/supabase'
import { useAuthContext } from '@/context/AuthContext'

export interface DashboardResumen {
  formatos_hoy: number
  formatos_mes: number
  hallazgos_por_corregir: number
  cumplimiento_promedio: number | null
}

export function useDashboardResumen() {
  const { profile } = useAuthContext()
  const [resumen, setResumen] = useState<DashboardResumen | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  const cargar = useCallback(async () => {
    if (!profile?.org_id) {
      setLoading(false)
      return
    }
    setLoading(true)
    setError(null)
    try {
      const { data, error } = await supabase.rpc('get_dashboard_resumen')
      if (error) throw error
      // La RPC devuelve un arreglo de filas; tomamos el primer elemento
      setResumen((data as DashboardResumen[] | null)?.[0] ?? null)
    } catch (e: unknown) {
      setError(e instanceof Error ? e.message : 'Error al cargar el resumen')
    } finally {
      setLoading(false)
    }
  }, [profile?.org_id])

  useEffect(() => {
    cargar()
  }, [cargar])

  // Refetch al recuperar visibilidad (regreso de pestaña del navegador)
  useEffect(() => {
    function onVisible() {
      if (document.visibilityState === 'visible') cargar()
    }
    document.addEventListener('visibilitychange', onVisible)
    return () => document.removeEventListener('visibilitychange', onVisible)
  }, [cargar])

  return { resumen, loading, error, refetch: cargar }
}
