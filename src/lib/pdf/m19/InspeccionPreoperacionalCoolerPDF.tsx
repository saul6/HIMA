// PATRÓN INOCUIDAD — PDF M19 (plantilla homogénea M.A.D.Y)
// Sin PdfPageFrame para preservar el ancho completo (~802pt) y acomodar 31 columnas.
// InspeccionPreoperacionalCoolerPagina: matriz mensual A4 landscape por mes.
// InspeccionPreoperacionalCoolerPDF:    documento individual.
// InspeccionPreoperacionalCoolerConsolidadoPDF: multi-página.

import { Document, Page, View, Text } from '@react-pdf/renderer'
import { TopBar, PdfFooter } from '@/lib/pdf/components/PdfPage'
import { PdfHeader } from '@/lib/pdf/components/PdfHeader'
import { PdfSectionBanner } from '@/lib/pdf/components/PdfSectionBanner'
import { PdfFieldGrid, PdfFieldRow, PdfField } from '@/lib/pdf/components/PdfFieldGrid'
import { PdfMonthlyMatrix } from '@/lib/pdf/components/PdfMonthlyMatrix'
import { PdfSignatures } from '@/lib/pdf/components/PdfSignatures'
import { PC } from '@/lib/pdf/components/tokens'

// ── Tipos ─────────────────────────────────────────────────────────────────────

export interface M19ItemPDFRow {
  id: string
  seccion_label: string
  item: string
}

export interface InspeccionPreoperacionalCoolerPaginaProps {
  instalacion: string
  instalacionCodigo: string
  mesLabel: string
  mesDate: string
  realizadoPor: string | null
  items: M19ItemPDFRow[]
  diasInspeccionados: string[]
  matriz: Record<string, Record<string, string>>  // fecha → item_id → 'Si'|'No'|'N/A'
  codigosCorrectivos: { diaNum: string; itemLabel: string; codigo: string }[]
  observaciones: string | null
  codigoClave?: string
  terminoSitio?: string
  folio?: string
}

export interface InspeccionPreoperacionalCoolerConsolidadoPDFProps {
  paginas: InspeccionPreoperacionalCoolerPaginaProps[]
  instalacionNombre: string
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

// ── InspeccionPreoperacionalCoolerPagina ──────────────────────────────────────

export function InspeccionPreoperacionalCoolerPagina({
  instalacion, instalacionCodigo, mesLabel, mesDate, realizadoPor,
  items, diasInspeccionados, matriz, codigosCorrectivos, observaciones,
  codigoClave = 'MXA', terminoSitio = 'Instalación', folio,
}: InspeccionPreoperacionalCoolerPaginaProps) {
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
      <PdfFooter moduloCodigo="M19" />

      <TopBar />

      <PdfHeader
        titulo="INSPECCIÓN PRE-OPERACIONAL"
        subtitulo={`Bitácora mensual | ${instalacion}`}
        codigoFormato={codigoFmt}
        folio={folioDisplay}
        fecha={emision}
      />

      <PdfSectionBanner>1. Datos del sitio y mes</PdfSectionBanner>
      <PdfFieldGrid>
        <PdfFieldRow>
          <PdfField label={terminoSitio} value={instalacion} />
          <PdfField label="Código" value={instalacionCodigo || '—'} />
          <PdfField label="Mes de inspección" value={mesLabel} />
          <PdfField label="Días inspeccionados" value={String(diasInspeccionados.length)} />
          <PdfField label="Realizó" value={realizadoPor ?? '—'} />
          <PdfField label="Frecuencia" value="Diaria" />
        </PdfFieldRow>
      </PdfFieldGrid>

      <PdfSectionBanner>2. Inspección preoperacional</PdfSectionBanner>
      <PdfMonthlyMatrix
        items={items}
        todosLosDias={todosLosDias}
        inspeccionadosSet={inspeccionadosSet}
        matriz={matriz}
        itemColW={ITEM_COL_W}
        dayColW={dW}
        defaultVal="Si"
      />

      <PdfSectionBanner>3. Códigos correctivos y firmas</PdfSectionBanner>

      {codigosCorrectivos.length > 0 && (
        <View style={{ marginTop: 6, paddingHorizontal: 4 }}>
          <Text style={{ fontSize: 7, fontFamily: 'Helvetica-Bold', color: PC.textSub, marginBottom: 3 }}>
            CODIGOS CORRECTIVOS:
          </Text>
          {codigosCorrectivos.map((cc, i) => (
            <Text key={i} style={{ fontSize: 6, color: PC.fieldValue, marginBottom: 1 }}>
              Dia {cc.diaNum} — {cc.itemLabel}: {cc.codigo}
            </Text>
          ))}
        </View>
      )}

      {observaciones && (
        <PdfFieldGrid>
          <PdfFieldRow>
            <PdfField label="Observaciones" value={observaciones} />
          </PdfFieldRow>
        </PdfFieldGrid>
      )}

      <PdfSignatures
        signatures={[
          { label: 'Realizó la inspección', nombre: realizadoPor ?? '', caption: 'Firma' },
          { label: '', nombre: '', caption: 'Verificó: Responsable del Cooler — Firma' },
        ]}
      />
    </Page>
  )
}

// ── InspeccionPreoperacionalCoolerPDF ─────────────────────────────────────────

export function InspeccionPreoperacionalCoolerPDF(props: InspeccionPreoperacionalCoolerPaginaProps) {
  return (
    <Document
      title={`Inspeccion Pre-operacional ${props.mesLabel}`}
      author="M.A.D.Y."
      creator="M.A.D.Y. Inocuidad Inteligente"
      producer="M.A.D.Y. Inocuidad Inteligente"
      subject={`Inspección Pre-operacional — ${props.instalacion}`}
      keywords="MADY, inocuidad, preoperacional, cooler"
    >
      <InspeccionPreoperacionalCoolerPagina {...props} />
    </Document>
  )
}

// ── InspeccionPreoperacionalCoolerConsolidadoPDF ──────────────────────────────

export function InspeccionPreoperacionalCoolerConsolidadoPDF({
  paginas, instalacionNombre, desde, hasta,
}: InspeccionPreoperacionalCoolerConsolidadoPDFProps) {
  return (
    <Document
      title={`Inspeccion Pre-operacional Consolidada ${instalacionNombre} ${desde} ${hasta}`}
      author="M.A.D.Y."
      creator="M.A.D.Y. Inocuidad Inteligente"
      producer="M.A.D.Y. Inocuidad Inteligente"
      subject="Inspección Pre-operacional Consolidada"
      keywords="MADY, inocuidad, preoperacional, cooler, consolidado"
    >
      {paginas.map((p, i) => (
        <InspeccionPreoperacionalCoolerPagina key={i} {...p} />
      ))}
    </Document>
  )
}
