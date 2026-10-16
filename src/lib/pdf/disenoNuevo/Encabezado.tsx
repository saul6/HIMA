// Encabezados del diseño nuevo: página 1 (raya menta, título, logo, línea fina) y
// compacto para páginas 2+ (se usa dentro de un View `fixed` con `render`).
import { View, Text, Image } from '@react-pdf/renderer'
import type { ReactNode } from 'react'
import { LOGO_MADY_PDF } from '@/lib/pdf/assets/logoMadyPdf'
import { PC } from '@/lib/pdf/components/tokens'
import { partirPalabraLarga } from '@/lib/pdf/components/texto'

export function EncabezadoPrimeraPagina({ titulo, subtitulo }: { titulo: string; subtitulo?: ReactNode }) {
  return (
    <>
      <View style={{ flexDirection: 'row', alignItems: 'flex-start', justifyContent: 'space-between' }}>
        <View style={{ flex: 1, paddingRight: 12 }}>
          <View style={{ width: 28, height: 3, backgroundColor: PC.m13Menta, marginBottom: 8 }} />
          <Text style={{ fontFamily: 'Helvetica-Bold', fontSize: 20, color: PC.m13Navy }} hyphenationCallback={partirPalabraLarga}>{titulo}</Text>
          {subtitulo ? (
            <Text style={{ fontSize: 8, color: PC.textSub, marginTop: 4 }} hyphenationCallback={partirPalabraLarga}>
              {subtitulo}
            </Text>
          ) : null}
        </View>
        <Image src={LOGO_MADY_PDF} style={{ height: 36, width: 101 }} />
      </View>
      <View style={{ borderTopWidth: 0.75, borderTopColor: PC.border, marginTop: 10, marginBottom: 10 }} />
    </>
  )
}

// Sin Svg ni filas anidadas: dentro del `render` de un elemento fixed react-pdf no
// calcula bien el layout de Svg ni de filas con celdas anidadas. `columnas` (opcional)
// es la fila de encabezado de tabla que se repite en cada página.
export function EncabezadoCompacto({ titulo, folio, detalle, columnas }: { titulo: string; folio?: string; detalle?: string; columnas?: ReactNode }) {
  return (
    <View>
      <View style={{ flexDirection: 'row', justifyContent: 'space-between', paddingBottom: 6 }}>
        <View>
          <Text style={{ fontFamily: 'Helvetica-Bold', fontSize: 11, color: PC.m13Navy }}>{titulo}</Text>
          {folio ? <Text style={{ fontSize: 7, color: PC.textSub, marginTop: 1 }}>Folio: {folio}</Text> : null}
          {detalle ? <Text style={{ fontSize: 7, color: PC.textSub, marginTop: 1 }}>{detalle}</Text> : null}
        </View>
        <Image src={LOGO_MADY_PDF} style={{ height: 22, width: 61 }} />
      </View>
      <View style={{ borderTopWidth: 0.75, borderTopColor: PC.border, marginBottom: 8 }} />
      {columnas ? <View style={{ flexDirection: 'row', marginBottom: 6 }}>{columnas}</View> : null}
    </View>
  )
}

// Estilo de las celdas de encabezado de tabla en la versión compacta (sin Svg).
export const estiloColumnaCompacta = {
  fontFamily: 'Helvetica-Bold',
  fontSize: 8,
  color: PC.m13Navy,
  paddingTop: 6,
  paddingBottom: 5,
  borderBottomWidth: 1,
  borderBottomColor: PC.m13Navy,
} as const
