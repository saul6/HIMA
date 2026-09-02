// PATRÓN INOCUIDAD — PDF M11 (plantilla homogénea M.A.D.Y)
// Sin PdfPageFrame para preservar el ancho completo (~802pt) y acomodar 31 columnas.
// PreoperacionalPagina: matriz mensual A4 landscape por mes.
// PreoperacionalPDF:    documento individual.
// PreoperacionalConsolidadoPDF: multi-página.

import { Document, Page, View, Text } from '@react-pdf/renderer'
import { TopBar, PdfFooter } from '@/lib/pdf/components/PdfPage'
import { PdfHeader } from '@/lib/pdf/components/PdfHeader'
import { PdfSectionBanner } from '@/lib/pdf/components/PdfSectionBanner'
import { PdfFieldGrid, PdfFieldRow, PdfField } from '@/lib/pdf/components/PdfFieldGrid'
import { PdfMonthlyMatrix } from '@/lib/pdf/components/PdfMonthlyMatrix'
import { PdfSignatures } from '@/lib/pdf/components/PdfSignatures'
import { PC } from '@/lib/pdf/components/tokens'

// ── Tipos ─────────────────────────────────────────────────────────────────────

export interface M11ItemPDFRow {
  id: string
  seccion_label: string
  item: string
}

export interface PreoperacionalPaginaProps {
  rancho: string
  ranchoCodigo: string
  mesLabel: string
  mesDate: string
  realizadoPor: string | null
  items: M11ItemPDFRow[]
  diasInspeccionados: string[]
  matriz: Record<string, Record<string, string>>  // fecha → item_id → "Si"|"No"
  codigosCorrectivos: { diaNum: string; itemLabel: string; codigo: string }[]
  observaciones: string | null
  folio?: string
  codigoClave?: string
  terminoSitio?: string
}

export interface PreoperacionalConsolidadoPDFProps {
  paginas: PreoperacionalPaginaProps[]
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

// ── PreoperacionalPagina ──────────────────────────────────────────────────────

export function PreoperacionalPagina({
  rancho, ranchoCodigo, mesLabel, mesDate, realizadoPor,
  items, diasInspeccionados, matriz, codigosCorrectivos, observaciones,
  folio, codigoClave = 'MXA', terminoSitio = 'Rancho',
}: PreoperacionalPaginaProps) {
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
      <PdfFooter moduloCodigo="M11" />

      <TopBar />

      <PdfHeader
        titulo="INSPECCIÓN PREOPERACIONAL DE COSECHA"
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
          <PdfField label="Realizó" value={realizadoPor ?? '—'} />
        </PdfFieldRow>
      </PdfFieldGrid>

      <PdfSectionBanner>2. Inspección preoperacional de cosecha</PdfSectionBanner>
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
          { label: '', nombre: '', caption: 'Responsable de Inocuidad — Firma' },
        ]}
      />
    </Page>
  )
}

// ── PreoperacionalPDF ─────────────────────────────────────────────────────────

export function PreoperacionalPDF(props: PreoperacionalPaginaProps) {
  return (
    <Document
      title={`Preoperacional Cosecha ${props.mesLabel}`}
      author="M.A.D.Y."
      creator="M.A.D.Y. Inocuidad Inteligente"
      producer="M.A.D.Y. Inocuidad Inteligente"
      subject={`Inspección Preoperacional de Cosecha — ${props.rancho}`}
      keywords="MADY, inocuidad, preoperacional, cosecha"
    >
      <PreoperacionalPagina {...props} />
    </Document>
  )
}

// ── PreoperacionalConsolidadoPDF ──────────────────────────────────────────────

export function PreoperacionalConsolidadoPDF({
  paginas, ranchoNombre, desde, hasta,
}: PreoperacionalConsolidadoPDFProps) {
  return (
    <Document
      title={`Preoperacional Cosecha Consolidado ${ranchoNombre} ${desde} ${hasta}`}
      author="M.A.D.Y."
      creator="M.A.D.Y. Inocuidad Inteligente"
      producer="M.A.D.Y. Inocuidad Inteligente"
      subject="Inspección Preoperacional Consolidada de Cosecha"
      keywords="MADY, inocuidad, preoperacional, consolidado"
    >
      {paginas.map((p, i) => (
        <PreoperacionalPagina key={i} {...p} />
      ))}
    </Document>
  )
}
