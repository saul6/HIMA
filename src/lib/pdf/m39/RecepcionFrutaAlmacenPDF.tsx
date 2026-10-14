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
import type { FirmaParaPdf } from '@/hooks/useFirmasRegistro'
import { partirPalabraLarga } from '@/lib/pdf/components/texto'

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
} as const

export function RecepcionFrutaAlmacenPDF({
  d, codigoClave, terminoSitio = 'Instalación',
  firmaRealizo, firmaVerifico,
}: {
  d: M39RecepcionAlmacenDataPDF
  codigoClave: string
  terminoSitio?: string
  firmaRealizo?: FirmaParaPdf | null
  firmaVerifico?: FirmaParaPdf | null
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

        <View style={{ borderWidth: 1, borderColor: PC.border, marginTop: 4, marginBottom: 6 }}>
          <View style={{ flexDirection: 'row' }} fixed>
            {[
              { w: 28, l: 'No.' }, { w: 45, l: 'Hora' }, { w: 0, l: 'Cultivo' }, { w: 50, l: 'Cajas' },
              { w: 50, l: 'Piezas' }, { w: 120, l: 'Entrega' }, { w: 45, l: 'Limp. BE' },
              { w: 45, l: 'Limp. L' }, { w: 45, l: 'Limp. LP' }, { w: 170, l: 'Código de trazabilidad', last: true },
            ].map((c) => (
              <View key={c.l} style={[TH, c.w ? { width: c.w } : { flex: 1 }, c.last ? { borderRightWidth: 0 } : {}]}>
                <Text style={{ fontSize: 7, fontFamily: 'Helvetica-Bold', color: PC.white }}>{c.l}</Text>
              </View>
            ))}
          </View>
          {d.lineas.map((linea, idx) => (
            <View key={idx} wrap={false} style={{ flexDirection: 'row', backgroundColor: idx % 2 === 1 ? ROW_ALT : PC.white, borderBottomWidth: 1, borderBottomColor: PC.border }}>
              <View style={[TD, { width: 28 }]}><Text style={{ fontSize: 8, color: PC.fieldValue, textAlign: 'center' }}>{linea.orden}</Text></View>
              <View style={[TD, { width: 45 }]}><Text style={{ fontSize: 8, color: PC.fieldValue }}>{t(linea.hora)}</Text></View>
              <View style={[TD, { flex: 1 }]}><Text style={{ fontSize: 8, color: PC.fieldValue }} hyphenationCallback={partirPalabraLarga}>{t(linea.cultivo)}</Text></View>
              <View style={[TD, { width: 50 }]}><Text style={{ fontSize: 8, color: PC.fieldValue, textAlign: 'center' }}>{n(linea.cajas)}</Text></View>
              <View style={[TD, { width: 50 }]}><Text style={{ fontSize: 8, color: PC.fieldValue, textAlign: 'center' }}>{n(linea.piezas)}</Text></View>
              <View style={[TD, { width: 120 }]}><Text style={{ fontSize: 8, color: PC.fieldValue }} hyphenationCallback={partirPalabraLarga}>{t(linea.entrega)}</Text></View>
              <View style={[TD, { width: 45 }]}><Text style={{ fontSize: 8, color: PC.fieldValue, textAlign: 'center' }}>{b3(linea.limp_be)}</Text></View>
              <View style={[TD, { width: 45 }]}><Text style={{ fontSize: 8, color: PC.fieldValue, textAlign: 'center' }}>{b3(linea.limp_l)}</Text></View>
              <View style={[TD, { width: 45 }]}><Text style={{ fontSize: 8, color: PC.fieldValue, textAlign: 'center' }}>{b3(linea.limp_lp)}</Text></View>
              <View style={[TD, { width: 170, backgroundColor: TRAZ_FILL, borderRightWidth: 0 }]}>
                <Text style={{ fontSize: 8.5, fontFamily: 'Helvetica-Bold', color: TRAZ_TEXT }} hyphenationCallback={partirPalabraLarga}>{linea.codigo_trazabilidad || '—'}</Text>
              </View>
            </View>
          ))}
        </View>

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
            <Text style={{ fontSize: 8, color: PC.section, fontFamily: 'Helvetica-Bold', marginBottom: 2 }}>OBSERVACIONES</Text>
            <Text style={{ fontSize: 8, color: PC.fieldValue }} hyphenationCallback={partirPalabraLarga}>{d.observaciones}</Text>
          </View>
        ) : null}

        <View wrap={false}>
        <PdfSectionBanner>4. Firmas y responsables</PdfSectionBanner>
        <PdfSignatures
          signatures={[
            { label: '', nombre: '', caption: 'Responsable de Empaque — Firma', firma: firmaRealizo ?? null },
            { label: '', nombre: '', caption: 'Responsable de la Empresa — Firma', firma: firmaVerifico ?? null },
          ]}
        />
        </View>
      </Page>
    </Document>
  )
}
