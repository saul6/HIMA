// Tabla del diseño nuevo: encabezado con fondo claro, bold navy y línea fina; filas con
// líneas PC.border; texto alineado arriba que baja de renglón dentro de su celda (las palabras
// largas se parten según el ancho real de la columna). El encabezado se repite en cada página y va
// pegado a su primera fila. Una fila que cabe en una página entera no se parte: si no cabe en lo
// que queda, pasa completa a la hoja siguiente; si no cabe ni en una hoja entera, se parte por
// renglones conservando sus columnas. Solo las columnas marcadas con `negativo` (campos donde
// "No", "NC"... es un fallo) pintan ese valor en rojo suave; solo cambia el color, no el texto.
import { View, Text } from '@react-pdf/renderer'
import { Fragment, type ReactNode } from 'react'
import { PC } from '@/lib/pdf/components/tokens'
import { estiloNegativo } from './negativo'
import { SIN_ENCOGER } from './estilos'
import { alturaTexto, anchoTexto, lineasTexto, partirParaAncho, ALTO_UTIL_PAGINA, FRACCION_MAX_BLOQUE } from './medirTexto'

/** Ancho útil de una hoja A4 con márgenes de 40 pt. */
export const ANCHO_UTIL = { landscape: 841.89 - 80, portrait: 595.28 - 80 } as const

export interface ColumnaDato {
  texto: string
  /** Ancho relativo: las columnas se escalan para ocupar todo `anchoTotal`. */
  ancho: number
  align?: 'left' | 'center' | 'right'
  /** true = en esta columna "No" / "NC" / "X" es un fallo y sale en rojo suave. */
  negativo?: boolean
  /** Ancho mínimo en pt. Las columnas de fecha ("20/10/2026" en un renglón) y las palabras del encabezado lo calculan solas. */
  anchoMin?: number
}

export type CeldaDato =
  | string
  | number
  | null
  | undefined
  | { texto: string | number; color?: string; negrita?: boolean; prefijo?: string }
  /** `nodo` puede ser una función que recibe el ancho útil de la celda (para partir palabras a ese ancho). `texto` es el
   *  contenido aproximado, solo para calcular la altura de la fila. */
  | { nodo: ReactNode | ((anchoUtil: number) => ReactNode); texto?: string }

/** Fila de banda que cubre todas las columnas (p. ej. el nombre de un área). */
export type FilaBanda = { banda: string }

interface Props {
  columnas: ColumnaDato[]
  filas: (CeldaDato[] | FilaBanda)[]
  anchoTotal?: number
  /** Texto de una sola fila cuando no hay filas. */
  vacio?: string
  /** Tamaño de letra de las celdas y del encabezado (default 8 / 7). */
  fuente?: number
  fuenteEnc?: number
  /** Fila de grupos sobre el encabezado (mismas unidades relativas que `ancho`; texto '' = hueco). */
  encabezadoSuperior?: { texto: string; ancho: number }[]
  /** false = el encabezado no se repite en cada página (tablas chicas junto a otras). */
  encabezadoFijo?: boolean
}

const PAD = 4

/** Reparte `anchoTotal` según `ancho` relativo, respetando los mínimos (fechas y palabras del encabezado). */
export function repartirAnchos(columnas: ColumnaDato[], anchoTotal: number, fuente: number, fuenteEnc: number): number[] {
  const suma = columnas.reduce((a, c) => a + c.ancho, 0) || 1
  const minimos = columnas.map((c) => {
    const palabras = c.texto.split(/\s+/).filter(Boolean)
    const palabraLarga = palabras.reduce((m, p) => Math.max(m, anchoTexto(p, fuenteEnc, true)), 0)
    const fecha = /fecha/i.test(c.texto) ? anchoTexto('00/00/0000', fuente) + 2 * PAD + 2 : 0
    return Math.min(Math.max(c.anchoMin ?? 0, fecha, palabraLarga + 2 * PAD), anchoTotal / columnas.length * 1.6)
  })
  const w = columnas.map((c) => (c.ancho * anchoTotal) / suma)
  const fijas = new Set<number>()
  for (let ronda = 0; ronda < columnas.length; ronda++) {
    let cambio = false
    w.forEach((v, i) => { if (!fijas.has(i) && v < minimos[i]) { w[i] = minimos[i]; fijas.add(i); cambio = true } })
    if (!cambio) break
    const usado = [...fijas].reduce((a, i) => a + w[i], 0)
    const libres = w.map((_, i) => i).filter((i) => !fijas.has(i))
    const sumaLibres = libres.reduce((a, i) => a + columnas[i].ancho, 0) || 1
    libres.forEach((i) => { w[i] = ((anchoTotal - usado) * columnas[i].ancho) / sumaLibres })
  }
  return w
}

