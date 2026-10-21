// PDF M73 — Inventario de material de curación (botiquín) GlobalGAP (diseño nuevo: lib/pdf/disenoNuevo).
import { Document } from '@react-pdf/renderer'
import { PaginaEstandar, Seccion } from '@/lib/pdf/disenoNuevo/PaginaEstandar'
import { FranjaDatos } from '@/lib/pdf/disenoNuevo/Franja'
import { TablaDatos, ANCHO_UTIL, type ColumnaDato } from '@/lib/pdf/disenoNuevo/TablaDatos'
import { PdfFirmas } from '@/lib/pdf/disenoNuevo/PdfFirmas'
import type { FirmaParaPdf } from '@/hooks/useFirmasRegistro'
import { fechaPdf } from '@/lib/pdf/disenoNuevo/fechas'

export interface M73MaterialFilaPDF {
  nombre: string
  sale: number | null
  entra: number | null
  total: number | null
  usuario: string | null
}

export interface InventarioBotiquinGGPDFProps {
  rancho: string
  orgNombre?: string | null
  fecha: string
  botiquin_num: string | null
  realizo: string | null
  observaciones: string | null
  materiales: M73MaterialFilaPDF[]
  firmaRealizo?: FirmaParaPdf | null
}

// Anchos relativos de columna (la tabla se escala al ancho útil de la hoja)
const COLS: ColumnaDato[] = [
  { texto: 'Material', ancho: 210 },
  { texto: 'Sale', ancho: 75, align: 'center' },
  { texto: 'Entra', ancho: 75, align: 'center' },
  { texto: 'Total', ancho: 75, align: 'center' },
  { texto: 'Usuario', ancho: 120 },
]

function fmt(n: number | null): string {
  if (n === null || n === undefined) return '—'
  return String(n)
}

function formatFecha(iso: string) {
  try { return fechaPdf(iso, { day: 'numeric', month: 'long', year: 'numeric' }) }
  catch { return iso }
}

export function InventarioBotiquinGGPagina({ rancho, orgNombre, fecha, botiquin_num, realizo, observaciones, materiales, firmaRealizo }: InventarioBotiquinGGPDFProps) {
  return (
    <PaginaEstandar
      orientacion="portrait"
      titulo="INVENTARIO DE MATERIAL DE CURACIÓN — BOTIQUÍN"
      subtitulo={`GlobalGAP | ${rancho}`}
      codigoFmt="M73-GG"
      folio={fechaPdf(fecha)}
      emision={fechaPdf(fecha)}
      etiquetaEmision="Fecha"
      tituloDatos="DATOS GENERALES"
      camposDatos={[
        ...(orgNombre ? [{ icono: 'usuario' as const, etiqueta: 'Empresa', valor: orgNombre }] : []),
        { icono: 'ubicacion', etiqueta: 'Rancho / instalación', valor: rancho },
        { icono: 'calendario', etiqueta: 'Fecha', valor: formatFecha(fecha) },
        { etiqueta: 'N. Botiquin', valor: botiquin_num ?? '—' },
        { icono: 'usuario', etiqueta: 'Realizó', valor: realizo ?? '—' },
      ]}
    >
      <Seccion titulo="REGISTRO DE MATERIALES">
        <TablaDatos
          columnas={COLS}
          anchoTotal={ANCHO_UTIL.portrait}
          vacio="Sin materiales registrados"
          filas={materiales.map((m) => [m.nombre, fmt(m.sale), fmt(m.entra), fmt(m.total), m.usuario ?? ''])}
        />
      </Seccion>

      {observaciones && <FranjaDatos campos={[{ etiqueta: 'Observaciones', valor: observaciones }]} />}

      <PdfFirmas signatures={[{ label: '', nombre: '', caption: 'Nombre y firma de quien realiza', firma: firmaRealizo ?? null }]} />
    </PaginaEstandar>
  )
}

export function InventarioBotiquinGGPDF(props: InventarioBotiquinGGPDFProps) {
  return (
    <Document>
      <InventarioBotiquinGGPagina {...props} />
    </Document>
  )
}

export interface M73ResumenFilaPDF {
  id: string
  rancho: string
  fecha: string
  botiquin_num: string | null
  realizo: string | null
  total_materiales: number
  observaciones: string | null
}

const COLS_RESUMEN: ColumnaDato[] = [
  { texto: 'Fecha', ancho: 65, align: 'center' },
  { texto: 'Rancho', ancho: 110 },
  { texto: 'N. Botiquin', ancho: 65, align: 'center' },
  { texto: 'Realizó', ancho: 100 },
  { texto: '# Materiales', ancho: 55, align: 'center' },
  { texto: 'Observaciones', ancho: 160 },
]

export function InventarioBotiquinGGConsolidadoPDF({ filas, orgNombre }: {
  filas: M73ResumenFilaPDF[]
  orgNombre?: string | null
}) {
  function fmtCorta(iso: string) {
    try { return fechaPdf(iso, { day: '2-digit', month: 'short', year: 'numeric' }) }
    catch { return iso }
  }
  return (
    <Document>
      <PaginaEstandar
        orientacion="portrait"
        titulo="INVENTARIO DE MATERIAL DE CURACIÓN — CONSOLIDADO"
        subtitulo={orgNombre ? `GlobalGAP | ${orgNombre}` : 'GlobalGAP'}
        codigoFmt="M73-GG"
        folio="Consolidado"
        emision={fechaPdf(filas[0]?.fecha)}
        etiquetaEmision="Fecha"
        camposDatos={[]}
      >
        <TablaDatos
          columnas={COLS_RESUMEN}
          anchoTotal={ANCHO_UTIL.portrait}
          fuente={7}
          filas={filas.map((f) => [fmtCorta(f.fecha), f.rancho, f.botiquin_num ?? '—', f.realizo ?? '—', String(f.total_materiales), f.observaciones ?? ''])}
        />
      </PaginaEstandar>
    </Document>
  )
}
