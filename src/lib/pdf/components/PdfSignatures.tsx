import { View, Text, Image } from '@react-pdf/renderer'
import { PC } from './tokens'
import type { FirmaParaPdf } from '@/hooks/useFirmasRegistro'
import { partirPalabraLarga } from '@/lib/pdf/components/texto'

interface SignatureItem {
  label: string
  nombre: string
  caption: string
  firma?: FirmaParaPdf | null
}

interface PdfSignaturesProps {
  signatures: SignatureItem[]
  /** Firma de enterado (Encargado). Si se omite, se toma de la que viaja dentro de Realizó/Verificó. */
  enterado?: FirmaParaPdf['enterado']
  /** Líneas de firma de ancho fijo (más cortas) y firma más grande. */
  lineaCorta?: boolean
}

// Evita que react-pdf parta "Sello 9ce1..." con guion al final de línea
const sinGuion = (word: string) => [word]

export function PdfSignatures({ signatures: signaturesProp, enterado: enteradoProp, lineaCorta = false }: PdfSignaturesProps) {
  const enterado = enteradoProp ?? signaturesProp.map((s) => s.firma?.enterado).find(Boolean) ?? null
  const enteradoDigital = enterado && enterado.estado === 'vigente' && enterado.png

  // Firma única (admin): un solo bloque "Realizó y verificó"; el de Verificó no se dibuja
  const idxUnica = signaturesProp.findIndex((s) => s.firma?.unica)
  const signatures = idxUnica === -1
    ? signaturesProp
    : signaturesProp
        .filter((s, i) => i === idxUnica || !s.firma?.unica)
        .map((s, i) => (i === idxUnica ? { ...s, caption: 'Realizo y verifico - Firma' } : s))

  return (
    <View wrap={false} style={{ flexDirection: 'row', marginTop: 24 }}>
      {signatures.map((sig, i) => {
        const firma = sig.firma
        const tieneDigital = firma && firma.estado === 'vigente' && firma.png
        const desactualizada = firma && firma.estado === 'desactualizada'

        return (
          <View
            key={i}
            style={{
              ...(lineaCorta ? { width: 200 } : { flex: 1 }),
              marginRight: i < signatures.length - 1 || enterado ? 16 : 0,
            }}
          >
            {/* Contenedor de altura fija para que la línea de firma quede siempre alineada */}
            <View style={{ height: lineaCorta ? 44 : 32 }}>
              {tieneDigital ? (
                /* Imagen de firma digital */
                <Image
                  src={firma.png}
                  style={{ height: lineaCorta ? 44 : 32, objectFit: 'contain', marginBottom: 2 }}
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
                   hyphenationCallback={partirPalabraLarga}>
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
                <Text
                  hyphenationCallback={sinGuion}
                  style={{ fontSize: 6, color: PC.footerGray, marginTop: 2 }}
                >
                  {`Firmado digitalmente el ${firma.fecha}\nSello ${firma.sello}`}
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

      {enterado && (
        <View style={{ flex: 1 }}>
          <View style={{ height: 32 }}>
            {enteradoDigital ? (
              <Image src={enterado.png} style={{ height: 32, objectFit: 'contain', marginBottom: 2 }} />
            ) : (
              <Text style={{ fontSize: 7, color: PC.textSub }}>Enterado (Encargado)</Text>
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
            <Text style={{ fontSize: 7, color: PC.textSub }}>Enterado (Encargado)</Text>
            {enteradoDigital ? (
              <>
                <Text style={{ fontSize: 9, fontFamily: 'Helvetica-Bold', color: PC.fieldValue, marginTop: 2 }}>
                  {enterado.firmante}
                </Text>
                <Text style={{ fontSize: 7, color: PC.textSub }}>{enterado.cargo}</Text>
                <Text style={{ fontSize: 6, color: PC.footerGray, marginTop: 2 }}>
                  {`Capturada por ${enterado.capturadoPor} - ${enterado.fecha}`}
                </Text>
              </>
            ) : (
              <Text style={{ fontSize: 7, color: PC.footerGray, marginTop: 2 }}>
                Firma digital desactualizada: el registro se modifico despues de firmarse
              </Text>
            )}
          </View>
        </View>
      )}
    </View>
  )
}
