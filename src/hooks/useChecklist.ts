import { useState, useCallback } from 'react'
import { supabase } from '@/lib/supabase'

export type ChkTipoItem = 'modulo' | 'formato' | 'documento'
export type ChkEstadoRevision = 'al_dia' | 'actualizar' | 'corregir' | 'faltan_firmas' | 'sin_reportes' | 'otro'
export type ChkFrecuencia = 'diaria' | 'semanal' | 'quincenal' | 'mensual' | 'por_evento' | 'no_aplica'
export type ChkTipoNota = 'faltan_registros' | 'no_se_lleva' | 'faltan_firmas' | 'por_vencer' | 'vencido'

export interface ChkNota {
  tipo: ChkTipoNota
  texto: string
  mes?: string
  faltan?: number
  rol?: string
}

export interface ChkUltimaRevision {
  estado: ChkEstadoRevision
  observacion: string | null
  revisado_en: string
  revisado_por: string | null
}

export interface ChkItem {
  id: string
  tipo: ChkTipoItem
  modulo_codigo: string | null
  modulo_ruta: string | null
  nombre: string
  codigo_formato: string | null
  area: string | null
  responsable_texto: string | null
  responsable_profile_id: string | null
  responsable_nombre: string | null
  frecuencia: ChkFrecuencia | null
  frecuencia_sugerida: ChkFrecuencia | null
  vence_el: string | null
  orden: number
  ultimo_registro: string | null
  notas: ChkNota[]
  ultima_revision: ChkUltimaRevision | null
  dias_sin_revisar: number | null
}

export interface ChkVisita {
  id: string
  fecha: string
  estado: 'programada' | 'realizada' | 'cancelada'
  nota: string | null
  revisor_id: string | null
  revisor: string | null
  tarea_id: string | null
  realizada_en: string | null
  atrasada: boolean
  veces_reprogramada: number
}

export interface ChkResumen {
  hoy: string
  puede_editar: boolean
  sitio: { id?: string; nombre?: string } | string | null
  config: { dias_operacion: number[]; resumen_semanal: boolean }
  contadores: {
    total: number
    con_faltantes: number
    no_se_lleva: number
    faltan_firmas: number
    documentos_por_vencer: number
    visitas_atrasadas: number
  }
  items: ChkItem[]
  visitas: ChkVisita[]
}

export interface ChkRevisionHistorial {
  estado: ChkEstadoRevision
  observacion: string | null
  notas: ChkNota[] | null
  revisado_por: string | null
  revisado_en: string
}

export interface ChkVisitaEvento {
  tipo: string
  actor: string | null
  nota: string | null
  fecha: string
  datos: Record<string, unknown> | null
}

