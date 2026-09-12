import { Document, Page, View, Text } from '@react-pdf/renderer'
import { TopBar, PdfFooter } from '@/lib/pdf/components/PdfPage'
import { PdfHeader } from '@/lib/pdf/components/PdfHeader'
import { PdfSectionBanner } from '@/lib/pdf/components/PdfSectionBanner'
import { PdfFieldGrid, PdfFieldRow, PdfField } from '@/lib/pdf/components/PdfFieldGrid'
import { PdfSignatures } from '@/lib/pdf/components/PdfSignatures'
import { PC } from '@/lib/pdf/components/tokens'
import { codigoFormato } from '@/lib/codigoFormato'

export interface SanitizacionCosechaRow {
  fecha: string
  rancho: string
  sector: string
  empaque_o_granel: string
  cantidad_ton: number
  canastos: number
  herramientas_sanitizadas: number
  producto_sanitizante: string
  ppm: number
  hora: string | null
  realizo: string | null
  observaciones: string | null
}

interface Props {
  rows: SanitizacionCosechaRow[]
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

const C = { FECHA: 50, RANCHO: 65, SECT: 65, EG: 45, TON: 38, CAN: 38, HERR: 45, PROD: 90, PPM: 38, HORA: 38, REAL: 75 }

export function SanitizacionCosechaPDF({ rows, orgNombre, desde, hasta, codigoClave, terminoSitio = 'Instalacion' }: Props) {
  const periodo = desde === hasta ? fmtFecha(desde) : `${fmtFecha(desde)} - ${fmtFecha(hasta)}`
  const codigoFmt = codigoFormato('M65-SAN-COS', codigoClave)

  return (
    <Document>
      <Page
        size="A4"
        orientation="landscape"
        style={{ fontFamily: 'Helvetica', fontSize: 7, padding: MARGIN, paddingBottom: 50, backgroundColor: PC.white }}
      >
        <PdfFooter moduloCodigo="M65" />
        <TopBar />
        <PdfHeader
          titulo="SANITIZACION DE HERRAMIENTAS EN COSECHA"
          subtitulo="Registro de sanitizacion de herramientas de cosecha"
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
            <View style={[thStyle, { width: C.SECT, backgroundColor: PC.section, alignItems: 'flex-start' }]}>
              <Text style={{ fontFamily: 'Helvetica-Bold', fontSize: 6, color: PC.white }}>Sector</Text>
            </View>
            <View style={[thStyle, { width: C.EG, backgroundColor: PC.section }]}>
              <Text style={{ fontFamily: 'Helvetica-Bold', fontSize: 6, color: PC.white }}>Tipo</Text>
            </View>
            <View style={[thStyle, { width: C.TON, backgroundColor: PC.section }]}>
              <Text style={{ fontFamily: 'Helvetica-Bold', fontSize: 6, color: PC.white }}>Ton.</Text>
            </View>
            <View style={[thStyle, { width: C.CAN, backgroundColor: PC.section }]}>
              <Text style={{ fontFamily: 'Helvetica-Bold', fontSize: 6, color: PC.white }}>Canastos</Text>
            </View>
            <View style={[thStyle, { width: C.HERR, backgroundColor: PC.section }]}>
              <Text style={{ fontFamily: 'Helvetica-Bold', fontSize: 6, color: PC.white }}>Herr. san.</Text>
            </View>
            <View style={[thStyle, { width: C.PROD, backgroundColor: PC.section, alignItems: 'flex-start' }]}>
              <Text style={{ fontFamily: 'Helvetica-Bold', fontSize: 6, color: PC.white }}>Producto sanitizante</Text>
            </View>
            <View style={[thStyle, { width: C.PPM, backgroundColor: PC.section }]}>
              <Text style={{ fontFamily: 'Helvetica-Bold', fontSize: 6, color: PC.white }}>PPM</Text>
            </View>
            <View style={[thStyle, { width: C.HORA, backgroundColor: PC.section }]}>
              <Text style={{ fontFamily: 'Helvetica-Bold', fontSize: 6, color: PC.white }}>Hora</Text>
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
                <View style={[tdStyle, { width: C.SECT, alignItems: 'flex-start', padding: 4 }]}>
                  <Text style={{ fontSize: 6, color: PC.fieldValue }}>{r.sector}</Text>
                </View>
                <View style={[tdStyle, { width: C.EG, padding: 4 }]}>
                  <Text style={{ fontSize: 6, color: PC.fieldValue }}>{r.empaque_o_granel}</Text>
                </View>
                <View style={[tdStyle, { width: C.TON, padding: 4 }]}>
                  <Text style={{ fontSize: 6, color: PC.fieldValue }}>{r.cantidad_ton}</Text>
                </View>
                <View style={[tdStyle, { width: C.CAN, padding: 4 }]}>
                  <Text style={{ fontSize: 6, color: PC.fieldValue }}>{r.canastos}</Text>
                </View>
                <View style={[tdStyle, { width: C.HERR, padding: 4 }]}>
                  <Text style={{ fontSize: 6, color: PC.fieldValue }}>{r.herramientas_sanitizadas}</Text>
                </View>
                <View style={[tdStyle, { width: C.PROD, alignItems: 'flex-start', padding: 4 }]}>
                  <Text style={{ fontSize: 6, color: PC.fieldValue }}>{r.producto_sanitizante}</Text>
                </View>
                <View style={[tdStyle, { width: C.PPM, padding: 4 }]}>
                  <Text style={{ fontSize: 6, color: PC.fieldValue }}>{r.ppm}</Text>
                </View>
                <View style={[tdStyle, { width: C.HORA, padding: 4 }]}>
                  <Text style={{ fontSize: 6, color: PC.fieldValue }}>{r.hora ?? '—'}</Text>
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
