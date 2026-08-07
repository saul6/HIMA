import { useEffect, useState, useCallback } from 'react'
import { supabase } from '@/lib/supabase'
import { useAuthContext } from '@/context/AuthContext'

export type ValorM45 = 'hecho' | 'no_hecho' | 'na'

export interface M45Item {
  id: string
  area: string
  nombre: string
  frecuencia: 'diario' | 'tercer_dia' | 'semanal' | 'quincenal' | null
  orden: number
}

export interface M45RegistroMensual {
  id: string
  org_id: string
  rancho_id: string
  rancho_nombre: string
  rancho_codigo: string
  anio: number
  mes: number
  observaciones: string | null
}

export function useM45MttoPreventivo() {
  const { profile } = useAuthContext()
  const [registros, setRegistros] = useState<M45RegistroMensual[]>([])
  const [loading, setLoading]     = useState(true)
  const [error, setError]         = useState(false)

  const fetchRegistros = useCallback(async () => {
    if (!profile?.org_id) return
    setLoading(true)
    setError(false)
    try {
      const tbl = supabase as any
      const { data, error: err } = await tbl
        .from('m45_registro_mensual')
        .select('id, org_id, rancho_id, anio, mes, observaciones, ranchos(nombre, codigo)')
        .eq('org_id', profile.org_id)
        .order('anio', { ascending: false })
        .order('mes',  { ascending: false })
      if (err) throw err

      const items: M45RegistroMensual[] = ((data ?? []) as any[]).map((r: any) => ({
        id:            r.id,
        org_id:        r.org_id,
        rancho_id:     r.rancho_id,
        rancho_nombre: (r.ranchos as any)?.nombre ?? '—',
        rancho_codigo: (r.ranchos as any)?.codigo ?? '—',
        anio:          r.anio as number,
        mes:           r.mes as number,
        observaciones: r.observaciones ?? null,
      }))
      setRegistros(items)
    } catch {
      setError(true)
    } finally {
      setLoading(false)
    }
  }, [profile?.org_id])

  useEffect(() => { fetchRegistros() }, [fetchRegistros])

  return { registros, loading, error, refetch: fetchRegistros }
}
