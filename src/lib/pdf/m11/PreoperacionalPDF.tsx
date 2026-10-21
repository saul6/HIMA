// PATRÓN INOCUIDAD — PDF M11 (plantilla homogénea M.A.D.Y)
// Sin PdfPageFrame para preservar el ancho completo (~802pt) y acomodar 31 columnas.
// PreoperacionalPagina: matriz mensual A4 landscape por mes.
// PreoperacionalPDF:    documento individual.
// PreoperacionalConsolidadoPDF: multi-página.

import { Document } from '@react-pdf/renderer'
import { PaginaMatrizMensual } from '@/lib/pdf/disenoNuevo/PaginaMatrizMensual'
import type { FirmaParaPdf } from '@/hooks/useFirmasRegistro'
import { fechaEmisionHoy } from '@/lib/pdf/disenoNuevo/PaginaEstandar'

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
  firmaRealizo?: FirmaParaPdf | null
  firmaVerifico?: FirmaParaPdf | null
}

export interface PreoperacionalConsolidadoPDFProps {
  paginas: PreoperacionalPaginaProps[]
  ranchoNombre: string
  desde: string
  hasta: string
}

// ── PreoperacionalPagina ──────────────────────────────────────────────────────

export function PreoperacionalPagina({
  rancho, ranchoCodigo, mesLabel, mesDate, realizadoPor,
  items, diasInspeccionados, matriz, codigosCorrectivos, observaciones,
  folio, codigoClave = 'MXA', terminoSitio = 'Rancho',
  firmaRealizo, firmaVerifico,
}: PreoperacionalPaginaProps) {
  return (
    <PaginaMatrizMensual
      titulo="INSPECCIÓN PREOPERACIONAL DE COSECHA"
      subtitulo={`Formato operativo | ${rancho}`}
      codigoFmt={`${codigoClave}-F-SC-SIG`}
      folio={folio ?? mesLabel}
      emision={fechaEmisionHoy()}
      campos={[
        { icono: 'ubicacion', etiqueta: terminoSitio, valor: rancho },
        { icono: 'codigo', etiqueta: 'Código', valor: ranchoCodigo || '—' },
        { icono: 'calendario', etiqueta: 'Mes de inspección', valor: mesLabel },
        { etiqueta: 'Días inspeccionados', valor: String(diasInspeccionados.length) },
        { icono: 'usuario', etiqueta: 'Realizó', valor: realizadoPor ?? '—' },
      ]}
      seccion1="1. Datos del sitio y mes"
      seccion2="2. Inspección preoperacional de cosecha"
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
        { label: '', nombre: '', caption: 'Responsable de Inocuidad — Firma', firma: firmaVerifico ?? null },
      ]}
    />
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
