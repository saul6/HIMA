import { useState, useEffect, useCallback } from 'react'
import { supabase } from '@/lib/supabase'
import { leerConCache } from '@/lib/offline/cacheLectura'

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

export function useM22Muestras(userId: string | null, orgId: string | null) {
  const [muestras, setMuestras] = useState<M22Muestra[]>([])
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const fetch = useCallback(async () => {
    if (!userId || !orgId) return
    setLoading(true)
    setError(null)
    try {
      const resultado = await leerConCache(
        'm22_muestras',
        userId,
        orgId,
        async () => {
          const { data, error: err } = await (supabase as any)
            .from('m22_muestras')
            .select('*, ranchos(nombre)')
            .eq('org_id', orgId)
            .order('fecha_muestreo', { ascending: false })
            .order('created_at', { ascending: false })
          if (err) throw err
          return data ?? []
        },
      )
      setMuestras(
        (resultado.datos as any[]).map((r: any) => ({
          ...r,
          rancho_nombre: r.ranchos?.nombre ?? '—',
        }))
      )
    } catch (e: unknown) {
      setError(e instanceof Error ? e.message : 'Error al cargar muestras')
    } finally {
      setLoading(false)
    }
  }, [userId, orgId])

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
