// PATRÓN INOCUIDAD M71 — Limpieza y Desinfección en Campo (REG-10)
// Matriz mensual: ítems × días 1–31 con valores si/no/na
// org_id SIEMPRE del contexto de auth, nunca del input

import { useState, useEffect, useCallback } from 'react'
import { supabase } from '@/lib/supabase'
import { useAuthContext } from '@/context/AuthContext'

// eslint-disable-next-line @typescript-eslint/no-explicit-any
const tbl = (name: string) => (supabase as any).from(name)

export interface M71RegistroResumen {
  id: string
  rancho_id: string
  rancho_nombre: string
  mes: string          // "2026-06-01"
  realizo: string | null
  observaciones: string | null
  created_at: string
}

export interface M71ItemCatalogo {
  id: string
  seccion: string
  numero: number
  texto: string
}

export interface M71Resultado {
  item_id: string
  dia: number   // 1..31
  valor: string // 'si'|'no'|'na'
}

export function useM71LimpiezaCampo() {
  const { profile } = useAuthContext()
  const [registros, setRegistros] = useState<M71RegistroResumen[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  const cargar = useCallback(async () => {
    if (!profile?.org_id) { setLoading(false); return }
    setLoading(true)
    setError(null)
    try {
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const { data, error: err } = await tbl('m71_registro')
        .select('*, ranchos(nombre)')
        .eq('org_id', profile.org_id)
        .order('mes', { ascending: false })
        .order('created_at', { ascending: false })
      if (err) throw err

      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const lista: M71RegistroResumen[] = ((data ?? []) as any[]).map((r) => ({
        id: r.id,
        rancho_id: r.rancho_id,
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        rancho_nombre: (r.ranchos as any)?.nombre ?? '—',
        mes: r.mes,
        realizo: r.realizo ?? null,
        observaciones: r.observaciones ?? null,
        created_at: r.created_at,
      }))
      setRegistros(lista)
    } catch (e: unknown) {
      setError(e instanceof Error ? e.message : 'Error al cargar registros M71')
    } finally {
      setLoading(false)
    }
  }, [profile?.org_id])

  useEffect(() => { cargar() }, [cargar])

  return { registros, loading, error, refetch: cargar }
}

export function useM71ItemsCatalogo() {
  const [items, setItems] = useState<M71ItemCatalogo[]>([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    let cancelado = false
    setLoading(true)
    tbl('m71_items_catalogo')
      .select('id, seccion, numero, texto')
      .eq('activo', true)
      .order('numero')
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      .then(({ data }: { data: any[] | null }) => {
        if (!cancelado) {
          setItems((data ?? []) as M71ItemCatalogo[])
          setLoading(false)
        }
      })
    return () => { cancelado = true }
  }, [])

  return { items, loading }
}

export async function cargarM71Resultados(
  registroId: string,
  orgId: string,
): Promise<M71Resultado[]> {
  const { data, error } = await tbl('m71_resultados')
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
