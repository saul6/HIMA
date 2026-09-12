import { Document, Page, View, Text } from '@react-pdf/renderer'
import { TopBar, PdfFooter } from '@/lib/pdf/components/PdfPage'
import { PdfHeader } from '@/lib/pdf/components/PdfHeader'
import { PdfSectionBanner } from '@/lib/pdf/components/PdfSectionBanner'
import { PdfFieldGrid, PdfFieldRow, PdfField } from '@/lib/pdf/components/PdfFieldGrid'
import { PdfSignatures } from '@/lib/pdf/components/PdfSignatures'
import { PC } from '@/lib/pdf/components/tokens'
import { codigoFormato } from '@/lib/codigoFormato'

export interface UsoEppRow {
  fecha: string
  rancho: string
  aplicador: string
  momento: string
  botas_ok: boolean
  overol_ok: boolean
  guantes_ok: boolean
  lentes_ok: boolean
  mascarilla_ok: boolean
  realizo: string | null
  observaciones: string | null
}

interface Props {
  rows: UsoEppRow[]
  orgNombre?: string | null
  desde: string
  hasta: string
  codigoClave: string
  terminoSitio?: string
}

const MARGIN = 20

function fmtFecha(iso: string): string {
  try {
    const [y, m, d] = iso.split('-')
    return `${d}/${m}/${y}`
  } catch { return iso }
}

function okLabel(val: boolean): string {
  return val ? 'Bueno' : 'Danado'
}

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
  padding: 1,
}

const ROW_ALT = '#F5F9FE'

const C = { FECHA: 50, RANCHO: 70, APLIC: 75, MOM: 45, BOTA: 40, OVE: 40, GUA: 40, LEN: 40, MAS: 42, REAL: 80 }

