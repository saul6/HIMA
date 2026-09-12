import { Document, Page, View, Text } from '@react-pdf/renderer'
import { TopBar, PdfFooter } from '@/lib/pdf/components/PdfPage'
import { PdfHeader } from '@/lib/pdf/components/PdfHeader'
import { PdfSectionBanner } from '@/lib/pdf/components/PdfSectionBanner'
import { PdfFieldGrid, PdfFieldRow, PdfField } from '@/lib/pdf/components/PdfFieldGrid'
import { PdfSignatures } from '@/lib/pdf/components/PdfSignatures'
import { PC } from '@/lib/pdf/components/tokens'

export interface ConsumoEnergiaRow {
  mes: string
  tipo_combustible: string | null
  cantidad_litros: number | null
  costo_combustible: number | null
  actividad: string | null
  luz_costo: number | null
  luz_kwh: number | null
  realizo: string | null
  observaciones: string | null
}

interface Props {
  rancho: string
  orgNombre?: string | null
  desde: string
  hasta: string
  registros: ConsumoEnergiaRow[]
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
    if (!d) {
      return new Date(iso + '-01T12:00:00').toLocaleDateString('es-MX', { month: 'long', year: 'numeric' })
        .replace(/^\w/, c => c.toUpperCase())
    }
    return `${d}/${m}/${y}`
  } catch { return iso }
}

function fmtMes(iso: string): string {
  try {
    return new Date(iso + 'T12:00:00').toLocaleDateString('es-MX', { month: 'long', year: 'numeric' })
      .replace(/^\w/, c => c.toUpperCase())
  } catch { return iso }
}

const C = { MES: 65, TIPO: 75, LIT: 45, COST_C: 55, ACT: 90, COST_L: 50, KWH: 45, REAL: 75, OBS: 90 }

export function ConsumoEnergiaPDF({ rancho, orgNombre, desde, hasta, registros, terminoSitio = 'Instalacion' }: Props) {
  const periodo = desde === hasta ? fmtMes(desde) : `${fmtFecha(desde)} - ${fmtFecha(hasta)}`

  return (
    <Document>
      <Page
        size="A4"
        orientation="landscape"
        style={{ fontFamily: 'Helvetica', fontSize: 7, padding: MARGIN, paddingBottom: 50, backgroundColor: PC.white }}
      >
        <PdfFooter moduloCodigo="M60" />
        <TopBar />
        <PdfHeader
          titulo="CONSUMO DE COMBUSTIBLE Y ENERGIA"
          subtitulo={`Registro de energia | ${rancho}`}
          codigoFormato="M60"
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

        <PdfSectionBanner>2. Registros de consumo</PdfSectionBanner>

        <View style={{ marginTop: 4, borderWidth: 1, borderColor: PC.border }}>
          <View style={{ flexDirection: 'row', backgroundColor: PC.section }}>
            <View style={[thStyle, { width: C.MES, backgroundColor: PC.section, alignItems: 'flex-start' }]}>
              <Text style={{ fontFamily: 'Helvetica-Bold', fontSize: 7, color: PC.white }}>Mes</Text>
            </View>
            <View style={[thStyle, { width: C.TIPO, backgroundColor: PC.section, alignItems: 'flex-start' }]}>
              <Text style={{ fontFamily: 'Helvetica-Bold', fontSize: 7, color: PC.white }}>Tipo combustible</Text>
            </View>
            <View style={[thStyle, { width: C.LIT, backgroundColor: PC.section }]}>
              <Text style={{ fontFamily: 'Helvetica-Bold', fontSize: 7, color: PC.white }}>Litros</Text>
            </View>
            <View style={[thStyle, { width: C.COST_C, backgroundColor: PC.section }]}>
              <Text style={{ fontFamily: 'Helvetica-Bold', fontSize: 7, color: PC.white }}>Costo combust.</Text>
            </View>
            <View style={[thStyle, { width: C.ACT, backgroundColor: PC.section, alignItems: 'flex-start' }]}>
              <Text style={{ fontFamily: 'Helvetica-Bold', fontSize: 7, color: PC.white }}>Actividad</Text>
            </View>
            <View style={[thStyle, { width: C.COST_L, backgroundColor: PC.section }]}>
              <Text style={{ fontFamily: 'Helvetica-Bold', fontSize: 7, color: PC.white }}>Costo luz</Text>
            </View>
            <View style={[thStyle, { width: C.KWH, backgroundColor: PC.section }]}>
              <Text style={{ fontFamily: 'Helvetica-Bold', fontSize: 7, color: PC.white }}>kWh</Text>
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
                <View style={[tdStyle, { width: C.MES, alignItems: 'flex-start', padding: 4 }]}>
                  <Text style={{ fontSize: 7, color: PC.fieldValue }}>{fmtMes(r.mes)}</Text>
                </View>
                <View style={[tdStyle, { width: C.TIPO, alignItems: 'flex-start', padding: 4 }]}>
                  <Text style={{ fontSize: 7, color: PC.fieldValue }}>{r.tipo_combustible ?? '—'}</Text>
                </View>
                <View style={[tdStyle, { width: C.LIT, padding: 4 }]}>
                  <Text style={{ fontSize: 7, color: PC.fieldValue }}>{r.cantidad_litros != null ? String(r.cantidad_litros) : '—'}</Text>
                </View>
                <View style={[tdStyle, { width: C.COST_C, padding: 4 }]}>
                  <Text style={{ fontSize: 7, color: PC.fieldValue }}>{r.costo_combustible != null ? `$${r.costo_combustible}` : '—'}</Text>
                </View>
                <View style={[tdStyle, { width: C.ACT, alignItems: 'flex-start', padding: 4 }]}>
                  <Text style={{ fontSize: 7, color: PC.fieldValue }}>{r.actividad ?? '—'}</Text>
                </View>
                <View style={[tdStyle, { width: C.COST_L, padding: 4 }]}>
                  <Text style={{ fontSize: 7, color: PC.fieldValue }}>{r.luz_costo != null ? `$${r.luz_costo}` : '—'}</Text>
                </View>
                <View style={[tdStyle, { width: C.KWH, padding: 4 }]}>
                  <Text style={{ fontSize: 7, color: PC.fieldValue }}>{r.luz_kwh != null ? String(r.luz_kwh) : '—'}</Text>
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
