import { Document, Page, View, Text } from '@react-pdf/renderer'
import { TopBar, PdfFooter } from '@/lib/pdf/components/PdfPage'
import { PdfHeader } from '@/lib/pdf/components/PdfHeader'
import { PdfSectionBanner } from '@/lib/pdf/components/PdfSectionBanner'
import { PdfSignatures } from '@/lib/pdf/components/PdfSignatures'
import { codigoFormato } from '@/lib/codigoFormato'
import { PC } from '@/lib/pdf/components/tokens'

export interface M40LineaPDF {
  orden: number
  cuarto_prefrio: string | null
  fruta: string | null
  presentacion: string | null
  num_tarimas: number | null
  restos: string | null
  entrada_hora: string | null
  entrada_temp: number | null
  salida_hora: string | null
  salida_temp: number | null
  tiempo_total: string | null
}

export interface M40RegistroDataPDF {
  orgNombre: string
  instalacion: string
  fecha: string
  empresa: string | null
  observaciones: string | null
  lineas: M40LineaPDF[]
}

function fmtFecha(iso: string): string {
  try {
    const [y, m, d] = iso.split('-')
    return `${d}/${m}/${y}`
  } catch { return iso }
}

const t = (v: string | null | undefined): string => v ?? '—'
const n = (v: number | null | undefined): string => v != null ? String(v) : '—'

const MARGIN = 20

const thStyle = {
  padding: 3,
  borderRightWidth: 1,
  borderRightColor: '#5599CC',
  borderBottomWidth: 1,
  borderBottomColor: '#5599CC',
  justifyContent: 'center' as const,
  alignItems: 'center' as const,
  fontFamily: 'Helvetica-Bold',
  fontSize: 6.5,
  backgroundColor: PC.section,
  color: PC.white,
  textAlign: 'center' as const,
} as const

const tdStyle = {
  borderRightWidth: 1,
  borderRightColor: PC.border,
  borderBottomWidth: 1,
  borderBottomColor: PC.border,
  padding: 3,
  fontSize: 7,
  color: PC.fieldValue,
} as const

const ROW_ALT = '#F5F9FE'

const W = { cuarto: 60, fruta: 60, pres: 55, tar: 28, restos: 40, hora: 30, temp: 28, tiempo: 34 }

export function EntradasSalidasPreFrioPDF({ d, codigoClave }: { d: M40RegistroDataPDF; codigoClave: string }) {
  const codigoFmt = codigoFormato('F-FRUS-PRO-04', codigoClave)

  return (
    <Document>
      <Page
        size="A4"
        orientation="landscape"
        style={{
          fontFamily: 'Helvetica',
          fontSize: 7.5,
          padding: MARGIN,
          paddingBottom: 50,
          backgroundColor: PC.white,
        }}
      >
        <PdfFooter moduloCodigo="M40" />
        <TopBar />
        <PdfHeader
          titulo="ENTRADAS Y SALIDAS EN PRE-ENFRIAMIENTO"
          subtitulo={`${d.instalacion}${d.empresa ? ` | ${d.empresa}` : ''} | ${fmtFecha(d.fecha)}`}
          codigoFormato={codigoFmt}
          fecha={d.fecha}
        />

        {/* Tabla de lineas */}
        <PdfSectionBanner>Entradas y salidas de producto</PdfSectionBanner>
        <View style={{ borderTopWidth: 1, borderTopColor: PC.section, borderLeftWidth: 1, borderLeftColor: PC.section, marginBottom: 10 }}>
          {/* Header */}
          <View style={{ flexDirection: 'row' }}>
            <Text style={[thStyle, { width: 22 }]}>No.</Text>
            <Text style={[thStyle, { width: W.cuarto }]}>Cuarto Pre-frio</Text>
            <Text style={[thStyle, { width: W.fruta }]}>Fruta</Text>
            <Text style={[thStyle, { width: W.pres }]}>Presentacion</Text>
            <Text style={[thStyle, { width: W.tar }]}>Tarimas</Text>
            <Text style={[thStyle, { width: W.restos }]}>Restos</Text>
            <Text style={[thStyle, { width: W.hora }]}>E. Hora</Text>
            <Text style={[thStyle, { width: W.temp }]}>E. Temp</Text>
            <Text style={[thStyle, { width: W.hora }]}>S. Hora</Text>
            <Text style={[thStyle, { width: W.temp }]}>S. Temp</Text>
            <Text style={[thStyle, { width: W.tiempo, borderRightWidth: 0 }]}>Tiempo</Text>
          </View>
          {d.lineas.map((l, i) => (
            <View key={i} style={{ flexDirection: 'row', backgroundColor: i % 2 === 1 ? ROW_ALT : PC.white }}>
              <Text style={[tdStyle, { width: 22 }]}>{l.orden}</Text>
              <Text style={[tdStyle, { width: W.cuarto }]}>{t(l.cuarto_prefrio)}</Text>
              <Text style={[tdStyle, { width: W.fruta }]}>{t(l.fruta)}</Text>
              <Text style={[tdStyle, { width: W.pres }]}>{t(l.presentacion)}</Text>
              <Text style={[tdStyle, { width: W.tar }]}>{n(l.num_tarimas)}</Text>
              <Text style={[tdStyle, { width: W.restos }]}>{t(l.restos)}</Text>
              <Text style={[tdStyle, { width: W.hora }]}>{t(l.entrada_hora)}</Text>
              <Text style={[tdStyle, { width: W.temp }]}>{n(l.entrada_temp)}</Text>
              <Text style={[tdStyle, { width: W.hora }]}>{t(l.salida_hora)}</Text>
              <Text style={[tdStyle, { width: W.temp }]}>{n(l.salida_temp)}</Text>
              <Text style={[tdStyle, { width: W.tiempo, borderRightWidth: 0 }]}>{t(l.tiempo_total)}</Text>
            </View>
          ))}
        </View>

        {/* Observaciones */}
        {d.observaciones ? (
          <View style={{ marginBottom: 10 }}>
            <Text style={{ fontSize: 7, fontFamily: 'Helvetica-Bold', color: PC.titleNavy, marginBottom: 2 }}>
              Observaciones
            </Text>
            <Text style={{ fontSize: 7.5, color: PC.fieldValue }}>{d.observaciones}</Text>
          </View>
        ) : null}

        {/* Firmas */}
        <PdfSignatures
          signatures={[
            { label: 'Responsable de la instalacion' },
            { label: 'Responsable de la empresa' },
          ]}
        />

      </Page>
    </Document>
  )
}
