import { Document, Page, View, Text } from '@react-pdf/renderer'
import { TopBar, PdfFooter } from '@/lib/pdf/components/PdfPage'
import { PdfHeader } from '@/lib/pdf/components/PdfHeader'
import { PdfSectionBanner } from '@/lib/pdf/components/PdfSectionBanner'
import { PdfFieldGrid, PdfFieldRow, PdfField } from '@/lib/pdf/components/PdfFieldGrid'
import { PdfSignatures } from '@/lib/pdf/components/PdfSignatures'
import { PC } from '@/lib/pdf/components/tokens'

export interface FuentesAguaItemRow {
  numero: number
  descripcion: string
  respuesta: 'si' | 'no' | 'na'
  comentario: string | null
}

export interface FuentesAguaPDFProps {
  rancho: string
  orgNombre?: string | null
  fecha: string
  tipo_fuente: string | null
  realizo: string | null
  observaciones: string | null
  items: FuentesAguaItemRow[]
  terminoSitio?: string
}

const MARGIN = 24

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

function labelRespuesta(r: 'si' | 'no' | 'na'): string {
  if (r === 'si') return 'Si'
  if (r === 'no') return 'No'
  return 'N/A'
}

export function FuentesAguaPage({
  rancho,
  orgNombre,
  fecha,
  tipo_fuente,
  realizo,
  observaciones,
  items,
  terminoSitio = 'Instalacion',
}: FuentesAguaPDFProps) {
  return (
    <Page
        size="A4"
        orientation="portrait"
        style={{ fontFamily: 'Helvetica', fontSize: 8, padding: MARGIN, paddingBottom: 50, backgroundColor: PC.white }}
      >
        <PdfFooter moduloCodigo="M62" />
        <TopBar />
        <PdfHeader
          titulo="INSPECCION DE FUENTES DE AGUA"
          subtitulo={`Inspeccion de fuente | ${rancho}`}
          codigoFormato="M62"
          folio={fmtFecha(fecha)}
          fecha={fmtFecha(fecha)}
        />

        <PdfSectionBanner>1. Datos generales</PdfSectionBanner>
        <PdfFieldGrid>
          <PdfFieldRow>
            <PdfField label={terminoSitio} value={rancho} />
            {orgNombre && <PdfField label="Organizacion" value={orgNombre} />}
          </PdfFieldRow>
          <PdfFieldRow>
            <PdfField label="Fecha" value={fmtFecha(fecha)} />
            <PdfField label="Tipo de fuente" value={tipo_fuente ?? '—'} />
          </PdfFieldRow>
          <PdfFieldRow>
            <PdfField label="Realizo" value={realizo ?? '—'} />
            <PdfField label="Observaciones" value={observaciones ?? '—'} />
          </PdfFieldRow>
        </PdfFieldGrid>

        <PdfSectionBanner>2. Checklist de inspeccion</PdfSectionBanner>

        <View style={{ marginTop: 4, borderWidth: 1, borderColor: PC.border }}>
          <View style={{ flexDirection: 'row', backgroundColor: PC.section }}>
            <View style={[thStyle, { width: 28, backgroundColor: PC.section }]}>
              <Text style={{ fontFamily: 'Helvetica-Bold', fontSize: 7, color: PC.white }}>No.</Text>
            </View>
            <View style={[thStyle, { flex: 1, backgroundColor: PC.section, alignItems: 'flex-start' }]}>
              <Text style={{ fontFamily: 'Helvetica-Bold', fontSize: 7, color: PC.white }}>Criterio de inspeccion</Text>
            </View>
            <View style={[thStyle, { width: 45, backgroundColor: PC.section }]}>
              <Text style={{ fontFamily: 'Helvetica-Bold', fontSize: 7, color: PC.white }}>Respuesta</Text>
            </View>
            <View style={[thStyle, { width: 130, backgroundColor: PC.section, alignItems: 'flex-start', borderRightWidth: 0 }]}>
              <Text style={{ fontFamily: 'Helvetica-Bold', fontSize: 7, color: PC.white }}>Comentario</Text>
            </View>
          </View>

          {items.map((item, i) => {
            const bg = i % 2 === 1 ? ROW_ALT : PC.white
            const label = labelRespuesta(item.respuesta)
            return (
              <View key={i} style={{ flexDirection: 'row', backgroundColor: bg }}>
                <View style={[tdStyle, { width: 28, padding: 4 }]}>
                  <Text style={{ fontSize: 8, color: PC.fieldValue }}>{item.numero}</Text>
                </View>
                <View style={[tdStyle, { flex: 1, alignItems: 'flex-start', padding: 4 }]}>
                  <Text style={{ fontSize: 8, color: PC.fieldValue }}>{item.descripcion}</Text>
                </View>
                <View style={[tdStyle, { width: 45, padding: 4 }]}>
                  <Text style={{ fontSize: 8, fontFamily: 'Helvetica-Bold', color: item.respuesta === 'no' ? '#C02A2A' : PC.fieldValue }}>
                    {label}
                  </Text>
                </View>
                <View style={[tdStyle, { width: 130, alignItems: 'flex-start', padding: 4, borderRightWidth: 0 }]}>
                  <Text style={{ fontSize: 8, color: PC.fieldValue }}>{item.comentario ?? '—'}</Text>
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

export function FuentesAguaPDF(props: FuentesAguaPDFProps) {
  return (
    <Document>
      <FuentesAguaPage {...props} />
    </Document>
  )
}
