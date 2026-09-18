// PATRÓN INOCUIDAD M75 — Inspección de Almacén de Material de Empaque (REG-22)
// Matriz mensual: ítems × días 1–31 con valores si/no/na + acciones por día
// org_id SIEMPRE del contexto de auth, nunca del input

import { useState, useEffect, useCallback } from 'react'
import { supabase } from '@/lib/supabase'
import { useAuthContext } from '@/context/AuthContext'

// eslint-disable-next-line @typescript-eslint/no-explicit-any
const tbl = (name: string) => (supabase as any).from(name)

export interface M75RegistroResumen {
  id: string
  rancho_id: string
  rancho_nombre: string
  mes: string          // "2026-06-01"
  cultivo: string | null
  realizo: string | null
  observaciones: string | null
  creado_por: string | null
  created_at: string
}

export interface M75ItemCatalogo {
  id: string
  numero: number
  texto: string
}

export interface M75Resultado {
  item_id: string
  dia: number   // 1..31
  valor: string // 'si'|'no'|'na'
}

export interface M75Accion {
  dia: number
  texto: string
}

export function useM75AlmacenEmpaqueGG() {
  const { profile } = useAuthContext()
  const [registros, setRegistros] = useState<M75RegistroResumen[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  const cargar = useCallback(async () => {
    if (!profile?.org_id) { setLoading(false); return }
    setLoading(true)
    setError(null)
    try {
      const { data, error: err } = await tbl('m75_registro')
        .select('*, ranchos(nombre)')
        .eq('org_id', profile.org_id)
        .order('mes', { ascending: false })
        .order('created_at', { ascending: false })
      if (err) throw err

      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const lista: M75RegistroResumen[] = ((data ?? []) as any[]).map((r) => ({
        id: r.id,
        rancho_id: r.rancho_id,
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        rancho_nombre: (r.ranchos as any)?.nombre ?? '—',
        mes: r.mes,
        cultivo: r.cultivo ?? null,
        realizo: r.realizo ?? null,
        observaciones: r.observaciones ?? null,
        creado_por: r.creado_por ?? null,
        created_at: r.created_at,
      }))
      setRegistros(lista)
    } catch (e: unknown) {
      setError(e instanceof Error ? e.message : 'Error al cargar registros M75')
    } finally {
      setLoading(false)
    }
  }, [profile?.org_id])

  useEffect(() => { cargar() }, [cargar])

  return { registros, loading, error, refetch: cargar }
}

export function useM75ItemsCatalogo() {
  const [items, setItems] = useState<M75ItemCatalogo[]>([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    let cancelado = false
    setLoading(true)
    tbl('m75_items_catalogo')
      .select('id, numero, texto')
      .eq('activo', true)
      .order('numero')
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      .then(({ data }: { data: any[] | null }) => {
        if (!cancelado) {
          setItems((data ?? []) as M75ItemCatalogo[])
          setLoading(false)
        }
      })
    return () => { cancelado = true }
  }, [])

  return { items, loading }
}

export async function cargarM75Resultados(
  registroId: string,
  orgId: string,
): Promise<M75Resultado[]> {
  const { data, error } = await tbl('m75_resultados')
    .select('item_id, dia, valor')
    .eq('registro_id', registroId)
    .eq('org_id', orgId)
  if (error) throw error
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  return ((data ?? []) as any[]).map((r) => ({
    item_id: r.item_id as string,
    dia: r.dia as number,
    valor: r.valor as string,
  }))
}

export async function cargarM75Acciones(
  registroId: string,
  orgId: string,
): Promise<M75Accion[]> {
  const { data, error } = await tbl('m75_acciones')
    .select('dia, texto')
    .eq('registro_id', registroId)
    .eq('org_id', orgId)
  if (error) throw error
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  return ((data ?? []) as any[]).map((r) => ({
    dia: r.dia as number,
    texto: r.texto as string,
  }))
}
