// Hook para catálogo de fertilizantes de la organización (M8)

import { useState, useEffect, useCallback } from 'react'
import { supabase } from '@/lib/supabase'
import { useAuthContext } from '@/context/AuthContext'

export interface FertilizanteOrgItem {
  id: string
  nombre_comercial: string
  ingrediente_activo: string | null
  concentracion: string | null
  unidad: 'kg' | 'L' | null
}

export function useFertilizantesOrg() {
  const { profile } = useAuthContext()
  const [fertilizantes, setFertilizantes] = useState<FertilizanteOrgItem[]>([])
  const [loading, setLoading] = useState(true)

  const cargar = useCallback(async () => {
    if (!profile?.org_id) { setLoading(false); return }
    setLoading(true)
    const { data } = await supabase
      .from('fertilizantes_org')
      .select('id, nombre_comercial, ingrediente_activo, concentracion, unidad')
      .eq('org_id', profile.org_id)
      .eq('activo', true)
      .order('nombre_comercial')
    setFertilizantes(data ?? [])
    setLoading(false)
  }, [profile?.org_id])

  useEffect(() => { cargar() }, [cargar])
  return { fertilizantes, loading, refetch: cargar }
}
