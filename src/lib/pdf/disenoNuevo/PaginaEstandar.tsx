// Página A4 estándar del diseño nuevo (registro con datos, tablas y firmas): marca de agua,
// encabezado compacto en las páginas 2+, pie con el código del formato, encabezado de la
// página 1 y la primera sección de datos (con código, folio y fecha de emisión al frente).
// Las demás secciones van como `children` (usa <Seccion>).
import { Page, View } from '@react-pdf/renderer'
import type { ReactNode } from 'react'
import { EncabezadoPrimeraPagina, EncabezadoCompacto } from './Encabezado'
import { FranjaDatos, type CampoFranja } from './Franja'
import { TituloSeccion } from './TituloSeccion'
import { MarcaDeAgua } from './MarcaDeAgua'
import { Pie } from './Pie'
import { estiloPagina } from './estilos'
import { hoyMX } from '@/lib/fecha'

/** Fecha de generación del PDF (hoy en México) como dd/mm/aaaa. */
export function fechaEmisionHoy(): string {
  const [a, m, d] = hoyMX().split('-')
  return `${d}/${m}/${a}`
}

interface Props {
  orientacion?: 'landscape' | 'portrait'
  titulo: string
  subtitulo: string
  codigoFmt: string
  folio: string
  emision: string
  /** Registro capturado sin conexión y aún sin subir: se agrega la leyenda al pie. */
  pendienteSync?: boolean
  /** Sin título, la franja de datos va sola bajo el encabezado. */
  tituloDatos?: string
  camposDatos: CampoFranja[]
  /** false = el formato no tiene folio ni fecha de emisión propios: la franja lleva solo `camposDatos`. */
  trio?: boolean
  /** true = sin "Folio" (el formato no tiene folio propio); queda Formato + fecha de emisión. */
  sinFolio?: boolean
  /** Etiqueta del tercer dato de la franja (default "Emisión"); p. ej. "Fecha" o "Periodo". */
  etiquetaEmision?: string
  /** Texto del encabezado compacto (páginas 2+) en lugar de "Folio: …". */
  detalleCompacto?: string
  /** Fila de encabezado de columnas que se repite en el encabezado compacto (p. ej. los días de una matriz). */
  columnasCompactas?: ReactNode
  porRenglon?: number
  children?: ReactNode
}

/** Sección con título (barra menta); el título no se queda solo al final de una página. */
export function Seccion({ titulo, children }: { titulo: string; children?: ReactNode }) {
  return (
    <View style={{ marginTop: 4 }}>
      <View minPresenceAhead={50}>
        <TituloSeccion texto={titulo} />
      </View>
      {children}
    </View>
  )
}

export function PaginaEstandar({
  orientacion = 'landscape', titulo, subtitulo, codigoFmt, folio, emision, pendienteSync,
  tituloDatos, camposDatos, trio = true, sinFolio, etiquetaEmision = 'Emisión', detalleCompacto, columnasCompactas, porRenglon = 4, children,
}: Props) {
  return (
    <Page size="A4" orientation={orientacion} style={estiloPagina}>
      <MarcaDeAgua />

      {/* Encabezado compacto: solo páginas 2+ de este registro (subPageNumber, no el global) */}
      <View
        fixed
        style={{}}
        render={({ subPageNumber }) => (subPageNumber > 1 ? <EncabezadoCompacto titulo={titulo} folio={detalleCompacto ? undefined : folio} detalle={detalleCompacto} columnas={columnasCompactas} /> : <View />)}
      />

      <Pie codigo={pendienteSync ? `${codigoFmt}  |  Pendiente de sincronizar` : codigoFmt} />

      <EncabezadoPrimeraPagina titulo={titulo} subtitulo={subtitulo} />

      {tituloDatos ? <TituloSeccion texto={tituloDatos} /> : null}
      <FranjaDatos
        porRenglon={porRenglon}
        campos={[
          ...(trio ? camposTrio({ codigoFmt, folio, emision, etiquetaEmision, camposDatos, sinFolio }) : []),
          ...camposDatos,
        ]}
      />

      {children}
    </Page>
  )
}

/**
 * Formato / Folio / Emisión. Si el folio repite el valor de la emisión (periodo o fecha del
 * registro), no se imprime dos veces: queda el periodo/fecha una sola vez (y solo si no está ya
 * en los campos de datos) y "Emisión" siempre es la fecha de generación del PDF.
 */
function camposTrio({ codigoFmt, folio, emision, etiquetaEmision, camposDatos, sinFolio }: {
  codigoFmt: string; folio: string; emision: string; etiquetaEmision: string; camposDatos: CampoFranja[]; sinFolio?: boolean
}): CampoFranja[] {
  const formato: CampoFranja = { icono: 'codigo', etiqueta: 'Formato', valor: codigoFmt }
  if (sinFolio) return [formato, { icono: 'calendario', etiqueta: 'Emisión', valor: emision || fechaEmisionHoy() }]
  if (folio !== emision) {
    return [formato, { icono: 'folio', etiqueta: 'Folio', valor: folio }, { icono: 'calendario', etiqueta: etiquetaEmision, valor: emision }]
  }
  const yaEnCampos = camposDatos.some((c) => c.valor === emision)
  const periodo: CampoFranja[] = etiquetaEmision === 'Emisión' || yaEnCampos
    ? []
    : [{ icono: 'calendario', etiqueta: etiquetaEmision, valor: emision }]
  return [formato, ...periodo, { icono: 'calendario', etiqueta: 'Emisión', valor: fechaEmisionHoy() }]
}
