import { useState, useEffect, useCallback } from 'react'
import { supabase } from '@/lib/supabase'

export interface M22Microorganismo {
  codigo: string
  label: string
  tipo: 'indicador' | 'patogeno'
  orden: number
}

export interface M22Muestra {
  id: string
  org_id: string
  rancho_id: string
  rancho_nombre: string
  fecha_muestreo: string
  hora_muestreo: string | null
  descripcion_muestra: string
  microorganismos: string[]
  laboratorio: string
  solicitante_nombre: string
  created_at: string
  creado_por: string | null
}

export function useM22Muestras(orgId: string | null) {
  const [muestras, setMuestras] = useState<M22Muestra[]>([])
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const fetch = useCallback(async () => {
    if (!orgId) return
    setLoading(true)
    setError(null)
    const { data, error: err } = await (supabase as any)
      .from('m22_muestras')
      .select('*, ranchos(nombre)')
      .eq('org_id', orgId)
      .order('fecha_muestreo', { ascending: false })
      .order('created_at', { ascending: false })
    if (err) { setError(err.message); setLoading(false); return }
    setMuestras(
      (data ?? []).map((r: any) => ({
        ...r,
        rancho_nombre: r.ranchos?.nombre ?? '—',
      }))
    )
    setLoading(false)
  }, [orgId])

  useEffect(() => { fetch() }, [fetch])

  return { muestras, loading, error, refetch: fetch }
}

export function useM22Microorganismos() {
  const [microorganismos, setMicroorganismos] = useState<M22Microorganismo[]>([])
  const [loading, setLoading] = useState(false)

  useEffect(() => {
    setLoading(true)
    ;(supabase as any)
      .from('m22_microorganismos')
      .select('*')
      .order('tipo')
      .order('orden')
      .then(({ data }: any) => {
        setMicroorganismos(data ?? [])
        setLoading(false)
      })
  }, [])

  return { microorganismos, loading }
}
