import { Document, Page, View, Text } from '@react-pdf/renderer'
import { TopBar, PdfFooter } from '@/lib/pdf/components/PdfPage'
import { PdfHeader } from '@/lib/pdf/components/PdfHeader'
import { PdfSectionBanner } from '@/lib/pdf/components/PdfSectionBanner'
import { PdfSignatures } from '@/lib/pdf/components/PdfSignatures'
import { codigoFormato } from '@/lib/codigoFormato'
import { PC } from '@/lib/pdf/components/tokens'

export interface M42MovimientoPDF {
  orgNombre: string
  instalacion: string
  empresa: string | null
  fecha: string
  descripcion_material: string | null
  entrada: number | null
  salida: number | null
  total: number | null
  entrega: string | null
  recibe: string | null
  mat_integro: boolean
  mat_buen_estado: boolean
  mat_limpio: boolean
  mat_libre_olores: boolean
  mat_libre_plagas: boolean
  mat_otros: string | null
  tr_integro: boolean
  tr_buen_estado: boolean
  tr_limpio: boolean
  tr_libre_olores: boolean
  tr_libre_plagas: boolean
  tr_otros: string | null
  observaciones: string | null
}

function fmtFecha(iso: string): string {
  try {
    const [y, m, d] = iso.split('-')
    return `${d}/${m}/${y}`
  } catch { return iso }
}

const sn = (v: boolean) => v ? 'Si' : 'No'
const nn = (v: number | null | undefined) => v != null ? String(v) : '—'

const MARGIN = 20

const thStyle = {
  padding: 3,
  borderRightWidth: 1,
  borderRightColor: '#5599CC',
  borderBottomWidth: 1,
  borderBottomColor: '#5599CC',
  justifyContent: 'center' as const,
  alignItems: 'center' as const,
  fontFamily: 'Helvetica-Bold',
  fontSize: 6.5,
  backgroundColor: PC.section,
  color: PC.white,
} as const

const tdStyle = {
  borderRightWidth: 1,
  borderRightColor: PC.border,
  borderBottomWidth: 1,
  borderBottomColor: PC.border,
  padding: 3,
  fontSize: 7,
  color: PC.fieldValue,
} as const

function ChecklistBlock({ d, tipo }: { d: M42MovimientoPDF; tipo: 'mat' | 'tr' }) {
  const integro = tipo === 'mat' ? d.mat_integro    : d.tr_integro
  const buen    = tipo === 'mat' ? d.mat_buen_estado : d.tr_buen_estado
  const limpio  = tipo === 'mat' ? d.mat_limpio     : d.tr_limpio
  const olores  = tipo === 'mat' ? d.mat_libre_olores : d.tr_libre_olores
  const plagas  = tipo === 'mat' ? d.mat_libre_plagas : d.tr_libre_plagas
  const otros   = tipo === 'mat' ? d.mat_otros      : d.tr_otros
  const titulo  = tipo === 'mat' ? 'Condicion del material' : 'Condicion del transporte'

  return (
    <View style={{
      flex: 1,
      borderWidth: 1,
      borderColor: PC.border,
      padding: 6,
    }}>
      <Text style={{ fontSize: 7.5, fontFamily: 'Helvetica-Bold', color: PC.titleNavy, marginBottom: 4 }}>
        {titulo}
      </Text>
      {([
        ['Integro', integro],
        ['En buen estado', buen],
        ['Limpio', limpio],
        ['Libre de malos olores', olores],
        ['Libre de plagas', plagas],
      ] as [string, boolean][]).map(([label, val]) => (
        <View key={label} style={{ flexDirection: 'row', marginBottom: 2 }}>
          <Text style={{ fontSize: 7, color: PC.textSub, width: 110 }}>{label}:</Text>
          <Text style={{
            fontSize: 7,
            fontFamily: 'Helvetica-Bold',
            color: val ? PC.section : '#C02A2A',
          }}>
            {sn(val)}
          </Text>
        </View>
      ))}
      {otros ? (
        <View style={{ marginTop: 3 }}>
          <Text style={{ fontSize: 6.5, color: PC.textSub }}>Otros: {otros}</Text>
        </View>
      ) : null}
    </View>
  )
}

export function MaterialEmpaquePDF({ d, codigoClave }: { d: M42MovimientoPDF; codigoClave: string }) {
  const codigoFmt = codigoFormato('F-FRUS-PRO-03', codigoClave)

  return (
    <Document>
      <Page
        size="A4"
        orientation="landscape"
        style={{
          fontFamily: 'Helvetica',
          fontSize: 7.5,
          padding: MARGIN,
          paddingBottom: 50,
          backgroundColor: PC.white,
        }}
      >
        <PdfFooter moduloCodigo="M42" />
        <TopBar />
        <PdfHeader
          titulo="ENTRADAS Y SALIDAS DE MATERIAL DE EMPAQUE"
          subtitulo={`${d.instalacion}${d.empresa ? ` | ${d.empresa}` : ''} | ${fmtFecha(d.fecha)}`}
          codigoFormato={codigoFmt}
          fecha={d.fecha}
        />

        {/* Datos del movimiento */}
        <PdfSectionBanner>Datos del movimiento</PdfSectionBanner>
        <View style={{ borderTopWidth: 1, borderTopColor: PC.section, borderLeftWidth: 1, borderLeftColor: PC.section, marginBottom: 8 }}>
          <View style={{ flexDirection: 'row' }}>
            <Text style={[thStyle, { width: 90 }]}>Descripcion del material</Text>
            <Text style={[thStyle, { width: 45 }]}>Entrada</Text>
            <Text style={[thStyle, { width: 45 }]}>Salida</Text>
            <Text style={[thStyle, { width: 45 }]}>Total</Text>
            <Text style={[thStyle, { flex: 1 }]}>Entrega</Text>
            <Text style={[thStyle, { flex: 1, borderRightWidth: 0 }]}>Recibe</Text>
          </View>
          <View style={{ flexDirection: 'row' }}>
            <Text style={[tdStyle, { width: 90 }]}>{d.descripcion_material ?? '—'}</Text>
            <Text style={[tdStyle, { width: 45, textAlign: 'center' }]}>{nn(d.entrada)}</Text>
            <Text style={[tdStyle, { width: 45, textAlign: 'center' }]}>{nn(d.salida)}</Text>
            <Text style={[tdStyle, { width: 45, textAlign: 'center' }]}>{nn(d.total)}</Text>
            <Text style={[tdStyle, { flex: 1 }]}>{d.entrega ?? '—'}</Text>
            <Text style={[tdStyle, { flex: 1, borderRightWidth: 0 }]}>{d.recibe ?? '—'}</Text>
          </View>
        </View>

        {/* Checklists condiciones */}
        <View style={{ flexDirection: 'row', gap: 16, marginBottom: 8 }}>
          <ChecklistBlock d={d} tipo="mat" />
          <ChecklistBlock d={d} tipo="tr" />
        </View>

        {/* Observaciones */}
        {d.observaciones ? (
          <View style={{ marginBottom: 8 }}>
            <Text style={{ fontSize: 7, fontFamily: 'Helvetica-Bold', color: PC.titleNavy, marginBottom: 2 }}>
              Observaciones
            </Text>
            <Text style={{ fontSize: 7.5, color: PC.fieldValue }}>{d.observaciones}</Text>
          </View>
        ) : null}

        {/* Firmas */}
        <PdfSignatures
          signatures={[
            { label: 'Responsable de la instalacion' },
            { label: 'Responsable de la empresa' },
          ]}
        />

      </Page>
    </Document>
  )
}
