// PATRÓN INOCUIDAD M76 — Verificación y Mantenimiento de Equipos (REG-09)
// Bitácora plana
// org_id SIEMPRE del contexto de auth, nunca del input

import { useState, useEffect, useCallback } from 'react'
import { supabase } from '@/lib/supabase'
import { useAuthContext } from '@/context/AuthContext'

// eslint-disable-next-line @typescript-eslint/no-explicit-any
const tbl = (name: string) => (supabase as any).from(name)

export interface M76MantenimientoRegistro {
  id: string
  rancho_id: string
  rancho_nombre: string
  fecha: string
  equipo: string | null
  realizo: string | null
  tipo_actividad: 'verificacion' | 'preventivo' | 'correctivo' | null
  fugas_tanque_bomba: string | null
  mangueras: string | null
  pistola: string | null
  lanzas: string | null
  boquillas: string | null
  descripcion_trabajo: string | null
  observaciones: string | null
  creado_por: string | null
  created_at: string
}

export function useM76MantenimientoEquiposGG() {
  const { profile } = useAuthContext()
  const [registros, setRegistros] = useState<M76MantenimientoRegistro[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  const cargar = useCallback(async () => {
    if (!profile?.org_id) { setLoading(false); return }
    setLoading(true)
    setError(null)
    try {
      const { data, error: err } = await tbl('m76_mantenimiento_equipos')
        .select('*, ranchos(nombre)')
        .eq('org_id', profile.org_id)
        .order('fecha', { ascending: false })
        .order('created_at', { ascending: false })
      if (err) throw err

      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const lista: M76MantenimientoRegistro[] = ((data ?? []) as any[]).map((r) => ({
        id: r.id,
        rancho_id: r.rancho_id,
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        rancho_nombre: (r.ranchos as any)?.nombre ?? '—',
        fecha: r.fecha,
        equipo: r.equipo ?? null,
        realizo: r.realizo ?? null,
        tipo_actividad: r.tipo_actividad ?? null,
        fugas_tanque_bomba: r.fugas_tanque_bomba ?? null,
        mangueras: r.mangueras ?? null,
        pistola: r.pistola ?? null,
        lanzas: r.lanzas ?? null,
        boquillas: r.boquillas ?? null,
        descripcion_trabajo: r.descripcion_trabajo ?? null,
        observaciones: r.observaciones ?? null,
        creado_por: r.creado_por ?? null,
        created_at: r.created_at,
      }))
      setRegistros(lista)
    } catch (e: unknown) {
      setError(e instanceof Error ? e.message : 'Error al cargar registros M76')
    } finally {
      setLoading(false)
    }
  }, [profile?.org_id])

  useEffect(() => { cargar() }, [cargar])

  return { registros, loading, error, refetch: cargar }
}
