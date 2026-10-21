import type { ModuloKey, PDFRef } from '@/lib/pdf/generarBlobHistorial'

// Módulos con PDF en generarBlobParaRef (espejo de ModuloKey, para saber en tiempo de ejecución).
const MODULOS_PDF: ReadonlySet<string> = new Set<ModuloKey>([
  'M1', 'M6', 'M7', 'M8', 'M9', 'M10', 'M11', 'M12', 'M13', 'M14', 'M15', 'M16', 'M17', 'M18',
  'M19', 'M20', 'M21', 'M22', 'M23', 'M24', 'M25', 'M26', 'M27', 'M28', 'M29', 'M30', 'M31',
  'M32', 'M33', 'M34', 'M35', 'M36', 'M37', 'M38', 'M39', 'M40', 'M41', 'M42', 'M43', 'M44',
  'M45', 'M46', 'M53', 'M54', 'M55', 'M60', 'M61', 'M62', 'M63', 'M64', 'M65', 'M69', 'M70',
  'M71', 'M72', 'M73', 'M74', 'M75', 'M76', 'M77', 'M78',
])

// Los PDFRef de estos módulos se arman por rancho + fecha (jornada), no por id.
const MODULOS_JORNADA_PDF: ReadonlySet<string> = new Set(['M7', 'M8', 'M10', 'M12', 'M70'])

interface ItemPdf {
  modulo: string
  tipo: string
  registro_id: string
  rancho_id: string | null
  fecha: string
}

/** PDFRef de un item de Actividad, o null si el módulo no tiene PDF. */
export function pdfRefDeActividad(item: ItemPdf): PDFRef | null {
  if (!MODULOS_PDF.has(item.modulo)) return null
  if (item.tipo === 'jornada' || MODULOS_JORNADA_PDF.has(item.modulo)) {
    if (!item.rancho_id) return null
    return { tipo: item.modulo, ranchoId: item.rancho_id, fecha: item.fecha } as PDFRef
  }
  return { tipo: item.modulo, id: item.registro_id } as PDFRef
}
