// Bloque de leyenda de códigos al pie de tablas operativas (M21, etc.)

import { View, Text } from '@react-pdf/renderer'
import { PC } from './tokens'

export interface LeyendaEntrada {
  titulo: string
  items: { codigo: string; label: string }[]
}

interface PdfLegendProps {
  entradas: LeyendaEntrada[]
}

export function PdfLegend({ entradas }: PdfLegendProps) {
  return (
    <View style={{
      marginTop: 6,
      backgroundColor: '#F5F9FE',
      borderTopWidth: 1, borderTopColor: PC.border,
      borderBottomWidth: 1, borderBottomColor: PC.border,
      paddingTop: 4, paddingBottom: 5, paddingLeft: 6, paddingRight: 6,
    }}>
      <Text style={{ fontSize: 6, fontFamily: 'Helvetica-Bold', color: PC.textSub, marginBottom: 3 }}>
        LEYENDA
      </Text>
      <View style={{ flexDirection: 'row', gap: 12 }}>
        {entradas.map((ent, i) => (
          <View key={i} style={{ flex: 1 }}>
            <Text style={{ fontSize: 5.5, fontFamily: 'Helvetica-Bold', color: PC.fieldValue, marginBottom: 1 }}>
              {ent.titulo}:
            </Text>
            <Text style={{ fontSize: 5.5, color: PC.textSub, lineHeight: 1.3 }}>
              {ent.items.map(it => `${it.codigo}=${it.label}`).join('  ')}
            </Text>
          </View>
        ))}
      </View>
    </View>
  )
}
