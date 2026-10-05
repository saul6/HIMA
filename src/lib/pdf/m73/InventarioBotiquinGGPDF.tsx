import { Document, Page, View, Text } from '@react-pdf/renderer'
import { TopBar, PdfFooter } from '@/lib/pdf/components/PdfPage'
import { PdfHeader } from '@/lib/pdf/components/PdfHeader'
import { PdfSectionBanner } from '@/lib/pdf/components/PdfSectionBanner'
import { PdfFieldGrid, PdfFieldRow, PdfField } from '@/lib/pdf/components/PdfFieldGrid'
import { PdfSignatures } from '@/lib/pdf/components/PdfSignatures'
import { PC } from '@/lib/pdf/components/tokens'
import type { FirmaParaPdf } from '@/hooks/useFirmasRegistro'

export interface M73MaterialFilaPDF {
  nombre: string
  sale: number | null
  entra: number | null
  total: number | null
  usuario: string | null
}

export interface InventarioBotiquinGGPDFProps {
  rancho: string
  orgNombre?: string | null
  fecha: string
  botiquin_num: string | null
  realizo: string | null
  observaciones: string | null
  materiales: M73MaterialFilaPDF[]
  firmaRealizo?: FirmaParaPdf | null
}

const MARGIN = 20

// Portrait A4 usable width ≈ 555 pt
const COL = {
  nombre: 210,
  sale: 75,
  entra: 75,
  total: 75,
  usuario: 120,
}

function fmt(n: number | null): string {
  if (n === null || n === undefined) return '—'
  return String(n)
}

function HC({ w, children, right = true }: { w: number; children?: React.ReactNode; right?: boolean }) {
  return (
    <View style={{ width: w, minWidth: w, backgroundColor: PC.section, alignItems: 'center', justifyContent: 'center', borderRightWidth: right ? 1 : 0, borderRightColor: '#5599CC', padding: '3px 4px' }}>
      <Text style={{ fontSize: 7, fontFamily: 'Helvetica-Bold', color: PC.white, textAlign: 'center' }}>{children ?? ''}</Text>
    </View>
  )
}

function DC({ w, children, bg, right = true, left = false }: { w: number; children?: React.ReactNode; bg?: string; right?: boolean; left?: boolean }) {
  return (
    <View style={{ width: w, minWidth: w, padding: '3px 4px', backgroundColor: bg ?? PC.white, borderRightWidth: right ? 1 : 0, borderRightColor: PC.border, alignItems: left ? 'flex-start' : 'center' }}>
      <Text style={{ fontSize: 7.5, color: PC.fieldValue, textAlign: left ? 'left' : 'center' }}>{children ?? ''}</Text>
    </View>
  )
}

function TablaMateriales({ materiales }: { materiales: M73MaterialFilaPDF[] }) {
  return (
    <View style={{ borderWidth: 1, borderColor: PC.border }}>
      <View style={{ flexDirection: 'row' }}>
        <HC w={COL.nombre} left>Material</HC>
        <HC w={COL.sale}>Sale</HC>
        <HC w={COL.entra}>Entra</HC>
        <HC w={COL.total}>Total</HC>
        <HC w={COL.usuario} right={false}>Usuario</HC>
      </View>
      {materiales.map((m, i) => {
        const bg = i % 2 === 0 ? PC.white : '#F5F9FE'
        return (
          <View key={i} style={{ flexDirection: 'row', borderTopWidth: 1, borderTopColor: PC.border }}>
            <DC w={COL.nombre} bg={bg} left>{m.nombre}</DC>
            <DC w={COL.sale} bg={bg}>{fmt(m.sale)}</DC>
            <DC w={COL.entra} bg={bg}>{fmt(m.entra)}</DC>
            <DC w={COL.total} bg={bg}>{fmt(m.total)}</DC>
            <DC w={COL.usuario} bg={bg} right={false} left>{m.usuario ?? ''}</DC>
          </View>
        )
      })}
      {materiales.length === 0 && (
        <View style={{ flexDirection: 'row', borderTopWidth: 1, borderTopColor: PC.border }}>
          <View style={{ flex: 1, padding: '6px 4px', alignItems: 'center' }}>
            <Text style={{ fontSize: 7.5, color: PC.textSub, fontStyle: 'italic' }}>Sin materiales registrados</Text>
          </View>
        </View>
      )}
    </View>
  )
}

export function InventarioBotiquinGGPagina({ rancho, orgNombre, fecha, botiquin_num, realizo, observaciones, materiales, firmaRealizo }: InventarioBotiquinGGPDFProps) {
  const folio = fecha

  function formatFecha(iso: string) {
    try { return new Date(iso + 'T12:00:00').toLocaleDateString('es-MX', { day: 'numeric', month: 'long', year: 'numeric' }) }
    catch { return iso }
  }

  return (
    <Page size="A4" style={{ fontFamily: 'Helvetica', fontSize: 8, padding: MARGIN, paddingBottom: 50, backgroundColor: PC.white }}>
      <PdfFooter moduloCodigo="M73-GG" />
      <TopBar />
      <PdfHeader
        titulo="INVENTARIO DE MATERIAL DE CURACION — BOTIQUIN"
        subtitulo={`GlobalGAP | ${rancho}`}
        codigoFormato="M73-GG"
        folio={folio}
        fecha={fecha}
      />

      <PdfSectionBanner>Datos generales</PdfSectionBanner>
      <PdfFieldGrid>
        <PdfFieldRow>
          {orgNombre && <PdfField label="Empresa" value={orgNombre} />}
          <PdfField label="Rancho / instalacion" value={rancho} />
          <PdfField label="Fecha" value={formatFecha(fecha)} />
        </PdfFieldRow>
        <PdfFieldRow>
          <PdfField label="N. Botiquin" value={botiquin_num ?? '—'} />
          <PdfField label="Realizo" value={realizo ?? '—'} />
        </PdfFieldRow>
      </PdfFieldGrid>

      <PdfSectionBanner>Registro de materiales</PdfSectionBanner>
      <TablaMateriales materiales={materiales} />

      {observaciones && (
        <View style={{ marginTop: 6 }}>
          <Text style={{ fontSize: 7, color: PC.textSub, fontFamily: 'Helvetica-Bold' }}>Observaciones:</Text>
          <Text style={{ fontSize: 7.5, color: PC.fieldValue, marginTop: 2 }}>{observaciones}</Text>
        </View>
      )}

      <PdfSignatures
        signatures={[
          { label: '', nombre: '', caption: 'Nombre y firma de quien realiza', firma: firmaRealizo ?? null },
        ]}
      />
    </Page>
  )
}

