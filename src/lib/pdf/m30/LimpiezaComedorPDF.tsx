// PATRÓN INOCUIDAD — PDF M30 (plantilla homogénea M.A.D.Y)
// Bitácora de limpieza del comedor — A4 landscape, matriz mensual.

import { Document, Page, View, Text } from '@react-pdf/renderer'
import { TopBar, PdfFooter } from '@/lib/pdf/components/PdfPage'
import { PdfHeader } from '@/lib/pdf/components/PdfHeader'
import { PdfSectionBanner } from '@/lib/pdf/components/PdfSectionBanner'
import { PdfFieldGrid, PdfFieldRow, PdfField } from '@/lib/pdf/components/PdfFieldGrid'
import { PdfSignatures } from '@/lib/pdf/components/PdfSignatures'
import { codigoFormato } from '@/lib/codigoFormato'
import { PC } from '@/lib/pdf/components/tokens'

export type ValorM30PDF = 'hecho' | 'no_hecho' | 'na'
export interface M30ItemPDF { id: string; nombre: string; frecuencia: string }
export interface M30DiaDataPDF {
  concentracion_cloro: number | null
  ajuste_cloro: string | null
  concentracion_acido: number | null
  ajuste_acido: string | null
  realizo: string | null
  aprobo: string | null
}
export interface LimpiezaComedorPaginaProps {
  instalacion: string
  instalacionCodigo: string
  anio: number
  mes: number
  items: M30ItemPDF[]
  resultados: Record<number, Record<string, ValorM30PDF>>
  diasData: Record<number, M30DiaDataPDF>
  observaciones: string | null
  codigoClave: string
  terminoSitio?: string
}
export interface LimpiezaComedorConsolidadoProps {
  paginas: LimpiezaComedorPaginaProps[]
  instalacionNombre: string
  desde: string
  hasta: string
}

const OK_COLOR = '#2E7D32'
const NO_COLOR = '#C02A2A'
const NA_COLOR = '#717182'
const ROW_ALT  = '#F5F9FE'
const MARGIN   = 20
const PAGE_W   = 841.89 - MARGIN * 2
const ITEM_COL_W = 160
const D_COL = { dia: 20, conc_cloro: 60, aj_cloro: 60, conc_acido: 65, aj_acido: 60, realizo: 100, aprobo: 100 }

function dayColW(n: number) { return Math.floor((PAGE_W - ITEM_COL_W) / Math.max(n, 1)) }
function diasEnMes(a: number, m: number) { return new Date(a, m, 0).getDate() }
function mesNombre(a: number, m: number) {
  const n = ['Enero','Febrero','Marzo','Abril','Mayo','Junio','Julio','Agosto','Septiembre','Octubre','Noviembre','Diciembre']
  return `${n[m - 1]} ${a}`
}
function valorDisplay(v: ValorM30PDF | undefined) {
  if (v === 'hecho')    return { text: 'OK', color: OK_COLOR }
  if (v === 'no_hecho') return { text: 'No', color: NO_COLOR }
  if (v === 'na')       return { text: 'N/A', color: NA_COLOR }
  return { text: '', color: PC.fieldValue }
}

const thStyle = { padding: 3, borderRightWidth: 1, borderRightColor: '#5599CC', borderBottomWidth: 1, borderBottomColor: '#5599CC', justifyContent: 'center', alignItems: 'center' } as const
const tdStyle = { borderRightWidth: 1, borderRightColor: PC.border, borderBottomWidth: 1, borderBottomColor: PC.border, justifyContent: 'center', alignItems: 'center', padding: 1 } as const

