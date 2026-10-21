// Estimación de la altura de un texto en Helvetica (para decidir si una fila o bloque cabe en una página
// entera antes de dibujarlo). No dibuja nada: react-pdf hace el corte de renglones real; esto solo
// compara contra la altura de la hoja con un margen de seguridad.

// Anchos AFM de Helvetica (milésimas de em) para ASCII 32..126.
const ANCHOS = [
  278, 278, 355, 556, 556, 889, 667, 191, 333, 333, 389, 584, 278, 333, 278, 278, // espacio ! " # $ % & ' ( ) * + , - . /
  556, 556, 556, 556, 556, 556, 556, 556, 556, 556, 278, 278, 584, 584, 584, 556, // 0-9 : ; < = > ?
  1015, 667, 667, 722, 722, 667, 611, 778, 722, 278, 500, 667, 556, 833, 722, 778, // @ A-O
  667, 778, 722, 667, 611, 722, 667, 944, 667, 667, 611, 278, 278, 278, 469, 556, // P-Z [ \ ] ^ _
  333, 556, 556, 500, 556, 556, 278, 556, 556, 222, 222, 500, 222, 833, 556, 556, // ` a-o
  556, 556, 333, 500, 278, 556, 500, 722, 500, 500, 500, 334, 260, 334, 584, // p-z { | } ~
]
const BASE_ACENTOS: Record<string, string> = {
  á: 'a', é: 'e', í: 'i', ó: 'o', ú: 'u', ü: 'u', ñ: 'n', Á: 'A', É: 'E', Í: 'I', Ó: 'O', Ú: 'U', Ü: 'U', Ñ: 'N',
}

function anchoCaracter(c: string): number {
  const base = BASE_ACENTOS[c] ?? c
  const code = base.charCodeAt(0)
  if (code >= 32 && code <= 126) return ANCHOS[code - 32]
  return 556
}

/** Ancho en puntos de una cadena (sin saltos de renglón). La negrita pesa ~7 % más. */
export function anchoTexto(texto: string, fuente: number, negrita = false): number {
  let w = 0
  for (const c of texto) w += anchoCaracter(c)
  return (w * fuente * (negrita ? 1.07 : 1)) / 1000
}

/**
 * `hyphenationCallback` que parte las palabras que no caben en `ancho` pt en trozos que sí caben, para que
 * nunca se salgan de su celda (`partirPalabraLarga` parte cada 24 letras sin mirar el ancho). Se deja un
 * margen para el guion que react-pdf agrega al partir.
 */
export function partirParaAncho(ancho: number, fuente: number, negrita = false) {
  const tope = Math.max(ancho - 4, fuente)
  return (palabra: string): string[] => {
    if (anchoTexto(palabra, fuente, negrita) <= tope) return [palabra]
    const trozos: string[] = []
    let actual = ''
    for (const c of palabra) {
      if (actual && anchoTexto(actual + c, fuente, negrita) > tope) { trozos.push(actual); actual = c } else actual += c
    }
    if (actual) trozos.push(actual)
    return trozos
  }
}

/**
 * Renglones de `texto` en una caja de `ancho` pt, con las palabras largas ya partidas. Se usa para calcular
 * alturas y para repartir un texto larguísimo en varias filas (el corte nativo de react-pdf encima textos).
 * Los renglones se arman con ~3 % + 1 pt de holgura: si la celda se encoge una fracción de punto por redondeo,
 * react-pdf no vuelve a cortar el renglón (y el alto calculado sigue siendo el real).
 */
export function lineasTexto(texto: string, ancho: number, fuente: number, negrita = false): string[] {
  const util = ancho * 0.97 - 1
  const partir = partirParaAncho(util, fuente, negrita)
  const espacio = anchoTexto(' ', fuente, negrita)
  const lineas: string[] = []
  for (const parrafo of String(texto ?? '').split('\n')) {
    let actual = ''
    let usado = 0
    for (const palabra of parrafo.split(/\s+/).filter(Boolean)) {
      partir(palabra).forEach((trozo, i) => {
        const w = anchoTexto(trozo, fuente, negrita)
        const unir = actual !== '' && i === 0
        if (actual !== '' && usado + (unir ? espacio : 0) + w > util) { lineas.push(actual); actual = trozo; usado = w }
        else { actual = unir ? `${actual} ${trozo}` : actual + trozo; usado += (unir ? espacio : 0) + w }
      })
    }
    lineas.push(actual)
  }
  return lineas
}

/** Cantidad de renglones que ocupa `texto` en una caja de `ancho` pt (parte las palabras largas como el PDF). */
export function renglonesTexto(texto: string, ancho: number, fuente: number, negrita = false): number {
  return texto ? lineasTexto(texto, ancho, fuente, negrita).length : 1
}

/** Altura estimada de un texto: renglones × interlineado (Helvetica ≈ 1.15 × tamaño; 1.2 como margen). */
export function alturaTexto(texto: string, ancho: number, fuente: number, negrita = false, interlineado = 1.2): number {
  return renglonesTexto(texto, ancho, fuente, negrita) * fuente * interlineado
}

/** Alto útil de una hoja A4 con los márgenes del diseño (40 arriba, 56 abajo) menos encabezado compacto y de tabla. */
export const ALTO_UTIL_PAGINA = { landscape: 595.28 - 96 - 60, portrait: 841.89 - 96 - 60 } as const
/** Un bloque que mida más de esta fracción de la página se deja partir por renglones en lugar de saltar a una hoja nueva. */
export const FRACCION_MAX_BLOQUE = 0.88
