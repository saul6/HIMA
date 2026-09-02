// PATRÓN INOCUIDAD — PDF M27 (plantilla homogénea M.A.D.Y)
// Preparación de Cloro a 200 ppm — A4 portrait.
// PdfPageFrame + PdfHeader + tabla de preparaciones + PdfSignatures.

import { Document, Page, View, Text } from '@react-pdf/renderer'
import { PdfPageFrame, PdfFooter } from '@/lib/pdf/components/PdfPage'
import { PdfHeader } from '@/lib/pdf/components/PdfHeader'
import { PdfSectionBanner } from '@/lib/pdf/components/PdfSectionBanner'
import { PdfFieldGrid, PdfFieldRow, PdfField } from '@/lib/pdf/components/PdfFieldGrid'
import { PdfTable, PdfTableRow, PdfTableCell } from '@/lib/pdf/components/PdfTable'
import { PdfSignatures } from '@/lib/pdf/components/PdfSignatures'
import { codigoFormato } from '@/lib/codigoFormato'
import { PC } from '@/lib/pdf/components/tokens'

// ── Tipos ─────────────────────────────────────────────────────────────────────

export interface PreparacionPDFRow {
  fecha: string
  area: string
  litros_agua: number
  ml_cloro: number
  responsable: string | null
  observaciones: string | null
}

export interface PreparacionCloroPaginaProps {
  rancho: string
  orgNombre?: string | null
  desde: string
  hasta: string
  preparaciones: PreparacionPDFRow[]
  codigoClave: string
  terminoSitio?: string
}

// ── Helpers ───────────────────────────────────────────────────────────────────

function fmt(iso: string): string {
  try {
    return new Date(iso + 'T12:00:00').toLocaleDateString('es-MX', {
      day: '2-digit', month: 'short', year: 'numeric',
    })
  } catch { return iso }
}

// Anchos de columna — contenido portrait PdfPageFrame ≈ 517pt
const W_N    = 20
const W_FECHA = 60
const W_AREA  = 160
const W_LITROS = 44
const W_ML    = 44
const W_RESP  = 100
const W_OBS   = 89
// Total: 20+60+160+44+44+100+89 = 517pt

// ── PreparacionCloroPagina ────────────────────────────────────────────────────

export function PreparacionCloroPagina({
  rancho, orgNombre, desde, hasta, preparaciones, codigoClave, terminoSitio = 'Instalación',
}: PreparacionCloroPaginaProps) {
  const emision = new Date().toLocaleDateString('es-MX')
  const codigoFmt = codigoFormato('F-FRUS-SAN-03', codigoClave)
  const periodoLabel = desde === hasta ? fmt(desde) : `${fmt(desde)} — ${fmt(hasta)}`
  const totalLabel = String(preparaciones.length)

  return (
    <Page
      size="A4"
      orientation="portrait"
      style={{ fontFamily: 'Helvetica', fontSize: 9, padding: 24, paddingBottom: 50, backgroundColor: PC.white }}
    >
      <PdfFooter moduloCodigo="M27" />

      <PdfPageFrame>
        <PdfHeader
          titulo="PREPARACIÓN DE CLORO A 200 ppm"
          subtitulo={`Formato operativo | ${rancho}`}
          codigoFormato={codigoFmt}
          folio={desde}
          fecha={emision}
        />

        <View style={{ padding: 14 }}>

          <PdfSectionBanner>1. Datos generales</PdfSectionBanner>
          <PdfFieldGrid>
            <PdfFieldRow>
              {orgNombre ? <PdfField label="Organización" value={orgNombre} /> : null}
              <PdfField label={terminoSitio} value={rancho} />
              <PdfField label="Periodo" value={periodoLabel} />
              <PdfField label="Total de preparaciones" value={totalLabel} />
            </PdfFieldRow>
          </PdfFieldGrid>

          <PdfSectionBanner>2. Registro de preparaciones</PdfSectionBanner>

          <View style={{ marginTop: 6 }}>
            <PdfTable
              columns={[
                { label: 'N.', width: W_N },
                { label: 'Fecha', width: W_FECHA },
                { label: 'Area / Punto de aplicacion', width: W_AREA },
                { label: 'Litros agua', width: W_LITROS },
                { label: 'mL cloro', width: W_ML },
                { label: 'Responsable', width: W_RESP },
                { label: 'Observaciones', width: W_OBS },
              ]}
            >
              {preparaciones.length === 0 ? (
                <PdfTableRow>
                  <PdfTableCell width={W_N + W_FECHA + W_AREA + W_LITROS + W_ML + W_RESP + W_OBS} align="center">
                    Sin registros
                  </PdfTableCell>
                </PdfTableRow>
              ) : (
                preparaciones.map((p, i) => (
                  <PdfTableRow key={i} alt={i % 2 === 1}>
                    <PdfTableCell width={W_N} align="center">{String(i + 1)}</PdfTableCell>
                    <PdfTableCell width={W_FECHA}>{fmt(p.fecha)}</PdfTableCell>
                    <PdfTableCell width={W_AREA} align="left">{p.area}</PdfTableCell>
                    <PdfTableCell width={W_LITROS} align="center">{String(p.litros_agua)} L</PdfTableCell>
                    <PdfTableCell width={W_ML} align="center">{String(p.ml_cloro)} mL</PdfTableCell>
                    <PdfTableCell width={W_RESP} align="left">{p.responsable ?? ''}</PdfTableCell>
                    <PdfTableCell width={W_OBS} align="left">{p.observaciones ?? ''}</PdfTableCell>
                  </PdfTableRow>
                ))
              )}
            </PdfTable>
          </View>

          {/* Nota de fórmula */}
          <View style={{ marginTop: 10, padding: 8, borderWidth: 1, borderColor: '#E0C860', borderRadius: 3, backgroundColor: '#FFFDE7' }}>
            <Text style={{ fontSize: 7, color: '#6D4C00', lineHeight: 1.4 }}>
              Nota: Para obtener 200 ppm con cloro comercial (~6%): 3.33 mL de cloro por litro de agua.{'\n'}
              Formula: mL de cloro = Litros de agua x 10/3
            </Text>
          </View>

          <PdfSectionBanner>3. Firmas y responsables</PdfSectionBanner>
          <PdfSignatures
            signatures={[
              { label: 'Elaboro', nombre: '', caption: 'Firma' },
              { label: '', nombre: '', caption: 'Verifico — Responsable de Inocuidad — Firma' },
            ]}
          />

        </View>
      </PdfPageFrame>
    </Page>
  )
}

// ── PreparacionCloroPDF ───────────────────────────────────────────────────────

export function PreparacionCloroPDF(props: PreparacionCloroPaginaProps) {
  return (
    <Document
      title={`Preparacion de Cloro ${props.rancho} ${props.desde}`}
      author="M.A.D.Y."
      creator="M.A.D.Y. Inocuidad Inteligente"
      producer="M.A.D.Y. Inocuidad Inteligente"
      subject={`Preparacion de Cloro a 200 ppm — ${codigoFormato('F-FRUS-SAN-03', props.codigoClave)}`}
      keywords="MADY, inocuidad, cloro, preparacion, desinfeccion"
    >
      <PreparacionCloroPagina {...props} />
    </Document>
  )
}