export function LimpiezaComedorPagina({
  instalacion, instalacionCodigo, anio, mes, items, resultados, diasData,
  observaciones, codigoClave, terminoSitio = 'Instalación',
}: LimpiezaComedorPaginaProps) {
  const emision   = new Date().toLocaleDateString('es-MX')
  const codigoFmt = codigoFormato('F-FRUS-SAN-08', codigoClave)
  const numDias   = diasEnMes(anio, mes)
  const days      = Array.from({ length: numDias }, (_, i) => i + 1)
  const dW        = dayColW(numDias)
  const mesLabel  = mesNombre(anio, mes)

  const diasDataEntries = Object.keys(diasData).map(Number).filter((dia) => {
    const d = diasData[dia]
    return d.concentracion_cloro != null || d.ajuste_cloro || d.concentracion_acido != null || d.ajuste_acido || d.realizo || d.aprobo
  }).sort((a, b) => a - b)

  return (
    <Page size="A4" orientation="landscape" style={{ fontFamily: 'Helvetica', fontSize: 7, padding: MARGIN, paddingBottom: 50, backgroundColor: PC.white }}>
      <PdfFooter moduloCodigo="M30" />
      <TopBar />
      <PdfHeader titulo="BITÁCORA DE LIMPIEZA DEL COMEDOR" subtitulo={`Bitácora mensual | ${instalacion}`} codigoFormato={codigoFmt} folio={mesLabel} fecha={emision} />

      <PdfSectionBanner>1. Datos del sitio y mes</PdfSectionBanner>
      <PdfFieldGrid>
        <PdfFieldRow>
          <PdfField label={terminoSitio} value={instalacion} />
          <PdfField label="Código" value={instalacionCodigo || '—'} />
          <PdfField label="Área" value="Comedor" />
          <PdfField label="Mes / Año" value={mesLabel} />
        </PdfFieldRow>
      </PdfFieldGrid>

      <PdfSectionBanner>2. Actividades de limpieza</PdfSectionBanner>
      <View style={{ borderLeftWidth: 1, borderLeftColor: PC.border, borderTopWidth: 1, borderTopColor: PC.border, marginTop: 4 }}>
        <View style={{ flexDirection: 'row' }}>
          <View style={[thStyle, { width: ITEM_COL_W, backgroundColor: PC.section }]}>
            <Text style={{ fontFamily: 'Helvetica-Bold', fontSize: 6.5, textAlign: 'center', color: PC.white }}>Actividad / Frecuencia</Text>
          </View>
          {days.map(d => (
            <View key={d} style={[thStyle, { width: dW, backgroundColor: PC.section }]}>
              <Text style={{ fontFamily: 'Helvetica-Bold', fontSize: 6.5, textAlign: 'center', color: PC.white }}>{d}</Text>
            </View>
          ))}
        </View>
        {items.map((item, idx) => {
          const bg = idx % 2 === 1 ? ROW_ALT : PC.white
          return (
            <View key={item.id} style={{ flexDirection: 'row', backgroundColor: bg }}>
              <View style={{ width: ITEM_COL_W, padding: 3, borderRightWidth: 1, borderRightColor: PC.border, borderBottomWidth: 1, borderBottomColor: PC.border, justifyContent: 'center', backgroundColor: bg }}>
                <Text style={{ fontSize: 6, color: PC.fieldValue }}>{item.nombre}</Text>
                <Text style={{ fontSize: 5.5, color: PC.textSub, marginTop: 0.5 }}>Frec: {item.frecuencia}</Text>
              </View>
              {days.map(d => {
                const { text, color } = valorDisplay(resultados[d]?.[item.id])
                return (
                  <View key={d} style={[tdStyle, { width: dW, backgroundColor: bg }]}>
                    <Text style={{ fontSize: 6, textAlign: 'center', color }}>{text}</Text>
                  </View>
                )
              })}
            </View>
          )
        })}
      </View>

      {diasDataEntries.length > 0 && (
        <>
          <PdfSectionBanner>Registro diario de concentraciones y personal</PdfSectionBanner>
          <View style={{ borderLeftWidth: 1, borderLeftColor: PC.border, borderTopWidth: 1, borderTopColor: PC.border, marginTop: 4, marginBottom: 4 }}>
            <View style={{ flexDirection: 'row' }}>
              {[
                { label: 'Dia', w: D_COL.dia },
                { label: 'Conc. Cloro (ppm)', w: D_COL.conc_cloro },
                { label: 'Ajuste Cloro', w: D_COL.aj_cloro },
                { label: 'Conc. Ac. Per. (ppm)', w: D_COL.conc_acido },
                { label: 'Ajuste Ac. Per.', w: D_COL.aj_acido },
                { label: 'Realizo', w: D_COL.realizo },
                { label: 'Aprobo', w: D_COL.aprobo },
              ].map((col, ci, arr) => (
                <View key={col.label} style={[thStyle, { width: col.w, backgroundColor: PC.section, borderRightWidth: ci === arr.length - 1 ? 0 : 1 }]}>
                  <Text style={{ fontSize: 6, fontFamily: 'Helvetica-Bold', textAlign: 'center', color: PC.white }}>{col.label}</Text>
                </View>
              ))}
            </View>
            {diasDataEntries.map((dia, idx) => {
              const d = diasData[dia]
              const bg = idx % 2 === 1 ? ROW_ALT : PC.white
              const cells = [
                String(dia), d.concentracion_cloro != null ? String(d.concentracion_cloro) : '',
                d.ajuste_cloro ?? '', d.concentracion_acido != null ? String(d.concentracion_acido) : '',
                d.ajuste_acido ?? '', d.realizo ?? '', d.aprobo ?? '',
              ]
              const ws = [D_COL.dia, D_COL.conc_cloro, D_COL.aj_cloro, D_COL.conc_acido, D_COL.aj_acido, D_COL.realizo, D_COL.aprobo]
              return (
                <View key={dia} style={{ flexDirection: 'row', backgroundColor: bg }}>
                  {cells.map((val, ci) => (
                    <View key={ci} style={[tdStyle, { width: ws[ci], backgroundColor: bg, borderRightWidth: ci === cells.length - 1 ? 0 : 1 }]}>
                      <Text style={{ fontSize: 6, textAlign: 'center', color: PC.fieldValue }}>{val}</Text>
                    </View>
                  ))}
                </View>
              )
            })}
          </View>
        </>
      )}

      {observaciones ? (
        <View style={{ borderWidth: 1, borderColor: PC.border, padding: 4, marginTop: 4, minHeight: 20 }}>
          <Text style={{ fontSize: 5.5, color: PC.textSub, fontFamily: 'Helvetica-Bold', marginBottom: 2 }}>OBSERVACIONES</Text>
          <Text style={{ fontSize: 6.5, color: PC.fieldValue }}>{observaciones}</Text>
        </View>
      ) : null}

      <PdfSectionBanner>3. Firmas y responsables</PdfSectionBanner>
      <PdfSignatures
        signatures={[
          { label: '', nombre: '', caption: 'Realizo' },
          { label: '', nombre: '', caption: 'Aprobo' },
          { label: '', nombre: '', caption: 'Responsable de Inocuidad — Firma' },
        ]}
      />
    </Page>
  )
}

export function LimpiezaComedorPDF(props: LimpiezaComedorPaginaProps) {
  return (
    <Document title={`Limpieza Comedor ${mesNombre(props.anio, props.mes)}`} author="M.A.D.Y." creator="M.A.D.Y. Inocuidad Inteligente" producer="M.A.D.Y. Inocuidad Inteligente" subject={`Bitácora de Limpieza del Comedor — ${props.instalacion}`} keywords="MADY, inocuidad, limpieza, comedor">
      <LimpiezaComedorPagina {...props} />
    </Document>
  )
}

export function LimpiezaComedorConsolidadoPDF({ paginas }: LimpiezaComedorConsolidadoProps) {
  return (
    <Document title="Limpieza Comedor Consolidado" author="M.A.D.Y." creator="M.A.D.Y. Inocuidad Inteligente" producer="M.A.D.Y. Inocuidad Inteligente" subject="Bitácora de Limpieza del Comedor — Consolidado" keywords="MADY, inocuidad, limpieza, comedor, consolidado">
      {paginas.map((p, i) => <LimpiezaComedorPagina key={i} {...p} />)}
    </Document>
  )
}
