import { useEffect, useState, useCallback } from 'react'
import { supabase } from '@/lib/supabase'
import { useAuthContext } from '@/context/AuthContext'

export type PrioridadM44 = 'inmediata' | 'turno' | 'siguientes_dias'

export interface M44Orden {
  id: string
  rancho_id: string
  rancho_nombre: string
  rancho_codigo: string
  fecha: string
  folio: string | null
  descripcion_solicitud: string | null
  prioridad: PrioridadM44
  solicita: string | null
  recibe_mtto: string | null
  equipo_produccion: boolean
  lavado_sanitizado: boolean
  observaciones: string | null
  entrega_mtto: string | null
  recibe: string | null
  incidencia_id: string | null
}

export function useM44OrdenesMantenimiento() {
  const { profile } = useAuthContext()
  const [ordenes, setOrdenes]   = useState<M44Orden[]>([])
  const [loading, setLoading]   = useState(true)
  const [error, setError]       = useState<string | null>(null)

  const fetchOrdenes = useCallback(async () => {
    if (!profile?.org_id) return
    setLoading(true)
    setError(null)
    try {
      const { data, error: err } = await (supabase as any)
        .from('m44_ordenes')
        .select(`
          id, rancho_id, fecha, folio, descripcion_solicitud, prioridad,
          solicita, recibe_mtto, equipo_produccion, lavado_sanitizado,
          observaciones, entrega_mtto, recibe, incidencia_id,
          ranchos(nombre, codigo)
        `)
        .eq('org_id', profile.org_id)
        .order('fecha', { ascending: false })
      if (err) throw err
      const items: M44Orden[] = ((data ?? []) as any[]).map((r: any) => ({
        id:                    r.id,
        rancho_id:             r.rancho_id,
        rancho_nombre:         (r.ranchos as any)?.nombre ?? '—',
        rancho_codigo:         (r.ranchos as any)?.codigo ?? '—',
        fecha:                 r.fecha,
        folio:                 r.folio ?? null,
        descripcion_solicitud: r.descripcion_solicitud ?? null,
        prioridad:             r.prioridad as PrioridadM44,
        solicita:              r.solicita ?? null,
        recibe_mtto:           r.recibe_mtto ?? null,
        equipo_produccion:     r.equipo_produccion ?? false,
        lavado_sanitizado:     r.lavado_sanitizado ?? false,
        observaciones:         r.observaciones ?? null,
        entrega_mtto:          r.entrega_mtto ?? null,
        recibe:                r.recibe ?? null,
        incidencia_id:         r.incidencia_id ?? null,
      }))
      setOrdenes(items)
    } catch (e: unknown) {
      setError(e instanceof Error ? e.message : 'Error al cargar órdenes')
    } finally {
      setLoading(false)
    }
  }, [profile?.org_id])

  useEffect(() => { fetchOrdenes() }, [fetchOrdenes])

  return { ordenes, loading, error, refetch: fetchOrdenes }
}
