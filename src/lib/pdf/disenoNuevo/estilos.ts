// Estilo base de página del diseño nuevo: fondo blanco, márgenes de 40 pt simétricos,
// Helvetica, sin sombras ni degradados.
import { PC } from '@/lib/pdf/components/tokens'

export const estiloPagina = {
  fontFamily: 'Helvetica',
  fontSize: 9,
  color: PC.m13Texto,
  paddingTop: 40,
  paddingBottom: 56,
  paddingLeft: 40,
  paddingRight: 40,
  backgroundColor: PC.white,
} as const

/**
 * react-pdf trata `flexShrink: 0` como 1 (`value || 1`) y, si una página se llena de más, Yoga comprime las cajas
 * y el texto se encima. Un valor casi cero evita que las cajas se encojan.
 */
export const SIN_ENCOGER = { flexShrink: 0.001 } as const