function textoDe(celda: CeldaDato): { texto: string; negrita: boolean } {
  if (celda != null && typeof celda === 'object') {
    if ('nodo' in celda) return { texto: celda.texto ?? '', negrita: false }
    return { texto: String(celda.texto ?? ''), negrita: !!celda.negrita }
  }
  return { texto: celda == null ? '' : String(celda), negrita: false }
}

function altoFila(fila: CeldaDato[], w: number[], fuente: number): number {
  let max = 0
  fila.forEach((celda, i) => {
    const { texto, negrita } = textoDe(celda)
    const prefijo = celda != null && typeof celda === 'object' && 'prefijo' in celda && celda.prefijo
      ? alturaTexto(celda.prefijo, w[i] - 2 * PAD, PREFIJO_FUENTE, true) + 2
      : 0
    const h = celda != null && typeof celda === 'object' && 'nodo' in celda && !celda.texto
      ? 12
      : alturaTexto(texto, w[i] - 2 * PAD, fuente, negrita) + prefijo
    if (h > max) max = h
  })
  return max + 2 * PAD + 1
}


const INTERLINEADO = 1.2
const PREFIJO_FUENTE = 7

interface Pieza { celdas: CeldaDato[]; ultima: boolean }

/**
 * Una fila cuyo texto no cabe en una página se reparte en varias filas ("piezas") que sí caben, cada una con
 * las mismas columnas. El corte nativo de react-pdf encima los textos de columnas distintas, por eso el
 * texto se parte aquí, por renglones. Las celdas `nodo` se quedan en la primera pieza.
 */
export function dividirFila(fila: CeldaDato[], w: number[], fuente: number, maxPieza: number): Pieza[] {
  const capacidad = Math.max(3, Math.floor((maxPieza - 2 * PAD - 1) / (fuente * INTERLINEADO)))
  const listas = fila.map((celda, i) => {
    if (celda != null && typeof celda === 'object' && 'nodo' in celda) return null
    const { texto, negrita } = textoDe(celda)
    return lineasTexto(texto, w[i] - 2 * PAD, fuente, negrita)
  })
  const piezas = Math.max(1, ...listas.map((l, i) => {
    if (!l) return 1
    const c = fila[i]
    const prefijo = c != null && typeof c === 'object' && 'prefijo' in c && c.prefijo ? 1 : 0
    return Math.ceil((l.length + prefijo) / capacidad)
  }))
  const out: Pieza[] = []
  for (let k = 0; k < piezas; k++) {
    const celdas = fila.map((celda, i) => {
      const l = listas[i]
      if (!l) return k === 0 ? celda : ''
      const obj = celda != null && typeof celda === 'object' ? celda : null
      const prefijo = obj && 'prefijo' in obj && obj.prefijo ? 1 : 0
      const desde = k === 0 ? 0 : k * capacidad - prefijo
      const hasta = (k + 1) * capacidad - prefijo
      const texto = l.slice(desde, hasta).join('\n')
      return obj && 'texto' in obj
        ? { ...obj, texto, prefijo: k === 0 ? obj.prefijo : undefined }
        : texto
    })
    out.push({ celdas, ultima: k === piezas - 1 })
  }
  return out
}

