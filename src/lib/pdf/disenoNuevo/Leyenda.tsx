// Leyenda de códigos al pie de tablas operativas (misma información que PdfLegend).
import { View, Text } from '@react-pdf/renderer'
import { PC } from '@/lib/pdf/components/tokens'

export interface EntradaLeyenda {
  titulo: string
  items: { codigo: string; label: string }[]
}

export function Leyenda({ entradas }: { entradas: EntradaLeyenda[] }) {
  return (
    <View wrap={false} style={{ marginTop: 6, marginBottom: 6, backgroundColor: PC.m13Fondo, borderRadius: 6, padding: 8 }}>
      <Text style={{ fontSize: 6, fontFamily: 'Helvetica-Bold', color: PC.m13Navy, marginBottom: 3 }}>LEYENDA</Text>
      <View style={{ flexDirection: 'row' }}>
        {entradas.map((ent, i) => (
          <View key={i} style={{ flex: 1, marginRight: i < entradas.length - 1 ? 12 : 0 }}>
            <Text style={{ fontSize: 5.5, fontFamily: 'Helvetica-Bold', color: PC.fieldValue, marginBottom: 1 }}>{ent.titulo}:</Text>
            <Text style={{ fontSize: 5.5, color: PC.textSub, lineHeight: 1.3 }}>
              {ent.items.map((it) => `${it.codigo}=${it.label}`).join('  ')}
            </Text>
          </View>
        ))}
      </View>
    </View>
  )
}
