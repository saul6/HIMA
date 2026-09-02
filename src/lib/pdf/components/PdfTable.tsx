import { View, Text } from '@react-pdf/renderer'
import type { ReactNode } from 'react'
import { PC } from './tokens'

// ── PdfTable ─────────────────────────────────────────────────────────────────

interface PdfTableColumn {
  label: string
  width: number
}

interface PdfTableProps {
  columns: PdfTableColumn[]
  children: ReactNode
}

export function PdfTable({ columns, children }: PdfTableProps) {
  return (
    <View
      style={{
        borderLeftWidth: 1,
        borderLeftColor: PC.border,
        borderTopWidth: 1,
        borderTopColor: PC.border,
      }}
    >
      {/* Header row */}
      <View style={{ flexDirection: 'row', backgroundColor: PC.section }}>
        {columns.map((col) => (
          <Text
            key={col.label}
            style={{
              width: col.width,
              color: PC.white,
              fontFamily: 'Helvetica-Bold',
              fontSize: 7,
              paddingTop: 4,
              paddingBottom: 4,
              paddingLeft: 3,
              paddingRight: 3,
              borderRightWidth: 1,
              borderRightColor: 'rgba(255,255,255,0.3)',
              borderBottomWidth: 1,
              borderBottomColor: 'rgba(255,255,255,0.3)',
              textAlign: 'center',
            }}
          >
            {col.label}
          </Text>
        ))}
      </View>

      {/* Data rows */}
      {children}
    </View>
  )
}

// ── PdfTableRow ──────────────────────────────────────────────────────────────

interface PdfTableRowProps {
  children: ReactNode
  alt?: boolean
}

export function PdfTableRow({ children, alt = false }: PdfTableRowProps) {
  return (
    <View
      style={{
        flexDirection: 'row',
        backgroundColor: alt ? '#F5F9FE' : PC.white,
      }}
    >
      {children}
    </View>
  )
}

// ── PdfTableCell ─────────────────────────────────────────────────────────────

interface PdfTableCellProps {
  children: ReactNode
  width: number
  align?: 'left' | 'center' | 'right'
}

export function PdfTableCell({ children, width, align = 'center' }: PdfTableCellProps) {
  return (
    <View
      style={{
        width,
        borderRightWidth: 1,
        borderRightColor: PC.border,
        borderBottomWidth: 1,
        borderBottomColor: PC.border,
        paddingTop: 3,
        paddingBottom: 3,
        paddingLeft: 3,
        paddingRight: 3,
        justifyContent: 'center',
      }}
    >
      <Text
        style={{
          fontSize: 8,
          color: PC.fieldValue,
          textAlign: align,
        }}
      >
        {children}
      </Text>
    </View>
  )
}
