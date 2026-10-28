// Lectura de Word (.docx): mammoth → HTML → tablas con DOMParser. Mismo mapeo de encabezados que el PDF.
import { construirFilas, detectarEncabezado, type Encabezado, type FilaImportacion, type Linea } from './tabla'
import { limpiar } from './fechas'
import type { LecturaTabla } from './pdf'

const hijosCelda = (tr: Element) =>
  Array.from(tr.childNodes as unknown as ArrayLike<Node>).filter((n): n is Element => n.nodeType === 1 && /^(td|th)$/i.test(n.nodeName))

/** Expande rowspan/colspan a una rejilla de texto (solo API mínima del DOM). */
function rejilla(tabla: Element): string[][] {
  const filas: string[][] = []
  const pendientes: Record<number, { resta: number; texto: string }> = {}
  Array.from(tabla.getElementsByTagName('tr')).forEach(tr => {
    const fila: string[] = []
    let col = 0
    const llenarPendientes = () => {
      while (pendientes[col]?.resta > 0) {
        fila[col] = pendientes[col].texto
        pendientes[col].resta--
        col++
      }
    }
    for (const td of hijosCelda(tr)) {
      llenarPendientes()
      const texto = limpiar(td.textContent ?? '')
      const rs = Number(td.getAttribute('rowspan') ?? 1) || 1
      const cs = Number(td.getAttribute('colspan') ?? 1) || 1
      for (let k = 0; k < cs; k++) {
        fila[col] = k === 0 ? texto : ''
        if (rs > 1) pendientes[col] = { resta: rs - 1, texto: k === 0 ? texto : '' }
        col++
      }
    }
    llenarPendientes()
    filas.push(Array.from(fila, c => c ?? ''))
  })
  return filas
}

/** `entrada` solo se pasa en pruebas de Node (mammoth lee {buffer}); en el navegador es {arrayBuffer}. */
export async function leerDocx(datos: ArrayBuffer, entrada?: Record<string, unknown>): Promise<LecturaTabla> {
  const mammoth = (await import('mammoth')).default ?? (await import('mammoth'))
  const { value: html } = await mammoth.convertToHtml((entrada ?? { arrayBuffer: datos }) as never)
  const dom = new DOMParser().parseFromString(`<html><body>${html}</body></html>`, 'text/html')
  const filas: FilaImportacion[] = []
  const omitidas: string[] = []
  let enc: Encabezado | null = null
  let titulos: string[] = []

  Array.from(dom.getElementsByTagName('table')).forEach((t, n) => {
    const rej = rejilla(t)
    const iEnc = rej.findIndex(r => detectarEncabezado(r))
    if (iEnc === -1) { if (rej.length) omitidas.push(`Tabla ${n + 1}: sin encabezado reconocible`); return }
    const e = detectarEncabezado(rej[iEnc])!
    if (enc && e.firma !== enc.firma) { omitidas.push(`Tabla ${n + 1}: columnas distintas (no se importa en esta entrega)`); return }
    if (!enc) { enc = e; titulos = rej[iEnc] }
    const cuerpo: Linea[] = rej.slice(iEnc + 1).filter(r => !detectarEncabezado(r))
    filas.push(...construirFilas(cuerpo, enc, titulos))
  })
  return { filas, omitidas }
}
