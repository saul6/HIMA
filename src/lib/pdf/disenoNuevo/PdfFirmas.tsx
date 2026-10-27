// Firmas del diseño nuevo (antes PdfSignaturesM13), estilo minimalista. Misma lógica y mismos
// datos que PdfSignatures (compartido, no se toca): imagen si la firma es vigente,
// aviso si está desactualizada y línea en blanco si no hay firma.

import { View, Text, Image } from '@react-pdf/renderer'
import { PC } from '@/lib/pdf/components/tokens'
import { SIN_ENCOGER } from './estilos'
import type { FirmaParaPdf } from '@/hooks/useFirmasRegistro'
import { alturaTexto, partirParaAncho, ALTO_UTIL_PAGINA } from './medirTexto'

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
  /** Imprime "Pendiente de firma" bajo la línea cuando no hay firma digital. Apagado por defecto (CLAUDE.md §9: la línea queda en blanco para firma a mano); hoy lo usa solo M39. */
  pendienteSiFalta?: boolean
}

const sinGuion = (word: string) => [word]
/** Ancho aproximado del nombre de cada firma: hasta tres bloques en una hoja vertical (el caso más angosto). */
const ANCHO_NOMBRE = 140
const partirNombre = partirParaAncho(ANCHO_NOMBRE, 9, true)
const AVISO_DESACTUALIZADA = 'Firma digital desactualizada: el registro se modificó después de firmarse'

const linea = { borderTopWidth: 0.75, borderTopColor: PC.m13Navy, marginTop: 14, paddingTop: 4 } as const

export function PdfFirmas({ signatures: signaturesProp, enterado: enteradoProp, lineaCorta = false, pendienteSiFalta = false }: Props) {
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
        .map((s, i) => (i === idxUnica ? { ...s, caption: 'Realizó y verificó - Firma' } : s))

  // Un nombre larguísimo (hasta 2000 letras en algunos campos) agranda el bloque; si no cabe en media hoja se deja partir.
  const altoNombres = Math.max(0, ...signatures.map((sig) => (sig.firma && sig.firma.estado === 'vigente' && sig.firma.png ? 0 : alturaTexto(sig.nombre ?? '', ANCHO_NOMBRE, 9, true))))
  const partible = altoNombres + 80 > ALTO_UTIL_PAGINA.landscape * 0.5

  return (
    <View {...(partible ? {} : { wrap: false })} style={{ flexDirection: 'row', marginTop: 20, ...SIN_ENCOGER }}>
      {signatures.map((sig, i) => {
        const firma = sig.firma
        const tieneDigital = firma && firma.estado === 'vigente' && firma.png
        const desactualizada = firma && firma.estado === 'desactualizada'
        return (
          <View key={i} style={{ ...ancho, marginRight: i < signatures.length - 1 || enterado ? 16 : 0 }}>
            <View style={{ minHeight: alto }}>
              {tieneDigital ? (
                <Image src={firma.png} style={{ height: alto, objectFit: 'contain' }} />
              ) : (
                <>
                  <Text style={{ fontSize: 7, color: PC.textSub }}>{sig.label}</Text>
                  <Text
                    style={{ fontSize: 9, fontFamily: 'Helvetica-Bold', color: PC.m13Navy, marginTop: 2 }}
                    hyphenationCallback={partirNombre}
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
              {pendienteSiFalta && !tieneDigital && !desactualizada && (
                <Text style={{ fontSize: 7, color: PC.footerGray, marginTop: 2 }}>Pendiente de firma</Text>
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
                <Text style={{ fontSize: 9, fontFamily: 'Helvetica-Bold', color: PC.m13Navy, marginTop: 2 }} hyphenationCallback={partirNombre}>
                  {enterado.firmante}
                </Text>
                <Text style={{ fontSize: 7, color: PC.textSub }} hyphenationCallback={partirParaAncho(ANCHO_NOMBRE, 7)}>{enterado.cargo}</Text>
                <Text style={{ fontSize: 6, color: PC.footerGray, marginTop: 2 }} hyphenationCallback={partirParaAncho(ANCHO_NOMBRE, 6)}>
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
