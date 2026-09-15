import { Document, Page, View, Text } from '@react-pdf/renderer'
import { TopBar, PdfFooter } from '@/lib/pdf/components/PdfPage'
import { PdfHeader } from '@/lib/pdf/components/PdfHeader'
import { PdfSectionBanner } from '@/lib/pdf/components/PdfSectionBanner'
import { PdfFieldGrid, PdfFieldRow, PdfField } from '@/lib/pdf/components/PdfFieldGrid'
import { PdfSignatures } from '@/lib/pdf/components/PdfSignatures'
import { PC } from '@/lib/pdf/components/tokens'

export interface FertilizacionGGRow {
  fecha: string
  cultivo: string
  bloque: string | null
  superficie_ha: number | null
  producto: string
  fabricante: string | null
  formula: string | null
  cantidad_total: number | null
  unidad: string | null
  cantidad_ha: string | null
  maquinaria: string | null
  metodo_aplicacion: string | null
  operario: string | null
  observaciones: string | null
}

interface Props {
  rancho: string
  orgNombre?: string | null
  desde: string
  hasta: string
  registros: FertilizacionGGRow[]
  terminoSitio?: string
}

const MARGIN = 20
const ROW_ALT = '#F5F9FE'

function fmtFecha(iso: string): string {
  try {
    const [y, m, d] = iso.split('-')
    return `${d}/${m}/${y}`
  } catch { return iso }
}

// Anchos de columna — suma 792pt (A4 landscape 841 − 2×20 márgenes = ~802pt disponibles)
const C = {
  FECHA:    48,
  CULTIVO:  58,
  BLOQUE:   56,
  HA:       30,
  PRODUCTO: 85,
  FABRIC:   63,
  FORMULA:  64,
  CANT:     44,
  UNIDAD:   44,
  CANT_HA:  56,
  MAQUINA:  56,
  METODO:   71,
  OPERARIO: 56,
  OBS:      61,
} as const

const thStyle = {
  padding: 3,
  borderRightWidth: 1,
  borderRightColor: '#5599CC',
  borderBottomWidth: 1,
  borderBottomColor: '#5599CC',
  justifyContent: 'center' as const,
  alignItems: 'flex-start' as const,
}

const tdStyle = {
  borderRightWidth: 1,
  borderRightColor: PC.border,
  borderBottomWidth: 1,
  borderBottomColor: PC.border,
  justifyContent: 'center' as const,
  alignItems: 'flex-start' as const,
  padding: 3,
}

const TH_TEXT = { fontFamily: 'Helvetica-Bold' as const, fontSize: 6, color: PC.white }
const TD_TEXT = { fontSize: 6.5, color: PC.fieldValue }

