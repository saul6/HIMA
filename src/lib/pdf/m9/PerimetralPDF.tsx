// PATRÓN INOCUIDAD — PDF M9 (plantilla homogénea M.A.D.Y)
// Sin PdfPageFrame para preservar el ancho completo (~802pt) y acomodar 31 columnas.
// PerimetralPagina: matriz mensual A4 landscape por mes.
// PerimetralPDF:    documento individual.
// PerimetralConsolidadoPDF: documento multi-página.

import { Document, Page, View, Text } from '@react-pdf/renderer'
import { TopBar, PdfFooter } from '@/lib/pdf/components/PdfPage'
import { PdfHeader } from '@/lib/pdf/components/PdfHeader'
import { PdfSectionBanner } from '@/lib/pdf/components/PdfSectionBanner'
import { PdfFieldGrid, PdfFieldRow, PdfField } from '@/lib/pdf/components/PdfFieldGrid'
import { PdfMonthlyMatrix } from '@/lib/pdf/components/PdfMonthlyMatrix'
import { PdfSignatures } from '@/lib/pdf/components/PdfSignatures'
import { PC } from '@/lib/pdf/components/tokens'

// ── Tipos ─────────────────────────────────────────────────────────────────────

export interface ItemPDFRow {
  id: string
  seccion_label: string
  item: string
}

export interface PerimetralPaginaProps {
  rancho: string
  ranchoCodigo: string
  mesLabel: string             // "Junio 2026"
  mesDate: string              // "2026-06-01"
  realizadoPor: string | null
  tieneAlmacen: boolean
  items: ItemPDFRow[]
  diasInspeccionados: string[] // ["2026-06-05", ...] ordenados
  matriz: Record<string, Record<string, string>>  // fecha → item_id → "Si"|"No"
  observaciones: string | null
  otro: string | null
  folio?: string
  codigoClave?: string
  terminoSitio?: string
}

export interface PerimetralConsolidadoPDFProps {
  paginas: PerimetralPaginaProps[]
  ranchoNombre: string
  desde: string
  hasta: string
}

// A4 landscape: 841.89 × 595.28 — márgenes 20pt para acomodar 31 columnas de días
const MARGIN     = 20
const PAGE_W     = 841.89 - MARGIN * 2  // ~801.89
const ITEM_COL_W = 160

function diasDelMes(mesDate: string): string[] {
  const d = new Date(mesDate + 'T12:00:00')
  const year = d.getFullYear()
  const month = d.getMonth()
  const total = new Date(year, month + 1, 0).getDate()
  const result: string[] = []
  for (let i = 1; i <= total; i++) {
    result.push(`${year}-${String(month + 1).padStart(2, '0')}-${String(i).padStart(2, '0')}`)
  }
  return result
}

// ── PerimetralPagina ──────────────────────────────────────────────────────────

export function PerimetralPagina({
  rancho, ranchoCodigo, mesLabel, mesDate, realizadoPor,
  tieneAlmacen, items, diasInspeccionados, matriz,
  observaciones, otro,
  folio, codigoClave = 'MXA', terminoSitio = 'Rancho',
}: PerimetralPaginaProps) {
  const emision = new Date().toLocaleDateString('es-MX')
  const codigoFmt = `${codigoClave}-F-SC-SIG`
  const folioDisplay = folio ?? mesLabel

  const todosLosDias = diasDelMes(mesDate)
  const dW = Math.floor((PAGE_W - ITEM_COL_W) / Math.max(todosLosDias.length, 1))
  const inspeccionadosSet = new Set(diasInspeccionados)

  return (
    <Page
      size="A4"
      orientation="landscape"
      style={{ fontFamily: 'Helvetica', fontSize: 8, padding: MARGIN, paddingBottom: 50, backgroundColor: PC.white }}
    >
      <PdfFooter moduloCodigo="M9" />

      <TopBar />

      <PdfHeader
        titulo="MONITOREO PERIMETRAL DE PLAGAS"
        subtitulo={`Formato operativo | ${rancho}`}
        codigoFormato={codigoFmt}
        folio={folioDisplay}
        fecha={emision}
      />

      <PdfSectionBanner>1. Datos del sitio y mes</PdfSectionBanner>
      <PdfFieldGrid>
        <PdfFieldRow>
          <PdfField label={terminoSitio} value={rancho} />
          <PdfField label="Código" value={ranchoCodigo || '—'} />
          <PdfField label="Mes de inspección" value={mesLabel} />
          <PdfField label="Días inspeccionados" value={String(diasInspeccionados.length)} />
          <PdfField label="Almacén" value={tieneAlmacen ? 'Si' : 'No'} />
        </PdfFieldRow>
      </PdfFieldGrid>

      <PdfSectionBanner>2. Monitoreo perimetral de plagas</PdfSectionBanner>
      <PdfMonthlyMatrix
        items={items}
        todosLosDias={todosLosDias}
        inspeccionadosSet={inspeccionadosSet}
        matriz={matriz}
        itemColW={ITEM_COL_W}
        dayColW={dW}
        defaultVal="No"
      />

      <PdfSectionBanner>3. Observaciones y firmas</PdfSectionBanner>

      {(observaciones || otro) && (
        <PdfFieldGrid>
          <PdfFieldRow>
            {observaciones ? <PdfField label="Observaciones" value={observaciones} /> : null}
            {otro ? <PdfField label="Otro" value={otro} /> : null}
          </PdfFieldRow>
        </PdfFieldGrid>
      )}

      <PdfSignatures
        signatures={[
          { label: 'Realizó el monitoreo', nombre: realizadoPor ?? '', caption: 'Firma' },
          { label: '', nombre: '', caption: 'Responsable de Inocuidad — Firma' },
        ]}
      />
    </Page>
  )
}

// ── PerimetralPDF ─────────────────────────────────────────────────────────────

export function PerimetralPDF(props: PerimetralPaginaProps) {
  return (
    <Document
      title={`Perimetral ${props.mesLabel}`}
      author="M.A.D.Y."
      creator="M.A.D.Y. Inocuidad Inteligente"
      producer="M.A.D.Y. Inocuidad Inteligente"
      subject={`Monitoreo Perimetral de Plagas — ${props.rancho}`}
      keywords="MADY, inocuidad, perimetral, plagas"
    >
      <PerimetralPagina {...props} />
    </Document>
  )
}

// ── PerimetralConsolidadoPDF ──────────────────────────────────────────────────

export function PerimetralConsolidadoPDF({
  paginas, ranchoNombre, desde, hasta,
}: PerimetralConsolidadoPDFProps) {
  return (
    <Document
      title={`Perimetral Consolidado ${ranchoNombre} ${desde} ${hasta}`}
      author="M.A.D.Y."
      creator="M.A.D.Y. Inocuidad Inteligente"
      producer="M.A.D.Y. Inocuidad Inteligente"
      subject="Monitoreo Perimetral Consolidado de Plagas"
      keywords="MADY, inocuidad, perimetral, consolidado"
    >
      {paginas.map((p, i) => (
        <PerimetralPagina key={i} {...p} />
      ))}
    </Document>
  )
}
