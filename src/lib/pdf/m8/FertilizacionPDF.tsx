// PATRÓN INOCUIDAD — PDF M8 (plantilla homogénea M.A.D.Y)
// FertilizacionPagina: una Page A4 landscape por registro de jornada.
// FertilizacionPDF:    documento individual.
// FertilizacionConsolidadoPDF: documento multi-página.

import { Document } from '@react-pdf/renderer'
import { PaginaEstandar, Seccion, fechaEmisionHoy } from '@/lib/pdf/disenoNuevo/PaginaEstandar'
import { TablaDatos, type ColumnaDato } from '@/lib/pdf/disenoNuevo/TablaDatos'
import { PdfFirmas } from '@/lib/pdf/disenoNuevo/PdfFirmas'
import type { FirmaParaPdf } from '@/hooks/useFirmasRegistro'
import { fechaPdf } from '@/lib/pdf/disenoNuevo/fechas'

export interface FertilizacionPDFProps {
  folio: string
  rancho: string
  ranchoCodigo: string
  fecha: string
  sector: string | null
  responsableNombre: string
  fertilizantes: {
    nombre_comercial: string
    ingrediente_activo: string | null
    concentracion: string | null
    metodo: string
    superficie_ha: number
    dosis_kg_l_ha: number
    cantidad_total: number
  }[]
  codigoClave?: string
  terminoSitio?: string
  firmaRealizo?: FirmaParaPdf | null
  firmaVerifico?: FirmaParaPdf | null
}

export interface FertilizacionConsolidadoPDFProps {
  registros: FertilizacionPDFProps[]
  ranchoNombre: string
  desde: string
  hasta: string
}

const COLS: ColumnaDato[] = [
  { texto: 'Nombre Comercial', ancho: 190, align: 'left' },
  { texto: 'Ingrediente Activo', ancho: 183, align: 'left' },
  { texto: 'Método', ancho: 100, align: 'center' },
  { texto: 'Sup. (ha)', ancho: 80, align: 'center' },
  { texto: 'Dosis', ancho: 110, align: 'center' },
  { texto: 'Cantidad Total', ancho: 100, align: 'center' },
]

function formatFechaPDF(iso: string): string {
  try {
    return fechaPdf(iso, {
      weekday: 'long', year: 'numeric', month: 'long', day: 'numeric',
    })
  } catch {
    return iso
  }
}

// ── FertilizacionPagina ───────────────────────────────────────────────────────

export function FertilizacionPagina({
  folio, rancho, ranchoCodigo, fecha, sector, responsableNombre, fertilizantes,
  codigoClave = 'MXA', terminoSitio = 'Rancho',
  firmaRealizo, firmaVerifico,
}: FertilizacionPDFProps) {
  const emision = fechaEmisionHoy()
  const codigoFmt = `${codigoClave}-F-SC-SIG`

  return (
    <PaginaEstandar
      titulo="REGISTRO DE FERTILIZACIÓN"
      subtitulo={`Formato operativo | ${rancho}`}
      codigoFmt={codigoFmt}
      folio={folio}
      emision={emision}
      porRenglon={5}
      tituloDatos="1. DATOS DEL SITIO Y JORNADA"
      camposDatos={[
        { icono: 'ubicacion', etiqueta: terminoSitio, valor: rancho },
        { icono: 'codigo', etiqueta: 'Código', valor: ranchoCodigo || '—' },
        { etiqueta: 'Sector', valor: sector ?? '—' },
        { icono: 'calendario', etiqueta: 'Fecha de registro', valor: formatFechaPDF(fecha) },
        { etiqueta: 'Total fertilizantes', valor: String(fertilizantes.length) },
      ]}
    >
      <Seccion titulo="2. FERTILIZANTES APLICADOS">
        <TablaDatos
          columnas={COLS}
          vacio="Sin fertilizantes registrados"
          filas={fertilizantes.map((f) => [
            f.nombre_comercial,
            `${f.ingrediente_activo ?? '—'}${f.concentracion ? ` ${f.concentracion}` : ''}`,
            f.metodo,
            String(f.superficie_ha),
            String(f.dosis_kg_l_ha),
            f.cantidad_total.toFixed(2),
          ])}
        />
      </Seccion>

      <Seccion titulo="3. FIRMAS Y RESPONSABLES">
        <PdfFirmas
          signatures={[
            { label: 'Realizó la aplicación', nombre: responsableNombre, caption: 'Firma', firma: firmaRealizo ?? null },
            { label: '', nombre: '', caption: 'Responsable de Inocuidad — Firma', firma: firmaVerifico ?? null },
          ]}
        />
      </Seccion>
    </PaginaEstandar>
  )
}

// ── FertilizacionPDF ──────────────────────────────────────────────────────────

export function FertilizacionPDF(props: FertilizacionPDFProps) {
  return (
    <Document
      title={`Fertilizacion ${props.folio}`}
      author="M.A.D.Y."
      creator="M.A.D.Y. Inocuidad Inteligente"
      producer="M.A.D.Y. Inocuidad Inteligente"
      subject={`Formato operativo - ${props.rancho}`}
      keywords="MADY, inocuidad, fertilizacion"
    >
      <FertilizacionPagina {...props} />
    </Document>
  )
}

// ── FertilizacionConsolidadoPDF ───────────────────────────────────────────────

export function FertilizacionConsolidadoPDF({
  registros, ranchoNombre, desde, hasta,
}: FertilizacionConsolidadoPDFProps) {
  return (
    <Document
      title={`Fertilizacion Consolidado ${ranchoNombre} ${desde} ${hasta}`}
      author="M.A.D.Y."
      creator="M.A.D.Y. Inocuidad Inteligente"
      producer="M.A.D.Y. Inocuidad Inteligente"
      subject="Registro Consolidado de Fertilización"
      keywords="MADY, inocuidad, fertilizacion, consolidado"
    >
      {registros.map((reg) => (
        <FertilizacionPagina key={reg.folio} {...reg} />
      ))}
    </Document>
  )
}
