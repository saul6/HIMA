import { useState, useEffect } from 'react'
import { useAuthContext } from '@/context/AuthContext'
import { getRanchos } from '@/lib/queries'
import { supabase } from '@/lib/supabase'
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
      async () => {
        const todos = await getRanchos()
        // El Encargado puede leer todas las instalaciones, pero solo captura en las que tiene asignadas
        if (profile.rol !== 'asesor_tecnico') return todos
        const [asig, prod] = await Promise.all([
          (supabase as any).from('rancho_asignaciones').select('rancho_id').eq('profile_id', userId),
          (supabase as any).from('productores').select('id').eq('profile_id', userId),
        ])
        const asignadas = new Set(((asig.data ?? []) as { rancho_id: string }[]).map(x => x.rancho_id))
        const propios = new Set(((prod.data ?? []) as { id: string }[]).map(x => x.id))
        return todos.filter(r => asignadas.has(r.id) || (!!r.productor_id && propios.has(r.productor_id)))
      },
    )
      .then(resultado => setRanchos(resultado.datos))
      .catch((err: unknown) => setError(err instanceof Error ? err.message : 'Error al cargar sitios'))
      .finally(() => setLoading(false))
  }, [profile?.id, profile?.org_id, profile?.rol])

  const sinSitiosAsignados =
    !loading && ranchos.length === 0 && (profile?.rol === 'operario' || profile?.rol === 'asesor_tecnico')

  return { ranchos, loading, error, sinSitiosAsignados }
}
