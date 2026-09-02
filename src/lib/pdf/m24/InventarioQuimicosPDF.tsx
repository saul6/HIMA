// PATRÓN INOCUIDAD — PDF M24 (plantilla homogénea M.A.D.Y)
// Control de Inventario de Químicos e Insumos — A4 portrait.
// PdfPageFrame + PdfHeader + tabla de movimientos + 3 firmas.

import { Document, Page, View, Text } from '@react-pdf/renderer'
import { PdfPageFrame, PdfFooter } from '@/lib/pdf/components/PdfPage'
import { PdfHeader } from '@/lib/pdf/components/PdfHeader'
import { PdfSectionBanner } from '@/lib/pdf/components/PdfSectionBanner'
import { PdfFieldGrid, PdfFieldRow, PdfField } from '@/lib/pdf/components/PdfFieldGrid'
import { PdfSignatures } from '@/lib/pdf/components/PdfSignatures'
import { PC } from '@/lib/pdf/components/tokens'

// ── Tipos ─────────────────────────────────────────────────────────────────────

export interface MovimientoPDF {
  fecha: string
  persona_solicita: string
  area: string
  tipo: 'entrada' | 'salida'
  cantidad: number
}

export interface InventarioQuimicosProps {
  instalacion: string
  quimicoNombre: string
  unidad: string
  movimientos: MovimientoPDF[]
  consolidado?: boolean
  desde?: string
  hasta?: string
  codigoClave: string
  terminoSitio?: string
}

// ── Helpers ───────────────────────────────────────────────────────────────────

function fmt(f: string): string {
  if (!f) return '—'
  const [y, m, d] = f.split('-')
  return `${d}/${m}/${y}`
}

function calcSaldo(movs: MovimientoPDF[]) {
  let saldo = 0
  return movs.map(m => {
    saldo = m.tipo === 'entrada' ? saldo + m.cantidad : saldo - m.cantidad
    return { ...m, saldo }
  })
}

// ── Anchos de columna (contenido portrait PdfPageFrame ≈ 517pt) ───────────────

const W_FECHA   = 52
const W_PERSONA = 130
const W_AREA    = 100
const W_ENT     = 52
const W_SAL     = 52
const W_TOT     = 52
// Total: 438pt — cabe bien dentro de 517pt

// ── Estilos de tabla ──────────────────────────────────────────────────────────

const thCell = {
  color: PC.white,
  fontFamily: 'Helvetica-Bold' as const,
  fontSize: 7,
  paddingTop: 5,
  paddingBottom: 5,
  paddingLeft: 5,
  paddingRight: 5,
  borderRightWidth: 1,
  borderRightColor: '#5599CC',
  borderBottomWidth: 1,
  borderBottomColor: '#5599CC',
  textAlign: 'center' as const,
}

const tdCell = {
  fontSize: 8,
  paddingTop: 4,
  paddingBottom: 4,
  paddingLeft: 5,
  paddingRight: 5,
  borderRightWidth: 1,
  borderRightColor: PC.border,
  borderBottomWidth: 1,
  borderBottomColor: PC.border,
  color: PC.fieldValue,
}

// ── InventarioQuimicosPagina ──────────────────────────────────────────────────

