import type { TonoEtiqueta } from '@/app/components/ui-mady/Etiqueta'

export interface EstadoVisual {
  texto: string
  tono: TonoEtiqueta
}

// aud_auditorias.estado admite en_proceso / preliminar / cerrada; 'completada' es legado.
const ESTADO_AUDITORIA: Record<string, EstadoVisual> = {
  en_proceso: { texto: 'En proceso', tono: 'sky' },
  preliminar: { texto: 'Preliminar', tono: 'menta' },
  cerrada: { texto: 'Cerrada', tono: 'neutral' },
  completada: { texto: 'Completada', tono: 'menta' },
}

const ESTADO_HALLAZGO: Record<string, EstadoVisual> = {
  OPEN: { texto: 'Abierto', tono: 'error' },
  PLAN_ACCEPTED: { texto: 'Plan aceptado', tono: 'sky' },
  IMPLEMENTED: { texto: 'Implementado', tono: 'menta' },
  EFFECTIVENESS_PENDING: { texto: 'Eficacia pendiente', tono: 'sky' },
  CLOSED: { texto: 'Cerrado', tono: 'neutral' },
  REOPENED: { texto: 'Reabierto', tono: 'error' },
}

const ESTADO_AGENDA: Record<string, EstadoVisual> = {
  pendiente: { texto: 'Pendiente', tono: 'pendiente' },
  hecho: { texto: 'Hecho', tono: 'menta' },
}

const avisados = new Set<string>()

function resolver(mapa: Record<string, EstadoVisual>, nombre: string, valor: string | null | undefined): EstadoVisual {
  const v = valor ?? ''
  const hallado = mapa[v]
  if (hallado) return hallado
  // Vacío = aún cargando: estado neutro sin texto y sin aviso.
  if (v === '') return { texto: '', tono: 'neutral' }
  const clave = `${nombre}:${v}`
  if (!avisados.has(clave)) {
    avisados.add(clave)
    console.warn(`[estados] ${nombre}: valor sin texto definido "${v}"`)
  }
  return { texto: v.charAt(0).toUpperCase() + v.slice(1), tono: 'neutral' }
}

export const estadoAuditoria = (valor: string | null | undefined) => resolver(ESTADO_AUDITORIA, 'auditoría', valor)
export const estadoHallazgo = (valor: string | null | undefined) => resolver(ESTADO_HALLAZGO, 'hallazgo', valor)
export const estadoAgenda = (valor: string | null | undefined) => resolver(ESTADO_AGENDA, 'agenda', valor)

/** Código sin guion bajo y con la primera letra en mayúscula; nunca el código crudo. */
export function textoLimpio(valor: string | null | undefined): string {
  const t = (valor ?? '').replace(/_/g, ' ').trim().toLowerCase()
  return t.charAt(0).toUpperCase() + t.slice(1)
}

// Estado de una no conformidad (femenino): «NC · Abierta».
const ESTADO_NC: Record<string, string> = {
  OPEN: 'Abierta',
  PLAN_ACCEPTED: 'Plan aceptado',
  IMPLEMENTED: 'Implementada',
  EFFECTIVENESS_PENDING: 'Eficacia pendiente',
  CLOSED: 'Cerrada',
  REOPENED: 'Reabierta',
}
export const textoEstadoNc = (valor: string): string => ESTADO_NC[valor] ?? textoLimpio(valor)

const ESTADO_INTERNO_ACCION: Record<string, string> = {
  REGISTERED: 'Registrado',
  PREPARING: 'Preparando respuesta',
  WAITING_EVIDENCE: 'Esperando evidencia',
  INTERNAL_REVIEW: 'Revisión interna',
  NEEDS_WORK: 'Requiere trabajo',
  READY_FOR_AZZULE: 'Listo para Azzule',
  COMPLETE_INTERNAL: 'Completo internamente',
  ARCHIVED: 'Archivado',
}
const ESTADO_EXTERNO_ACCION: Record<string, string> = {
  NOT_TRACKED: 'Sin seguimiento externo',
  PENDING_UPLOAD: 'Pendiente de envío',
  SUBMITTED: 'Enviado',
  UNDER_REVIEW: 'En revisión',
  NEEDS_CORRECTION: 'Requiere corrección',
  ACCEPTED: 'Aceptado',
  REVIEWED: 'Revisado',
  CLOSED: 'Cerrado',
}
export const textoEstadoInternoAccion = (v: string): string => ESTADO_INTERNO_ACCION[v] ?? textoLimpio(v)
export const textoEstadoExternoAccion = (v: string): string => ESTADO_EXTERNO_ACCION[v] ?? textoLimpio(v)
