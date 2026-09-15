import { useState, useCallback, useEffect } from 'react'
import { supabase } from '@/lib/supabase'
import { useAuthContext } from '@/context/AuthContext'

export interface M21ResultadoDetalle {
  id: string
  estacion_id: string
  estacion_numero: string
  tipo_trampa: string
  tipo_consumo: string | null
  estado_trampa: string | null
  condiciones: string | null
  senalizacion: string | null
  estado_equipo: string | null
  estado_lampara: string | null
  plaga_detectada: string[]
  incidencia_id: string | null
}

export interface M21RevisionConResultados {
  id: string
  rancho_id: string
  rancho_nombre: string
  rancho_codigo: string
  fecha: string
  inspector_nombre: string | null
  observaciones: string | null
  resultados: M21ResultadoDetalle[]
  created_at: string
}

export function useM21MonitoreoEstaciones() {
  const { profile } = useAuthContext()
  const [revisiones, setRevisiones] = useState<M21RevisionConResultados[]>([])
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const cargar = useCallback(async () => {
    if (!profile?.org_id) {
      setRevisiones([])
      return
    }

    setLoading(true)
    setError(null)
    try {
      const { data, error: err } = await (supabase as any)
        .from('m21_revision')
        .select(`
          id,
          rancho_id,
          fecha,
          inspector_nombre,
          observaciones,
          created_at,
          ranchos ( nombre, codigo ),
          m21_resultado (
            id,
            estacion_id,
            tipo_consumo,
            estado_trampa,
            condiciones,
            senalizacion,
            estado_equipo,
            estado_lampara,
            plaga_detectada,
            incidencia_id,
            m21_estaciones ( numero, tipo_trampa )
          )
        `)
        .eq('org_id', profile.org_id)
        .order('fecha', { ascending: false })
        .order('created_at', { ascending: false })

      if (err) throw err

      const mapeadas: M21RevisionConResultados[] = (data ?? []).map((r: any) => ({
        id: r.id,
        rancho_id: r.rancho_id,
        rancho_nombre: r.ranchos?.nombre ?? '—',
        rancho_codigo: r.ranchos?.codigo ?? '—',
        fecha: r.fecha,
        inspector_nombre: r.inspector_nombre ?? null,
        observaciones: r.observaciones ?? null,
        created_at: r.created_at,
        resultados: (r.m21_resultado ?? []).map((res: any): M21ResultadoDetalle => ({
          id: res.id,
          estacion_id: res.estacion_id,
          estacion_numero: res.m21_estaciones?.numero ?? '—',
          tipo_trampa: res.m21_estaciones?.tipo_trampa ?? '—',
          tipo_consumo: res.tipo_consumo ?? null,
          estado_trampa: res.estado_trampa ?? null,
          condiciones: res.condiciones ?? null,
          senalizacion: res.senalizacion ?? null,
          estado_equipo: res.estado_equipo ?? null,
          estado_lampara: res.estado_lampara ?? null,
          plaga_detectada: res.plaga_detectada ?? [],
          incidencia_id: res.incidencia_id ?? null,
        })),
      }))

      setRevisiones(mapeadas)
    } catch (err: any) {
      setError(err?.message ?? 'Error al cargar revisiones')
    } finally {
      setLoading(false)
    }
  }, [profile?.org_id])

  useEffect(() => {
    cargar()
  }, [cargar])

  return { revisiones, loading, error, refetch: cargar }
}
