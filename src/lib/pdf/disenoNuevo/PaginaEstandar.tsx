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

interface Props {
  orientacion?: 'landscape' | 'portrait'
  titulo: string
  subtitulo: string
  codigoFmt: string
  folio: string
  emision: string
  /** Registro capturado sin conexión y aún sin subir: se agrega la leyenda al pie. */
  pendienteSync?: boolean
  tituloDatos: string
  camposDatos: CampoFranja[]
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
  tituloDatos, camposDatos, porRenglon = 4, children,
}: Props) {
  return (
    <Page size="A4" orientation={orientacion} style={estiloPagina}>
      <MarcaDeAgua />

      {/* Encabezado compacto: solo páginas 2+ de este registro (subPageNumber, no el global) */}
      <View
        fixed
        style={{}}
        render={({ subPageNumber }) => (subPageNumber > 1 ? <EncabezadoCompacto titulo={titulo} folio={folio} /> : <View />)}
      />

      <Pie codigo={pendienteSync ? `${codigoFmt}  |  Pendiente de sincronizar` : codigoFmt} />

      <EncabezadoPrimeraPagina titulo={titulo} subtitulo={subtitulo} />

      <TituloSeccion texto={tituloDatos} />
      <FranjaDatos
        porRenglon={porRenglon}
        campos={[
          { icono: 'codigo', etiqueta: 'Código', valor: codigoFmt },
          { icono: 'folio', etiqueta: 'Folio', valor: folio },
          { icono: 'calendario', etiqueta: 'Fecha', valor: emision },
          ...camposDatos,
        ]}
      />

      {children}
    </Page>
  )
}
