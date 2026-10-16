// PATRÓN INOCUIDAD — PDF M7 (plantilla homogénea M.A.D.Y)
// VidrioPlasticoPagina: una Page A4 landscape por inspección.
// VidrioPlasticoPDF:    documento individual.
// VidrioPlasticoConsolidadoPDF: documento multi-página.

import { Document } from '@react-pdf/renderer'
import { PaginaEstandar, Seccion } from '@/lib/pdf/disenoNuevo/PaginaEstandar'
import { TablaDatos, type ColumnaDato } from '@/lib/pdf/disenoNuevo/TablaDatos'
import { PdfFirmas } from '@/lib/pdf/disenoNuevo/PdfFirmas'
import { PC } from '@/lib/pdf/components/tokens'
import type { FirmaParaPdf } from '@/hooks/useFirmasRegistro'

export interface VidrioPlasticoPDFProps {
  folio: string
  rancho: string
  ranchoCodigo: string
  fecha: string
  responsableNombre: string
  materiales: {
    area: string
    material_equipo: string
    protegido: boolean
    estado: 'Bueno' | 'Deteriorado' | 'Reemplazo'
    observaciones: string | null
  }[]
  codigoClave?: string
  terminoSitio?: string
  firmaRealizo?: FirmaParaPdf | null
  firmaVerifico?: FirmaParaPdf | null
}

export interface VidrioPlasticoConsolidadoPDFProps {
  inspecciones: VidrioPlasticoPDFProps[]
  ranchoNombre: string
  desde: string
  hasta: string
}

const COLS: ColumnaDato[] = [
  { texto: 'Área', ancho: 120, align: 'left' },
  { texto: 'Material / Equipo', ancho: 213, align: 'left' },
  { texto: 'Protegido', ancho: 80, align: 'center' },
  { texto: 'Estado', ancho: 100, align: 'center' },
  { texto: 'Observaciones', ancho: 250, align: 'left' },
]

// Color del texto del estado (solo color; el texto no cambia)
const ESTADO_COLOR: Record<string, string> = {
  'Bueno': PC.m13Navy,
  'Deteriorado': PC.aviso,
  'Reemplazo': PC.negativo,
}

function formatFechaPDF(iso: string): string {
  try {
    return new Date(iso + 'T12:00:00').toLocaleDateString('es-MX', {
      weekday: 'long', year: 'numeric', month: 'long', day: 'numeric',
    })
  } catch {
    return iso
  }
}

// ── VidrioPlasticoPagina ──────────────────────────────────────────────────────

export function VidrioPlasticoPagina({
  folio, rancho, ranchoCodigo, fecha, responsableNombre, materiales,
  codigoClave = 'MXA', terminoSitio = 'Rancho',
  firmaRealizo, firmaVerifico,
}: VidrioPlasticoPDFProps) {
  const emision = new Date().toLocaleDateString('es-MX')
  const codigoFmt = `${codigoClave}-F-SC-SIG`

  return (
    <PaginaEstandar
      titulo="INSPECCIÓN DE VIDRIO Y PLÁSTICO DURO"
      subtitulo={`Formato operativo | ${rancho}`}
      codigoFmt={codigoFmt}
      folio={folio}
      emision={emision}
      tituloDatos="1. DATOS DEL SITIO E INSPECCIÓN"
      camposDatos={[
        { icono: 'ubicacion', etiqueta: terminoSitio, valor: rancho },
        { icono: 'codigo', etiqueta: 'Código', valor: ranchoCodigo || '—' },
        { icono: 'calendario', etiqueta: 'Fecha de inspección', valor: formatFechaPDF(fecha) },
        { etiqueta: 'Total materiales', valor: String(materiales.length) },
      ]}
    >
      <Seccion titulo="2. MATERIALES INSPECCIONADOS">
        <TablaDatos
          columnas={COLS}
          vacio="Sin materiales registrados"
          filas={materiales.map((m) => [
            m.area,
            m.material_equipo,
            { texto: m.protegido ? 'Si' : 'No', color: m.protegido ? PC.m13Navy : PC.negativo, negrita: true },
            { texto: m.estado, color: ESTADO_COLOR[m.estado] ?? PC.fieldValue, negrita: true },
            m.observaciones ?? '',
          ])}
        />
      </Seccion>

      <Seccion titulo="3. FIRMAS Y RESPONSABLES">
        <PdfFirmas
          signatures={[
            { label: 'Realizó la inspección', nombre: responsableNombre, caption: 'Firma', firma: firmaRealizo ?? null },
            { label: '', nombre: '', caption: 'Responsable de Inocuidad — Firma', firma: firmaVerifico ?? null },
          ]}
        />
      </Seccion>
    </PaginaEstandar>
  )
}

// ── VidrioPlasticoPDF ─────────────────────────────────────────────────────────

export function VidrioPlasticoPDF(props: VidrioPlasticoPDFProps) {
  return (
    <Document
      title={`Vidrio y Plastico ${props.folio}`}
      author="M.A.D.Y."
      creator="M.A.D.Y. Inocuidad Inteligente"
      producer="M.A.D.Y. Inocuidad Inteligente"
      subject={`Formato operativo - ${props.rancho}`}
      keywords="MADY, inocuidad, vidrio, plastico"
    >
      <VidrioPlasticoPagina {...props} />
    </Document>
  )
}

// ── VidrioPlasticoConsolidadoPDF ──────────────────────────────────────────────

export function VidrioPlasticoConsolidadoPDF({
  inspecciones, ranchoNombre, desde, hasta,
}: VidrioPlasticoConsolidadoPDFProps) {
  return (
    <Document
      title={`Vidrio y Plastico Consolidado ${ranchoNombre} ${desde} ${hasta}`}
      author="M.A.D.Y."
      creator="M.A.D.Y. Inocuidad Inteligente"
      producer="M.A.D.Y. Inocuidad Inteligente"
      subject="Inspección Consolidada de Vidrio y Plástico Duro"
      keywords="MADY, inocuidad, vidrio, plastico, consolidado"
    >
      {inspecciones.map((insp) => (
        <VidrioPlasticoPagina key={insp.folio} {...insp} />
      ))}
    </Document>
  )
}
