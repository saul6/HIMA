// PATRÓN INOCUIDAD M11 — registros mensuales de inspección preoperacional
// Carga m11_registro_mensual con join a ranchos.

import { useState, useEffect, useCallback } from 'react'
import { supabase } from '@/lib/supabase'
import { useAuthContext } from '@/context/AuthContext'

export interface M11RegistroResumen {
  id: string
  rancho_id: string
  rancho_nombre: string
  rancho_codigo: string
  mes: string               // "2026-06-01"
  realizado_por_nombre: string | null
  responsable_id: string | null
  observaciones: string | null
  created_at: string
}

export interface M11DiaConResultados {
  id: string
  fecha: string
  resultados: { item_id: string; valor: string; codigo_correctivo: string | null }[]
}

export function useM11Preoperacional() {
  const { profile } = useAuthContext()
  const [registros, setRegistros] = useState<M11RegistroResumen[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  const cargar = useCallback(async () => {
    if (!profile?.org_id) { setLoading(false); return }
    setLoading(true)
    setError(null)
    try {
      const { data, error: err } = await supabase
        .from('m11_registro_mensual')
        .select('*, ranchos(nombre, codigo)')
        .eq('org_id', profile.org_id)
        .order('mes', { ascending: false })
        .order('created_at', { ascending: false })
      if (err) throw err

      const lista: M11RegistroResumen[] = ((data ?? []) as any[]).map((r) => ({
        id: r.id,
        rancho_id: r.rancho_id,
        rancho_nombre: r.ranchos?.nombre ?? '—',
        rancho_codigo: r.ranchos?.codigo ?? '—',
        mes: r.mes as string,
        realizado_por_nombre: r.realizado_por_nombre ?? null,
        responsable_id: r.responsable_id ?? null,
        observaciones: r.observaciones ?? null,
        created_at: r.created_at,
      }))
      setRegistros(lista)
    } catch (e: unknown) {
      setError(e instanceof Error ? e.message : 'Error al cargar registros M11')
    } finally {
      setLoading(false)
    }
  }, [profile?.org_id])

  useEffect(() => { cargar() }, [cargar])

  return { registros, loading, error, refetch: cargar }
}
