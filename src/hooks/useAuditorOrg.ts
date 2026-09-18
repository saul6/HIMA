import { useState, useEffect, useCallback } from 'react'
import { supabase } from '@/lib/supabase'
import type { AudEstado } from '@/types/database.types'

// eslint-disable-next-line @typescript-eslint/no-explicit-any
const tbl = (name: string) => (supabase as any).from(name)

export interface AuditorRancho {
  id: string
  nombre: string
  codigo: string | null
  cultivo: string | null
}

export interface AuditorAuditoriaItem {
  id: string
  fecha: string
  estado: AudEstado | 'preliminar'
  rancho_nombre: string
  modulos: string[]
}

export function useAuditorOrg(orgId: string | undefined) {
  const [ranchos, setRanchos] = useState<AuditorRancho[]>([])
  const [auditorias, setAuditorias] = useState<AuditorAuditoriaItem[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  const cargar = useCallback(async () => {
    if (!orgId) { setLoading(false); return }
    setLoading(true)
    setError(null)
    try {
      const [rRes, aRes] = await Promise.all([
        tbl('ranchos').select('id, nombre, codigo, cultivo').eq('org_id', orgId).order('nombre'),
        tbl('aud_auditorias')
          .select(`
            id, fecha, estado,
            ranchos(nombre),
            aud_auditoria_modulos(modulo_norma_id, aud_modulos_norma(nombre))
          `)
          .eq('org_id', orgId)
          .order('fecha', { ascending: false })
          .limit(100),
      ])
      if (rRes.error) throw rRes.error
      if (aRes.error) throw aRes.error

      setRanchos(rRes.data ?? [])
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      setAuditorias((aRes.data ?? []).map((r: any) => ({
        id: r.id,
        fecha: r.fecha,
        estado: r.estado as AudEstado | 'preliminar',
        rancho_nombre: r.ranchos?.nombre ?? '—',
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        modulos: (r.aud_auditoria_modulos ?? []).map((m: any) => m.aud_modulos_norma?.nombre ?? '—'),
      })))
    } catch (e: unknown) {
      setError(e instanceof Error ? e.message : 'Error al cargar')
    } finally {
      setLoading(false)
    }
  }, [orgId])

  useEffect(() => { cargar() }, [cargar])

  return { ranchos, auditorias, loading, error, refetch: cargar }
}
