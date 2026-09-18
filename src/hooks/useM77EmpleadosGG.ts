// PATRÓN INOCUIDAD M77 — Identificación de Empleados (REG-ASIP-26)
// Directorio plano de empleados por organización
// org_id SIEMPRE del contexto de auth, nunca del input

import { useState, useEffect, useCallback } from 'react'
import { supabase } from '@/lib/supabase'
import { useAuthContext } from '@/context/AuthContext'

// eslint-disable-next-line @typescript-eslint/no-explicit-any
const tbl = (name: string) => (supabase as any).from(name)

export interface M77EmpleadoRegistro {
  id: string
  rancho_id: string
  rancho_nombre: string
  nombre: string
  fecha_ingreso: string | null
  telefono: string | null
  domicilio: string | null
  persona_contacto: string | null
  observaciones: string | null
  creado_por: string | null
  created_at: string
}

export function useM77EmpleadosGG() {
  const { profile } = useAuthContext()
  const [registros, setRegistros] = useState<M77EmpleadoRegistro[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  const cargar = useCallback(async () => {
    if (!profile?.org_id) { setLoading(false); return }
    setLoading(true)
    setError(null)
    try {
      const { data, error: err } = await tbl('m77_empleados')
        .select('*, ranchos(nombre)')
        .eq('org_id', profile.org_id)
        .order('nombre', { ascending: true })
      if (err) throw err

      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const lista: M77EmpleadoRegistro[] = ((data ?? []) as any[]).map((r) => ({
        id: r.id,
        rancho_id: r.rancho_id,
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        rancho_nombre: (r.ranchos as any)?.nombre ?? '—',
        nombre: r.nombre,
        fecha_ingreso: r.fecha_ingreso ?? null,
        telefono: r.telefono ?? null,
        domicilio: r.domicilio ?? null,
        persona_contacto: r.persona_contacto ?? null,
        observaciones: r.observaciones ?? null,
        creado_por: r.creado_por ?? null,
        created_at: r.created_at,
      }))
      setRegistros(lista)
    } catch (e: unknown) {
      setError(e instanceof Error ? e.message : 'Error al cargar registros M77')
    } finally {
      setLoading(false)
    }
  }, [profile?.org_id])

  useEffect(() => { cargar() }, [cargar])

  return { registros, loading, error, refetch: cargar }
}
