import { Document, Page, View, Text } from '@react-pdf/renderer'
import { TopBar, PdfFooter } from '@/lib/pdf/components/PdfPage'
import { PdfHeader } from '@/lib/pdf/components/PdfHeader'
import { PdfSectionBanner } from '@/lib/pdf/components/PdfSectionBanner'
import { PdfFieldGrid, PdfFieldRow, PdfField } from '@/lib/pdf/components/PdfFieldGrid'
import { PdfSignatures } from '@/lib/pdf/components/PdfSignatures'
import { PC } from '@/lib/pdf/components/tokens'

export interface TensiometrosRow {
  fecha: string
  hora: string | null
  prof_15cm: number | null
  prof_45cm: number | null
  prof_otra_cm: number | null
  lectura_otra: number | null
  realizo: string | null
  observaciones: string | null
}

interface Props {
  rancho: string
  orgNombre?: string | null
  desde: string
  hasta: string
  registros: TensiometrosRow[]
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

const C = { FECHA: 55, HORA: 40, P15: 45, P45: 45, POTRA: 45, LOTRA: 45, REAL: 80, OBS: 100 }

export function TensiometrosPDF({ rancho, orgNombre, desde, hasta, registros, terminoSitio = 'Instalacion' }: Props) {
  const periodo = desde === hasta ? fmtFecha(desde) : `${fmtFecha(desde)} - ${fmtFecha(hasta)}`

  return (
    <Document>
      <Page
        size="A4"
        orientation="landscape"
        style={{ fontFamily: 'Helvetica', fontSize: 7, padding: MARGIN, paddingBottom: 50, backgroundColor: PC.white }}
      >
        <PdfFooter moduloCodigo="M58" />
        <TopBar />
        <PdfHeader
          titulo="LECTURA DE TENSIOMETROS"
          subtitulo={`Monitoreo de humedad del suelo | ${rancho}`}
          codigoFormato="M58"
          folio={periodo}
          fecha={periodo}
        />

        <PdfSectionBanner>1. Datos del sitio</PdfSectionBanner>
        <PdfFieldGrid>
          <PdfFieldRow>
            <PdfField label={terminoSitio} value={rancho} />
            {orgNombre && <PdfField label="Organizacion" value={orgNombre} />}
            <PdfField label="Periodo" value={periodo} />
          </PdfFieldRow>
        </PdfFieldGrid>

        <PdfSectionBanner>2. Lecturas registradas</PdfSectionBanner>

        <View style={{ marginTop: 4, borderWidth: 1, borderColor: PC.border }}>
          <View style={{ flexDirection: 'row', backgroundColor: PC.section }}>
            <View style={[thStyle, { width: C.FECHA, backgroundColor: PC.section, alignItems: 'flex-start' }]}>
              <Text style={{ fontFamily: 'Helvetica-Bold', fontSize: 7, color: PC.white }}>Fecha</Text>
            </View>
            <View style={[thStyle, { width: C.HORA, backgroundColor: PC.section }]}>
              <Text style={{ fontFamily: 'Helvetica-Bold', fontSize: 7, color: PC.white }}>Hora</Text>
            </View>
            <View style={[thStyle, { width: C.P15, backgroundColor: PC.section }]}>
              <Text style={{ fontFamily: 'Helvetica-Bold', fontSize: 7, color: PC.white }}>15 cm</Text>
            </View>
            <View style={[thStyle, { width: C.P45, backgroundColor: PC.section }]}>
              <Text style={{ fontFamily: 'Helvetica-Bold', fontSize: 7, color: PC.white }}>45 cm</Text>
            </View>
            <View style={[thStyle, { width: C.POTRA, backgroundColor: PC.section }]}>
              <Text style={{ fontFamily: 'Helvetica-Bold', fontSize: 7, color: PC.white }}>Otra (cm)</Text>
            </View>
            <View style={[thStyle, { width: C.LOTRA, backgroundColor: PC.section }]}>
              <Text style={{ fontFamily: 'Helvetica-Bold', fontSize: 7, color: PC.white }}>Lect. otra</Text>
            </View>
            <View style={[thStyle, { width: C.REAL, backgroundColor: PC.section, alignItems: 'flex-start' }]}>
              <Text style={{ fontFamily: 'Helvetica-Bold', fontSize: 7, color: PC.white }}>Realizo</Text>
            </View>
            <View style={[thStyle, { flex: 1, backgroundColor: PC.section, alignItems: 'flex-start', borderRightWidth: 0 }]}>
              <Text style={{ fontFamily: 'Helvetica-Bold', fontSize: 7, color: PC.white }}>Observaciones</Text>
            </View>
          </View>

          {registros.map((r, i) => {
            const bg = i % 2 === 1 ? ROW_ALT : PC.white
            return (
              <View key={i} style={{ flexDirection: 'row', backgroundColor: bg }}>
                <View style={[tdStyle, { width: C.FECHA, alignItems: 'flex-start', padding: 4 }]}>
                  <Text style={{ fontSize: 7, color: PC.fieldValue }}>{fmtFecha(r.fecha)}</Text>
                </View>
                <View style={[tdStyle, { width: C.HORA, padding: 4 }]}>
                  <Text style={{ fontSize: 7, color: PC.fieldValue }}>{r.hora ?? '—'}</Text>
                </View>
                <View style={[tdStyle, { width: C.P15, padding: 4 }]}>
                  <Text style={{ fontSize: 7, color: PC.fieldValue }}>{r.prof_15cm != null ? String(r.prof_15cm) : '—'}</Text>
                </View>
                <View style={[tdStyle, { width: C.P45, padding: 4 }]}>
                  <Text style={{ fontSize: 7, color: PC.fieldValue }}>{r.prof_45cm != null ? String(r.prof_45cm) : '—'}</Text>
                </View>
                <View style={[tdStyle, { width: C.POTRA, padding: 4 }]}>
                  <Text style={{ fontSize: 7, color: PC.fieldValue }}>{r.prof_otra_cm != null ? String(r.prof_otra_cm) : '—'}</Text>
                </View>
                <View style={[tdStyle, { width: C.LOTRA, padding: 4 }]}>
                  <Text style={{ fontSize: 7, color: PC.fieldValue }}>{r.lectura_otra != null ? String(r.lectura_otra) : '—'}</Text>
                </View>
                <View style={[tdStyle, { width: C.REAL, alignItems: 'flex-start', padding: 4 }]}>
                  <Text style={{ fontSize: 7, color: PC.fieldValue }}>{r.realizo ?? '—'}</Text>
                </View>
                <View style={[tdStyle, { flex: 1, alignItems: 'flex-start', padding: 4, borderRightWidth: 0 }]}>
                  <Text style={{ fontSize: 7, color: PC.fieldValue }}>{r.observaciones ?? '—'}</Text>
                </View>
              </View>
            )
          })}
        </View>

        <PdfSignatures
          signatures={[{ label: '', nombre: '', caption: 'Responsable de Inocuidad' }]}
        />
      </Page>
    </Document>
  )
}
