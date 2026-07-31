// PATRÓN INOCUIDAD M20 — Registro de Accidentes Laborales (Cuarto Frío)
// org_id SIEMPRE del contexto de auth.

import { useState, useEffect, useCallback } from 'react'
import { supabase } from '@/lib/supabase'
import { useAuthContext } from '@/context/AuthContext'

export interface M20FotoRef {
  id: string
  storage_path: string
  orden: number
}

export interface M20AccidenteConFotos {
  id: string
  rancho_id: string
  rancho_nombre: string
  rancho_codigo: string
  fecha: string
  trabajador_nombre: string
  descripcion_incidente: string
  atencion_recibida: string[]
  requirio_incapacidad: boolean
  incapacidad_motivo: string | null
  requirio_limpieza: boolean
  limpieza_descripcion: string | null
  producto_involucrado: boolean
  disposicion_producto: string | null
  fotos: M20FotoRef[]
  created_at: string
}

export function useM20Accidentes() {
  const { profile } = useAuthContext()
  const [accidentes, setAccidentes] = useState<M20AccidenteConFotos[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  const cargar = useCallback(async () => {
    if (!profile?.org_id) { setLoading(false); return }
    setLoading(true)
    setError(null)
    try {
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const { data, error: err } = await (supabase as any)
        .from('m20_accidentes')
        .select('*, ranchos(nombre, codigo), m20_accidente_fotos(id, storage_path, orden)')
        .eq('org_id', profile.org_id)
        .order('fecha', { ascending: false })
        .order('created_at', { ascending: false })
      if (err) throw err

      const lista: M20AccidenteConFotos[] = ((data ?? []) as any[]).map((r: any) => ({
        id: r.id,
        rancho_id: r.rancho_id,
        rancho_nombre: r.ranchos?.nombre ?? '—',
        rancho_codigo: r.ranchos?.codigo ?? '—',
        fecha: r.fecha,
        trabajador_nombre: r.trabajador_nombre ?? '—',
        descripcion_incidente: r.descripcion_incidente ?? '',
        atencion_recibida: r.atencion_recibida ?? [],
        requirio_incapacidad: r.requirio_incapacidad ?? false,
        incapacidad_motivo: r.incapacidad_motivo ?? null,
        requirio_limpieza: r.requirio_limpieza ?? false,
        limpieza_descripcion: r.limpieza_descripcion ?? null,
        producto_involucrado: r.producto_involucrado ?? false,
        disposicion_producto: r.disposicion_producto ?? null,
        fotos: ((r.m20_accidente_fotos ?? []) as any[])
          .sort((a: any, b: any) => a.orden - b.orden)
          .map((f: any) => ({ id: f.id, storage_path: f.storage_path, orden: f.orden })),
        created_at: r.created_at,
      }))
      setAccidentes(lista)
    } catch (e: unknown) {
      setError(e instanceof Error ? e.message : 'Error al cargar registros M20')
    } finally {
      setLoading(false)
    }
  }, [profile?.org_id])

  useEffect(() => { cargar() }, [cargar])

  return { accidentes, loading, error, refetch: cargar }
}
