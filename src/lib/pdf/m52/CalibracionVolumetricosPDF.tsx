import { Document, Page, View, Text } from '@react-pdf/renderer'
import { TopBar, PdfFooter } from '@/lib/pdf/components/PdfPage'
import { PdfHeader } from '@/lib/pdf/components/PdfHeader'
import { PdfSectionBanner } from '@/lib/pdf/components/PdfSectionBanner'
import { PdfFieldGrid, PdfFieldRow, PdfField } from '@/lib/pdf/components/PdfFieldGrid'
import { PdfSignatures } from '@/lib/pdf/components/PdfSignatures'
import { codigoFormato } from '@/lib/codigoFormato'
import { PC } from '@/lib/pdf/components/tokens'

export interface VolumetricoRow {
  fecha: string
  uso_articulo: string
  capacidad: number | null
  unidad: string
  lectura1_ml: number | null
  lectura2_ml: number | null
  lectura3_ml: number | null
  desviacion: number | null
  realizo: string
  observaciones: string | null
}

interface Props {
  rancho: string
  orgNombre?: string | null
  desde: string
  hasta: string
  registros: VolumetricoRow[]
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

function fmtNum(n: number | null, dec = 2): string {
  if (n === null || n === undefined) return '—'
  return Number(n).toFixed(dec)
}

const C = { FECHA: 55, USO: 110, CAP: 65, UNIDAD: 60, L1: 62, L2: 62, L3: 62, DESV: 62 }

export function CalibracionVolumetricosPDF({
  rancho,
  orgNombre,
  desde,
  hasta,
  registros,
  codigoClave,
  terminoSitio = 'Sitio',
}: Props) {
  const periodo = desde === hasta ? fmtFecha(desde) : `${fmtFecha(desde)} - ${fmtFecha(hasta)}`
  const codigoFmt = codigoFormato('REG-06', codigoClave)

  return (
    <Document>
      <Page
        size="A4"
        orientation="landscape"
        style={{ fontFamily: 'Helvetica', fontSize: 7, padding: MARGIN, paddingBottom: 50, backgroundColor: PC.white }}
      >
        <PdfFooter moduloCodigo="M52" />
        <TopBar />
        <PdfHeader
          titulo="CALIBRACIÓN DE VOLUMÉTRICOS"
          subtitulo={`Calibración de volumétricos | ${rancho}`}
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
              { key: 'USO', label: 'Uso / Artículo', w: C.USO },
              { key: 'CAP', label: 'Capacidad', w: C.CAP },
              { key: 'UNIDAD', label: 'Unidad', w: C.UNIDAD },
              { key: 'L1', label: 'Lectura 1 (ml)', w: C.L1 },
              { key: 'L2', label: 'Lectura 2 (ml)', w: C.L2 },
              { key: 'L3', label: 'Lectura 3 (ml)', w: C.L3 },
              { key: 'DESV', label: 'Desviación', w: C.DESV, last: true },
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
                <View style={[tdStyle, { width: C.USO, alignItems: 'flex-start' }]}>
                  <Text style={{ fontSize: 7, color: PC.fieldValue }}>{r.uso_articulo}</Text>
                </View>
                <View style={[tdStyle, { width: C.CAP }]}>
                  <Text style={{ fontSize: 7, color: PC.fieldValue }}>{fmtNum(r.capacidad, 2)}</Text>
                </View>
                <View style={[tdStyle, { width: C.UNIDAD, alignItems: 'flex-start' }]}>
                  <Text style={{ fontSize: 7, color: PC.fieldValue }}>{r.unidad}</Text>
                </View>
                <View style={[tdStyle, { width: C.L1 }]}>
                  <Text style={{ fontSize: 7, color: PC.fieldValue }}>{fmtNum(r.lectura1_ml, 1)}</Text>
                </View>
                <View style={[tdStyle, { width: C.L2 }]}>
                  <Text style={{ fontSize: 7, color: PC.fieldValue }}>{fmtNum(r.lectura2_ml, 1)}</Text>
                </View>
                <View style={[tdStyle, { width: C.L3 }]}>
                  <Text style={{ fontSize: 7, color: PC.fieldValue }}>{fmtNum(r.lectura3_ml, 1)}</Text>
                </View>
                <View style={[tdStyle, { width: C.DESV, borderRightWidth: 0 }]}>
                  <Text style={{ fontSize: 7, color: PC.fieldValue }}>{fmtNum(r.desviacion, 2)}</Text>
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
