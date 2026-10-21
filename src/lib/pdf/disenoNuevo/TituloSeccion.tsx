// Título de sección: barra menta + bold navy.
import { View, Text } from '@react-pdf/renderer'
import { PC } from '@/lib/pdf/components/tokens'
import { partirParaAncho } from './medirTexto'

// Ancho útil de la hoja vertical menos la barra (el caso más angosto): las palabras largas se parten a este ancho.
const partirTitulo = partirParaAncho(595.28 - 80 - 12, 10, true)

export function TituloSeccion({ texto }: { texto: string }) {
  return (
    <View style={{ flexDirection: 'row', alignItems: 'center', marginBottom: 8 }}>
      <View style={{ width: 3, height: 14, backgroundColor: PC.m13Menta, marginRight: 7 }} />
      <Text style={{ flex: 1, fontFamily: 'Helvetica-Bold', fontSize: 10, color: PC.m13Navy }} hyphenationCallback={partirTitulo}>{texto}</Text>
    </View>
  )
}
