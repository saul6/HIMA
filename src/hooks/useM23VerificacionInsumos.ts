import { useState, useEffect, useCallback } from 'react'
import { supabase } from '@/lib/supabase'
import { useAuthContext } from '@/context/AuthContext'

export interface M23RegistroResumen {
  id: string
  rancho_id: string
  rancho_nombre: string
  rancho_codigo: string
  mes: string
  verifico_nombre: string | null
  autorizo_nombre: string | null
  observaciones: string | null
  created_at: string
}

export interface M23DiaConResultados {
  id: string
  fecha: string
  resultados: {
    insumo_id: string
    valor: string
    codigo_correctivo: string | null
    incidencia_id: string | null
  }[]
}

export interface M23Insumo {
  id: string
  area: string
  insumo: string
  activo: boolean
  orden: number
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any
const tbl = (name: string) => (supabase as any).from(name)

export function useM23VerificacionInsumos() {
  const { profile } = useAuthContext()
  const [registros, setRegistros] = useState<M23RegistroResumen[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  const cargar = useCallback(async () => {
    if (!profile?.org_id) { setLoading(false); return }
    setLoading(true)
    setError(null)
    try {
      const { data, error: err } = await tbl('m23_registro_mensual')
        .select('*, ranchos(nombre, codigo)')
        .eq('org_id', profile.org_id)
        .order('mes', { ascending: false })
        .order('created_at', { ascending: false })
      if (err) throw err
      setRegistros(
        ((data ?? []) as any[]).map((r) => ({
          id: r.id,
          rancho_id: r.rancho_id,
          rancho_nombre: r.ranchos?.nombre ?? '—',
          rancho_codigo: r.ranchos?.codigo ?? '—',
          mes: r.mes as string,
          verifico_nombre: r.verifico_nombre ?? null,
          autorizo_nombre: r.autorizo_nombre ?? null,
          observaciones: r.observaciones ?? null,
          created_at: r.created_at,
        }))
      )
    } catch (e: unknown) {
      setError(e instanceof Error ? e.message : 'Error al cargar registros M23')
    } finally {
      setLoading(false)
    }
  }, [profile?.org_id])

  useEffect(() => { cargar() }, [cargar])
  return { registros, loading, error, refetch: cargar }
}

export function useM23Insumos(ranchoId: string | null, orgId: string | null) {
  const [insumos, setInsumos] = useState<M23Insumo[]>([])
  const [loading, setLoading] = useState(false)

  const cargar = useCallback(async () => {
    if (!ranchoId || !orgId) { setInsumos([]); return }
    setLoading(true)
    const { data } = await tbl('m23_insumos')
      .select('id, area, insumo, activo, orden')
      .eq('org_id', orgId)
      .eq('rancho_id', ranchoId)
      .order('area')
      .order('orden')
    setInsumos((data ?? []) as M23Insumo[])
    setLoading(false)
  }, [ranchoId, orgId])

  useEffect(() => { cargar() }, [cargar])
  return { insumos, loading, refetch: cargar }
}
