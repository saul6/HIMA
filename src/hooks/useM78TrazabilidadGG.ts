// PATRÓN INOCUIDAD M78 — Nota de Trazabilidad (salida de producto)
// Bitácora plana
// org_id SIEMPRE del contexto de auth, nunca del input

import { useState, useEffect, useCallback } from 'react'
import { supabase } from '@/lib/supabase'
import { useAuthContext } from '@/context/AuthContext'

// eslint-disable-next-line @typescript-eslint/no-explicit-any
const tbl = (name: string) => (supabase as any).from(name)

export interface M78TrazabilidadRegistro {
  id: string
  rancho_id: string
  rancho_nombre: string
  folio: string | null
  fecha: string
  productor: string | null
  hora_salida: string | null
  num_camion: string | null
  zona: string | null
  sector: string | null
  cultivo: string | null
  presentacion: string | null
  otro_presentacion: string | null
  peso_bruto: number | null
  peso_neto: number | null
  total_producto: string | null
  embarco: string | null
  chofer: string | null
  recibio: string | null
  observaciones: string | null
  creado_por: string | null
  created_at: string
}

export function useM78TrazabilidadGG() {
  const { profile } = useAuthContext()
  const [registros, setRegistros] = useState<M78TrazabilidadRegistro[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  const cargar = useCallback(async () => {
    if (!profile?.org_id) { setLoading(false); return }
    setLoading(true)
    setError(null)
    try {
      const { data, error: err } = await tbl('m78_nota_trazabilidad')
        .select('*, ranchos(nombre)')
        .eq('org_id', profile.org_id)
        .order('fecha', { ascending: false })
        .order('created_at', { ascending: false })
      if (err) throw err

      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const lista: M78TrazabilidadRegistro[] = ((data ?? []) as any[]).map((r) => ({
        id: r.id,
        rancho_id: r.rancho_id,
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        rancho_nombre: (r.ranchos as any)?.nombre ?? '—',
        folio: r.folio ?? null,
        fecha: r.fecha,
        productor: r.productor ?? null,
        hora_salida: r.hora_salida ?? null,
        num_camion: r.num_camion ?? null,
        zona: r.zona ?? null,
        sector: r.sector ?? null,
        cultivo: r.cultivo ?? null,
        presentacion: r.presentacion ?? null,
        otro_presentacion: r.otro_presentacion ?? null,
        peso_bruto: r.peso_bruto ?? null,
        peso_neto: r.peso_neto ?? null,
        total_producto: r.total_producto ?? null,
        embarco: r.embarco ?? null,
        chofer: r.chofer ?? null,
        recibio: r.recibio ?? null,
        observaciones: r.observaciones ?? null,
        creado_por: r.creado_por ?? null,
        created_at: r.created_at,
      }))
      setRegistros(lista)
    } catch (e: unknown) {
      setError(e instanceof Error ? e.message : 'Error al cargar registros M78')
    } finally {
      setLoading(false)
    }
  }, [profile?.org_id])

  useEffect(() => { cargar() }, [cargar])

  return { registros, loading, error, refetch: cargar }
}
