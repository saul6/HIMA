import { Document, Page, View, Text } from '@react-pdf/renderer'
import { TopBar, PdfFooter } from '@/lib/pdf/components/PdfPage'
import { PdfHeader } from '@/lib/pdf/components/PdfHeader'
import { PdfSectionBanner } from '@/lib/pdf/components/PdfSectionBanner'
import { PdfFieldGrid, PdfFieldRow, PdfField } from '@/lib/pdf/components/PdfFieldGrid'
import { PdfSignatures } from '@/lib/pdf/components/PdfSignatures'
import { PC } from '@/lib/pdf/components/tokens'
import type { FirmaParaPdf } from '@/hooks/useFirmasRegistro'

export interface M72OrganismoPDF {
  id: string
  tipo: 'plaga' | 'enfermedad'
  nombre: string
}

export interface M72FilaPDF {
  sector: string
  num_planta: number
  conteos: Record<string, number>  // organismo_id → conteo
  comentario?: string | null
}

export interface MonitoreoPlaguasPDFProps {
  rancho: string
  orgNombre?: string | null
  fecha: string
  etapa_fenologica: string | null
  realizo: string | null
  beneficos: string | null
  observaciones: string | null
  organismos: M72OrganismoPDF[]
  filas: M72FilaPDF[]
  firmaRealizo?: FirmaParaPdf | null
  firmaVerifico?: FirmaParaPdf | null
}

const MARGIN = 20
// Portrait A4: 595.28, usable ≈ 555

const COL_SECTOR = 65
const COL_PLANTA = 40
const COL_BENEFICOS = 55
const COL_OBS = 70
const COL_ORG_MIN = 38

function formatFecha(f: string) {
  try {
    return new Date(f + 'T12:00:00').toLocaleDateString('es-MX', { day: '2-digit', month: 'long', year: 'numeric' })
  } catch { return f }
}

function HC({ w, children, right = true, last = false }: { w: number; children?: React.ReactNode; right?: boolean; last?: boolean }) {
  return (
    <View style={{ width: w, minWidth: w, backgroundColor: PC.section, alignItems: 'center', justifyContent: 'center', borderRightWidth: (!right || last) ? 0 : 1, borderRightColor: '#5599CC', padding: '3px 3px' }}>
      <Text style={{ fontSize: 6, fontFamily: 'Helvetica-Bold', color: PC.white, textAlign: 'center' }}>{children ?? ''}</Text>
    </View>
  )
}

function DC({ w, children, bg, right = true }: { w: number; children?: React.ReactNode; bg?: string; right?: boolean }) {
  return (
    <View style={{ width: w, minWidth: w, padding: '3px 3px', backgroundColor: bg ?? PC.white, alignItems: 'center', justifyContent: 'center', borderRightWidth: right ? 1 : 0, borderRightColor: PC.border }}>
      <Text style={{ fontSize: 6.5, color: PC.fieldValue, textAlign: 'center' }}>{children ?? ''}</Text>
    </View>
  )
}

