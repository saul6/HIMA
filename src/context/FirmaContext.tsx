import { createContext, useContext, type ReactNode } from 'react'
import { useAuthContext } from '@/context/AuthContext'
import { useFirmaObligatoria } from '@/hooks/useFirmaObligatoria'

interface FirmaContextValue {
  obligatoria: boolean
  desde: string | null
  tengoFirma: boolean
  loading: boolean
  refrescar: () => Promise<void>
}

const FirmaContext = createContext<FirmaContextValue | null>(null)

export function FirmaProvider({ children }: { children: ReactNode }) {
  const { user } = useAuthContext()
  const value = useFirmaObligatoria(user?.id)
  return <FirmaContext.Provider value={value}>{children}</FirmaContext.Provider>
}

export function useFirmaContext(): FirmaContextValue {
  const ctx = useContext(FirmaContext)
  if (!ctx) throw new Error('useFirmaContext debe usarse dentro de FirmaProvider')
  return ctx
}
