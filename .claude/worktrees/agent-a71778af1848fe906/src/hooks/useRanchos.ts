import { useState, useEffect } from 'react'
import { useAuthContext } from '@/context/AuthContext'
import { getRanchos } from '@/lib/queries'
import type { Rancho } from '@/types/database.types'

interface UseRanchosResult {
  ranchos: Rancho[]
  loading: boolean
  error: string | null
}

export function useRanchos(): UseRanchosResult {
  const { productor } = useAuthContext()
  const [ranchos, setRanchos] = useState<Rancho[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    if (!productor) {
      setLoading(false)
      return
    }

    setLoading(true)
    getRanchos(productor.id)
      .then(setRanchos)
      .catch((err: Error) => setError(err.message))
      .finally(() => setLoading(false))
  }, [productor?.id])

  return { ranchos, loading, error }
}
