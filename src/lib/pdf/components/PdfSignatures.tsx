import { View, Text, Image } from '@react-pdf/renderer'
import { PC } from './tokens'
import type { FirmaParaPdf } from '@/hooks/useFirmasRegistro'

interface SignatureItem {
  label: string
  nombre: string
  caption: string
  firma?: FirmaParaPdf | null
}

interface PdfSignaturesProps {
  signatures: SignatureItem[]
}

export function PdfSignatures({ signatures }: PdfSignaturesProps) {
  return (
    <View style={{ flexDirection: 'row', marginTop: 24 }}>
      {signatures.map((sig, i) => {
        const firma = sig.firma
        const tieneDigital = firma && firma.estado === 'vigente' && firma.png
        const desactualizada = firma && firma.estado === 'desactualizada'

        return (
          <View
            key={i}
            style={{
              flex: 1,
              marginRight: i < signatures.length - 1 ? 16 : 0,
            }}
          >
            {/* Contenedor de altura fija para que la línea de firma quede siempre alineada */}
            <View style={{ height: 32 }}>
              {tieneDigital ? (
                /* Imagen de firma digital */
                <Image
                  src={firma.png}
                  style={{ height: 32, objectFit: 'contain', marginBottom: 2 }}
                />
              ) : (
                /* Sin firma digital: mostrar label y nombre como antes */
                <>
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
                </>
              )}
            </View>

            <View
              style={{
                borderTopWidth: 1,
                borderTopColor: PC.fieldValue,
                marginTop: 20,
                paddingTop: 4,
              }}
            >
              <Text style={{ fontSize: 7, color: PC.textSub }}>{sig.caption}</Text>

              {tieneDigital && (
                /* Datos de firma digital debajo del caption */
                <Text style={{ fontSize: 6, color: PC.footerGray, marginTop: 2 }}>
                  {`Firmado digitalmente el ${firma.fecha} - Sello ${firma.sello}`}
                </Text>
              )}

              {desactualizada && (
                /* Aviso de firma desactualizada */
                <Text style={{ fontSize: 7, color: PC.footerGray, marginTop: 2 }}>
                  Firma digital desactualizada: el registro se modifico despues de firmarse
                </Text>
              )}
            </View>
          </View>
        )
      })}
    </View>
  )
}
