// PATRÓN INOCUIDAD — PDF M43 (plantilla homogénea M.A.D.Y)
// Inspección de Almacén de Material de Empaque — A4 landscape, matriz mensual.
// TopBar + PdfHeader + PdfSectionBanner + matriz inline (C/NC/N/A) + franja acciones + PdfFooter.

import { Document, Page, View, Text } from '@react-pdf/renderer'
import { TopBar, PdfFooter } from '@/lib/pdf/components/PdfPage'
import { PdfHeader } from '@/lib/pdf/components/PdfHeader'
import { PdfSectionBanner } from '@/lib/pdf/components/PdfSectionBanner'
import { PdfFieldGrid, PdfFieldRow, PdfField } from '@/lib/pdf/components/PdfFieldGrid'
import { PdfSignatures } from '@/lib/pdf/components/PdfSignatures'
import { codigoFormato } from '@/lib/codigoFormato'
import { PC } from '@/lib/pdf/components/tokens'

// ── Tipos ─────────────────────────────────────────────────────────────────────

export interface M43PuntoPDFRow {
  id: string
  orden: number
  texto: string
}

export interface InspeccionAlmacenEmpaquePaginaProps {
  instalacion: string
  instalacionCodigo: string
  mesLabel: string
  mesDate: string
  realizadoPor: string | null
  verifica: string | null
  autoriza: string | null
  observaciones: string | null
  puntos: M43PuntoPDFRow[]
  diasInspeccionados: number[]
  matriz: Record<number, Record<string, string>>
  accionesTomadas: Record<number, string>
  codigoClave: string
  terminoSitio?: string
}

export interface InspeccionAlmacenEmpaqueConsolidadoPDFProps {
  paginas: InspeccionAlmacenEmpaquePaginaProps[]
  instalacionNombre: string
  desde: string
  hasta: string
}

// ── Constantes ────────────────────────────────────────────────────────────────

const C_COLOR  = '#2E7D32'
const NC_COLOR = '#C02A2A'
const NA_COLOR = '#717182'
const ROW_ALT  = '#F5F9FE'
const MARGIN   = 20
const PAGE_W   = 841.89 - MARGIN * 2
const PUNTO_COL = 165

// ── Helpers ───────────────────────────────────────────────────────────────────

function dayColW(numDias: number): number {
  return Math.floor((PAGE_W - PUNTO_COL) / Math.max(numDias, 1))
}

function diasDelMes(mesDate: string): number[] {
  const d = new Date(mesDate + 'T12:00:00')
  const total = new Date(d.getFullYear(), d.getMonth() + 1, 0).getDate()
  return Array.from({ length: total }, (_, i) => i + 1)
}

function valorLabel(val: string): string {
  if (val === 'cumple')    return 'C'
  if (val === 'no_cumple') return 'NC'
  return 'N/A'
}

function valorColor(val: string): string {
  if (val === 'cumple')    return C_COLOR
  if (val === 'no_cumple') return NC_COLOR
  return NA_COLOR
}

// ── Estilos de celda inline ───────────────────────────────────────────────────

const thStyle = { padding: 3, borderRightWidth: 1, borderRightColor: '#5599CC', borderBottomWidth: 1, borderBottomColor: '#5599CC', justifyContent: 'center', alignItems: 'center' } as const
const tdStyle = { borderRightWidth: 1, borderRightColor: PC.border, borderBottomWidth: 1, borderBottomColor: PC.border, padding: 3 } as const

// ── InspeccionAlmacenEmpaquePagina ────────────────────────────────────────────

