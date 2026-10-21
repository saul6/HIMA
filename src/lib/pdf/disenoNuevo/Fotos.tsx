// Evidencia fotográfica del diseño nuevo: una columna, todas del mismo ancho, completas
// (objectFit contain, nunca recortadas) y con borde fino. Cada foto va en su propio bloque
// que no se parte: si no cabe en lo que queda de la página, pasa entera a la siguiente.
// Una foto muy alta se reduce (sin deformarla) hasta caber en la página.
import { View, Text, Image } from '@react-pdf/renderer'
import { PC } from '@/lib/pdf/components/tokens'
import { SIN_ENCOGER } from './estilos'
import { partirParaAncho } from './medirTexto'
import { dimensionesDeDataUri } from './dimensionesImagen'

const RATIO_PLACEHOLDER = 0.68   // foto que falló: caja 4:3 apaisada
const RATIO_SIN_DIMENSIONES = 0.75

export function Fotos({
  uris, pies, ancho = 220, altoMax = 250,
}: {
  uris: string[]
  /** Pie de cada foto (título y leyenda). Sin pies, cada foto lleva "Foto n de N". */
  pies?: { titulo?: string; leyenda?: string | null }[]
  /** Ancho de todas las fotos, en pt. */
  ancho?: number
  /** Alto máximo de una foto; una foto más alta se reduce proporcionalmente. */
  altoMax?: number
}) {
  return (
    <View>
      {uris.map((uri, i) => {
        const d = uri ? dimensionesDeDataUri(uri) : null
        const ratio = !uri ? RATIO_PLACEHOLDER : d ? d.h / d.w : RATIO_SIN_DIMENSIONES
        const alto = Math.min(ancho * ratio, altoMax)
        return (
          <View key={i} wrap={false} style={{ marginBottom: 8, ...SIN_ENCOGER }}>
            {pies ? null : <Text style={{ fontSize: 7, color: PC.textSub, marginBottom: 2 }}>Foto {i + 1} de {uris.length}</Text>}
            {uri ? (
              <Image
                src={uri}
                style={{ width: ancho, height: alto, objectFit: 'contain', borderRadius: 4, borderWidth: 0.5, borderColor: PC.border }}
              />
            ) : (
              <View style={{ width: ancho, height: alto, backgroundColor: PC.m13Fondo, borderRadius: 4, borderWidth: 0.5, borderColor: PC.border }} />
            )}
            {pies?.[i]?.titulo ? (
              <Text style={{ fontSize: 7, fontFamily: 'Helvetica-Bold', marginTop: 3, color: PC.textSub, width: ancho, textAlign: 'center' }} hyphenationCallback={partirParaAncho(ancho, 7, true)}>
                {pies[i].titulo}
              </Text>
            ) : null}
            {pies?.[i]?.leyenda ? (
              <Text style={{ fontSize: 7, color: PC.fieldValue, marginTop: 2, width: ancho, textAlign: 'center' }} hyphenationCallback={partirParaAncho(ancho, 7)}>
                {pies[i].leyenda}
              </Text>
            ) : null}
          </View>
        )
      })}
    </View>
  )
}
