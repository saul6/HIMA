// Matriz mensual tipo calendario del diseño nuevo (M9, M11, M19, M23 y las que la usen).
// Formato oficial primero: conserva la cuadrícula, una columna por día, los mismos
// valores (Si / No / N/A) y los días no inspeccionados en blanco. Solo cambian el
// color de las líneas, el encabezado, las bandas de sección y el rojo suave de los negativos.
import { View, Text } from '@react-pdf/renderer'
import { PC } from '@/lib/pdf/components/tokens'
import { partirPalabraLarga } from '@/lib/pdf/components/texto'
import { estiloNegativo } from './negativo'
import { estiloColumnaCompacta } from './Encabezado'

export interface ItemMatriz {
  id: string
  seccion_label: string
  item: string
}

interface Props {
  items: ItemMatriz[]
  todosLosDias: string[]
  inspeccionadosSet: Set<string>
  matriz: Record<string, Record<string, string>>
  itemColW: number
  dayColW: number
  defaultVal?: string
}

const TITULO_ITEM = 'Ítem de inspección'
const LINEA = 0.5

function agrupar(items: ItemMatriz[]) {
  const grupos: { label: string; items: ItemMatriz[] }[] = []
  let actual: { label: string; items: ItemMatriz[] } | null = null
  for (const item of items) {
    if (!actual || actual.label !== item.seccion_label) {
      actual = { label: item.seccion_label, items: [] }
      grupos.push(actual)
    }
    actual.items.push(item)
  }
  return grupos
}

function dayNum(iso: string): string {
  try { return String(new Date(iso + 'T12:00:00').getDate()) }
  catch { return iso }
}

const celda = {
  borderRightWidth: LINEA,
  borderRightColor: PC.border,
  borderBottomWidth: LINEA,
  borderBottomColor: PC.border,
} as const

const fila = { flexDirection: 'row', borderLeftWidth: LINEA, borderLeftColor: PC.border } as const

/** Encabezado de columnas para repetir en las páginas 2+ (dentro de EncabezadoCompacto). Sin filas anidadas. */
export function ColumnasMatrizCompacta({ todosLosDias, itemColW, dayColW }: Pick<Props, 'todosLosDias' | 'itemColW' | 'dayColW'>) {
  return (
    <>
      <Text style={{ ...estiloColumnaCompacta, width: itemColW, paddingLeft: 4 }}>{TITULO_ITEM}</Text>
      {todosLosDias.map((f) => (
        <Text key={f} style={{ ...estiloColumnaCompacta, fontSize: 6, width: dayColW, textAlign: 'center' }}>
          {dayNum(f)}
        </Text>
      ))}
    </>
  )
}

export function MatrizMensual({
  items, todosLosDias, inspeccionadosSet, matriz, itemColW, dayColW, defaultVal = 'No',
}: Props) {
  const grupos = agrupar(items)

  return (
    <View>
      {/* Fila de encabezados */}
      <View wrap={false} style={{ ...fila, backgroundColor: PC.m13Fondo, borderTopWidth: LINEA, borderTopColor: PC.border }}>
        <View style={{ ...celda, width: itemColW, paddingVertical: 3, paddingHorizontal: 4, justifyContent: 'center' }}>
          <Text style={{ fontSize: 7, fontFamily: 'Helvetica-Bold', color: PC.m13Navy }}>{TITULO_ITEM}</Text>
        </View>
        {todosLosDias.map((fecha) => (
          <View key={fecha} style={{ ...celda, width: dayColW, paddingVertical: 3, alignItems: 'center', justifyContent: 'center' }}>
            <Text style={{ fontSize: 6, fontFamily: 'Helvetica-Bold', color: PC.m13Navy }}>{dayNum(fecha)}</Text>
          </View>
        ))}
      </View>

      {/* Secciones con ítems */}
      {grupos.map((grupo) => (
        <View key={grupo.label}>
          <View
            wrap={false}
            minPresenceAhead={30}
            style={{ flexDirection: 'row', alignItems: 'center', backgroundColor: PC.m13MentaSuave, paddingVertical: 2, paddingRight: 4 }}
          >
            <View style={{ width: 2.5, alignSelf: 'stretch', backgroundColor: PC.m13Menta, marginRight: 4 }} />
            <Text style={{ fontSize: 7, fontFamily: 'Helvetica-Bold', color: PC.m13Navy, flex: 1 }} hyphenationCallback={partirPalabraLarga}>
              {grupo.label}
            </Text>
          </View>

          {grupo.items.map((item, idx) => {
            const bg = idx % 2 === 0 ? PC.white : PC.m13Fondo
            return (
              <View key={item.id} wrap={false} style={{ ...fila, backgroundColor: bg }}>
                <View style={{ ...celda, width: itemColW, paddingVertical: 2, paddingHorizontal: 4, justifyContent: 'flex-start' }}>
                  <Text style={{ fontSize: 5.5, color: PC.fieldValue }} hyphenationCallback={partirPalabraLarga}>{item.item}</Text>
                </View>
                {todosLosDias.map((fecha) => {
                  if (!inspeccionadosSet.has(fecha)) {
                    return <View key={fecha} style={{ ...celda, width: dayColW }} />
                  }
                  const val = matriz[fecha]?.[item.id] ?? defaultVal
                  const color = /^si$/i.test(val) ? PC.m13Navy : PC.textSub
                  return (
                    <View key={fecha} style={{ ...celda, width: dayColW, alignItems: 'center', justifyContent: 'center', paddingVertical: 2 }}>
                      <Text style={{ fontSize: 6, fontFamily: 'Helvetica-Bold', color, ...estiloNegativo(val) }}>{val}</Text>
                    </View>
                  )
                })}
              </View>
            )
          })}
        </View>
      ))}
    </View>
  )
}
