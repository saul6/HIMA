// Componente de matriz mensual reutilizable (M9, M11, M19, M23).
// Renders: fila header con números de día + secciones agrupadas con filas de ítems.
// No incluye PdfPageFrame — el llamador usa la página directamente para preservar ancho.

import { View, Text } from '@react-pdf/renderer'
import { PC } from './tokens'

const HDR_BG  = '#EFF7F9'
const ROW_ALT = '#F5F9FE'
const SI_TEXT = '#0D5A8F'
const NO_TEXT = '#C02A2A'

interface MatrixItem {
  id: string
  seccion_label: string
  item: string
}

interface PdfMonthlyMatrixProps {
  items: MatrixItem[]
  todosLosDias: string[]
  inspeccionadosSet: Set<string>
  matriz: Record<string, Record<string, string>>
  itemColW: number
  dayColW: number
  defaultVal?: string
}

function agrupar(items: MatrixItem[]) {
  const grupos: { label: string; items: MatrixItem[] }[] = []
  let actual: { label: string; items: MatrixItem[] } | null = null
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

function valorColor(val: string): string {
  if (val === 'Si' || val === 'SI') return SI_TEXT
  if (val === 'No' || val === 'NO') return NO_TEXT
  return PC.textSub
}

export function PdfMonthlyMatrix({
  items, todosLosDias, inspeccionadosSet, matriz, itemColW, dayColW, defaultVal = 'No',
}: PdfMonthlyMatrixProps) {
  const grupos = agrupar(items)

  return (
    <View>
      {/* Fila de encabezados */}
      <View style={{ flexDirection: 'row' }}>
        <View style={{
          width: itemColW,
          borderWidth: 1, borderColor: PC.border,
          backgroundColor: HDR_BG,
          paddingVertical: 3, paddingHorizontal: 4,
          justifyContent: 'center',
        }}>
          <Text style={{ fontSize: 7, fontFamily: 'Helvetica-Bold', color: PC.fieldValue }}>
            Item de inspeccion
          </Text>
        </View>
        {todosLosDias.map((fecha) => (
          <View key={fecha} style={{
            width: dayColW,
            borderWidth: 1, borderColor: PC.border,
            backgroundColor: HDR_BG,
            paddingVertical: 3,
            alignItems: 'center', justifyContent: 'center',
          }}>
            <Text style={{ fontSize: 6, fontFamily: 'Helvetica-Bold', color: PC.section }}>
              {dayNum(fecha)}
            </Text>
          </View>
        ))}
      </View>

      {/* Secciones con ítems */}
      {grupos.map((grupo) => (
        <View key={grupo.label}>
          {/* Banda de sección */}
          <View style={{
            backgroundColor: PC.section,
            paddingVertical: 2, paddingHorizontal: 4,
            flexDirection: 'row',
          }}>
            <Text style={{ fontSize: 7, fontFamily: 'Helvetica-Bold', color: PC.white, flex: 1 }}>
              {grupo.label}
            </Text>
          </View>

          {/* Filas de ítems */}
          {grupo.items.map((item, idx) => {
            const bg = idx % 2 === 0 ? PC.white : ROW_ALT
            return (
              <View key={item.id} style={{ flexDirection: 'row', backgroundColor: bg }}>
                <View style={{
                  width: itemColW,
                  borderWidth: 1, borderColor: PC.border,
                  paddingVertical: 2, paddingHorizontal: 4,
                  justifyContent: 'center',
                  backgroundColor: bg,
                }}>
                  <Text style={{ fontSize: 5.5, color: PC.fieldValue }}>{item.item}</Text>
                </View>
                {todosLosDias.map((fecha) => {
                  if (!inspeccionadosSet.has(fecha)) {
                    return (
                      <View key={fecha} style={{
                        width: dayColW,
                        borderWidth: 1, borderColor: PC.border,
                        backgroundColor: bg,
                      }} />
                    )
                  }
                  const val = matriz[fecha]?.[item.id] ?? defaultVal
                  return (
                    <View key={fecha} style={{
                      width: dayColW,
                      borderWidth: 1, borderColor: PC.border,
                      backgroundColor: bg,
                      alignItems: 'center', justifyContent: 'center',
                      paddingVertical: 2,
                    }}>
                      <Text style={{ fontSize: 6, fontFamily: 'Helvetica-Bold', color: valorColor(val) }}>
                        {val}
                      </Text>
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
