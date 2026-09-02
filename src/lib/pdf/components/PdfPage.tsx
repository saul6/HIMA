import { View, Text, Svg, Rect, Defs, LinearGradient, Stop } from '@react-pdf/renderer'
import type { ReactNode } from 'react'
import { PC } from './tokens'

// ── TopBar SVG gradient ──────────────────────────────────────────────────────

function TopBar() {
  return (
    <Svg style={{ width: '100%' }} viewBox="0 0 800 8" height={8}>
      <Defs>
        <LinearGradient id="topGrad" x1="0" y1="0" x2="800" y2="0" gradientUnits="userSpaceOnUse">
          <Stop offset="0" stopColor={PC.navyBar1} />
          <Stop offset="1" stopColor={PC.navyBar2} />
        </LinearGradient>
      </Defs>
      <Rect x="0" y="0" width="800" height="8" fill="url(#topGrad)" />
    </Svg>
  )
}

// ── PdfPageFrame ─────────────────────────────────────────────────────────────
// Marco exterior con borde redondeado + barra superior de gradiente.
// No incluye padding propio — el header y el contenido lo manejan internamente.

interface PdfPageFrameProps {
  children: ReactNode
}

export function PdfPageFrame({ children }: PdfPageFrameProps) {
  return (
    <View
      style={{
        borderWidth: 1,
        borderColor: PC.border,
        borderRadius: 12,
        overflow: 'hidden',
        flex: 1,
      }}
    >
      <TopBar />
      {children}
    </View>
  )
}

// ── PdfFooter ────────────────────────────────────────────────────────────────
// Footer fijo en la parte inferior de cada página.
// Colocar dentro de <Page> ANTES del frame para que quede encima (z-order PDF).

interface PdfFooterProps {
  moduloCodigo: string
}

export function PdfFooter({ moduloCodigo }: PdfFooterProps) {
  return (
    <View
      fixed
      style={{
        position: 'absolute',
        bottom: 18,
        left: 24,
        right: 24,
        borderTopWidth: 1,
        borderTopColor: PC.border,
        paddingTop: 4,
        flexDirection: 'row',
        justifyContent: 'space-between',
        alignItems: 'center',
      }}
    >
      <Text style={{ fontSize: 7, color: PC.footerGray }}>{moduloCodigo}</Text>
      <Text style={{ fontSize: 7, color: PC.footerGray }}>
        M.A.D.Y. | Gestión inteligente para la inocuidad
      </Text>
      <Text
        style={{ fontSize: 7, color: PC.footerGray }}
        render={({ pageNumber, totalPages }) => `Página ${pageNumber} de ${totalPages}`}
      />
    </View>
  )
}
