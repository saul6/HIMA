import { Document, Page, View, Text, StyleSheet } from '@react-pdf/renderer'
import { MadyLogoPDF } from '@/lib/pdf/MadyLogoPDF'

export type ValorM37PDF = 'hecho' | 'no_hecho' | 'na'

export interface M37ItemPDF { id: string; nombre: string; frecuencia: string; es_inspeccion_plaga: boolean }

export interface M37DiaDataPDF {
  cloro_cisterna: number | null
  ajuste_cloro_cisterna: string | null
  cloro_desinfeccion: number | null
  ajuste_cloro_desinfeccion: string | null
  realizo: string | null
  aprobo: string | null
}

export interface LimpiezaCisternaPaginaProps {
  instalacion: string
  instalacionCodigo: string
  anio: number
  mes: number
  items: M37ItemPDF[]
  resultados: Record<number, Record<string, ValorM37PDF>>
  diasData: Record<number, M37DiaDataPDF>
  observaciones: string | null
}

export interface LimpiezaCisternaConsolidadoProps {
  paginas: LimpiezaCisternaPaginaProps[]
  instalacionNombre: string
  desde: string
  hasta: string
}

const PRIMARY  = '#2B7AB5'
const DARK     = '#1A1A1A'
const BORDER   = '#CCCCCC'
const WHITE    = '#FFFFFF'
const MUTED    = '#717182'
const ROW_ALT  = '#F5F9FE'
const HDR_BG   = '#E8F1F9'
const OK_COLOR = '#2E7D32'
const NO_COLOR = '#C02A2A'
const NA_COLOR = '#717182'

const MARGIN     = 20
const PAGE_W     = 841.89 - MARGIN * 2
const ITEM_COL_W = 160
const DAY_AREA_W = PAGE_W - ITEM_COL_W

function dayColW(numDias: number): number {
  return Math.floor(DAY_AREA_W / Math.max(numDias, 1))
}

function diasEnMes(anio: number, mes: number): number {
  return new Date(anio, mes, 0).getDate()
}

function mesNombre(anio: number, mes: number): string {
  const nombres = ['Enero','Febrero','Marzo','Abril','Mayo','Junio','Julio','Agosto','Septiembre','Octubre','Noviembre','Diciembre']
  return `${nombres[mes - 1]} ${anio}`
}

