import { Document, Page, View, Text } from '@react-pdf/renderer'
import { TopBar, PdfFooter } from '@/lib/pdf/components/PdfPage'
import { PdfHeader } from '@/lib/pdf/components/PdfHeader'
import { PdfSectionBanner } from '@/lib/pdf/components/PdfSectionBanner'
import { PdfFieldGrid, PdfFieldRow, PdfField } from '@/lib/pdf/components/PdfFieldGrid'
import { PdfSignatures } from '@/lib/pdf/components/PdfSignatures'
import { PC } from '@/lib/pdf/components/tokens'
import type { FirmaParaPdf } from '@/hooks/useFirmasRegistro'

export interface GermicidaGGFilaPDF {
  id: string
  rancho: string
  fecha: string
  producto: string | null
  material_utilizado: string | null
  sector: string | null
  hora1: string | null
  ppm1: number | null
  ajuste1: string | null
  hora2: string | null
  ppm2: number | null
  ajuste2: string | null
  hora3: string | null
  ppm3: number | null
  ajuste3: string | null
  realizo: string | null
  observaciones: string | null
}

export interface GermicidaGGPDFProps {
  rancho: string
  orgNombre?: string | null
  filas: GermicidaGGFilaPDF[]
  firmaRealizo?: FirmaParaPdf | null
  firmaVerifico?: FirmaParaPdf | null
}

const MARGIN = 20

const COL = {
  fecha: 55,
  mat: 115,
  sector: 80,
  hora: 40,
  ppm: 40,
  ajuste: 40,
  realizo: 80,
  obs: 110,
}

function formatFecha(f: string) {
  try {
    return new Date(f + 'T12:00:00').toLocaleDateString('es-MX', { day: '2-digit', month: 'short', year: 'numeric' })
  } catch { return f }
}

function HC({ w, children, right = true }: { w: number; children?: React.ReactNode; right?: boolean }) {
  return (
    <View style={{ width: w, minWidth: w, padding: '3px 4px', backgroundColor: PC.section, justifyContent: 'center', alignItems: 'center', borderRightWidth: right ? 1 : 0, borderRightColor: '#5599CC' }}>
      <Text style={{ fontSize: 6.5, fontFamily: 'Helvetica-Bold', color: PC.white, textAlign: 'center' }}>{children ?? ''}</Text>
    </View>
  )
}

function DC({ w, children, bg, right = true }: { w: number; children?: React.ReactNode; bg?: string; right?: boolean }) {
  return (
    <View style={{ width: w, minWidth: w, padding: '3px 4px', backgroundColor: bg ?? PC.white, borderRightWidth: right ? 1 : 0, borderRightColor: PC.border }}>
      <Text style={{ fontSize: 7, color: PC.fieldValue }}>{children ?? ''}</Text>
    </View>
  )
}

