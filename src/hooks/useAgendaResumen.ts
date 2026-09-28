import { useState, useEffect, useCallback } from 'react'
import { supabase } from '@/lib/supabase'
import { useAuthContext } from '@/context/AuthContext'
import type { AgendaResumen } from './useAgendaTareas'

// eslint-disable-next-line @typescript-eslint/no-explicit-any
const rpc = (name: string) => (supabase as any).rpc(name)

export function useAgendaResumen() {
  const { profile } = useAuthContext()
  const [resumen, setResumen] = useState<AgendaResumen | null>(null)
  const [loading, setLoading] = useState(false)

  const cargar = useCallback(async () => {
    if (!profile?.id) return
    setLoading(true)
    try {
      const { data, error } = await rpc('org_agenda_resumen')
      if (error) throw error
      const rows = data as AgendaResumen[] | null
      setResumen(rows?.[0] ?? null)
    } catch (e) {
      console.error('[useAgendaResumen]', e)
    } finally {
      setLoading(false)
    }
  }, [profile?.id])

  useEffect(() => {
    cargar()
  }, [cargar])

  return { resumen, loading, refetch: cargar }
}
