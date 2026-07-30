// PATRÓN INOCUIDAD — PDF M19 (modelo calendario, Cuarto Frío)

import { Document, Page, View, Text, StyleSheet } from '@react-pdf/renderer'
import { MadyLogoPDF } from '@/lib/pdf/MadyLogoPDF'

export interface M19ItemPDFRow {
  id: string
  seccion_label: string
  item: string
}

export interface InspeccionPreoperacionalCoolerPaginaProps {
  instalacion: string
  instalacionCodigo: string
  mesLabel: string
  mesDate: string
  realizadoPor: string | null
  items: M19ItemPDFRow[]
  diasInspeccionados: string[]
  // dia_fecha -> item_id -> 'Si' | 'No' | 'N/A'
  matriz: Record<string, Record<string, string>>
  codigosCorrectivos: { diaNum: string; itemLabel: string; codigo: string }[]
  observaciones: string | null
}

export interface InspeccionPreoperacionalCoolerConsolidadoPDFProps {
  paginas: InspeccionPreoperacionalCoolerPaginaProps[]
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
const SI_COLOR = '#0D5A8F'
const NO_COLOR = '#C02A2A'
const NA_COLOR = '#717182'
const HDR_BG   = '#E8F1F9'

const MARGIN      = 20
const PAGE_W      = 841.89 - MARGIN * 2
const ITEM_COL_W  = 160
const DAY_AREA_W  = PAGE_W - ITEM_COL_W

function dayColW(numDias: number): number {
  return Math.floor(DAY_AREA_W / Math.max(numDias, 1))
}

function diasDelMes(mesDate: string): string[] {
  const d = new Date(mesDate + 'T12:00:00')
  const year = d.getFullYear()
  const month = d.getMonth()
  const total = new Date(year, month + 1, 0).getDate()
  const result: string[] = []
  for (let i = 1; i <= total; i++) {
    result.push(`${year}-${String(month + 1).padStart(2, '0')}-${String(i).padStart(2, '0')}`)
  }
  return result
}

function formatDayNum(iso: string): string {
  try { return String(new Date(iso + 'T12:00:00').getDate()) }
  catch { return iso }
}

function agruparPorSeccion(items: M19ItemPDFRow[]) {
  const grupos: { label: string; items: M19ItemPDFRow[] }[] = []
  let actual: { label: string; items: M19ItemPDFRow[] } | null = null
  for (const item of items) {
    if (!actual || actual.label !== item.seccion_label) {
      actual = { label: item.seccion_label, items: [] }
      grupos.push(actual)
    }
    actual.items.push(item)
  }
  return grupos
}

const s = StyleSheet.create({
  page: {
    fontFamily: 'Helvetica',
    fontSize: 8,
    color: DARK,
    paddingTop: MARGIN,
    paddingBottom: MARGIN,
    paddingLeft: MARGIN,
    paddingRight: MARGIN,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 8,
    borderBottomWidth: 2,
    borderBottomColor: PRIMARY,
    paddingBottom: 6,
  },
  headerLogo:    { fontSize: 10, fontFamily: 'Helvetica-Bold', color: PRIMARY },
  headerLogoSub: { fontSize: 6, color: MUTED, marginTop: 2 },
  headerTitle:   { flex: 1, textAlign: 'center', fontSize: 9, fontFamily: 'Helvetica-Bold' },
  headerMeta:    { width: 90, fontSize: 6, textAlign: 'right', color: MUTED },
  infoRow: { flexDirection: 'row', gap: 8, marginBottom: 6 },
  infoBox: {
    flex: 1,
    borderWidth: 1,
    borderColor: BORDER,
    borderRadius: 3,
    paddingTop: 3,
    paddingBottom: 3,
    paddingLeft: 5,
    paddingRight: 5,
  },
  infoLabel: { fontSize: 6, color: MUTED, marginBottom: 1 },
  infoValue: { fontSize: 8, fontFamily: 'Helvetica-Bold' },
  seccionBand: {
    backgroundColor: PRIMARY,
    paddingTop: 2,
    paddingBottom: 2,
    paddingLeft: 4,
    flexDirection: 'row',
  },
  seccionText: { fontSize: 6.5, fontFamily: 'Helvetica-Bold', color: WHITE, flex: 1 },
  dayHeader: {
    borderWidth: 1,
    borderColor: BORDER,
    backgroundColor: HDR_BG,
    paddingTop: 3,
    paddingBottom: 3,
    alignItems: 'center',
    justifyContent: 'center',
  },
  dayHeaderText: { fontSize: 6, fontFamily: 'Helvetica-Bold', color: PRIMARY },
  itemColHeader: {
    width: ITEM_COL_W,
    borderWidth: 1,
    borderColor: BORDER,
    backgroundColor: HDR_BG,
    paddingTop: 3,
    paddingBottom: 3,
    paddingLeft: 4,
  },
  itemColHeaderText: { fontSize: 7, fontFamily: 'Helvetica-Bold', color: DARK },
  dataRow: { flexDirection: 'row' },
  itemCell: {
    width: ITEM_COL_W,
    borderWidth: 1,
    borderColor: BORDER,
    paddingTop: 2,
    paddingBottom: 2,
    paddingLeft: 4,
    justifyContent: 'center',
  },
  itemText: { fontSize: 5.5 },
  valueCell: {
    borderWidth: 1,
    borderColor: BORDER,
    alignItems: 'center',
    justifyContent: 'center',
    paddingTop: 2,
    paddingBottom: 2,
  },
  footerSep:   { borderTopWidth: 1, borderTopColor: BORDER, marginTop: 6, paddingTop: 4 },
  footerRow:   { flexDirection: 'row', gap: 10, marginBottom: 4 },
  footerLabel: { fontSize: 6, color: MUTED },
  footerValue: { fontSize: 7 },
  codigosTitle: { fontSize: 6, fontFamily: 'Helvetica-Bold', color: MUTED, marginBottom: 2 },
  codigosItem:  { fontSize: 5.5, color: DARK, marginBottom: 1 },
  firmaRow: { marginTop: 8, flexDirection: 'row', gap: 20 },
  firmaBloque: {
    alignItems: 'center',
    borderTopWidth: 1,
    borderTopColor: BORDER,
    paddingTop: 4,
  },
  firmaLabel: { fontSize: 7, color: MUTED },
  piePagina: {
    position: 'absolute',
    bottom: 10,
    left: MARGIN,
    right: MARGIN,
    textAlign: 'center',
    fontSize: 6,
    color: MUTED,
  },
})

export function InspeccionPreoperacionalCoolerPagina({
  instalacion, instalacionCodigo, mesLabel, mesDate, realizadoPor,
  items, diasInspeccionados, matriz, codigosCorrectivos, observaciones,
}: InspeccionPreoperacionalCoolerPaginaProps) {
  const secciones = agruparPorSeccion(items)
  const todosLosDias = diasDelMes(mesDate)
  const dW = dayColW(todosLosDias.length)
  const inspeccionadosSet = new Set(diasInspeccionados)

  return (
    <Page size="A4" orientation="landscape" style={s.page}>

      <View style={s.header}>
        <View>
          <MadyLogoPDF style={s.headerLogo} />
          <Text style={s.headerLogoSub}>Inocuidad Alimentaria</Text>
        </View>
        <View style={{ flex: 1, alignItems: 'center' }}>
          <Text style={s.headerTitle}>INSPECCION PRE-OPERACIONAL</Text>
          <Text style={{ fontSize: 6, color: MUTED, marginTop: 2 }}>
            Codigo: F-FRUS-CAL-07  |  Rev 04  |  Frecuencia: Diaria  |  Mes: {mesLabel}
          </Text>
        </View>
        <View style={s.headerMeta}>
          <Text>Dias: {diasInspeccionados.length}</Text>
        </View>
      </View>

      <View style={s.infoRow}>
        <View style={[s.infoBox, { flex: 3 }]}>
          <Text style={s.infoLabel}>Instalacion</Text>
          <Text style={s.infoValue}>{instalacion}</Text>
        </View>
        <View style={s.infoBox}>
          <Text style={s.infoLabel}>Codigo</Text>
          <Text style={s.infoValue}>{instalacionCodigo}</Text>
        </View>
        <View style={[s.infoBox, { flex: 2 }]}>
          <Text style={s.infoLabel}>Mes de Inspeccion</Text>
          <Text style={s.infoValue}>{mesLabel}</Text>
        </View>
        <View style={[s.infoBox, { flex: 3 }]}>
          <Text style={s.infoLabel}>Realizado por</Text>
          <Text style={s.infoValue}>{realizadoPor ?? '—'}</Text>
        </View>
      </View>

      <View style={{ flexDirection: 'row' }}>
        <View style={s.itemColHeader}>
          <Text style={s.itemColHeaderText}>Item de inspeccion</Text>
        </View>
        {todosLosDias.map((fecha) => (
          <View key={fecha} style={[s.dayHeader, { width: dW }]}>
            <Text style={s.dayHeaderText}>{formatDayNum(fecha)}</Text>
          </View>
        ))}
      </View>

      {secciones.map((sec) => (
        <View key={sec.label}>
          <View style={s.seccionBand}>
            <Text style={s.seccionText}>{sec.label}</Text>
          </View>

          {sec.items.map((item, idx) => {
            const bg = idx % 2 === 0 ? WHITE : ROW_ALT
            return (
              <View key={item.id} style={[s.dataRow, { backgroundColor: bg }]}>
                <View style={[s.itemCell, { backgroundColor: bg }]}>
                  <Text style={s.itemText}>{item.item}</Text>
                </View>
                {todosLosDias.map((fecha) => {
                  if (!inspeccionadosSet.has(fecha)) {
                    return <View key={fecha} style={[s.valueCell, { width: dW, backgroundColor: bg }]} />
                  }
                  const val = matriz[fecha]?.[item.id] ?? 'Si'
                  const color = val === 'Si' ? SI_COLOR : val === 'No' ? NO_COLOR : NA_COLOR
                  return (
                    <View key={fecha} style={[s.valueCell, { width: dW, backgroundColor: bg }]}>
                      <Text style={{ fontSize: 6, fontFamily: 'Helvetica-Bold', color }}>{val}</Text>
                    </View>
                  )
                })}
              </View>
            )
          })}
        </View>
      ))}

      <View style={s.footerSep}>
        {codigosCorrectivos.length > 0 && (
          <View style={{ marginBottom: 4 }}>
            <Text style={s.codigosTitle}>CODIGOS CORRECTIVOS:</Text>
            {codigosCorrectivos.map((cc, i) => (
              <Text key={i} style={s.codigosItem}>
                Dia {cc.diaNum} — {cc.itemLabel}: {cc.codigo}
              </Text>
            ))}
          </View>
        )}

        <View style={s.footerRow}>
          {observaciones ? (
            <View style={{ flex: 1 }}>
              <Text style={s.footerLabel}>Observaciones:</Text>
              <Text style={s.footerValue}>{observaciones}</Text>
            </View>
          ) : null}
          {!observaciones && codigosCorrectivos.length === 0 && (
            <Text style={{ fontSize: 7, color: MUTED }}>Sin observaciones adicionales.</Text>
          )}
        </View>

        <View style={s.firmaRow}>
          {realizadoPor ? (
            <View style={[s.firmaBloque, { flex: 1 }]}>
              <Text style={s.firmaLabel}>Realizado por: {realizadoPor}</Text>
            </View>
          ) : null}
          <View style={[s.firmaBloque, { flex: 2 }]}>
            <View style={{ height: 16 }} />
            <Text style={s.firmaLabel}>Verifico: Responsable del cooler</Text>
          </View>
        </View>
      </View>

      <Text style={s.piePagina} fixed>M.A.D.Y — DuoMind Solutions</Text>
    </Page>
  )
}

export function InspeccionPreoperacionalCoolerPDF(props: InspeccionPreoperacionalCoolerPaginaProps) {
  return (
    <Document>
      <InspeccionPreoperacionalCoolerPagina {...props} />
    </Document>
  )
}

export function InspeccionPreoperacionalCoolerConsolidadoPDF({
  paginas, instalacionNombre, desde, hasta,
}: InspeccionPreoperacionalCoolerConsolidadoPDFProps) {
  return (
    <Document title={`Inspeccion Pre-operacional Consolidada — ${instalacionNombre} ${desde}-${hasta}`}>
      {paginas.map((p, i) => (
        <InspeccionPreoperacionalCoolerPagina key={i} {...p} />
      ))}
    </Document>
  )
}
