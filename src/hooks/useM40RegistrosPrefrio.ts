import { useState, useEffect, useCallback } from 'react'
import { supabase } from '@/lib/supabase'
import { useAuthContext } from '@/context/AuthContext'
import { leerConCache } from '@/lib/offline/cacheLectura'

export interface M40RegistroResumen {
  id: string
  rancho_id: string
  rancho_nombre: string
  fecha: string
  empresa: string | null
}

const tbl = (name: string) => (supabase as any).from(name)

export function useM40RegistrosPrefrio() {
  const { profile, user } = useAuthContext()
  const userId = user?.id ?? null
  const [registros, setRegistros] = useState<M40RegistroResumen[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  const cargar = useCallback(async () => {
    if (!profile?.org_id || !userId) { setLoading(false); return }
    const orgId = profile.org_id
    setLoading(true); setError(null)
    try {
      const resultado = await leerConCache(
        'm40_registros',
        userId,
        orgId,
        async () => {
          const { data, error: err } = await tbl('m40_registros')
            .select('id, rancho_id, fecha, empresa, ranchos(nombre)')
            .eq('org_id', orgId)
            .order('fecha', { ascending: false })
            .order('created_at', { ascending: false })
          if (err) throw err
          return data ?? []
        },
      )
      setRegistros((resultado.datos as any[]).map((r) => ({
        id: r.id,
        rancho_id: r.rancho_id,
        rancho_nombre: r.ranchos?.nombre ?? '—',
        fecha: r.fecha,
        empresa: r.empresa ?? null,
      })))
    } catch (e: unknown) {
      setError((e as { message?: string })?.message ?? 'Error al cargar registros M40')
    } finally { setLoading(false) }
  }, [profile?.org_id, userId])

  useEffect(() => { cargar() }, [cargar])
  return { registros, loading, error, refetch: cargar }
}
