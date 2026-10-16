// Título de sección: barra menta + bold navy.
import { View, Text } from '@react-pdf/renderer'
import { PC } from '@/lib/pdf/components/tokens'

export function TituloSeccion({ texto }: { texto: string }) {
  return (
    <View style={{ flexDirection: 'row', alignItems: 'center', marginBottom: 8 }}>
      <View style={{ width: 3, height: 14, backgroundColor: PC.m13Menta, marginRight: 7 }} />
      <Text style={{ fontFamily: 'Helvetica-Bold', fontSize: 10, color: PC.m13Navy }}>{texto}</Text>
    </View>
  )
}
