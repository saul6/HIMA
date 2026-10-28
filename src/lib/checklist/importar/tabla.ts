// De celdas crudas (PDF o Word) a los renglones que espera chk_importacion_crear.
import { alertaRevision, limpiar, parsearRegistro, type AlertaImport } from './fechas'

export type Campo = 'area' | 'tipo_doc' | 'revision' | 'numeral' | 'nombre' | 'codigo' | 'registro' | 'observaciones'

const sinAcentos = (s: string) => s.normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase().trim()

/** Qué campo representa un encabezado; la columna de fecha (se llama como la instalación) se infiere por posición. */
function campoDeEncabezado(h: string): Campo | null {
  const t = sinAcentos(h).replace(/[.:]/g, '')
  if (!t) return null
  if (/^area/.test(t)) return 'area'
  if (/^(f|tipo)$/.test(t)) return 'tipo_doc'
  if (/^rev/.test(t)) return 'revision'
  if (/^#/.test(t) || /^(no|num|numeral|formato)$/.test(t)) return 'numeral'
  if (/^nombre/.test(t)) return 'nombre'
  if (/^codigo/.test(t)) return 'codigo'
  if (/observ|responsable/.test(t)) return 'observaciones'
  return null
}

export interface Encabezado {
  /** campo por índice de columna (null = sin significado conocido) */
  campos: (Campo | null)[]
  firma: string
}

/** ¿Esta fila de celdas es el encabezado de la tabla de documentos? Devuelve el mapeo o null. */
export function detectarEncabezado(celdas: string[]): Encabezado | null {
  const campos = celdas.map(campoDeEncabezado)
  const conocidos = new Set(campos.filter(Boolean))
  if (!(conocidos.has('nombre') && conocidos.has('codigo') && conocidos.size >= 4)) return null
  // Columna de fecha: la primera sin significado entre código y observaciones (o la última sin significado)
  const iCod = campos.indexOf('codigo')
  const iObs = campos.indexOf('observaciones')
  const fin = iObs === -1 ? campos.length : iObs
  let iReg = -1
  for (let i = iCod + 1; i < fin; i++) if (campos[i] == null && limpiar(celdas[i] ?? '')) { iReg = i; break }
  if (iReg === -1) for (let i = campos.length - 1; i > iCod; i--) if (campos[i] == null && limpiar(celdas[i] ?? '')) { iReg = i; break }
  if (iReg !== -1) campos[iReg] = 'registro'
  return { campos, firma: campos.map(c => c ?? '-').join('|') }
}

/** Texto de cada columna (unido por espacio, o sin espacio si la línea anterior terminaba en guion). */
function unir(a: string, b: string): string {
  if (!a) return b
  if (!b) return a
  return /[-/]$/.test(a) ? `${a}${b}` : `${a} ${b}`
}

export type Linea = string[] // una celda por columna del encabezado

/**
 * Reúne líneas físicas en renglones lógicos: un renglón nuevo empieza en una línea con numeral,
 * código o tipo; las demás continúan el renglón anterior (celdas de varias líneas).
 */
export function fusionarLineas(lineas: Linea[], enc: Encabezado): Linea[] {
  const iNum = enc.campos.indexOf('numeral')
  const iCod = enc.campos.indexOf('codigo')
  const iTipo = enc.campos.indexOf('tipo_doc')
  const iArea = enc.campos.indexOf('area')
  const salida: Linea[] = []
  for (const l of lineas) {
    if (l.every(c => !limpiar(c))) continue
    const empieza = [iNum, iCod, iTipo].some(i => i !== -1 && limpiar(l[i] ?? ''))
    const previo = salida[salida.length - 1]
    if (!empieza && previo) {
      for (let i = 0; i < l.length; i++) {
        // El área se centra verticalmente en celdas combinadas: no pega con el renglón anterior
        if (i === iArea) continue
        previo[i] = unir(previo[i] ?? '', limpiar(l[i] ?? ''))
      }
      continue
    }
    salida.push(l.map(c => limpiar(c ?? '')))
  }
  return salida
}

export interface FilaImportacion {
  original: Record<string, string>
  datos: Record<string, string | number>
  alertas: AlertaImport[]
}

/** Renglones lógicos → filas para chk_importacion_crear. El área se arrastra hacia abajo. */
export function construirFilas(renglones: Linea[], enc: Encabezado, titulos: string[]): FilaImportacion[] {
  const idx = (c: Campo) => enc.campos.indexOf(c)
  const val = (r: Linea, c: Campo) => { const i = idx(c); return i === -1 ? '' : limpiar(r[i] ?? '') }
  const filas: FilaImportacion[] = []
  let areaActual = ''
  for (const r of renglones) {
    const nombre = val(r, 'nombre')
    const codigo = val(r, 'codigo')
    const area = val(r, 'area')
    if (area) areaActual = area
    // Renglón sin nombre ni código: separador o residuo, no un documento
    if (!nombre && !codigo) continue

    const original: Record<string, string> = {}
    r.forEach((c, i) => { if (c) original[titulos[i] || `col${i + 1}`] = c })

    const alertas: AlertaImport[] = []
    const datos: Record<string, string | number> = { seccion: 1 }
    const poner = (k: string, v: string) => { if (v) datos[k] = v }
    poner('area', areaActual)
    poner('tipo_doc', val(r, 'tipo_doc'))
    poner('revision', val(r, 'revision'))
    poner('numeral', val(r, 'numeral'))
    poner('nombre', nombre)
    poner('codigo', codigo)
    poner('responsable_llenado', val(r, 'observaciones'))
    if (!nombre) alertas.push({ campo: 'nombre', mensaje: 'El renglón no trae nombre.' })
    if (!codigo) alertas.push({ campo: 'codigo', mensaje: 'El renglón no trae código.' })

    const reg = parsearRegistro(val(r, 'registro'))
    if (reg.fecha) datos.ultimo_registro_fecha = reg.fecha
    if (reg.texto) datos.ultimo_registro_texto = reg.texto
    if (reg.precision) datos.ultimo_registro_precision = reg.precision
    if (reg.nota) datos.antecedentes = reg.nota
    alertas.push(...reg.alertas)
    const ar = alertaRevision(val(r, 'revision'), reg.nota, reg.texto)
    if (ar) alertas.push(ar)

    filas.push({ original, datos, alertas })
  }
  return filas
}
