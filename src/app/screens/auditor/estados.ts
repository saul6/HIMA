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