function TablaGermicida({ filas }: { filas: GermicidaGGFilaPDF[] }) {
  const tomaW = COL.hora + COL.ppm + COL.ajuste

  return (
    <View style={{ borderWidth: 1, borderColor: PC.border }}>
      {/* Cabecera principal */}
      <View style={{ flexDirection: 'row' }}>
        <HC w={COL.fecha}>Fecha</HC>
        <HC w={COL.mat}>Material utilizado</HC>
        <HC w={COL.sector}>Sector</HC>
        {[1, 2, 3].map((n) => (
          <View key={n} style={{ width: tomaW, backgroundColor: PC.section, justifyContent: 'center', alignItems: 'center', borderRightWidth: 1, borderRightColor: '#5599CC', padding: '3px 4px' }}>
            <Text style={{ fontSize: 6.5, fontFamily: 'Helvetica-Bold', color: PC.white }}>Hora de monitoreo {n}</Text>
          </View>
        ))}
        <HC w={COL.realizo}>Realizo</HC>
        <HC w={COL.obs} right={false}>Observaciones</HC>
      </View>
      {/* Sub-cabecera hora/ppm/ajuste */}
      <View style={{ flexDirection: 'row', borderTopWidth: 1, borderTopColor: PC.border }}>
        <View style={{ width: COL.fecha + COL.mat + COL.sector, borderRightWidth: 1, borderRightColor: PC.border, backgroundColor: '#EAF2FB' }} />
        {[1, 2, 3].map((n) => (
          <View key={n} style={{ width: tomaW, flexDirection: 'row', borderRightWidth: 1, borderRightColor: PC.border }}>
            <View style={{ width: COL.hora, borderRightWidth: 1, borderRightColor: PC.border, backgroundColor: '#EAF2FB', padding: '2px 3px', alignItems: 'center' }}>
              <Text style={{ fontSize: 6, color: PC.textSub }}>Hora</Text>
            </View>
            <View style={{ width: COL.ppm, borderRightWidth: 1, borderRightColor: PC.border, backgroundColor: '#EAF2FB', padding: '2px 3px', alignItems: 'center' }}>
              <Text style={{ fontSize: 6, color: PC.textSub }}>ppm</Text>
            </View>
            <View style={{ width: COL.ajuste, backgroundColor: '#EAF2FB', padding: '2px 3px', alignItems: 'center' }}>
              <Text style={{ fontSize: 6, color: PC.textSub }}>Ajuste</Text>
            </View>
          </View>
        ))}
        <View style={{ width: COL.realizo + COL.obs, backgroundColor: '#EAF2FB' }} />
      </View>
      {/* Filas de datos */}
      {filas.map((f, i) => {
        const bg = i % 2 === 0 ? PC.white : '#F5F9FE'
        return (
          <View key={f.id} style={{ flexDirection: 'row', borderTopWidth: 1, borderTopColor: PC.border }}>
            <DC w={COL.fecha} bg={bg}>{formatFecha(f.fecha)}</DC>
            <DC w={COL.mat} bg={bg}>{f.material_utilizado ?? ''}</DC>
            <DC w={COL.sector} bg={bg}>{f.sector ?? ''}</DC>
            <DC w={COL.hora} bg={bg}>{f.hora1 ?? ''}</DC>
            <DC w={COL.ppm} bg={bg}>{f.ppm1 !== null ? String(f.ppm1) : ''}</DC>
            <DC w={COL.ajuste} bg={bg}>{f.ajuste1 ?? ''}</DC>
            <DC w={COL.hora} bg={bg}>{f.hora2 ?? ''}</DC>
            <DC w={COL.ppm} bg={bg}>{f.ppm2 !== null ? String(f.ppm2) : ''}</DC>
            <DC w={COL.ajuste} bg={bg}>{f.ajuste2 ?? ''}</DC>
            <DC w={COL.hora} bg={bg}>{f.hora3 ?? ''}</DC>
            <DC w={COL.ppm} bg={bg}>{f.ppm3 !== null ? String(f.ppm3) : ''}</DC>
            <DC w={COL.ajuste} bg={bg}>{f.ajuste3 ?? ''}</DC>
            <DC w={COL.realizo} bg={bg}>{f.realizo ?? ''}</DC>
            <DC w={COL.obs} bg={bg} right={false}>{f.observaciones ?? ''}</DC>
          </View>
        )
      })}
    </View>
  )
}

export function GermicidaGGPagina({ rancho, orgNombre, filas, firmaRealizo, firmaVerifico }: GermicidaGGPDFProps) {
  const folio = filas[0]?.fecha ?? '—'
  const producto = filas[0]?.producto ?? null

  return (
    <Page size="A4" orientation="landscape" style={{ fontFamily: 'Helvetica', fontSize: 8, padding: MARGIN, paddingBottom: 50, backgroundColor: PC.white }}>
      <PdfFooter moduloCodigo="REG-10.1" />
      <TopBar />
      <PdfHeader
        titulo="MONITOREO DE SOLUCIÓN GERMICIDA"
        subtitulo={`REG-10.1 · Global G.A.P. v6 | ${rancho}`}
        codigoFormato="REG-10.1"
        folio={folio}
        fecha={folio}
      />

      <PdfSectionBanner>Datos generales</PdfSectionBanner>
      <PdfFieldGrid>
        <PdfFieldRow>
          {orgNombre && <PdfField label="Compania" value={orgNombre} />}
          <PdfField label="Rancho" value={rancho} />
          {producto && <PdfField label="Producto" value={producto} />}
        </PdfFieldRow>
      </PdfFieldGrid>

      <View style={{ marginBottom: 4 }}>
        <Text style={{ fontSize: 6, color: PC.textSub, fontStyle: 'italic' }}>
          Se debe llevar la verificacion de la sanitizacion diariamente y/o cada que haya cosecha, especificando la hora de monitoreo y las ppm (Lavado de manos 1.5-3.0 ppm / Agua de desinfeccion de herramienta, cubetas 100-200 ppm).
        </Text>
      </View>

      <TablaGermicida filas={filas} />

      <PdfSignatures
        signatures={[
          { label: '', nombre: filas[0]?.realizo ?? '', caption: 'Nombre y firma de quien realiza', firma: firmaRealizo ?? null },
          { label: '', nombre: '', caption: 'Nombre y firma de quien verifica', firma: firmaVerifico ?? null },
        ]}
      />
    </Page>
  )
}

export function GermicidaGGPDF(props: GermicidaGGPDFProps) {
  return (
    <Document>
      <GermicidaGGPagina {...props} />
    </Document>
  )
}

export function GermicidaGGConsolidadoPDF({ filas, orgNombre }: {
  filas: GermicidaGGFilaPDF[]
  orgNombre?: string | null
}) {
  const ranchos = [...new Set(filas.map(f => f.rancho))]
  return (
    <Document>
      {ranchos.map(r => (
        <GermicidaGGPagina
          key={r}
          rancho={r}
          orgNombre={orgNombre}
          filas={filas.filter(f => f.rancho === r)}
        />
      ))}
    </Document>
  )
}
