// PATRÓN INOCUIDAD — PDF M45 (plantilla homogénea M.A.D.Y)
// Verificación y mantenimiento preventivo y correctivo — A4 landscape, matriz mensual extendida.

import { Document, Page, View, Text, Image } from '@react-pdf/renderer'
import { TopBar, PdfFooter } from '@/lib/pdf/components/PdfPage'
import { PdfSectionBanner } from '@/lib/pdf/components/PdfSectionBanner'
import { PdfFieldGrid, PdfFieldRow, PdfField } from '@/lib/pdf/components/PdfFieldGrid'
import { PdfLegend } from '@/lib/pdf/components/PdfLegend'
import { PdfSignatures } from '@/lib/pdf/components/PdfSignatures'
import { LOGO_MADY_PDF } from '@/lib/pdf/assets/logoMadyPdf'
import { codigoFormato } from '@/lib/codigoFormato'
import { PC } from '@/lib/pdf/components/tokens'

export interface M45ItemPDFRow {
  id: string
  nombre: string
  frecuencia: string | null
  orden: number
}

export interface M45AreaPDF {
  area: string
  items: M45ItemPDFRow[]
}

export interface M45AccionesPDF {
  revision_general: boolean
  cambio_aceites: boolean
  cambio_piezas: boolean
  revision_electrico: boolean
}

export interface M45PaginaProps {
  instalacion: string
  instalacionCodigo: string
  anio: number
  mes: number
  mesLabel: string
  observaciones: string | null
  areas: M45AreaPDF[]
  resultados: Record<string, Record<number, string>>
  acciones: Record<string, M45AccionesPDF>
  codigoClave: string
  terminoSitio?: string
}

export interface MttoPreventivoConsolidadoPDFProps {
  paginas: M45PaginaProps[]
  instalacionNombre: string
  desde: string
  hasta: string
}

const H_COLOR  = '#0D5A8F'
const N_COLOR  = '#C02A2A'
const ROW_ALT  = '#F5F9FE'

const MARGIN   = 15
const PAGE_W   = 841.89 - MARGIN * 2   // ~812

// Column widths: 183 + 52 + 28*4 + 15*31 = 812
const ITEM_COL = 183
const FREC_COL = 52
const ACT_COL  = 28
const DAY_COL  = 15

// Fixed compact header height: TopBar(8) + padding(5*2) + logo row(28) = ~46
const HDR_H    = 46

function diasDelMes(anio: number, mes: number): number[] {
  const total = new Date(anio, mes, 0).getDate()
  const arr: number[] = []
  for (let i = 1; i <= total; i++) arr.push(i)
  return arr
}

function frecLabel(f: string | null): string {
  if (!f) return ''
  if (f === 'diario')     return 'Diario'
  if (f === 'tercer_dia') return '3er dia'
  if (f === 'semanal')    return 'Semanal'
  if (f === 'quincenal')  return 'Quincenal'
  return f
}

function valorSym(v: string | undefined): string {
  if (v === 'hecho')    return 'H'
  if (v === 'no_hecho') return 'N'
  if (v === 'na')       return '—'
  return ''
}

function valorColor(v: string | undefined): string {
  if (v === 'hecho')    return H_COLOR
  if (v === 'no_hecho') return N_COLOR
  return PC.textSub
}

const colHdrStyle = {
  borderWidth: 1,
  borderColor: PC.border,
  backgroundColor: PC.section,
  paddingTop: 2,
  paddingBottom: 2,
  justifyContent: 'center',
  alignItems: 'center',
} as const

const itemCellStyle = {
  width: ITEM_COL,
  borderWidth: 1,
  borderColor: PC.border,
  paddingTop: 2,
  paddingBottom: 2,
  paddingLeft: 3,
  justifyContent: 'center',
} as const

const frecCellStyle = {
  width: FREC_COL,
  borderWidth: 1,
  borderColor: PC.border,
  paddingTop: 2,
  paddingBottom: 2,
  alignItems: 'center',
  justifyContent: 'center',
} as const

const dayCellStyle = {
  width: DAY_COL,
  borderWidth: 1,
  borderColor: PC.border,
  alignItems: 'center',
  justifyContent: 'center',
  paddingTop: 2,
  paddingBottom: 2,
} as const

const actCellStyle = {
  width: ACT_COL,
  borderWidth: 1,
  borderColor: PC.border,
  alignItems: 'center',
  justifyContent: 'center',
  paddingTop: 2,
  paddingBottom: 2,
} as const

const colHdrText = { fontSize: 5, fontFamily: 'Helvetica-Bold', color: PC.white, textAlign: 'center' } as const

