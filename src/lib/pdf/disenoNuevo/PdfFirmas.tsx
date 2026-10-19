// Firmas del diseño nuevo (antes PdfSignaturesM13), estilo minimalista. Misma lógica y mismos
// datos que PdfSignatures (compartido, no se toca): imagen si la firma es vigente,
// aviso si está desactualizada y línea en blanco si no hay firma.

import { View, Text, Image } from '@react-pdf/renderer'
import { PC } from '@/lib/pdf/components/tokens'
import type { FirmaParaPdf } from '@/hooks/useFirmasRegistro'
import { partirPalabraLarga } from '@/lib/pdf/components/texto'

interface SignatureItem {
  label: string
  nombre: string
  caption: string
  firma?: FirmaParaPdf | null
}

interface Props {
  signatures: SignatureItem[]
  enterado?: FirmaParaPdf['enterado']
  /** Líneas de firma de ancho fijo (más cortas) y firma más grande (M50). Apagado por defecto. */
  lineaCorta?: boolean
}

const sinGuion = (word: string) => [word]
const AVISO_DESACTUALIZADA = 'Firma digital desactualizada: el registro se modificó después de firmarse'

const linea = { borderTopWidth: 0.75, borderTopColor: PC.m13Navy, marginTop: 14, paddingTop: 4 } as const

export function PdfFirmas({ signatures: signaturesProp, enterado: enteradoProp, lineaCorta = false }: Props) {
  const alto = lineaCorta ? 44 : 38
  const ancho = lineaCorta ? { width: 200 } : { flex: 1 }
  const enterado = enteradoProp ?? signaturesProp.map((s) => s.firma?.enterado).find(Boolean) ?? null
  const enteradoDigital = enterado && enterado.estado === 'vigente' && enterado.png

  // Firma única (admin): un solo bloque "Realizó y verificó"
  const idxUnica = signaturesProp.findIndex((s) => s.firma?.unica)
  const signatures = idxUnica === -1
    ? signaturesProp
    : signaturesProp
        .filter((s, i) => i === idxUnica || !s.firma?.unica)
        .map((s, i) => (i === idxUnica ? { ...s, caption: 'Realizó y verifico - Firma' } : s))

  return (
    <View wrap={false} style={{ flexDirection: 'row', marginTop: 20 }}>
      {signatures.map((sig, i) => {
        const firma = sig.firma
        const tieneDigital = firma && firma.estado === 'vigente' && firma.png
        const desactualizada = firma && firma.estado === 'desactualizada'
        return (
          <View key={i} style={{ ...ancho, marginRight: i < signatures.length - 1 || enterado ? 16 : 0 }}>
            <View style={{ height: alto }}>
              {tieneDigital ? (
                <Image src={firma.png} style={{ height: alto, objectFit: 'contain' }} />
              ) : (
                <>
                  <Text style={{ fontSize: 7, color: PC.textSub }}>{sig.label}</Text>
                  <Text
                    style={{ fontSize: 9, fontFamily: 'Helvetica-Bold', color: PC.m13Navy, marginTop: 2 }}
                    hyphenationCallback={partirPalabraLarga}
                  >
                    {sig.nombre}
                  </Text>
                </>
              )}
            </View>
            <View style={linea}>
              <Text style={{ fontSize: 7, fontFamily: 'Helvetica-Bold', color: PC.m13Navy }}>{sig.caption}</Text>
              {tieneDigital && (
                <Text hyphenationCallback={sinGuion} style={{ fontSize: 6, color: PC.footerGray, marginTop: 2 }}>
                  {`Firmado digitalmente el ${firma.fecha}\nSello ${firma.sello}`}
                </Text>
              )}
              {desactualizada && (
                <Text style={{ fontSize: 7, color: PC.footerGray, marginTop: 2 }}>{AVISO_DESACTUALIZADA}</Text>
              )}
            </View>
          </View>
        )
      })}

      {enterado && (
        <View style={ancho}>
          <View style={{ height: alto }}>
            {enteradoDigital ? (
              <Image src={enterado.png} style={{ height: alto, objectFit: 'contain' }} />
            ) : (
              <Text style={{ fontSize: 7, color: PC.textSub }}>Enterado (Encargado)</Text>
            )}
          </View>
          <View style={linea}>
            <Text style={{ fontSize: 7, fontFamily: 'Helvetica-Bold', color: PC.m13Navy }}>Enterado (Encargado)</Text>
            {enteradoDigital ? (
              <>
                <Text style={{ fontSize: 9, fontFamily: 'Helvetica-Bold', color: PC.m13Navy, marginTop: 2 }}>
                  {enterado.firmante}
                </Text>
                <Text style={{ fontSize: 7, color: PC.textSub }}>{enterado.cargo}</Text>
                <Text style={{ fontSize: 6, color: PC.footerGray, marginTop: 2 }}>
                  {`Capturada por ${enterado.capturadoPor} - ${enterado.fecha}`}
                </Text>
              </>
            ) : (
              <Text style={{ fontSize: 7, color: PC.footerGray, marginTop: 2 }}>{AVISO_DESACTUALIZADA}</Text>
            )}
          </View>
        </View>
      )}
    </View>
  )
}
