// Textos y colores de estado de un documento en la visita (compartidos por la tarjeta y el panel de revisión).
import type { Antecedente, ResultadoVerificacion } from '@/hooks/useChecklistV2'
import { fechaCorta } from './constantes'

/** Estado de una verificación en texto: nunca "correcto" a secas. */
export function etiquetaResultado(r: ResultadoVerificacion | undefined, actualizado?: boolean): string {
  switch (r) {
    case 'correcto': return actualizado ? 'Actualizado y verificado' : 'Verificado sin cambios'
    case 'incidencia': return 'No conforme'
    case 'pendiente': return 'Pendiente de evidencia'
    case 'no_aplica': return 'No aplica en esta visita'
    default: return 'revisado'
  }
}

export function textoAntecedente(a: Antecedente | null): string | null {
  if (!a) return null
  if (a.fuente === 'visita') {
    return `Última verificación: ${fechaCorta(a.fecha)}, ${etiquetaResultado(a.resultado, a.actualizado).toLowerCase()}${a.asesor ? `, ${a.asesor}` : ''}`
  }
  return `Checklist anterior: ${(a.estado_anterior ?? 'revisado').replace(/_/g, ' ')}${a.fecha ? ` (${fechaCorta(a.fecha)})` : ''}${a.asesor ? `, ${a.asesor}` : ''}`
}

export const COLOR_RESULTADO: Record<ResultadoVerificacion, string | undefined> = {
  correcto: 'var(--agro-success-text)',
  incidencia: 'var(--agro-danger-text)',
  pendiente: 'var(--agro-info-text)',
  no_aplica: undefined,
}
