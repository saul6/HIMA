// PATRÓN INOCUIDAD — PDF M31 (plantilla homogénea M.A.D.Y)
// Bitácora de limpieza de las oficinas — A4 landscape, matriz mensual.
// TopBar + PdfHeader + PdfSectionBanner + matriz inline (OK/No/N/A) + franja personal + PdfFooter.

import { Document, Page, View, Text } from '@react-pdf/renderer'
import { TopBar, PdfFooter } from '@/lib/pdf/components/PdfPage'
import { PdfHeader } from '@/lib/pdf/components/PdfHeader'
import { PdfSectionBanner } from '@/lib/pdf/components/PdfSectionBanner'
import { PdfFieldGrid, PdfFieldRow, PdfField } from '@/lib/pdf/components/PdfFieldGrid'
import { PdfSignatures } from '@/lib/pdf/components/PdfSignatures'
import { codigoFormato } from '@/lib/codigoFormato'
import { PC } from '@/lib/pdf/components/tokens'

// ── Tipos ─────────────────────────────────────────────────────────────────────

export type ValorM31PDF = 'hecho' | 'no_hecho' | 'na'

export interface M31ItemPDF { id: string; nombre: string; frecuencia: string }

export interface M31DiaDataPDF {
  realizo: string | null
  aprobo: string | null
}

export interface LimpiezaOficinasPaginaProps {
  instalacion: string
  instalacionCodigo: string
  anio: number
  mes: number
  items: M31ItemPDF[]
  resultados: Record<number, Record<string, ValorM31PDF>>
  diasData: Record<number, M31DiaDataPDF>
  observaciones: string | null
  codigoClave: string
  terminoSitio?: string
}

export interface LimpiezaOficinasConsolidadoProps {
  paginas: LimpiezaOficinasPaginaProps[]
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

const D_COL = { dia: 30, realizo: 250, aprobo: 250 }

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

function valorDisplay(v: ValorM31PDF | undefined): { text: string; color: string } {
  if (v === 'hecho')    return { text: 'OK', color: OK_COLOR }
  if (v === 'no_hecho') return { text: 'No', color: NO_COLOR }
  if (v === 'na')       return { text: 'N/A', color: NA_COLOR }
  return { text: '', color: PC.fieldValue }
}

// ── Estilos de celda inline ───────────────────────────────────────────────────

const thStyle = { padding: 3, borderRightWidth: 1, borderRightColor: '#5599CC', borderBottomWidth: 1, borderBottomColor: '#5599CC', justifyContent: 'center', alignItems: 'center' } as const
const tdStyle = { borderRightWidth: 1, borderRightColor: PC.border, borderBottomWidth: 1, borderBottomColor: PC.border, justifyContent: 'center', alignItems: 'center', padding: 1 } as const

// ── LimpiezaOficinasPagina ────────────────────────────────────────────────────

export function LimpiezaOficinasPagina({
  instalacion, instalacionCodigo, anio, mes, items, resultados, diasData,
  observaciones, codigoClave, terminoSitio = 'Instalación',
}: LimpiezaOficinasPaginaProps) {
  const emision   = new Date().toLocaleDateString('es-MX')
  const codigoFmt = codigoFormato('F-FRUS-SAN-09', codigoClave)
  const numDias   = diasEnMes(anio, mes)
  const days      = Array.from({ length: numDias }, (_, i) => i + 1)
  const dW        = dayColW(numDias)
  const mesLabel  = mesNombre(anio, mes)

  const diasDataEntries = Object.keys(diasData)
    .map(Number)
    .filter((dia) => {
      const d = diasData[dia]
      return d.realizo || d.aprobo
    })
    .sort((a, b) => a - b)

  return (
    <Page
      size="A4"
      orientation="landscape"
      style={{ fontFamily: 'Helvetica', fontSize: 7, padding: MARGIN, paddingBottom: 50, backgroundColor: PC.white }}
    >
      <PdfFooter moduloCodigo="M31" />
      <TopBar />

      <PdfHeader
        titulo="BITÁCORA DE LIMPIEZA DE LAS OFICINAS"
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
          <PdfField label="Área" value="Oficinas" />
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

      {/* Registro de personal */}
      {diasDataEntries.length > 0 && (
        <>
          <PdfSectionBanner>Registro diario de personal</PdfSectionBanner>
          <View style={{ borderLeftWidth: 1, borderLeftColor: PC.border, borderTopWidth: 1, borderTopColor: PC.border, marginTop: 4, marginBottom: 4 }}>
            <View style={{ flexDirection: 'row' }}>
              {[
                { label: 'Dia', w: D_COL.dia },
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

export function LimpiezaOficinasPDF(props: LimpiezaOficinasPaginaProps) {
  return (
    <Document
      title={`Limpieza Oficinas ${mesNombre(props.anio, props.mes)}`}
      author="M.A.D.Y."
      creator="M.A.D.Y. Inocuidad Inteligente"
      producer="M.A.D.Y. Inocuidad Inteligente"
      subject={`Bitácora de Limpieza de las Oficinas — ${props.instalacion}`}
      keywords="MADY, inocuidad, limpieza, oficinas"
    >
      <LimpiezaOficinasPagina {...props} />
    </Document>
  )
}

export function LimpiezaOficinasConsolidadoPDF({ paginas }: LimpiezaOficinasConsolidadoProps) {
  return (
    <Document
      title="Limpieza Oficinas Consolidado"
      author="M.A.D.Y."
      creator="M.A.D.Y. Inocuidad Inteligente"
      producer="M.A.D.Y. Inocuidad Inteligente"
      subject="Bitácora de Limpieza de las Oficinas — Consolidado"
      keywords="MADY, inocuidad, limpieza, oficinas, consolidado"
    >
      {paginas.map((p, i) => <LimpiezaOficinasPagina key={i} {...p} />)}
    </Document>
  )
}
