// M85 · Temperatura del conservador. Escritura solo por RPC (m85_registrar / m85_documentar / m85_corregir).
import { useState, useEffect, useCallback } from 'react'
import { supabase } from '@/lib/supabase'
import { useAuthContext } from '@/context/AuthContext'
import type { LecturaBase } from '@/lib/pdf/m85/conservadorLogica'

const tbl = (name: string) => (supabase as any).from(name)
const rpc = (fn: string, args: Record<string, unknown>) => (supabase as any).rpc(fn, args)

export interface M85Config { conservador_nombre: string; limite_min_f: number; limite_max_f: number; turno_inicio: string | null }
export interface M85Lectura extends LecturaBase { guardada_en: string; usuario_id: string; conservador: string }

const norm = (l: any): M85Lectura => ({ ...l, temperatura_f: Number(l.temperatura_f) })

export async function cargarLecturasM85(orgId: string, desde: string, hasta: string): Promise<M85Lectura[]> {
  const { data, error } = await tbl('m85_lecturas').select('*').eq('org_id', orgId).gte('fecha', desde).lte('fecha', hasta).order('medida_en')
  if (error) throw error
  return (data ?? []).map(norm)
}

export function useM85Conservador(fecha: string) {
  const { profile } = useAuthContext()
  const orgId = profile?.org_id ?? null
  const [config, setConfig] = useState<M85Config>({ conservador_nombre: 'Conservador', limite_min_f: 29, limite_max_f: 35, turno_inicio: null })
  const [delDia, setDelDia] = useState<M85Lectura[]>([])
  const [pendientes, setPendientes] = useState<M85Lectura[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  const refetch = useCallback(async () => {
    if (!orgId) return
    setLoading(true)
    try {
      const [c, d, p] = await Promise.all([
        tbl('m85_config').select('conservador_nombre, limite_min_f, limite_max_f, turno_inicio').eq('org_id', orgId).maybeSingle(),
        cargarLecturasM85(orgId, fecha, fecha),
        tbl('m85_lecturas').select('*').eq('org_id', orgId).eq('estado', 'INCIDENCIA_PENDIENTE').order('medida_en', { ascending: false }),
      ])
      if (c.data) setConfig({ ...c.data, limite_min_f: Number(c.data.limite_min_f), limite_max_f: Number(c.data.limite_max_f) })
      setDelDia(d)
      setPendientes((p.data ?? []).map(norm))
      setError(null)
    } catch (e: any) {
      setError(e?.message ?? 'Error al cargar')
    } finally {
      setLoading(false)
    }
  }, [orgId, fecha])

  useEffect(() => { refetch() }, [refetch])
  return { config, delDia, pendientes, loading, error, refetch }
}

export async function registrarLecturaM85(p: {
  rancho: string; temperatura: number; key: string; medidaEn?: string | null; observacion?: string | null
}): Promise<{ id: string; medida_en: string; estado: string; temperatura_f: number; repetida: boolean }> {
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

export function mensajeErrorM85(e: any): { tipo: 'warning' | 'error'; texto: string } {
  const msg: string = e?.message ?? String(e ?? '')
  const m = /(M85_[A-Z_]+|FORBIDDEN|VALOR_INVALIDO):\s*(.*)$/s.exec(msg)
  if (m) return { tipo: m[1] === 'FORBIDDEN' ? 'error' : 'warning', texto: m[2].trim() }
  if (/fetch|network|Failed to fetch/i.test(msg)) return { tipo: 'error', texto: 'Sin conexión: la lectura NO se guardó. Vuelve a intentar.' }
  return { tipo: 'error', texto: msg || 'Error al guardar' }
}
