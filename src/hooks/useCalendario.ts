import { useState, useEffect, useCallback } from 'react'
import { supabase } from '@/lib/supabase'

export interface EventoCalendario {
  source: string
  source_id: string
  event_type: string
  org_id: string | null
  title: string
  start_at: string
  end_at: string | null
  all_day: boolean
  estado: string | null
  auditoria_id: string | null
  instalacion_id: string | null
  route: string | null
}

export function useCalendario(desde: string, hasta: string, tipos?: string[]) {
  const [eventos, setEventos] = useState<EventoCalendario[]>([])
  const [cargando, setCargando] = useState(true)

  const cargar = useCallback(async () => {
    setCargando(true)
    try {
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      let q = (supabase as any).from('v_aud_calendario').select('*')
        .gte('start_at', desde)
        .lte('start_at', hasta)
        .order('start_at', { ascending: true })
      if (tipos && tipos.length) q = q.in('event_type', tipos)
      const { data, error } = await q
      if (error) throw error
      setEventos((data ?? []) as EventoCalendario[])
    } catch (e) {
      console.error('[useCalendario]', e)
    } finally {
      setCargando(false)
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [desde, hasta, JSON.stringify(tipos)])

  useEffect(() => { cargar() }, [cargar])

  return { eventos, cargando, recargar: cargar }
}
