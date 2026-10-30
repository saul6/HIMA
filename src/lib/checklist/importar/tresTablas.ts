// Checklist v1.4: de las tres tablas del Word (formatos, controles complementarios y orgánico)
// a los renglones que espera chk_importacion_crear. Todo es texto literal: no se convierte nada a fecha.
import { detectarEncabezado, type FilaImportacion } from './tabla'
import { limpiar, type AlertaImport } from './fechas'

export interface CrudaT1 {
  area: string; tipo_doc: string; revision: string; numeral: string; nombre: string; codigo: string
  /** una celda por columna de fecha del documento */
  fechas: string[]
  observacion: string
}
export interface CrudaT2 { n: string; descripcion: string; observacion: string; categoria: string | null; esNota: boolean }
export interface CrudaT3 { n: string; documento: string; categoria: string | null }

export interface LecturaTablas {
  /** encabezados de las columnas de fecha de la Tabla 1 (dos en un documento con dos alcances) */
  columnasFecha: string[]
  t1: CrudaT1[]
  t2: CrudaT2[]
  t3: CrudaT3[]
  omitidas: string[]
}

export interface AlcanceRef { id: string; nombre: string }

export const NOMBRE_NOTA = 'Observaciones generales'

const sinAcentos = (s: string) => s.normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase().trim()
/** "—", "-", "N/A vacío" y similares cuentan como celda vacía; el resto se conserva tal cual. */
const VACIOS = new Set(['', '-', '–', '—', '−', '--'])
export const sinGuion = (s: string) => (VACIOS.has(s.trim()) ? '' : s.trim())

/** Texto de una celda conservando los saltos de línea (<br>, párrafos, listas). */
export function textoCelda(el: Element): string {
  const partes: string[] = []
  const recorrer = (n: Node) => {
    if (n.nodeType === 3) { partes.push(n.nodeValue ?? ''); return }
    if (n.nodeType !== 1) return
    const e = n as Element
    const bloque = /^(p|div|li|ul|ol|tr)$/i.test(e.nodeName)
    if (/^br$/i.test(e.nodeName)) { partes.push('\n'); return }
    if (bloque) partes.push('\n')
    Array.from(e.childNodes as unknown as ArrayLike<Node>).forEach(recorrer)
    if (bloque) partes.push('\n')
  }
  recorrer(el)
  return partes.join('').split('\n').map(l => l.replace(/[ \t ]+/g, ' ').trim()).filter(Boolean).join('\n')
}

// ── Clasificación de tablas ──────────────────────────────────────────────────

type Tipo = 't1' | 't2' | 't3'

function clasificar(rej: string[][], previo: string): { tipo: Tipo; iEnc: number } | null {
  const iT1 = rej.findIndex(r => detectarEncabezado(r))
  if (iT1 !== -1) return { tipo: 't1', iEnc: iT1 }
  const norm = rej.map(r => r.map(c => sinAcentos(limpiar(c))))
  const iT2 = norm.findIndex(r => r.some(c => /^descripci/.test(c)) && r.some(c => /^observ/.test(c)))
  if (iT2 !== -1) return { tipo: 't2', iEnc: iT2 }
  const iT3 = norm.findIndex(r => r.some(c => /^(documento|concepto|requisito|nombre)/.test(c)) && !r.some(c => /^(codigo|descripci|observ)/.test(c)))
  if (iT3 !== -1 && (/organic/.test(sinAcentos(previo)) || norm[iT3].length <= 3)) return { tipo: 't3', iEnc: iT3 }
  return null
}

// ── Lectura ──────────────────────────────────────────────────────────────────

/** `tablas`: cada tabla ya expandida a rejilla de texto, con el texto que la precede en el documento. */
export function leerTablas(tablas: { rej: string[][]; previo: string }[]): LecturaTablas {
  const out: LecturaTablas = { columnasFecha: [], t1: [], t2: [], t3: [], omitidas: [] }
  let firmaT1: string | null = null

  tablas.forEach(({ rej, previo }, n) => {
    const c = clasificar(rej, previo)
    if (!c) { if (rej.length) out.omitidas.push(`Tabla ${n + 1}: sin encabezado reconocible`); return }
    const cuerpo = rej.slice(c.iEnc + 1)
    if (c.tipo === 't1') {
      const enc = detectarEncabezado(rej[c.iEnc])!
      if (firmaT1 && enc.firma !== firmaT1) { out.omitidas.push(`Tabla ${n + 1}: columnas distintas a la Tabla 1`); return }
      firmaT1 = enc.firma
      leerT1(rej[c.iEnc], enc.campos, cuerpo, out)
    } else if (c.tipo === 't2') leerT2(rej[c.iEnc], cuerpo, out)
    else leerT3(rej[c.iEnc], cuerpo, out)
  })
  return out
}

