import { useState, useEffect, useCallback } from 'react'
import { supabase } from '@/lib/supabase'
import { useAuthContext } from '@/context/AuthContext'
import { leerConCache } from '@/lib/offline/cacheLectura'

export interface M38ManifiestoResumen {
  id: string
  rancho_id: string
  rancho_nombre: string
  fecha: string
  folio: string | null
  empresa: string | null
  nombre_chofer: string | null
  incidencia_id: string | null
}

const tbl = (name: string) => (supabase as any).from(name)

export function useM38Manifiestos() {
  const { profile, user } = useAuthContext()
  const userId = user?.id ?? null
  const [manifiestos, setManifiestos] = useState<M38ManifiestoResumen[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  const cargar = useCallback(async () => {
    if (!profile?.org_id || !userId) { setLoading(false); return }
    const orgId = profile.org_id
    setLoading(true); setError(null)
    try {
      const resultado = await leerConCache(
        'm38_manifiestos',
        userId,
        orgId,
        async () => {
          const { data, error: err } = await tbl('m38_manifiestos')
            .select('id, rancho_id, fecha, folio, empresa, nombre_chofer, incidencia_id, ranchos(nombre)')
            .eq('org_id', orgId)
            .order('fecha', { ascending: false })
            .order('created_at', { ascending: false })
          if (err) throw err
          return data ?? []
        },
      )
      setManifiestos((resultado.datos as any[]).map((r) => ({
        id: r.id,
        rancho_id: r.rancho_id,
        rancho_nombre: r.ranchos?.nombre ?? '—',
        fecha: r.fecha,
        folio: r.folio ?? null,
        empresa: r.empresa ?? null,
        nombre_chofer: r.nombre_chofer ?? null,
        incidencia_id: r.incidencia_id ?? null,
      })))
    } catch (e: unknown) {
      setError((e as { message?: string })?.message ?? 'Error al cargar manifiestos M38')
    } finally { setLoading(false) }
  }, [profile?.org_id, userId])

  useEffect(() => { cargar() }, [cargar])
  return { manifiestos, loading, error, refetch: cargar }
}
