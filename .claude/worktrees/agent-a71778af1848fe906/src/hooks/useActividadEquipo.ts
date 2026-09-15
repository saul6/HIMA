import { useState, useEffect, useCallback } from 'react'
import { supabase } from '@/lib/supabase'
import { useAuthContext } from '@/context/AuthContext'

export interface ActividadItem {
  id: string
  tabla: string
  moduloLabel: string
  rancho_id: string | null
  rancho_nombre: string
  fecha: string
  creado_por: string | null
  creado_por_nombre: string
  requiere_correccion: boolean
  comentario_correccion: string | null
  marcado_por: string | null
  marcado_en: string | null
  created_at: string
}

export interface EmpleadoBasico {
  id: string
  nombre_completo: string
}

export const MODULO_LABELS: Record<string, string> = {
  aplicaciones: 'Aplicación Foliar',
  m6_botiquin: 'Botiquín',
  m7_vidrio_plastico: 'Vidrio y Plástico',
  m8_fertilizacion: 'Fertilización',
  m10_cosecha_liberacion: 'Cosecha y Liberación',
  m12_limpieza_banos: 'Limpieza de Baños',
}

const TABLAS = Object.keys(MODULO_LABELS)

const BASE_SELECT = '*, ranchos(nombre), creador:profiles!creado_por(nombre_completo)'

function getFechaDisplay(row: any, tabla: string): string {
  if (tabla === 'm6_botiquin') return row.fecha_verificacion ?? row.created_at
  if (tabla === 'aplicaciones') return row.fecha_aplicacion ?? row.created_at
  return row.fecha ?? row.created_at
}

function normalizarFila(row: any, tabla: string): ActividadItem {
  return {
    id: row.id,
    tabla,
    moduloLabel: MODULO_LABELS[tabla] ?? tabla,
    rancho_id: row.rancho_id ?? null,
    rancho_nombre: row.ranchos?.nombre ?? '—',
    fecha: getFechaDisplay(row, tabla),
    creado_por: row.creado_por ?? null,
    creado_por_nombre: row.creador?.nombre_completo ?? '—',
    requiere_correccion: row.requiere_correccion ?? false,
    comentario_correccion: row.comentario_correccion ?? null,
    marcado_por: row.marcado_por ?? null,
    marcado_en: row.marcado_en ?? null,
    created_at: row.created_at,
  }
}

export function useActividadEquipo() {
  const { profile } = useAuthContext()
  const [items, setItems] = useState<ActividadItem[]>([])
  const [empleados, setEmpleados] = useState<EmpleadoBasico[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  const cargar = useCallback(async () => {
    if (!profile?.org_id || profile.rol !== 'admin_org') {
      setLoading(false)
      return
    }
    setLoading(true)
    setError(null)
    try {
      const [empResult, ...tablaResults] = await Promise.all([
        supabase
          .from('profiles')
          .select('id, nombre_completo')
          .eq('org_id', profile.org_id)
          .eq('activo', true),
        ...TABLAS.map((tabla) =>
          (supabase
            .from(tabla as any)
            .select(BASE_SELECT)
            .eq('org_id', profile.org_id!)
            .order('created_at', { ascending: false })
            .limit(50)) as any
        ),
      ])

      if (empResult.error) throw empResult.error
      setEmpleados(empResult.data ?? [])

      const todos: ActividadItem[] = []
      TABLAS.forEach((tabla, i) => {
        const result = tablaResults[i]
        if (result.error) {
          console.warn(`[actividad] error en ${tabla}:`, result.error.message)
          return
        }
        ;(result.data ?? []).forEach((row: any) => {
          todos.push(normalizarFila(row, tabla))
        })
      })

      todos.sort((a, b) => b.created_at.localeCompare(a.created_at))
      setItems(todos)
    } catch (e: unknown) {
      setError(e instanceof Error ? e.message : 'Error al cargar actividad del equipo')
    } finally {
      setLoading(false)
    }
  }, [profile?.org_id, profile?.rol])

  useEffect(() => {
    cargar()
  }, [cargar])

  return { items, empleados, loading, error, refetch: cargar }
}
