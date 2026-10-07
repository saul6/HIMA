import { useState, useEffect } from 'react'
import { useAuthContext } from '@/context/AuthContext'
import { getRanchos } from '@/lib/queries'
import { leerConCache } from '@/lib/offline/cacheLectura'
import type { Rancho } from '@/types/database.types'

interface UseRanchosResult {
  ranchos: Rancho[]
  loading: boolean
  error: string | null
  sinSitiosAsignados: boolean
}

export function useRanchos(): UseRanchosResult {
  const { profile } = useAuthContext()
  const [ranchos, setRanchos] = useState<Rancho[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    if (!profile?.id || !profile?.org_id) {
      setLoading(false)
      return
    }

    const userId = profile.id
    const orgId  = profile.org_id

    setLoading(true)
    leerConCache<Rancho[]>(
      'ranchos',
      userId,
      orgId,
      () => getRanchos(),
    )
      .then(resultado => setRanchos(resultado.datos))
      .catch((err: unknown) => setError(err instanceof Error ? err.message : 'Error al cargar sitios'))
      .finally(() => setLoading(false))
  }, [profile?.id, profile?.org_id])

  const sinSitiosAsignados =
    !loading && ranchos.length === 0 && profile?.rol === 'operario'

  return { ranchos, loading, error, sinSitiosAsignados }
}
