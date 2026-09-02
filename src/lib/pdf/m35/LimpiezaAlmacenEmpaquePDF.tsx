// PATRÓN INOCUIDAD — PDF M35 (plantilla homogénea M.A.D.Y)
// Bitácora de limpieza del almacén de material de empaque — A4 landscape, matriz mensual.

import { Document, Page, View, Text } from '@react-pdf/renderer'
import { TopBar, PdfFooter } from '@/lib/pdf/components/PdfPage'
import { PdfHeader } from '@/lib/pdf/components/PdfHeader'
import { PdfSectionBanner } from '@/lib/pdf/components/PdfSectionBanner'
import { PdfFieldGrid, PdfFieldRow, PdfField } from '@/lib/pdf/components/PdfFieldGrid'
import { PdfSignatures } from '@/lib/pdf/components/PdfSignatures'
import { codigoFormato } from '@/lib/codigoFormato'
import { PC } from '@/lib/pdf/components/tokens'

export type ValorM35PDF = 'hecho' | 'no_hecho' | 'na'
export interface M35ItemPDF { id: string; nombre: string; frecuencia: string; genera_incidencia: boolean }
export interface M35DiaDataPDF { realizo: string | null; aprobo: string | null }
export interface LimpiezaAlmacenEmpaquePaginaProps {
  instalacion: string
  instalacionCodigo: string
  anio: number
  mes: number
  items: M35ItemPDF[]
  resultados: Record<number, Record<string, ValorM35PDF>>
  diasData: Record<number, M35DiaDataPDF>
  observaciones: string | null
  codigoClave: string
  terminoSitio?: string
}
export interface LimpiezaAlmacenEmpaqueConsolidadoProps {
  paginas: LimpiezaAlmacenEmpaquePaginaProps[]
  instalacionNombre: string
  desde: string
  hasta: string
}

const OK_COLOR  = '#2E7D32'
const NO_COLOR  = '#C02A2A'
const NA_COLOR  = '#717182'
const ROW_ALT   = '#F5F9FE'
const MARGIN    = 20
const PAGE_W    = 841.89 - MARGIN * 2
const ITEM_COL_W = 160
const D_COL = { dia: 30, realizo: 250, aprobo: 250 }

function dayColW(n: number) { return Math.floor((PAGE_W - ITEM_COL_W) / Math.max(n, 1)) }
function diasEnMes(a: number, m: number) { return new Date(a, m, 0).getDate() }
function mesNombre(a: number, m: number) {
  const n = ['Enero','Febrero','Marzo','Abril','Mayo','Junio','Julio','Agosto','Septiembre','Octubre','Noviembre','Diciembre']
  return `${n[m - 1]} ${a}`
}
function valorDisplay(v: ValorM35PDF | undefined, generaIncidencia: boolean) {
  if (generaIncidencia) {
    if (v === 'hecho') return { text: 'Dano', color: NO_COLOR }
    if (v === 'na')    return { text: 'OK', color: OK_COLOR }
    return { text: '', color: PC.fieldValue }
  }
  if (v === 'hecho')    return { text: 'OK', color: OK_COLOR }
  if (v === 'no_hecho') return { text: 'No', color: NO_COLOR }
  if (v === 'na')       return { text: 'N/A', color: NA_COLOR }
  return { text: '', color: PC.fieldValue }
}

const thStyle = { padding: 3, borderRightWidth: 1, borderRightColor: '#5599CC', borderBottomWidth: 1, borderBottomColor: '#5599CC', justifyContent: 'center', alignItems: 'center' } as const
const tdStyle = { borderRightWidth: 1, borderRightColor: PC.border, borderBottomWidth: 1, borderBottomColor: PC.border, justifyContent: 'center', alignItems: 'center', padding: 1 } as const

