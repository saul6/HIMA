import { Document, Page, View, Text } from '@react-pdf/renderer'
import { TopBar, PdfFooter } from '@/lib/pdf/components/PdfPage'
import { PdfHeader } from '@/lib/pdf/components/PdfHeader'
import { PdfSectionBanner } from '@/lib/pdf/components/PdfSectionBanner'
import { PdfFieldGrid, PdfFieldRow, PdfField } from '@/lib/pdf/components/PdfFieldGrid'
import { PdfSignatures } from '@/lib/pdf/components/PdfSignatures'
import { PC } from '@/lib/pdf/components/tokens'

export interface MipObservacionItemRow {
  numero: number | null
  texto: string
  contra_maleza: boolean
  contra_insectos: boolean
  contra_enfermedades: boolean
  contra_vertebrados: boolean
  comentario: string | null
}

export interface MipObservacionPDFProps {
  rancho: string
  orgNombre?: string | null
  fecha: string
  producto: string | null
  region: string | null
  realizo: string | null
  observaciones: string | null
  items: MipObservacionItemRow[]
  terminoSitio?: string
}

const MARGIN = 24

const thStyle = {
  padding: 3,
  borderRightWidth: 1,
  borderRightColor: '#5599CC',
  borderBottomWidth: 1,
  borderBottomColor: '#5599CC',
  justifyContent: 'center' as const,
  alignItems: 'center' as const,
}

const tdStyle = {
  borderRightWidth: 1,
  borderRightColor: PC.border,
  borderBottomWidth: 1,
  borderBottomColor: PC.border,
  justifyContent: 'center' as const,
  alignItems: 'center' as const,
  padding: 3,
}

const ROW_ALT = '#F5F9FE'

function fmtFecha(iso: string): string {
  try {
    const [y, m, d] = iso.split('-')
    return `${d}/${m}/${y}`
  } catch { return iso }
}

function marca(v: boolean): string { return v ? 'X' : '' }

