// Página A4 horizontal de una matriz mensual (M9, M11, M19, M23): encabezado, franja
// de datos, matriz, notas y firmas con el diseño nuevo. Cada módulo solo aporta sus
// textos y datos; la cuadrícula del formato oficial no cambia.
import { Page, View, Text } from '@react-pdf/renderer'
import type { ComponentProps } from 'react'
import { PC } from '@/lib/pdf/components/tokens'
import { EncabezadoPrimeraPagina, EncabezadoCompacto } from './Encabezado'
import { FranjaDatos, type CampoFranja } from './Franja'
import { TituloSeccion } from './TituloSeccion'
import { MarcaDeAgua } from './MarcaDeAgua'
import { Pie } from './Pie'
import { PdfFirmas } from './PdfFirmas'
import { MatrizMensual, ColumnasMatrizCompacta, type ItemMatriz } from './MatrizMensual'
import { estiloPagina } from './estilos'

// A4 horizontal: 841.89 × 595.28; márgenes de 40 pt
const PAGE_W = 841.89 - 80
const ITEM_COL_W = 160

export function diasDelMes(mesDate: string): string[] {
  const d = new Date(mesDate + 'T12:00:00')
  const year = d.getFullYear()
  const month = d.getMonth()
  const total = new Date(year, month + 1, 0).getDate()
  const result: string[] = []
  for (let i = 1; i <= total; i++) {
    result.push(`${year}-${String(month + 1).padStart(2, '0')}-${String(i).padStart(2, '0')}`)
  }
  return result
}

interface Props {
  titulo: string
  subtitulo: string
  codigoFmt: string
  folio: string
  emision: string
  /** Campos de "datos generales" del módulo, en su orden de siempre. */
  campos: CampoFranja[]
  porRenglon?: number
  seccion1: string
  seccion2: string
  seccion3: string
  items: ItemMatriz[]
  mesDate: string
  diasInspeccionados: string[]
  matriz: Record<string, Record<string, string>>
  defaultVal: string
  codigosCorrectivos?: { diaNum: string; itemLabel: string; codigo: string }[]
  /** Observaciones / Otro: solo los que tengan texto. */
  notas?: CampoFranja[]
  firmas: ComponentProps<typeof PdfFirmas>['signatures']
}

export function PaginaMatrizMensual({
  titulo, subtitulo, codigoFmt, folio, emision, campos, porRenglon = 4,
  seccion1, seccion2, seccion3, items, mesDate, diasInspeccionados, matriz, defaultVal,
  codigosCorrectivos = [], notas = [], firmas,
}: Props) {
  const todosLosDias = diasDelMes(mesDate)
  const dayColW = Math.floor((PAGE_W - ITEM_COL_W) / Math.max(todosLosDias.length, 1))
  const inspeccionadosSet = new Set(diasInspeccionados)

  return (
    <Page size="A4" orientation="landscape" style={estiloPagina}>
      <MarcaDeAgua />

      {/* Encabezado compacto con los días repetidos: solo páginas 2+ de este mes */}
      <View
        fixed
        style={{}}
        render={({ subPageNumber }) => (subPageNumber > 1 ? (
          <EncabezadoCompacto
            titulo={titulo}
            folio={folio}
            columnas={<ColumnasMatrizCompacta todosLosDias={todosLosDias} itemColW={ITEM_COL_W} dayColW={dayColW} />}
          />
        ) : <View />)}
      />

      <Pie codigo={codigoFmt} />

      <EncabezadoPrimeraPagina titulo={titulo} subtitulo={subtitulo} />

      <TituloSeccion texto={seccion1.toUpperCase()} />
      <FranjaDatos
        porRenglon={porRenglon}
        campos={[
          { icono: 'codigo', etiqueta: 'Formato', valor: codigoFmt },
          { icono: 'folio', etiqueta: 'Folio', valor: folio },
          { icono: 'calendario', etiqueta: 'Emisión', valor: emision },
          ...campos,
        ]}
      />

      <TituloSeccion texto={seccion2.toUpperCase()} />
      <MatrizMensual
        items={items}
        todosLosDias={todosLosDias}
        inspeccionadosSet={inspeccionadosSet}
        matriz={matriz}
        itemColW={ITEM_COL_W}
        dayColW={dayColW}
        defaultVal={defaultVal}
      />

      <View style={{ marginTop: 14 }}>
        <TituloSeccion texto={seccion3.toUpperCase()} />
      </View>

      {codigosCorrectivos.length > 0 && (
        <View style={{ marginBottom: 8, paddingHorizontal: 4 }}>
          <Text style={{ fontSize: 7, fontFamily: 'Helvetica-Bold', color: PC.m13Navy, marginBottom: 3 }}>
            CÓDIGOS CORRECTIVOS:
          </Text>
          {codigosCorrectivos.map((cc, i) => (
            <Text key={i} style={{ fontSize: 6, color: PC.fieldValue, marginBottom: 1 }}>
              Día {cc.diaNum} — {cc.itemLabel}: {cc.codigo}
            </Text>
          ))}
        </View>
      )}

      {notas.length > 0 && <FranjaDatos campos={notas} porRenglon={notas.length} margenInferior={4} />}

      <PdfFirmas signatures={firmas} />
    </Page>
  )
}
