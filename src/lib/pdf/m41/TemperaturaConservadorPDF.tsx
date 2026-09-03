import { Document, Page, View, Text } from '@react-pdf/renderer'
import { TopBar, PdfFooter } from '@/lib/pdf/components/PdfPage'
import { PdfHeader } from '@/lib/pdf/components/PdfHeader'
import { PdfSectionBanner } from '@/lib/pdf/components/PdfSectionBanner'
import { PdfFieldGrid, PdfFieldRow, PdfField } from '@/lib/pdf/components/PdfFieldGrid'
import { PdfSignatures } from '@/lib/pdf/components/PdfSignatures'
import { codigoFormato } from '@/lib/codigoFormato'
import { PC } from '@/lib/pdf/components/tokens'

export interface M41LecturaPDF {
  hora: number
  temperatura: number | null
}

export interface M41RegistroDataPDF {
  orgNombre: string
  instalacion: string
  fecha: string
  temp_min: number | null
  temp_max: number | null
  observaciones: string | null
  lecturas: M41LecturaPDF[]
}

const MARGIN = 14

function fmtFecha(iso: string): string {
  try {
    const [y, m, d] = iso.split('-')
    return `${d}/${m}/${y}`
  } catch { return iso }
}

const t = (v: number | null | undefined): string => v != null ? String(v) : ''

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

const HORAS = Array.from({ length: 24 }, (_, i) => i + 1)
const LABEL_W = 48

export function TemperaturaConservadorPDF({ d, codigoClave, terminoSitio = 'Instalación' }: { d: M41RegistroDataPDF; codigoClave: string; terminoSitio?: string }) {
  const lecturaPorHora: Record<number, number | null> = {}
  for (const l of d.lecturas) lecturaPorHora[l.hora] = l.temperatura

  const rangoMin = d.temp_min != null ? `${d.temp_min} C` : '—'
  const rangoMax = d.temp_max != null ? `${d.temp_max} C` : '—'
  const codigoFmt = codigoFormato('F-FRUS-PRO-05', codigoClave)
  const fechaLabel = fmtFecha(d.fecha)

  return (
    <Document>
      <Page
        size="A4"
        orientation="landscape"
        style={{ fontFamily: 'Helvetica', fontSize: 7, paddingHorizontal: MARGIN, paddingTop: MARGIN, paddingBottom: 50, backgroundColor: PC.white }}
      >
        <PdfFooter moduloCodigo="M41" />
        <TopBar />
        <PdfHeader
          titulo="REGISTRO DE TEMPERATURAS DEL CONSERVADOR"
          subtitulo={`Temperaturas | ${d.instalacion} | ${fechaLabel}`}
          codigoFormato={codigoFmt}
          folio={fechaLabel}
          fecha={fechaLabel}
        />

        <PdfSectionBanner>1. Datos del sitio</PdfSectionBanner>
        <PdfFieldGrid>
          <PdfFieldRow>
            <PdfField label={terminoSitio} value={d.instalacion} />
            <PdfField label="Fecha" value={fechaLabel} />
            <PdfField label="Temp. minima" value={rangoMin} />
            <PdfField label="Temp. maxima" value={rangoMax} />
          </PdfFieldRow>
        </PdfFieldGrid>

        <PdfSectionBanner>2. Lecturas de temperatura</PdfSectionBanner>

        <Text style={{ fontSize: 6.5, color: PC.textSub, marginTop: 4, marginBottom: 4, fontStyle: 'italic' }}>
          Instruccion: revisar temperatura al iniciar turno y cada 2 horas.
        </Text>

        {/* Tabla 24 horas */}
        <View style={{ borderWidth: 1, borderColor: PC.border }}>
          {/* Header row: horas */}
          <View style={{ flexDirection: 'row', backgroundColor: PC.section }}>
            <View style={[thStyle, { width: LABEL_W, backgroundColor: PC.section, alignItems: 'flex-start' }]}>
              <Text style={{ fontFamily: 'Helvetica-Bold', fontSize: 6.5, color: PC.white }}>Hora</Text>
            </View>
            {HORAS.map(h => (
              <View key={h} style={[thStyle, { flex: 1, backgroundColor: PC.section }]}>
                <Text style={{ fontFamily: 'Helvetica-Bold', fontSize: 6, color: PC.white }}>
                  {String(h).padStart(2, '0')}:00
                </Text>
              </View>
            ))}
          </View>

          {/* Data row: temperaturas */}
          <View style={{ flexDirection: 'row', backgroundColor: PC.white }}>
            <View style={[tdStyle, { width: LABEL_W, alignItems: 'flex-start', padding: 3, borderBottomWidth: 0 }]}>
              <Text style={{ fontFamily: 'Helvetica-Bold', fontSize: 6.5, color: PC.fieldValue }}>Temp. (C)</Text>
            </View>
            {HORAS.map(h => (
              <View key={h} style={[tdStyle, { flex: 1, borderBottomWidth: 0 }]}>
                <Text style={{ fontSize: 6.5, color: PC.fieldValue }}>{t(lecturaPorHora[h])}</Text>
              </View>
            ))}
          </View>
        </View>

        {/* Observaciones */}
        {d.observaciones ? (
          <View style={{ marginTop: 10, borderWidth: 1, borderColor: PC.border, padding: 6 }}>
            <Text style={{ fontSize: 7, fontFamily: 'Helvetica-Bold', color: PC.fieldValue, marginBottom: 3 }}>Observaciones</Text>
            <Text style={{ fontSize: 7, color: PC.fieldValue }}>{d.observaciones}</Text>
          </View>
        ) : null}

        <PdfSignatures
          signatures={[
            { label: '', nombre: '', caption: 'Responsable de la instalacion' },
            { label: '', nombre: '', caption: 'Responsable de la empresa' },
          ]}
        />
      </Page>
    </Document>
  )
}
