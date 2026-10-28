import type { ModalidadPago, NomTrabajador } from '@/types/nomina.types'

/** Datos de la semana de un trabajador que comparten las pestañas Captura y Corte. */
export interface CtxSemana {
  trabajadorId: string
  trabajador: NomTrabajador | null
  lunes: string
  domingo: string
  periodoId: string | null
  aprobada: boolean
  /** Semana cerrada: no se captura ni se anula nada. */
  cerrada: boolean
  moneda: string
  /** Rango de fechas capturables: mayor entre arranque, alta y lunes / menor entre hoy y domingo. */
  min: string
  max: string
  modalidad: ModalidadPago | null
  recargar: () => Promise<void>
}
