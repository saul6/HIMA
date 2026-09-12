import { Document, Page, View, Text } from '@react-pdf/renderer'
import { TopBar, PdfFooter } from '@/lib/pdf/components/PdfPage'
import { PdfHeader } from '@/lib/pdf/components/PdfHeader'
import { PdfSectionBanner } from '@/lib/pdf/components/PdfSectionBanner'
import { PdfFieldGrid, PdfFieldRow, PdfField } from '@/lib/pdf/components/PdfFieldGrid'
import { PdfSignatures } from '@/lib/pdf/components/PdfSignatures'
import { codigoFormato } from '@/lib/codigoFormato'
import { PC } from '@/lib/pdf/components/tokens'

export interface BombaRow {
  fecha: string
  equipo: string
  num_equipo: string
  cultivo: string
  parcela: string
  distancia_m: number | null
  velocidad_kmh: number | null
  presion_bar: number | null
  volumen_recolectado_ml: number | null
  gasto_l: number | null
  resultado: string | null
  realizo: string
  observaciones: string | null
}

interface Props {
  rancho: string
  orgNombre?: string | null
  desde: string
  hasta: string
  registros: BombaRow[]
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

const C = {
  FECHA: 52,
  EQUIPO: 72,
  NUM: 58,
  CULTIVO: 65,
  PARCELA: 65,
  DIST: 52,
  VEL: 52,
  PRES: 52,
  VOL: 58,
  GASTO: 52,
  RESULT: 72,
}

export function CalibracionBombasPDF({
  rancho,
  orgNombre,
  desde,
  hasta,
  registros,
  codigoClave,
  terminoSitio = 'Sitio',
}: Props) {
  const periodo = desde === hasta ? fmtFecha(desde) : `${fmtFecha(desde)} - ${fmtFecha(hasta)}`
  const codigoFmt = codigoFormato('REG-07', codigoClave)

  return (
    <Document>
      <Page
        size="A4"
        orientation="landscape"
        style={{ fontFamily: 'Helvetica', fontSize: 7, padding: MARGIN, paddingBottom: 50, backgroundColor: PC.white }}
      >
        <PdfFooter moduloCodigo="M49" />
        <TopBar />
        <PdfHeader
          titulo="CALIBRACIÓN DE BOMBAS DE APLICACIÓN"
          subtitulo={`Calibración de bombas | ${rancho}`}
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
              { key: 'EQUIPO', label: 'Equipo', w: C.EQUIPO },
              { key: 'NUM', label: 'N° Equipo', w: C.NUM },
              { key: 'CULTIVO', label: 'Cultivo', w: C.CULTIVO },
              { key: 'PARCELA', label: 'Parcela', w: C.PARCELA },
              { key: 'DIST', label: 'Dist. (m)', w: C.DIST },
              { key: 'VEL', label: 'Vel. km/h', w: C.VEL },
              { key: 'PRES', label: 'Pres. bar', w: C.PRES },
              { key: 'VOL', label: 'Vol. ml', w: C.VOL },
              { key: 'GASTO', label: 'Gasto L', w: C.GASTO },
              { key: 'RESULT', label: 'Resultado', w: C.RESULT, last: true },
            ].map(col => (
              <View
                key={col.key}
                style={[thStyle, { width: col.w, backgroundColor: PC.section, alignItems: 'flex-start', borderRightWidth: col.last ? 0 : 1 }]}
              >
                <Text style={{ fontFamily: 'Helvetica-Bold', fontSize: 6.5, color: PC.white }}>{col.label}</Text>
              </View>
            ))}
          </View>

          {registros.map((r, i) => {
            const bg = i % 2 === 1 ? ROW_ALT : PC.white
            return (
              <View key={i} style={{ flexDirection: 'row', backgroundColor: bg }}>
                <View style={[tdStyle, { width: C.FECHA, alignItems: 'flex-start' }]}>
                  <Text style={{ fontSize: 6.5, color: PC.fieldValue }}>{fmtFecha(r.fecha)}</Text>
                </View>
                <View style={[tdStyle, { width: C.EQUIPO, alignItems: 'flex-start' }]}>
                  <Text style={{ fontSize: 6.5, color: PC.fieldValue }}>{r.equipo}</Text>
                </View>
                <View style={[tdStyle, { width: C.NUM, alignItems: 'flex-start' }]}>
                  <Text style={{ fontSize: 6.5, color: PC.fieldValue }}>{r.num_equipo}</Text>
                </View>
                <View style={[tdStyle, { width: C.CULTIVO, alignItems: 'flex-start' }]}>
                  <Text style={{ fontSize: 6.5, color: PC.fieldValue }}>{r.cultivo}</Text>
                </View>
                <View style={[tdStyle, { width: C.PARCELA, alignItems: 'flex-start' }]}>
                  <Text style={{ fontSize: 6.5, color: PC.fieldValue }}>{r.parcela}</Text>
                </View>
                <View style={[tdStyle, { width: C.DIST }]}>
                  <Text style={{ fontSize: 6.5, color: PC.fieldValue }}>{fmtNum(r.distancia_m, 1)}</Text>
                </View>
                <View style={[tdStyle, { width: C.VEL }]}>
                  <Text style={{ fontSize: 6.5, color: PC.fieldValue }}>{fmtNum(r.velocidad_kmh, 1)}</Text>
                </View>
                <View style={[tdStyle, { width: C.PRES }]}>
                  <Text style={{ fontSize: 6.5, color: PC.fieldValue }}>{fmtNum(r.presion_bar, 2)}</Text>
                </View>
                <View style={[tdStyle, { width: C.VOL }]}>
                  <Text style={{ fontSize: 6.5, color: PC.fieldValue }}>{fmtNum(r.volumen_recolectado_ml, 1)}</Text>
                </View>
                <View style={[tdStyle, { width: C.GASTO }]}>
                  <Text style={{ fontSize: 6.5, color: PC.fieldValue }}>{fmtNum(r.gasto_l, 2)}</Text>
                </View>
                <View style={[tdStyle, { width: C.RESULT, alignItems: 'flex-start', borderRightWidth: 0 }]}>
                  <Text style={{ fontSize: 6.5, color: PC.fieldValue }}>{r.resultado ?? '—'}</Text>
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
