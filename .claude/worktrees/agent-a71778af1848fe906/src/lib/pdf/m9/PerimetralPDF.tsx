// PATRÓN INOCUIDAD — PDF M9
// PerimetralPagina: una página A4 landscape por mes (reutilizable).
// PerimetralPDF:    documento individual (1 mes).
// PerimetralConsolidadoPDF: documento multi-página, uno por mes.

import { Document, Page, View, Text, StyleSheet } from '@react-pdf/renderer'
import { MadyLogoPDF } from '@/lib/pdf/MadyLogoPDF'

// ── Tipos ─────────────────────────────────────────────────────────────────────

export interface ItemPDFRow {
  id: string
  seccion_label: string
  item: string
}

export interface PerimetralPaginaProps {
  rancho: string
  ranchoCodigo: string
  mesLabel: string             // "Junio 2026"
  mesDate: string              // "2026-06-01" — para calcular los días del mes
  realizadoPor: string | null  // quien llenó el registro (operario)
  tieneAlmacen: boolean
  items: ItemPDFRow[]
  diasInspeccionados: string[] // ["2026-06-05", "2026-06-12", ...]  sorted
  // dia_fecha → item_id → "Si" | "No"  (solo días inspeccionados)
  matriz: Record<string, Record<string, string>>
  observaciones: string | null
  otro: string | null
}

export interface PerimetralConsolidadoPDFProps {
  paginas: PerimetralPaginaProps[]
  ranchoNombre: string
  desde: string
  hasta: string
}

// ── Paleta ────────────────────────────────────────────────────────────────────

const PRIMARY  = '#2B7AB5'
const DARK     = '#1A1A1A'
const BORDER   = '#CCCCCC'
const WHITE    = '#FFFFFF'
const MUTED    = '#717182'
const ROW_ALT  = '#F5F9FE'
const SI_COLOR = '#0D5A8F'
const NO_COLOR = '#C02A2A'
const HDR_BG   = '#E8F1F9'

// ── Medidas fijas ─────────────────────────────────────────────────────────────

// A4 landscape: 841.89 × 595.28 — márgenes 20pt para acomodar 31 columnas
const MARGIN      = 20
const PAGE_W      = 841.89 - MARGIN * 2   // ~801.89
const ITEM_COL_W  = 160
const DAY_AREA_W  = PAGE_W - ITEM_COL_W   // ~641.89

function dayColW(numDias: number): number {
  return Math.floor(DAY_AREA_W / Math.max(numDias, 1))
}

// Genera todas las fechas ISO del mes dado "YYYY-MM-01"
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

// ── Estilos ───────────────────────────────────────────────────────────────────

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

  // Header
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

  // Info chips
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

  // Sección header de la tabla (banda azul)
  seccionBand: {
    backgroundColor: PRIMARY,
    paddingTop: 3,
    paddingBottom: 3,
    paddingLeft: 4,
    flexDirection: 'row',
  },
  seccionText: { fontSize: 7, fontFamily: 'Helvetica-Bold', color: WHITE, flex: 1 },

  // Columna header de días
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

  // Item header column
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

  // Data row
  dataRow: { flexDirection: 'row' },
  itemCell: {
    width: ITEM_COL_W,
    borderWidth: 1,
    borderColor: BORDER,
    paddingTop: 3,
    paddingBottom: 3,
    paddingLeft: 4,
    justifyContent: 'center',
  },
  itemText: { fontSize: 6 },
  valueCell: {
    borderWidth: 1,
    borderColor: BORDER,
    alignItems: 'center',
    justifyContent: 'center',
    paddingTop: 3,
    paddingBottom: 3,
  },

  // Footer
  footerSep: { borderTopWidth: 1, borderTopColor: BORDER, marginTop: 8, paddingTop: 5 },
  footerRow:  { flexDirection: 'row', gap: 10, marginBottom: 4 },
  footerLabel:{ fontSize: 6, color: MUTED },
  footerValue:{ fontSize: 7 },
  firmaRow: {
    marginTop: 10,
    flexDirection: 'row',
    gap: 20,
  },
  firmaBloque: {
    alignItems: 'center',
    borderTopWidth: 1,
    borderTopColor: BORDER,
    paddingTop: 4,
  },
  firmaLabel: { fontSize: 7, color: MUTED },

  // Pie de página
  piePagina: { position: 'absolute', bottom: 10, left: MARGIN, right: MARGIN, textAlign: 'center', fontSize: 6, color: MUTED },
})

// ── Helpers ───────────────────────────────────────────────────────────────────

function agruparItemsPorSeccion(items: ItemPDFRow[]) {
  const grupos: { label: string; items: ItemPDFRow[] }[] = []
  let actual: { label: string; items: ItemPDFRow[] } | null = null
  for (const item of items) {
    if (!actual || actual.label !== item.seccion_label) {
      actual = { label: item.seccion_label, items: [] }
      grupos.push(actual)
    }
    actual.items.push(item)
  }
  return grupos
}

// ── Componente de página ──────────────────────────────────────────────────────

