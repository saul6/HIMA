// Tabla del diseño nuevo: encabezado con fondo claro, bold navy y línea fina; filas con
// líneas PC.border; texto alineado arriba que no se sale de la celda. El encabezado se
// repite en cada página y cada fila se mantiene entera. Los valores negativos
// ("No", "X", "NC"...) salen en rojo suave; solo cambia el color, no el texto.
import { View, Text } from '@react-pdf/renderer'
import { PC } from '@/lib/pdf/components/tokens'
import { partirPalabraLarga } from '@/lib/pdf/components/texto'
import { estiloNegativo } from './negativo'

/** Ancho útil de una hoja A4 con márgenes de 40 pt. */
export const ANCHO_UTIL = { landscape: 841.89 - 80, portrait: 595.28 - 80 } as const

export interface ColumnaDato {
  texto: string
  /** Ancho relativo: las columnas se escalan para ocupar todo `anchoTotal`. */
  ancho: number
  align?: 'left' | 'center' | 'right'
}

export type CeldaDato =
  | string
  | number
  | null
  | undefined
  | { texto: string | number; color?: string; negrita?: boolean }

interface Props {
  columnas: ColumnaDato[]
  filas: CeldaDato[][]
  anchoTotal?: number
  /** Texto de una sola fila cuando no hay filas. */
  vacio?: string
}

const PAD = 4

export function TablaDatos({ columnas, filas, anchoTotal = ANCHO_UTIL.landscape, vacio }: Props) {
  const suma = columnas.reduce((a, c) => a + c.ancho, 0) || 1
  const w = columnas.map((c) => (c.ancho * anchoTotal) / suma)

  return (
    <View style={{ marginBottom: 10 }}>
      <View
        fixed
        style={{
          flexDirection: 'row',
          backgroundColor: PC.m13Fondo,
          borderBottomWidth: 0.75,
          borderBottomColor: PC.m13Navy,
        }}
      >
        {columnas.map((c, i) => (
          <Text
            key={i}
            style={{
              width: w[i],
              paddingVertical: 5,
              paddingHorizontal: PAD,
              fontFamily: 'Helvetica-Bold',
              fontSize: 7,
              color: PC.m13Navy,
              textAlign: c.align ?? 'left',
            }}
          >
            {c.texto}
          </Text>
        ))}
      </View>

      {filas.length === 0 && vacio ? (
        <View style={{ paddingVertical: 8, borderBottomWidth: 0.5, borderBottomColor: PC.border }}>
          <Text style={{ fontSize: 8, color: PC.fieldLabel, textAlign: 'center' }}>{vacio}</Text>
        </View>
      ) : (
        filas.map((fila, r) => (
          <View key={r} wrap={false} style={{ flexDirection: 'row', borderBottomWidth: 0.5, borderBottomColor: PC.border }}>
            {fila.map((celda, i) => {
              const obj = celda != null && typeof celda === 'object'
              const texto = obj ? celda.texto : celda
              const str = texto == null ? '' : String(texto)
              return (
                <Text
                  key={i}
                  style={{
                    width: w[i],
                    paddingVertical: 4,
                    paddingHorizontal: PAD,
                    fontSize: 8,
                    color: PC.fieldValue,
                    textAlign: columnas[i].align ?? 'left',
                    ...estiloNegativo(str),
                    ...(obj && celda.color ? { color: celda.color } : {}),
                    ...(obj && celda.negrita ? { fontFamily: 'Helvetica-Bold' } : {}),
                  }}
                  hyphenationCallback={partirPalabraLarga}
                >
                  {str}
                </Text>
              )
            })}
          </View>
        ))
      )}
    </View>
  )
}
