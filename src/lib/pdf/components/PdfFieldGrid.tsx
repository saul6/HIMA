import { View, Text } from '@react-pdf/renderer'
import type { ReactNode } from 'react'
import { PC } from './tokens'

// ── PdfFieldGrid ─────────────────────────────────────────────────────────────
// Wrapper exterior con borde completo. Envuelve filas de campos.

interface PdfFieldGridProps {
  children: ReactNode
}

export function PdfFieldGrid({ children }: PdfFieldGridProps) {
  return (
    <View
      style={{
        borderWidth: 1,
        borderColor: PC.border,
        marginBottom: 4,
      }}
    >
      {children}
    </View>
  )
}

// ── PdfFieldRow ──────────────────────────────────────────────────────────────
// Fila horizontal de celdas.

interface PdfFieldRowProps {
  children: ReactNode
}

export function PdfFieldRow({ children }: PdfFieldRowProps) {
  return (
    <View style={{ flexDirection: 'row' }}>
      {children}
    </View>
  )
}

// ── PdfField ─────────────────────────────────────────────────────────────────
// Celda individual con label superior y valor debajo.
// fullWidth: toma flex:2 en lugar de flex:1 para abarcar el ancho completo.

interface PdfFieldProps {
  label: string
  value: string
  fullWidth?: boolean
}

export function PdfField({ label, value, fullWidth = false }: PdfFieldProps) {
  return (
    <View
      style={{
        flex: fullWidth ? 2 : 1,
        borderRightWidth: 1,
        borderRightColor: PC.border,
        borderBottomWidth: 1,
        borderBottomColor: PC.border,
        padding: 6,
      }}
    >
      <Text
        style={{
          fontSize: 6.5,
          color: PC.fieldLabel,
          fontFamily: 'Helvetica-Bold',
          textTransform: 'uppercase',
          letterSpacing: 0.3,
          marginBottom: 2,
        }}
      >
        {label}
      </Text>
      <Text style={{ fontSize: 9, color: PC.fieldValue }}>
        {value}
      </Text>
    </View>
  )
}
