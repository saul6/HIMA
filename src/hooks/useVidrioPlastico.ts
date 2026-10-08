// PATRÓN INOCUIDAD M7 — hook de datos
// Agrupa filas de m7_vidrio_plastico por rancho_id + fecha para formar inspecciones.
// M8-M12 replican esta estructura en src/hooks/use<Modulo>.ts.

import { useState, useEffect, useCallback } from 'react'
import { supabase } from '@/lib/supabase'
import { useAuthContext } from '@/context/AuthContext'
import { leerConCache } from '@/lib/offline/cacheLectura'

export interface M7FilaMaterial {
  id: string
  area: string
  material_equipo: string
  protegido: boolean
  estado: 'Bueno' | 'Deteriorado' | 'Reemplazo'
  observaciones: string | null
}

export interface M7Inspeccion {
  rancho_id: string
  rancho_nombre: string
  rancho_codigo: string
  fecha: string
  materiales: M7FilaMaterial[]
}

export function useVidrioPlastico() {
  const { profile } = useAuthContext()
  const [inspecciones, setInspecciones] = useState<M7Inspeccion[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  const cargar = useCallback(async () => {
    if (!profile?.id || !profile?.org_id) {
      setLoading(false)
      return
    }
    const userId = profile.id
    const orgId  = profile.org_id
    setLoading(true)
    setError(null)
    try {
      const resultado = await leerConCache(
        'm7_vidrio_plastico',
        userId,
        orgId,
        async () => {
          const { data, error: err } = await supabase
            .from('m7_vidrio_plastico')
            .select('*, ranchos(nombre, codigo)')
            .eq('org_id', orgId)
            .order('fecha', { ascending: false })
            .order('created_at', { ascending: true })
            .limit(500)
          if (err) throw err
          return data ?? []
        },
      )

      // Agrupar filas por rancho_id + fecha para formar inspecciones
      const grouped = new Map<string, M7Inspeccion>()
      for (const row of (resultado.datos as any[])) {
        const key = `${row.rancho_id}|${row.fecha}`
        if (!grouped.has(key)) {
          grouped.set(key, {
            rancho_id: row.rancho_id,
            rancho_nombre: row.ranchos?.nombre ?? '—',
            rancho_codigo: row.ranchos?.codigo ?? '—',
            fecha: row.fecha,
            materiales: [],
          })
        }
        grouped.get(key)!.materiales.push({
          id: row.id,
          area: row.area,
          material_equipo: row.material_equipo,
          protegido: row.protegido,
          estado: row.estado,
          observaciones: row.observaciones,
        })
      }
      setInspecciones(Array.from(grouped.values()))
    } catch (e: unknown) {
      setError(e instanceof Error ? e.message : 'Error al cargar registros')
    } finally {
      setLoading(false)
    }
  }, [profile?.id, profile?.org_id])

  useEffect(() => {
    cargar()
  }, [cargar])

  return { inspecciones, loading, error, refetch: cargar }
}
