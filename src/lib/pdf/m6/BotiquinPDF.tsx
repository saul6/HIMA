// PATRÓN INOCUIDAD — PDF M6 (plantilla homogénea M.A.D.Y)
// BotiquinPagina: una Page A4 landscape por registro.
// BotiquinPDF:    documento individual (1 página).
// BotiquinConsolidadoPDF: documento multi-página, una BotiquinPagina por registro.

import { Document, Page, View, Text } from '@react-pdf/renderer'
import { PdfPageFrame, PdfFooter } from '@/lib/pdf/components/PdfPage'
import { PdfHeader } from '@/lib/pdf/components/PdfHeader'
import { PdfSectionBanner } from '@/lib/pdf/components/PdfSectionBanner'
import { PdfFieldGrid, PdfFieldRow, PdfField } from '@/lib/pdf/components/PdfFieldGrid'
import { PdfTable, PdfTableRow, PdfTableCell } from '@/lib/pdf/components/PdfTable'
import { PdfSignatures } from '@/lib/pdf/components/PdfSignatures'
import { PC } from '@/lib/pdf/components/tokens'

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

// col widths: Artículo(563) + Tiene(100) + Llenar(100) = 763 pt (content width A4 landscape)
const COLS = [
  { label: 'Artículo',  width: 563 },
  { label: 'Tiene',     width: 100 },
  { label: 'Llenar',    width: 100 },
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

// Celda con fondo de color para indicadores visuales Tiene/Llenar
function CeldaIndicador({ width, text, active, tipo }: { width: number; text: string; active: boolean; tipo: 'tiene' | 'llenar' }) {
  const bg   = active ? (tipo === 'tiene' ? '#E3F2FD' : '#FAEEDA') : PC.white
  const color = active ? (tipo === 'tiene' ? '#0D5A8F'  : '#854F0B')  : PC.fieldValue
  return (
    <View style={{ width, borderRightWidth: 1, borderRightColor: PC.border, borderBottomWidth: 1, borderBottomColor: PC.border, paddingVertical: 3, paddingHorizontal: 3, justifyContent: 'center', backgroundColor: bg }}>
      <Text style={{ fontSize: 8, color, textAlign: 'center', fontFamily: active ? 'Helvetica-Bold' : 'Helvetica' }}>{text}</Text>
    </View>
  )
}

// ── BotiquinPagina ────────────────────────────────────────────────────────────

export function BotiquinPagina({
  folio, rancho, ranchoCodigo, fechaVerificacion,
  parches_curitas, guantes_curacion, vendas_tijeras, gasas_cinta, desinfectante,
  responsableNombre, codigoClave = 'MXA', terminoSitio = 'Rancho',
}: BotiquinPDFProps) {
  const emision = new Date().toLocaleDateString('es-MX')
  const codigoFmt = `${codigoClave}-F-SC-SIG`

  const valores: Record<ArticuloKey, boolean> = {
    parches_curitas, guantes_curacion, vendas_tijeras, gasas_cinta, desinfectante,
  }
  const presentes = Object.values(valores).filter(Boolean).length

  return (
    <Page size="A4" orientation="landscape" style={{ fontFamily: 'Helvetica', fontSize: 9, padding: 24, paddingBottom: 50, backgroundColor: PC.white }}>

      <PdfFooter moduloCodigo="M6" />

      <PdfPageFrame>
        <PdfHeader
          titulo="REVISIÓN DE MATERIALES DE BOTIQUÍN DE PRIMEROS AUXILIOS"
          subtitulo={`Formato operativo | ${rancho}`}
          codigoFormato={codigoFmt}
          folio={folio}
          fecha={emision}
        />

        <View style={{ padding: 14 }}>

          <PdfSectionBanner>1. DATOS DEL SITIO Y VERIFICACIÓN</PdfSectionBanner>
          <PdfFieldGrid>
            <PdfFieldRow>
              <PdfField label={terminoSitio} value={rancho} />
              <PdfField label="Código" value={ranchoCodigo || '—'} />
            </PdfFieldRow>
            <PdfFieldRow>
              <PdfField label="Fecha de verificación" value={formatFechaPDF(fechaVerificacion)} />
              <PdfField label="Artículos presentes" value={`${presentes} / ${ARTICULOS.length}`} />
            </PdfFieldRow>
          </PdfFieldGrid>

          <PdfSectionBanner>2. REVISIÓN DE MATERIALES</PdfSectionBanner>
          <PdfTable columns={COLS}>
            {ARTICULOS.map((art, i) => {
              const tiene = valores[art.key]
              return (
                <PdfTableRow key={art.key} alt={i % 2 !== 0}>
                  <PdfTableCell width={COLS[0].width} align="left">{art.label}</PdfTableCell>
                  <CeldaIndicador width={COLS[1].width} text={tiene ? 'Si' : ''} active={tiene} tipo="tiene" />
                  <CeldaIndicador width={COLS[2].width} text={!tiene ? 'Si' : ''} active={!tiene} tipo="llenar" />
                </PdfTableRow>
              )
            })}
          </PdfTable>

          <PdfSectionBanner>3. FIRMAS Y RESPONSABLES</PdfSectionBanner>
          <PdfSignatures
            signatures={[
              { label: 'Responsable que realizó la verificación', nombre: responsableNombre, caption: 'Firma del responsable' },
              { label: '', nombre: '', caption: 'Responsable de Inocuidad — Firma' },
            ]}
          />

        </View>
      </PdfPageFrame>

    </Page>
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
