// Valores negativos en rojo suave (PC.negativo, legible en impresión). Solo color:
// el texto no cambia.
import { PC } from '@/lib/pdf/components/tokens'

const NEGATIVOS = new Set(['no', 'x', 'nc', 'no cumple', 'no conforme', 'incorrecto'])

export const esNegativo = (valor: unknown): boolean =>
  typeof valor === 'string' && NEGATIVOS.has(valor.trim().toLowerCase())

/** Para mezclar en el style de un Text: `{...estiloNegativo(valor)}`. */
export const estiloNegativo = (valor: unknown): { color?: string } =>
  esNegativo(valor) ? { color: PC.negativo } : {}
