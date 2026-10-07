import { useState, useCallback } from 'react'
import { supabase } from '@/lib/supabase'
import { leerConCache } from '@/lib/offline/cacheLectura'

export interface TerminosSitio {
  singular: string      // "Rancho" | "Instalación" | "Sitio"
  plural: string        // "Todos los ranchos" | "Todas las instalaciones" | "Todos los sitios"
  pluralSimple: string  // "Ranchos" | "Instalaciones" | "Sitios"
  agregar: string       // "Agregar rancho" | "Agregar instalación" | "Agregar sitio"
  genero: 'm' | 'f'    // para concordancia gramatical
}

export function resolverTerminos(termino: string): TerminosSitio {
  const map: Record<string, TerminosSitio> = {
    'Rancho': {
      singular: 'Rancho', plural: 'Todos los ranchos',
      pluralSimple: 'Ranchos', agregar: 'Agregar rancho', genero: 'm',
    },
    'Instalación': {
      singular: 'Instalación', plural: 'Todas las instalaciones',
      pluralSimple: 'Instalaciones', agregar: 'Agregar instalación', genero: 'f',
    },
    'Sitio': {
      singular: 'Sitio', plural: 'Todos los sitios',
      pluralSimple: 'Sitios', agregar: 'Agregar sitio', genero: 'm',
    },
  }
  return map[termino] ?? {
    singular: termino,
    plural: `Todos los ${termino.toLowerCase()}s`,
    pluralSimple: `${termino}s`,
    agregar: `Agregar ${termino.toLowerCase()}`,
    genero: 'm',
  }
}

export function useTerminoSitio(userId?: string, orgId?: string) {
  const [termino, setTermino] = useState<string>('Rancho')
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const refetch = useCallback(async () => {
    setLoading(true)
    setError(null)
    try {
      if (userId && orgId) {
        const resultado = await leerConCache<string>(
          'termino_sitio',
          userId,
          orgId,
          async () => {
            const { data, error: rpcError } = await supabase.rpc('get_mi_termino_sitio')
            if (rpcError) throw rpcError
            return (data as string) ?? 'Rancho'
          },
        )
        setTermino(resultado.datos)
      } else {
        const { data, error: rpcError } = await supabase.rpc('get_mi_termino_sitio')
        if (rpcError) throw rpcError
        setTermino((data as string) ?? 'Rancho')
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Error al cargar término de sitio')
      setTermino('Rancho')
    } finally {
      setLoading(false)
    }
  }, [userId, orgId])

  const clear = useCallback(() => {
    setTermino('Rancho')
    setError(null)
  }, [])

  return { termino, loading, error, refetch, clear }
}
