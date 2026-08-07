import { useState, useEffect, useCallback } from 'react'
import { supabase } from '@/lib/supabase'
import { useAuthContext } from '@/context/AuthContext'

export interface M41RegistroResumen {
  id: string
  rancho_id: string
  rancho_nombre: string
  fecha: string
  temp_min: number | null
  temp_max: number | null
  lecturas_count: number
  fuera_de_rango: boolean
}

const tbl = (name: string) => (supabase as any).from(name)

export function useM41TemperaturaConservador() {
  const { profile } = useAuthContext()
  const [registros, setRegistros] = useState<M41RegistroResumen[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  const cargar = useCallback(async () => {
    if (!profile?.org_id) { setLoading(false); return }
    setLoading(true); setError(null)
    try {
      const { data, error: err } = await tbl('m41_registros')
        .select('id, rancho_id, fecha, temp_min, temp_max, ranchos(nombre), m41_lecturas(temperatura, incidencia_id)')
        .eq('org_id', profile.org_id)
        .order('fecha', { ascending: false })
        .order('created_at', { ascending: false })
      if (err) throw err
      setRegistros(((data ?? []) as any[]).map((r) => {
        const lecturas: any[] = r.m41_lecturas ?? []
        return {
          id: r.id,
          rancho_id: r.rancho_id,
          rancho_nombre: r.ranchos?.nombre ?? '—',
          fecha: r.fecha,
          temp_min: r.temp_min ?? null,
          temp_max: r.temp_max ?? null,
          lecturas_count: lecturas.filter(l => l.temperatura != null).length,
          fuera_de_rango: lecturas.some(l => l.incidencia_id != null),
        }
      }))
    } catch (e: unknown) {
      setError(e instanceof Error ? e.message : 'Error al cargar registros M41')
    } finally { setLoading(false) }
  }, [profile?.org_id])

  useEffect(() => { cargar() }, [cargar])
  return { registros, loading, error, refetch: cargar }
}
