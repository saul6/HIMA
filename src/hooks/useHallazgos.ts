import { useState, useCallback } from 'react'
import { supabase } from '@/lib/supabase'
import { useAuthContext } from '@/context/AuthContext'
import type {
  AudHallazgo, AudHallazgoEstado, AudHallazgoClasificacion,
  AudAccionCorrectivaCAPA, AudAcVersion,
} from '@/types/database.types'

// eslint-disable-next-line @typescript-eslint/no-explicit-any
const tbl = (name: string) => (supabase as any).from(name)

export function useHallazgos(auditoriaId: string | undefined, orgId: string | undefined) {
  const { profile } = useAuthContext()
  const [hallazgos, setHallazgos] = useState<AudHallazgo[]>([])
  const [cargando, setCargando] = useState(false)

  const cargar = useCallback(async () => {
    if (!auditoriaId) return
    setCargando(true)
    try {
      const { data, error } = await tbl('aud_hallazgos')
        .select('*')
        .eq('auditoria_id', auditoriaId)
        .order('estado')
      if (error) throw error
      setHallazgos(data ?? [])
    } catch (e) {
      console.error('[useHallazgos] cargar', e)
    } finally {
      setCargando(false)
    }
  }, [auditoriaId])

  async function crearHallazgo(params: {
    instanciaId: string
    preguntaId: string
    descripcion: string
    clasificacion: AudHallazgoClasificacion
  }): Promise<void> {
    if (!auditoriaId || !orgId) throw new Error('Sin contexto de auditoría')
    const { error } = await tbl('aud_hallazgos').insert({
      org_id: orgId,
      auditoria_id: auditoriaId,
      instancia_id: params.instanciaId,
      pregunta_id: params.preguntaId,
      descripcion: params.descripcion,
      clasificacion: params.clasificacion,
      creado_por: profile?.id,
    })
    if (error) throw error
    await cargar()
  }

  async function actualizarEstado(hallazgoId: string, estado: AudHallazgoEstado): Promise<void> {
    const { error } = await tbl('aud_hallazgos').update({ estado }).eq('id', hallazgoId)
    if (error) throw error
    setHallazgos(prev => prev.map(h => h.id === hallazgoId ? { ...h, estado } : h))
  }

  async function cargarAccion(hallazgoId: string): Promise<AudAccionCorrectivaCAPA | null> {
    const { data, error } = await tbl('aud_acciones_correctivas')
      .select('*')
      .eq('hallazgo_id', hallazgoId)
      .maybeSingle()
    if (error) throw error
    return data ?? null
  }

  async function crearAccion(hallazgoId: string, campos: Partial<AudAccionCorrectivaCAPA>): Promise<void> {
    if (!orgId) throw new Error('Sin contexto')
    const { error } = await tbl('aud_acciones_correctivas').insert({
      org_id: orgId,
      hallazgo_id: hallazgoId,
      creado_por: profile?.id,
      internal_status: 'REGISTERED',
      external_status: 'NOT_TRACKED',
      ...campos,
    })
    if (error) throw error
  }

  async function actualizarAccion(accionId: string, campos: Partial<AudAccionCorrectivaCAPA>): Promise<void> {
    const { error } = await tbl('aud_acciones_correctivas').update(campos).eq('id', accionId)
    if (error) throw error
  }

  async function cargarVersiones(accionId: string): Promise<AudAcVersion[]> {
    const { data, error } = await tbl('aud_ac_versiones')
      .select('*')
      .eq('accion_id', accionId)
      .order('version', { ascending: false })
    if (error) throw error
    return data ?? []
  }

  return {
    hallazgos,
    cargando,
    cargar,
    crearHallazgo,
    actualizarEstado,
    cargarAccion,
    crearAccion,
    actualizarAccion,
    cargarVersiones,
  }
}
