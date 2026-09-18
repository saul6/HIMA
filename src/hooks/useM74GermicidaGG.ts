// PATRÓN INOCUIDAD M74 — Monitoreo de Solución Germicida (REG-10.1)
// Bitácora plana con 3 tomas por registro
// org_id SIEMPRE del contexto de auth, nunca del input

import { useState, useEffect, useCallback } from 'react'
import { supabase } from '@/lib/supabase'
import { useAuthContext } from '@/context/AuthContext'

// eslint-disable-next-line @typescript-eslint/no-explicit-any
const tbl = (name: string) => (supabase as any).from(name)

export interface M74GermicidaRegistro {
  id: string
  rancho_id: string
  rancho_nombre: string
  producto: string | null
  fecha: string
  material_utilizado: string | null
  sector: string | null
  hora1: string | null
  ppm1: number | null
  ajuste1: string | null
  hora2: string | null
  ppm2: number | null
  ajuste2: string | null
  hora3: string | null
  ppm3: number | null
  ajuste3: string | null
  realizo: string | null
  observaciones: string | null
  creado_por: string | null
  created_at: string
}

export function useM74GermicidaGG() {
  const { profile } = useAuthContext()
  const [registros, setRegistros] = useState<M74GermicidaRegistro[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  const cargar = useCallback(async () => {
    if (!profile?.org_id) { setLoading(false); return }
    setLoading(true)
    setError(null)
    try {
      const { data, error: err } = await tbl('m74_germicida')
        .select('*, ranchos(nombre)')
        .eq('org_id', profile.org_id)
        .order('fecha', { ascending: false })
        .order('created_at', { ascending: false })
      if (err) throw err

      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const lista: M74GermicidaRegistro[] = ((data ?? []) as any[]).map((r) => ({
        id: r.id,
        rancho_id: r.rancho_id,
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        rancho_nombre: (r.ranchos as any)?.nombre ?? '—',
        producto: r.producto ?? null,
        fecha: r.fecha,
        material_utilizado: r.material_utilizado ?? null,
        sector: r.sector ?? null,
        hora1: r.hora1 ?? null,
        ppm1: r.ppm1 ?? null,
        ajuste1: r.ajuste1 ?? null,
        hora2: r.hora2 ?? null,
        ppm2: r.ppm2 ?? null,
        ajuste2: r.ajuste2 ?? null,
        hora3: r.hora3 ?? null,
        ppm3: r.ppm3 ?? null,
        ajuste3: r.ajuste3 ?? null,
        realizo: r.realizo ?? null,
        observaciones: r.observaciones ?? null,
        creado_por: r.creado_por ?? null,
        created_at: r.created_at,
      }))
      setRegistros(lista)
    } catch (e: unknown) {
      setError(e instanceof Error ? e.message : 'Error al cargar registros M74')
    } finally {
      setLoading(false)
    }
  }, [profile?.org_id])

  useEffect(() => { cargar() }, [cargar])

  return { registros, loading, error, refetch: cargar }
}
