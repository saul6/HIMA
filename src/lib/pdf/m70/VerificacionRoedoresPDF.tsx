import { Document, Page, View, Text } from '@react-pdf/renderer'
import { TopBar, PdfFooter } from '@/lib/pdf/components/PdfPage'
import { PdfHeader } from '@/lib/pdf/components/PdfHeader'
import { PdfSectionBanner } from '@/lib/pdf/components/PdfSectionBanner'
import { PdfFieldGrid, PdfFieldRow, PdfField } from '@/lib/pdf/components/PdfFieldGrid'
import { PdfSignatures } from '@/lib/pdf/components/PdfSignatures'
import { PC } from '@/lib/pdf/components/tokens'
import type { FirmaParaPdf } from '@/hooks/useFirmasRegistro'

export interface VerificacionRoedorFilaPDF {
  id: string
  fecha: string
  num_trampa: string
  roedor: boolean
  insectos: boolean
  otros: boolean
  cambio: boolean
  verifico: string | null
  observaciones: string | null
}

export interface VerificacionRoedoresPDFProps {
  rancho: string
  orgNombre?: string | null
  filas: VerificacionRoedorFilaPDF[]
  firmaRealizo?: FirmaParaPdf | null
  firmaVerifico?: FirmaParaPdf | null
}

const MARGIN = 20

// Column widths (landscape A4 = 841.89, usable ≈ 801)
const COL = {
  fecha: 65,
  trampa: 75,
  boolW: 36,    // each Sí/No sub-column
  verifico: 160,
  obs: 160,
}
// 4 bool pairs: (roedor, insectos, otros, cambio) × 2 sub-cols each = 8 × 36 = 288
// Fixed total: 65 + 75 + 288 + 160 + 160 = 748

function formatFecha(f: string) {
  try {
    return new Date(f + 'T12:00:00').toLocaleDateString('es-MX', { day: '2-digit', month: 'short', year: 'numeric' })
  } catch { return f }
}

const BOOL_GROUPS: { key: keyof VerificacionRoedorFilaPDF; label: string }[] = [
  { key: 'roedor', label: 'Roedor' },
  { key: 'insectos', label: 'Insectos' },
  { key: 'otros', label: 'Otros' },
  { key: 'cambio', label: 'Cambio' },
]

function HCGroup({ label }: { label: string }) {
  const w = COL.boolW * 2
  return (
    <View style={{ width: w, backgroundColor: PC.section, alignItems: 'center', justifyContent: 'center', borderRightWidth: 1, borderRightColor: '#5599CC', padding: '3px 2px' }}>
      <Text style={{ fontSize: 6.5, fontFamily: 'Helvetica-Bold', color: PC.white }}>{label}</Text>
    </View>
  )
}

function HC({ w, children, right = true }: { w: number; children?: React.ReactNode; right?: boolean }) {
  return (
    <View style={{ width: w, minWidth: w, backgroundColor: PC.section, alignItems: 'center', justifyContent: 'center', borderRightWidth: right ? 1 : 0, borderRightColor: '#5599CC', padding: '3px 4px' }}>
      <Text style={{ fontSize: 6.5, fontFamily: 'Helvetica-Bold', color: PC.white, textAlign: 'center' }}>{children ?? ''}</Text>
    </View>
  )
}

function SubHC({ label }: { label: string }) {
  return (
    <View style={{ width: COL.boolW, backgroundColor: '#EAF2FB', alignItems: 'center', justifyContent: 'center', borderRightWidth: 1, borderRightColor: PC.border, padding: '2px 2px' }}>
      <Text style={{ fontSize: 6, color: PC.textSub }}>{label}</Text>
    </View>
  )
}

function BoolCell({ val, bg }: { val: boolean; bg: string }) {
  return (
    <View style={{ width: COL.boolW, minWidth: COL.boolW, backgroundColor: bg, alignItems: 'center', justifyContent: 'center', borderRightWidth: 1, borderRightColor: PC.border, padding: '3px 2px' }}>
      <Text style={{ fontSize: 7, color: PC.fieldValue, fontFamily: 'Helvetica-Bold' }}>{val ? 'X' : ''}</Text>
    </View>
  )
}

function DC({ w, children, bg, right = true }: { w: number; children?: React.ReactNode; bg?: string; right?: boolean }) {
  return (
    <View style={{ width: w, minWidth: w, padding: '3px 4px', backgroundColor: bg ?? PC.white, alignItems: 'center', justifyContent: 'center', borderRightWidth: right ? 1 : 0, borderRightColor: PC.border }}>
      <Text style={{ fontSize: 7, color: PC.fieldValue, textAlign: 'center' }}>{children ?? ''}</Text>
    </View>
  )
}

