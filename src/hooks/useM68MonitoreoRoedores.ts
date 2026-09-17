import { useState, useEffect, useCallback } from 'react'
import { supabase } from '@/lib/supabase'

export interface M68Registro {
  id: string
  org_id: string
  rancho_id: string
  rancho_nombre: string
  fecha: string
  ubicacion: string
  num_trampas: number
  responsable: string | null
  observaciones: string | null
  creado_por: string | null
  created_at: string
}

export interface M68Criterio {
  id: string
  numero: number
  descripcion: string
}

export function useM68MonitoreoRoedores(orgId: string | null) {
  const [registros, setRegistros] = useState<M68Registro[]>([])
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const fetch = useCallback(async () => {
    if (!orgId) return
    setLoading(true)
    setError(null)
    const { data, error: err } = await (supabase as any)
      .from('m68_roedores_registro')
      .select('*, ranchos(nombre)')
      .eq('org_id', orgId)
      .order('fecha', { ascending: false })
      .order('created_at', { ascending: false })
    if (err) { setError(err.message); setLoading(false); return }
    setRegistros(
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

export function useM68Criterios() {
  const [criterios, setCriterios] = useState<M68Criterio[]>([])
  const [loading, setLoading] = useState(false)

  useEffect(() => {
    setLoading(true)
    ;(supabase as any)
      .from('m68_roedores_criterios')
      .select('id, numero, descripcion')
      .eq('activo', true)
      .order('numero', { ascending: true })
      .then(({ data }: { data: M68Criterio[] | null }) => {
        setCriterios(data ?? [])
        setLoading(false)
      })
  }, [])

  return { criterios, loading }
}
