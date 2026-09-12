import { Document, Page, View, Text } from '@react-pdf/renderer'
import { TopBar, PdfFooter } from '@/lib/pdf/components/PdfPage'
import { PdfHeader } from '@/lib/pdf/components/PdfHeader'
import { PdfSectionBanner } from '@/lib/pdf/components/PdfSectionBanner'
import { PdfFieldGrid, PdfFieldRow, PdfField } from '@/lib/pdf/components/PdfFieldGrid'
import { PdfSignatures } from '@/lib/pdf/components/PdfSignatures'
import { PC } from '@/lib/pdf/components/tokens'
import { codigoFormato } from '@/lib/codigoFormato'

export interface ControlHerramientasRow {
  fecha: string
  rancho: string
  trabajador: string
  herramienta: string
  cantidad: number
  entrega_nombre: string
  recibe_nombre: string
  devuelto: boolean
  fecha_devolucion: string | null
  realizo: string | null
  observaciones: string | null
}

interface Props {
  rows: ControlHerramientasRow[]
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

const C = { FECHA: 50, RANCHO: 65, TRAB: 75, HERR: 85, CANT: 35, ENT: 75, REC: 75, DEV: 40, FDEV: 55, REAL: 65 }

export function ControlHerramientasPDF({ rows, orgNombre, desde, hasta, codigoClave, terminoSitio = 'Instalacion' }: Props) {
  const periodo = desde === hasta ? fmtFecha(desde) : `${fmtFecha(desde)} - ${fmtFecha(hasta)}`
  const codigoFmt = codigoFormato('M64-CTRL-HERR', codigoClave)

  return (
    <Document>
      <Page
        size="A4"
        orientation="landscape"
        style={{ fontFamily: 'Helvetica', fontSize: 7, padding: MARGIN, paddingBottom: 50, backgroundColor: PC.white }}
      >
        <PdfFooter moduloCodigo="M64" />
        <TopBar />
        <PdfHeader
          titulo="CONTROL DE HERRAMIENTAS"
          subtitulo="Registro de entrega y devolucion de herramientas"
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
            <View style={[thStyle, { width: C.TRAB, backgroundColor: PC.section, alignItems: 'flex-start' }]}>
              <Text style={{ fontFamily: 'Helvetica-Bold', fontSize: 6, color: PC.white }}>Trabajador</Text>
            </View>
            <View style={[thStyle, { width: C.HERR, backgroundColor: PC.section, alignItems: 'flex-start' }]}>
              <Text style={{ fontFamily: 'Helvetica-Bold', fontSize: 6, color: PC.white }}>Herramienta</Text>
            </View>
            <View style={[thStyle, { width: C.CANT, backgroundColor: PC.section }]}>
              <Text style={{ fontFamily: 'Helvetica-Bold', fontSize: 6, color: PC.white }}>Cant.</Text>
            </View>
            <View style={[thStyle, { width: C.ENT, backgroundColor: PC.section, alignItems: 'flex-start' }]}>
              <Text style={{ fontFamily: 'Helvetica-Bold', fontSize: 6, color: PC.white }}>Entrega</Text>
            </View>
            <View style={[thStyle, { width: C.REC, backgroundColor: PC.section, alignItems: 'flex-start' }]}>
              <Text style={{ fontFamily: 'Helvetica-Bold', fontSize: 6, color: PC.white }}>Recibe</Text>
            </View>
            <View style={[thStyle, { width: C.DEV, backgroundColor: PC.section }]}>
              <Text style={{ fontFamily: 'Helvetica-Bold', fontSize: 6, color: PC.white }}>Devuelto</Text>
            </View>
            <View style={[thStyle, { width: C.FDEV, backgroundColor: PC.section, alignItems: 'flex-start', borderRightWidth: 0 }]}>
              <Text style={{ fontFamily: 'Helvetica-Bold', fontSize: 6, color: PC.white }}>F. devolucion</Text>
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
                <View style={[tdStyle, { width: C.TRAB, alignItems: 'flex-start', padding: 4 }]}>
                  <Text style={{ fontSize: 6, color: PC.fieldValue }}>{r.trabajador}</Text>
                </View>
                <View style={[tdStyle, { width: C.HERR, alignItems: 'flex-start', padding: 4 }]}>
                  <Text style={{ fontSize: 6, color: PC.fieldValue }}>{r.herramienta}</Text>
                </View>
                <View style={[tdStyle, { width: C.CANT, padding: 4 }]}>
                  <Text style={{ fontSize: 6, color: PC.fieldValue }}>{r.cantidad}</Text>
                </View>
                <View style={[tdStyle, { width: C.ENT, alignItems: 'flex-start', padding: 4 }]}>
                  <Text style={{ fontSize: 6, color: PC.fieldValue }}>{r.entrega_nombre}</Text>
                </View>
                <View style={[tdStyle, { width: C.REC, alignItems: 'flex-start', padding: 4 }]}>
                  <Text style={{ fontSize: 6, color: PC.fieldValue }}>{r.recibe_nombre}</Text>
                </View>
                <View style={[tdStyle, { width: C.DEV, padding: 4 }]}>
                  <Text style={{ fontSize: 6, color: PC.fieldValue }}>{r.devuelto ? 'Si' : 'No'}</Text>
                </View>
                <View style={[tdStyle, { width: C.FDEV, alignItems: 'flex-start', padding: 4, borderRightWidth: 0 }]}>
                  <Text style={{ fontSize: 6, color: PC.fieldValue }}>{r.fecha_devolucion ? fmtFecha(r.fecha_devolucion) : '—'}</Text>
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