export function InspeccionAlmacenEmpaquePagina({
  instalacion, instalacionCodigo, mesLabel, mesDate,
  realizadoPor, verifica, autoriza, observaciones,
  puntos, diasInspeccionados, matriz, accionesTomadas,
  codigoClave, terminoSitio = 'Instalación',
}: InspeccionAlmacenEmpaquePaginaProps) {
  const emision  = new Date().toLocaleDateString('es-MX')
  const codigoFmt = codigoFormato('F-FRUS-PRO-08', codigoClave)
  const todosLosDias    = diasDelMes(mesDate)
  const dW              = dayColW(todosLosDias.length)
  const inspeccionadosSet = new Set(diasInspeccionados)

  const accionesEntries = (Object.entries(accionesTomadas) as [string, string][])
    .map(([k, v]) => [Number(k), v] as [number, string])
    .filter(([, v]) => v?.trim())
    .sort(([a], [b]) => a - b)

  const firmas = [
    { label: '', nombre: '', caption: realizadoPor ? `Realizado por: ${realizadoPor}` : 'Realizado por' },
    { label: '', nombre: '', caption: verifica ? `Verifica: ${verifica}` : 'Verifica: Responsable del Almacen' },
    ...(autoriza ? [{ label: '', nombre: '', caption: `Autoriza: ${autoriza}` }] : []),
  ]

  return (
    <Page
      size="A4"
      orientation="landscape"
      style={{ fontFamily: 'Helvetica', fontSize: 7, padding: MARGIN, paddingBottom: 50, backgroundColor: PC.white }}
    >
      <PdfFooter moduloCodigo="M43" />
      <TopBar />

      <PdfHeader
        titulo="INSPECCION DE ALMACEN DE MATERIAL DE EMPAQUE"
        subtitulo={`Inspeccion mensual | ${instalacion}`}
        codigoFormato={codigoFmt}
        folio={mesLabel}
        fecha={emision}
      />

      <PdfSectionBanner>1. Datos del sitio y mes</PdfSectionBanner>
      <PdfFieldGrid>
        <PdfFieldRow>
          <PdfField label={terminoSitio} value={instalacion} />
          <PdfField label="Codigo" value={instalacionCodigo || '—'} />
          <PdfField label="Mes / Año" value={mesLabel} />
          <PdfField label="Realizado por" value={realizadoPor ?? '—'} />
          <PdfField label="Verifica" value={verifica ?? '—'} />
          {autoriza ? <PdfField label="Autoriza" value={autoriza} /> : null}
        </PdfFieldRow>
      </PdfFieldGrid>

      <PdfSectionBanner>2. Puntos de inspeccion</PdfSectionBanner>

      {/* Matriz mensual */}
      <View style={{ borderLeftWidth: 1, borderLeftColor: PC.border, borderTopWidth: 1, borderTopColor: PC.border, marginTop: 4 }}>
        {/* Encabezado */}
        <View style={{ flexDirection: 'row' }}>
          <View style={[thStyle, { width: PUNTO_COL, backgroundColor: PC.section }]}>
            <Text style={{ fontFamily: 'Helvetica-Bold', fontSize: 6.5, textAlign: 'center', color: PC.white }}>
              Punto de inspeccion
            </Text>
          </View>
          {todosLosDias.map((d) => (
            <View key={d} style={[thStyle, { width: dW, backgroundColor: PC.section }]}>
              <Text style={{ fontFamily: 'Helvetica-Bold', fontSize: 6.5, textAlign: 'center', color: PC.white }}>{d}</Text>
            </View>
          ))}
        </View>

        {/* Filas — un punto por fila */}
        {puntos.map((punto, idx) => {
          const bg = idx % 2 === 1 ? ROW_ALT : PC.white
          return (
            <View key={punto.id} style={{ flexDirection: 'row', backgroundColor: bg }}>
              <View style={{ width: PUNTO_COL, padding: 3, borderRightWidth: 1, borderRightColor: PC.border, borderBottomWidth: 1, borderBottomColor: PC.border, justifyContent: 'center', backgroundColor: bg }}>
                <Text style={{ fontSize: 5.5, color: PC.fieldValue }}>{punto.orden}. {punto.texto}</Text>
              </View>
              {todosLosDias.map((d) => {
                if (!inspeccionadosSet.has(d)) {
                  return <View key={d} style={[tdStyle, { width: dW, backgroundColor: bg }]} />
                }
                const rawVal = matriz[d]?.[punto.id]
                if (!rawVal) return <View key={d} style={[tdStyle, { width: dW, backgroundColor: bg }]} />
                const label = valorLabel(rawVal)
                const color = valorColor(rawVal)
                return (
                  <View key={d} style={[tdStyle, { width: dW, backgroundColor: bg, alignItems: 'center', justifyContent: 'center' }]}>
                    <Text style={{ fontSize: label === 'NC' ? 5 : 6, fontFamily: 'Helvetica-Bold', color, textAlign: 'center' }}>
                      {label}
                    </Text>
                  </View>
                )
              })}
            </View>
          )
        })}
      </View>

      {/* Franja de acciones tomadas */}
      {accionesEntries.length > 0 && (
        <>
          <PdfSectionBanner>3. Acciones tomadas</PdfSectionBanner>
          <View style={{ borderWidth: 1, borderColor: PC.border, padding: 4, marginTop: 4 }}>
            {accionesEntries.map(([diaNum, texto]) => (
              <View key={diaNum} style={{ flexDirection: 'row', marginBottom: 2, alignItems: 'flex-start' }}>
                <Text style={{ fontSize: 5.5, fontFamily: 'Helvetica-Bold', color: PC.fieldValue, width: 32 }}>
                  Dia {diaNum}:
                </Text>
                <Text style={{ fontSize: 5.5, color: PC.fieldValue, flex: 1 }}>{texto}</Text>
              </View>
            ))}
          </View>
        </>
      )}

      {observaciones ? (
        <View style={{ borderWidth: 1, borderColor: PC.border, padding: 4, marginTop: 4, minHeight: 20 }}>
          <Text style={{ fontSize: 5.5, color: PC.textSub, fontFamily: 'Helvetica-Bold', marginBottom: 2 }}>OBSERVACIONES</Text>
          <Text style={{ fontSize: 6.5, color: PC.fieldValue }}>{observaciones}</Text>
        </View>
      ) : null}

      <PdfSectionBanner>4. Firmas y responsables</PdfSectionBanner>
      <PdfSignatures signatures={firmas} />
    </Page>
  )
}

// ── Documentos exportables ────────────────────────────────────────────────────

export function InspeccionAlmacenEmpaquePDF(props: InspeccionAlmacenEmpaquePaginaProps) {
  return (
    <Document
      title={`Inspeccion Almacen Empaque — ${props.instalacion} ${props.mesLabel}`}
      author="M.A.D.Y."
      creator="M.A.D.Y. Inocuidad Inteligente"
      producer="M.A.D.Y. Inocuidad Inteligente"
    >
      <InspeccionAlmacenEmpaquePagina {...props} />
    </Document>
  )
}

export function InspeccionAlmacenEmpaqueConsolidadoPDF({
  paginas, instalacionNombre, desde, hasta,
}: InspeccionAlmacenEmpaqueConsolidadoPDFProps) {
  return (
    <Document
      title={`Inspeccion Almacen Empaque — ${instalacionNombre} ${desde} a ${hasta}`}
      author="M.A.D.Y."
      creator="M.A.D.Y. Inocuidad Inteligente"
      producer="M.A.D.Y. Inocuidad Inteligente"
    >
      {paginas.map((p, i) => (
        <InspeccionAlmacenEmpaquePagina key={i} {...p} />
      ))}
    </Document>
  )
}
