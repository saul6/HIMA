// Respuesta Si / No con su texto de apoyo al lado (p. ej. "Requirió incapacidad: Si — motivo").
// "No" sale en rojo suave solo si `fallaSiNo` (la pregunta donde "No" es un fallo); solo cambia el color.
import { View, Text } from '@react-pdf/renderer'
import { PC } from '@/lib/pdf/components/tokens'
import { SIN_ENCOGER } from './estilos'
import { partirPalabraLarga } from '@/lib/pdf/components/texto'

export function SiNoTexto({ valor, texto, fallaSiNo }: { valor: boolean; texto?: string; fallaSiNo?: boolean }) {
  return (
    <View wrap={false} style={{ flexDirection: 'row', alignItems: 'flex-start', backgroundColor: PC.m13Fondo, borderRadius: 6, padding: 8, marginBottom: 8, minHeight: 28, ...SIN_ENCOGER }}>
      <Text style={{ width: 28, fontSize: 9, fontFamily: 'Helvetica-Bold', color: valor || !fallaSiNo ? PC.m13Navy : PC.negativo }}>
        {valor ? 'Si' : 'No'}
      </Text>
      <Text style={{ flex: 1, fontSize: 9, color: PC.fieldValue, lineHeight: 1.4 }} hyphenationCallback={partirPalabraLarga}>
        {texto ?? ''}
      </Text>
    </View>
  )
}
