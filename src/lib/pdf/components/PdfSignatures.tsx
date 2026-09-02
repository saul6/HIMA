import { View, Text } from '@react-pdf/renderer'
import { PC } from './tokens'

interface SignatureItem {
  label: string
  nombre: string
  caption: string
}

interface PdfSignaturesProps {
  signatures: SignatureItem[]
}

export function PdfSignatures({ signatures }: PdfSignaturesProps) {
  return (
    <View style={{ flexDirection: 'row', marginTop: 24 }}>
      {signatures.map((sig, i) => (
        <View
          key={sig.label}
          style={{
            flex: 1,
            marginRight: i < signatures.length - 1 ? 16 : 0,
          }}
        >
          <Text style={{ fontSize: 7, color: PC.textSub }}>{sig.label}</Text>
          <Text
            style={{
              fontSize: 9,
              fontFamily: 'Helvetica-Bold',
              color: PC.fieldValue,
              marginTop: 2,
            }}
          >
            {sig.nombre}
          </Text>
          <View
            style={{
              borderTopWidth: 1,
              borderTopColor: PC.fieldValue,
              marginTop: 20,
              paddingTop: 4,
            }}
          >
            <Text style={{ fontSize: 7, color: PC.textSub }}>{sig.caption}</Text>
          </View>
        </View>
      ))}
    </View>
  )
}
