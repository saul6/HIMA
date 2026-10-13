import { useState, useCallback, useEffect } from 'react'
import { supabase } from '@/lib/supabase'
import { useAuthContext } from '@/context/AuthContext'
import { leerConCache } from '@/lib/offline/cacheLectura'

export type TipoTrampa = 'cebo' | 'interior' | 'mecanica' | 'pegamento' | 'luz'

export interface M21Estacion {
  id: string
  rancho_id: string
  org_id: string
  tipo_trampa: TipoTrampa
  numero: string
  activo: boolean
  orden: number
  created_at: string
  /** Token del chip NFC (select *); lo usa la ruta /nfc/:token para resolver sin red */
  nfc_token?: string | null
}

export function claveCacheEstaciones(ranchoId: string) {
  return `m21_estaciones:${ranchoId}`
}

export async function fetchEstacionesRancho(orgId: string, ranchoId: string): Promise<M21Estacion[]> {
  const { data, error: err } = await (supabase as any)
    .from('m21_estaciones')
    .select('*')
    .eq('org_id', orgId)
    .eq('rancho_id', ranchoId)
    .order('tipo_trampa')
    .order('orden')
    .order('numero')
  if (err) throw err
  return data ?? []
}

export function useM21EstacionesRancho(ranchoId: string | null) {
  const { profile, user } = useAuthContext()
  const userId = user?.id ?? null
  const [estaciones, setEstaciones] = useState<M21Estacion[]>([])
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const cargar = useCallback(async () => {
    if (!profile?.org_id || !ranchoId || !userId) {
      setEstaciones([])
      return
    }
    const orgId = profile.org_id

    setLoading(true)
    setError(null)
    try {
      const r = await leerConCache<M21Estacion[]>(
        claveCacheEstaciones(ranchoId),
        userId,
        orgId,
        () => fetchEstacionesRancho(orgId, ranchoId),
      )
      setEstaciones(r.datos)
    } catch (err: any) {
      setError(err?.message ?? 'Error al cargar estaciones')
    } finally {
      setLoading(false)
    }
  }, [profile?.org_id, ranchoId, userId])

  useEffect(() => {
    cargar()
  }, [cargar])

  return { estaciones, loading, error, refetch: cargar }
}
