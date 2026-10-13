import { useState, useEffect } from 'react'
import { supabase } from '@/lib/supabase'
import { useAuthContext } from '@/context/AuthContext'
import { leerConCache } from '@/lib/offline/cacheLectura'

export function useOrganizacion(orgId: string | null | undefined): string | null {
  const { user } = useAuthContext()
  const userId = user?.id
  const [nombre, setNombre] = useState<string | null>(null)
  useEffect(() => {
    if (!orgId) { setNombre(null); return }
    // Misma consulta de siempre; la caché solo entra como respaldo sin red.
    const consulta = async () => {
      const { data, error } = await supabase
        .from('organizaciones')
        .select('nombre')
        .eq('id', orgId)
        .single()
      if (error || !data) throw error ?? new Error('Organización no encontrada')
      return data.nombre as string
    }
    const lectura = userId
      ? leerConCache<string>(`org_nombre:${orgId}`, userId, orgId, consulta).then((r) => r.datos)
      : consulta()
    lectura.then(setNombre).catch(() => {})
  }, [orgId, userId])
  return nombre
}
