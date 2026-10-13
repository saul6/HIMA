import { useState, useEffect, useCallback } from 'react'
import { supabase } from '@/lib/supabase'
import { useAuthContext } from '@/context/AuthContext'
import { leerConCache } from '@/lib/offline/cacheLectura'

export interface M72Registro {
  id: string
  rancho_id: string
  rancho_nombre: string
  fecha: string
  etapa_fenologica: string | null
  realizo: string | null
  beneficos: string | null
  observaciones: string | null
  created_at: string
}

export interface M72Organismo {
  id: string
  tipo: 'plaga' | 'enfermedad'
  nombre: string
}

export interface M72Resultado {
  id: string
  registro_id: string
  sector: string
  num_planta: number
  organismo_id: string
  conteo: number
  comentario: string | null
}

export function useM72MonitoreoPlaguasEnfermedades(orgId: string | null) {
  const [registros, setRegistros] = useState<M72Registro[]>([])
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const { user } = useAuthContext()
  const userId = user?.id ?? null

  const fetch = useCallback(async () => {
    if (!orgId || !userId) return
    setLoading(true)
    setError(null)
    try {
      const resultado = await leerConCache(
        'm72_registro',
        userId,
        orgId,
        async () => {
          const { data, error: err } = await (supabase as any)
            .from('m72_registro')
            .select('*, ranchos(nombre)')
            .eq('org_id', orgId)
            .order('fecha', { ascending: false })
            .order('created_at', { ascending: false })
          if (err) throw err
          return data ?? []
        },
      )
      setRegistros(
        (resultado.datos as any[]).map((r: any) => ({
          ...r,
          rancho_nombre: r.ranchos?.nombre ?? '—',
        }))
      )
    } catch (e: unknown) {
      setError((e as { message?: string })?.message ?? 'Error al cargar registros')
    } finally {
      setLoading(false)
    }
  }, [orgId, userId])

  useEffect(() => { fetch() }, [fetch])

  return { registros, loading, error, refetch: fetch }
}

export function useM72Organismos() {
  const { user, profile } = useAuthContext()
  const userId = user?.id ?? null
  const orgId = profile?.org_id ?? null
  const [organismos, setOrganismos] = useState<M72Organismo[]>([])
  const [loading, setLoading] = useState(false)

  useEffect(() => {
    if (!userId || !orgId) return
    setLoading(true)
    leerConCache(
      'm72_organismos',
      userId,
      orgId,
      async () => {
        const { data, error } = await (supabase as any)
          .from('m72_organismos')
          .select('id, tipo, nombre')
          .eq('activo', true)
          .order('tipo', { ascending: true })
          .order('nombre', { ascending: true })
        if (error) throw error
        return (data ?? []) as M72Organismo[]
      },
    )
      .then((r) => setOrganismos(r.datos))
      .catch(() => setOrganismos([]))
      .finally(() => setLoading(false))
  }, [userId, orgId])

  return { organismos, loading }
}
