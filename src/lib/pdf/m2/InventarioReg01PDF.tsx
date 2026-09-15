import { Document, Page, View, Text } from '@react-pdf/renderer'
import { PdfPageFrame, PdfFooter } from '@/lib/pdf/components/PdfPage'
import { PdfHeader } from '@/lib/pdf/components/PdfHeader'
import { PdfSectionBanner } from '@/lib/pdf/components/PdfSectionBanner'
import { PdfFieldGrid, PdfFieldRow, PdfField } from '@/lib/pdf/components/PdfFieldGrid'
import { PdfTable, PdfTableRow, PdfTableCell } from '@/lib/pdf/components/PdfTable'
import { PC } from '@/lib/pdf/components/tokens'
import type { InventarioMovimiento } from '@/types/database.types'

const v = (s: string | number | null | undefined, fallback = '—') =>
  s != null && s !== '' ? String(s) : fallback

const fmtN = (n: number | null | undefined) =>
  n == null ? '' : Number.isInteger(Number(n)) ? String(Number(n)) : Number(n).toFixed(2)

const INV_COLS = [
  { label: 'Fecha', width: 100 },
  { label: 'Entrada', width: 120 },
  { label: 'Salida', width: 120 },
  { label: 'Existencia', width: 120 },
]

export interface GrupoProductoReg01 {
  productoId: string
  nombreComercial: string
  unidad: string | null
  movimientos: InventarioMovimiento[]
}

export interface InventarioReg01PDFProps {
  orgNombre: string
  ranchoNombre: string
  cultivo: string | null
  grupos: GrupoProductoReg01[]
  desde?: string
  hasta?: string
}

export function InventarioReg01PDF({
  orgNombre,
  ranchoNombre,
  cultivo,
  grupos,
  desde,
  hasta,
}: InventarioReg01PDFProps) {
  const emision = new Date().toLocaleDateString('es-MX')
  const rango = desde && hasta ? ` | ${desde} al ${hasta}` : ''

  return (
    <Document
      title="Inventario de Insumos — GlobalG.A.P. REG-01"
      subject={`REG-01 GlobalG.A.P. v6 - ${ranchoNombre}`}
      author="M.A.D.Y."
      creator="M.A.D.Y. Inocuidad Inteligente"
      producer="M.A.D.Y. Inocuidad Inteligente"
      keywords="MADY, inocuidad, GlobalGAP, REG-01, inventario"
    >
      <Page
        size="A4"
        style={{
          fontFamily: 'Helvetica',
          fontSize: 9,
          padding: 24,
          paddingBottom: 50,
          backgroundColor: PC.white,
        }}
      >
        <PdfFooter moduloCodigo="REG-01 · GlobalG.A.P. v6" />
        <PdfPageFrame>
          <PdfHeader
            titulo="INVENTARIO DE INSUMOS"
            subtitulo={`REG-01 · GlobalG.A.P. v6 | ${ranchoNombre}${rango}`}
            codigoFormato="GG-REG-01"
            folio={emision}
            fecha={emision}
          />

          <View style={{ padding: 14 }}>
            <PdfSectionBanner>DATOS GENERALES</PdfSectionBanner>
            <PdfFieldGrid>
              <PdfFieldRow>
                <PdfField label="Compania" value={v(orgNombre)} />
                <PdfField label="Rancho / Huerto" value={v(ranchoNombre)} />
              </PdfFieldRow>
              <PdfFieldRow>
                <PdfField label="Cultivo" value={v(cultivo)} fullWidth />
              </PdfFieldRow>
            </PdfFieldGrid>

            <View
              style={{
                marginTop: 8,
                marginBottom: 4,
                padding: 6,
                backgroundColor: PC.folioBox,
                borderRadius: 4,
              }}
            >
              <Text style={{ fontSize: 7, color: PC.textSub, fontFamily: 'Helvetica-Oblique' }}>
                Inventario debe ser actualizado al menos semanalmente o cada que sea necesario.
              </Text>
            </View>

            {grupos.map((g) => (
              <View key={g.productoId}>
                <PdfSectionBanner>
                  {g.nombreComercial}{g.unidad ? ` | Unidad: ${g.unidad}` : ''}
                </PdfSectionBanner>
                <PdfTable columns={INV_COLS}>
                  {g.movimientos.length === 0 ? (
                    <PdfTableRow>
                      <View
                        style={{
                          flex: 1,
                          borderRightWidth: 1,
                          borderRightColor: PC.border,
                          borderBottomWidth: 1,
                          borderBottomColor: PC.border,
                          padding: 6,
                        }}
                      >
                        <Text style={{ fontSize: 8, color: PC.fieldLabel, textAlign: 'center' }}>
                          Sin movimientos
                        </Text>
                      </View>
                    </PdfTableRow>
                  ) : (
                    g.movimientos.map((m, i) => {
                      const entrada =
                        m.tipo === 'entrada'
                          ? fmtN(m.cantidad)
                          : m.tipo === 'ajuste'
                          ? `Aj. +${fmtN(m.cantidad)}`
                          : ''
                      const salida = m.tipo === 'salida' ? fmtN(m.cantidad) : ''
                      return (
                        <PdfTableRow key={m.id} alt={i % 2 !== 0}>
                          <PdfTableCell width={INV_COLS[0].width}>{v(m.fecha)}</PdfTableCell>
                          <PdfTableCell width={INV_COLS[1].width}>{entrada}</PdfTableCell>
                          <PdfTableCell width={INV_COLS[2].width}>{salida}</PdfTableCell>
                          <PdfTableCell width={INV_COLS[3].width}>{fmtN(m.balance)}</PdfTableCell>
                        </PdfTableRow>
                      )
                    })
                  )}
                </PdfTable>
              </View>
            ))}

            {grupos.length === 0 && (
              <View style={{ padding: 20, alignItems: 'center' }}>
                <Text style={{ fontSize: 9, color: PC.fieldLabel }}>
                  Sin movimientos en el periodo seleccionado.
                </Text>
              </View>
            )}
          </View>
        </PdfPageFrame>
      </Page>
    </Document>
  )
}