function TablaRoedores({ filas }: { filas: VerificacionRoedorFilaPDF[] }) {
  return (
    <View style={{ borderWidth: 1, borderColor: PC.border }}>
      {/* Fila cabecera 1 */}
      <View style={{ flexDirection: 'row' }}>
        <HC w={COL.fecha}>Fecha</HC>
        <HC w={COL.trampa}># Trampa</HC>
        {BOOL_GROUPS.map(g => <HCGroup key={g.key as string} label={g.label} />)}
        <HC w={COL.verifico}>Verifico</HC>
        <HC w={COL.obs} right={false}>Observaciones</HC>
      </View>
      {/* Fila sub-cabecera Si/No */}
      <View style={{ flexDirection: 'row', borderTopWidth: 1, borderTopColor: PC.border }}>
        <View style={{ width: COL.fecha + COL.trampa, borderRightWidth: 1, borderRightColor: PC.border, backgroundColor: '#EAF2FB' }} />
        {BOOL_GROUPS.map(g => (
          <View key={g.key as string} style={{ flexDirection: 'row', borderRightWidth: 1, borderRightColor: PC.border }}>
            <SubHC label="Si" />
            <SubHC label="No" />
          </View>
        ))}
        <View style={{ width: COL.verifico + COL.obs, backgroundColor: '#EAF2FB' }} />
      </View>
      {/* Filas de datos */}
      {filas.map((f, i) => {
        const bg = i % 2 === 0 ? PC.white : '#F5F9FE'
        return (
          <View key={f.id} style={{ flexDirection: 'row', borderTopWidth: 1, borderTopColor: PC.border }}>
            <DC w={COL.fecha} bg={bg}>{formatFecha(f.fecha)}</DC>
            <DC w={COL.trampa} bg={bg}>{f.num_trampa}</DC>
            {BOOL_GROUPS.map(g => {
              const val = f[g.key] as boolean
              return (
                <View key={g.key as string} style={{ flexDirection: 'row', borderRightWidth: 1, borderRightColor: PC.border }}>
                  <BoolCell val={val} bg={bg} />
                  <BoolCell val={!val} bg={bg} />
                </View>
              )
            })}
            <DC w={COL.verifico} bg={bg}>{f.verifico ?? ''}</DC>
            <DC w={COL.obs} bg={bg} right={false}>{f.observaciones ?? ''}</DC>
          </View>
        )
      })}
    </View>
  )
}

export function VerificacionRoedoresPagina({ rancho, orgNombre, filas, firmaRealizo, firmaVerifico }: VerificacionRoedoresPDFProps) {
  const folio = filas[0]?.fecha ?? '—'

  return (
    <Page size="A4" orientation="landscape" style={{ fontFamily: 'Helvetica', fontSize: 8, padding: MARGIN, paddingBottom: 50, backgroundColor: PC.white }}>
      <PdfFooter moduloCodigo="REG-24" />
      <TopBar />
      <PdfHeader
        titulo="VERIFICACIÓN DE TRAMPAS PARA ROEDORES"
        subtitulo={`REG-24 · Global G.A.P. v6 | ${rancho}`}
        codigoFormato="REG-24"
        folio={folio}
        fecha={folio}
      />

      <PdfSectionBanner>Datos generales</PdfSectionBanner>
      <PdfFieldGrid>
        <PdfFieldRow>
          {orgNombre && <PdfField label="Compania" value={orgNombre} />}
          <PdfField label="Rancho" value={rancho} />
        </PdfFieldRow>
      </PdfFieldGrid>

      <TablaRoedores filas={filas} />

      <View style={{ marginTop: 4 }}>
        <Text style={{ fontSize: 6, color: PC.textSub, fontStyle: 'italic' }}>
          El formato debe llenarse en cada verificacion y este formato debe mantenerse en cada trampa muestreada.
        </Text>
      </View>

      <PdfSignatures
        signatures={[
          { label: '', nombre: '', caption: 'Nombre y firma de quien realiza', firma: firmaRealizo ?? null },
          { label: '', nombre: '', caption: 'Nombre y firma de quien verifica', firma: firmaVerifico ?? null },
        ]}
      />
    </Page>
  )
}

export function VerificacionRoedoresPDF(props: VerificacionRoedoresPDFProps) {
  return (
    <Document>
      <VerificacionRoedoresPagina {...props} />
    </Document>
  )
}

export function VerificacionRoedoresConsolidadoPDF({ filas, orgNombre }: {
  filas: VerificacionRoedorFilaPDF[]
  rancho: string
  orgNombre?: string | null
}) {
  const ranchoMap = new Map<string, { nombre: string; filas: VerificacionRoedorFilaPDF[] }>()
  for (const f of filas) {
    const key = (f as any).rancho ?? '—'
    if (!ranchoMap.has(key)) ranchoMap.set(key, { nombre: key, filas: [] })
    ranchoMap.get(key)!.filas.push(f)
  }
  return (
    <Document>
      {[...ranchoMap.values()].map(({ nombre, filas: rf }) => (
        <VerificacionRoedoresPagina
          key={nombre}
          rancho={nombre}
          orgNombre={orgNombre}
          filas={rf}
        />
      ))}
    </Document>
  )
}
