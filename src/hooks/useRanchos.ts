import { useState, useEffect } from 'react'
import { useAuthContext } from '@/context/AuthContext'
import { getRanchos } from '@/lib/queries'
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
    if (!profile?.org_id) {
      setLoading(false)
      return
    }

    setLoading(true)
    // Sin filtro de productor_id: la RLS se encarga.
    // admin_org/asesor_tecnico → todos los ranchos de la org.
    // operario → solo los ranchos asignados vía rancho_asignaciones.
    getRanchos()
      .then(setRanchos)
      .catch((err: Error) => setError(err.message))
      .finally(() => setLoading(false))
  }, [profile?.id, profile?.org_id])

  const sinSitiosAsignados =
    !loading && ranchos.length === 0 && profile?.rol === 'operario'

  return { ranchos, loading, error, sinSitiosAsignados }
}
