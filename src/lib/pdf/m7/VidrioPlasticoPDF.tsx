// PATRÓN INOCUIDAD — PDF M7 (plantilla homogénea M.A.D.Y)
// VidrioPlasticoPagina: una Page A4 landscape por inspección.
// VidrioPlasticoPDF:    documento individual.
// VidrioPlasticoConsolidadoPDF: documento multi-página.

import { Document, Page, View, Text } from '@react-pdf/renderer'
import { PdfPageFrame, PdfFooter } from '@/lib/pdf/components/PdfPage'
import { PdfHeader } from '@/lib/pdf/components/PdfHeader'
import { PdfSectionBanner } from '@/lib/pdf/components/PdfSectionBanner'
import { PdfFieldGrid, PdfFieldRow, PdfField } from '@/lib/pdf/components/PdfFieldGrid'
import { PdfTable, PdfTableRow, PdfTableCell } from '@/lib/pdf/components/PdfTable'
import { PdfSignatures } from '@/lib/pdf/components/PdfSignatures'
import { PC } from '@/lib/pdf/components/tokens'

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
}

export interface VidrioPlasticoConsolidadoPDFProps {
  inspecciones: VidrioPlasticoPDFProps[]
  ranchoNombre: string
  desde: string
  hasta: string
}

// col widths: Área(120) + Material/Equipo(213) + Protegido(80) + Estado(100) + Observaciones(250) = 763 pt
const COLS = [
  { label: 'Área',              width: 120 },
  { label: 'Material / Equipo', width: 213 },
  { label: 'Protegido',         width:  80 },
  { label: 'Estado',            width: 100 },
  { label: 'Observaciones',     width: 250 },
]

const ESTADO_PALETTE: Record<string, { bg: string; color: string }> = {
  'Bueno':       { bg: '#E3F2FD', color: '#0D5A8F' },
  'Deteriorado': { bg: '#FAEEDA', color: '#854F0B' },
  'Reemplazo':   { bg: '#FAECE7', color: '#993C1D' },
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

// Celda con fondo de color para Estado e indicador Protegido
function CeldaColor({ width, text, bg, color }: { width: number; text: string; bg: string; color: string }) {
  return (
    <View style={{ width, borderRightWidth: 1, borderRightColor: PC.border, borderBottomWidth: 1, borderBottomColor: PC.border, paddingVertical: 3, paddingHorizontal: 3, justifyContent: 'center', backgroundColor: bg }}>
      <Text style={{ fontSize: 8, color, textAlign: 'center', fontFamily: 'Helvetica-Bold' }}>{text}</Text>
    </View>
  )
}

// ── VidrioPlasticoPagina ──────────────────────────────────────────────────────

export function VidrioPlasticoPagina({
  folio, rancho, ranchoCodigo, fecha, responsableNombre, materiales,
  codigoClave = 'MXA', terminoSitio = 'Rancho',
}: VidrioPlasticoPDFProps) {
  const emision = new Date().toLocaleDateString('es-MX')
  const codigoFmt = `${codigoClave}-F-SC-SIG`

  return (
    <Page size="A4" orientation="landscape" style={{ fontFamily: 'Helvetica', fontSize: 9, padding: 24, paddingBottom: 50, backgroundColor: PC.white }}>

      <PdfFooter moduloCodigo="M7" />

      <PdfPageFrame>
        <PdfHeader
          titulo="INSPECCIÓN DE VIDRIO Y PLÁSTICO DURO"
          subtitulo={`Formato operativo | ${rancho}`}
          codigoFormato={codigoFmt}
          folio={folio}
          fecha={emision}
        />

        <View style={{ padding: 14 }}>

          <PdfSectionBanner>1. DATOS DEL SITIO E INSPECCIÓN</PdfSectionBanner>
          <PdfFieldGrid>
            <PdfFieldRow>
              <PdfField label={terminoSitio} value={rancho} />
              <PdfField label="Código" value={ranchoCodigo || '—'} />
              <PdfField label="Fecha de inspección" value={formatFechaPDF(fecha)} />
              <PdfField label="Total materiales" value={String(materiales.length)} />
            </PdfFieldRow>
          </PdfFieldGrid>

          <PdfSectionBanner>2. MATERIALES INSPECCIONADOS</PdfSectionBanner>
          <PdfTable columns={COLS}>
            {materiales.length === 0 ? (
              <PdfTableRow>
                <PdfTableCell width={763} align="center">Sin materiales registrados</PdfTableCell>
              </PdfTableRow>
            ) : (
              materiales.map((m, i) => {
                const estadoPalette = ESTADO_PALETTE[m.estado] ?? { bg: PC.white, color: PC.fieldValue }
                return (
                  <PdfTableRow key={i} alt={i % 2 !== 0}>
                    <PdfTableCell width={COLS[0].width} align="left">{m.area}</PdfTableCell>
                    <PdfTableCell width={COLS[1].width} align="left">{m.material_equipo}</PdfTableCell>
                    <CeldaColor
                      width={COLS[2].width}
                      text={m.protegido ? 'Si' : 'No'}
                      bg={m.protegido ? '#E3F2FD' : '#FAECE7'}
                      color={m.protegido ? '#0D5A8F' : '#993C1D'}
                    />
                    <CeldaColor
                      width={COLS[3].width}
                      text={m.estado}
                      bg={estadoPalette.bg}
                      color={estadoPalette.color}
                    />
                    <PdfTableCell width={COLS[4].width} align="left">{m.observaciones ?? ''}</PdfTableCell>
                  </PdfTableRow>
                )
              })
            )}
          </PdfTable>

          <PdfSectionBanner>3. FIRMAS Y RESPONSABLES</PdfSectionBanner>
          <PdfSignatures
            signatures={[
              { label: 'Realizó la inspección', nombre: responsableNombre, caption: 'Firma' },
              { label: '', nombre: '', caption: 'Responsable de Inocuidad — Firma' },
            ]}
          />

        </View>
      </PdfPageFrame>

    </Page>
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
