// PATRÓN INOCUIDAD M73 — Inventario de Material de Curación (Botiquín GlobalGAP)
// Tabla plana con detalle de materiales por registro
// org_id SIEMPRE del contexto de auth, nunca del input

import { useState, useEffect, useCallback } from 'react'
import { supabase } from '@/lib/supabase'
import { useAuthContext } from '@/context/AuthContext'
import { leerConCache } from '@/lib/offline/cacheLectura'

// eslint-disable-next-line @typescript-eslint/no-explicit-any
const tbl = (name: string) => (supabase as any).from(name)

export interface M73RegistroResumen {
  id: string
  rancho_id: string
  rancho_nombre: string
  fecha: string
  botiquin_num: string | null
  realizo: string | null
  observaciones: string | null
  total_materiales: number
  creado_por: string | null
  created_at: string
}

export interface M73ItemCatalogo {
  id: string
  nombre: string
}

export interface M73Resultado {
  id?: string
  registro_id: string
  material_id: string | null
  material_otro: string | null
  sale: number | null
  entra: number | null
  total: number | null
  usuario: string | null
}

export function useM73BotiquinGG() {
  const { profile, user } = useAuthContext()
  const userId = user?.id ?? null
  const [registros, setRegistros] = useState<M73RegistroResumen[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  const cargar = useCallback(async () => {
    if (!profile?.org_id || !userId) { setLoading(false); return }
    const orgId = profile.org_id
    setLoading(true)
    setError(null)
    try {
      const resultado = await leerConCache(
        'm73_registro',
        userId,
        orgId,
        async () => {
          const { data, error: err } = await tbl('m73_registro')
            .select('*, ranchos(nombre), m73_resultados(count)')
            .eq('org_id', orgId)
            .order('fecha', { ascending: false })
            .order('created_at', { ascending: false })
          if (err) throw err
          return data ?? []
        },
      )

      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const lista: M73RegistroResumen[] = (resultado.datos as any[]).map((r) => ({
        id: r.id,
        rancho_id: r.rancho_id,
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        rancho_nombre: (r.ranchos as any)?.nombre ?? '—',
        fecha: r.fecha,
        botiquin_num: r.botiquin_num ?? null,
        realizo: r.realizo ?? null,
        observaciones: r.observaciones ?? null,
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        total_materiales: (r.m73_resultados as any)?.[0]?.count ?? 0,
        creado_por: r.creado_por ?? null,
        created_at: r.created_at,
      }))
      setRegistros(lista)
    } catch (e: unknown) {
      setError((e as { message?: string })?.message ?? 'Error al cargar registros M73')
    } finally {
      setLoading(false)
    }
  }, [profile?.org_id, userId])

  useEffect(() => { cargar() }, [cargar])

  return { registros, loading, error, refetch: cargar }
}

export function useM73Catalogo() {
  const { user, profile } = useAuthContext()
  const userId = user?.id ?? null
  const orgId = profile?.org_id ?? null
  const [items, setItems] = useState<M73ItemCatalogo[]>([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    if (!userId || !orgId) { setLoading(false); return }
    let cancelado = false
    setLoading(true)
    leerConCache(
      'm73_botiquin_catalogo',
      userId,
      orgId,
      async () => {
        const { data, error } = await tbl('m73_botiquin_catalogo')
          .select('id, nombre')
          .eq('activo', true)
          .order('orden')
        if (error) throw error
        return (data ?? []) as M73ItemCatalogo[]
      },
    )
      .then((r) => { if (!cancelado) setItems(r.datos) })
      .catch(() => { if (!cancelado) setItems([]) })
      .finally(() => { if (!cancelado) setLoading(false) })
    return () => { cancelado = true }
  }, [userId, orgId])

  return { items, loading }
}

export async function cargarM73Resultados(
  registroId: string,
  orgId: string,
): Promise<M73Resultado[]> {
  const { data, error } = await tbl('m73_resultados')
    .select('id, registro_id, material_id, material_otro, sale, entra, total, usuario')
    .eq('registro_id', registroId)
    .eq('org_id', orgId)
  if (error) throw error
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  return ((data ?? []) as any[]).map((r) => ({
    id: r.id as string,
    registro_id: r.registro_id as string,
    material_id: r.material_id ?? null,
    material_otro: r.material_otro ?? null,
    sale: r.sale ?? null,
    entra: r.entra ?? null,
    total: r.total ?? null,
    usuario: r.usuario ?? null,
  }))
}
