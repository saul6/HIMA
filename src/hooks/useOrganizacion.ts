import { useState, useEffect } from 'react'
import { supabase } from '@/lib/supabase'

export function useOrganizacion(orgId: string | null | undefined): string | null {
  const [nombre, setNombre] = useState<string | null>(null)
  useEffect(() => {
    if (!orgId) { setNombre(null); return }
    supabase
      .from('organizaciones')
      .select('nombre')
      .eq('id', orgId)
      .single()
      .then(({ data }) => { if (data) setNombre(data.nombre) })
  }, [orgId])
  return nombre
}