const s = StyleSheet.create({
  page:         { fontFamily: 'Helvetica', fontSize: 7, color: DARK, paddingHorizontal: MARGIN, paddingVertical: MARGIN, backgroundColor: WHITE },
  headerRow:    { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginBottom: 6 },
  titleBlock:   { flex: 1, alignItems: 'center' },
  title:        { fontSize: 8.5, fontFamily: 'Helvetica-Bold', color: PRIMARY, textAlign: 'center' },
  subtitle:     { fontSize: 6.5, color: MUTED, textAlign: 'center', marginTop: 1 },
  codigoText:   { fontSize: 6.5, color: MUTED },
  infoRow:      { flexDirection: 'row', borderWidth: 1, borderColor: BORDER, marginBottom: 4 },
  infoCell:     { flex: 1, padding: 3, borderRightWidth: 1, borderRightColor: BORDER },
  infoCellLast: { flex: 1, padding: 3 },
  infoLabel:    { fontSize: 5.5, color: MUTED, fontFamily: 'Helvetica-Bold', textTransform: 'uppercase', marginBottom: 1 },
  infoValue:    { fontSize: 7, color: DARK },
  table:        { borderWidth: 1, borderColor: BORDER },
  hdrRow:       { flexDirection: 'row', backgroundColor: HDR_BG },
  hdrCell:      { padding: 3, borderRightWidth: 1, borderRightColor: BORDER, borderBottomWidth: 1, borderBottomColor: BORDER, justifyContent: 'center', alignItems: 'center' },
  hdrText:      { fontFamily: 'Helvetica-Bold', fontSize: 6.5, textAlign: 'center', color: DARK },
  itemRow:      { flexDirection: 'row' },
  itemCell:     { width: ITEM_COL_W, padding: 3, borderRightWidth: 1, borderRightColor: BORDER, borderBottomWidth: 1, borderBottomColor: BORDER, justifyContent: 'center' },
  itemName:     { fontSize: 6, color: DARK },
  itemFrec:     { fontSize: 5.5, color: MUTED, marginTop: 0.5 },
  dayCell:      { borderRightWidth: 1, borderRightColor: BORDER, borderBottomWidth: 1, borderBottomColor: BORDER, justifyContent: 'center', alignItems: 'center', padding: 1 },
  dayCellText:  { fontSize: 6, textAlign: 'center' },
  sectionTitle: { fontFamily: 'Helvetica-Bold', fontSize: 7, color: PRIMARY, marginTop: 6, marginBottom: 2 },
  dTable:       { borderWidth: 1, borderColor: BORDER, marginBottom: 4 },
  dHdrRow:      { flexDirection: 'row', backgroundColor: HDR_BG },
  dRow:         { flexDirection: 'row' },
  dCell:        { padding: 2.5, borderRightWidth: 1, borderRightColor: BORDER, borderBottomWidth: 1, borderBottomColor: BORDER, justifyContent: 'center', alignItems: 'center' },
  dText:        { fontSize: 6, textAlign: 'center', color: DARK },
  dHdrText:     { fontSize: 6, fontFamily: 'Helvetica-Bold', textAlign: 'center', color: DARK },
  obsBox:       { borderWidth: 1, borderColor: BORDER, padding: 4, marginTop: 4, minHeight: 20 },
  obsLabel:     { fontSize: 5.5, color: MUTED, fontFamily: 'Helvetica-Bold', marginBottom: 2 },
  obsText:      { fontSize: 6.5, color: DARK },
  nota:         { fontSize: 5.5, color: MUTED, marginTop: 3 },
  firmasRow:    { flexDirection: 'row', justifyContent: 'space-between', marginTop: 8 },
  firmaItem:    { flex: 1, marginHorizontal: 4, borderTopWidth: 1, borderTopColor: DARK, paddingTop: 3, alignItems: 'center' },
  firmaText:    { fontSize: 6.5, color: DARK, textAlign: 'center' },
  footer:       { marginTop: 6, borderTopWidth: 1, borderTopColor: BORDER, paddingTop: 3, flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  footerText:   { fontSize: 5.5, color: MUTED },
})

const D_COL_WIDTHS = { dia: 20, cloro_cist: 65, aj_cist: 60, cloro_des: 65, aj_des: 60, realizo: 95, aprobo: 95 }

function valorDisplay(v: ValorM37PDF | undefined, isPlaga: boolean): { text: string; color: string } {
  if (isPlaga) {
    if (v === 'na')    return { text: 'Sin plaga', color: OK_COLOR }
    if (v === 'hecho') return { text: 'Con plaga', color: NO_COLOR }
    return { text: '', color: DARK }
  }
  if (v === 'hecho')    return { text: 'OK', color: OK_COLOR }
  if (v === 'no_hecho') return { text: 'No', color: NO_COLOR }
  if (v === 'na')       return { text: 'N/A', color: NA_COLOR }
  return { text: '', color: DARK }
}

export function LimpiezaCisternaPagina({ instalacion, instalacionCodigo, anio, mes, items, resultados, diasData, observaciones }: LimpiezaCisternaPaginaProps) {
  const numDias = diasEnMes(anio, mes)
  const days = Array.from({ length: numDias }, (_, i) => i + 1)
  const dW = dayColW(numDias)
  const mesLabel = mesNombre(anio, mes)

  const diasDataEntries = Object.keys(diasData).map(Number).filter((dia) => {
    const d = diasData[dia]
    return d.cloro_cisterna != null || d.ajuste_cloro_cisterna || d.cloro_desinfeccion != null || d.ajuste_cloro_desinfeccion || d.realizo || d.aprobo
  }).sort((a, b) => a - b)

  return (
    <Page size="A4" orientation="landscape" style={s.page}>
      <View style={s.headerRow}>
        <MadyLogoPDF size={28} />
        <View style={s.titleBlock}>
          <Text style={s.title}>BITACORA DE LIMPIEZA Y CLORACION DE LA CISTERNA</Text>
          <Text style={s.subtitle}>{mesLabel}</Text>
        </View>
        <Text style={s.codigoText}>Codigo: F-FRUS-SAN-15</Text>
      </View>

      <View style={s.infoRow}>
        <View style={s.infoCell}>
          <Text style={s.infoLabel}>Instalacion</Text>
          <Text style={s.infoValue}>{instalacion}</Text>
        </View>
        <View style={s.infoCell}>
          <Text style={s.infoLabel}>Codigo</Text>
          <Text style={s.infoValue}>{instalacionCodigo}</Text>
        </View>
        <View style={s.infoCell}>
          <Text style={s.infoLabel}>Area</Text>
          <Text style={s.infoValue}>Cisterna</Text>
        </View>
        <View style={s.infoCellLast}>
          <Text style={s.infoLabel}>Mes / Ano</Text>
          <Text style={s.infoValue}>{mesLabel}</Text>
        </View>
      </View>

      <View style={s.table}>
        <View style={s.hdrRow}>
          <View style={[s.hdrCell, { width: ITEM_COL_W, borderLeftWidth: 0 }]}>
            <Text style={s.hdrText}>Actividad / Frecuencia</Text>
          </View>
          {days.map((d) => (
            <View key={d} style={[s.hdrCell, { width: dW }]}>
              <Text style={s.hdrText}>{d}</Text>
            </View>
          ))}
        </View>
        {items.map((item, idx) => (
          <View key={item.id} style={[s.itemRow, { backgroundColor: idx % 2 === 1 ? ROW_ALT : WHITE }]}>
            <View style={s.itemCell}>
              <Text style={s.itemName}>{item.nombre}</Text>
              <Text style={s.itemFrec}>Frec: {item.frecuencia}</Text>
            </View>
            {days.map((d) => {
              const { text, color } = valorDisplay(resultados[d]?.[item.id], item.es_inspeccion_plaga)
              return (
                <View key={d} style={[s.dayCell, { width: dW }]}>
                  <Text style={[s.dayCellText, { color }]}>{text}</Text>
                </View>
              )
            })}
          </View>
        ))}
      </View>

      {diasDataEntries.length > 0 && (
        <>
          <Text style={s.sectionTitle}>Registro diario de cloracion y personal</Text>
          <View style={s.dTable}>
            <View style={s.dHdrRow}>
              <View style={[s.dCell, { width: D_COL_WIDTHS.dia }]}><Text style={s.dHdrText}>Dia</Text></View>
              <View style={[s.dCell, { width: D_COL_WIDTHS.cloro_cist }]}><Text style={s.dHdrText}>Cloro cisterna (1.5-3.0 ppm)</Text></View>
              <View style={[s.dCell, { width: D_COL_WIDTHS.aj_cist }]}><Text style={s.dHdrText}>Ajuste cloro cisterna</Text></View>
              <View style={[s.dCell, { width: D_COL_WIDTHS.cloro_des }]}><Text style={s.dHdrText}>Cloro desinfeccion (100-200 ppm)</Text></View>
              <View style={[s.dCell, { width: D_COL_WIDTHS.aj_des }]}><Text style={s.dHdrText}>Ajuste cloro desinfeccion</Text></View>
              <View style={[s.dCell, { width: D_COL_WIDTHS.realizo }]}><Text style={s.dHdrText}>Realizo</Text></View>
              <View style={[s.dCell, { width: D_COL_WIDTHS.aprobo, borderRightWidth: 0 }]}><Text style={s.dHdrText}>Aprobo</Text></View>
            </View>
            {diasDataEntries.map((dia, idx) => {
              const d = diasData[dia]
              return (
                <View key={dia} style={[s.dRow, { backgroundColor: idx % 2 === 1 ? ROW_ALT : WHITE }]}>
                  <View style={[s.dCell, { width: D_COL_WIDTHS.dia }]}><Text style={s.dText}>{dia}</Text></View>
                  <View style={[s.dCell, { width: D_COL_WIDTHS.cloro_cist }]}><Text style={s.dText}>{d.cloro_cisterna != null ? String(d.cloro_cisterna) : ''}</Text></View>
                  <View style={[s.dCell, { width: D_COL_WIDTHS.aj_cist }]}><Text style={s.dText}>{d.ajuste_cloro_cisterna ?? ''}</Text></View>
                  <View style={[s.dCell, { width: D_COL_WIDTHS.cloro_des }]}><Text style={s.dText}>{d.cloro_desinfeccion != null ? String(d.cloro_desinfeccion) : ''}</Text></View>
                  <View style={[s.dCell, { width: D_COL_WIDTHS.aj_des }]}><Text style={s.dText}>{d.ajuste_cloro_desinfeccion ?? ''}</Text></View>
                  <View style={[s.dCell, { width: D_COL_WIDTHS.realizo }]}><Text style={s.dText}>{d.realizo ?? ''}</Text></View>
                  <View style={[s.dCell, { width: D_COL_WIDTHS.aprobo, borderRightWidth: 0 }]}><Text style={s.dText}>{d.aprobo ?? ''}</Text></View>
                </View>
              )
            })}
          </View>
        </>
      )}

      {observaciones && (
        <View style={s.obsBox}>
          <Text style={s.obsLabel}>OBSERVACIONES</Text>
          <Text style={s.obsText}>{observaciones}</Text>
        </View>
      )}

      <Text style={s.nota}>
        Nota: Cloro cisterna recomendado 1.5-3.0 ppm. Cloro desinfeccion de superficies recomendado 100-200 ppm. Ajuste si la concentracion esta fuera del rango. En caso de hallazgo de plaga se registra incidencia en M13.
      </Text>

      <View style={s.firmasRow}>
        <View style={s.firmaItem}>
          <Text style={s.firmaText}>Realizo: ___________________</Text>
        </View>
        <View style={s.firmaItem}>
          <Text style={s.firmaText}>Aprobo: ___________________</Text>
        </View>
        <View style={s.firmaItem}>
          <Text style={s.firmaText}>Responsable de Inocuidad — Firma: ___________________</Text>
        </View>
      </View>

      <View style={s.footer}>
        <Text style={s.footerText}>F-FRUS-SAN-15</Text>
        <Text style={s.footerText}>M.A.D.Y — DuoMind Solutions</Text>
      </View>
    </Page>
  )
}

export function LimpiezaCisternaPDF(props: LimpiezaCisternaPaginaProps) {
  return (
    <Document>
      <LimpiezaCisternaPagina {...props} />
    </Document>
  )
}

export function LimpiezaCisternaConsolidadoPDF({ paginas }: LimpiezaCisternaConsolidadoProps) {
  return (
    <Document>
      {paginas.map((p, i) => (
        <LimpiezaCisternaPagina key={i} {...p} />
      ))}
    </Document>
  )
}