function leerT1(titulos: string[], campos: (string | null)[], cuerpo: string[][], out: LecturaTablas) {
  const idx = (k: string) => campos.indexOf(k)
  const iCod = idx('codigo')
  const iObs = idx('observaciones')
  const fin = iObs === -1 ? campos.length : iObs
  // Columnas de fecha: entre el código y las observaciones, las que no son otro campo y traen encabezado
  const colsFecha: number[] = []
  for (let i = iCod + 1; i < fin; i++) if ((campos[i] == null || campos[i] === 'registro') && limpiar(titulos[i] ?? '')) colsFecha.push(i)
  if (colsFecha.length === 0 && idx('registro') !== -1) colsFecha.push(idx('registro'))
  if (out.columnasFecha.length === 0) out.columnasFecha = colsFecha.map(i => limpiar(titulos[i] ?? '') || `Columna ${i + 1}`)

  const val = (r: string[], k: string) => { const i = idx(k); return i === -1 ? '' : (r[i] ?? '').trim() }
  let areaActual = ''
  for (const r of cuerpo) {
    if (detectarEncabezado(r)) continue
    const nombre = val(r, 'nombre'); const codigo = val(r, 'codigo')
    const area = val(r, 'area')
    if (area) areaActual = area
    if (!nombre && !codigo) continue
    out.t1.push({
      area: areaActual, tipo_doc: val(r, 'tipo_doc'), revision: val(r, 'revision'), numeral: val(r, 'numeral'),
      nombre, codigo, fechas: colsFecha.map(i => (r[i] ?? '').trim()), observacion: val(r, 'observaciones'),
    })
  }
}

/** Filas con una sola celda llena: títulos de categoría (o la nota general si es la última). */
const celdasLlenas = (r: string[]) => r.filter(c => c.trim()).length