function MttoPreventivoPaginaContent({
  instalacion, instalacionCodigo, anio, mes, mesLabel, observaciones,
  areas, resultados, acciones, codigoClave, terminoSitio = 'Instalación',
}: M45PaginaProps) {
  const codigoFmt = codigoFormato('F-FRUS-MTT-03', codigoClave)
  const dias = diasDelMes(anio, mes)

  return (
    <>
      {/* Compact fixed header — repeats on every sub-page */}
      <View fixed style={{ position: 'absolute', top: 0, left: 0, right: 0 }}>
        <TopBar />
        <View style={{
          flexDirection: 'row',
          alignItems: 'center',
          paddingHorizontal: MARGIN,
          paddingVertical: 5,
          borderBottomWidth: 1,
          borderBottomColor: PC.border,
          backgroundColor: PC.white,
        }}>
          <Image src={LOGO_MADY_PDF} style={{ height: 28, width: 79, marginRight: 10 }} />
          <View style={{ flex: 1, alignItems: 'center' }}>
            <Text style={{ fontFamily: 'Helvetica-Bold', fontSize: 8.5, color: PC.titleNavy, textAlign: 'center' }}>
              VERIFICACION, MANTENIMIENTO PREVENTIVO Y CORRECTIVO
            </Text>
            <Text style={{ fontSize: 5.5, color: PC.textSub, marginTop: 1, textAlign: 'center' }}>
              {`${codigoFmt}  |  ${instalacion}  |  ${mesLabel}`}
            </Text>
          </View>
          <View style={{ backgroundColor: PC.folioBox, borderRadius: 4, padding: 5, alignItems: 'flex-end', marginLeft: 10 }}>
            <Text style={{ fontSize: 9, fontFamily: 'Helvetica-Bold', color: PC.titleNavy }}>{mesLabel}</Text>
          </View>
        </View>
      </View>

      <PdfFooter moduloCodigo="M45" />

      {/* Section 1 — info grid */}
      <PdfSectionBanner>1. Datos del sitio y mes</PdfSectionBanner>
      <PdfFieldGrid>
        <PdfFieldRow>
          <PdfField label={terminoSitio} value={instalacion} />
          <PdfField label="Código" value={instalacionCodigo || '—'} />
          <PdfField label="Año" value={String(anio)} />
          <PdfField label="Mes" value={mesLabel} />
        </PdfFieldRow>
      </PdfFieldGrid>

      {/* Legend */}
      <PdfLegend entradas={[
        {
          titulo: 'Valores de registro',
          items: [
            { codigo: 'H', label: 'Hecho' },
            { codigo: 'N', label: 'No hecho' },
            { codigo: '—', label: 'N/A' },
            { codigo: 'X', label: 'Accion realizada' },
          ],
        },
        {
          titulo: 'Columnas de accion',
          items: [
            { codigo: 'Rev.Gral', label: 'Revision general' },
            { codigo: 'C.Aceit', label: 'Cambio de aceites' },
            { codigo: 'C.Pzas', label: 'Cambio de piezas' },
            { codigo: 'Rev.Elec', label: 'Revision electrica' },
          ],
        },
      ]} />

      {/* Section 2 — matrix */}
      <PdfSectionBanner>2. Actividades de verificación y mantenimiento</PdfSectionBanner>

      {areas.map((areaData) => (
        <View key={areaData.area}>
          {/* Area header */}
          <View style={{
            flexDirection: 'row',
            backgroundColor: PC.titleNavy,
            paddingTop: 3,
            paddingBottom: 3,
            paddingLeft: 5,
            marginTop: 5,
          }}>
            <Text style={{ fontSize: 7, fontFamily: 'Helvetica-Bold', color: PC.white }}>
              {areaData.area.toUpperCase()}
            </Text>
          </View>

          {/* Column header row */}
          <View style={{ flexDirection: 'row' }}>
            <View style={[colHdrStyle, { width: ITEM_COL, paddingLeft: 3 }]}>
              <Text style={colHdrText}>Equipo / Elemento</Text>
            </View>
            <View style={[colHdrStyle, { width: FREC_COL }]}>
              <Text style={colHdrText}>Frecuencia</Text>
            </View>
            {dias.map((d) => (
              <View key={d} style={[colHdrStyle, { width: DAY_COL }]}>
                <Text style={colHdrText}>{d}</Text>
              </View>
            ))}
            <View style={[colHdrStyle, { width: ACT_COL }]}>
              <Text style={colHdrText}>{'Rev.\nGral'}</Text>
            </View>
            <View style={[colHdrStyle, { width: ACT_COL }]}>
              <Text style={colHdrText}>{'C.\nAceit'}</Text>
            </View>
            <View style={[colHdrStyle, { width: ACT_COL }]}>
              <Text style={colHdrText}>{'C.\nPzas'}</Text>
            </View>
            <View style={[colHdrStyle, { width: ACT_COL }]}>
              <Text style={colHdrText}>{'Rev.\nElec'}</Text>
            </View>
          </View>

          {/* Item rows */}
          {areaData.items.map((item, idx) => {
            const bg  = idx % 2 === 0 ? PC.white : ROW_ALT
            const acc = acciones[item.id]
            return (
              <View key={item.id} style={{ flexDirection: 'row', backgroundColor: bg }}>
                <View style={[itemCellStyle, { backgroundColor: bg }]}>
                  <Text style={{ fontSize: 5.5, color: PC.fieldValue }}>{item.nombre}</Text>
                </View>
                <View style={[frecCellStyle, { backgroundColor: bg }]}>
                  <Text style={{ fontSize: 5, color: PC.textSub }}>{frecLabel(item.frecuencia)}</Text>
                </View>
                {dias.map((d) => {
                  const v   = resultados[item.id]?.[d]
                  const sym = valorSym(v)
                  const col = valorColor(v)
                  return (
                    <View key={d} style={[dayCellStyle, { backgroundColor: bg }]}>
                      {sym ? (
                        <Text style={{ fontSize: sym === '—' ? 6 : 5.5, fontFamily: 'Helvetica-Bold', color: col }}>
                          {sym}
                        </Text>
                      ) : null}
                    </View>
                  )
                })}
                <View style={[actCellStyle, { backgroundColor: bg }]}>
                  {acc?.revision_general   ? <Text style={{ fontSize: 6, fontFamily: 'Helvetica-Bold', color: H_COLOR }}>X</Text> : null}
                </View>
                <View style={[actCellStyle, { backgroundColor: bg }]}>
                  {acc?.cambio_aceites     ? <Text style={{ fontSize: 6, fontFamily: 'Helvetica-Bold', color: H_COLOR }}>X</Text> : null}
                </View>
                <View style={[actCellStyle, { backgroundColor: bg }]}>
                  {acc?.cambio_piezas      ? <Text style={{ fontSize: 6, fontFamily: 'Helvetica-Bold', color: H_COLOR }}>X</Text> : null}
                </View>
                <View style={[actCellStyle, { backgroundColor: bg }]}>
                  {acc?.revision_electrico ? <Text style={{ fontSize: 6, fontFamily: 'Helvetica-Bold', color: H_COLOR }}>X</Text> : null}
                </View>
              </View>
            )
          })}
        </View>
      ))}

      {observaciones ? (
        <View style={{ borderWidth: 1, borderColor: PC.border, padding: 4, marginTop: 8, marginBottom: 4 }}>
          <Text style={{ fontSize: 5.5, color: PC.textSub, fontFamily: 'Helvetica-Bold', marginBottom: 2 }}>OBSERVACIONES</Text>
          <Text style={{ fontSize: 6.5, color: PC.fieldValue }}>{observaciones}</Text>
        </View>
      ) : null}

      <PdfSectionBanner>3. Firmas y responsables</PdfSectionBanner>
      <PdfSignatures
        signatures={[
          { label: '', nombre: '', caption: 'Responsable del Area' },
          { label: '', nombre: '', caption: 'Jefe de Mantenimiento' },
          { label: '', nombre: '', caption: 'Gerente de Operaciones' },
        ]}
      />
    </>
  )
}

