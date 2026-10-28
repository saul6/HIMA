// Lectura de PDF digital con texto (pdfjs-dist, en el navegador).
//  - Columnas: por la X del centro de cada encabezado detectado (las celdas de estos checklists van centradas).
//  - Renglones: por los rectángulos de celda que dibuja el PDF en la columna del código (cada celda = un renglón
//    lógico, con sus líneas internas). Si la página no trae celdas dibujadas, se agrupa por coordenada Y y se
//    unen las líneas de varias líneas (fusionarLineas).
import { detectarEncabezado, fusionarLineas, construirFilas, type Encabezado, type FilaImportacion, type Linea } from './tabla'
import { limpiar } from './fechas'

export class ArchivoSinTexto extends Error {
  constructor() {
    super('Este PDF es una imagen; por ahora solo se importan PDF con texto o Word')
    this.name = 'ArchivoSinTexto'
  }
}

interface Item { str: string; x0: number; x1: number; y: number }
interface Linea1 { y: number; items: Item[] }
interface Rect { x0: number; y0: number; x1: number; y1: number }

const TOL_Y = 2.5
const SECCION_APARTE = /complementari|org[aá]nic/i
/** Encabezado de la tabla de complementarios (DESCRIPCIÓN | OBSERVACIONES), distinta a la de documentos con código. */
const OTRA_TABLA = /descripci[oó]n.*observaciones/i
const centro = (i: { x0: number; x1: number }) => (i.x0 + i.x1) / 2

function agruparLineas(items: Item[]): Linea1[] {
  const orden = [...items].sort((a, b) => b.y - a.y || a.x0 - b.x0)
  const lineas: Linea1[] = []
  for (const it of orden) {
    const l = lineas.find(x => Math.abs(x.y - it.y) <= TOL_Y)
    if (l) l.items.push(it)
    else lineas.push({ y: it.y, items: [it] })
  }
  lineas.forEach(l => l.items.sort((a, b) => a.x0 - b.x0))
  return lineas.sort((a, b) => b.y - a.y)
}

interface Celda { texto: string; x0: number; x1: number }

/** Junta items vecinos (brecha corta o traslape en X) en celdas; sirve para encabezados de una o dos líneas. */
function celdasDeItems(items: Item[]): Celda[] {
  const orden = [...items].sort((a, b) => a.x0 - b.x0)
  const celdas: (Celda & { partes: Item[] })[] = []
  for (const it of orden) {
    const ult = celdas[celdas.length - 1]
    if (ult && it.x0 <= ult.x1 + 6) {
      ult.partes.push(it)
      ult.x1 = Math.max(ult.x1, it.x1)
    } else celdas.push({ texto: '', x0: it.x0, x1: it.x1, partes: [it] })
  }
  return celdas.map(c => ({
    x0: c.x0, x1: c.x1,
    texto: limpiar(c.partes.sort((a, b) => b.y - a.y || a.x0 - b.x0).map(p => p.str).join(' ')),
  }))
}

interface Geometria { enc: Encabezado; celdas: Celda[]; limites: number[]; titulos: string[] }

function armarGeometria(celdasIn: Celda[], enc: Encabezado): Geometria {
  let celdas = celdasIn
  let campos = enc.campos
  // Columna de tipo ("F" = formato) sin encabezado: hueco entre Área y la siguiente columna
  const iArea = campos.indexOf('area')
  if (!campos.includes('tipo_doc') && iArea !== -1 && celdas[iArea + 1] && celdas[iArea + 1].x0 - celdas[iArea].x1 > 20) {
    const x = (celdas[iArea].x1 + celdas[iArea + 1].x0) / 2
    celdas = [...celdas.slice(0, iArea + 1), { texto: '', x0: x, x1: x }, ...celdas.slice(iArea + 1)]
    campos = [...campos.slice(0, iArea + 1), 'tipo_doc', ...campos.slice(iArea + 1)]
  }
  const centros = celdas.map(centro)
  return {
    enc: { campos, firma: campos.map(c => c ?? '-').join('|') },
    celdas,
    limites: centros.slice(0, -1).map((c, k) => (c + centros[k + 1]) / 2),
    titulos: celdas.map(c => c.texto),
  }
}

function buscarEncabezado(lineas: Linea1[]): { geo: Geometria; yMin: number } | null {
  for (let i = 0; i < lineas.length; i++) {
    for (const span of [1, 2]) {
      const grupo = lineas.slice(i, i + span)
      if (grupo.length < span) continue
      const celdas = celdasDeItems(grupo.flatMap(g => g.items))
      const enc = detectarEncabezado(celdas.map(c => c.texto))
      if (enc) return { geo: armarGeometria(celdas, enc), yMin: Math.min(...grupo.map(g => g.y)) }
    }
  }
  return null
}

function columnaDe(it: Item, geo: Geometria): number {
  const c = centro(it)
  const col = geo.limites.findIndex(lim => c < lim)
  return col === -1 ? geo.celdas.length - 1 : col
}

function aCeldas(items: Item[], geo: Geometria): Linea {
  const celdas: string[] = geo.celdas.map(() => '')
  for (const it of [...items].sort((a, b) => b.y - a.y || a.x0 - b.x0)) {
    const col = columnaDe(it, geo)
    celdas[col] = celdas[col] ? `${celdas[col]} ${it.str}` : it.str
  }
  return celdas.map(limpiar)
}

