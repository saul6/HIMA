import { useState, useCallback } from 'react'
import { supabase } from '@/lib/supabase'
import { useAuthContext } from '@/context/AuthContext'

export type EstadoTarea = 'pendiente' | 'en_progreso' | 'por_verificar' | 'cerrada' | 'cancelada'
export type PrioridadTarea = 'alta' | 'media' | 'baja'

export interface TareaListada {
  id: string
  titulo: string
  descripcion: string | null
  prioridad: PrioridadTarea
  fecha_limite: string | null
  estado: EstadoTarea
  regresada: boolean
  motivo_regreso: string | null
  vencida: boolean
  asignado_a: string
  asignado_nombre: string
  creado_por: string
  creador_nombre: string
  rancho_id: string | null
  rancho_nombre: string | null
  modulo_codigo: string | null
  modulo_nombre: string | null
  modulo_ruta: string | null
  reportada_en: string | null
  n_evidencias: number
  created_at: string
  updated_at: string
}

export interface TareaEvento {
  tipo: string
  actor: string
  nota: string | null
  fecha: string
}

export interface TareaEvidencia {
  storage_path: string
}

export interface TareaDetalle {
  tarea: TareaListada
  eventos: TareaEvento[]
  evidencias: TareaEvidencia[]
}

export interface AgendaResumen {
  es_admin: boolean
  mis_pendientes: number
  mis_vencidas: number
  mis_regresadas: number
  por_verificar: number | null
  abiertas_org: number | null
  vencidas_org: number | null
}

export interface Colaborador {
  id: string
  nombre: string
  rol: string
}