export function InventarioBotiquinGGPDF(props: InventarioBotiquinGGPDFProps) {
  return (
    <Document>
      <InventarioBotiquinGGPagina {...props} />
    </Document>
  )
}

export interface M73ResumenFilaPDF {
  id: string
  rancho: string
  fecha: string
  botiquin_num: string | null
  realizo: string | null
  total_materiales: number
  observaciones: string | null
}

export function InventarioBotiquinGGConsolidadoPDF({ filas, orgNombre }: {
  filas: M73ResumenFilaPDF[]
  orgNombre?: string | null
}) {
  const COL2 = { fecha: 65, rancho: 110, botiquin: 65, realizo: 100, total: 55, obs: 160 }

  function formatFecha(iso: string) {
    try { return new Date(iso + 'T12:00:00').toLocaleDateString('es-MX', { day: '2-digit', month: 'short', year: 'numeric' }) }
    catch { return iso }
  }

  return (
    <Document>
      <Page size="A4" style={{ fontFamily: 'Helvetica', fontSize: 8, padding: MARGIN, paddingBottom: 50, backgroundColor: PC.white }}>
        <PdfFooter moduloCodigo="M73-GG" />
        <TopBar />
        <PdfHeader
          titulo="INVENTARIO DE MATERIAL DE CURACION — CONSOLIDADO"
          subtitulo={orgNombre ? `GlobalGAP | ${orgNombre}` : 'GlobalGAP'}
          codigoFormato="M73-GG"
          folio="Consolidado"
          fecha={filas[0]?.fecha ?? ''}
        />

        <View style={{ borderWidth: 1, borderColor: PC.border, marginTop: 8 }}>
          <View style={{ flexDirection: 'row' }}>
            {[['Fecha', COL2.fecha], ['Rancho', COL2.rancho], ['N. Botiquin', COL2.botiquin], ['Realizo', COL2.realizo], ['# Materiales', COL2.total], ['Observaciones', COL2.obs]].map(([label, w], i, arr) => (
              <View key={label as string} style={{ width: w as number, minWidth: w as number, backgroundColor: PC.section, alignItems: 'center', justifyContent: 'center', borderRightWidth: i < arr.length - 1 ? 1 : 0, borderRightColor: '#5599CC', padding: '3px 4px' }}>
                <Text style={{ fontSize: 6.5, fontFamily: 'Helvetica-Bold', color: PC.white, textAlign: 'center' }}>{label as string}</Text>
              </View>
            ))}
          </View>
          {filas.map((f, i) => {
            const bg = i % 2 === 0 ? PC.white : '#F5F9FE'
            return (
              <View key={f.id} style={{ flexDirection: 'row', borderTopWidth: 1, borderTopColor: PC.border }}>
                <View style={{ width: COL2.fecha, padding: '3px 4px', backgroundColor: bg, alignItems: 'center', justifyContent: 'center', borderRightWidth: 1, borderRightColor: PC.border }}>
                  <Text style={{ fontSize: 7, color: PC.fieldValue, textAlign: 'center' }}>{formatFecha(f.fecha)}</Text>
                </View>
                <View style={{ width: COL2.rancho, padding: '3px 4px', backgroundColor: bg, justifyContent: 'center', borderRightWidth: 1, borderRightColor: PC.border }}>
                  <Text style={{ fontSize: 7, color: PC.fieldValue }}>{f.rancho}</Text>
                </View>
                <View style={{ width: COL2.botiquin, padding: '3px 4px', backgroundColor: bg, alignItems: 'center', justifyContent: 'center', borderRightWidth: 1, borderRightColor: PC.border }}>
                  <Text style={{ fontSize: 7, color: PC.fieldValue }}>{f.botiquin_num ?? '—'}</Text>
                </View>
                <View style={{ width: COL2.realizo, padding: '3px 4px', backgroundColor: bg, justifyContent: 'center', borderRightWidth: 1, borderRightColor: PC.border }}>
                  <Text style={{ fontSize: 7, color: PC.fieldValue }}>{f.realizo ?? '—'}</Text>
                </View>
                <View style={{ width: COL2.total, padding: '3px 4px', backgroundColor: bg, alignItems: 'center', justifyContent: 'center', borderRightWidth: 1, borderRightColor: PC.border }}>
                  <Text style={{ fontSize: 7, color: PC.fieldValue }}>{String(f.total_materiales)}</Text>
                </View>
                <View style={{ width: COL2.obs, padding: '3px 4px', backgroundColor: bg, justifyContent: 'center' }}>
                  <Text style={{ fontSize: 7, color: PC.fieldValue }}>{f.observaciones ?? ''}</Text>
                </View>
              </View>
            )
          })}
        </View>
      </Page>
    </Document>
  )
}
