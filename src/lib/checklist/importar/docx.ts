// Lectura de Word (.docx): mammoth → HTML → tablas con DOMParser. Lee las tres tablas del checklist v1.4
// (formatos, controles complementarios y orgánico); los saltos de línea de cada celda se conservan.
import { leerTablas, textoCelda, type LecturaTablas } from './tresTablas'

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
      const texto = textoCelda(td)
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

/** Texto del último párrafo no vacío antes de la tabla (para reconocer la sección orgánica). */
function textoPrevio(tabla: Element): string {
  let n: Element | null = tabla.previousElementSibling
  while (n && !(n.textContent ?? '').trim()) n = n.previousElementSibling
  return n && !/^table$/i.test(n.nodeName) ? (n.textContent ?? '').trim() : ''
}

/** `entrada` solo se pasa en pruebas de Node (mammoth lee {buffer}); en el navegador es {arrayBuffer}. */
export async function leerDocxTablas(datos: ArrayBuffer, entrada?: Record<string, unknown>): Promise<LecturaTablas> {
  const mammoth = (await import('mammoth')).default ?? (await import('mammoth'))
  const { value: html } = await mammoth.convertToHtml((entrada ?? { arrayBuffer: datos }) as never)
  const dom = new DOMParser().parseFromString(`<html><body>${html}</body></html>`, 'text/html')
  return leerTablas(Array.from(dom.getElementsByTagName('table')).map(t => ({ rej: rejilla(t), previo: textoPrevio(t) })))
}
