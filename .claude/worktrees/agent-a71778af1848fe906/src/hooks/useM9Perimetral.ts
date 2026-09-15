// PATRÓN INOCUIDAD M9 — registros mensuales de monitoreo perimetral
// Carga m9_registro_mensual con join a ranchos y responsable.

import { useState, useEffect, useCallback } from 'react'
import { supabase } from '@/lib/supabase'
import { useAuthContext } from '@/context/AuthContext'

export interface M9RegistroResumen {
  id: string
  rancho_id: string
  rancho_nombre: string
  rancho_codigo: string
  mes: string               // "2026-06-01"
  tiene_almacen: boolean
  responsable_id: string | null
  responsable_nombre: string | null
  observaciones: string | null
  otro: string | null
  created_at: string
}

export interface M9DiaConResultados {
  id: string
  fecha: string
  resultados: { item_id: string; valor: boolean }[]
}

export function useM9Perimetral() {
  const { profile } = useAuthContext()
  const [registros, setRegistros] = useState<M9RegistroResumen[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  const cargar = useCallback(async () => {
    if (!profile?.org_id) { setLoading(false); return }
    setLoading(true)
    setError(null)
    try {
      const { data, error: err } = await supabase
        .from('m9_registro_mensual')
        .select('*, ranchos(nombre, codigo), profiles!responsable_id(nombre_completo)')
        .eq('org_id', profile.org_id)
        .order('mes', { ascending: false })
        .order('created_at', { ascending: false })
      if (err) throw err

      const lista: M9RegistroResumen[] = ((data ?? []) as any[]).map((r) => ({
        id: r.id,
        rancho_id: r.rancho_id,
        rancho_nombre: r.ranchos?.nombre ?? '—',
        rancho_codigo: r.ranchos?.codigo ?? '—',
        mes: r.mes as string,
        tiene_almacen: r.tiene_almacen,
        responsable_id: r.responsable_id,
        responsable_nombre: (r.profiles as any)?.nombre_completo ?? null,
        observaciones: r.observaciones,
        otro: r.otro,
        created_at: r.created_at,
      }))
      setRegistros(lista)
    } catch (e: unknown) {
      setError(e instanceof Error ? e.message : 'Error al cargar registros M9')
    } finally {
      setLoading(false)
    }
  }, [profile?.org_id])

  useEffect(() => { cargar() }, [cargar])

  return { registros, loading, error, refetch: cargar }
}
