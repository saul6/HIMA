// Planificación de la página del M13: calcula el alto de cada incidencia ANTES de
// dibujarla (con el ancho/alto real de sus fotos) para decidir si cabe en una
// página, si hay que reducir las fotos o si hay que partirla entre fotos.
// Función pura, sin react-pdf.

import { dimensionesDeDataUri } from '@/lib/pdf/disenoNuevo/dimensionesImagen'

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

export function planificarIncidencias(
  incidencias: { orden: number; descripcion: string; dataUris: string[] }[],
): BloquePlan[] {
  const bloques: BloquePlan[] = []

  for (const inc of incidencias) {
    const fotos = aFotosPlan(inc.dataUris)
    const hTexto = altoTexto(inc.descripcion)
    const base = { orden: inc.orden, descripcion: inc.descripcion }

    // 1) Cabe completa a tamaño normal
    if (altoFotos(fotos, 1) <= ALTO_DISPONIBLE) {
      bloques.push({ ...base, key: `${inc.orden}-0`, fotos, escala: 1, continua: false, conTexto: true, noPartir: hTexto <= ALTO_DISPONIBLE })
      continue
    }

    // 2) Reducir las fotos por igual (mínimo 55 %) hasta que quepan
    const fijo = GAP_FOTOS * (fotos.length - 1) + PAD_CELDA * 2 + 2
    const sumaRatios = fotos.reduce((a, f) => a + f.ratio, 0)
    const escalaAjuste = (ALTO_DISPONIBLE - fijo) / (FOTO_W * sumaRatios)
    if (escalaAjuste >= ESCALA_MIN) {
      bloques.push({ ...base, key: `${inc.orden}-0`, fotos, escala: escalaAjuste, continua: false, conTexto: true, noPartir: hTexto <= ALTO_DISPONIBLE })
      continue
    }

    // 3) Ni así cabe: partir entre fotos (a 55 %), repitiendo la píldora "(continúa)"
    const grupos: FotoPlan[][] = []
    let actual: FotoPlan[] = []
    for (const f of fotos) {
      if (actual.length > 0 && altoFotos([...actual, f], ESCALA_MIN) > ALTO_DISPONIBLE) {
        grupos.push(actual)
        actual = []
      }
      actual.push(f)
    }
    if (actual.length > 0) grupos.push(actual)
    grupos.forEach((g, gi) => {
      bloques.push({
        ...base,
        key: `${inc.orden}-${gi}`,
        fotos: g,
        escala: ESCALA_MIN,
        continua: gi > 0,
        conTexto: gi === 0,
        noPartir: gi > 0 || hTexto <= ALTO_DISPONIBLE,
      })
    })
  }

  return bloques
}
