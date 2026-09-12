import { Document, Page, View, Text } from '@react-pdf/renderer'
import { TopBar, PdfFooter } from '@/lib/pdf/components/PdfPage'
import { PdfHeader } from '@/lib/pdf/components/PdfHeader'
import { PdfSectionBanner } from '@/lib/pdf/components/PdfSectionBanner'
import { PdfFieldGrid, PdfFieldRow, PdfField } from '@/lib/pdf/components/PdfFieldGrid'
import { PdfSignatures } from '@/lib/pdf/components/PdfSignatures'
import { codigoFormato } from '@/lib/codigoFormato'
import { PC } from '@/lib/pdf/components/tokens'

export interface EquipoRow {
  fecha: string
  num_equipo: string
  velocidad_kmh: number | null
  presion_trabajo_bar: number | null
  boquilla: string
  gasto_boquilla_ml: number | null
  resultado: string | null
  realizo: string
  observaciones: string | null
}

interface Props {
  rancho: string
  orgNombre?: string | null
  desde: string
  hasta: string
  registros: EquipoRow[]
  codigoClave: string
  terminoSitio?: string
}

const MARGIN = 20
const ROW_ALT = '#F5F9FE'

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

function fmtFecha(iso: string): string {
  try {
    const [y, m, d] = iso.split('-')
    return `${d}/${m}/${y}`
  } catch { return iso }
}

function fmtNum(n: number | null, dec = 1): string {
  if (n === null || n === undefined) return '—'
  return Number(n).toFixed(dec)
}

const C = { FECHA: 55, NUM: 80, VEL: 72, PRES: 72, BOQUILLA: 100, GASTO: 72, RESULT: 95 }

export function CalibracionEquiposPDF({
  rancho,
  orgNombre,
  desde,
  hasta,
  registros,
  codigoClave,
  terminoSitio = 'Sitio',
}: Props) {
  const periodo = desde === hasta ? fmtFecha(desde) : `${fmtFecha(desde)} - ${fmtFecha(hasta)}`
  const codigoFmt = codigoFormato('REG-ASIP-09', codigoClave)

  return (
    <Document>
      <Page
        size="A4"
        orientation="landscape"
        style={{ fontFamily: 'Helvetica', fontSize: 7, padding: MARGIN, paddingBottom: 50, backgroundColor: PC.white }}
      >
        <PdfFooter moduloCodigo="M50" />
        <TopBar />
        <PdfHeader
          titulo="CALIBRACIÓN DE EQUIPOS DE APLICACIÓN"
          subtitulo={`Calibración de equipos | ${rancho}`}
          codigoFormato={codigoFmt}
          folio={periodo}
          fecha={periodo}
        />

        <PdfSectionBanner>1. Datos del sitio</PdfSectionBanner>
        <PdfFieldGrid>
          <PdfFieldRow>
            <PdfField label={terminoSitio} value={rancho} />
            {orgNombre && <PdfField label="Organización" value={orgNombre} />}
            <PdfField label="Periodo" value={periodo} />
          </PdfFieldRow>
        </PdfFieldGrid>

        <PdfSectionBanner>2. Registros de calibración</PdfSectionBanner>

        <View style={{ marginTop: 4, borderWidth: 1, borderColor: PC.border }}>
          <View style={{ flexDirection: 'row', backgroundColor: PC.section }}>
            {[
              { key: 'FECHA', label: 'Fecha', w: C.FECHA },
              { key: 'NUM', label: 'N° Equipo', w: C.NUM },
              { key: 'VEL', label: 'Vel. (km/h)', w: C.VEL },
              { key: 'PRES', label: 'Pres. trabajo (bar)', w: C.PRES },
              { key: 'BOQUILLA', label: 'Boquilla', w: C.BOQUILLA },
              { key: 'GASTO', label: 'Gasto boquilla (ml)', w: C.GASTO },
              { key: 'RESULT', label: 'Resultado', w: C.RESULT, last: true },
            ].map(col => (
              <View
                key={col.key}
                style={[thStyle, { width: col.w, backgroundColor: PC.section, alignItems: 'flex-start', borderRightWidth: col.last ? 0 : 1 }]}
              >
                <Text style={{ fontFamily: 'Helvetica-Bold', fontSize: 7, color: PC.white }}>{col.label}</Text>
              </View>
            ))}
          </View>

          {registros.map((r, i) => {
            const bg = i % 2 === 1 ? ROW_ALT : PC.white
            return (
              <View key={i} style={{ flexDirection: 'row', backgroundColor: bg }}>
                <View style={[tdStyle, { width: C.FECHA, alignItems: 'flex-start' }]}>
                  <Text style={{ fontSize: 7, color: PC.fieldValue }}>{fmtFecha(r.fecha)}</Text>
                </View>
                <View style={[tdStyle, { width: C.NUM, alignItems: 'flex-start' }]}>
                  <Text style={{ fontSize: 7, color: PC.fieldValue }}>{r.num_equipo}</Text>
                </View>
                <View style={[tdStyle, { width: C.VEL }]}>
                  <Text style={{ fontSize: 7, color: PC.fieldValue }}>{fmtNum(r.velocidad_kmh, 1)}</Text>
                </View>
                <View style={[tdStyle, { width: C.PRES }]}>
                  <Text style={{ fontSize: 7, color: PC.fieldValue }}>{fmtNum(r.presion_trabajo_bar, 2)}</Text>
                </View>
                <View style={[tdStyle, { width: C.BOQUILLA, alignItems: 'flex-start' }]}>
                  <Text style={{ fontSize: 7, color: PC.fieldValue }}>{r.boquilla}</Text>
                </View>
                <View style={[tdStyle, { width: C.GASTO }]}>
                  <Text style={{ fontSize: 7, color: PC.fieldValue }}>{fmtNum(r.gasto_boquilla_ml, 1)}</Text>
                </View>
                <View style={[tdStyle, { width: C.RESULT, alignItems: 'flex-start', borderRightWidth: 0 }]}>
                  <Text style={{ fontSize: 7, color: PC.fieldValue }}>{r.resultado ?? '—'}</Text>
                </View>
              </View>
            )
          })}
        </View>

        {registros[0]?.realizo && (
          <View style={{ marginTop: 6 }}>
            <Text style={{ fontSize: 7, color: PC.fieldLabel }}>Realizó: <Text style={{ color: PC.fieldValue }}>{registros[0].realizo}</Text></Text>
          </View>
        )}
        {registros[0]?.observaciones && (
          <View style={{ marginTop: 4 }}>
            <Text style={{ fontSize: 7, color: PC.fieldLabel }}>Observaciones: <Text style={{ color: PC.fieldValue }}>{registros[0].observaciones}</Text></Text>
          </View>
        )}

        <PdfSignatures
          signatures={[{ label: '', nombre: '', caption: 'Verifico: Responsable técnico' }]}
        />
      </Page>
    </Document>
  )
}