export interface ChkResultado<T = unknown> {
  ok: boolean
  mensaje?: string
  data?: T
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any
const rpc = (name: string, params?: Record<string, unknown>) => (supabase as any).rpc(name, params)

function unwrap<T>(data: unknown): T | null {
  if (data == null) return null
  return (Array.isArray(data) ? (data[0] ?? null) : data) as T | null
}

async function llamar<T = unknown>(name: string, params: Record<string, unknown>): Promise<ChkResultado<T>> {
  try {
    const { data, error } = await rpc(name, params)
    if (error) return { ok: false, mensaje: (error as { message?: string }).message ?? 'Error' }
    return { ok: true, data: unwrap<T>(data) as T }
  } catch (e) {
    console.error(`[useChecklist] ${name}`, e)
    return { ok: false, mensaje: 'No se pudo completar la acción. Intenta de nuevo.' }
  }
}

export function useChecklist() {
  const [resumen, setResumen] = useState<ChkResumen | null>(null)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const cargar = useCallback(async (ranchoId: string) => {
    setLoading(true)
    setError(null)
    const res = await llamar<ChkResumen>('chk_resumen', { p_rancho: ranchoId })
    if (res.ok && res.data) setResumen(res.data)
    else {
      setResumen(null)
      setError(res.mensaje ?? 'No se pudo cargar el checklist')
    }
    setLoading(false)
  }, [])

  const itemGuardar = (ranchoId: string, datos: Record<string, unknown>, itemId?: string) =>
    llamar('chk_item_guardar', { p_rancho: ranchoId, p_datos: datos, ...(itemId ? { p_item_id: itemId } : {}) })

  const configGuardar = (ranchoId: string, dias: number[], resumenSemanal: boolean) =>
    llamar('chk_sitio_config_guardar', { p_rancho: ranchoId, p_dias: dias, p_resumen_semanal: resumenSemanal })

  const revisar = (p: { item: string; estado: ChkEstadoRevision; observacion?: string; visita?: string; eventId: string }) =>
    llamar('chk_revisar', {
      p_item: p.item,
      p_estado: p.estado,
      p_observacion: p.observacion?.trim() || null,
      p_visita: p.visita ?? null,
      p_event_id: p.eventId,
    })

  const historial = async (itemId: string) => {
    const res = await llamar<ChkRevisionHistorial[]>('chk_historial', { p_item: itemId })
    return res.ok ? { ...res, data: (Array.isArray(res.data) ? res.data : []) as ChkRevisionHistorial[] } : res
  }

  const visitaProgramar = (p: { rancho: string; fecha: string; revisor?: string; nota?: string; eventId: string }) =>
    llamar('chk_visita_programar', {
      p_rancho: p.rancho,
      p_fecha: p.fecha,
      p_revisor: p.revisor ?? null,
      p_nota: p.nota?.trim() || null,
      p_event_id: p.eventId,
    })

  const visitaReprogramar = (p: { visita: string; fecha: string; motivo: string; revisor?: string; eventId: string }) =>
    llamar('chk_visita_reprogramar', {
      p_visita: p.visita,
      p_fecha: p.fecha,
      p_motivo: p.motivo.trim(),
      p_revisor: p.revisor ?? null,
      p_event_id: p.eventId,
    })

  const visitaCancelar = (p: { visita: string; motivo: string; eventId: string }) =>
    llamar('chk_visita_cancelar', { p_visita: p.visita, p_motivo: p.motivo.trim(), p_event_id: p.eventId })

  const visitaTerminar = (p: { visita: string; nota?: string; eventId: string }) =>
    llamar('chk_visita_terminar', { p_visita: p.visita, p_nota: p.nota?.trim() || null, p_event_id: p.eventId })

  const visitaEventos = async (visitaId: string) => {
    const res = await llamar<ChkVisitaEvento[]>('chk_visita_eventos_ver', { p_visita: visitaId })
    return res.ok ? { ...res, data: (Array.isArray(res.data) ? res.data : []) as ChkVisitaEvento[] } : res
  }

  return {
    resumen, loading, error, cargar,
    itemGuardar, configGuardar, revisar, historial,
    visitaProgramar, visitaReprogramar, visitaCancelar, visitaTerminar, visitaEventos,
  }
}

export const ESTADOS_REVISION: { value: ChkEstadoRevision; label: string }[] = [
  { value: 'al_dia', label: 'Al día' },
  { value: 'actualizar', label: 'Actualizar' },
  { value: 'corregir', label: 'Corregir' },
  { value: 'faltan_firmas', label: 'Faltan firmas' },
  { value: 'sin_reportes', label: 'Sin reportes' },
  { value: 'otro', label: 'Otro' },
]

export const FRECUENCIAS: { value: ChkFrecuencia; label: string }[] = [
  { value: 'diaria', label: 'Cada día' },
  { value: 'semanal', label: 'Cada semana' },
  { value: 'quincenal', label: 'Cada 15 días' },
  { value: 'mensual', label: 'Cada mes' },
  { value: 'por_evento', label: 'Cuando ocurra' },
  { value: 'no_aplica', label: 'No aplica' },
]
