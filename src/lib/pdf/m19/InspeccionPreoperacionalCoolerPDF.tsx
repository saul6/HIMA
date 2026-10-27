// PATRÓN INOCUIDAD — PDF M19 (plantilla homogénea M.A.D.Y)
// Sin PdfPageFrame para preservar el ancho completo (~802pt) y acomodar 31 columnas.
// InspeccionPreoperacionalCoolerPagina: matriz mensual A4 landscape por mes.
// InspeccionPreoperacionalCoolerPDF:    documento individual.
// InspeccionPreoperacionalCoolerConsolidadoPDF: multi-página.

import { Document } from '@react-pdf/renderer'
import { PaginaMatrizMensual } from '@/lib/pdf/disenoNuevo/PaginaMatrizMensual'
import type { FirmaParaPdf } from '@/hooks/useFirmasRegistro'
import { fechaEmisionHoy } from '@/lib/pdf/disenoNuevo/PaginaEstandar'

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
  firmaRealizo?: FirmaParaPdf | null
  firmaVerifico?: FirmaParaPdf | null
}

export interface InspeccionPreoperacionalCoolerConsolidadoPDFProps {
  paginas: InspeccionPreoperacionalCoolerPaginaProps[]
  instalacionNombre: string
  desde: string
  hasta: string
}

// ── InspeccionPreoperacionalCoolerPagina ──────────────────────────────────────

export function InspeccionPreoperacionalCoolerPagina({
  instalacion, instalacionCodigo, mesLabel, mesDate, realizadoPor,
  items, diasInspeccionados, matriz, codigosCorrectivos, observaciones,
  codigoClave = 'MXA', terminoSitio = 'Instalación', folio,
  firmaRealizo, firmaVerifico,
}: InspeccionPreoperacionalCoolerPaginaProps) {
  return (
    <PaginaMatrizMensual
      titulo="INSPECCIÓN PRE-OPERACIONAL"
      subtitulo={`Bitácora mensual | ${instalacion}`}
      codigoFmt={`${codigoClave}-F-SC-SIG`}
      folio={folio ?? mesLabel}
      emision={fechaEmisionHoy()}
      porRenglon={5}
      campos={[
        { icono: 'ubicacion', etiqueta: terminoSitio, valor: instalacion },
        { icono: 'codigo', etiqueta: 'Código', valor: instalacionCodigo || '—' },
        { icono: 'calendario', etiqueta: 'Mes de inspección', valor: mesLabel },
        { etiqueta: 'Días inspeccionados', valor: String(diasInspeccionados.length) },
        { icono: 'usuario', etiqueta: 'Realizó', valor: realizadoPor ?? '—' },
        { etiqueta: 'Frecuencia', valor: 'Diaria' },
      ]}
      seccion1="1. Datos del sitio y mes"
      seccion2="2. Inspección preoperacional"
      seccion3="3. Códigos correctivos y firmas"
      items={items}
      mesDate={mesDate}
      diasInspeccionados={diasInspeccionados}
      matriz={matriz}
      defaultVal="Si"
      codigosCorrectivos={codigosCorrectivos}
      notas={observaciones ? [{ etiqueta: 'Observaciones', valor: observaciones }] : []}
      firmas={[
        { label: 'Realizó la inspección', nombre: realizadoPor ?? '', caption: 'Firma', firma: firmaRealizo ?? null },
        { label: '', nombre: '', caption: 'Verificó: Responsable del Cooler — Firma', firma: firmaVerifico ?? null },
      ]}
    />
  )
}

// ── InspeccionPreoperacionalCoolerPDF ─────────────────────────────────────────

export function InspeccionPreoperacionalCoolerPDF(props: InspeccionPreoperacionalCoolerPaginaProps) {
  return (
    <Document
      title={`Inspección Pre-operacional ${props.mesLabel}`}
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
      title={`Inspección Pre-operacional Consolidada ${instalacionNombre} ${desde} ${hasta}`}
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
