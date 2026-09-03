// PATRÓN INOCUIDAD — PDF M39 Almacén (plantilla homogénea M.A.D.Y)
// Recepción diaria de fruta (variante Almacén) — A4 landscape, layout operativo.

import { Document, Page, View, Text } from '@react-pdf/renderer'
import { TopBar, PdfFooter } from '@/lib/pdf/components/PdfPage'
import { PdfHeader } from '@/lib/pdf/components/PdfHeader'
import { PdfSectionBanner } from '@/lib/pdf/components/PdfSectionBanner'
import { PdfFieldGrid, PdfFieldRow, PdfField } from '@/lib/pdf/components/PdfFieldGrid'
import { PdfSignatures } from '@/lib/pdf/components/PdfSignatures'
import { codigoFormato } from '@/lib/codigoFormato'
import { PC } from '@/lib/pdf/components/tokens'

export interface M39LineaAlmacenPDF {
  orden: number
  hora: string | null
  cultivo: string | null
  cajas: number | null
  piezas: number | null
  entrega: string | null
  limp_be: boolean | null
  limp_l: boolean | null
  limp_lp: boolean | null
  codigo_trazabilidad: string | null
}

export interface M39RecepcionAlmacenDataPDF {
  orgNombre: string
  instalacion: string
  fecha: string
  hoja_no: string | null
  empresa: string | null
  observaciones: string | null
  lineas: M39LineaAlmacenPDF[]
}

const MARGIN     = 20
const ROW_ALT    = '#F5F9FE'
const TRAZ_FILL  = '#E8F5E9'
const TRAZ_BORD  = '#A5D6A7'
const TRAZ_TEXT  = '#1B5E20'

function fmtFecha(iso: string): string {
  try { const [y, m, d] = iso.split('-'); return `${d}/${m}/${y}` } catch { return iso }
}
const t  = (v: string | null | undefined): string => v ?? '—'
const n  = (v: number | null | undefined): string => v != null ? String(v) : '—'
const b3 = (v: boolean | null): string => v === true ? 'Si' : v === false ? 'No' : '—'

const TH = {
  padding: 3,
  backgroundColor: PC.section,
  borderRightWidth: 1,
  borderRightColor: '#5599CC',
  borderBottomWidth: 1,
  borderBottomColor: '#5599CC',
  justifyContent: 'center',
  alignItems: 'center',
} as const

const TD = {
  padding: 3,
  borderRightWidth: 1,
  borderRightColor: PC.border,
  justifyContent: 'center',
} as const

