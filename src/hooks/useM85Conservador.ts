// M85 · Temperatura del conservador. Escritura solo por RPC (m85_registrar / m85_documentar / m85_corregir).
import { useState, useEffect, useCallback } from 'react'
import { supabase } from '@/lib/supabase'
import { useAuthContext } from '@/context/AuthContext'
import type { LecturaBase } from '@/lib/pdf/m85/conservadorLogica'

const tbl = (name: string) => (supabase as any).from(name)
const rpc = (fn: string, args: Record<string, unknown>) => (supabase as any).rpc(fn, args)

export interface M85Config { conservador_nombre: string; limite_min: number; limite_max: number; turno_inicio: string | null; unidad: 'C' | 'F' }
export interface M85Lectura extends LecturaBase { guardada_en: string; usuario_id: string; conservador: string }

const norm = (l: any): M85Lectura => ({ ...l, temperatura: Number(l.temperatura) })

export async function cargarLecturasM85(orgId: string, desde: string, hasta: string): Promise<M85Lectura[]> {
  const { data, error } = await tbl('m85_lecturas').select('*').eq('org_id', orgId).gte('fecha', desde).lte('fecha', hasta).order('medida_en')
  if (error) throw error
  return (data ?? []).map(norm)
}

export function useM85Conservador(fecha: string) {
  const { profile } = useAuthContext()
  const orgId = profile?.org_id ?? null
  const [config, setConfig] = useState<M85Config>({ conservador_nombre: 'Conservador', limite_min: -1.7, limite_max: 1.7, turno_inicio: null, unidad: 'C' })
  const [delDia, setDelDia] = useState<M85Lectura[]>([])
  const [pendientes, setPendientes] = useState<M85Lectura[]>([])
  const [verificacion, setVerificacion] = useState<{ nombre: string; verificado_en: string; lecturas: number } | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  const refetch = useCallback(async () => {
    if (!orgId) return
    setLoading(true)
    try {
      const [c, d, p, v] = await Promise.all([
        tbl('m85_config').select('conservador_nombre, limite_min, limite_max, turno_inicio, unidad').eq('org_id', orgId).maybeSingle(),
        cargarLecturasM85(orgId, fecha, fecha),
        tbl('m85_lecturas').select('*').eq('org_id', orgId).eq('estado', 'INCIDENCIA_PENDIENTE').order('medida_en', { ascending: false }),
        tbl('m85_verificaciones').select('nombre, verificado_en, lecturas').eq('org_id', orgId).eq('fecha', fecha).maybeSingle(),
      ])
      if (c.data) setConfig({ ...c.data, limite_min: Number(c.data.limite_min), limite_max: Number(c.data.limite_max) })
      setDelDia(d)
      setPendientes((p.data ?? []).map(norm))
      setVerificacion(v.data ?? null)
      setError(null)
    } catch (e: any) {
      setError(e?.message ?? 'Error al cargar')
    } finally {
      setLoading(false)
    }
  }, [orgId, fecha])

  useEffect(() => { refetch() }, [refetch])
  return { config, delDia, pendientes, verificacion, loading, error, refetch }
}

export async function registrarLecturaM85(p: {
  rancho: string; temperatura: number; key: string; medidaEn?: string | null; observacion?: string | null
}): Promise<{ id: string; medida_en: string; estado: string; temperatura: number; unidad: string; repetida: boolean }> {
  const { data, error } = await rpc('m85_registrar', {
    p_rancho: p.rancho, p_temperatura: p.temperatura, p_key: p.key, p_medida_en: p.medidaEn ?? null, p_observacion: p.observacion ?? null,
  })
  if (error) throw error
  return data
}

export async function documentarM85(lectura: string, observacion: string, accion: string): Promise<void> {
  const { error } = await rpc('m85_documentar', { p_lectura: lectura, p_observacion: observacion, p_accion: accion || null })
  if (error) throw error
}

export async function corregirM85(p: { lectura: string; motivo: string; temperatura?: number | null; medidaEn?: string | null }): Promise<void> {
  const { error } = await rpc('m85_corregir', {
    p_lectura: p.lectura, p_motivo: p.motivo, p_temperatura: p.temperatura ?? null, p_medida_en: p.medidaEn ?? null,
  })
  if (error) throw error
}

/** El encargado de turno verifica la bitácora de una fecha (00:00–00:59 del día siguiente cuentan en la columna 24:00). */
export async function verificarDiaM85(rancho: string, fecha: string): Promise<{ lecturas: number }> {
  const { data, error } = await rpc('m85_verificar_dia', { p_rancho: rancho, p_fecha: fecha })
  if (error) throw error
  return data
}

export function mensajeErrorM85(e: any): { tipo: 'warning' | 'error'; texto: string } {
  const msg: string = e?.message ?? String(e ?? '')
  const m = /(M85_[A-Z_]+|FORBIDDEN|VALOR_INVALIDO):\s*(.*)$/s.exec(msg)
  if (m) return { tipo: m[1] === 'FORBIDDEN' ? 'error' : 'warning', texto: m[2].trim() }
  if (/fetch|network|Failed to fetch/i.test(msg)) return { tipo: 'error', texto: 'Sin conexión: la lectura NO se guardó. Vuelve a intentar.' }
  return { tipo: 'error', texto: msg || 'Error al guardar' }
}
