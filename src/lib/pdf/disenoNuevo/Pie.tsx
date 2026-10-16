// Pie de todas las páginas: izquierda el código del formato (el que ya imprime cada
// PDF, p. ej. codigoFormato(clave, codigoClave)), centro el lema oficial, derecha la paginación.
import { View, Text } from '@react-pdf/renderer'
import { PC } from '@/lib/pdf/components/tokens'

export function Pie({ codigo }: { codigo: string }) {
  return (
    <View
      fixed
      style={{
        position: 'absolute',
        bottom: 18,
        left: 40,
        right: 40,
        borderTopWidth: 0.75,
        borderTopColor: PC.border,
        paddingTop: 5,
        flexDirection: 'row',
        alignItems: 'center',
      }}
    >
      <Text style={{ flex: 1, fontSize: 7, color: PC.footerGray }}>{codigo}</Text>
      <View style={{ flexDirection: 'row', alignItems: 'center' }}>
        <Text style={{ fontSize: 7, fontFamily: 'Helvetica-Bold', color: PC.m13Navy }}>M.A.D.Y.</Text>
        <View style={{ width: 0.75, height: 8, backgroundColor: PC.border, marginLeft: 6, marginRight: 6 }} />
        <Text style={{ fontSize: 7, color: PC.textSub }}>Inocuidad Inteligente</Text>
      </View>
      <Text
        style={{ flex: 1, fontSize: 7, color: PC.footerGray, textAlign: 'right' }}
        render={({ pageNumber, totalPages }) => `Página ${pageNumber} de ${totalPages}`}
      />
    </View>
  )
}