/** Rectángulos que dibuja la página (celdas de la tabla). Defensivo: el formato de los args cambia entre versiones de pdfjs. */
async function rectsDePagina(page: { getOperatorList(): Promise<{ fnArray: number[]; argsArray: unknown[] }> }, ops: { constructPath: number }): Promise<Rect[]> {
  const ol = await page.getOperatorList()
  const rects: Rect[] = []
  for (let i = 0; i < ol.fnArray.length; i++) {
    if (ol.fnArray[i] !== ops.constructPath) continue
    const args = ol.argsArray[i] as unknown[]
    const caminos = args?.[1] as unknown
    const bbox = args?.[2] as Record<number, number> | undefined
    if (!Array.isArray(caminos) || !bbox) continue
    const primero = caminos[0] as ArrayLike<number> | undefined
    if (!primero || primero.length < 12 || primero.length > 14) continue // rectángulo = moveTo + 3 lineTo (+ cierre de ruta)
    const r = { x0: Number(bbox[0]), y0: Number(bbox[1]), x1: Number(bbox[2]), y1: Number(bbox[3]) }
    if ([r.x0, r.y0, r.x1, r.y1].some(Number.isNaN)) continue
    rects.push(r)
  }
  return rects
}

/** Renglones = celdas dibujadas en la columna del código (sin el encabezado), de arriba abajo. */
function renglonesDeRects(rects: Rect[], geo: Geometria, yMinEncabezado: number | null): Rect[] {
  const iCod = geo.enc.campos.indexOf('codigo')
  const cx = centro(geo.celdas[iCod])
  const candidatos = rects.filter(r => r.x0 <= cx && r.x1 >= cx && r.x1 - r.x0 > 20 && r.x1 - r.x0 < 160 && r.y1 - r.y0 > 6 && r.y1 - r.y0 < 300)
  // Solo las celdas completas: las cajas de texto y los filetes de borde son más angostos o más bajos
  const ancho = Math.max(0, ...candidatos.map(r => r.x1 - r.x0))
  const celdas = candidatos.filter(r => r.x1 - r.x0 >= ancho - 1.5)
  const unicos: Rect[] = []
  for (const r of celdas.sort((a, b) => b.y1 - a.y1 || b.y0 - a.y0)) {
    if (!unicos.some(u => Math.abs(u.y1 - r.y1) < 1.5 && Math.abs(u.y0 - r.y0) < 1.5)) unicos.push(r)
  }
  return unicos.filter(r => yMinEncabezado == null || r.y1 < yMinEncabezado)
}

export interface LecturaTabla { filas: FilaImportacion[]; omitidas: string[] }

/** `lib` solo se inyecta en pruebas (Node); en el navegador se carga pdfjs-dist con su worker del mismo origen. */
export async function leerPdf(datos: ArrayBuffer, lib?: typeof import('pdfjs-dist')): Promise<LecturaTabla> {
  let pdfjs = lib
  if (!pdfjs) {
    pdfjs = await import('pdfjs-dist')
    pdfjs.GlobalWorkerOptions.workerSrc = (await import('pdfjs-dist/build/pdf.worker.min.mjs?url')).default
  }

  const doc = await pdfjs.getDocument({ data: new Uint8Array(datos) }).promise
  let totalTexto = 0
  let geo: Geometria | null = null
  let detenido = false
  const omitidas: string[] = []
  const renglones: Linea[] = []

  for (let p = 1; p <= doc.numPages; p++) {
    const page = await doc.getPage(p)
    const contenido = await page.getTextContent()
    const items: Item[] = []
    for (const it of contenido.items) {
      if (!('str' in it) || !limpiar(it.str)) continue
      const x = it.transform[4]
      items.push({ str: it.str, x0: x, x1: x + it.width, y: it.transform[5] })
    }
    totalTexto += items.length
    if (detenido) { if (items.length) omitidas.push(`Página ${p}`); continue }

    const lineas = agruparLineas(items)
    const hallado = buscarEncabezado(lineas)
    let yMinEnc: number | null = null
    if (hallado) {
      if (geo && hallado.geo.enc.firma !== geo.enc.firma) {
        // Otra tabla con columnas distintas (complementarios, orgánico…): no se importa en esta entrega
        detenido = true
        omitidas.push(`Página ${p}: tabla distinta (no se importa en esta entrega)`)
        continue
      }
      if (!geo) geo = hallado.geo
      yMinEnc = hallado.yMin
    } else if (!geo) continue

    // Corte por sección aparte (complementarios / orgánico): lo de abajo no se importa
    let yCorte = -Infinity
    for (const l of lineas) {
      const texto = l.items.map(x => x.str).join(' ')
      if (SECCION_APARTE.test(texto) || OTRA_TABLA.test(texto)) {
        detenido = true
        yCorte = l.y
        omitidas.push(`Página ${p}: ${OTRA_TABLA.test(texto) ? 'tabla de complementarios' : `sección "${limpiar(texto).slice(0, 40)}"`} (no se importa en esta entrega)`)
        break
      }
    }
    const utiles = items.filter(i => i.y > yCorte)

    const rects = await rectsDePagina(page, pdfjs.OPS)
    const filasRect = renglonesDeRects(rects, geo!, yMinEnc).filter(r => r.y0 + 1 > yCorte)
    if (filasRect.length >= 3) {
      for (const r of filasRect) {
        const dentro = utiles.filter(i => i.y >= r.y0 - 0.5 && i.y <= r.y1 + 0.5)
        if (dentro.length) renglones.push(aCeldas(dentro, geo!))
      }
    } else {
      const bajo = yMinEnc == null ? utiles : utiles.filter(i => i.y < yMinEnc!)
      renglones.push(...fusionarLineas(agruparLineas(bajo).map(l => aCeldas(l.items, geo!)), geo!.enc))
    }
  }

  if (totalTexto === 0) throw new ArchivoSinTexto()
  if (!geo) return { filas: [], omitidas }
  return { filas: construirFilas(renglones, geo.enc, geo.titulos), omitidas }
}