export interface FiltrosListar {
  estados?: EstadoTarea[]
  asignado?: string
  desde?: string
  hasta?: string
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any
const rpc = (name: string, params?: Record<string, unknown>) =>
  (supabase as any).rpc(name, params)

export function useAgendaTareas() {
  const { profile } = useAuthContext()
  const [tareas, setTareas] = useState<TareaListada[]>([])
  const [loading, setLoading] = useState(false)
  const [resumen, setResumen] = useState<AgendaResumen | null>(null)
  const [resumenLoading, setResumenLoading] = useState(false)
  const [colaboradores, setColaboradores] = useState<Colaborador[]>([])

  const cargarResumen = useCallback(async () => {
    if (!profile?.id) return
    setResumenLoading(true)
    try {
      const { data, error } = await rpc('org_agenda_resumen')
      if (error) throw error
      const rows = data as AgendaResumen[] | null
      setResumen(rows?.[0] ?? null)
    } catch (e) {
      console.error('[useAgendaTareas] cargarResumen', e)
    } finally {
      setResumenLoading(false)
    }
  }, [profile?.id])

  const listar = useCallback(async (filtros?: FiltrosListar) => {
    if (!profile?.id) return
    setLoading(true)
    try {
      const params: Record<string, unknown> = {}
      if (filtros?.estados?.length) params.p_estados = filtros.estados
      if (filtros?.asignado) params.p_asignado = filtros.asignado
      if (filtros?.desde) params.p_desde = filtros.desde
      if (filtros?.hasta) params.p_hasta = filtros.hasta
      const { data, error } = await rpc('org_tareas_listar', params)
      if (error) throw error
      setTareas((data as TareaListada[]) ?? [])
    } catch (e) {
      console.error('[useAgendaTareas] listar', e)
    } finally {
      setLoading(false)
    }
  }, [profile?.id])

  const detalle = useCallback(async (tareaId: string): Promise<TareaDetalle | null> => {
    try {
      const { data, error } = await rpc('org_tarea_detalle', { p_tarea_id: tareaId })
      if (error) throw error
      const rows = data as TareaDetalle[] | null
      return rows?.[0] ?? null
    } catch (e) {
      console.error('[useAgendaTareas] detalle', e)
      return null
    }
  }, [])

  const cargarColaboradores = useCallback(async () => {
    if (!profile?.id) return
    try {
      const { data, error } = await rpc('org_colaboradores')
      if (error) throw error
      setColaboradores((data as Colaborador[]) ?? [])
    } catch (e) {
      console.error('[useAgendaTareas] cargarColaboradores', e)
    }
  }, [profile?.id])

  async function crear(params: {
    titulo: string
    asignado_a: string
    descripcion?: string
    prioridad?: PrioridadTarea
    fecha_limite?: string
    rancho_id?: string
    modulo_codigo?: string
  }): Promise<{ ok: boolean; mensaje?: string; tarea_id?: string }> {
    try {
      const { data, error } = await rpc('org_tarea_crear', {
        p_titulo: params.titulo,
        p_asignado_a: params.asignado_a,
        p_descripcion: params.descripcion || null,
        p_prioridad: params.prioridad || 'media',
        p_fecha_limite: params.fecha_limite || null,
        p_rancho_id: params.rancho_id || null,
        p_modulo_codigo: params.modulo_codigo || null,
        p_event_id: crypto.randomUUID(),
      })
      if (error) return { ok: false, mensaje: error.message }
      const row = (data as { tarea_id: string; estado: string }[] | null)?.[0]
      return { ok: true, tarea_id: row?.tarea_id }
    } catch (e) {
      console.error('[useAgendaTareas] crear', e)
      return { ok: false, mensaje: 'Error al crear la tarea' }
    }
  }

  async function editar(
    tareaId: string,
    cambios: Record<string, unknown>,
  ): Promise<{ ok: boolean; mensaje?: string }> {
    try {
      const { error } = await rpc('org_tarea_editar', {
        p_tarea_id: tareaId,
        p_cambios: cambios,
        p_event_id: crypto.randomUUID(),
      })
      if (error) return { ok: false, mensaje: error.message }
      return { ok: true }
    } catch (e) {
      console.error('[useAgendaTareas] editar', e)
      return { ok: false, mensaje: 'Error al editar la tarea' }
    }
  }

  async function iniciar(tareaId: string): Promise<{ ok: boolean; mensaje?: string }> {
    try {
      const { error } = await rpc('org_tarea_iniciar', {
        p_tarea_id: tareaId,
        p_event_id: crypto.randomUUID(),
      })
      if (error) return { ok: false, mensaje: error.message }
      return { ok: true }
    } catch (e) {
      console.error('[useAgendaTareas] iniciar', e)
      return { ok: false, mensaje: 'Error al iniciar la tarea' }
    }
  }

  async function reportar(
    tareaId: string,
    nota: string | null,
    evidencias: string[],
  ): Promise<{ ok: boolean; mensaje?: string }> {
    try {
      const { error } = await rpc('org_tarea_reportar', {
        p_tarea_id: tareaId,
        p_nota: nota || null,
        p_evidencias: evidencias,
        p_event_id: crypto.randomUUID(),
      })
      if (error) return { ok: false, mensaje: error.message }
      return { ok: true }
    } catch (e) {
      console.error('[useAgendaTareas] reportar', e)
      return { ok: false, mensaje: 'Error al reportar la tarea' }
    }
  }

  async function aprobar(
    tareaId: string,
    nota?: string,
  ): Promise<{ ok: boolean; mensaje?: string }> {
    try {
      const { error } = await rpc('org_tarea_aprobar', {
        p_tarea_id: tareaId,
        p_nota: nota || null,
        p_event_id: crypto.randomUUID(),
      })
      if (error) return { ok: false, mensaje: error.message }
      return { ok: true }
    } catch (e) {
      console.error('[useAgendaTareas] aprobar', e)
      return { ok: false, mensaje: 'Error al aprobar la tarea' }
    }
  }

  async function regresar(
    tareaId: string,
    motivo: string,
  ): Promise<{ ok: boolean; mensaje?: string }> {
    try {
      const { error } = await rpc('org_tarea_regresar', {
        p_tarea_id: tareaId,
        p_motivo: motivo,
        p_event_id: crypto.randomUUID(),
      })
      if (error) return { ok: false, mensaje: error.message }
      return { ok: true }
    } catch (e) {
      console.error('[useAgendaTareas] regresar', e)
      return { ok: false, mensaje: 'Error al regresar la tarea' }
    }
  }

  async function cancelar(
    tareaId: string,
    motivo: string,
  ): Promise<{ ok: boolean; mensaje?: string }> {
    try {
      const { error } = await rpc('org_tarea_cancelar', {
        p_tarea_id: tareaId,
        p_motivo: motivo,
        p_event_id: crypto.randomUUID(),
      })
      if (error) return { ok: false, mensaje: error.message }
      return { ok: true }
    } catch (e) {
      console.error('[useAgendaTareas] cancelar', e)
      return { ok: false, mensaje: 'Error al cancelar la tarea' }
    }
  }

  return {
    tareas,
    loading,
    resumen,
    resumenLoading,
    colaboradores,
    listar,
    detalle,
    cargarResumen,
    cargarColaboradores,
    crear,
    editar,
    iniciar,
    reportar,
    aprobar,
    regresar,
    cancelar,
  }
}
