import { useEffect, useState } from 'react'
import { supabase } from '@/lib/supabase'
import { useAuthContext } from '@/context/AuthContext'

export interface PendientesEquipo {
  es_encargado: boolean
  dias: number
  resumen: {
    por_corregir: number
    sin_verificar: number
    sin_firma: number
    tareas_atrasadas: number
  }
}

/**
 * Pendientes de los operarios del encargado (equipo_pendientes). Solo se consulta
 * para el rol encargado; si la organización no limita por equipo, `es_encargado` es false.
 */
export function useEquipoPendientes() {
  const { profile } = useAuthContext()
  const [datos, setDatos] = useState<PendientesEquipo | null>(null)
  const habilitado = profile?.rol === 'asesor_tecnico' && !!profile?.org_id

  useEffect(() => {
    if (!habilitado) return
    let cancelado = false
    ;(supabase as any)
      .rpc('equipo_pendientes')
      .then(({ data, error }: { data: PendientesEquipo | null; error: unknown }) => {
        if (!cancelado && !error && data?.es_encargado) setDatos(data)
      })
      .catch(() => {})
    return () => {
      cancelado = true
    }
  }, [habilitado, profile?.id])

  return { datos: habilitado ? datos : null }
}