export function MonitoreoPlaguasPagina({
  rancho, orgNombre, fecha, etapa_fenologica, realizo, beneficos, observaciones,
  organismos, filas, firmaRealizo, firmaVerifico,
}: MonitoreoPlaguasPDFProps) {
  const plagas = organismos.filter(o => o.tipo === 'plaga')
  const enfermedades = organismos.filter(o => o.tipo === 'enfermedad')
  const todosOrg = [...plagas, ...enfermedades]

  // Distribute width among organism columns
  const fixedW = COL_SECTOR + COL_PLANTA + COL_BENEFICOS + COL_OBS
  const availableForOrg = 555 - fixedW
  const orgColW = todosOrg.length > 0
    ? Math.max(COL_ORG_MIN, Math.floor(availableForOrg / todosOrg.length))
    : COL_ORG_MIN

  // Totals per organismo
  const totales: Record<string, number> = {}
  for (const org of todosOrg) {
    totales[org.id] = filas.reduce((sum, f) => sum + (f.conteos[org.id] ?? 0), 0)
  }
  const totalPlantas = filas.length

  return (
    <Page size="A4" orientation="portrait" style={{ fontFamily: 'Helvetica', fontSize: 8, padding: MARGIN, paddingBottom: 50, backgroundColor: PC.white }}>
      <PdfFooter moduloCodigo="REG-21" />
      <TopBar />
      <PdfHeader
        titulo="MONITOREO DE PLAGAS Y ENFERMEDADES"
        subtitulo={`REG-21 · Global G.A.P. v6 | ${rancho}`}
        codigoFormato="REG-21"
        folio={fecha}
        fecha={fecha}
      />

      <PdfSectionBanner>Datos generales</PdfSectionBanner>
      <PdfFieldGrid>
        <PdfFieldRow>
          {orgNombre && <PdfField label="Compania" value={orgNombre} />}
          <PdfField label="Rancho" value={rancho} />
          <PdfField label="Fecha" value={formatFecha(fecha)} />
          {etapa_fenologica && <PdfField label="Etapa fenologica" value={etapa_fenologica} />}
        </PdfFieldRow>
      </PdfFieldGrid>

      {/* Tabla */}
      <View style={{ borderWidth: 1, borderColor: PC.border }}>
        {/* Cabecera — grupo Plagas / Enfermedades */}
        {(plagas.length > 0 || enfermedades.length > 0) && (
          <View style={{ flexDirection: 'row' }}>
            <View style={{ width: COL_SECTOR + COL_PLANTA, borderRightWidth: 1, borderRightColor: '#5599CC', backgroundColor: PC.section }} />
            {plagas.length > 0 && (
              <View style={{ width: orgColW * plagas.length, backgroundColor: PC.section, alignItems: 'center', justifyContent: 'center', borderRightWidth: 1, borderRightColor: '#5599CC', padding: '2px 3px' }}>
                <Text style={{ fontSize: 6.5, fontFamily: 'Helvetica-Bold', color: PC.white }}>Plagas</Text>
              </View>
            )}
            {enfermedades.length > 0 && (
              <View style={{ width: orgColW * enfermedades.length, backgroundColor: PC.section, alignItems: 'center', justifyContent: 'center', borderRightWidth: 1, borderRightColor: '#5599CC', padding: '2px 3px' }}>
                <Text style={{ fontSize: 6.5, fontFamily: 'Helvetica-Bold', color: PC.white }}>Enfermedades</Text>
              </View>
            )}
            <View style={{ width: COL_BENEFICOS + COL_OBS, backgroundColor: PC.section }} />
          </View>
        )}
        {/* Cabecera de columnas */}
        <View style={{ flexDirection: 'row', borderTopWidth: plagas.length > 0 || enfermedades.length > 0 ? 1 : 0, borderTopColor: PC.border }}>
          <HC w={COL_SECTOR}>Sector</HC>
          <HC w={COL_PLANTA}># Planta</HC>
          {todosOrg.map(o => (
            <HC key={o.id} w={orgColW}>{o.nombre}</HC>
          ))}
          <HC w={COL_BENEFICOS}>Beneficos</HC>
          <HC w={COL_OBS} last>Observaciones</HC>
        </View>
        {/* Filas de datos */}
        {filas.map((f, i) => {
          const bg = i % 2 === 0 ? PC.white : '#F5F9FE'
          return (
            <View key={i} style={{ flexDirection: 'row', borderTopWidth: 1, borderTopColor: PC.border }}>
              <DC w={COL_SECTOR} bg={bg}>{f.sector}</DC>
              <DC w={COL_PLANTA} bg={bg}>{f.num_planta}</DC>
              {todosOrg.map(o => (
                <DC key={o.id} w={orgColW} bg={bg}>
                  {f.conteos[o.id] ? String(f.conteos[o.id]) : ''}
                </DC>
              ))}
              <DC w={COL_BENEFICOS} bg={bg}>{beneficos ?? ''}</DC>
              <DC w={COL_OBS} bg={bg} right={false}>{f.comentario ?? ''}</DC>
            </View>
          )
        })}
        {/* Fila Total */}
        {filas.length > 0 && (
          <View style={{ flexDirection: 'row', borderTopWidth: 2, borderTopColor: PC.section }}>
            <View style={{ width: COL_SECTOR, backgroundColor: '#EAF2FB', borderRightWidth: 1, borderRightColor: PC.border, padding: '3px 3px', justifyContent: 'center', alignItems: 'center' }}>
              <Text style={{ fontSize: 6.5, fontFamily: 'Helvetica-Bold', color: PC.textSub }}>Total</Text>
            </View>
            <View style={{ width: COL_PLANTA, backgroundColor: '#EAF2FB', borderRightWidth: 1, borderRightColor: PC.border, padding: '3px 3px', justifyContent: 'center', alignItems: 'center' }}>
              <Text style={{ fontSize: 6.5, fontFamily: 'Helvetica-Bold', color: PC.fieldValue }}>{totalPlantas}</Text>
            </View>
            {todosOrg.map(o => (
              <View key={o.id} style={{ width: orgColW, backgroundColor: '#EAF2FB', borderRightWidth: 1, borderRightColor: PC.border, padding: '3px 3px', justifyContent: 'center', alignItems: 'center' }}>
                <Text style={{ fontSize: 6.5, fontFamily: 'Helvetica-Bold', color: PC.fieldValue }}>{totales[o.id] || ''}</Text>
              </View>
            ))}
            <View style={{ width: COL_BENEFICOS + COL_OBS, backgroundColor: '#EAF2FB' }} />
          </View>
        )}
        {/* Fila % incidencia */}
        {filas.length > 0 && (
          <View style={{ flexDirection: 'row', borderTopWidth: 1, borderTopColor: PC.border }}>
            <View style={{ width: COL_SECTOR, backgroundColor: '#EAF2FB', borderRightWidth: 1, borderRightColor: PC.border, padding: '3px 3px', justifyContent: 'center', alignItems: 'center' }}>
              <Text style={{ fontSize: 5.5, fontFamily: 'Helvetica-Bold', color: PC.textSub }}>% Incidencia</Text>
            </View>
            <View style={{ width: COL_PLANTA, backgroundColor: '#EAF2FB', borderRightWidth: 1, borderRightColor: PC.border }} />
            {todosOrg.map(o => {
              const pct = totalPlantas > 0
                ? ((filas.filter(f => (f.conteos[o.id] ?? 0) > 0).length / totalPlantas) * 100).toFixed(1)
                : '0.0'
              return (
                <View key={o.id} style={{ width: orgColW, backgroundColor: '#EAF2FB', borderRightWidth: 1, borderRightColor: PC.border, padding: '3px 3px', justifyContent: 'center', alignItems: 'center' }}>
                  <Text style={{ fontSize: 6, color: PC.fieldValue }}>{pct}%</Text>
                </View>
              )
            })}
            <View style={{ width: COL_BENEFICOS + COL_OBS, backgroundColor: '#EAF2FB' }} />
          </View>
        )}
      </View>

      {observaciones && (
        <PdfFieldGrid>
          <PdfFieldRow>
            <PdfField label="Observaciones" value={observaciones} />
          </PdfFieldRow>
        </PdfFieldGrid>
      )}

      <PdfSignatures
        signatures={[
          { label: '', nombre: realizo ?? '', caption: 'Realizo', firma: firmaRealizo ?? null },
          { label: '', nombre: '', caption: 'Verifico', firma: firmaVerifico ?? null },
        ]}
      />
    </Page>
  )
}

export function MonitoreoPlaguasPDF(props: MonitoreoPlaguasPDFProps) {
  return (
    <Document>
      <MonitoreoPlaguasPagina {...props} />
    </Document>
  )
}

export function MonitoreoPlaguasConsolidadoPDF({ paginas }: { paginas: MonitoreoPlaguasPDFProps[] }) {
  return (
    <Document>
      {paginas.map((p, i) => <MonitoreoPlaguasPagina key={i} {...p} />)}
    </Document>
  )
}
