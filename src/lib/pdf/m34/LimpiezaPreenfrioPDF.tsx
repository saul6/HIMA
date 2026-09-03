// PATRÓN INOCUIDAD — PDF M34 (plantilla homogénea M.A.D.Y)
// Bitácora de limpieza de los cuartos de pre-enfrío y conservador — A4 landscape, matriz mensual.
// TopBar + PdfHeader + PdfSectionBanner + matriz inline (OK/No/N/A + Sin plaga/Con plaga) + franja cloro/ácido + PdfFooter.

import { Document, Page, View, Text } from '@react-pdf/renderer'
import { TopBar, PdfFooter } from '@/lib/pdf/components/PdfPage'
import { PdfHeader } from '@/lib/pdf/components/PdfHeader'
import { PdfSectionBanner } from '@/lib/pdf/components/PdfSectionBanner'
import { PdfFieldGrid, PdfFieldRow, PdfField } from '@/lib/pdf/components/PdfFieldGrid'
import { PdfSignatures } from '@/lib/pdf/components/PdfSignatures'
import { codigoFormato } from '@/lib/codigoFormato'
import { PC } from '@/lib/pdf/components/tokens'

// ── Tipos ─────────────────────────────────────────────────────────────────────

export type ValorM34PDF = 'hecho' | 'no_hecho' | 'na'

export interface M34ItemPDF { id: string; nombre: string; frecuencia: string; es_inspeccion_plaga: boolean }

export interface M34DiaDataPDF {
  concentracion_cloro: number | null
  ajuste_cloro: string | null
  concentracion_acido: number | null
  ajuste_acido: string | null
  realizo: string | null
  aprobo: string | null
}

export interface LimpiezaPreenfrioPaginaProps {
  instalacion: string
  instalacionCodigo: string
  anio: number
  mes: number
  items: M34ItemPDF[]
  resultados: Record<number, Record<string, ValorM34PDF>>
  diasData: Record<number, M34DiaDataPDF>
  observaciones: string | null
  codigoClave: string
  terminoSitio?: string
}

export interface LimpiezaPreenfrioConsolidadoProps {
  paginas: LimpiezaPreenfrioPaginaProps[]
  instalacionNombre: string
  desde: string
  hasta: string
}

// ── Constantes ────────────────────────────────────────────────────────────────

const OK_COLOR   = '#2E7D32'
const NO_COLOR   = '#C02A2A'
const NA_COLOR   = '#717182'
const ROW_ALT    = '#F5F9FE'
const MARGIN     = 20
const PAGE_W     = 841.89 - MARGIN * 2
const ITEM_COL_W = 160

const D_COL = { dia: 20, conc_cloro: 60, aj_cloro: 60, conc_acido: 65, aj_acido: 60, realizo: 100, aprobo: 100 }

// ── Helpers ───────────────────────────────────────────────────────────────────

function dayColW(numDias: number): number {
  return Math.floor((PAGE_W - ITEM_COL_W) / Math.max(numDias, 1))
}

function diasEnMes(anio: number, mes: number): number {
  return new Date(anio, mes, 0).getDate()
}

function mesNombre(anio: number, mes: number): string {
  const n = ['Enero','Febrero','Marzo','Abril','Mayo','Junio','Julio','Agosto','Septiembre','Octubre','Noviembre','Diciembre']
  return `${n[mes - 1]} ${anio}`
}

function valorDisplay(v: ValorM34PDF | undefined, isPlaga: boolean): { text: string; color: string } {
  if (isPlaga) {
    if (v === 'na')      return { text: 'Sin plaga', color: OK_COLOR }
    if (v === 'hecho')   return { text: 'Con plaga', color: NO_COLOR }
    return { text: '', color: PC.fieldValue }
  }
  if (v === 'hecho')    return { text: 'OK', color: OK_COLOR }
  if (v === 'no_hecho') return { text: 'No', color: NO_COLOR }
  if (v === 'na')       return { text: 'N/A', color: NA_COLOR }
  return { text: '', color: PC.fieldValue }
}

// ── Estilos de celda inline ───────────────────────────────────────────────────

const thStyle = { padding: 3, borderRightWidth: 1, borderRightColor: '#5599CC', borderBottomWidth: 1, borderBottomColor: '#5599CC', justifyContent: 'center', alignItems: 'center' } as const
const tdStyle = { borderRightWidth: 1, borderRightColor: PC.border, borderBottomWidth: 1, borderBottomColor: PC.border, justifyContent: 'center', alignItems: 'center', padding: 1 } as const

// ── LimpiezaPreenfrioPagina ───────────────────────────────────────────────────

