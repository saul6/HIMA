// Hook para catálogo de fertilizantes de la organización (M8)

import { useState, useEffect, useCallback } from 'react'
import { supabase } from '@/lib/supabase'
import { useAuthContext } from '@/context/AuthContext'
import { leerConCache } from '@/lib/offline/cacheLectura'

export interface FertilizanteOrgItem {
  id: string
  nombre_comercial: string
  ingrediente_activo: string | null
  concentracion: string | null
  unidad: 'kg' | 'L' | null
}

export function useFertilizantesOrg() {
  const { profile, user } = useAuthContext()
  const userId = user?.id ?? null
  const [fertilizantes, setFertilizantes] = useState<FertilizanteOrgItem[]>([])
  const [loading, setLoading] = useState(true)

  const cargar = useCallback(async () => {
    if (!profile?.org_id || !userId) { setLoading(false); return }
    const orgId = profile.org_id
    setLoading(true)
    try {
      const r = await leerConCache<FertilizanteOrgItem[]>('fertilizantes_org', userId, orgId, async () => {
        const { data } = await supabase
          .from('fertilizantes_org')
          .select('id, nombre_comercial, ingrediente_activo, concentracion, unidad')
          .eq('org_id', orgId)
          .eq('activo', true)
          .order('nombre_comercial')
        return (data ?? []) as FertilizanteOrgItem[]
      })
      setFertilizantes(r.datos)
    } catch {
      setFertilizantes([])
    }
    setLoading(false)
  }, [profile?.org_id, userId])

  useEffect(() => { cargar() }, [cargar])
  return { fertilizantes, loading, refetch: cargar }
}
