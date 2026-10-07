import { createContext, useContext, useEffect, useCallback, type ReactNode } from 'react'
import { useMisModulos, type ModuloVisible } from '@/hooks/useMisModulos'
import { useTerminoSitio, resolverTerminos, type TerminosSitio } from '@/hooks/useTerminoSitio'
import { useAuthContext } from '@/context/AuthContext'
import { precargarCache } from '@/lib/offline/cacheLectura'
import { supabase } from '@/lib/supabase'
import { getRanchos } from '@/lib/queries'

interface ModulosContextValue {
  modulos: ModuloVisible[]
  loading: boolean
  error: string | null
  refetch: () => Promise<void>
  terminosSitio: TerminosSitio
  desdeCache: boolean
  guardadoEn: number | null
}

const ModulosContext = createContext<ModulosContextValue | null>(null)

export function ModulosProvider({ children }: { children: ReactNode }) {
  const { user, profile, loading: authLoading } = useAuthContext()
  const userId = user?.id
  const orgId  = profile?.org_id ?? undefined

  const {
    modulos, loading: modulosLoading, error, refetch, clear,
    desdeCache, guardadoEn,
  } = useMisModulos(userId, orgId)
  const { termino, refetch: refetchTermino, clear: clearTermino } = useTerminoSitio(userId, orgId)

  useEffect(() => {
    if (authLoading) return
    if (user) {
      refetch()
      refetchTermino()
    } else {
      clear()
      clearTermino()
    }
  }, [user?.id, authLoading, refetch, clear, refetchTermino, clearTermino])

  // Precarga en segundo plano todos los recursos necesarios para trabajar sin red
  const ejecutarPrecarga = useCallback(async () => {
    if (!userId || !orgId || !navigator.onLine) return
    await precargarCache(userId, orgId, [
      {
        clave: 'termino_sitio',
        fetcher: async () => {
          const { data } = await supabase.rpc('get_mi_termino_sitio')
          return (data as string) ?? 'Rancho'
        },
      },
      {
        clave: 'ranchos',
        fetcher: () => getRanchos(),
      },
      {
        clave: 'm9_items_catalogo',
        fetcher: async () => {
          const { data } = await supabase
            .from('m9_items_catalogo')
            .select('*')
            .order('orden')
          return data ?? []
        },
      },
      {
        clave: 'm9_registros',
        fetcher: async () => {
          const { data } = await supabase
            .from('m9_registro_mensual')
            .select('*, ranchos(nombre, codigo)')
            .eq('org_id', orgId)
            .order('mes', { ascending: false })
            .order('created_at', { ascending: false })
          return data ?? []
        },
      },
      {
        clave: 'm12_jornadas',
        fetcher: async () => {
          const { data } = await supabase
            .from('m12_limpieza_banos')
            .select('*, ranchos(nombre, codigo)')
            .eq('org_id', orgId)
            .order('fecha', { ascending: false })
            .order('created_at', { ascending: true })
            .limit(500)
          return data ?? []
        },
      },
      {
        clave: 'm13_reportes',
        fetcher: async () => {
          const { data } = await supabase
            .from('m13_reportes')
            .select(`*, ranchos(nombre, codigo), creador:profiles!creado_por(nombre_completo), m13_incidencias(id, orden, descripcion, m13_incidencia_fotos(id, storage_path, orden))`)
            .eq('org_id', orgId)
            .order('fecha', { ascending: false })
            .order('created_at', { ascending: false })
            .limit(100)
          return data ?? []
        },
      },
    ])
  }, [userId, orgId])

  // Precarga al iniciar sesión con red
  useEffect(() => {
    if (!userId || !orgId) return
    ejecutarPrecarga()
  }, [userId, orgId, ejecutarPrecarga])

  // Precarga al volver la red
  useEffect(() => {
    const handleOnline = () => ejecutarPrecarga()
    window.addEventListener('online', handleOnline)
    return () => window.removeEventListener('online', handleOnline)
  }, [ejecutarPrecarga])

  return (
    <ModulosContext.Provider value={{
      modulos,
      loading: authLoading || modulosLoading,
      error,
      refetch,
      terminosSitio: resolverTerminos(termino),
      desdeCache,
      guardadoEn,
    }}>
      {children}
    </ModulosContext.Provider>
  )
}

export function useModulosContext(): ModulosContextValue {
  const ctx = useContext(ModulosContext)
  if (!ctx) throw new Error('useModulosContext debe usarse dentro de ModulosProvider')
  return ctx
}
