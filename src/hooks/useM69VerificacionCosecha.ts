// PATRÓN INOCUIDAD M69 — Verificación Diaria de Cosecha (REG-13)
// Matriz mensual: ítems × días 1–31 con valores si/no/na
// org_id SIEMPRE del contexto de auth, nunca del input

import { useState, useEffect, useCallback } from 'react'
import { supabase } from '@/lib/supabase'
import { useAuthContext } from '@/context/AuthContext'

// eslint-disable-next-line @typescript-eslint/no-explicit-any
const tbl = (name: string) => (supabase as any).from(name)

export interface M69RegistroResumen {
  id: string
  rancho_id: string
  rancho_nombre: string
  mes: string          // "2026-06-01"
  codigo: string | null
  cultivo: string | null
  realizo: string | null
  observaciones: string | null
  created_at: string
}

export interface M69ItemCatalogo {
  id: string
  seccion: string
  numero: number
  texto: string
}

export interface M69Resultado {
  item_id: string
  dia: number   // 1..31
  valor: string // 'si'|'no'|'na'
}

export function useM69VerificacionCosecha() {
  const { profile } = useAuthContext()
  const [registros, setRegistros] = useState<M69RegistroResumen[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  const cargar = useCallback(async () => {
    if (!profile?.org_id) { setLoading(false); return }
    setLoading(true)
    setError(null)
    try {
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const { data, error: err } = await tbl('m69_registro')
        .select('*, ranchos(nombre)')
        .eq('org_id', profile.org_id)
        .order('mes', { ascending: false })
        .order('created_at', { ascending: false })
      if (err) throw err

      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const lista: M69RegistroResumen[] = ((data ?? []) as any[]).map((r) => ({
        id: r.id,
        rancho_id: r.rancho_id,
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        rancho_nombre: (r.ranchos as any)?.nombre ?? '—',
        mes: r.mes,
        codigo: r.codigo ?? null,
        cultivo: r.cultivo ?? null,
        realizo: r.realizo ?? null,
        observaciones: r.observaciones ?? null,
        created_at: r.created_at,
      }))
      setRegistros(lista)
    } catch (e: unknown) {
      setError(e instanceof Error ? e.message : 'Error al cargar registros M69')
    } finally {
      setLoading(false)
    }
  }, [profile?.org_id])

  useEffect(() => { cargar() }, [cargar])

  return { registros, loading, error, refetch: cargar }
}

export function useM69ItemsCatalogo() {
  const [items, setItems] = useState<M69ItemCatalogo[]>([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    let cancelado = false
    setLoading(true)
    tbl('m69_items_catalogo')
      .select('id, seccion, numero, texto')
      .eq('activo', true)
      .order('numero')
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      .then(({ data }: { data: any[] | null }) => {
        if (!cancelado) {
          setItems((data ?? []) as M69ItemCatalogo[])
          setLoading(false)
        }
      })
    return () => { cancelado = true }
  }, [])

  return { items, loading }
}

export async function cargarM69Resultados(
  registroId: string,
  orgId: string,
): Promise<M69Resultado[]> {
  const { data, error } = await tbl('m69_resultados')
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
