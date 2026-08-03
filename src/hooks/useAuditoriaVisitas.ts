import { useState, useEffect, useCallback } from 'react'
import { supabase } from '@/lib/supabase'
import { useAuthContext } from '@/context/AuthContext'
import type { AuditoriaVisita, NoConformidad } from '@/types/database.types'

export interface AuditoriaVisitaConRancho extends AuditoriaVisita {
  rancho_nombre: string
}

export interface AuditoriaItem {
  id: string
  modulo: 'm14' | 'm15' | 'm16' | 'm17' | 'm18'
  modulo_label: string
  estado: string
  porcentaje: number
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any
const tbl = (name: string) => (supabase as any).from(name)

const MODULOS_AUDITORIA: Array<{ tabla: string; modulo: 'm14' | 'm15' | 'm16' | 'm17' | 'm18'; label: string }> = [
  { tabla: 'm14_auditorias', modulo: 'm14', label: 'SAIA' },
  { tabla: 'm15_auditorias', modulo: 'm15', label: 'Granja' },
  { tabla: 'm16_auditorias', modulo: 'm16', label: 'Cuadrilla' },
  { tabla: 'm17_auditorias', modulo: 'm17', label: "BPM's" },
  { tabla: 'm18_auditorias', modulo: 'm18', label: 'HACCP' },
]

const ORDEN_MODULO: Record<string, number> = { m14: 1, m15: 2, m16: 3, m17: 4, m18: 5 }

export function useAuditoriaVisitas() {
  const { profile } = useAuthContext()
  const [visitas, setVisitas] = useState<AuditoriaVisitaConRancho[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  const cargar = useCallback(async () => {
    if (!profile?.org_id) { setLoading(false); return }
    setLoading(true)
    setError(null)
    try {
      const { data, error: err } = await supabase
        .from('auditoria_visitas')
        .select('*, ranchos(nombre)')
        .eq('org_id', profile.org_id)
        .order('fecha', { ascending: false })
        .limit(100)
      if (err) throw err
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      setVisitas((data ?? []).map((r: any) => ({ ...r, rancho_nombre: r.ranchos?.nombre ?? '—' })))
    } catch (e: unknown) {
      setError(e instanceof Error ? e.message : 'Error al cargar visitas')
    } finally {
      setLoading(false)
    }
  }, [profile?.org_id])

  useEffect(() => { cargar() }, [cargar])

  async function crearVisita(params: {
    rancho_id: string
    fecha: string
    auditor_nombre: string
    cliente_nombre: string
    pa_pgfs: string | null
    observaciones: string | null
  }): Promise<string> {
    if (!profile?.org_id) throw new Error('Sin organización activa')
    const { data, error: err } = await supabase
      .from('auditoria_visitas')
      .insert({ ...params, org_id: profile.org_id })
      .select('id')
      .single()
    if (err) throw err
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    return (data as any).id
  }

  async function actualizarVisita(id: string, params: {
    rancho_id: string
    fecha: string
    auditor_nombre: string
    cliente_nombre: string
    pa_pgfs: string | null
    observaciones: string | null
  }): Promise<void> {
    if (!profile?.org_id) throw new Error('Sin organización activa')
    const { error: err } = await supabase
      .from('auditoria_visitas')
      .update(params)
      .eq('id', id)
      .eq('org_id', profile.org_id)
    if (err) throw err
  }

  async function cargarNcrs(visitaId: string): Promise<NoConformidad[]> {
    const { data, error: err } = await supabase.rpc('get_no_conformidades', { p_visita_id: visitaId })
    if (err) throw err
    return (data ?? []) as NoConformidad[]
  }

  async function cargarAuditoriasVinculadas(visitaId: string): Promise<AuditoriaItem[]> {
    if (!profile?.org_id) return []
    const resultados: AuditoriaItem[] = []
    await Promise.all(
      MODULOS_AUDITORIA.map(async ({ tabla, modulo, label }) => {
        const { data } = await tbl(tabla)
          .select('id, estado, porcentaje')
          .eq('org_id', profile.org_id)
          .eq('visita_id', visitaId)
          .limit(5)
        if (data?.length) {
          for (const r of data) {
            resultados.push({ id: r.id, modulo, modulo_label: label, estado: r.estado, porcentaje: r.porcentaje })
          }
        }
      })
    )
    return resultados.sort((a, b) => (ORDEN_MODULO[a.modulo] ?? 9) - (ORDEN_MODULO[b.modulo] ?? 9))
  }

  async function cargarAuditoriasDisponibles(ranchoId: string, fecha: string): Promise<AuditoriaItem[]> {
    if (!profile?.org_id) return []
    const resultados: AuditoriaItem[] = []
    await Promise.all(
      MODULOS_AUDITORIA.map(async ({ tabla, modulo, label }) => {
        const { data } = await tbl(tabla)
          .select('id, estado, porcentaje')
          .eq('org_id', profile.org_id)
          .eq('rancho_id', ranchoId)
          .eq('fecha', fecha)
          .is('visita_id', null)
          .limit(5)
        if (data?.length) {
          for (const r of data) {
            resultados.push({ id: r.id, modulo, modulo_label: label, estado: r.estado, porcentaje: r.porcentaje })
          }
        }
      })
    )
    return resultados.sort((a, b) => (ORDEN_MODULO[a.modulo] ?? 9) - (ORDEN_MODULO[b.modulo] ?? 9))
  }

  async function vincularAuditoria(auditoriaId: string, modulo: 'm14' | 'm15' | 'm16' | 'm17' | 'm18', visitaId: string): Promise<void> {
    if (!profile?.org_id) throw new Error('Sin organización activa')
    const { error: err } = await tbl(`${modulo}_auditorias`)
      .update({ visita_id: visitaId })
      .eq('id', auditoriaId)
      .eq('org_id', profile.org_id)
    if (err) throw err
  }

  async function desvincularAuditoria(auditoriaId: string, modulo: 'm14' | 'm15' | 'm16' | 'm17' | 'm18'): Promise<void> {
    if (!profile?.org_id) throw new Error('Sin organización activa')
    const { error: err } = await tbl(`${modulo}_auditorias`)
      .update({ visita_id: null })
      .eq('id', auditoriaId)
      .eq('org_id', profile.org_id)
    if (err) throw err
  }

  return {
    visitas,
    loading,
    error,
    refetch: cargar,
    crearVisita,
    actualizarVisita,
    cargarNcrs,
    cargarAuditoriasVinculadas,
    cargarAuditoriasDisponibles,
    vincularAuditoria,
    desvincularAuditoria,
  }
}
