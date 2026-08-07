import { useEffect, useState, useCallback } from 'react'
import { supabase } from '@/lib/supabase'
import { useAuthContext } from '@/context/AuthContext'

export type ValorM43 = 'cumple' | 'no_cumple' | 'na'

export interface M43Punto {
  id: string
  orden: number
  descripcion: string
}

export interface M43DiaSummary {
  id: string
  fecha: string
  acciones_tomadas: string | null
  num_cumple: number
  num_no_cumple: number
  num_na: number
  num_incidencias: number
}

export interface M43RegistroMensual {
  id: string
  org_id: string
  rancho_id: string
  rancho_nombre: string
  rancho_codigo: string
  mes: string
  realizado_por: string | null
  verifica: string | null
  autoriza: string | null
  observaciones: string | null
  dias: M43DiaSummary[]
}

export function useM43InspeccionAlmacen() {
  const { profile } = useAuthContext()
  const [registros, setRegistros] = useState<M43RegistroMensual[]>([])
  const [loading, setLoading]     = useState(true)
  const [error, setError]         = useState(false)

  const fetchRegistros = useCallback(async () => {
    if (!profile?.org_id) return
    setLoading(true)
    setError(false)
    try {
      const tbl = supabase as any
      const { data, error: err } = await tbl
        .from('m43_registro_mensual')
        .select(`
          id, org_id, rancho_id, mes, realizado_por, verifica, autoriza, observaciones,
          ranchos(nombre, codigo),
          m43_dias(id, fecha, acciones_tomadas, m43_resultados(id, punto_id, valor, incidencia_id))
        `)
        .eq('org_id', profile.org_id)
        .order('mes', { ascending: false })
      if (err) throw err

      const items: M43RegistroMensual[] = ((data ?? []) as any[]).map((r: any) => {
        const diasRaw: any[] = r.m43_dias ?? []
        const dias: M43DiaSummary[] = diasRaw
          .sort((a: any, b: any) => a.fecha.localeCompare(b.fecha))
          .map((d: any) => {
            const res: any[] = d.m43_resultados ?? []
            return {
              id: d.id,
              fecha: d.fecha,
              acciones_tomadas: d.acciones_tomadas ?? null,
              num_cumple:       res.filter((x: any) => x.valor === 'cumple').length,
              num_no_cumple:    res.filter((x: any) => x.valor === 'no_cumple').length,
              num_na:           res.filter((x: any) => x.valor === 'na').length,
              num_incidencias:  res.filter((x: any) => x.incidencia_id).length,
            }
          })
        return {
          id:            r.id,
          org_id:        r.org_id,
          rancho_id:     r.rancho_id,
          rancho_nombre: (r.ranchos as any)?.nombre ?? '—',
          rancho_codigo: (r.ranchos as any)?.codigo ?? '—',
          mes:           r.mes,
          realizado_por: r.realizado_por ?? null,
          verifica:      r.verifica ?? null,
          autoriza:      r.autoriza ?? null,
          observaciones: r.observaciones ?? null,
          dias,
        }
      })
      setRegistros(items)
    } catch {
      setError(true)
    } finally {
      setLoading(false)
    }
  }, [profile?.org_id])

  useEffect(() => { fetchRegistros() }, [fetchRegistros])

  return { registros, loading, error, refetch: fetchRegistros }
}
