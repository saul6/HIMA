// PATRÓN INOCUIDAD — PDF M8 (plantilla homogénea M.A.D.Y)
// FertilizacionPagina: una Page A4 landscape por registro de jornada.
// FertilizacionPDF:    documento individual.
// FertilizacionConsolidadoPDF: documento multi-página.

import { Document, Page, View } from '@react-pdf/renderer'
import { PdfPageFrame, PdfFooter } from '@/lib/pdf/components/PdfPage'
import { PdfHeader } from '@/lib/pdf/components/PdfHeader'
import { PdfSectionBanner } from '@/lib/pdf/components/PdfSectionBanner'
import { PdfFieldGrid, PdfFieldRow, PdfField } from '@/lib/pdf/components/PdfFieldGrid'
import { PdfTable, PdfTableRow, PdfTableCell } from '@/lib/pdf/components/PdfTable'
import { PdfSignatures } from '@/lib/pdf/components/PdfSignatures'
import { PC } from '@/lib/pdf/components/tokens'

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
}

export interface FertilizacionConsolidadoPDFProps {
  registros: FertilizacionPDFProps[]
  ranchoNombre: string
  desde: string
  hasta: string
}

// col widths: NC(190) + IA(183) + Método(100) + Sup(80) + Dosis(110) + Total(100) = 763 pt
const COLS = [
  { label: 'Nombre Comercial',  width: 190 },
  { label: 'Ingrediente Activo', width: 183 },
  { label: 'Método',            width: 100 },
  { label: 'Sup. (ha)',         width:  80 },
  { label: 'Dosis',             width: 110 },
  { label: 'Cantidad Total',    width: 100 },
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

// ── FertilizacionPagina ───────────────────────────────────────────────────────

export function FertilizacionPagina({
  folio, rancho, ranchoCodigo, fecha, sector, responsableNombre, fertilizantes,
  codigoClave = 'MXA', terminoSitio = 'Rancho',
}: FertilizacionPDFProps) {
  const emision = new Date().toLocaleDateString('es-MX')
  const codigoFmt = `${codigoClave}-F-SC-SIG`

  return (
    <Page size="A4" orientation="landscape" style={{ fontFamily: 'Helvetica', fontSize: 9, padding: 24, paddingBottom: 50, backgroundColor: PC.white }}>

      <PdfFooter moduloCodigo="M8" />

      <PdfPageFrame>
        <PdfHeader
          titulo="REGISTRO DE FERTILIZACIÓN"
          subtitulo={`Formato operativo | ${rancho}`}
          codigoFormato={codigoFmt}
          folio={folio}
          fecha={emision}
        />

        <View style={{ padding: 14 }}>

          <PdfSectionBanner>1. DATOS DEL SITIO Y JORNADA</PdfSectionBanner>
          <PdfFieldGrid>
            <PdfFieldRow>
              <PdfField label={terminoSitio} value={rancho} />
              <PdfField label="Código" value={ranchoCodigo || '—'} />
              <PdfField label="Sector" value={sector ?? '—'} />
              <PdfField label="Fecha de registro" value={formatFechaPDF(fecha)} />
              <PdfField label="Total fertilizantes" value={String(fertilizantes.length)} />
            </PdfFieldRow>
          </PdfFieldGrid>

          <PdfSectionBanner>2. FERTILIZANTES APLICADOS</PdfSectionBanner>
          <PdfTable columns={COLS}>
            {fertilizantes.length === 0 ? (
              <PdfTableRow>
                <PdfTableCell width={763} align="center">Sin fertilizantes registrados</PdfTableCell>
              </PdfTableRow>
            ) : (
              fertilizantes.map((f, i) => (
                <PdfTableRow key={i} alt={i % 2 !== 0}>
                  <PdfTableCell width={COLS[0].width} align="left">{f.nombre_comercial}</PdfTableCell>
                  <PdfTableCell width={COLS[1].width} align="left">
                    {f.ingrediente_activo ?? '—'}{f.concentracion ? ` ${f.concentracion}` : ''}
                  </PdfTableCell>
                  <PdfTableCell width={COLS[2].width}>{f.metodo}</PdfTableCell>
                  <PdfTableCell width={COLS[3].width}>{String(f.superficie_ha)}</PdfTableCell>
                  <PdfTableCell width={COLS[4].width}>{String(f.dosis_kg_l_ha)}</PdfTableCell>
                  <PdfTableCell width={COLS[5].width}>{f.cantidad_total.toFixed(2)}</PdfTableCell>
                </PdfTableRow>
              ))
            )}
          </PdfTable>

          <PdfSectionBanner>3. FIRMAS Y RESPONSABLES</PdfSectionBanner>
          <PdfSignatures
            signatures={[
              { label: 'Realizó la aplicación', nombre: responsableNombre, caption: 'Firma' },
              { label: '', nombre: '', caption: 'Responsable de Inocuidad — Firma' },
            ]}
          />

        </View>
      </PdfPageFrame>

    </Page>
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