export function UsoEppPDF({ rows, orgNombre, desde, hasta, codigoClave, terminoSitio = 'Instalacion' }: Props) {
  const periodo = desde === hasta ? fmtFecha(desde) : `${fmtFecha(desde)} - ${fmtFecha(hasta)}`
  const codigoFmt = codigoFormato('M63-USO-EPP', codigoClave)

  return (
    <Document>
      <Page
        size="A4"
        orientation="landscape"
        style={{ fontFamily: 'Helvetica', fontSize: 7, padding: MARGIN, paddingBottom: 50, backgroundColor: PC.white }}
      >
        <PdfFooter moduloCodigo="M63" />
        <TopBar />
        <PdfHeader
          titulo="USO DE EQUIPO DE PROTECCION PERSONAL (EPP)"
          subtitulo="Registro de uso y estado del EPP"
          codigoFormato={codigoFmt}
          folio={periodo}
          fecha={periodo}
        />

        <PdfSectionBanner>1. Informacion general</PdfSectionBanner>
        <PdfFieldGrid>
          <PdfFieldRow>
            <PdfField label="Organizacion" value={orgNombre ?? '—'} />
            <PdfField label="Periodo" value={periodo} />
          </PdfFieldRow>
        </PdfFieldGrid>

        <PdfSectionBanner>2. Registros</PdfSectionBanner>

        <View style={{ marginTop: 4, borderWidth: 1, borderColor: PC.border }}>
          <View style={{ flexDirection: 'row', backgroundColor: PC.section }}>
            <View style={[thStyle, { width: C.FECHA, backgroundColor: PC.section, alignItems: 'flex-start' }]}>
              <Text style={{ fontFamily: 'Helvetica-Bold', fontSize: 6, color: PC.white }}>Fecha</Text>
            </View>
            <View style={[thStyle, { width: C.RANCHO, backgroundColor: PC.section, alignItems: 'flex-start' }]}>
              <Text style={{ fontFamily: 'Helvetica-Bold', fontSize: 6, color: PC.white }}>{terminoSitio}</Text>
            </View>
            <View style={[thStyle, { width: C.APLIC, backgroundColor: PC.section, alignItems: 'flex-start' }]}>
              <Text style={{ fontFamily: 'Helvetica-Bold', fontSize: 6, color: PC.white }}>Aplicador</Text>
            </View>
            <View style={[thStyle, { width: C.MOM, backgroundColor: PC.section }]}>
              <Text style={{ fontFamily: 'Helvetica-Bold', fontSize: 6, color: PC.white }}>Momento</Text>
            </View>
            <View style={[thStyle, { width: C.BOTA, backgroundColor: PC.section }]}>
              <Text style={{ fontFamily: 'Helvetica-Bold', fontSize: 6, color: PC.white }}>Botas</Text>
            </View>
            <View style={[thStyle, { width: C.OVE, backgroundColor: PC.section }]}>
              <Text style={{ fontFamily: 'Helvetica-Bold', fontSize: 6, color: PC.white }}>Overol</Text>
            </View>
            <View style={[thStyle, { width: C.GUA, backgroundColor: PC.section }]}>
              <Text style={{ fontFamily: 'Helvetica-Bold', fontSize: 6, color: PC.white }}>Guantes</Text>
            </View>
            <View style={[thStyle, { width: C.LEN, backgroundColor: PC.section }]}>
              <Text style={{ fontFamily: 'Helvetica-Bold', fontSize: 6, color: PC.white }}>Lentes</Text>
            </View>
            <View style={[thStyle, { width: C.MAS, backgroundColor: PC.section }]}>
              <Text style={{ fontFamily: 'Helvetica-Bold', fontSize: 6, color: PC.white }}>Mascarilla</Text>
            </View>
            <View style={[thStyle, { width: C.REAL, backgroundColor: PC.section, alignItems: 'flex-start', borderRightWidth: 0 }]}>
              <Text style={{ fontFamily: 'Helvetica-Bold', fontSize: 6, color: PC.white }}>Realizo</Text>
            </View>
          </View>

          {rows.map((r, i) => {
            const bg = i % 2 === 1 ? ROW_ALT : PC.white
            return (
              <View key={i} style={{ flexDirection: 'row', backgroundColor: bg }}>
                <View style={[tdStyle, { width: C.FECHA, alignItems: 'flex-start', padding: 4 }]}>
                  <Text style={{ fontSize: 6, color: PC.fieldValue }}>{fmtFecha(r.fecha)}</Text>
                </View>
                <View style={[tdStyle, { width: C.RANCHO, alignItems: 'flex-start', padding: 4 }]}>
                  <Text style={{ fontSize: 6, color: PC.fieldValue }}>{r.rancho}</Text>
                </View>
                <View style={[tdStyle, { width: C.APLIC, alignItems: 'flex-start', padding: 4 }]}>
                  <Text style={{ fontSize: 6, color: PC.fieldValue }}>{r.aplicador}</Text>
                </View>
                <View style={[tdStyle, { width: C.MOM, padding: 4 }]}>
                  <Text style={{ fontSize: 6, color: PC.fieldValue }}>{r.momento === 'inicio' ? 'Inicio' : 'Fin'}</Text>
                </View>
                <View style={[tdStyle, { width: C.BOTA, padding: 4 }]}>
                  <Text style={{ fontSize: 6, color: PC.fieldValue }}>{okLabel(r.botas_ok)}</Text>
                </View>
                <View style={[tdStyle, { width: C.OVE, padding: 4 }]}>
                  <Text style={{ fontSize: 6, color: PC.fieldValue }}>{okLabel(r.overol_ok)}</Text>
                </View>
                <View style={[tdStyle, { width: C.GUA, padding: 4 }]}>
                  <Text style={{ fontSize: 6, color: PC.fieldValue }}>{okLabel(r.guantes_ok)}</Text>
                </View>
                <View style={[tdStyle, { width: C.LEN, padding: 4 }]}>
                  <Text style={{ fontSize: 6, color: PC.fieldValue }}>{okLabel(r.lentes_ok)}</Text>
                </View>
                <View style={[tdStyle, { width: C.MAS, padding: 4 }]}>
                  <Text style={{ fontSize: 6, color: PC.fieldValue }}>{okLabel(r.mascarilla_ok)}</Text>
                </View>
                <View style={[tdStyle, { width: C.REAL, alignItems: 'flex-start', padding: 4, borderRightWidth: 0 }]}>
                  <Text style={{ fontSize: 6, color: PC.fieldValue }}>{r.realizo ?? '—'}</Text>
                </View>
              </View>
            )
          })}
        </View>

        <PdfSignatures
          signatures={[{ label: '', nombre: '', caption: 'Verifico: Responsable de Inocuidad' }]}
        />
      </Page>
    </Document>
  )
}
