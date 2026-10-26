import { supabase } from '@/lib/supabase'

// Asignación de hallazgos de auditorías internas (M14–M18). Todo pasa por RPC:
// la BD valida rol, organización, versiones e idempotencia.

export const MODULOS_ASIGNABLES = ['m14', 'm15', 'm16', 'm17', 'm18'] as const
export type ModuloAsignable = typeof MODULOS_ASIGNABLES[number]

export interface EstadoAsignacion {
  huella: string | null
  respuesta: string | null
  numeral: string | null
  hallazgo_id: string | null
  hallazgo_estado: string | null
  accion_id: string | null
  owner_user_id: string | null
  owner_nombre: string | null
  /** YYYY-MM-DD, inclusive */
  fecha_limite: string | null
  asignacion_version: number | null
  current_version: number | null
  tarea_id: string | null
  tarea_estado: string | null
}

export interface ResultadoAsignacion {
  hallazgo_id: string
  accion_id: string
  tarea_id: string | null
  owner_user_id: string
  fecha_limite: string
  asignacion_version: number
  current_version: number
  sin_cambios?: boolean
  idempotente?: boolean
}

export interface ColaboradorAsignable {
  id: string
  nombre: string
  rol: string
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any
const rpc = (fn: string, args?: Record<string, unknown>) => (supabase as any).rpc(fn, args)

export function esModuloAsignable(modulo: string): modulo is ModuloAsignable {
  return (MODULOS_ASIGNABLES as readonly string[]).includes(modulo)
}

export function puedeAsignarHallazgos(rol: string | null | undefined): boolean {
  return rol === 'admin_org' || rol === 'super_admin'
}

/** Estado de asignación por id de respuesta. Los ids sin hallazgo regresan con campos null. */
export async function leerEstado(
  modulo: ModuloAsignable,
  respuestaIds: string[],
): Promise<Record<string, EstadoAsignacion>> {
  if (respuestaIds.length === 0) return {}
  const { data, error } = await rpc('org_hallazgo_asignacion_estado', {
    p_modulo: modulo,
    p_respuesta_ids: respuestaIds,
  })
  if (error) throw error
  const raw = (Array.isArray(data) ? data[0] : data) ?? {}
  return raw as Record<string, EstadoAsignacion>
}

export async function asignar(params: {
  modulo: ModuloAsignable
  respuestaId: string
  ownerId: string
  fechaLimite: string
  huella: string | null
  asignacionVersion: number | null
  eventId: string
}): Promise<ResultadoAsignacion> {
  const { data, error } = await rpc('org_hallazgo_asignar', {
    p_modulo: params.modulo,
    p_respuesta_id: params.respuestaId,
    p_owner: params.ownerId,
    p_fecha_limite: params.fechaLimite,
    p_huella: params.huella,
    p_asignacion_version: params.asignacionVersion,
    p_event_id: params.eventId,
  })
  if (error) throw new Error(error.message)
  return (Array.isArray(data) ? data[0] : data) as ResultadoAsignacion
}

export async function listarColaboradores(): Promise<ColaboradorAsignable[]> {
  const { data, error } = await rpc('org_colaboradores')
  if (error) throw error
  return (data ?? []) as ColaboradorAsignable[]
}

/** La fecha es inclusiva: hoy es válido. Una fecha vencida ya guardada puede conservarse. */
export function fechaMinimaAsignacion(hoy: string, fechaActual?: string | null): string {
  return fechaActual && fechaActual < hoy ? fechaActual : hoy
}

/** Fecha límite como la guarda la asignación: fin del día en CDMX (UTC-6, sin horario de verano). */
export function finDelDiaCDMX(fecha: string | null | undefined): string | null {
  return fecha ? `${fecha.slice(0, 10)}T23:59:59-06:00` : null
}

export function formatFechaLimite(iso: string | null | undefined): string {
  if (!iso) return ''
  try {
    return new Date(iso.slice(0, 10) + 'T12:00:00').toLocaleDateString('es-MX', {
      day: 'numeric', month: 'short', year: 'numeric',
    })
  } catch { return iso }
}

/** En M25 la RPC histórica no tipa ids de origen. Solo se acepta una correspondencia única. */
export function resolverHallazgoVisita<T extends {
  respuesta_id: string; modulo: string; codigo_pregunta: string
  texto_pregunta: string; comentario_respuesta: string | null; visita_id: string | null
}>(ncr: {
  modulo: string; codigo_pregunta: string; texto_pregunta: string; comentario: string
}, items: T[], visitaId: string | undefined): T | null {
  if (!visitaId) return null
  const limpiar = (s: string) => s.normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase().replace(/[^a-z0-9]/g, '')
  const moduloPorEtiqueta: Record<string, string> = {
    m14: 'm14', saia: 'm14', m1: 'm14',
    m15: 'm15', granja: 'm15', m2: 'm15',
    m16: 'm16', cuadrilla: 'm16', cosecha: 'm16', m4: 'm16',
    m17: 'm17', bpm: 'm17', bpms: 'm17', m5: 'm17',
    m18: 'm18', haccp: 'm18', m6: 'm18',
  }
  const modulo = moduloPorEtiqueta[limpiar(ncr.modulo)]
  if (!modulo) return null
  let candidatos = items.filter(i => i.visita_id === visitaId && i.modulo === modulo &&
    i.codigo_pregunta === ncr.codigo_pregunta)
  if (candidatos.length > 1) {
    candidatos = candidatos.filter(i => i.texto_pregunta.trim() === ncr.texto_pregunta.trim() &&
      (i.comentario_respuesta || '').trim() === (ncr.comentario || '').trim())
  }
  return candidatos.length === 1 ? candidatos[0] : null
}
