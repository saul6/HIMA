import { View, Text } from '@react-pdf/renderer'
import type { ReactNode } from 'react'
import { PC } from './tokens'

interface PdfSectionBannerProps {
  children: ReactNode
}

export function PdfSectionBanner({ children }: PdfSectionBannerProps) {
  return (
    <View
      style={{
        backgroundColor: PC.section,
        borderRadius: 4,
        marginTop: 14,
        marginBottom: 0,
        paddingTop: 6,
        paddingBottom: 6,
        paddingLeft: 10,
        paddingRight: 10,
      }}
    >
      <Text
        style={{
          color: PC.white,
          fontFamily: 'Helvetica-Bold',
          fontSize: 8,
          textTransform: 'uppercase',
        }}
      >
        {children}
      </Text>
    </View>
  )
}
