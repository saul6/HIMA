// Texto libre largo (descripción, observaciones, "Otros", comentarios) a todo el ancho de la página.
// Regla del kit: un texto libre que viene en una celda angosta de tabla o en una caja de columnas se muestra
// como un bloque a lo ancho, justo debajo de su renglón, con su etiqueta. Se considera "largo" cuando pasa de
// UMBRAL_CARACTERES o de UMBRAL_RENGLONES renglones en su columna; un solo umbral para todos los PDF.
// El bloque se parte entre páginas (mínimo 3 renglones al final de la hoja y 3 al inicio de la siguiente) y la
// etiqueta viaja con el primer renglón. No se recorta nada. Las matrices mensuales no lo usan (formato oficial).
import { View, Text } from '@react-pdf/renderer'
import { PC } from '@/lib/pdf/components/tokens'
import { SIN_ENCOGER } from './estilos'
import { lineasTexto, partirParaAncho } from './medirTexto'

export const UMBRAL_CARACTERES = 150
export const UMBRAL_RENGLONES = 3

/** true si `texto` debe pasar a bloque a lo ancho: más de 150 caracteres o más de 3 renglones en su columna. */
export function esTextoLargo(texto: string | null | undefined, anchoColumna: number, fuente: number): boolean {
  if (!texto) return false
  if (texto.length > UMBRAL_CARACTERES) return true
  return lineasTexto(texto, anchoColumna, fuente).length > UMBRAL_RENGLONES
}

/** Resumen para la celda: los primeros 2 renglones con "…". */
export function resumenTexto(texto: string, anchoColumna: number, fuente: number): string {
  const l = lineasTexto(texto, anchoColumna, fuente)
  return l.length <= 2 ? texto : `${l.slice(0, 2).join(' ')}…`
}

interface Props {
  etiqueta: string
  texto: string
  /** Ancho disponible en pt (default: ancho útil de una hoja horizontal). */
  ancho?: number
  fuente?: number
  /** Con raya inferior fina (cuando va pegado debajo de una fila de tabla). */
  conLinea?: boolean
}

export function TextoLargo({ etiqueta, texto, ancho = 761.89, fuente = 8, conLinea = false }: Props) {
  return (
    <>
      <View minPresenceAhead={40} style={{ height: 0 }} />
      <View
        style={{
          paddingHorizontal: 4, paddingVertical: 4, marginBottom: 6, ...SIN_ENCOGER,
          ...(conLinea ? { borderBottomWidth: 0.5, borderBottomColor: PC.border } : {}),
        }}
      >
        <Text
          orphans={3}
          widows={3}
          style={{ fontSize: fuente, color: PC.fieldValue }}
          hyphenationCallback={partirParaAncho(ancho - 8, fuente)}
        >
          <Text style={{ fontFamily: 'Helvetica-Bold', color: PC.m13Navy }}>{etiqueta}: </Text>
          {texto}
        </Text>
      </View>
    </>
  )
}