export function FertilizacionGGPDF({ rancho, orgNombre, desde, hasta, registros, terminoSitio = 'Rancho' }: Props) {
  const periodo = desde === hasta ? fmtFecha(desde) : `${fmtFecha(desde)} - ${fmtFecha(hasta)}`

  return (
    <Document>
      <Page
        size="A4"
        orientation="landscape"
        style={{ fontFamily: 'Helvetica', fontSize: 7, padding: MARGIN, paddingBottom: 50, backgroundColor: PC.white }}
      >
        <PdfFooter moduloCodigo="M67" />
        <TopBar />
        <PdfHeader
          titulo="APLICACION DE FERTILIZANTES"
          subtitulo={`REG-18 · GlobalG.A.P. v6 | ${rancho}`}
          codigoFormato="REG-18"
          folio={periodo}
          fecha={periodo}
        />

        <PdfSectionBanner>1. Datos del sitio</PdfSectionBanner>
        <PdfFieldGrid>
          <PdfFieldRow>
            <PdfField label="Compania" value={orgNombre ?? '—'} />
            <PdfField label={terminoSitio} value={rancho} />
            <PdfField label="Periodo" value={periodo} />
          </PdfFieldRow>
        </PdfFieldGrid>

        <PdfSectionBanner>2. Registros de aplicacion de fertilizantes</PdfSectionBanner>

        <View style={{ marginTop: 4, borderWidth: 1, borderColor: PC.border }}>
          {/* Encabezado de tabla */}
          <View style={{ flexDirection: 'row', backgroundColor: PC.section }}>
            <View style={[thStyle, { width: C.FECHA }]}><Text style={TH_TEXT}>Fecha</Text></View>
            <View style={[thStyle, { width: C.CULTIVO }]}><Text style={TH_TEXT}>Cultivo</Text></View>
            <View style={[thStyle, { width: C.BLOQUE }]}><Text style={TH_TEXT}>Bloque/Sector</Text></View>
            <View style={[thStyle, { width: C.HA }]}><Text style={TH_TEXT}>Ha</Text></View>
            <View style={[thStyle, { width: C.PRODUCTO }]}><Text style={TH_TEXT}>Nombre comercial</Text></View>
            <View style={[thStyle, { width: C.FABRIC }]}><Text style={TH_TEXT}>Fabricante</Text></View>
            <View style={[thStyle, { width: C.FORMULA }]}><Text style={TH_TEXT}>Formula fertilizante</Text></View>
            <View style={[thStyle, { width: C.CANT }]}><Text style={TH_TEXT}>Cant. total</Text></View>
            <View style={[thStyle, { width: C.UNIDAD }]}><Text style={TH_TEXT}>Unidades</Text></View>
            <View style={[thStyle, { width: C.CANT_HA }]}><Text style={TH_TEXT}>Cant/ha</Text></View>
            <View style={[thStyle, { width: C.MAQUINA }]}><Text style={TH_TEXT}>Maquinaria</Text></View>
            <View style={[thStyle, { width: C.METODO }]}><Text style={TH_TEXT}>Metodo aplicacion</Text></View>
            <View style={[thStyle, { width: C.OPERARIO }]}><Text style={TH_TEXT}>Operario</Text></View>
            <View style={[thStyle, { width: C.OBS, borderRightWidth: 0 }]}><Text style={TH_TEXT}>Observaciones</Text></View>
          </View>

          {/* Filas de datos */}
          {registros.map((r, i) => {
            const bg = i % 2 === 1 ? ROW_ALT : PC.white
            return (
              <View key={i} style={{ flexDirection: 'row', backgroundColor: bg }}>
                <View style={[tdStyle, { width: C.FECHA }]}><Text style={TD_TEXT}>{fmtFecha(r.fecha)}</Text></View>
                <View style={[tdStyle, { width: C.CULTIVO }]}><Text style={TD_TEXT}>{r.cultivo}</Text></View>
                <View style={[tdStyle, { width: C.BLOQUE }]}><Text style={TD_TEXT}>{r.bloque ?? '—'}</Text></View>
                <View style={[tdStyle, { width: C.HA }]}><Text style={TD_TEXT}>{r.superficie_ha != null ? String(r.superficie_ha) : '—'}</Text></View>
                <View style={[tdStyle, { width: C.PRODUCTO }]}><Text style={TD_TEXT}>{r.producto}</Text></View>
                <View style={[tdStyle, { width: C.FABRIC }]}><Text style={TD_TEXT}>{r.fabricante ?? '—'}</Text></View>
                <View style={[tdStyle, { width: C.FORMULA }]}><Text style={TD_TEXT}>{r.formula ?? '—'}</Text></View>
                <View style={[tdStyle, { width: C.CANT }]}><Text style={TD_TEXT}>{r.cantidad_total != null ? String(r.cantidad_total) : '—'}</Text></View>
                <View style={[tdStyle, { width: C.UNIDAD }]}><Text style={TD_TEXT}>{r.unidad ?? '—'}</Text></View>
                <View style={[tdStyle, { width: C.CANT_HA }]}><Text style={TD_TEXT}>{r.cantidad_ha ?? '—'}</Text></View>
                <View style={[tdStyle, { width: C.MAQUINA }]}><Text style={TD_TEXT}>{r.maquinaria ?? '—'}</Text></View>
                <View style={[tdStyle, { width: C.METODO }]}><Text style={TD_TEXT}>{r.metodo_aplicacion ?? '—'}</Text></View>
                <View style={[tdStyle, { width: C.OPERARIO }]}><Text style={TD_TEXT}>{r.operario ?? '—'}</Text></View>
                <View style={[tdStyle, { width: C.OBS, borderRightWidth: 0 }]}><Text style={TD_TEXT}>{r.observaciones ?? '—'}</Text></View>
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
