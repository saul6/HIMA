import { useState, useCallback } from 'react'
import { supabase } from '@/lib/supabase'
import { useAuthContext } from '@/context/AuthContext'

export type EstadoTarea = 'pendiente' | 'en_progreso' | 'por_verificar' | 'cerrada' | 'cancelada'
export type PrioridadTarea = 'alta' | 'media' | 'baja'
export type AcuseEstado = 'no_requerido' | 'pendiente' | 'firmado' | 'desactualizado'

export interface AcuseUltimo {
  firmante: string
  firmado_en: string
  registro_sha256: string
  vigente: boolean
}

export interface AcuseInfo {
  estado: AcuseEstado
  requiere_mi_firma: boolean
  contenido_sha256: string
  declaracion_preview: string
  ultimo: AcuseUltimo | null
}

export interface AcuseDetalle {
  acuse_id: string
  firmante: string
  rol: string
  declaracion: string
  firmado_en: string
  firma_png: string
  firma_sha256: string
  contenido: Record<string, unknown>
  contenido_sha256: string
  registro_sha256: string
  ip: string
  user_agent: string
  n_puntos: number
  vigente: boolean
}

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
  acuse_estado: AcuseEstado
  acuse_firmado_en: string | null
}

export interface TareaEvento {
  tipo: string
  actor: string
  nota: string | null
  fecha: string
  datos: Record<string, unknown> | null
}

export interface TareaEvidencia {
  storage_path: string
}

export interface TareaDetalle {
  tarea: TareaListada
  eventos: TareaEvento[]
  evidencias: TareaEvidencia[]
  reporte_nota: string | null
  verificacion_nota: string | null
  cancelada_motivo: string | null
  acuse: AcuseInfo
}

export interface AgendaResumen {
  es_admin: boolean
  mis_pendientes: number
  mis_vencidas: number
  mis_regresadas: number
  mis_sin_firmar: number | null
  por_verificar: number | null
  abiertas_org: number | null
  vencidas_org: number | null
  sin_acuse_org: number | null
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

// La BD devuelve jsonb (un objeto) pero supabase-js lo envuelve a veces en array.
function unwrap<T>(data: unknown): T | null {
  if (data == null) return null
  return (Array.isArray(data) ? (data[0] ?? null) : data) as T | null
}

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
      setResumen(unwrap<AgendaResumen>(data))
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

  const detalle = useCallback(async (
    tareaId: string,
  ): Promise<{ data: TareaDetalle | null; errorMsg: string | null }> => {
    try {
      const { data, error } = await rpc('org_tarea_detalle', { p_tarea_id: tareaId })
      if (error) {
        const msg = (error as { message?: string })?.message ?? ''
        return { data: null, errorMsg: msg || 'Error al cargar el detalle' }
      }
      return { data: unwrap<TareaDetalle>(data), errorMsg: null }
    } catch (e) {
      console.error('[useAgendaTareas] detalle', e)
      const msg = e instanceof Error ? e.message : 'Error al cargar el detalle'
      return { data: null, errorMsg: msg }
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
      const row = unwrap<{ tarea_id: string; estado: string }>(data)
      return { ok: true, tarea_id: row?.tarea_id }
    } catch (e) {
      console.error('[useAgendaTareas] crear', e)
      return { ok: false, mensaje: 'Error al crear la tarea' }
    }
  }

  async function editar(
    tareaId: string,
    cambios: Record<string, unknown>,
  ): Promise<{ ok: boolean; mensaje?: string; requiere_nueva_firma?: boolean }> {
    try {
      const { data, error } = await rpc('org_tarea_editar', {
        p_tarea_id: tareaId,
        p_cambios: cambios,
        p_event_id: crypto.randomUUID(),
      })
      if (error) return { ok: false, mensaje: error.message }
      const row = unwrap<{ requiere_nueva_firma?: boolean }>(data)
      return { ok: true, requiere_nueva_firma: row?.requiere_nueva_firma ?? false }
    } catch (e) {
      console.error('[useAgendaTareas] editar', e)
      return { ok: false, mensaje: 'Error al editar la tarea' }
    }
  }

  async function firmarAcuse(
    tareaId: string,
    firmaPng: string,
    trazos: unknown[][],
    contenidoSha256: string,
    eventId: string,
  ): Promise<{ ok: boolean; mensaje?: string; acuse_id?: string; firmado_en?: string; registro_sha256?: string }> {
    try {
      const { data, error } = await rpc('org_tarea_firmar_acuse', {
        p_tarea_id: tareaId,
        p_firma_png: firmaPng,
        p_trazos: trazos,
        p_contenido_sha256: contenidoSha256,
        p_event_id: eventId,
      })
      if (error) return { ok: false, mensaje: error.message }
      const row = unwrap<{ acuse_id: string; firmado_en: string; registro_sha256: string }>(data)
      return { ok: true, acuse_id: row?.acuse_id, firmado_en: row?.firmado_en, registro_sha256: row?.registro_sha256 }
    } catch (e) {
      console.error('[useAgendaTareas] firmarAcuse', e)
      return { ok: false, mensaje: 'No se pudo guardar la firma. Intenta de nuevo.' }
    }
  }

  async function verAcuses(
    tareaId: string,
  ): Promise<{ data: AcuseDetalle[]; errorMsg: string | null }> {
    try {
      const { data, error } = await rpc('org_tarea_acuses_ver', { p_tarea_id: tareaId })
      if (error) return { data: [], errorMsg: error.message }
      return { data: (data as AcuseDetalle[]) ?? [], errorMsg: null }
    } catch (e) {
      console.error('[useAgendaTareas] verAcuses', e)
      return { data: [], errorMsg: 'Error al cargar los acuses' }
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
    firmarAcuse,
    verAcuses,
  }
}
