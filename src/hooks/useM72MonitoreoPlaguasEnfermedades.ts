import { useState, useEffect, useCallback } from 'react'
import { supabase } from '@/lib/supabase'

export interface M72Registro {
  id: string
  rancho_id: string
  rancho_nombre: string
  fecha: string
  etapa_fenologica: string | null
  realizo: string | null
  beneficos: string | null
  observaciones: string | null
  created_at: string
}

export interface M72Organismo {
  id: string
  tipo: 'plaga' | 'enfermedad'
  nombre: string
}

export interface M72Resultado {
  id: string
  registro_id: string
  sector: string
  num_planta: number
  organismo_id: string
  conteo: number
  comentario: string | null
}

export function useM72MonitoreoPlaguasEnfermedades(orgId: string | null) {
  const [registros, setRegistros] = useState<M72Registro[]>([])
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const fetch = useCallback(async () => {
    if (!orgId) return
    setLoading(true)
    setError(null)
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const { data, error: err } = await (supabase as any)
      .from('m72_registro')
      .select('*, ranchos(nombre)')
      .eq('org_id', orgId)
      .order('fecha', { ascending: false })
      .order('created_at', { ascending: false })
    if (err) { setError(err.message); setLoading(false); return }
    setRegistros(
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      (data ?? []).map((r: any) => ({
        ...r,
        rancho_nombre: r.ranchos?.nombre ?? '—',
      }))
    )
    setLoading(false)
  }, [orgId])

  useEffect(() => { fetch() }, [fetch])

  return { registros, loading, error, refetch: fetch }
}

export function useM72Organismos() {
  const [organismos, setOrganismos] = useState<M72Organismo[]>([])
  const [loading, setLoading] = useState(false)

  useEffect(() => {
    setLoading(true)
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    ;(supabase as any)
      .from('m72_organismos')
      .select('id, tipo, nombre')
      .eq('activo', true)
      .order('tipo', { ascending: true })
      .order('nombre', { ascending: true })
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      .then(({ data }: { data: M72Organismo[] | null }) => {
        setOrganismos(data ?? [])
        setLoading(false)
      })
  }, [])

  return { organismos, loading }
}
