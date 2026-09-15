import { useState, useEffect, useCallback } from 'react'
import { supabase } from '@/lib/supabase'
import { useAuthContext } from '@/context/AuthContext'

export interface M13FotoInfo {
  id: string
  storage_path: string
  orden: number
}

export interface M13IncidenciaInfo {
  id: string
  orden: number
  descripcion: string
  fotos: M13FotoInfo[]
}

export interface M13ReporteConRancho {
  id: string
  org_id: string
  rancho_id: string
  rancho_nombre: string
  rancho_codigo: string
  fecha: string
  auditor_nombre: string | null
  realizado_por_id: string | null
  created_at: string
  creado_por: string | null
  creado_por_nombre: string
  requiere_correccion: boolean
  comentario_correccion: string | null
  marcado_por: string | null
  marcado_en: string | null
  incidencias: M13IncidenciaInfo[]
}

export function useM13Incidencias() {
  const { profile } = useAuthContext()
  const [reportes, setReportes] = useState<M13ReporteConRancho[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  const cargar = useCallback(async () => {
    if (!profile?.org_id) { setLoading(false); return }
    setLoading(true)
    setError(null)
    try {
      const { data, error: err } = await supabase
        .from('m13_reportes')
        .select(`
          *,
          ranchos(nombre, codigo),
          creador:profiles!creado_por(nombre_completo),
          m13_incidencias(
            id, orden, descripcion,
            m13_incidencia_fotos(id, storage_path, orden)
          )
        `)
        .eq('org_id', profile.org_id)
        .order('fecha', { ascending: false })
        .order('created_at', { ascending: false })
        .limit(100)
      if (err) throw err

      setReportes(
        (data ?? []).map((r: any) => ({
          ...r,
          rancho_nombre: r.ranchos?.nombre ?? '—',
          rancho_codigo: r.ranchos?.codigo ?? '—',
          creado_por: r.creado_por ?? null,
          creado_por_nombre: r.creador?.nombre_completo ?? '—',
          requiere_correccion: r.requiere_correccion ?? false,
          comentario_correccion: r.comentario_correccion ?? null,
          marcado_por: r.marcado_por ?? null,
          marcado_en: r.marcado_en ?? null,
          incidencias: (r.m13_incidencias ?? [])
            .sort((a: any, b: any) => a.orden - b.orden)
            .map((inc: any) => ({
              id: inc.id,
              orden: inc.orden,
              descripcion: inc.descripcion,
              fotos: (inc.m13_incidencia_fotos ?? [])
                .sort((a: any, b: any) => a.orden - b.orden)
                .map((f: any) => ({
                  id: f.id,
                  storage_path: f.storage_path,
                  orden: f.orden,
                })),
            })),
        }))
      )
    } catch (e: unknown) {
      setError(e instanceof Error ? e.message : 'Error al cargar reportes M13')
    } finally {
      setLoading(false)
    }
  }, [profile?.org_id])

  useEffect(() => { cargar() }, [cargar])

  return { reportes, loading, error, refetch: cargar }
}