export function LimpiezaAlmacenEmpaquePagina({
  instalacion, instalacionCodigo, anio, mes, items, resultados, diasData,
  observaciones, codigoClave, terminoSitio = 'Instalación',
}: LimpiezaAlmacenEmpaquePaginaProps) {
  const emision   = new Date().toLocaleDateString('es-MX')
  const codigoFmt = codigoFormato('F-FRUS-SAN-13', codigoClave)
  const numDias   = diasEnMes(anio, mes)
  const days      = Array.from({ length: numDias }, (_, i) => i + 1)
  const dW        = dayColW(numDias)
  const mesLabel  = mesNombre(anio, mes)

  const diasDataEntries = Object.keys(diasData).map(Number).filter((dia) => {
    const d = diasData[dia]; return d.realizo || d.aprobo
  }).sort((a, b) => a - b)

  return (
    <Page size="A4" orientation="landscape" style={{ fontFamily: 'Helvetica', fontSize: 7, padding: MARGIN, paddingBottom: 50, backgroundColor: PC.white }}>
      <PdfFooter moduloCodigo="M35" />
      <TopBar />
      <PdfHeader titulo="BITÁCORA DE LIMPIEZA DEL ALMACÉN DE MATERIAL DE EMPAQUE" subtitulo={`Bitácora mensual | ${instalacion}`} codigoFormato={codigoFmt} folio={mesLabel} fecha={emision} />

      <PdfSectionBanner>1. Datos del sitio y mes</PdfSectionBanner>
      <PdfFieldGrid>
        <PdfFieldRow>
          <PdfField label={terminoSitio} value={instalacion} />
          <PdfField label="Código" value={instalacionCodigo || '—'} />
          <PdfField label="Área" value="Almacén de material de empaque" />
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
                const { text, color } = valorDisplay(resultados[d]?.[item.id], item.genera_incidencia)
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
          <PdfSectionBanner>Registro diario de personal</PdfSectionBanner>
          <View style={{ borderLeftWidth: 1, borderLeftColor: PC.border, borderTopWidth: 1, borderTopColor: PC.border, marginTop: 4, marginBottom: 4 }}>
            <View style={{ flexDirection: 'row' }}>
              {[{ label: 'Dia', w: D_COL.dia }, { label: 'Realizo', w: D_COL.realizo }, { label: 'Aprobo', w: D_COL.aprobo }].map((col, ci, arr) => (
                <View key={col.label} style={[thStyle, { width: col.w, backgroundColor: PC.section, borderRightWidth: ci === arr.length - 1 ? 0 : 1 }]}>
                  <Text style={{ fontSize: 6, fontFamily: 'Helvetica-Bold', textAlign: 'center', color: PC.white }}>{col.label}</Text>
                </View>
              ))}
            </View>
            {diasDataEntries.map((dia, idx) => {
              const d = diasData[dia]
              const bg = idx % 2 === 1 ? ROW_ALT : PC.white
              return (
                <View key={dia} style={{ flexDirection: 'row', backgroundColor: bg }}>
                  {[{ val: String(dia), w: D_COL.dia }, { val: d.realizo ?? '', w: D_COL.realizo }, { val: d.aprobo ?? '', w: D_COL.aprobo }].map((cell, ci, arr) => (
                    <View key={ci} style={[tdStyle, { width: cell.w, backgroundColor: bg, borderRightWidth: ci === arr.length - 1 ? 0 : 1 }]}>
                      <Text style={{ fontSize: 6, textAlign: 'center', color: PC.fieldValue }}>{cell.val}</Text>
                    </View>
                  ))}
                </View>
              )
            })}
          </View>
        </>
      )}

      {/* Nota incidencia montacargas */}
      <View style={{ marginTop: 4, padding: 5, borderWidth: 1, borderColor: '#E0C860', borderRadius: 2, backgroundColor: '#FFFDE7' }}>
        <Text style={{ fontSize: 5.5, color: '#6D4C00' }}>
          Nota: En caso de detectar dano en micas o faros del montacargas, registrar incidencia en M13 - Reporte de Incidencias.
        </Text>
      </View>

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

export function LimpiezaAlmacenEmpaquePDF(props: LimpiezaAlmacenEmpaquePaginaProps) {
  return (
    <Document title={`Limpieza Almacen Empaque ${mesNombre(props.anio, props.mes)}`} author="M.A.D.Y." creator="M.A.D.Y. Inocuidad Inteligente" producer="M.A.D.Y. Inocuidad Inteligente" subject={`Bitácora de Limpieza del Almacén de Material de Empaque — ${props.instalacion}`} keywords="MADY, inocuidad, limpieza, almacen, empaque">
      <LimpiezaAlmacenEmpaquePagina {...props} />
    </Document>
  )
}

export function LimpiezaAlmacenEmpaqueConsolidadoPDF({ paginas }: LimpiezaAlmacenEmpaqueConsolidadoProps) {
  return (
    <Document title="Limpieza Almacen Empaque Consolidado" author="M.A.D.Y." creator="M.A.D.Y. Inocuidad Inteligente" producer="M.A.D.Y. Inocuidad Inteligente" subject="Bitácora de Limpieza del Almacén de Material de Empaque — Consolidado" keywords="MADY, inocuidad, limpieza, almacen, empaque, consolidado">
      {paginas.map((p, i) => <LimpiezaAlmacenEmpaquePagina key={i} {...p} />)}
    </Document>
  )
}
