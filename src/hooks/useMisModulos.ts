import { useState, useCallback } from 'react'
import { supabase } from '@/lib/supabase'
import { leerConCache } from '@/lib/offline/cacheLectura'

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

export function useMisModulos(userId?: string, orgId?: string) {
  const [modulos, setModulos] = useState<ModuloVisible[]>([])
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [desdeCache, setDesdeCache] = useState(false)
  const [guardadoEn, setGuardadoEn] = useState<number | null>(null)

  const refetch = useCallback(async () => {
    setLoading(true)
    setError(null)
    try {
      if (userId && orgId) {
        const resultado = await leerConCache<ModuloVisible[]>(
          'mis_modulos',
          userId,
          orgId,
          async () => {
            const { data, error: rpcError } = await supabase.rpc('get_mis_modulos')
            if (rpcError) throw rpcError
            return (data as ModuloVisible[]) ?? []
          },
        )
        setModulos(resultado.datos)
        setDesdeCache(resultado.desdeCache)
        setGuardadoEn(resultado.guardadoEn)
      } else {
        const { data, error: rpcError } = await supabase.rpc('get_mis_modulos')
        if (rpcError) throw rpcError
        setModulos((data as ModuloVisible[]) ?? [])
        setDesdeCache(false)
        setGuardadoEn(null)
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Error al cargar módulos')
      setModulos([])
      setDesdeCache(false)
      setGuardadoEn(null)
    } finally {
      setLoading(false)
    }
  }, [userId, orgId])

  const clear = useCallback(() => {
    setModulos([])
    setError(null)
    setDesdeCache(false)
    setGuardadoEn(null)
  }, [])

  return { modulos, loading, error, refetch, clear, desdeCache, guardadoEn }
}
