import { Document, Page, View, Text, StyleSheet } from '@react-pdf/renderer'
import { MadyLogoPDF } from '@/lib/pdf/MadyLogoPDF'
import { codigoFormato } from '@/lib/codigoFormato'

export interface M43PuntoPDFRow {
  id: string
  orden: number
  texto: string
}

export interface InspeccionAlmacenEmpaquePaginaProps {
  instalacion: string
  instalacionCodigo: string
  mesLabel: string
  mesDate: string
  realizadoPor: string | null
  verifica: string | null
  autoriza: string | null
  observaciones: string | null
  puntos: M43PuntoPDFRow[]
  diasInspeccionados: number[]
  matriz: Record<number, Record<string, string>>
  accionesTomadas: Record<number, string>
  codigoClave: string
}

export interface InspeccionAlmacenEmpaqueConsolidadoPDFProps {
  paginas: InspeccionAlmacenEmpaquePaginaProps[]
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
const C_COLOR  = '#0D5A8F'
const NC_COLOR = '#C02A2A'
const NA_COLOR = '#717182'
const HDR_BG   = '#E8F1F9'

const MARGIN     = 20
const PAGE_W     = 841.89 - MARGIN * 2
const PUNTO_COL  = 165
const DAY_AREA_W = PAGE_W - PUNTO_COL

function dayColW(numDias: number): number {
  return Math.floor(DAY_AREA_W / Math.max(numDias, 1))
}

function diasDelMes(mesDate: string): number[] {
  const d = new Date(mesDate + 'T12:00:00')
  const total = new Date(d.getFullYear(), d.getMonth() + 1, 0).getDate()
  return Array.from({ length: total }, (_, i) => i + 1)
}

function valorLabel(val: string): string {
  if (val === 'cumple')    return 'C'
  if (val === 'no_cumple') return 'NC'
  return 'N/A'
}

function valorColor(val: string): string {
  if (val === 'cumple')    return C_COLOR
  if (val === 'no_cumple') return NC_COLOR
  return NA_COLOR
}

const s = StyleSheet.create({
  page: {
    fontFamily: 'Helvetica',
    fontSize: 8,
    color: DARK,
    paddingTop: MARGIN,
    paddingBottom: MARGIN + 12,
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
  headerTitle:  { flex: 1, textAlign: 'center', fontSize: 9, fontFamily: 'Helvetica-Bold' },
  headerMeta:   { width: 90, fontSize: 6, textAlign: 'right', color: MUTED },
  infoRow: { flexDirection: 'row', gap: 6, marginBottom: 6 },
  infoBox: {
    flex: 1, borderWidth: 1, borderColor: BORDER, borderRadius: 3,
    paddingTop: 3, paddingBottom: 3, paddingLeft: 5, paddingRight: 5,
  },
  infoLabel: { fontSize: 6, color: MUTED, marginBottom: 1 },
  infoValue:  { fontSize: 7.5, fontFamily: 'Helvetica-Bold' },
  dayHeader: {
    borderWidth: 1, borderColor: BORDER, backgroundColor: HDR_BG,
    paddingTop: 3, paddingBottom: 3, alignItems: 'center', justifyContent: 'center',
  },
  dayHeaderText: { fontSize: 6, fontFamily: 'Helvetica-Bold', color: PRIMARY },
  puntoColHeader: {
    width: PUNTO_COL, borderWidth: 1, borderColor: BORDER, backgroundColor: HDR_BG,
    paddingTop: 3, paddingBottom: 3, paddingLeft: 4,
  },
  puntoColHeaderText: { fontSize: 7, fontFamily: 'Helvetica-Bold', color: DARK },
  dataRow:  { flexDirection: 'row' },
  puntoCell: {
    width: PUNTO_COL, borderWidth: 1, borderColor: BORDER,
    paddingTop: 2, paddingBottom: 2, paddingLeft: 4, justifyContent: 'center',
  },
  puntoText: { fontSize: 5.5 },
  valueCell: {
    borderWidth: 1, borderColor: BORDER,
    alignItems: 'center', justifyContent: 'center',
    paddingTop: 2, paddingBottom: 2,
  },
  footerSep:    { borderTopWidth: 1, borderTopColor: BORDER, marginTop: 6, paddingTop: 4 },
  accionesTitle: { fontSize: 6, fontFamily: 'Helvetica-Bold', color: MUTED, marginBottom: 2 },
  accionRow:    { flexDirection: 'row', gap: 3, marginBottom: 2, alignItems: 'flex-start' },
  accionDia:    { fontSize: 5.5, fontFamily: 'Helvetica-Bold', color: DARK, width: 28 },
  accionTexto:  { fontSize: 5.5, color: DARK, flex: 1 },
  footerLabel:  { fontSize: 6, color: MUTED },
  footerValue:  { fontSize: 7 },
  firmaRow: { marginTop: 8, flexDirection: 'row', gap: 16 },
  firmaBloque: { flex: 1, alignItems: 'center', borderTopWidth: 1, borderTopColor: BORDER, paddingTop: 4 },
  firmaLabel: { fontSize: 6.5, color: MUTED },
  piePagina: {
    position: 'absolute', bottom: 10, left: MARGIN, right: MARGIN,
    textAlign: 'center', fontSize: 6, color: MUTED,
  },
})

export function InspeccionAlmacenEmpaquePagina({
  instalacion, instalacionCodigo, mesLabel, mesDate,
  realizadoPor, verifica, autoriza, observaciones,
  puntos, diasInspeccionados, matriz, accionesTomadas, codigoClave,
}: InspeccionAlmacenEmpaquePaginaProps) {
  const todosLosDias    = diasDelMes(mesDate)
  const dW              = dayColW(todosLosDias.length)
  const inspeccionadosSet = new Set(diasInspeccionados)

  const accionesEntries = (Object.entries(accionesTomadas) as [string, string][])
    .map(([k, v]) => [Number(k), v] as [number, string])
    .filter(([, v]) => v?.trim())
    .sort(([a], [b]) => a - b)

  return (
    <Page size="A4" orientation="landscape" style={s.page}>

      {/* Header */}
      <View style={s.header}>
        <View>
          <MadyLogoPDF style={{ fontSize: 10, fontFamily: 'Helvetica-Bold', color: PRIMARY }} />
          <Text style={{ fontSize: 6, color: MUTED, marginTop: 2 }}>Inocuidad Alimentaria</Text>
        </View>
        <View style={{ flex: 1, alignItems: 'center' }}>
          <Text style={s.headerTitle}>INSPECCION DE ALMACEN DE MATERIAL DE EMPAQUE</Text>
          <Text style={{ fontSize: 6, color: MUTED, marginTop: 2 }}>
            {`Codigo: ${codigoFormato('F-FRUS-PRO-08', codigoClave)}  |  Frecuencia: Mensual  |  Mes: ${mesLabel}`}
          </Text>
        </View>
        <View style={s.headerMeta}>
          <Text>Dias: {diasInspeccionados.length}</Text>
        </View>
      </View>

      {/* Info boxes */}
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
          <Text style={s.infoLabel}>Mes</Text>
          <Text style={s.infoValue}>{mesLabel}</Text>
        </View>
        <View style={[s.infoBox, { flex: 2 }]}>
          <Text style={s.infoLabel}>Realizado por</Text>
          <Text style={s.infoValue}>{realizadoPor ?? '—'}</Text>
        </View>
        <View style={[s.infoBox, { flex: 2 }]}>
          <Text style={s.infoLabel}>Verifica</Text>
          <Text style={s.infoValue}>{verifica ?? '—'}</Text>
        </View>
        {autoriza ? (
          <View style={[s.infoBox, { flex: 2 }]}>
            <Text style={s.infoLabel}>Autoriza</Text>
            <Text style={s.infoValue}>{autoriza}</Text>
          </View>
        ) : null}
      </View>

      {/* Table header row */}
      <View style={{ flexDirection: 'row' }}>
        <View style={s.puntoColHeader}>
          <Text style={s.puntoColHeaderText}>Punto de inspeccion</Text>
        </View>
        {todosLosDias.map((d) => (
          <View key={d} style={[s.dayHeader, { width: dW }]}>
            <Text style={s.dayHeaderText}>{d}</Text>
          </View>
        ))}
      </View>

      {/* Data rows — one per punto */}
      {puntos.map((punto, idx) => {
        const bg = idx % 2 === 0 ? WHITE : ROW_ALT
        return (
          <View key={punto.id} style={[s.dataRow, { backgroundColor: bg }]}>
            <View style={[s.puntoCell, { backgroundColor: bg }]}>
              <Text style={s.puntoText}>{punto.orden}. {punto.texto}</Text>
            </View>
            {todosLosDias.map((d) => {
              if (!inspeccionadosSet.has(d)) {
                return <View key={d} style={[s.valueCell, { width: dW, backgroundColor: bg }]} />
              }
              const rawVal = matriz[d]?.[punto.id]
              if (!rawVal) return <View key={d} style={[s.valueCell, { width: dW, backgroundColor: bg }]} />
              const label = valorLabel(rawVal)
              const color = valorColor(rawVal)
              return (
                <View key={d} style={[s.valueCell, { width: dW, backgroundColor: bg }]}>
                  <Text style={{ fontSize: label === 'NC' ? 5 : 6, fontFamily: 'Helvetica-Bold', color }}>{label}</Text>
                </View>
              )
            })}
          </View>
        )
      })}

      {/* Footer */}
      <View style={s.footerSep}>
        {accionesEntries.length > 0 && (
          <View style={{ marginBottom: 4 }}>
            <Text style={s.accionesTitle}>ACCIONES TOMADAS:</Text>
            {accionesEntries.map(([diaNum, texto]) => (
              <View key={diaNum} style={s.accionRow}>
                <Text style={s.accionDia}>Dia {diaNum}:</Text>
                <Text style={s.accionTexto}>{texto}</Text>
              </View>
            ))}
          </View>
        )}

        {observaciones ? (
          <View style={{ marginBottom: 4 }}>
            <Text style={s.footerLabel}>Observaciones:</Text>
            <Text style={s.footerValue}>{observaciones}</Text>
          </View>
        ) : null}

        <View style={s.firmaRow}>
          <View style={s.firmaBloque}>
            <View style={{ height: 16 }} />
            <Text style={s.firmaLabel}>Realizado por: {realizadoPor ?? ''}</Text>
          </View>
          <View style={s.firmaBloque}>
            <View style={{ height: 16 }} />
            <Text style={s.firmaLabel}>Verifico: {verifica ?? 'Responsable del Almacen'}</Text>
          </View>
          {autoriza ? (
            <View style={s.firmaBloque}>
              <View style={{ height: 16 }} />
              <Text style={s.firmaLabel}>Autorizo: {autoriza}</Text>
            </View>
          ) : null}
        </View>
      </View>

      <Text style={s.piePagina} fixed>M.A.D.Y · Inocuidad Inteligente</Text>
    </Page>
  )
}

export function InspeccionAlmacenEmpaquePDF(props: InspeccionAlmacenEmpaquePaginaProps) {
  return (
    <Document>
      <InspeccionAlmacenEmpaquePagina {...props} />
    </Document>
  )
}

export function InspeccionAlmacenEmpaqueConsolidadoPDF({
  paginas, instalacionNombre, desde, hasta,
}: InspeccionAlmacenEmpaqueConsolidadoPDFProps) {
  return (
    <Document title={`Inspeccion Almacen Empaque — ${instalacionNombre} ${desde} a ${hasta}`}>
      {paginas.map((p, i) => (
        <InspeccionAlmacenEmpaquePagina key={i} {...p} />
      ))}
    </Document>
  )
}
