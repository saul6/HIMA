// Lectura de la columna "último registro" de los checklists de documentos: fecha + nota en una
// sola celda ("15/Agosto/26 - Actualizar"). Regla de oro: lo que no se entiende se conserva
// tal cual y se marca con una alerta; nunca se corrige solo.

export type PrecisionRegistro = 'dia' | 'mes' | 'texto'
export interface AlertaImport { campo: string; mensaje: string }

export interface RegistroParseado {
  fecha?: string
  texto?: string
  precision?: PrecisionRegistro
  /** Nota que acompaña a la fecha ("Actualizar", "Cambio de Rev. 03"); va a `antecedentes`. */
  nota?: string
  alertas: AlertaImport[]
}

const sinAcentos = (s: string) => s.normalize('NFD').replace(/[̀-ͯ]/g, '')

const MESES: Record<string, number> = {
  enero: 1, ene: 1, febrero: 2, feb: 2, marzo: 3, mar: 3, abril: 4, abr: 4, mayo: 5, may: 5, junio: 6, jun: 6,
  julio: 7, jul: 7, agosto: 8, ago: 8, septiembre: 9, setiembre: 9, sept: 9, sep: 9, set: 9,
  octubre: 10, oct: 10, noviembre: 11, nov: 11, diciembre: 12, dic: 12,
}

const mesDeNombre = (s: string): number | null => MESES[sinAcentos(s).toLowerCase().replace(/\./g, '')] ?? null

export const limpiar = (s: string) => s.replace(/\s+/g, ' ').trim()

const RE_FECHA = /^(\d{1,3})\s*[/\-.]\s*([A-Za-zÁÉÍÓÚÑáéíóúñ]{3,}\.?|\d{1,2})\s*[/\-.]\s*(\d{4}|\d{2})(?!\d)(.*)$/
const RE_MES_ANIO = /^([A-Za-zÁÉÍÓÚÑáéíóúñ]+)\.?\s*(?:de\s+)?(\d{4})$/
const RE_FECHA_SUELTA = /\d{1,3}\s*[/\-.]\s*(?:[A-Za-zÁÉÍÓÚÑáéíóúñ]{3,}|\d{1,2})\s*[/\-.]\s*\d{2,4}/

function diasDelMes(mes: number, anio: number): number {
  return new Date(anio, mes, 0).getDate()
}

export function parsearRegistro(celda: string): RegistroParseado {
  const t = limpiar(celda ?? '')
  if (!t) return { alertas: [] }

  const m = RE_FECHA.exec(t)
  if (m) {
    const [, diaTxt, mesTxt, anioTxt, resto] = m
    const mes = /^\d+$/.test(mesTxt) ? Number(mesTxt) : mesDeNombre(mesTxt)
    const anio = anioTxt.length === 2 ? 2000 + Number(anioTxt) : Number(anioTxt)
    const dia = Number(diaTxt)
    const valido = diaTxt.length <= 2 && mes != null && mes >= 1 && mes <= 12 && dia >= 1 && dia <= diasDelMes(mes, anio)
    if (!valido) {
      return {
        texto: t, precision: 'texto',
        alertas: [{ campo: 'ultimo_registro', mensaje: `La fecha "${t}" no es válida (día o mes imposible). Se conservó el texto original; corrígela tú.` }],
      }
    }
    const nota = limpiar(resto.replace(/^[\s\-–—:;,]+/, ''))
    const iso = `${anio}-${String(mes).padStart(2, '0')}-${String(dia).padStart(2, '0')}`
    return { fecha: iso, precision: 'dia', nota: nota || undefined, alertas: [] }
  }

  const my = RE_MES_ANIO.exec(t)
  if (my && mesDeNombre(my[1]) != null) {
    return {
      texto: t, precision: 'mes',
      alertas: [{ campo: 'ultimo_registro', mensaje: `Solo trae mes y año ("${t}"): falta el día. Se guardó como texto.` }],
    }
  }

  let mensaje: string
  if (/^n\s*\/?\s*a\.?$/i.test(t) || /^n\/a\b/i.test(t)) mensaje = `Dice "${t}": confirma si aplica o si hay un registro.`
  else if (RE_FECHA_SUELTA.test(t)) mensaje = `"${t}" trae texto además de la fecha (proveedor, formato…). No se interpretó; se conservó tal cual.`
  else mensaje = `"${t}" no se reconoció como fecha. Se conservó el texto original.`
  return { texto: t, precision: 'texto', alertas: [{ campo: 'ultimo_registro', mensaje }] }
}

/** Compara "Cambio de Rev. 03" (nota) con la revisión del renglón; si no coinciden, alerta en `revision`. */
export function alertaRevision(revision: string | undefined, ...textos: (string | undefined)[]): AlertaImport | null {
  const rev = revision?.match(/\d+/)?.[0]
  if (rev == null) return null
  for (const tx of textos) {
    const n = tx?.match(/rev\.?\s*(\d+)/i)?.[1]
    if (n != null && Number(n) !== Number(rev)) {
      return { campo: 'revision', mensaje: `La revisión del renglón es ${revision} pero la nota dice "${limpiar(tx!)}".` }
    }
  }
  return null
}
