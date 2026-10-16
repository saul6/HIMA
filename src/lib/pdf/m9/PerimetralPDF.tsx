// PATRÓN INOCUIDAD — PDF M9 (plantilla homogénea M.A.D.Y)
// Sin PdfPageFrame para preservar el ancho completo (~802pt) y acomodar 31 columnas.
// PerimetralPagina: matriz mensual A4 landscape por mes.
// PerimetralPDF:    documento individual.
// PerimetralConsolidadoPDF: documento multi-página.

import { Document } from '@react-pdf/renderer'
import { PaginaMatrizMensual } from '@/lib/pdf/disenoNuevo/PaginaMatrizMensual'
import type { FirmaParaPdf } from '@/hooks/useFirmasRegistro'

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
  firmaRealizo?: FirmaParaPdf | null
  firmaVerifico?: FirmaParaPdf | null
}

export interface PerimetralConsolidadoPDFProps {
  paginas: PerimetralPaginaProps[]
  ranchoNombre: string
  desde: string
  hasta: string
}

// ── PerimetralPagina ──────────────────────────────────────────────────────────

export function PerimetralPagina({
  rancho, ranchoCodigo, mesLabel, mesDate, realizadoPor,
  tieneAlmacen, items, diasInspeccionados, matriz,
  observaciones, otro,
  folio, codigoClave = 'MXA', terminoSitio = 'Rancho',
  firmaRealizo, firmaVerifico,
}: PerimetralPaginaProps) {
  const notas = [
    ...(observaciones ? [{ etiqueta: 'Observaciones', valor: observaciones }] : []),
    ...(otro ? [{ etiqueta: 'Otro', valor: otro }] : []),
  ]
  return (
    <PaginaMatrizMensual
      titulo="MONITOREO PERIMETRAL DE PLAGAS"
      subtitulo={`Formato operativo | ${rancho}`}
      codigoFmt={`${codigoClave}-F-SC-SIG`}
      folio={folio ?? mesLabel}
      emision={new Date().toLocaleDateString('es-MX')}
      campos={[
        { icono: 'ubicacion', etiqueta: terminoSitio, valor: rancho },
        { icono: 'codigo', etiqueta: 'Código', valor: ranchoCodigo || '—' },
        { icono: 'calendario', etiqueta: 'Mes de inspección', valor: mesLabel },
        { etiqueta: 'Días inspeccionados', valor: String(diasInspeccionados.length) },
        { etiqueta: 'Almacén', valor: tieneAlmacen ? 'Si' : 'No' },
      ]}
      seccion1="1. Datos del sitio y mes"
      seccion2="2. Monitoreo perimetral de plagas"
      seccion3="3. Observaciones y firmas"
      items={items}
      mesDate={mesDate}
      diasInspeccionados={diasInspeccionados}
      matriz={matriz}
      defaultVal="No"
      notas={notas}
      firmas={[
        { label: 'Realizó el monitoreo', nombre: realizadoPor ?? '', caption: 'Firma', firma: firmaRealizo ?? null },
        { label: '', nombre: '', caption: 'Responsable de Inocuidad — Firma', firma: firmaVerifico ?? null },
      ]}
    />
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
