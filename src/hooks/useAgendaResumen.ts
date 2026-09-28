import { useState, useEffect, useCallback } from 'react'
import { supabase } from '@/lib/supabase'
import { useAuthContext } from '@/context/AuthContext'
import type { AgendaResumen } from './useAgendaTareas'

// eslint-disable-next-line @typescript-eslint/no-explicit-any
const rpc = (name: string) => (supabase as any).rpc(name)

function unwrap<T>(data: unknown): T | null {
  if (data == null) return null
  return (Array.isArray(data) ? (data[0] ?? null) : data) as T | null
}

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
      setResumen(unwrap<AgendaResumen>(data))
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