export function PerimetralPagina({
  rancho, ranchoCodigo, mesLabel, mesDate, realizadoPor,
  tieneAlmacen, items, diasInspeccionados, matriz,
  observaciones, otro,
}: PerimetralPaginaProps) {
  const secciones = agruparItemsPorSeccion(items)
  const todosLosDias = diasDelMes(mesDate)
  const dW = dayColW(todosLosDias.length)
  const inspeccionadosSet = new Set(diasInspeccionados)

  return (
    <Page size="A4" orientation="landscape" style={s.page}>

      {/* ── Header ─────────────────────────────────────────────────────── */}
      <View style={s.header}>
        <View>
          <MadyLogoPDF style={s.headerLogo} />
          <Text style={s.headerLogoSub}>Inocuidad Alimentaria</Text>
        </View>
        <View style={{ flex: 1, alignItems: 'center' }}>
          <Text style={s.headerTitle}>MONITOREO PERIMETRAL DE PLAGAS</Text>
          <Text style={{ fontSize: 6, color: MUTED, marginTop: 2 }}>
            Clave: MXA-F-SC-SIG-M9  |  Frecuencia: Semanal  |  Mes: {mesLabel}
          </Text>
        </View>
        <View style={s.headerMeta}>
          <Text>Almacen: {tieneAlmacen ? 'Si' : 'No'}</Text>
        </View>
      </View>

      {/* ── Info chips ─────────────────────────────────────────────────── */}
      <View style={s.infoRow}>
        <View style={s.infoBox}>
          <Text style={s.infoLabel}>Rancho / Huerto</Text>
          <Text style={s.infoValue}>{rancho}</Text>
        </View>
        <View style={s.infoBox}>
          <Text style={s.infoLabel}>Codigo</Text>
          <Text style={s.infoValue}>{ranchoCodigo}</Text>
        </View>
        <View style={s.infoBox}>
          <Text style={s.infoLabel}>Mes de Inspeccion</Text>
          <Text style={s.infoValue}>{mesLabel}</Text>
        </View>
        <View style={s.infoBox}>
          <Text style={s.infoLabel}>Responsable de Inocuidad</Text>
          <Text style={s.infoValue}> </Text>
        </View>
        <View style={s.infoBox}>
          <Text style={s.infoLabel}>Dias inspeccionados</Text>
          <Text style={s.infoValue}>{diasInspeccionados.length}</Text>
        </View>
      </View>

      {/* ── Tabla matriz — todos los días del mes ──────────────────────── */}

      {/* Fila header: columna de ítems + una columna por día del mes */}
      <View style={{ flexDirection: 'row', marginBottom: 0 }}>
        <View style={s.itemColHeader}>
          <Text style={s.itemColHeaderText}>Sub-item de inspeccion</Text>
        </View>
        {todosLosDias.map((fecha) => (
          <View key={fecha} style={[s.dayHeader, { width: dW }]}>
            <Text style={s.dayHeaderText}>{formatDayNum(fecha)}</Text>
          </View>
        ))}
      </View>

      {/* Secciones + ítems */}
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
                    // Día no inspeccionado — celda vacía
                    return (
                      <View key={fecha} style={[s.valueCell, { width: dW, backgroundColor: bg }]} />
                    )
                  }
                  const val = matriz[fecha]?.[item.id] ?? 'No'
                  const color = val === 'Si' ? SI_COLOR : NO_COLOR
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

      {/* ── Footer ─────────────────────────────────────────────────────── */}
      <View style={s.footerSep}>
        <View style={s.footerRow}>
          {observaciones ? (
            <View style={{ flex: 1 }}>
              <Text style={s.footerLabel}>Observaciones:</Text>
              <Text style={s.footerValue}>{observaciones}</Text>
            </View>
          ) : null}
          {otro ? (
            <View style={{ flex: 1 }}>
              <Text style={s.footerLabel}>Otro:</Text>
              <Text style={s.footerValue}>{otro}</Text>
            </View>
          ) : null}
          {!observaciones && !otro && (
            <Text style={{ fontSize: 7, color: MUTED }}>Sin observaciones adicionales.</Text>
          )}
        </View>

        {/* Firma: quien realizó + espacio para firma manual del Responsable */}
        <View style={s.firmaRow}>
          {realizadoPor ? (
            <View style={[s.firmaBloque, { flex: 1 }]}>
              <Text style={s.firmaLabel}>Realizo: {realizadoPor}</Text>
            </View>
          ) : null}
          <View style={[s.firmaBloque, { flex: 2 }]}>
            {/* Espacio para firma manual */}
            <View style={{ height: 16 }} />
            <Text style={s.firmaLabel}>Responsable de Inocuidad</Text>
          </View>
        </View>
      </View>

      {/* Pie */}
      <Text style={s.piePagina} fixed>M.A.D.Y · Inocuidad Inteligente</Text>
    </Page>
  )
}

// ── PDF individual (un mes) ───────────────────────────────────────────────────

export function PerimetralPDF(props: PerimetralPaginaProps) {
  return (
    <Document>
      <PerimetralPagina {...props} />
    </Document>
  )
}

// ── PDF consolidado (varios meses) ───────────────────────────────────────────

export function PerimetralConsolidadoPDF({
  paginas,
  ranchoNombre,
  desde,
  hasta,
}: PerimetralConsolidadoPDFProps) {
  return (
    <Document
      title={`Monitoreo Perimetral Consolidado — ${ranchoNombre} ${desde}–${hasta}`}
    >
      {paginas.map((p, i) => (
        <PerimetralPagina key={i} {...p} />
      ))}
    </Document>
  )
}
