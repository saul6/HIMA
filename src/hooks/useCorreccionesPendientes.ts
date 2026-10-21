import { useState, useEffect, useCallback } from 'react'
import { supabase } from '@/lib/supabase'
import { useAuthContext } from '@/context/AuthContext'

export interface CorreccionPendiente {
  clave: string
  modulo: string
  modulo_nombre: string
  ruta: string
  tabla: string
  registro_id: string
  ids: string[]
  rancho_id: string | null
  rancho_nombre: string | null
  fecha: string
  comentario_correccion: string | null
  marcado_por_nombre: string | null
  marcado_en: string | null
  creado_en: string
}

interface RespuestaCorrecciones {
  total?: number
  items?: CorreccionPendiente[]
}

export function useCorreccionesPendientes() {
  const { profile } = useAuthContext()
  const [items, setItems] = useState<CorreccionPendiente[]>([])
  const [total, setTotal] = useState(0)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  const cargar = useCallback(async () => {
    if (!profile?.id || !profile?.org_id) {
      setLoading(false)
      return
    }
    setLoading(true)
    setError(null)
    try {
      const { data, error: err } = await supabase.rpc('mis_correcciones_pendientes')
      if (err) throw err
      const r = (data ?? {}) as RespuestaCorrecciones
      setItems(r.items ?? [])
      setTotal(r.total ?? r.items?.length ?? 0)
    } catch {
      setError('Error al cargar correcciones')
    } finally {
      setLoading(false)
    }
  }, [profile?.id, profile?.org_id])

  useEffect(() => {
    cargar()
  }, [cargar])

  return { items, count: total, loading, error, refetch: cargar }
}
