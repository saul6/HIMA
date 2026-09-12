import { useState, useEffect, useCallback } from 'react'
import { supabase } from '@/lib/supabase'

export interface M64ControlHerramienta {
  id: string
  org_id: string
  rancho_id: string
  rancho_nombre: string
  fecha: string
  trabajador: string
  herramienta: string
  cantidad: number
  entrega_nombre: string
  recibe_nombre: string
  devuelto: boolean
  fecha_devolucion: string | null
  realizo: string | null
  observaciones: string | null
  created_at: string
}

export function useM64ControlHerramientas(orgId: string | null) {
  const [registros, setRegistros] = useState<M64ControlHerramienta[]>([])
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const fetch = useCallback(async () => {
    if (!orgId) return
    setLoading(true); setError(null)
    const { data, error: err } = await (supabase as any)
      .from('m64_control_herramientas')
      .select('*, ranchos(nombre)')
      .eq('org_id', orgId)
      .order('fecha', { ascending: false })
      .order('created_at', { ascending: false })
    if (err) { setError(err.message); setLoading(false); return }
    setRegistros((data ?? []).map((r: any) => ({ ...r, rancho_nombre: r.ranchos?.nombre ?? '—' })))
    setLoading(false)
  }, [orgId])

  useEffect(() => { fetch() }, [fetch])
  return { registros, loading, error, refetch: fetch }
}
