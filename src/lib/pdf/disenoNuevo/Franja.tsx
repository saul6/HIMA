// Franja de datos generales: fondo claro, esquinas redondeadas, N campos por renglón,
// divisores finos, etiqueta arriba y valor abajo. Icono solo en campos reconocibles;
// los demás conservan la misma sangría de la etiqueta.
import { View, Text } from '@react-pdf/renderer'
import { PC } from '@/lib/pdf/components/tokens'
import { partirPalabraLarga } from '@/lib/pdf/components/texto'
import { Icono, type IconoNombre } from './Icono'

export interface CampoFranja {
  etiqueta: string
  valor: string
  icono?: IconoNombre
  /** Color del valor (default navy); p. ej. PC.negativo para un total de no-conformidades. */
  colorValor?: string
}

const SANGRIA_ICONO = 14  // ancho del icono (10) + separación (4)

export function DatoFranja({ icono, etiqueta, valor, colorValor, primero }: CampoFranja & { primero?: boolean }) {
  return (
    <View
      style={{
        flex: 1,
        paddingLeft: primero ? 0 : 10,
        paddingRight: 6,
        borderLeftWidth: primero ? 0 : 0.75,
        borderLeftColor: PC.border,
      }}
    >
      {etiqueta ? (
        <View style={{ flexDirection: 'row', alignItems: 'center', marginBottom: 3 }}>
          {icono ? <Icono nombre={icono} size={10} /> : null}
          <Text style={{ fontSize: 7, color: PC.textSub, marginLeft: icono ? 4 : SANGRIA_ICONO }}>{etiqueta}</Text>
        </View>
      ) : null}
      <Text style={{ fontFamily: 'Helvetica-Bold', fontSize: 9, color: colorValor ?? PC.m13Navy }} hyphenationCallback={partirPalabraLarga}>
        {valor}
      </Text>
    </View>
  )
}

/** `porRenglon`: 4 en vertical; en horizontal puede ser 5–6 si caben sin apretar. */
export function FranjaDatos({ campos, porRenglon = 4, margenInferior = 16 }: { campos: CampoFranja[]; porRenglon?: number; margenInferior?: number }) {
  const filas: CampoFranja[][] = []
  for (let i = 0; i < campos.length; i += porRenglon) filas.push(campos.slice(i, i + porRenglon))
  const caja = { backgroundColor: PC.m13Fondo, borderRadius: 6, padding: 10, marginBottom: margenInferior } as const

  if (filas.length <= 1) {
    return (
      <View style={{ flexDirection: 'row', ...caja }}>
        {campos.map((c, i) => <DatoFranja key={i} primero={i === 0} {...c} />)}
      </View>
    )
  }
  return (
    <View style={caja}>
      {filas.map((fila, r) => (
        <View
          key={r}
          wrap={false}
          style={{
            flexDirection: 'row',
            marginTop: r === 0 ? 0 : 8,
            paddingTop: r === 0 ? 0 : 8,
            borderTopWidth: r === 0 ? 0 : 0.75,
            borderTopColor: PC.border,
          }}
        >
          {fila.map((c, i) => <DatoFranja key={i} primero={i === 0} {...c} />)}
          {/* relleno para que las columnas del último renglón queden alineadas */}
          {Array.from({ length: porRenglon - fila.length }, (_, k) => (
            <View key={`v${k}`} style={{ flex: 1, paddingLeft: 10, paddingRight: 6 }} />
          ))}
        </View>
      ))}
    </View>
  )
}
