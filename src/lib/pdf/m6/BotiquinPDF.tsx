// PATRÓN INOCUIDAD — PDF M6 (plantilla homogénea M.A.D.Y)
// BotiquinPagina: una Page A4 landscape por registro.
// BotiquinPDF:    documento individual (1 página).
// BotiquinConsolidadoPDF: documento multi-página, una BotiquinPagina por registro.

import { Document } from '@react-pdf/renderer'
import { PaginaEstandar, Seccion } from '@/lib/pdf/disenoNuevo/PaginaEstandar'
import { TablaDatos, type ColumnaDato } from '@/lib/pdf/disenoNuevo/TablaDatos'
import { PdfFirmas } from '@/lib/pdf/disenoNuevo/PdfFirmas'
import { PC } from '@/lib/pdf/components/tokens'
import type { FirmaParaPdf } from '@/hooks/useFirmasRegistro'

export interface BotiquinPDFProps {
  folio: string
  rancho: string
  ranchoCodigo: string
  fechaVerificacion: string
  parches_curitas: boolean
  guantes_curacion: boolean
  vendas_tijeras: boolean
  gasas_cinta: boolean
  desinfectante: boolean
  responsableNombre: string
  codigoClave?: string
  terminoSitio?: string
  firmaRealizo?: FirmaParaPdf | null
  firmaVerifico?: FirmaParaPdf | null
}

export interface BotiquinConsolidadoPDFProps {
  registros: BotiquinPDFProps[]
  ranchoNombre: string
  desde: string
  hasta: string
}

// ── Catálogo de artículos ─────────────────────────────────────────────────────

type ArticuloKey = 'parches_curitas' | 'guantes_curacion' | 'vendas_tijeras' | 'gasas_cinta' | 'desinfectante'

const ARTICULOS: { key: ArticuloKey; label: string }[] = [
  { key: 'parches_curitas',  label: 'Parches / Curitas' },
  { key: 'guantes_curacion', label: 'Guantes de curación' },
  { key: 'vendas_tijeras',   label: 'Vendas y tijeras' },
  { key: 'gasas_cinta',      label: 'Gasas / Cintas' },
  { key: 'desinfectante',    label: 'Desinfectante' },
]

const COLS: ColumnaDato[] = [
  { texto: 'Artículo', ancho: 563, align: 'left' },
  { texto: 'Tiene', ancho: 100, align: 'center' },
  { texto: 'Llenar', ancho: 100, align: 'center' },
]

function formatFechaPDF(iso: string): string {
  try {
    return new Date(iso + 'T12:00:00').toLocaleDateString('es-MX', {
      weekday: 'long', year: 'numeric', month: 'long', day: 'numeric',
    })
  } catch {
    return iso
  }
}

// ── BotiquinPagina ────────────────────────────────────────────────────────────

export function BotiquinPagina({
  folio, rancho, ranchoCodigo, fechaVerificacion,
  parches_curitas, guantes_curacion, vendas_tijeras, gasas_cinta, desinfectante,
  responsableNombre, codigoClave = 'MXA', terminoSitio = 'Rancho',
  firmaRealizo, firmaVerifico,
}: BotiquinPDFProps) {
  const emision = new Date().toLocaleDateString('es-MX')
  const codigoFmt = `${codigoClave}-F-SC-SIG`

  const valores: Record<ArticuloKey, boolean> = {
    parches_curitas, guantes_curacion, vendas_tijeras, gasas_cinta, desinfectante,
  }
  const presentes = Object.values(valores).filter(Boolean).length

  return (
    <PaginaEstandar
      titulo="REVISIÓN DE MATERIALES DE BOTIQUÍN DE PRIMEROS AUXILIOS"
      subtitulo={`Formato operativo | ${rancho}`}
      codigoFmt={codigoFmt}
      folio={folio}
      emision={emision}
      tituloDatos="1. DATOS DEL SITIO Y VERIFICACIÓN"
      camposDatos={[
        { icono: 'ubicacion', etiqueta: terminoSitio, valor: rancho },
        { icono: 'codigo', etiqueta: 'Código', valor: ranchoCodigo || '—' },
        { icono: 'calendario', etiqueta: 'Fecha de verificación', valor: formatFechaPDF(fechaVerificacion) },
        { etiqueta: 'Artículos presentes', valor: `${presentes} / ${ARTICULOS.length}` },
      ]}
    >
      <Seccion titulo="2. REVISIÓN DE MATERIALES">
        <TablaDatos
          columnas={COLS}
          filas={ARTICULOS.map((art) => {
            const tiene = valores[art.key]
            return [
              art.label,
              tiene ? { texto: 'Si', color: PC.m13Navy, negrita: true } : '',
              !tiene ? { texto: 'Si', color: PC.aviso, negrita: true } : '',
            ]
          })}
        />
      </Seccion>

      <Seccion titulo="3. FIRMAS Y RESPONSABLES">
        <PdfFirmas
          signatures={[
            {
              label: 'Responsable que realizó la verificación',
              nombre: responsableNombre,
              caption: 'Firma del responsable',
              firma: firmaRealizo ?? null,
            },
            { label: '', nombre: '', caption: 'Responsable de Inocuidad — Firma', firma: firmaVerifico ?? null },
          ]}
        />
      </Seccion>
    </PaginaEstandar>
  )
}

// ── BotiquinPDF ───────────────────────────────────────────────────────────────

export function BotiquinPDF(props: BotiquinPDFProps) {
  return (
    <Document
      title={`Botiquin ${props.folio}`}
      author="M.A.D.Y."
      creator="M.A.D.Y. Inocuidad Inteligente"
      producer="M.A.D.Y. Inocuidad Inteligente"
      subject={`Formato operativo - ${props.rancho}`}
      keywords="MADY, inocuidad, botiquin, primeros auxilios"
    >
      <BotiquinPagina {...props} />
    </Document>
  )
}

// ── BotiquinConsolidadoPDF ────────────────────────────────────────────────────

export function BotiquinConsolidadoPDF({ registros, ranchoNombre, desde, hasta }: BotiquinConsolidadoPDFProps) {
  return (
    <Document
      title={`Botiquin Consolidado ${ranchoNombre} ${desde} ${hasta}`}
      author="M.A.D.Y."
      creator="M.A.D.Y. Inocuidad Inteligente"
      producer="M.A.D.Y. Inocuidad Inteligente"
      subject="Revisión Consolidada de Materiales de Botiquín de Primeros Auxilios"
      keywords="MADY, inocuidad, botiquin, consolidado"
    >
      {registros.map((r) => (
        <BotiquinPagina key={r.folio} {...r} />
      ))}
    </Document>
  )
}
