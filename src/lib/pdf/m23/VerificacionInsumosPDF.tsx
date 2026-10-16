// PATRÓN INOCUIDAD — PDF M23 (plantilla homogénea M.A.D.Y)
// Sin PdfPageFrame para preservar el ancho completo (~802pt) y acomodar 31 columnas.
// Motor espejo de M19 con agrupación por área y dos firmas.
// VerificacionInsumosPagina: matriz mensual A4 landscape por mes.
// VerificacionInsumosPDF:    documento individual.
// VerificacionInsumosConsolidadoPDF: multi-página.

import { Document } from '@react-pdf/renderer'
import { PaginaMatrizMensual } from '@/lib/pdf/disenoNuevo/PaginaMatrizMensual'
import type { FirmaParaPdf } from '@/hooks/useFirmasRegistro'

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
  firmaRealizo?: FirmaParaPdf | null
  firmaVerifico?: FirmaParaPdf | null
}

export interface VerificacionInsumosConsolidadoPDFProps {
  paginas: VerificacionInsumosPaginaProps[]
  instalacionNombre: string
  desde: string
  hasta: string
}

// ── VerificacionInsumosPagina ─────────────────────────────────────────────────

export function VerificacionInsumosPagina({
  instalacion, instalacionCodigo, mesLabel, mesDate,
  verificoNombre, autorizoNombre,
  items, diasInspeccionados, matriz, codigosCorrectivos, observaciones,
  codigoClave = 'MXA', terminoSitio = 'Instalación', folio,
  firmaRealizo, firmaVerifico,
}: VerificacionInsumosPaginaProps) {
  // La matriz usa seccion_label+item; M23 usa area+insumo — se mapea aquí
  const matrixItems = items.map(it => ({ id: it.id, seccion_label: it.area, item: it.insumo }))
  return (
    <PaginaMatrizMensual
      titulo="VERIFICACIÓN DE INSUMOS"
      subtitulo={`Bitácora mensual | ${instalacion}`}
      codigoFmt={`${codigoClave}-F-SC-SIG`}
      folio={folio ?? mesLabel}
      emision={new Date().toLocaleDateString('es-MX')}
      porRenglon={5}
      campos={[
        { icono: 'ubicacion', etiqueta: terminoSitio, valor: instalacion },
        { icono: 'codigo', etiqueta: 'Código', valor: instalacionCodigo || '—' },
        { icono: 'calendario', etiqueta: 'Mes', valor: mesLabel },
        { etiqueta: 'Días inspeccionados', valor: String(diasInspeccionados.length) },
        { icono: 'usuario', etiqueta: 'Verificó', valor: verificoNombre ?? '—' },
        { icono: 'usuario', etiqueta: 'Autorizó', valor: autorizoNombre ?? '—' },
        { etiqueta: 'Frecuencia', valor: 'Diaria' },
      ]}
      seccion1="1. Datos del sitio y mes"
      seccion2="2. Verificación de insumos"
      seccion3="3. Códigos correctivos y firmas"
      items={matrixItems}
      mesDate={mesDate}
      diasInspeccionados={diasInspeccionados}
      matriz={matriz}
      defaultVal="Si"
      codigosCorrectivos={codigosCorrectivos}
      notas={observaciones ? [{ etiqueta: 'Observaciones', valor: observaciones }] : []}
      firmas={[
        { label: 'Verificó', nombre: verificoNombre ?? '', caption: 'Jefe del Cooler — Firma', firma: firmaRealizo ?? null },
        { label: 'Autorizó', nombre: autorizoNombre ?? '', caption: 'Gerente — Firma', firma: firmaVerifico ?? null },
      ]}
    />
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
