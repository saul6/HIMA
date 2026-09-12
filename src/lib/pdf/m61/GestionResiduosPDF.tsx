import { Document, Page, View, Text } from '@react-pdf/renderer'
import { TopBar, PdfFooter } from '@/lib/pdf/components/PdfPage'
import { PdfHeader } from '@/lib/pdf/components/PdfHeader'
import { PdfSectionBanner } from '@/lib/pdf/components/PdfSectionBanner'
import { PdfFieldGrid, PdfFieldRow, PdfField } from '@/lib/pdf/components/PdfFieldGrid'
import { PdfSignatures } from '@/lib/pdf/components/PdfSignatures'
import { PC } from '@/lib/pdf/components/tokens'

export interface GestionResiduosRow {
  fecha: string
  fuente_residuo: string
  descripcion: string | null
  clasificacion: string | null
  destino_final: string | null
  cantidad: string | null
  realizo: string | null
  observaciones: string | null
}

interface Props {
  rancho: string
  orgNombre?: string | null
  desde: string
  hasta: string
  registros: GestionResiduosRow[]
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

const C = { FECHA: 55, FUENTE: 90, DESC: 100, CLAS: 80, DEST: 90, CANT: 55, REAL: 75, OBS: 90 }

export function GestionResiduosPDF({ rancho, orgNombre, desde, hasta, registros, terminoSitio = 'Instalacion' }: Props) {
  const periodo = desde === hasta ? fmtFecha(desde) : `${fmtFecha(desde)} - ${fmtFecha(hasta)}`

  return (
    <Document>
      <Page
        size="A4"
        orientation="landscape"
        style={{ fontFamily: 'Helvetica', fontSize: 7, padding: MARGIN, paddingBottom: 50, backgroundColor: PC.white }}
      >
        <PdfFooter moduloCodigo="M61" />
        <TopBar />
        <PdfHeader
          titulo="SISTEMA DE GESTION DE RESIDUOS"
          subtitulo={`Registro de residuos | ${rancho}`}
          codigoFormato="M61"
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

        <PdfSectionBanner>2. Registros de residuos</PdfSectionBanner>

        <View style={{ marginTop: 4, borderWidth: 1, borderColor: PC.border }}>
          <View style={{ flexDirection: 'row', backgroundColor: PC.section }}>
            <View style={[thStyle, { width: C.FECHA, backgroundColor: PC.section, alignItems: 'flex-start' }]}>
              <Text style={{ fontFamily: 'Helvetica-Bold', fontSize: 7, color: PC.white }}>Fecha</Text>
            </View>
            <View style={[thStyle, { width: C.FUENTE, backgroundColor: PC.section, alignItems: 'flex-start' }]}>
              <Text style={{ fontFamily: 'Helvetica-Bold', fontSize: 7, color: PC.white }}>Fuente de residuo</Text>
            </View>
            <View style={[thStyle, { width: C.DESC, backgroundColor: PC.section, alignItems: 'flex-start' }]}>
              <Text style={{ fontFamily: 'Helvetica-Bold', fontSize: 7, color: PC.white }}>Descripcion</Text>
            </View>
            <View style={[thStyle, { width: C.CLAS, backgroundColor: PC.section, alignItems: 'flex-start' }]}>
              <Text style={{ fontFamily: 'Helvetica-Bold', fontSize: 7, color: PC.white }}>Clasificacion</Text>
            </View>
            <View style={[thStyle, { width: C.DEST, backgroundColor: PC.section, alignItems: 'flex-start' }]}>
              <Text style={{ fontFamily: 'Helvetica-Bold', fontSize: 7, color: PC.white }}>Destino final</Text>
            </View>
            <View style={[thStyle, { width: C.CANT, backgroundColor: PC.section }]}>
              <Text style={{ fontFamily: 'Helvetica-Bold', fontSize: 7, color: PC.white }}>Cantidad</Text>
            </View>
            <View style={[thStyle, { width: C.REAL, backgroundColor: PC.section, alignItems: 'flex-start' }]}>
              <Text style={{ fontFamily: 'Helvetica-Bold', fontSize: 7, color: PC.white }}>Realizo</Text>
            </View>
            <View style={[thStyle, { width: C.OBS, backgroundColor: PC.section, alignItems: 'flex-start', borderRightWidth: 0 }]}>
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
                <View style={[tdStyle, { width: C.FUENTE, alignItems: 'flex-start', padding: 4 }]}>
                  <Text style={{ fontSize: 7, color: PC.fieldValue }}>{r.fuente_residuo}</Text>
                </View>
                <View style={[tdStyle, { width: C.DESC, alignItems: 'flex-start', padding: 4 }]}>
                  <Text style={{ fontSize: 7, color: PC.fieldValue }}>{r.descripcion ?? '—'}</Text>
                </View>
                <View style={[tdStyle, { width: C.CLAS, alignItems: 'flex-start', padding: 4 }]}>
                  <Text style={{ fontSize: 7, color: PC.fieldValue }}>{r.clasificacion ?? '—'}</Text>
                </View>
                <View style={[tdStyle, { width: C.DEST, alignItems: 'flex-start', padding: 4 }]}>
                  <Text style={{ fontSize: 7, color: PC.fieldValue }}>{r.destino_final ?? '—'}</Text>
                </View>
                <View style={[tdStyle, { width: C.CANT, padding: 4 }]}>
                  <Text style={{ fontSize: 7, color: PC.fieldValue }}>{r.cantidad ?? '—'}</Text>
                </View>
                <View style={[tdStyle, { width: C.REAL, alignItems: 'flex-start', padding: 4 }]}>
                  <Text style={{ fontSize: 7, color: PC.fieldValue }}>{r.realizo ?? '—'}</Text>
                </View>
                <View style={[tdStyle, { width: C.OBS, alignItems: 'flex-start', padding: 4, borderRightWidth: 0 }]}>
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
