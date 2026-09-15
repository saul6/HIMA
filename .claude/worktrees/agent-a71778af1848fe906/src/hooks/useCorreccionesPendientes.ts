import { useState, useEffect, useCallback } from 'react'
import { supabase } from '@/lib/supabase'
import { useAuthContext } from '@/context/AuthContext'
import { MODULO_LABELS } from './useActividadEquipo'
import type { ActividadItem } from './useActividadEquipo'

const TABLAS = Object.keys(MODULO_LABELS)

function getFechaDisplay(row: any, tabla: string): string {
  if (tabla === 'm6_botiquin') return row.fecha_verificacion ?? row.created_at
  if (tabla === 'aplicaciones') return row.fecha_aplicacion ?? row.created_at
  return row.fecha ?? row.created_at
}

export function useCorreccionesPendientes() {
  const { profile } = useAuthContext()
  const [items, setItems] = useState<ActividadItem[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  const cargar = useCallback(async () => {
    if (!profile?.id || !profile?.org_id) {
      setLoading(false)
      return
    }
    setLoading(true)
    setError(null)
    try {
      const resultados = await Promise.all(
        TABLAS.map((tabla) =>
          (supabase
            .from(tabla as any)
            .select('*, ranchos(nombre)')
            .eq('org_id', profile.org_id!)
            .eq('creado_por', profile.id)
            .eq('requiere_correccion', true)
            .order('created_at', { ascending: false })) as any
        )
      )

      const todos: ActividadItem[] = []
      TABLAS.forEach((tabla, i) => {
        const result = resultados[i]
        if (result.error) {
          console.warn(`[correcciones] error en ${tabla}:`, result.error.message)
          return
        }
        ;(result.data ?? []).forEach((r: any) => {
          todos.push({
            id: r.id,
            tabla,
            moduloLabel: MODULO_LABELS[tabla] ?? tabla,
            rancho_id: r.rancho_id ?? null,
            rancho_nombre: r.ranchos?.nombre ?? '—',
            fecha: getFechaDisplay(r, tabla),
            creado_por: r.creado_por ?? null,
            creado_por_nombre: profile.nombre_completo,
            requiere_correccion: true,
            comentario_correccion: r.comentario_correccion ?? null,
            marcado_por: r.marcado_por ?? null,
            marcado_en: r.marcado_en ?? null,
            created_at: r.created_at,
          })
        })
      })

      todos.sort((a, b) => b.created_at.localeCompare(a.created_at))
      setItems(todos)
    } catch (e: unknown) {
      setError(e instanceof Error ? e.message : 'Error al cargar correcciones')
    } finally {
      setLoading(false)
    }
  }, [profile?.id, profile?.org_id, profile?.nombre_completo])

  useEffect(() => {
    cargar()
  }, [cargar])

  return { items, count: items.length, loading, error, refetch: cargar }
}
