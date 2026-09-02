// PATRÓN INOCUIDAD — PDF M23 (plantilla homogénea M.A.D.Y)
// Sin PdfPageFrame para preservar el ancho completo (~802pt) y acomodar 31 columnas.
// Motor espejo de M19 con agrupación por área y dos firmas.
// VerificacionInsumosPagina: matriz mensual A4 landscape por mes.
// VerificacionInsumosPDF:    documento individual.
// VerificacionInsumosConsolidadoPDF: multi-página.

import { Document, Page, View, Text } from '@react-pdf/renderer'
import { TopBar, PdfFooter } from '@/lib/pdf/components/PdfPage'
import { PdfHeader } from '@/lib/pdf/components/PdfHeader'
import { PdfSectionBanner } from '@/lib/pdf/components/PdfSectionBanner'
import { PdfFieldGrid, PdfFieldRow, PdfField } from '@/lib/pdf/components/PdfFieldGrid'
import { PdfMonthlyMatrix } from '@/lib/pdf/components/PdfMonthlyMatrix'
import { PdfSignatures } from '@/lib/pdf/components/PdfSignatures'
import { PC } from '@/lib/pdf/components/tokens'

// ── Tipos ─────────────────────────────────────────────────────────────────────

export interface M23ItemPDFRow {
  id: string
  area: string
  insumo: string
}

export interface VerificacionInsumosPaginaProps {
  instalacion: string
  instalacionCodigo: string
  mesLabel: string
  mesDate: string
  verificoNombre: string | null
  autorizoNombre: string | null
  items: M23ItemPDFRow[]
  diasInspeccionados: string[]
  matriz: Record<string, Record<string, string>>  // fecha → item_id → 'Si'|'No'|'N/A'
  codigosCorrectivos: { diaNum: string; itemLabel: string; codigo: string }[]
  observaciones: string | null
  codigoClave?: string
  terminoSitio?: string
  folio?: string
}

export interface VerificacionInsumosConsolidadoPDFProps {
  paginas: VerificacionInsumosPaginaProps[]
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

// ── VerificacionInsumosPagina ─────────────────────────────────────────────────

export function VerificacionInsumosPagina({
  instalacion, instalacionCodigo, mesLabel, mesDate,
  verificoNombre, autorizoNombre,
  items, diasInspeccionados, matriz, codigosCorrectivos, observaciones,
  codigoClave = 'MXA', terminoSitio = 'Instalación', folio,
}: VerificacionInsumosPaginaProps) {
  const emision = new Date().toLocaleDateString('es-MX')
  const codigoFmt = `${codigoClave}-F-SC-SIG`
  const folioDisplay = folio ?? mesLabel

  const todosLosDias = diasDelMes(mesDate)
  const dW = Math.floor((PAGE_W - ITEM_COL_W) / Math.max(todosLosDias.length, 1))
  const inspeccionadosSet = new Set(diasInspeccionados)

  // PdfMonthlyMatrix usa seccion_label+item; M23 usa area+insumo — se mapea aquí
  const matrixItems = items.map(it => ({ id: it.id, seccion_label: it.area, item: it.insumo }))

  return (
    <Page
      size="A4"
      orientation="landscape"
      style={{ fontFamily: 'Helvetica', fontSize: 8, padding: MARGIN, paddingBottom: 50, backgroundColor: PC.white }}
    >
      <PdfFooter moduloCodigo="M23" />

      <TopBar />

      <PdfHeader
        titulo="VERIFICACIÓN DE INSUMOS"
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
          <PdfField label="Mes" value={mesLabel} />
          <PdfField label="Días inspeccionados" value={String(diasInspeccionados.length)} />
          <PdfField label="Verificó" value={verificoNombre ?? '—'} />
          <PdfField label="Autorizó" value={autorizoNombre ?? '—'} />
          <PdfField label="Frecuencia" value="Diaria" />
        </PdfFieldRow>
      </PdfFieldGrid>

      <PdfSectionBanner>2. Verificación de insumos</PdfSectionBanner>
      <PdfMonthlyMatrix
        items={matrixItems}
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
          { label: 'Verificó', nombre: verificoNombre ?? '', caption: 'Jefe del Cooler — Firma' },
          { label: 'Autorizó', nombre: autorizoNombre ?? '', caption: 'Gerente — Firma' },
        ]}
      />
    </Page>
  )
}

// ── VerificacionInsumosPDF ────────────────────────────────────────────────────

export function VerificacionInsumosPDF(props: VerificacionInsumosPaginaProps) {
  return (
    <Document
      title={`Verificacion de Insumos ${props.mesLabel}`}
      author="M.A.D.Y."
      creator="M.A.D.Y. Inocuidad Inteligente"
      producer="M.A.D.Y. Inocuidad Inteligente"
      subject={`Verificación de Insumos — ${props.instalacion}`}
      keywords="MADY, inocuidad, verificacion, insumos"
    >
      <VerificacionInsumosPagina {...props} />
    </Document>
  )
}

// ── VerificacionInsumosConsolidadoPDF ─────────────────────────────────────────

export function VerificacionInsumosConsolidadoPDF({
  paginas, instalacionNombre, desde, hasta,
}: VerificacionInsumosConsolidadoPDFProps) {
  return (
    <Document
      title={`Verificacion de Insumos Consolidada ${instalacionNombre} ${desde} ${hasta}`}
      author="M.A.D.Y."
      creator="M.A.D.Y. Inocuidad Inteligente"
      producer="M.A.D.Y. Inocuidad Inteligente"
      subject="Verificación de Insumos Consolidada"
      keywords="MADY, inocuidad, verificacion, insumos, consolidado"
    >
      {paginas.map((p, i) => (
        <VerificacionInsumosPagina key={i} {...p} />
      ))}
    </Document>
  )
}
