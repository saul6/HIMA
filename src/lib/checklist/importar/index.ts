// Entrada única del importador: archivo → { formato, hash, filas, omitidas }.
// pdfjs-dist y mammoth se cargan al usarse (import dinámico), no con la pantalla.
import type { FilaImportacion } from './tabla'
import { construirFilasTablas, type LecturaTablas } from './tresTablas'

export const MAX_BYTES = 10 * 1024 * 1024

export interface ArchivoLeido {
  formato: 'pdf' | 'docx'
  nombre: string
  hash: string
  filas: FilaImportacion[]
  omitidas: string[]
  /** Word v1.4: las tres tablas leídas; las filas se arman al elegir el alcance de cada columna de fecha */
  tablas?: LecturaTablas
}

async function sha256(datos: ArrayBuffer): Promise<string> {
  const h = await crypto.subtle.digest('SHA-256', datos)
  return Array.from(new Uint8Array(h), b => b.toString(16).padStart(2, '0')).join('')
}

export async function leerArchivo(file: File): Promise<ArchivoLeido> {
  const nombre = file.name
  const ext = nombre.split('.').pop()?.toLowerCase()
  if (ext !== 'pdf' && ext !== 'docx') throw new Error('Solo se aceptan archivos .pdf o .docx')
  if (file.size > MAX_BYTES) throw new Error('El archivo pesa más de 10 MB')
  const datos = await file.arrayBuffer()
  const hash = await sha256(datos)
  if (ext === 'pdf') {
    const { leerPdf } = await import('./pdf')
    const r = await leerPdf(datos)
    return { formato: 'pdf', nombre, hash, ...r }
  }
  const { leerDocxTablas } = await import('./docx')
  const tablas = await leerDocxTablas(datos)
  // Sin columnas de fecha que repartir (0 o 1) las filas ya se pueden armar; con 2+ se piden los alcances en la hoja
  const filas = construirFilasTablas(tablas, { alcancePorColumna: [], alcances: [] })
  return { formato: 'docx', nombre, hash, filas, omitidas: tablas.omitidas, tablas }
}
