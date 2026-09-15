// PATRÓN INOCUIDAD M10 — hook de datos
// Agrupa filas de m10_cosecha_liberacion por rancho_id + fecha para formar registros de jornada.

import { useState, useEffect, useCallback } from 'react'
import { supabase } from '@/lib/supabase'
import { useAuthContext } from '@/context/AuthContext'

export interface M10FilaLiberacion {
  id: string
  sector: string | null
  cantidad_bandejas: number | null
  lote_liberado: boolean
  numero_comprobante: string | null
  codigo_trazabilidad: string | null
  marca_embalaje: string | null
  destino_final: string | null
  fruta_proceso_kg: number | null
  encargado_liberacion_id: string | null
  encargado_nombre: string | null
  verificacion_semanal: boolean
  hora_inicio_cosecha: string | null
  hora_fin_cosecha: string | null
  observaciones: string | null
}

export interface M10Registro {
  rancho_id: string
  rancho_nombre: string
  rancho_codigo: string
  fecha: string
  liberaciones: M10FilaLiberacion[]
}

export function useM10CosechaLiberacion() {
  const { profile } = useAuthContext()
  const [registros, setRegistros] = useState<M10Registro[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  const cargar = useCallback(async () => {
    if (!profile?.org_id) { setLoading(false); return }
    setLoading(true)
    setError(null)
    try {
      const { data, error: err } = await supabase
        .from('m10_cosecha_liberacion')
        .select('*, ranchos(nombre, codigo), encargado:profiles!encargado_liberacion_id(nombre_completo)')
        .eq('org_id', profile.org_id)
        .order('fecha', { ascending: false })
        .order('created_at', { ascending: true })
        .limit(500)
      if (err) throw err

      const grouped = new Map<string, M10Registro>()
      for (const row of (data ?? [])) {
        const key = `${row.rancho_id}|${row.fecha}`
        if (!grouped.has(key)) {
          grouped.set(key, {
            rancho_id: row.rancho_id,
            rancho_nombre: (row as any).ranchos?.nombre ?? '—',
            rancho_codigo: (row as any).ranchos?.codigo ?? '—',
            fecha: row.fecha,
            liberaciones: [],
          })
        }
        grouped.get(key)!.liberaciones.push({
          id: row.id,
          sector: row.sector,
          cantidad_bandejas: row.cantidad_bandejas,
          lote_liberado: row.lote_liberado,
          numero_comprobante: row.numero_comprobante,
          codigo_trazabilidad: row.codigo_trazabilidad,
          marca_embalaje: row.marca_embalaje,
          destino_final: row.destino_final,
          fruta_proceso_kg: row.fruta_proceso_kg,
          encargado_liberacion_id: row.encargado_liberacion_id,
          encargado_nombre: (row as any).encargado?.nombre_completo ?? null,
          verificacion_semanal: row.verificacion_semanal,
          hora_inicio_cosecha: row.hora_inicio_cosecha,
          hora_fin_cosecha: row.hora_fin_cosecha,
          observaciones: row.observaciones,
        })
      }
      setRegistros(Array.from(grouped.values()))
    } catch (e: unknown) {
      setError(e instanceof Error ? e.message : 'Error al cargar registros M10')
    } finally {
      setLoading(false)
    }
  }, [profile?.org_id])

  useEffect(() => { cargar() }, [cargar])
  return { registros, loading, error, refetch: cargar }
}
