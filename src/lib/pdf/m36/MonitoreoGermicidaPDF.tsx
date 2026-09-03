import { Document, Page, View, Text } from '@react-pdf/renderer'
import { TopBar, PdfFooter } from '@/lib/pdf/components/PdfPage'
import { PdfHeader } from '@/lib/pdf/components/PdfHeader'
import { PdfSectionBanner } from '@/lib/pdf/components/PdfSectionBanner'
import { PdfFieldGrid, PdfFieldRow, PdfField } from '@/lib/pdf/components/PdfFieldGrid'
import { PdfSignatures } from '@/lib/pdf/components/PdfSignatures'
import { codigoFormato } from '@/lib/codigoFormato'
import { PC } from '@/lib/pdf/components/tokens'

export interface MonitoreoRow {
  fecha: string
  tipo_germicida: string
  uso: string
  concentracion: number
  correccion: string | null
  preparado_por: string
}

interface Props {
  rancho: string
  orgNombre?: string | null
  desde: string
  hasta: string
  monitoreos: MonitoreoRow[]
  codigoClave: string
  terminoSitio?: string
}

const MARGIN = 20

const thStyle = {
  padding: 3,
  borderRightWidth: 1,
  borderRightColor: '#5599CC',
  borderBottomWidth: 1,
  borderBottomColor: '#5599CC',
  justifyContent: 'center',
  alignItems: 'center',
} as const

const tdStyle = {
  borderRightWidth: 1,
  borderRightColor: PC.border,
  borderBottomWidth: 1,
  borderBottomColor: PC.border,
  justifyContent: 'center',
  alignItems: 'center',
  padding: 1,
} as const

const ROW_ALT = '#F5F9FE'

function fmtFecha(iso: string): string {
  try {
    const [y, m, d] = iso.split('-')
    return `${d}/${m}/${y}`
  } catch { return iso }
}

const C = { FECHA: 55, TIPO: 105, USO: 105, PPM: 52, CORR: 100, PREP: 95 }

export function MonitoreoGermicidaPDF({ rancho, orgNombre, desde, hasta, monitoreos, codigoClave, terminoSitio = 'Instalación' }: Props) {
  const periodo = desde === hasta ? fmtFecha(desde) : `${fmtFecha(desde)} - ${fmtFecha(hasta)}`
  const codigoFmt = codigoFormato('F-FRUS-SAN-14', codigoClave)

  return (
    <Document>
      <Page
        size="A4"
        orientation="landscape"
        style={{ fontFamily: 'Helvetica', fontSize: 7, padding: MARGIN, paddingBottom: 50, backgroundColor: PC.white }}
      >
        <PdfFooter moduloCodigo="M36" />
        <TopBar />
        <PdfHeader
          titulo="MONITOREO DE SOLUCIÓN GERMICIDA"
          subtitulo={`Registro de germicida | ${rancho}`}
          codigoFormato={codigoFmt}
          folio={periodo}
          fecha={periodo}
        />

        <PdfSectionBanner>1. Datos del sitio</PdfSectionBanner>
        <PdfFieldGrid>
          <PdfFieldRow>
            <PdfField label={terminoSitio} value={rancho} />
            <PdfField label="Periodo" value={periodo} />
          </PdfFieldRow>
        </PdfFieldGrid>

        <PdfSectionBanner>2. Registros</PdfSectionBanner>

        <View style={{ marginTop: 4, borderWidth: 1, borderColor: PC.border }}>
          {/* Header */}
          <View style={{ flexDirection: 'row', backgroundColor: PC.section }}>
            <View style={[thStyle, { width: C.FECHA, backgroundColor: PC.section, alignItems: 'flex-start' }]}>
              <Text style={{ fontFamily: 'Helvetica-Bold', fontSize: 7, color: PC.white }}>Fecha</Text>
            </View>
            <View style={[thStyle, { width: C.TIPO, backgroundColor: PC.section, alignItems: 'flex-start' }]}>
              <Text style={{ fontFamily: 'Helvetica-Bold', fontSize: 7, color: PC.white }}>Tipo de germicida</Text>
            </View>
            <View style={[thStyle, { width: C.USO, backgroundColor: PC.section, alignItems: 'flex-start' }]}>
              <Text style={{ fontFamily: 'Helvetica-Bold', fontSize: 7, color: PC.white }}>Uso</Text>
            </View>
            <View style={[thStyle, { width: C.PPM, backgroundColor: PC.section }]}>
              <Text style={{ fontFamily: 'Helvetica-Bold', fontSize: 7, color: PC.white }}>Conc. ppm</Text>
            </View>
            <View style={[thStyle, { width: C.CORR, backgroundColor: PC.section, alignItems: 'flex-start' }]}>
              <Text style={{ fontFamily: 'Helvetica-Bold', fontSize: 7, color: PC.white }}>Corrección</Text>
            </View>
            <View style={[thStyle, { width: C.PREP, backgroundColor: PC.section, alignItems: 'flex-start', borderRightWidth: 0 }]}>
              <Text style={{ fontFamily: 'Helvetica-Bold', fontSize: 7, color: PC.white }}>Preparado por</Text>
            </View>
          </View>

          {/* Rows */}
          {monitoreos.map((m, i) => {
            const bg = i % 2 === 1 ? ROW_ALT : PC.white
            return (
              <View key={i} style={{ flexDirection: 'row', backgroundColor: bg }}>
                <View style={[tdStyle, { width: C.FECHA, alignItems: 'flex-start', padding: 4 }]}>
                  <Text style={{ fontSize: 7, color: PC.fieldValue }}>{fmtFecha(m.fecha)}</Text>
                </View>
                <View style={[tdStyle, { width: C.TIPO, alignItems: 'flex-start', padding: 4 }]}>
                  <Text style={{ fontSize: 7, color: PC.fieldValue }}>{m.tipo_germicida}</Text>
                </View>
                <View style={[tdStyle, { width: C.USO, alignItems: 'flex-start', padding: 4 }]}>
                  <Text style={{ fontSize: 7, color: PC.fieldValue }}>{m.uso}</Text>
                </View>
                <View style={[tdStyle, { width: C.PPM, padding: 4 }]}>
                  <Text style={{ fontSize: 7, color: PC.fieldValue }}>{m.concentracion} ppm</Text>
                </View>
                <View style={[tdStyle, { width: C.CORR, alignItems: 'flex-start', padding: 4 }]}>
                  <Text style={{ fontSize: 7, color: PC.fieldValue }}>{m.correccion ?? '—'}</Text>
                </View>
                <View style={[tdStyle, { width: C.PREP, alignItems: 'flex-start', padding: 4, borderRightWidth: 0 }]}>
                  <Text style={{ fontSize: 7, color: PC.fieldValue }}>{m.preparado_por}</Text>
                </View>
              </View>
            )
          })}
        </View>

        <PdfSignatures
          signatures={[{ label: '', nombre: '', caption: 'Verifico: Responsable del cooler' }]}
        />
      </Page>
    </Document>
  )
}