export function MipObservacionPDFPage({
  rancho,
  orgNombre,
  fecha,
  producto,
  region,
  realizo,
  observaciones,
  items,
  terminoSitio = 'Sitio',
}: MipObservacionPDFProps) {
  return (
    <Page
      size="A4"
      orientation="landscape"
      style={{ fontFamily: 'Helvetica', fontSize: 8, padding: MARGIN, paddingBottom: 46, backgroundColor: PC.white }}
    >
      <PdfFooter moduloCodigo="M54" />
      <TopBar />
      <PdfHeader
        titulo="MIP - OBSERVACION Y MONITOREO"
        subtitulo={`Manejo Integrado de Plagas | ${rancho}`}
        codigoFormato="M54"
        folio={fmtFecha(fecha)}
        fecha={fmtFecha(fecha)}
      />

      <PdfSectionBanner>1. Datos generales</PdfSectionBanner>
      <PdfFieldGrid>
        <PdfFieldRow>
          <PdfField label={terminoSitio} value={rancho} />
          <PdfField label="Producto / Cultivo" value={producto ?? '—'} />
          {orgNombre && <PdfField label="Organizacion" value={orgNombre} />}
        </PdfFieldRow>
        <PdfFieldRow>
          <PdfField label="Fecha" value={fmtFecha(fecha)} />
          <PdfField label="Region" value={region ?? '—'} />
          <PdfField label="Realizo" value={realizo ?? '—'} />
        </PdfFieldRow>
        {observaciones && (
          <PdfFieldRow>
            <PdfField label="Observaciones" value={observaciones} />
          </PdfFieldRow>
        )}
      </PdfFieldGrid>

      <PdfSectionBanner>2. Matriz de observacion y monitoreo</PdfSectionBanner>

      <View style={{ marginTop: 4, borderWidth: 1, borderColor: PC.border }}>
        <View style={{ flexDirection: 'row', backgroundColor: PC.section }}>
          <View style={[thStyle, { width: 20, backgroundColor: PC.section }]}>
            <Text style={{ fontFamily: 'Helvetica-Bold', fontSize: 6, color: PC.white }}>No.</Text>
          </View>
          <View style={[thStyle, { flex: 1, backgroundColor: PC.section, alignItems: 'flex-start' }]}>
            <Text style={{ fontFamily: 'Helvetica-Bold', fontSize: 6, color: PC.white }}>Tecnica de observacion / monitoreo</Text>
          </View>
          <View style={[thStyle, { width: 60, backgroundColor: PC.section }]}>
            <Text style={{ fontFamily: 'Helvetica-Bold', fontSize: 6, color: PC.white, textAlign: 'center' }}>Maleza</Text>
          </View>
          <View style={[thStyle, { width: 60, backgroundColor: PC.section }]}>
            <Text style={{ fontFamily: 'Helvetica-Bold', fontSize: 6, color: PC.white, textAlign: 'center' }}>Insectos e{'\n'}Invertebrados</Text>
          </View>
          <View style={[thStyle, { width: 60, backgroundColor: PC.section }]}>
            <Text style={{ fontFamily: 'Helvetica-Bold', fontSize: 6, color: PC.white, textAlign: 'center' }}>Enfermedades y{'\n'}Nematodos</Text>
          </View>
          <View style={[thStyle, { width: 60, backgroundColor: PC.section }]}>
            <Text style={{ fontFamily: 'Helvetica-Bold', fontSize: 6, color: PC.white, textAlign: 'center' }}>Plagas{'\n'}Vertebradas</Text>
          </View>
          <View style={[thStyle, { width: 130, backgroundColor: PC.section, alignItems: 'flex-start', borderRightWidth: 0 }]}>
            <Text style={{ fontFamily: 'Helvetica-Bold', fontSize: 6, color: PC.white }}>Comentario</Text>
          </View>
        </View>

        {items.map((item, i) => {
          const bg = i % 2 === 1 ? ROW_ALT : PC.white
          return (
            <View key={i} style={{ flexDirection: 'row', backgroundColor: bg }}>
              <View style={[tdStyle, { width: 20, padding: 3 }]}>
                <Text style={{ fontSize: 7, color: PC.fieldValue }}>{item.numero ?? '—'}</Text>
              </View>
              <View style={[tdStyle, { flex: 1, alignItems: 'flex-start', padding: 3 }]}>
                <Text style={{ fontSize: 7, color: PC.fieldValue }}>{item.texto}</Text>
              </View>
              <View style={[tdStyle, { width: 60 }]}>
                <Text style={{ fontSize: 8, fontFamily: 'Helvetica-Bold', color: item.contra_maleza ? PC.section : PC.fieldValue }}>
                  {marca(item.contra_maleza)}
                </Text>
              </View>
              <View style={[tdStyle, { width: 60 }]}>
                <Text style={{ fontSize: 8, fontFamily: 'Helvetica-Bold', color: item.contra_insectos ? PC.section : PC.fieldValue }}>
                  {marca(item.contra_insectos)}
                </Text>
              </View>
              <View style={[tdStyle, { width: 60 }]}>
                <Text style={{ fontSize: 8, fontFamily: 'Helvetica-Bold', color: item.contra_enfermedades ? PC.section : PC.fieldValue }}>
                  {marca(item.contra_enfermedades)}
                </Text>
              </View>
              <View style={[tdStyle, { width: 60 }]}>
                <Text style={{ fontSize: 8, fontFamily: 'Helvetica-Bold', color: item.contra_vertebrados ? PC.section : PC.fieldValue }}>
                  {marca(item.contra_vertebrados)}
                </Text>
              </View>
              <View style={[tdStyle, { width: 130, alignItems: 'flex-start', borderRightWidth: 0 }]}>
                <Text style={{ fontSize: 7, color: PC.fieldValue }}>{item.comentario ?? ''}</Text>
              </View>
            </View>
          )
        })}
      </View>

      <PdfSignatures
        signatures={[{ label: '', nombre: '', caption: 'Responsable de Inocuidad' }]}
      />
    </Page>
  )
}

export function MipObservacionPDF(props: MipObservacionPDFProps) {
  return (
    <Document>
      <MipObservacionPDFPage {...props} />
    </Document>
  )
}
