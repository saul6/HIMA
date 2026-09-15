import { createContext, useContext, useEffect, type ReactNode } from 'react'
import { useMisModulos, type ModuloVisible } from '@/hooks/useMisModulos'
import { useTerminoSitio, resolverTerminos, type TerminosSitio } from '@/hooks/useTerminoSitio'
import { useAuthContext } from '@/context/AuthContext'

interface ModulosContextValue {
  modulos: ModuloVisible[]
  loading: boolean
  error: string | null
  refetch: () => Promise<void>
  terminosSitio: TerminosSitio
}

const ModulosContext = createContext<ModulosContextValue | null>(null)

export function ModulosProvider({ children }: { children: ReactNode }) {
  const { user, loading: authLoading } = useAuthContext()
  const { modulos, loading: modulosLoading, error, refetch, clear } = useMisModulos()
  const { termino, refetch: refetchTermino, clear: clearTermino } = useTerminoSitio()

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

  return (
    <ModulosContext.Provider value={{
      modulos,
      loading: authLoading || modulosLoading,
      error,
      refetch,
      terminosSitio: resolverTerminos(termino),
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