export function RecepcionFrutaAlmacenPDF({
  d, codigoClave, terminoSitio = 'Instalación',
}: {
  d: M39RecepcionAlmacenDataPDF
  codigoClave: string
  terminoSitio?: string
}) {
  const emision    = new Date().toLocaleDateString('es-MX')
  const codigoFmt  = codigoFormato('F-FRUS-PRO-02', codigoClave)
  const fechaLabel = fmtFecha(d.fecha)

  const invCultivo: Record<string, { cajas: number; piezas: number }> = {}
  for (const l of d.lineas) {
    const k = l.cultivo?.trim() || 'Sin cultivo'
    if (!invCultivo[k]) invCultivo[k] = { cajas: 0, piezas: 0 }
    invCultivo[k].cajas  += l.cajas  ?? 0
    invCultivo[k].piezas += l.piezas ?? 0
  }
  const cultivoEntries = Object.entries(invCultivo)

  return (
    <Document
      title={`Recepcion Diaria de Fruta ${fechaLabel}`}
      author="M.A.D.Y."
      creator="M.A.D.Y. Inocuidad Inteligente"
      producer="M.A.D.Y. Inocuidad Inteligente"
      subject={`Recepción Diaria de Fruta — ${d.instalacion}`}
      keywords="MADY, inocuidad, recepcion, fruta, trazabilidad, almacen"
    >
      <Page
        size="A4"
        orientation="landscape"
        style={{ fontFamily: 'Helvetica', fontSize: 7, padding: MARGIN, paddingBottom: 50, backgroundColor: PC.white }}
      >
        <PdfFooter moduloCodigo="M39" />
        <TopBar />
        <PdfHeader
          titulo="RECEPCIÓN DIARIA DE FRUTA"
          subtitulo={`Formato operativo | ${d.instalacion}`}
          codigoFormato={codigoFmt}
          folio={fechaLabel}
          fecha={emision}
        />

        <PdfSectionBanner>1. Datos de recepción</PdfSectionBanner>
        <PdfFieldGrid>
          <PdfFieldRow>
            <PdfField label={terminoSitio} value={d.instalacion} />
            <PdfField label="Empresa" value={d.empresa || '—'} />
            <PdfField label="Fecha" value={fechaLabel} />
            {d.hoja_no ? <PdfField label="Hoja No." value={d.hoja_no} /> : null}
          </PdfFieldRow>
        </PdfFieldGrid>

        <PdfSectionBanner>2. Líneas de recepción</PdfSectionBanner>

        {d.lineas.map((linea, idx) => (
          <View key={idx} style={{ marginBottom: 5, borderWidth: 1, borderColor: PC.border }}>
            {/* Line label */}
            <View style={{ backgroundColor: PC.folioBox, paddingVertical: 3, paddingHorizontal: 5, borderBottomWidth: 1, borderBottomColor: PC.border }}>
              <Text style={{ fontSize: 7, fontFamily: 'Helvetica-Bold', color: PC.titleNavy }}>
                {`Línea de recepción ${String(linea.orden).padStart(2, '0')}`}
              </Text>
            </View>

            {/* Column headers */}
            <View style={{ flexDirection: 'row' }}>
              <View style={[TH, { width: 50 }]}>
                <Text style={{ fontSize: 6, fontFamily: 'Helvetica-Bold', color: PC.white }}>Hora</Text>
              </View>
              <View style={[TH, { flex: 1 }]}>
                <Text style={{ fontSize: 6, fontFamily: 'Helvetica-Bold', color: PC.white }}>Cultivo</Text>
              </View>
              <View style={[TH, { width: 50 }]}>
                <Text style={{ fontSize: 6, fontFamily: 'Helvetica-Bold', color: PC.white }}>Cajas</Text>
              </View>
              <View style={[TH, { width: 50 }]}>
                <Text style={{ fontSize: 6, fontFamily: 'Helvetica-Bold', color: PC.white }}>Piezas</Text>
              </View>
              <View style={[TH, { width: 90 }]}>
                <Text style={{ fontSize: 6, fontFamily: 'Helvetica-Bold', color: PC.white }}>Entrega</Text>
              </View>
              <View style={[TH, { width: 48 }]}>
                <Text style={{ fontSize: 6, fontFamily: 'Helvetica-Bold', color: PC.white }}>Limp. BE</Text>
              </View>
              <View style={[TH, { width: 48 }]}>
                <Text style={{ fontSize: 6, fontFamily: 'Helvetica-Bold', color: PC.white }}>Limp. L</Text>
              </View>
              <View style={[TH, { width: 48, borderRightWidth: 0 }]}>
                <Text style={{ fontSize: 6, fontFamily: 'Helvetica-Bold', color: PC.white }}>Limp. LP</Text>
              </View>
            </View>

            {/* Data row */}
            <View style={{ flexDirection: 'row' }}>
              <View style={[TD, { width: 50 }]}>
                <Text style={{ fontSize: 7, color: PC.fieldValue }}>{t(linea.hora)}</Text>
              </View>
              <View style={[TD, { flex: 1 }]}>
                <Text style={{ fontSize: 7, color: PC.fieldValue }}>{t(linea.cultivo)}</Text>
              </View>
              <View style={[TD, { width: 50 }]}>
                <Text style={{ fontSize: 7, color: PC.fieldValue, textAlign: 'center' }}>{n(linea.cajas)}</Text>
              </View>
              <View style={[TD, { width: 50 }]}>
                <Text style={{ fontSize: 7, color: PC.fieldValue, textAlign: 'center' }}>{n(linea.piezas)}</Text>
              </View>
              <View style={[TD, { width: 90 }]}>
                <Text style={{ fontSize: 7, color: PC.fieldValue }}>{t(linea.entrega)}</Text>
              </View>
              <View style={[TD, { width: 48 }]}>
                <Text style={{ fontSize: 7, color: PC.fieldValue, textAlign: 'center' }}>{b3(linea.limp_be)}</Text>
              </View>
              <View style={[TD, { width: 48 }]}>
                <Text style={{ fontSize: 7, color: PC.fieldValue, textAlign: 'center' }}>{b3(linea.limp_l)}</Text>
              </View>
              <View style={[TD, { width: 48, borderRightWidth: 0 }]}>
                <Text style={{ fontSize: 7, color: PC.fieldValue, textAlign: 'center' }}>{b3(linea.limp_lp)}</Text>
              </View>
            </View>

            {/* Trazabilidad — highlighted */}
            <View style={{
              backgroundColor: TRAZ_FILL,
              borderTopWidth: 1,
              borderTopColor: TRAZ_BORD,
              paddingVertical: 5,
              paddingHorizontal: 6,
              flexDirection: 'row',
              alignItems: 'center',
            }}>
              <Text style={{ fontSize: 6, fontFamily: 'Helvetica-Bold', color: PC.textSub, marginRight: 8 }}>
                Código de trazabilidad:
              </Text>
              <Text style={{ fontSize: 9, fontFamily: 'Helvetica-Bold', color: TRAZ_TEXT }}>
                {linea.codigo_trazabilidad || '—'}
              </Text>
            </View>
          </View>
        ))}

        {cultivoEntries.length > 0 && (
          <>
            <PdfSectionBanner>3. Inventario por cultivo</PdfSectionBanner>
            <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 6, marginTop: 4, marginBottom: 4 }}>
              {cultivoEntries.map(([cultivo, tot], idx) => (
                <View key={cultivo} style={{ minWidth: 110, borderWidth: 1, borderColor: PC.border, backgroundColor: idx % 2 === 0 ? PC.white : ROW_ALT }}>
                  <View style={{ backgroundColor: PC.section, paddingVertical: 3, paddingHorizontal: 5 }}>
                    <Text style={{ fontSize: 6.5, fontFamily: 'Helvetica-Bold', color: PC.white }}>{cultivo}</Text>
                  </View>
                  <View style={{ padding: 5 }}>
                    <View style={{ flexDirection: 'row', justifyContent: 'space-between', marginBottom: 2 }}>
                      <Text style={{ fontSize: 6, color: PC.textSub }}>Cajas:</Text>
                      <Text style={{ fontSize: 7, fontFamily: 'Helvetica-Bold', color: PC.fieldValue }}>{tot.cajas}</Text>
                    </View>
                    <View style={{ flexDirection: 'row', justifyContent: 'space-between' }}>
                      <Text style={{ fontSize: 6, color: PC.textSub }}>Piezas:</Text>
                      <Text style={{ fontSize: 7, fontFamily: 'Helvetica-Bold', color: PC.fieldValue }}>{tot.piezas}</Text>
                    </View>
                  </View>
                </View>
              ))}
            </View>
          </>
        )}

        {d.observaciones ? (
          <View style={{ borderWidth: 1, borderColor: PC.border, padding: 4, marginTop: 4, marginBottom: 4 }}>
            <Text style={{ fontSize: 5.5, color: PC.textSub, fontFamily: 'Helvetica-Bold', marginBottom: 2 }}>OBSERVACIONES</Text>
            <Text style={{ fontSize: 6.5, color: PC.fieldValue }}>{d.observaciones}</Text>
          </View>
        ) : null}

        <PdfSectionBanner>4. Firmas y responsables</PdfSectionBanner>
        <PdfSignatures
          signatures={[
            { label: '', nombre: '', caption: 'Responsable de Empaque — Firma' },
            { label: '', nombre: '', caption: 'Responsable de la Empresa — Firma' },
          ]}
        />
      </Page>
    </Document>
  )
}
