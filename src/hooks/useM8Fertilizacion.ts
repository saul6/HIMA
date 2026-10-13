// PATRÓN INOCUIDAD M8 — hook de datos
// Una fila por fertilizante en BD; agrupa por rancho_id+fecha para formar un registro de jornada.

import { useState, useEffect, useCallback } from 'react'
import { supabase } from '@/lib/supabase'
import { useAuthContext } from '@/context/AuthContext'
import { leerConCache } from '@/lib/offline/cacheLectura'

export interface M8FilaFertilizante {
  id: string
  nombre_comercial: string
  ingrediente_activo: string | null
  concentracion: string | null
  metodo: string
  superficie_ha: number
  dosis_kg_l_ha: number
  cantidad_total: number
}

export interface M8Registro {
  rancho_id: string
  rancho_nombre: string
  rancho_codigo: string
  fecha: string
  sector: string | null
  fertilizantes: M8FilaFertilizante[]
}

export function useM8Fertilizacion() {
  const { profile, user } = useAuthContext()
  const userId = user?.id ?? null
  const [registros, setRegistros] = useState<M8Registro[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  const cargar = useCallback(async () => {
    if (!profile?.org_id || !userId) { setLoading(false); return }
    const orgId = profile.org_id
    setLoading(true)
    setError(null)
    try {
      const resultado = await leerConCache('m8_registros', userId, orgId, async () => {
        const { data, error: err } = await supabase
          .from('m8_fertilizacion')
          .select('*, ranchos(nombre, codigo)')
          .eq('org_id', orgId)
          .order('fecha', { ascending: false })
          .order('created_at', { ascending: true })
          .limit(500)
        if (err) throw err
        return data ?? []
      })
      const data = resultado.datos

      const grouped = new Map<string, M8Registro>()
      for (const row of (data ?? [])) {
        const key = `${row.rancho_id}|${row.fecha}`
        if (!grouped.has(key)) {
          grouped.set(key, {
            rancho_id: row.rancho_id,
            rancho_nombre: (row.ranchos as any)?.nombre ?? '—',
            rancho_codigo: (row.ranchos as any)?.codigo ?? '—',
            fecha: row.fecha,
            sector: row.sector,
            fertilizantes: [],
          })
        }
        grouped.get(key)!.fertilizantes.push({
          id: row.id,
          nombre_comercial: row.nombre_comercial,
          ingrediente_activo: row.ingrediente_activo,
          concentracion: row.concentracion,
          metodo: row.metodo,
          superficie_ha: row.superficie_ha,
          dosis_kg_l_ha: row.dosis_kg_l_ha,
          cantidad_total: row.cantidad_total,
        })
      }
      setRegistros(Array.from(grouped.values()))
    } catch (e: unknown) {
      setError((e as { message?: string })?.message ?? 'Error al cargar registros')
    } finally {
      setLoading(false)
    }
  }, [profile?.org_id, userId])

  useEffect(() => { cargar() }, [cargar])
  return { registros, loading, error, refetch: cargar }
}
