// Planificación de la página del M13: calcula el alto de cada incidencia ANTES de
// dibujarla (con el ancho/alto real de sus fotos) para decidir si cabe en una
// página, si hay que reducir las fotos o si hay que partirla entre fotos.
// Función pura, sin react-pdf.

import { dimensionesDeDataUri } from '@/lib/pdf/disenoNuevo/dimensionesImagen'
import { lineasTexto } from '@/lib/pdf/disenoNuevo/medirTexto'

export const COL_EVIDENCIA = 206          // 40 % de los 515 pt útiles (A4 con 40 pt de margen)
export const PAD_CELDA = 8
export const FOTO_W = COL_EVIDENCIA - PAD_CELDA * 2
export const GAP_FOTOS = 6
const RATIO_PLACEHOLDER = 0.68            // foto que falló: caja 190 x 130
const RATIO_SIN_DIMENSIONES = 0.75        // si no se puede leer el encabezado: 4:3 horizontal
const ESCALA_MIN = 0.55

// Alto útil de una tarjeta en páginas 2+ (842 - paddingTop 104 - paddingBottom 56),
// con holgura para el margen inferior de la tarjeta.
export const ALTO_DISPONIBLE = 650

const LINEA_TEXTO = 12.6                  // 9 pt * lineHeight 1.4
const CARACTERES_POR_LINEA = 46           // conservador para ~290 pt de columna a 9 pt
const ALTO_PILDORA = 22

export interface FotoPlan {
  uri: string                             // '' = foto fallida (se dibuja caja gris)
  ratio: number                           // alto / ancho
}

export interface BloquePlan {
  key: string
  orden: number
  descripcion: string
  fotos: FotoPlan[]
  escala: number
  continua: boolean                       // segundo bloque o posterior de una incidencia partida
  conTexto: boolean                       // false en los bloques "continúa"
  noPartir: boolean                       // wrap={false} solo si cabe en una página
  texto?: string                          // renglones ya repartidos (solo si el texto se partió entre páginas)
}

function altoFotos(fotos: FotoPlan[], escala: number): number {
  if (fotos.length === 0) return 0
  const suma = fotos.reduce((a, f) => a + FOTO_W * escala * f.ratio, 0)
  return suma + GAP_FOTOS * (fotos.length - 1) + PAD_CELDA * 2 + 2
}

export function altoTexto(descripcion: string): number {
  const lineas = descripcion
    .split('\n')
    .reduce((a, p) => a + Math.max(1, Math.ceil(p.length / CARACTERES_POR_LINEA)), 0)
  return ALTO_PILDORA + lineas * LINEA_TEXTO + PAD_CELDA * 2 + 2
}

function aFotosPlan(dataUris: string[]): FotoPlan[] {
  if (dataUris.length === 0) return [{ uri: '', ratio: RATIO_PLACEHOLDER }]
  return dataUris.map((uri) => {
    if (!uri) return { uri, ratio: RATIO_PLACEHOLDER }
    const d = dimensionesDeDataUri(uri)
    return { uri, ratio: d ? d.h / d.w : RATIO_SIN_DIMENSIONES }
  })
}

const ANCHO_TEXTO = 288                    // columna de texto: 515 - 206 - barra 2.5 - rellenos 8 + 10
const MARGEN_TARJETA = 8                  // marginBottom de la tarjeta
const HOLGURA = 12                        // la estimación de alturas nunca debe quedarse corta
/** Si lo que queda de la hoja es más que esta fracción de la hoja, la tarjeta empieza ahí y se parte (no salta entera). */
export const FRACCION_PARTIR = 0.35
const ALTO_HOJA_UTIL = 842 - 104 - 56     // alto útil de una hoja 2+ sin holgura

/** Alto aproximado de lo que ocupa la página 1 antes de la primera tarjeta (encabezado, franja, título y encabezado de tabla). */
export function altoUsadoPagina1(auditorNombre: string | null | undefined): number {
  const lineas = lineasTexto(auditorNombre ?? '-', 100, 8, true).length
  return 206 + 11 * Math.max(0, lineas - 1)
}

export function planificarIncidencias(
  incidencias: { orden: number; descripcion: string; dataUris: string[] }[],
  usadoPagina1 = 220,
): BloquePlan[] {
  const bloques: BloquePlan[] = []
  // Espacio que queda en la hoja actual (la 1 trae menos: encabezado completo, franja y título)
  let restante = 842 - 56 - usadoPagina1 - HOLGURA - MARGEN_TARJETA
  restante = Math.min(restante, ALTO_DISPONIBLE)
  const nuevaHoja = () => { restante = ALTO_DISPONIBLE }

  for (const inc of incidencias) {
    let fotos = aFotosPlan(inc.dataUris)

    // Escala de las fotos: normal, reducida hasta 55 % para que quepan en una hoja, o 55 % y a partir en varias
    let escala = 1
    if (altoFotos(fotos, 1) > ALTO_DISPONIBLE) {
      const fijo = GAP_FOTOS * (fotos.length - 1) + PAD_CELDA * 2 + 2
      const sumaRatios = fotos.reduce((a, f) => a + f.ratio, 0)
      const ajuste = (ALTO_DISPONIBLE - fijo) / (FOTO_W * sumaRatios)
      escala = ajuste >= ESCALA_MIN ? ajuste : ESCALA_MIN
    }

    let lineas = lineasTexto(inc.descripcion, ANCHO_TEXTO, 9)
    const textoEntero = inc.descripcion
    let parte = 0
    let partido = false
    while (fotos.length > 0 || lineas.length > 0 || parte === 0) {
      const hFotos = (n: number) => altoFotos(fotos.slice(0, n), escala)
      const hTexto = (n: number) => ALTO_PILDORA + n * LINEA_TEXTO + PAD_CELDA * 2 + 2
      const hTodo = Math.max(hFotos(fotos.length), hTexto(lineas.length))

      let nFotos = fotos.length
      let nLineas = lineas.length
      if (hTodo > restante) {
        // No cabe entera: si lo que queda es poco, salta a la hoja siguiente; si es mucho, se parte aquí
        if (restante <= FRACCION_PARTIR * ALTO_HOJA_UTIL && restante < ALTO_DISPONIBLE) { nuevaHoja(); continue }
        nFotos = 0
        while (nFotos < fotos.length && hFotos(nFotos + 1) <= restante) nFotos++
        nLineas = Math.max(0, Math.min(lineas.length, Math.floor((restante - ALTO_PILDORA - PAD_CELDA * 2 - 2) / LINEA_TEXTO)))
        if (nFotos === 0 && nLineas === 0) { nuevaHoja(); continue }
      }

      const parteFotos = fotos.slice(0, nFotos)
      const parteLineas = lineas.slice(0, nLineas)
      const resto = nFotos < fotos.length || nLineas < lineas.length
      if (resto) partido = true
      const h = Math.max(parteFotos.length ? altoFotos(parteFotos, escala) : 0, hTexto(parteLineas.length))
      bloques.push({
        key: `${inc.orden}-${parte}`,
        orden: inc.orden,
        descripcion: inc.descripcion,
        fotos: parteFotos,
        escala,
        continua: parte > 0,
        conTexto: parte === 0 || parteLineas.length > 0,
        noPartir: true,
        texto: partido || parte > 0 ? parteLineas.join('\n') : textoEntero,
      })
      restante -= h + MARGEN_TARJETA
      fotos = fotos.slice(nFotos)
      lineas = lineas.slice(nLineas)
      parte++
      if (resto) nuevaHoja()
      if (parte > 200) break
    }
    if (restante < 0) nuevaHoja()
  }

  return bloques
}
