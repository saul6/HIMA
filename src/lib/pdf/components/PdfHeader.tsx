import { View, Text } from '@react-pdf/renderer'
import { MadyLogoPDF } from '@/lib/pdf/MadyLogoPDF'
import { PC } from './tokens'

interface PdfHeaderProps {
  titulo: string
  subtitulo: string
  codigoFormato: string
  folio: string
  fecha: string
}

export function PdfHeader({ titulo, subtitulo, codigoFormato, folio, fecha }: PdfHeaderProps) {
  return (
    <>
      {/* Contenido del header */}
      <View
        style={{
          flexDirection: 'row',
          alignItems: 'center',
          padding: 14,
        }}
      >
        {/* Izq — Logo */}
        <View style={{ flex: 2 }}>
          <MadyLogoPDF style={{ fontSize: 12, fontFamily: 'Helvetica-Bold' }} />
          <Text style={{ fontSize: 7, color: PC.textSub, marginTop: 2 }}>
            INOCUIDAD INTELIGENTE
          </Text>
        </View>

        {/* Centro — título */}
        <View style={{ flex: 6, alignItems: 'center' }}>
          <Text
            style={{
              fontFamily: 'Helvetica-Bold',
              fontSize: 12,
              color: PC.titleNavy,
              textAlign: 'center',
            }}
          >
            {titulo}
          </Text>
          <Text
            style={{
              fontSize: 8,
              color: PC.textSub,
              marginTop: 2,
              textAlign: 'center',
            }}
          >
            {subtitulo}
          </Text>
        </View>

        {/* Dcha — caja de folio */}
        <View
          style={{
            flex: 2,
            alignItems: 'flex-end',
          }}
        >
          <View
            style={{
              borderRadius: 6,
              backgroundColor: PC.folioBox,
              padding: 8,
              alignItems: 'flex-end',
            }}
          >
            <Text style={{ fontSize: 9, fontFamily: 'Helvetica-Bold', color: PC.titleNavy }}>
              {codigoFormato}
            </Text>
            <Text style={{ fontSize: 8, color: PC.textSub, marginTop: 2 }}>
              Folio: {folio}
            </Text>
            <Text style={{ fontSize: 8, color: PC.textSub, marginTop: 1 }}>
              {fecha}
            </Text>
          </View>
        </View>
      </View>

      {/* Línea divisoria */}
      <View style={{ borderBottomWidth: 1, borderBottomColor: PC.border }} />
    </>
  )
}
