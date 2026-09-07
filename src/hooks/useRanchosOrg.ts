import { useState, useEffect } from 'react'
import { supabase } from '@/lib/supabase'
import { useAuthContext } from '@/context/AuthContext'

export interface RanchoBasico {
  id: string
  nombre: string
  codigo: string
}

export function useRanchosOrg() {
  const { profile } = useAuthContext()
  const [ranchos, setRanchos] = useState<RanchoBasico[]>([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    if (!profile?.org_id) { setLoading(false); return }
    let cancelado = false
    supabase
      .from('ranchos')
      .select('id, nombre, codigo')
      .eq('org_id', profile.org_id)
      .order('nombre')
      .then(({ data }) => {
        if (!cancelado) setRanchos(data ?? [])
      })
      .finally(() => { if (!cancelado) setLoading(false) })
    return () => { cancelado = true }
  }, [profile?.org_id])

  return { ranchos, loading }
}
