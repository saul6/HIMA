// PATRÓN INOCUIDAD M19 — registros mensuales de inspección pre-operacional (Cuarto Frío)
// Espejo de M11 pero con tablas m19_* y valor SI/NO/NA.

import { useState, useEffect, useCallback } from 'react'
import { supabase } from '@/lib/supabase'
import { useAuthContext } from '@/context/AuthContext'

export interface M19RegistroResumen {
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

export interface M19DiaConResultados {
  id: string
  fecha: string
  resultados: {
    item_id: string
    valor: string            // 'SI' | 'NO' | 'NA'
    codigo_correctivo: string | null
    incidencia_id: string | null
  }[]
}

export function useM19InspeccionPreoperacional() {
  const { profile } = useAuthContext()
  const [registros, setRegistros] = useState<M19RegistroResumen[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  const cargar = useCallback(async () => {
    if (!profile?.org_id) { setLoading(false); return }
    setLoading(true)
    setError(null)
    try {
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const { data, error: err } = await (supabase as any)
        .from('m19_registro_mensual')
        .select('*, ranchos(nombre, codigo)')
        .eq('org_id', profile.org_id)
        .order('mes', { ascending: false })
        .order('created_at', { ascending: false })
      if (err) throw err

      const lista: M19RegistroResumen[] = ((data ?? []) as any[]).map((r) => ({
        id: r.id,
        rancho_id: r.rancho_id,
        rancho_nombre: r.ranchos?.nombre ?? '—',
        rancho_codigo: r.ranchos?.codigo ?? '—',
        mes: `${r.anio}-${String(r.mes).padStart(2, '0')}-01`,
        realizado_por_nombre: r.realizado_por_nombre ?? null,
        responsable_id: r.responsable_id ?? null,
        observaciones: r.observaciones ?? null,
        created_at: r.created_at,
      }))
      setRegistros(lista)
    } catch (e: unknown) {
      setError(e instanceof Error ? e.message : 'Error al cargar registros M19')
    } finally {
      setLoading(false)
    }
  }, [profile?.org_id])

  useEffect(() => { cargar() }, [cargar])

  return { registros, loading, error, refetch: cargar }
}
