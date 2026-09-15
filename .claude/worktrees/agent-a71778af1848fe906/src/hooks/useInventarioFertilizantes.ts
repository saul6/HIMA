// Hook para saldos de inventario de fertilizantes (M8)

import { useState, useEffect, useCallback } from 'react'
import { supabase } from '@/lib/supabase'
import { useAuthContext } from '@/context/AuthContext'

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
  const { profile } = useAuthContext()
  const [saldos, setSaldos] = useState<SaldoFertilizante[]>([])
  const [loading, setLoading] = useState(true)

  const cargar = useCallback(async () => {
    if (!profile?.org_id) { setLoading(false); return }
    setLoading(true)
    const { data } = await supabase
      .from('v_inventario_fertilizantes_saldo')
      .select('rancho_id, rancho_nombre, fertilizante_id, nombre_comercial, ingrediente_activo, unidad, saldo')
      .eq('org_id', profile.org_id)
      .order('nombre_comercial')
      .order('rancho_nombre')
    setSaldos(data ?? [])
    setLoading(false)
  }, [profile?.org_id])

  useEffect(() => { cargar() }, [cargar])
  return { saldos, loading, refetch: cargar }
}