function leerT2(titulos: string[], cuerpo: string[][], out: LecturaTablas) {
  const norm = titulos.map(t => sinAcentos(limpiar(t)))
  const iN = norm.findIndex(t => /^(#|n|no|num)/.test(t))
  const iDesc = norm.findIndex(t => /^descripci/.test(t))
  const iObs = norm.findIndex(t => /^observ/.test(t))
  let categoria: string | null = null
  const filas = cuerpo.filter(r => celdasLlenas(r) > 0)
  const iUltima = filas.length - 1
  filas.forEach((r, k) => {
    const desc = (r[iDesc] ?? '').trim()
    const obs = (r[iObs] ?? '').trim()
    const n = iN === -1 ? '' : (r[iN] ?? '').trim()
    const soloUna = celdasLlenas(r) === 1
    // Observaciones generales: última fila, combinada (mismo texto en descripción y observaciones, o una sola celda larga)
    const combinada = desc && desc === obs
    const esNota = k === iUltima && (combinada || /^observaciones?\b/i.test(desc) || (soloUna && !n && (desc || obs).length > 60))
    if (esNota) {
      out.t2.push({ n, descripcion: NOMBRE_NOTA, observacion: desc && obs && desc !== obs ? `${desc}\n${obs}` : (obs || desc), categoria: null, esNota: true })
      return
    }
    if (soloUna && !n) { categoria = desc || obs; return }
    if (!desc) return
    out.t2.push({ n, descripcion: desc, observacion: sinGuion(obs), categoria, esNota: false })
  })
}

function leerT3(titulos: string[], cuerpo: string[][], out: LecturaTablas) {
  const norm = titulos.map(t => sinAcentos(limpiar(t)))
  const iN = norm.findIndex(t => /^(#|n|no|num)/.test(t))
  let iDoc = norm.findIndex(t => /^(documento|concepto|requisito|nombre)/.test(t))
  if (iDoc === -1) iDoc = Math.max(0, titulos.length - 1)
  let categoria: string | null = null
  for (const r of cuerpo) {
    if (celdasLlenas(r) === 0) continue
    const doc = (r[iDoc] ?? '').trim()
    const n = iN === -1 ? '' : (r[iN] ?? '').trim()
    if (celdasLlenas(r) === 1 && !n) { categoria = doc || r.find(c => c.trim())?.trim() || null; continue }
    if (doc) out.t3.push({ n, documento: doc, categoria })
  }
}

// ── Construcción de p_filas ──────────────────────────────────────────────────

export interface OpcionesFilas {
  /** alcance (id) al que corresponde cada columna de fecha de la Tabla 1; null = ignorar esa columna */
  alcancePorColumna: (string | null)[]
  /** alcances de la instalación, para proponer el de cada fila de la Tabla 2 */
  alcances: AlcanceRef[]
}

const poner = (d: Record<string, string | number | boolean | null>, k: string, v: string | null | undefined) => { if (v) d[k] = v }

/** Alcances que una descripción menciona entre paréntesis, p. ej. "Reporte (Cal Giant)". */
function alcancesMencionados(texto: string, alcances: AlcanceRef[]): AlcanceRef[] {
  const entre = Array.from(texto.matchAll(/\(([^)]*)\)/g), m => sinAcentos(m[1]))
  if (entre.length === 0) return []
  return alcances.filter(a => entre.some(e => e.includes(sinAcentos(a.nombre))))
}

export function construirFilasTablas(l: LecturaTablas, o: OpcionesFilas): FilaImportacion[] {
  const filas: FilaImportacion[] = []
  const multiColumna = l.columnasFecha.length > 1
  const columnas = l.columnasFecha.length === 0 ? [-1] : l.columnasFecha.map((_, i) => i)

  // Tabla 1: una vez por alcance, cada una con su fecha
  for (const ci of columnas) {
    const alcance = ci === -1 ? null : (o.alcancePorColumna[ci] ?? null)
    if (ci !== -1 && multiColumna && !alcance) continue // columna sin alcance asignado: se ignora
    l.t1.forEach((r, i) => {
      const datos: FilaImportacion['datos'] = { seccion: 1, orden: i + 1 }
      const fecha = ci === -1 ? '' : sinGuion(r.fechas[ci] ?? '')
      poner(datos, 'area', r.area); poner(datos, 'tipo_doc', sinGuion(r.tipo_doc)); poner(datos, 'revision', sinGuion(r.revision))
      poner(datos, 'numeral', sinGuion(r.numeral)); poner(datos, 'nombre', r.nombre); poner(datos, 'codigo', r.codigo)
      if (fecha) { datos.ultimo_registro_texto = fecha; datos.ultimo_registro_precision = 'texto' }
      poner(datos, 'antecedentes', sinGuion(r.observacion))
      if (alcance) datos.alcance_id = alcance
      const alertas: AlertaImport[] = []
      if (!r.nombre) alertas.push({ campo: 'nombre', mensaje: 'El renglón no trae nombre.' })
      if (!r.codigo) alertas.push({ campo: 'codigo', mensaje: 'El renglón no trae código.' })
      filas.push({
        original: { area: r.area, codigo: r.codigo, nombre: r.nombre, rev: r.revision, fecha: ci === -1 ? '' : (r.fechas[ci] ?? ''), observacion: r.observacion,
          ...(ci !== -1 && multiColumna ? { columna_fecha: l.columnasFecha[ci] } : {}) },
        datos, alertas,
      })
    })
  }

  // Tabla 2: una sola vez, como compartida (salvo mención entre paréntesis)
  l.t2.forEach((r, i) => {
    const datos: FilaImportacion['datos'] = { seccion: 2, orden: i + 1, nombre: r.descripcion, es_nota: r.esNota }
    poner(datos, 'antecedentes', r.observacion)
    poner(datos, 'categoria', r.categoria)
    const alertas: AlertaImport[] = []
    if (!r.esNota && o.alcances.length > 0) {
      const m = alcancesMencionados(r.descripcion, o.alcances)
      if (m.length === 1) datos.alcance_id = m[0].id
      else if (m.length > 1) datos.atribucion_por_confirmar = true // menciona ambos: compartido, por confirmar
    }
    if (r.esNota && o.alcances.length > 1) datos.atribucion_por_confirmar = true
    filas.push({ original: { n: r.n, descripcion: r.descripcion, observacion: r.observacion }, datos, alertas })
  })

  // Tabla 3: solo si el archivo la trae
  l.t3.forEach((r, i) => {
    const datos: FilaImportacion['datos'] = { seccion: 3, orden: i + 1, nombre: r.documento }
    poner(datos, 'categoria', r.categoria)
    filas.push({ original: { n: r.n, documento: r.documento }, datos, alertas: [] })
  })
  return filas
}
