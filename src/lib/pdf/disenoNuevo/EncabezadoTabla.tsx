// Fila de encabezado de tabla: bold navy y línea inferior navy.
import { View, Text } from '@react-pdf/renderer'
import { PC } from '@/lib/pdf/components/tokens'
import { Icono, type IconoNombre } from './Icono'

export const PAD_CELDA = 8

export interface ColumnaTabla {
  texto: string
  icono?: IconoNombre
  ancho?: number   // sin ancho = ocupa el resto
}

function CeldaEncabezado({ ancho, icono, texto }: ColumnaTabla) {
  return (
    <View
      style={{
        width: ancho,
        flexGrow: ancho ? 0 : 1,
        flexDirection: 'row',
        alignItems: 'center',
        height: 22,
        paddingLeft: ancho ? PAD_CELDA : 12,
        borderBottomWidth: 1,
        borderBottomColor: PC.m13Navy,
      }}
    >
      {icono ? <Icono nombre={icono} /> : null}
      <Text style={{ fontFamily: 'Helvetica-Bold', fontSize: 8, color: PC.m13Navy, marginLeft: icono ? 5 : 0 }}>{texto}</Text>
    </View>
  )
}

export function EncabezadoTabla({ columnas }: { columnas: ColumnaTabla[] }) {
  return (
    <View style={{ flexDirection: 'row', height: 22, marginBottom: 6 }}>
      {columnas.map((c, i) => <CeldaEncabezado key={i} {...c} />)}
    </View>
  )
}