export function LimpiezaPreenfrioPagina({
  instalacion, instalacionCodigo, anio, mes, items, resultados, diasData,
  observaciones, codigoClave, terminoSitio = 'Instalación',
}: LimpiezaPreenfrioPaginaProps) {
  const emision   = new Date().toLocaleDateString('es-MX')
  const codigoFmt = codigoFormato('F-FRUS-SAN-12', codigoClave)
  const numDias   = diasEnMes(anio, mes)
  const days      = Array.from({ length: numDias }, (_, i) => i + 1)
  const dW        = dayColW(numDias)
  const mesLabel  = mesNombre(anio, mes)

  const diasDataEntries = Object.keys(diasData).map(Number).filter((dia) => {
    const d = diasData[dia]
    return d.concentracion_cloro != null || d.ajuste_cloro || d.concentracion_acido != null || d.ajuste_acido || d.realizo || d.aprobo
  }).sort((a, b) => a - b)

  return (
    <Page
      size="A4"
      orientation="landscape"
      style={{ fontFamily: 'Helvetica', fontSize: 7, padding: MARGIN, paddingBottom: 50, backgroundColor: PC.white }}
    >
      <PdfFooter moduloCodigo="M34" />
      <TopBar />

      <PdfHeader
        titulo="BITÁCORA DE LIMPIEZA DE LOS CUARTOS DE PRE-ENFRÍO Y CONSERVADOR"
        subtitulo={`Bitácora mensual | ${instalacion}`}
        codigoFormato={codigoFmt}
        folio={mesLabel}
        fecha={emision}
      />

      <PdfSectionBanner>1. Datos del sitio y mes</PdfSectionBanner>
      <PdfFieldGrid>
        <PdfFieldRow>
          <PdfField label={terminoSitio} value={instalacion} />
          <PdfField label="Código" value={instalacionCodigo || '—'} />
          <PdfField label="Área" value="Cuartos de pre-enfrío y conservador" />
          <PdfField label="Mes / Año" value={mesLabel} />
        </PdfFieldRow>
      </PdfFieldGrid>

      <PdfSectionBanner>2. Actividades de limpieza</PdfSectionBanner>

      {/* Matriz mensual */}
      <View style={{ borderLeftWidth: 1, borderLeftColor: PC.border, borderTopWidth: 1, borderTopColor: PC.border, marginTop: 4 }}>
        {/* Encabezado */}
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
        {/* Filas */}
        {items.map((item, idx) => {
          const bg = idx % 2 === 1 ? ROW_ALT : PC.white
          return (
            <View key={item.id} style={{ flexDirection: 'row', backgroundColor: bg }}>
              <View style={{ width: ITEM_COL_W, padding: 3, borderRightWidth: 1, borderRightColor: PC.border, borderBottomWidth: 1, borderBottomColor: PC.border, justifyContent: 'center', backgroundColor: bg }}>
                <Text style={{ fontSize: 6, color: PC.fieldValue }}>{item.nombre}</Text>
                <Text style={{ fontSize: 5.5, color: PC.textSub, marginTop: 0.5 }}>Frec: {item.frecuencia}</Text>
              </View>
              {days.map(d => {
                const { text, color } = valorDisplay(resultados[d]?.[item.id], item.es_inspeccion_plaga)
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

      {/* Registro de concentraciones */}
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
              return (
                <View key={dia} style={{ flexDirection: 'row', backgroundColor: bg }}>
                  {[
                    { val: String(dia), w: D_COL.dia },
                    { val: d.concentracion_cloro != null ? String(d.concentracion_cloro) : '', w: D_COL.conc_cloro },
                    { val: d.ajuste_cloro ?? '', w: D_COL.aj_cloro },
                    { val: d.concentracion_acido != null ? String(d.concentracion_acido) : '', w: D_COL.conc_acido },
                    { val: d.ajuste_acido ?? '', w: D_COL.aj_acido },
                    { val: d.realizo ?? '', w: D_COL.realizo },
                    { val: d.aprobo ?? '', w: D_COL.aprobo },
                  ].map((cell, ci, arr) => (
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

      {observaciones ? (
        <View style={{ borderWidth: 1, borderColor: PC.border, padding: 4, marginTop: 4, minHeight: 20 }}>
          <Text style={{ fontSize: 5.5, color: PC.textSub, fontFamily: 'Helvetica-Bold', marginBottom: 2 }}>OBSERVACIONES</Text>
          <Text style={{ fontSize: 6.5, color: PC.fieldValue }}>{observaciones}</Text>
        </View>
      ) : null}

      <Text style={{ fontSize: 5.5, color: PC.textSub, marginTop: 3 }}>
        Nota: Concentracion cloro recomendada 100-200 ppm. Ajuste si la concentracion esta fuera del rango. En caso de hallazgo de plaga se registra incidencia en M13.
      </Text>

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

export function LimpiezaPreenfrioPDF(props: LimpiezaPreenfrioPaginaProps) {
  return (
    <Document
      title={`Limpieza Pre-enfrio ${mesNombre(props.anio, props.mes)}`}
      author="M.A.D.Y."
      creator="M.A.D.Y. Inocuidad Inteligente"
      producer="M.A.D.Y. Inocuidad Inteligente"
      subject={`Bitácora de Limpieza de Cuartos de Pre-enfrío — ${props.instalacion}`}
      keywords="MADY, inocuidad, limpieza, preenfrio, conservador"
    >
      <LimpiezaPreenfrioPagina {...props} />
    </Document>
  )
}

export function LimpiezaPreenfrioConsolidadoPDF({ paginas }: LimpiezaPreenfrioConsolidadoProps) {
  return (
    <Document
      title="Limpieza Pre-enfrio Consolidado"
      author="M.A.D.Y."
      creator="M.A.D.Y. Inocuidad Inteligente"
      producer="M.A.D.Y. Inocuidad Inteligente"
      subject="Bitácora de Limpieza de Cuartos de Pre-enfrío — Consolidado"
      keywords="MADY, inocuidad, limpieza, preenfrio, conservador, consolidado"
    >
      {paginas.map((p, i) => <LimpiezaPreenfrioPagina key={i} {...p} />)}
    </Document>
  )
}
