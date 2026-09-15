import { Text } from '@react-pdf/renderer'

const MA  = '#2B7AB5'
const DY  = '#0D5A8F'  // siempre variante clara — PDFs en papel blanco
const DOT = 'rgba(0,0,0,0.28)'

/**
 * Logo M.A.D.Y para react-pdf.
 * Sustituye <Text style={s.headerLogo}>M.A.D.Y</Text> en cualquier módulo PDF.
 * Hereda fontSize y fontFamily del estilo que se le pase.
 */
// eslint-disable-next-line @typescript-eslint/no-explicit-any
export function MadyLogoPDF({ style }: { style?: any }) {
  return (
    <Text style={style}>
      <Text style={{ color: MA }}>M</Text>
      <Text style={{ color: DOT }}>.</Text>
      <Text style={{ color: MA }}>A</Text>
      <Text style={{ color: DOT }}>.</Text>
      <Text style={{ color: DY }}>D</Text>
      <Text style={{ color: DOT }}>.</Text>
      <Text style={{ color: DY }}>Y</Text>
    </Text>
  )
}
