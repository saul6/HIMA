import { useState, useCallback, useEffect, useMemo } from 'react'
import { supabase } from '@/lib/supabase'
import { useAuthContext } from '@/context/AuthContext'
import { useOutbox } from '@/hooks/useOutbox'
import { leerConCache } from '@/lib/offline/cacheLectura'
import { SYNC_OK_EVENT } from '@/lib/offline/sync'

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
  /** Capturada sin conexión; todavía en el outbox */
  sin_subir?: boolean
}

export function useM21MonitoreoEstaciones() {
  const { profile, user } = useAuthContext()
  const userId = user?.id ?? null
  const { pendientes } = useOutbox('M21')
  const [base, setBase] = useState<M21RevisionConResultados[]>([])
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const cargar = useCallback(async () => {
    if (!profile?.org_id || !userId) {
      setBase([])
      return
    }
    const orgId = profile.org_id

    setLoading(true)
    setError(null)
    try {
      const resultado = await leerConCache('m21_revisiones', userId, orgId, async () => {
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
          .eq('org_id', orgId)
          .order('fecha', { ascending: false })
          .order('created_at', { ascending: false })
        if (err) throw err
        return data ?? []
      })

      const mapeadas: M21RevisionConResultados[] = (resultado.datos as any[]).map((r: any) => ({
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

      setBase(mapeadas)
    } catch (err: any) {
      setError(err?.message ?? 'Error al cargar revisiones')
    } finally {
      setLoading(false)
    }
  }, [profile?.org_id, userId])

  useEffect(() => {
    cargar()
  }, [cargar])

  useEffect(() => {
    const h = () => { cargar() }
    window.addEventListener(SYNC_OK_EVENT, h)
    return () => window.removeEventListener(SYNC_OK_EVENT, h)
  }, [cargar])

  // Revisiones/resultados capturados sin conexión: una revisión por (sitio, fecha);
  // si ya existe en el servidor, los resultados pendientes se suman a esa misma.
  const revisiones = useMemo(() => {
    if (pendientes.length === 0) return base
    const lista = base.map(r => ({ ...r, resultados: [...r.resultados] }))
    for (const lote of pendientes) {
      const meta = (lote.metadatos ?? {}) as {
        rancho_nombre?: string
        rancho_codigo?: string
        estaciones?: Record<string, { numero: string; tipo_trampa: string }>
      }
      const idLocalARevision = new Map<string, M21RevisionConResultados>()
      for (const op of lote.operaciones) {
        const f = op.fila as Record<string, any>
        if (op.tabla === 'm21_revision') {
          let rev = lista.find(r => r.rancho_id === f.rancho_id && r.fecha === f.fecha)
          if (!rev) {
            rev = {
              id: f.id,
              rancho_id: f.rancho_id,
              rancho_nombre: meta.rancho_nombre ?? '—',
              rancho_codigo: meta.rancho_codigo ?? '—',
              fecha: f.fecha,
              inspector_nombre: f.inspector_nombre ?? null,
              observaciones: f.observaciones ?? null,
              created_at: lote.capturadoEn,
              resultados: [],
              sin_subir: true,
            }
            lista.push(rev)
          }
          idLocalARevision.set(f.id, rev)
        } else if (op.tabla === 'm21_resultado') {
          const rev = idLocalARevision.get(f.revision_id) ?? lista.find(r => r.id === f.revision_id)
          if (!rev) continue
          const est = meta.estaciones?.[f.estacion_id]
          const nuevo: M21ResultadoDetalle = {
            id: f.id,
            estacion_id: f.estacion_id,
            estacion_numero: est?.numero ?? '—',
            tipo_trampa: est?.tipo_trampa ?? '—',
            tipo_consumo: f.tipo_consumo ?? null,
            estado_trampa: f.estado_trampa ?? null,
            condiciones: f.condiciones ?? null,
            senalizacion: f.senalizacion ?? null,
            estado_equipo: f.estado_equipo ?? null,
            estado_lampara: f.estado_lampara ?? null,
            plaga_detectada: f.plaga_detectada ?? [],
            incidencia_id: f.incidencia_id ?? null,
          }
          const i = rev.resultados.findIndex(r => r.estacion_id === f.estacion_id)
          if (i >= 0) rev.resultados[i] = nuevo
          else rev.resultados.push(nuevo)
        }
      }
    }
    return lista.sort((a, b) => b.fecha.localeCompare(a.fecha) || b.created_at.localeCompare(a.created_at))
  }, [base, pendientes])

  return { revisiones, loading, error, refetch: cargar }
}
