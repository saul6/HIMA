import { useState, useEffect, useCallback } from 'react'
import { getSaldosRancho, getSaldosProductor } from '@/lib/queries'
import type { InventarioSaldoRancho, InventarioSaldoProductor } from '@/types/database.types'

interface UseInventarioResult {
  saldosRancho: InventarioSaldoRancho[]
  saldosProductor: InventarioSaldoProductor[]
  loading: boolean
  error: string | null
  refetch: () => void
}

export function useInventario(productorId: string | null): UseInventarioResult {
  const [saldosRancho, setSaldosRancho] = useState<InventarioSaldoRancho[]>([])
  const [saldosProductor, setSaldosProductor] = useState<InventarioSaldoProductor[]>([])
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const fetch = useCallback(async () => {
    if (!productorId) return
    setLoading(true)
    setError(null)
    try {
      const [rancho, productor] = await Promise.all([
        getSaldosRancho(productorId),
        getSaldosProductor(productorId),
      ])
      setSaldosRancho(rancho)
      setSaldosProductor(productor)
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Error al cargar inventario')
    } finally {
      setLoading(false)
    }
  }, [productorId])

  useEffect(() => { fetch() }, [fetch])

  return { saldosRancho, saldosProductor, loading, error, refetch: fetch }
}
