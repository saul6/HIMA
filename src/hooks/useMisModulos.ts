import { useState, useCallback } from 'react'
import { supabase } from '@/lib/supabase'

export interface ModuloVisible {
  codigo: string
  clave: string
  nombre: string
  ruta: string
  icono: string
  orden: number
  es_transversal: boolean
  mostrar_en_menu: boolean
  sector_clave: string | null
  sector_nombre: string | null
  sector_orden: number | null
  categoria?: string | null
  desbloqueado: boolean
}

export function useMisModulos() {
  const [modulos, setModulos] = useState<ModuloVisible[]>([])
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const refetch = useCallback(async () => {
    setLoading(true)
    setError(null)
    try {
      const { data, error: rpcError } = await supabase.rpc('get_mis_modulos')
      if (rpcError) throw rpcError
      setModulos((data as ModuloVisible[]) ?? [])
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Error al cargar módulos')
      setModulos([])
    } finally {
      setLoading(false)
    }
  }, [])

  const clear = useCallback(() => {
    setModulos([])
    setError(null)
  }, [])

  return { modulos, loading, error, refetch, clear }
}