/** Alto exacto de una pieza: sus renglones por el interlineado real de Helvetica en react-pdf (1.1 × tamaño) más el relleno. */
export function alturaPieza(pieza: Pieza, w: number[], fuente: number): number {
  let renglones = 1
  let extra = 0
  pieza.celdas.forEach((celda, i) => {
    if (celda != null && typeof celda === 'object' && 'nodo' in celda) return
    const { texto, negrita } = textoDe(celda)
    const prefijo = celda != null && typeof celda === 'object' && 'prefijo' in celda && celda.prefijo
    const n = lineasTexto(texto, w[i] - 2 * PAD, fuente, negrita).length
    const e = prefijo ? PREFIJO_FUENTE * 1.1 + 2 : 0
    if (n * fuente * 1.1 + e > renglones * fuente * 1.1 + extra) { renglones = n; extra = e }
  })
  return renglones * fuente * 1.1 + extra + 2 * PAD + 1
}

export function TablaDatos({
  columnas, filas, anchoTotal = ANCHO_UTIL.landscape, vacio,
  fuente = 8, fuenteEnc = 7, encabezadoSuperior, encabezadoFijo = true,
}: Props) {
  const suma = columnas.reduce((a, c) => a + c.ancho, 0) || 1
  const w = repartirAnchos(columnas, anchoTotal, fuente, fuenteEnc)
  const horizontal = anchoTotal > ANCHO_UTIL.portrait + 1
  const maxBloque = (horizontal ? ALTO_UTIL_PAGINA.landscape : ALTO_UTIL_PAGINA.portrait) * FRACCION_MAX_BLOQUE
  // Un encabezado más alto que ~un tercio de la hoja no se repite en cada página: react-pdf entraría en un ciclo
  // (cada página se llenaría solo con el encabezado).
  const altoEncabezado = Math.max(...columnas.map((c, i) => alturaTexto(c.texto, w[i] - 2 * PAD, fuenteEnc, true) + 10)) + (encabezadoSuperior ? 14 : 0)
  const repetirEncabezado = encabezadoFijo && altoEncabezado < (horizontal ? ALTO_UTIL_PAGINA.landscape : ALTO_UTIL_PAGINA.portrait) / 3
  const altos = filas.map((f) => (Array.isArray(f) ? altoFila(f, w, fuente) : 18))
  // Las filas que no caben en una hoja entera se reparten en piezas; el resto se queda como una sola.
  const maxPieza = maxBloque * 0.5
  const filasRender: (({ banda: string } & { piezas?: never }) | { piezas: Pieza[] })[] = filas.map((f, r) => (
    Array.isArray(f)
      ? { piezas: altos[r] > maxBloque ? dividirFila(f, w, fuente, maxPieza) : [{ celdas: f, ultima: true }] }
      : f
  ))
  // La primera fila (con el encabezado) debe caber junto: si no hay lugar, la tabla empieza en la hoja siguiente.
  const presenciaInicial = Math.min(altoEncabezado, maxPieza) + 6 + Math.min(altos[0] ?? 24, maxPieza)

  return (
    <>
      <View minPresenceAhead={presenciaInicial} style={{ height: 0 }} />
      <View style={{ marginBottom: 10, ...SIN_ENCOGER }}>
        <View {...(repetirEncabezado ? { fixed: true } : {})} style={{ backgroundColor: PC.m13Fondo, borderBottomWidth: 0.75, borderBottomColor: PC.m13Navy, ...SIN_ENCOGER }}>
          {encabezadoSuperior && (
            <View style={{ flexDirection: 'row' }}>
              {encabezadoSuperior.map((g, i) => {
                const ancho = (g.ancho * anchoTotal) / suma
                return (
                  <Text
                    key={i}
                    style={{
                      width: ancho,
                      paddingTop: 4,
                      paddingHorizontal: PAD,
                      fontFamily: 'Helvetica-Bold',
                      fontSize: fuenteEnc,
                      color: PC.m13Navy,
                      textAlign: 'center',
                    }}
                    hyphenationCallback={partirParaAncho(ancho - 2 * PAD, fuenteEnc, true)}
                  >
                    {g.texto}
                  </Text>
                )
              })}
            </View>
          )}
          <View style={{ flexDirection: 'row' }}>
            {columnas.map((c, i) => (
              <Text
                key={i}
                style={{
                  width: w[i],
                  paddingVertical: 5,
                  paddingHorizontal: PAD,
                  fontFamily: 'Helvetica-Bold',
                  fontSize: fuenteEnc,
                  color: PC.m13Navy,
                  textAlign: c.align ?? 'left',
                }}
                hyphenationCallback={partirParaAncho(w[i] - 2 * PAD, fuenteEnc, true)}
              >
                {c.texto}
              </Text>
            ))}
          </View>
        </View>

        {filas.length === 0 && vacio ? (
          <View style={{ paddingVertical: 8, borderBottomWidth: 0.5, borderBottomColor: PC.border }}>
            <Text style={{ fontSize: 8, color: PC.fieldLabel, textAlign: 'center' }}>{vacio}</Text>
          </View>
        ) : (
          filasRender.map((fila, r) => (
            'piezas' in fila ? (
              <Fragment key={r}>
                {fila.piezas.map((pieza, k) => (
                  <View
                    key={k}
                    wrap={false}
                    style={{
                      flexDirection: 'row',
                      ...SIN_ENCOGER,
                      // Alto fijo (renglones × interlineado real de Helvetica): react-pdf mide mal el texto con saltos de renglón forzados.
                      ...(fila.piezas.length > 1 ? { height: alturaPieza(pieza, w, fuente) } : {}),
                      ...(pieza.ultima ? { borderBottomWidth: 0.5, borderBottomColor: PC.border } : {}),
                    }}
                  >
                    {pieza.celdas.map((celda, i) => {
                      const anchoUtil = w[i] - 2 * PAD
                      if (celda != null && typeof celda === 'object' && 'nodo' in celda) {
                        return (
                          <View key={i} style={{ width: w[i], paddingVertical: PAD, paddingHorizontal: PAD, ...SIN_ENCOGER }}>
                            {typeof celda.nodo === 'function' ? celda.nodo(anchoUtil) : celda.nodo}
                          </View>
                        )
                      }
                      const obj = celda != null && typeof celda === 'object'
                      const texto = obj ? celda.texto : celda
                      const str = texto == null ? '' : String(texto)
                      const negrita = obj && !!celda.negrita
                      const prefijo = obj && 'prefijo' in celda ? celda.prefijo : undefined
                      const cuerpo = (
                        <Text
                          style={{
                            fontSize: fuente,
                            color: PC.fieldValue,
                            textAlign: columnas[i].align ?? 'left',
                            ...(columnas[i].negativo ? estiloNegativo(str) : {}),
                            ...(obj && celda.color ? { color: celda.color } : {}),
                            ...(negrita ? { fontFamily: 'Helvetica-Bold' } : {}),
                          }}
                          hyphenationCallback={partirParaAncho(anchoUtil, fuente, negrita)}
                        >
                          {str}
                        </Text>
                      )
                      return (
                        <View key={i} style={{ width: w[i], paddingVertical: PAD, paddingHorizontal: PAD, ...SIN_ENCOGER }}>
                          {prefijo ? (
                            <Text style={{ fontSize: PREFIJO_FUENTE, fontFamily: 'Helvetica-Bold', color: PC.m13Navy, marginBottom: 2 }} hyphenationCallback={partirParaAncho(anchoUtil, PREFIJO_FUENTE, true)}>{prefijo}</Text>
                          ) : null}
                          {cuerpo}
                        </View>
                      )
                    })}
                  </View>
                ))}
              </Fragment>
            ) : (
              <View
                key={r}
                wrap={false}
                minPresenceAhead={30}
                style={{ flexDirection: 'row', alignItems: 'center', backgroundColor: PC.m13MentaSuave, paddingVertical: 3, paddingRight: 4, ...SIN_ENCOGER }}
              >
                <View style={{ width: 2.5, alignSelf: 'stretch', backgroundColor: PC.m13Menta, marginRight: 4 }} />
                <Text style={{ fontSize: fuente, fontFamily: 'Helvetica-Bold', color: PC.m13Navy }} hyphenationCallback={partirParaAncho(anchoTotal - 14, fuente, true)}>{fila.banda}</Text>
              </View>
            )
          ))
        )}
      </View>
    </>
  )
}
