// Hook para saldos de inventario de fertilizantes (M8)

import { useState, useEffect, useCallback } from 'react'
import { supabase } from '@/lib/supabase'
import { useAuthContext } from '@/context/AuthContext'
import { leerConCache } from '@/lib/offline/cacheLectura'

export interface SaldoFertilizante {
  rancho_id: string
  rancho_nombre: string | null
  fertilizante_id: string
  nombre_comercial: string
  ingrediente_activo: string | null
  unidad: string | null
  saldo: number
}

export function useInventarioFertilizantes() {
  const { profile, user } = useAuthContext()
  const userId = user?.id ?? null
  const [saldos, setSaldos] = useState<SaldoFertilizante[]>([])
  const [loading, setLoading] = useState(true)

  const cargar = useCallback(async () => {
    if (!profile?.org_id || !userId) { setLoading(false); return }
    const orgId = profile.org_id
    setLoading(true)
    try {
      const r = await leerConCache<SaldoFertilizante[]>('inv_fertilizantes_saldo', userId, orgId, async () => {
        const { data, error } = await supabase
          .from('v_inventario_fertilizantes_saldo')
          .select('rancho_id, rancho_nombre, fertilizante_id, nombre_comercial, ingrediente_activo, unidad, saldo')
          .eq('org_id', orgId)
          .order('nombre_comercial')
          .order('rancho_nombre')
        if (error) throw error
        return (data ?? []) as SaldoFertilizante[]
      })
      setSaldos(r.datos)
    } catch (error) {
      console.error('[M8 inv saldos]', error)
      setSaldos([])
    }
    setLoading(false)
  }, [profile?.org_id, userId])

  useEffect(() => { cargar() }, [cargar])
  return { saldos, loading, refetch: cargar }
}
