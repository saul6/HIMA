import { View, Text, Image } from '@react-pdf/renderer'
import { PC } from './tokens'
import { LOGO_MADY_PDF } from '@/lib/pdf/assets/logoMadyPdf'

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
        {/* Izq — Logotipo oficial (imagen, incluye marca + wordmark + eslogan) */}
        <View style={{ flex: 2 }}>
          <Image
            src={LOGO_MADY_PDF}
            style={{ height: 44, width: 123 }}
          />
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
