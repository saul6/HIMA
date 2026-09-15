// PATRÓN INOCUIDAD M12 — hook de datos
// Agrupa filas de m12_limpieza_banos por rancho_id + fecha para formar jornadas.

import { useState, useEffect, useCallback } from 'react'
import { supabase } from '@/lib/supabase'
import { useAuthContext } from '@/context/AuthContext'

export interface M12FilaBano {
  id: string
  bano_numero: string
  limpieza: boolean
  desinfeccion: boolean
  concentracion_ppm: number
  sustancias: string[]
  abasto_papel: boolean
  succion: boolean
}

export interface M12Jornada {
  rancho_id: string
  rancho_nombre: string
  rancho_codigo: string
  fecha: string
  realizado_por_id: string | null
  banos: M12FilaBano[]
}

export function useM12LimpiezaBanos() {
  const { profile } = useAuthContext()
  const [jornadas, setJornadas] = useState<M12Jornada[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  const cargar = useCallback(async () => {
    if (!profile?.org_id) { setLoading(false); return }
    setLoading(true)
    setError(null)
    try {
      const { data, error: err } = await supabase
        .from('m12_limpieza_banos')
        .select('*, ranchos(nombre, codigo)')
        .eq('org_id', profile.org_id)
        .order('fecha', { ascending: false })
        .order('created_at', { ascending: true })
        .limit(500)
      if (err) throw err

      // Agrupar filas por rancho_id + fecha para formar jornadas
      const grouped = new Map<string, M12Jornada>()
      for (const row of (data ?? [])) {
        const key = `${row.rancho_id}|${row.fecha}`
        if (!grouped.has(key)) {
          grouped.set(key, {
            rancho_id: row.rancho_id,
            rancho_nombre: (row as any).ranchos?.nombre ?? '—',
            rancho_codigo: (row as any).ranchos?.codigo ?? '—',
            fecha: row.fecha,
            realizado_por_id: row.realizado_por_id,
            banos: [],
          })
        }
        grouped.get(key)!.banos.push({
          id: row.id,
          bano_numero: row.bano_numero,
          limpieza: row.limpieza,
          desinfeccion: row.desinfeccion,
          concentracion_ppm: row.concentracion_ppm,
          sustancias: row.sustancias ?? [],
          abasto_papel: row.abasto_papel,
          succion: row.succion,
        })
      }
      setJornadas(Array.from(grouped.values()))
    } catch (e: unknown) {
      setError(e instanceof Error ? e.message : 'Error al cargar registros M12')
    } finally {
      setLoading(false)
    }
  }, [profile?.org_id])

  useEffect(() => { cargar() }, [cargar])

  return { jornadas, loading, error, refetch: cargar }
}