export function InventarioQuimicosPagina({
  instalacion, quimicoNombre, unidad, movimientos,
  consolidado, desde, hasta, codigoClave, terminoSitio = 'Instalación',
}: InventarioQuimicosProps) {
  const emision = new Date().toLocaleDateString('es-MX')
  const codigoFmt = `${codigoClave}-F-SC-SIG`

  const filas = calcSaldo(movimientos)
  const periodo = consolidado && desde && hasta
    ? `${fmt(desde)} al ${fmt(hasta)}`
    : filas.length > 0
      ? `${fmt(filas[0].fecha)} al ${fmt(filas[filas.length - 1].fecha)}`
      : '—'

  return (
    <Page
      size="A4"
      orientation="portrait"
      style={{ fontFamily: 'Helvetica', fontSize: 9, padding: 24, paddingBottom: 50, backgroundColor: PC.white }}
    >
      <PdfFooter moduloCodigo="M24" />

      <PdfPageFrame>
        <PdfHeader
          titulo="CONTROL DE INVENTARIO DE QUIMICOS E INSUMOS"
          subtitulo={`Formato operativo | ${instalacion}`}
          codigoFormato={codigoFmt}
          folio={emision}
          fecha={emision}
        />

        <View style={{ padding: 14 }}>

          <PdfSectionBanner>1. Datos del inventario</PdfSectionBanner>
          <PdfFieldGrid>
            <PdfFieldRow>
              <PdfField label={terminoSitio} value={instalacion} />
              <PdfField label="Periodo" value={periodo} />
            </PdfFieldRow>
            <PdfFieldRow>
              <PdfField label="Quimico / Insumo" value={quimicoNombre} />
              <PdfField label="Unidad" value={unidad} />
            </PdfFieldRow>
          </PdfFieldGrid>

          <PdfSectionBanner>2. Movimientos</PdfSectionBanner>

          <View style={{
            borderLeftWidth: 1, borderLeftColor: PC.border,
            borderTopWidth: 1, borderTopColor: PC.border,
            marginTop: 6,
          }}>
            {/* Encabezado */}
            <View style={{ flexDirection: 'row', backgroundColor: PC.section }}>
              <Text style={[thCell, { width: W_FECHA }]}>Fecha</Text>
              <Text style={[thCell, { width: W_PERSONA }]}>Persona que solicita</Text>
              <Text style={[thCell, { width: W_AREA }]}>Area</Text>
              <Text style={[thCell, { width: W_ENT }]}>Entrada</Text>
              <Text style={[thCell, { width: W_SAL }]}>Salida</Text>
              <Text style={[thCell, { width: W_TOT, borderRightWidth: 0 }]}>Total</Text>
            </View>

            {/* Filas */}
            {filas.length === 0 ? (
              <View style={{ flexDirection: 'row', paddingVertical: 8, paddingHorizontal: 4 }}>
                <Text style={{ fontSize: 7, color: PC.textSub }}>Sin movimientos registrados</Text>
              </View>
            ) : (
              filas.map((f, i) => (
                <View key={i} style={{ flexDirection: 'row', backgroundColor: i % 2 !== 0 ? '#F5F9FE' : PC.white }}>
                  <Text style={[tdCell, { width: W_FECHA, textAlign: 'center' }]}>{fmt(f.fecha)}</Text>
                  <Text style={[tdCell, { width: W_PERSONA }]}>{f.persona_solicita}</Text>
                  <Text style={[tdCell, { width: W_AREA }]}>{f.area}</Text>
                  <Text style={[tdCell, { width: W_ENT, textAlign: 'center' }]}>
                    {f.tipo === 'entrada' ? String(f.cantidad) : ''}
                  </Text>
                  <Text style={[tdCell, { width: W_SAL, textAlign: 'center' }]}>
                    {f.tipo === 'salida' ? String(f.cantidad) : ''}
                  </Text>
                  <Text style={[tdCell, { width: W_TOT, textAlign: 'center', borderRightWidth: 0,
                    fontFamily: 'Helvetica-Bold', color: f.saldo < 0 ? '#C02A2A' : PC.fieldValue }]}>
                    {String(f.saldo)}
                  </Text>
                </View>
              ))
            )}
          </View>

          <PdfSectionBanner>3. Firmas y responsables</PdfSectionBanner>
          <PdfSignatures
            signatures={[
              { label: '', nombre: '', caption: 'Encargado de limpieza' },
              { label: '', nombre: '', caption: 'Gerente Administrativo' },
              { label: '', nombre: '', caption: 'Gerente General' },
            ]}
          />

        </View>
      </PdfPageFrame>
    </Page>
  )
}

// ── InventarioQuimicosPDF ─────────────────────────────────────────────────────

export function InventarioQuimicosPDF(props: InventarioQuimicosProps) {
  return (
    <Document
      title={`Inventario Quimicos ${props.quimicoNombre}`}
      author="M.A.D.Y."
      creator="M.A.D.Y. Inocuidad Inteligente"
      producer="M.A.D.Y. Inocuidad Inteligente"
      subject={`Control de Inventario de Químicos — ${props.instalacion}`}
      keywords="MADY, inocuidad, inventario, quimicos, insumos"
    >
      <InventarioQuimicosPagina {...props} />
    </Document>
  )
}
