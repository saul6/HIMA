import { useState, useEffect, useCallback } from 'react'
import { supabase } from '@/lib/supabase'
import { leerConCache } from '@/lib/offline/cacheLectura'

export interface M50CalibracionEquipo {
  id: string
  org_id: string
  rancho_id: string
  rancho_nombre: string
  fecha: string
  num_equipo: string
  velocidad_kmh: number | null
  presion_trabajo_bar: number | null
  boquilla: string
  gasto_boquilla_ml: number | null
  resultado: string | null
  realizo: string
  observaciones: string | null
  created_at: string
  creado_por: string | null
}

export function useM50CalibracionEquipos(userId: string | null, orgId: string | null) {
  const [registros, setRegistros] = useState<M50CalibracionEquipo[]>([])
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const fetch = useCallback(async () => {
    if (!userId || !orgId) return
    setLoading(true)
    setError(null)
    try {
      const resultado = await leerConCache(
        'm50_calibracion_equipos',
        userId,
        orgId,
        async () => {
          const { data, error: err } = await (supabase as any)
            .from('m50_calibracion_equipos')
            .select('*, ranchos(nombre)')
            .eq('org_id', orgId)
            .order('fecha', { ascending: false })
            .order('created_at', { ascending: false })
          if (err) throw err
          return data ?? []
        },
      )
      setRegistros(
        (resultado.datos as any[]).map((r: any) => ({
          ...r,
          rancho_nombre: r.ranchos?.nombre ?? '—',
        }))
      )
    } catch (e: unknown) {
      setError(e instanceof Error ? e.message : 'Error al cargar registros')
    } finally {
      setLoading(false)
    }
  }, [userId, orgId])

  useEffect(() => { fetch() }, [fetch])

  return { registros, loading, error, refetch: fetch }
}