export function MttoPreventivoPDF(props: M45PaginaProps) {
  return (
    <Document
      title={`Mantenimiento Preventivo ${props.mesLabel}`}
      author="M.A.D.Y."
      creator="M.A.D.Y. Inocuidad Inteligente"
      producer="M.A.D.Y. Inocuidad Inteligente"
      subject={`Verificación y Mantenimiento Preventivo — ${props.instalacion}`}
      keywords="MADY, inocuidad, mantenimiento, preventivo, correctivo"
    >
      <Page
        size="A4"
        orientation="landscape"
        style={{
          fontFamily: 'Helvetica',
          fontSize: 7,
          color: PC.fieldValue,
          paddingTop: HDR_H + 4,
          paddingBottom: 40,
          paddingLeft: MARGIN,
          paddingRight: MARGIN,
        }}
      >
        <MttoPreventivoPaginaContent {...props} />
      </Page>
    </Document>
  )
}

export function MttoPreventivoConsolidadoPDF({
  paginas, instalacionNombre, desde, hasta,
}: MttoPreventivoConsolidadoPDFProps) {
  return (
    <Document
      title={`Mantenimiento Preventivo Consolidado — ${instalacionNombre} ${desde} a ${hasta}`}
      author="M.A.D.Y."
      creator="M.A.D.Y. Inocuidad Inteligente"
      producer="M.A.D.Y. Inocuidad Inteligente"
      subject={`Verificación y Mantenimiento Preventivo — ${instalacionNombre}`}
      keywords="MADY, inocuidad, mantenimiento, preventivo, correctivo, consolidado"
    >
      {paginas.map((p, i) => (
        <Page
          key={i}
          size="A4"
          orientation="landscape"
          style={{
            fontFamily: 'Helvetica',
            fontSize: 7,
            color: PC.fieldValue,
            paddingTop: HDR_H + 4,
            paddingBottom: 40,
            paddingLeft: MARGIN,
            paddingRight: MARGIN,
          }}
        >
          <MttoPreventivoPaginaContent {...p} />
        </Page>
      ))}
    </Document>
  )
}
