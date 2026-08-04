import { Document, Page, View, Text, StyleSheet, Image, Svg, Line, Rect, Path, G } from '@react-pdf/renderer'
import { MadyLogoPDF } from '@/lib/pdf/MadyLogoPDF'

export interface AccionPDFFila {
  codigo_pregunta: string
  modulo_label: string  // solo uso interno (filtros UI); nunca se imprime
  no_conformidad: string | null
  causa: string | null
  accion_correctiva: string | null
  accion_preventiva: string | null
  fecha_deteccion: string | null
  fecha_cumplimiento: string | null
  realizo: string | null
  verifico: string | null
  ishikawa: Record<string, string> | null
  fotos: Array<{
    tipo: 'no_conformidad' | 'evidencia_correccion'
    leyenda: string | null
    dataUri: string
  }>
}

export interface AccionesCorrectivasPDFProps {
  orgNombre: string
  ranchoNombre: string
  fechaTitulo: string
  acciones: AccionPDFFila[]
}

// ── Paleta (hex obligatorio en @react-pdf/renderer) ───────────────────────────
const PRIMARY   = '#2B7AB5'
const DARK      = '#1A1A1A'
const BORDER    = '#CCCCCC'
const WHITE     = '#FFFFFF'
const MUTED     = '#717182'
const ROW_ALT   = '#F5F9FE'
const WARN_FILL   = '#FAEEDA'
const WARN_TEXT   = '#854F0B'
const WARN_BORDER = '#F5A623'
const INFO_FILL   = '#E3F2FD'
const INFO_TEXT   = '#0D5A8F'

// ── Helpers ───────────────────────────────────────────────────────────────────

function fmt(s: string | null | undefined): string {
  return s?.trim() || '—'
}

function fmtFecha(iso: string | null | undefined): string {
  if (!iso) return '—'
  try {
    const [y, m, d] = iso.split('-')
    return `${d}/${m}/${y}`
  } catch { return iso }
}

// Divide texto en lineas para SVG (no wrapping nativo)
function svgLineas(text: string, maxChars: number, maxLines: number): string[] {
  if (!text?.trim()) return []
  const words = text.split(/\s+/)
  const lines: string[] = []
  let cur = ''
  for (const word of words) {
    if (lines.length >= maxLines) break
    const next = cur ? `${cur} ${word}` : word
    if (next.length <= maxChars) { cur = next }
    else { if (cur) { lines.push(cur) } cur = word.slice(0, maxChars) }
  }
  if (cur && lines.length < maxLines) lines.push(cur)
  return lines
}

// ── Estilos ───────────────────────────────────────────────────────────────────

const s = StyleSheet.create({
  page: {
    fontFamily: 'Helvetica',
    fontSize: 8,
    color: DARK,
    paddingTop: 45,
    paddingBottom: 40,
    paddingLeft: 40,
    paddingRight: 40,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 10,
    borderBottomWidth: 2,
    borderBottomColor: PRIMARY,
    paddingBottom: 8,
  },
  headerInfo: { flex: 1, paddingLeft: 10 },
  headerTitle: { fontSize: 11, fontFamily: 'Helvetica-Bold', color: PRIMARY },
  headerSub: { fontSize: 8, color: MUTED, marginTop: 2 },
  infoGrid: {
    flexDirection: 'row',
    marginBottom: 12,
    borderWidth: 1,
    borderColor: BORDER,
    borderRadius: 3,
  },
  infoCell: { flex: 1, padding: 6, borderRightWidth: 1, borderRightColor: BORDER },
  infoCellLast: { flex: 1, padding: 6 },
  infoLabel: { fontSize: 7, color: MUTED, fontFamily: 'Helvetica-Bold', textTransform: 'uppercase', marginBottom: 2 },
  infoVal: { fontSize: 9, color: DARK, fontFamily: 'Helvetica-Bold' },
  sectionTitle: { fontSize: 9, fontFamily: 'Helvetica-Bold', color: PRIMARY, marginBottom: 6, textTransform: 'uppercase' },
  table: { borderWidth: 1, borderColor: BORDER, borderRadius: 2, marginBottom: 14 },
  tableHead: { flexDirection: 'row', backgroundColor: PRIMARY },
  thCell: { flex: 1, padding: 5, fontSize: 7, fontFamily: 'Helvetica-Bold', color: WHITE, textAlign: 'center' },
  thCellWide: { flex: 2, padding: 5, fontSize: 7, fontFamily: 'Helvetica-Bold', color: WHITE },
  tableRow: { flexDirection: 'row', borderTopWidth: 1, borderTopColor: BORDER },
  tableRowAlt: { flexDirection: 'row', borderTopWidth: 1, borderTopColor: BORDER, backgroundColor: ROW_ALT },
  tdCell: { flex: 1, padding: 5, fontSize: 8 },
  tdCellWide: { flex: 2, padding: 5, fontSize: 8 },
  nota: {
    padding: 8,
    borderRadius: 3,
    marginBottom: 14,
    borderWidth: 1,
    borderColor: WARN_BORDER,
    backgroundColor: WARN_FILL,
  },
  notaText: { fontSize: 7.5, color: WARN_TEXT, lineHeight: 1.4 },
  footerFixed: {
    position: 'absolute',
    bottom: 20, left: 40, right: 40,
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    borderTopWidth: 1,
    borderTopColor: BORDER,
    paddingTop: 4,
  },
  footerText: { fontSize: 7, color: MUTED },
  pageNum: { fontSize: 7, color: MUTED },
  // Ficha NC
  ficha: {
    marginBottom: 14,
    borderWidth: 1,
    borderColor: BORDER,
    borderRadius: 3,
  },
  fichaHdrAmbar: {
    backgroundColor: WARN_FILL,
    borderBottomWidth: 1,
    borderBottomColor: WARN_BORDER,
    paddingHorizontal: 8,
    paddingVertical: 5,
  },
  fichaHdrBlue: {
    backgroundColor: INFO_FILL,
    borderBottomWidth: 1,
    borderBottomColor: PRIMARY,
    paddingHorizontal: 8,
    paddingVertical: 5,
  },
  fichaHdrAmbarText: { fontSize: 8, fontFamily: 'Helvetica-Bold', color: WARN_TEXT },
  fichaHdrBlueText: { fontSize: 8, fontFamily: 'Helvetica-Bold', color: INFO_TEXT },
  fichaBody: { padding: 8 },
  fichaCode: { fontSize: 7, fontFamily: 'Helvetica-Bold', color: PRIMARY, marginBottom: 3 },
  fichaBodyText: { fontSize: 8, color: DARK, lineHeight: 1.4 },
  fichaSinEv: { fontSize: 7.5, color: MUTED },
  fichaFotosGrid: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
  fichaFotoItem: { width: '48%', marginBottom: 8 },
  fichaFotoImg: { width: '100%', height: 130, objectFit: 'cover', borderRadius: 3, borderWidth: 1, borderColor: BORDER },
  fichaFotoTipo: { fontSize: 7, fontFamily: 'Helvetica-Bold', marginTop: 3, textAlign: 'center', color: MUTED },
  fichaFotoLeyenda: { fontSize: 7, color: DARK, marginTop: 2, textAlign: 'center' },
  // Ishikawa view-based
  ishWrapper: { marginBottom: 14 },
  ishTitle: { fontSize: 8, fontFamily: 'Helvetica-Bold', color: DARK, textTransform: 'uppercase', marginBottom: 6, borderBottomWidth: 1, borderBottomColor: BORDER, paddingBottom: 3 },
  ishUpperRow: { flexDirection: 'row', marginBottom: 0 },
  ishLowerRow: { flexDirection: 'row', marginTop: 0 },
  ishBranchCol: { flex: 1, alignItems: 'center', paddingHorizontal: 3 },
  ishEfectoCol: { flex: 1, justifyContent: 'center', paddingLeft: 8 },
  ishLabelAmbar: {
    backgroundColor: WARN_FILL,
    borderWidth: 1,
    borderColor: WARN_BORDER,
    borderRadius: 2,
    paddingHorizontal: 4,
    paddingVertical: 3,
    alignSelf: 'stretch',
    marginBottom: 2,
  },
  ishLabelAmbarText: { fontSize: 6.5, fontFamily: 'Helvetica-Bold', color: WARN_TEXT, textAlign: 'center' },
  ishLabelBlue: {
    backgroundColor: INFO_FILL,
    borderWidth: 1,
    borderColor: PRIMARY,
    borderRadius: 2,
    paddingHorizontal: 4,
    paddingVertical: 3,
    alignSelf: 'stretch',
    marginTop: 2,
  },
  ishLabelBlueText: { fontSize: 6.5, fontFamily: 'Helvetica-Bold', color: INFO_TEXT, textAlign: 'center' },
  ishBranchText: { fontSize: 7, color: DARK, textAlign: 'center', marginVertical: 2, lineHeight: 1.3 },
  ishConnector: { width: 1, backgroundColor: MUTED, flex: 1, alignSelf: 'center' },
  ishSpineRow: { flexDirection: 'row', alignItems: 'center', height: 16 },
  ishSpine: { flex: 3, borderTopWidth: 2, borderTopColor: DARK },
  ishArrow: { width: 0, height: 0 },
  ishEfectoBox: {
    flex: 1,
    borderWidth: 1.5,
    borderColor: PRIMARY,
    backgroundColor: INFO_FILL,
    borderRadius: 3,
    padding: 6,
    marginLeft: 4,
  },
  ishEfectoLabel: { fontSize: 6.5, fontFamily: 'Helvetica-Bold', color: INFO_TEXT, textTransform: 'uppercase', marginBottom: 2 },
  ishEfectoText: { fontSize: 7, color: DARK, lineHeight: 1.3 },
})

// ── Componentes internos ──────────────────────────────────────────────────────

function InfoGrid({ orgNombre, ranchoNombre, fechaTitulo }: { orgNombre: string; ranchoNombre: string; fechaTitulo: string }) {
  return (
    <View style={s.infoGrid}>
      <View style={s.infoCell}>
        <Text style={s.infoLabel}>Organizacion</Text>
        <Text style={s.infoVal}>{fmt(orgNombre)}</Text>
      </View>
      <View style={s.infoCell}>
        <Text style={s.infoLabel}>Instalacion / Operacion</Text>
        <Text style={s.infoVal}>{fmt(ranchoNombre)}</Text>
      </View>
      <View style={s.infoCellLast}>
        <Text style={s.infoLabel}>Fecha</Text>
        <Text style={s.infoVal}>{fechaTitulo}</Text>
      </View>
    </View>
  )
}

// Tabla resumen — Change 1: muestra solo codigo_pregunta, no modulo_label
function AccionesTabla({ acciones }: { acciones: AccionPDFFila[] }) {
  return (
    <View style={s.table}>
      <View style={s.tableHead}>
        <View style={{ ...s.thCell, flex: 0.8 }}><Text>Fecha deteccion</Text></View>
        <View style={{ ...s.thCellWide, flex: 1.8 }}><Text>No conformidad</Text></View>
        <View style={{ ...s.thCellWide, flex: 1.6 }}><Text>Causa</Text></View>
        <View style={{ ...s.thCellWide, flex: 1.6 }}><Text>Accion correctiva</Text></View>
        <View style={{ ...s.thCellWide, flex: 1.6 }}><Text>Accion preventiva</Text></View>
        <View style={{ ...s.thCell, flex: 0.8 }}><Text>Fecha cumplimiento</Text></View>
        <View style={{ ...s.thCell, flex: 1 }}><Text>Realizo</Text></View>
        <View style={{ ...s.thCell, flex: 1 }}><Text>Verifico</Text></View>
      </View>
      {acciones.map((a, i) => {
        const RowStyle = i % 2 === 1 ? s.tableRowAlt : s.tableRow
        return (
          <View key={i} style={RowStyle} wrap={false}>
            <View style={{ ...s.tdCell, flex: 0.8 }}><Text>{fmtFecha(a.fecha_deteccion)}</Text></View>
            <View style={{ ...s.tdCellWide, flex: 1.8 }}>
              <Text style={{ fontSize: 7, color: PRIMARY, marginBottom: 2 }}>{a.codigo_pregunta}</Text>
              <Text>{fmt(a.no_conformidad)}</Text>
            </View>
            <View style={{ ...s.tdCellWide, flex: 1.6 }}><Text>{fmt(a.causa)}</Text></View>
            <View style={{ ...s.tdCellWide, flex: 1.6 }}><Text>{fmt(a.accion_correctiva)}</Text></View>
            <View style={{ ...s.tdCellWide, flex: 1.6 }}><Text>{fmt(a.accion_preventiva)}</Text></View>
            <View style={{ ...s.tdCell, flex: 0.8 }}><Text>{fmtFecha(a.fecha_cumplimiento)}</Text></View>
            <View style={{ ...s.tdCell, flex: 1 }}><Text>{fmt(a.realizo)}</Text></View>
            <View style={{ ...s.tdCell, flex: 1 }}><Text>{fmt(a.verifico)}</Text></View>
          </View>
        )
      })}
    </View>
  )
}

// Change 2: Ficha por no-conformidad con tres bloques
function FichaNC({ accion }: { accion: AccionPDFFila }) {
  return (
    <View style={s.ficha} wrap={false}>
      {/* Bloque 1: No conformidad observada (amber) */}
      <View style={s.fichaHdrAmbar}>
        <Text style={s.fichaHdrAmbarText}>No conformidad observada.</Text>
      </View>
      <View style={s.fichaBody}>
        <Text style={s.fichaCode}>{accion.codigo_pregunta}</Text>
        <Text style={s.fichaBodyText}>{fmt(accion.no_conformidad)}</Text>
      </View>

      {/* Bloque 2: Accion correctiva (blue) */}
      <View style={s.fichaHdrBlue}>
        <Text style={s.fichaHdrBlueText}>Accion correctiva.</Text>
      </View>
      <View style={s.fichaBody}>
        <Text style={s.fichaBodyText}>{fmt(accion.accion_correctiva)}</Text>
      </View>

      {/* Bloque 3: Evidencia (blue) */}
      <View style={s.fichaHdrBlue}>
        <Text style={s.fichaHdrBlueText}>Evidencia.</Text>
      </View>
      <View style={s.fichaBody}>
        {accion.fotos.length === 0 ? (
          <Text style={s.fichaSinEv}>Sin evidencia fotografica.</Text>
        ) : (
          <View style={s.fichaFotosGrid}>
            {accion.fotos.map((f, fi) => (
              <View key={fi} style={s.fichaFotoItem}>
                <Image src={f.dataUri} style={s.fichaFotoImg} />
                <Text style={s.fichaFotoTipo}>
                  {f.tipo === 'no_conformidad' ? 'No conformidad' : 'Evidencia de correccion'}
                </Text>
                {f.leyenda ? <Text style={s.fichaFotoLeyenda}>{f.leyenda}</Text> : null}
              </View>
            ))}
          </View>
        )}
      </View>
    </View>
  )
}

// Change 3: Diagrama de Ishikawa (SVG espina de pescado)
const ISH_W = 710
const ISH_H = 200
const ISH_MY = 100  // y del eje principal
const ISH_BX = [130, 280, 430]  // x donde cada rama toca el eje
const ISH_TIP_DY = 55  // desplazamiento vertical al extremo de cada rama

const ISH_ABOVE = [
  { key: 'medio_ambiente', label: 'MEDIO AMBIENTE' },
  { key: 'metodo', label: 'METODO' },
  { key: 'mano_de_obra', label: 'MANO DE OBRA' },
]
const ISH_BELOW = [
  { key: 'materiales', label: 'MATERIALES' },
  { key: 'herramientas', label: 'HERRAMIENTAS' },
  { key: 'medicion', label: 'MEDICION' },
]

function IshikawaDiagram({ nc, ishikawa }: { nc: string; ishikawa: Record<string, string> }) {
  const ncLines = svgLineas(nc, 22, 4)

  return (
    <View style={s.ishWrapper}>
      <Text style={s.ishTitle}>Analisis de causa — Diagrama de Ishikawa</Text>
      <Svg viewBox={`0 0 ${ISH_W} ${ISH_H}`} style={{ width: ISH_W, height: ISH_H }}>
        {/* Eje principal (espina) */}
        <Line x1="20" y1={ISH_MY} x2="540" y2={ISH_MY} stroke={DARK} strokeWidth="2" />
        {/* Punta de flecha */}
        <Path d={`M530 ${ISH_MY - 6} L548 ${ISH_MY} L530 ${ISH_MY + 6} Z`} fill={DARK} />

        {/* Caja EFECTO */}
        <Rect x="552" y={ISH_MY - 50} width="150" height="100" fill={INFO_FILL} stroke={PRIMARY} strokeWidth="1.5" rx="4" />
        <Text x="627" y={ISH_MY - 32} textAnchor="middle" fontFamily="Helvetica-Bold" fontSize="8" fill={INFO_TEXT}>EFECTO</Text>
        {ncLines.map((line, i) => (
          <Text key={i} x="627" y={ISH_MY - 15 + i * 12} textAnchor="middle" fontFamily="Helvetica" fontSize="7" fill={DARK}>{line}</Text>
        ))}

        {/* Titulo CAUSAS */}
        <Text x="22" y={ISH_MY - 8} fontFamily="Helvetica-Bold" fontSize="8" fill={MUTED}>CAUSAS</Text>

        {/* Ramas superiores */}
        {ISH_BX.map((bx, i) => {
          const tx = bx - 38
          const ty = ISH_MY - ISH_TIP_DY
          const contentLines = svgLineas(ishikawa[ISH_ABOVE[i].key] ?? '', 16, 2)
          return (
            <G key={`u${i}`}>
              <Line x1={bx} y1={ISH_MY} x2={tx} y2={ty + 18} stroke={PRIMARY} strokeWidth="1.5" />
              <Rect x={tx - 40} y={ty - 14} width="82" height="16" fill={WARN_FILL} stroke={WARN_BORDER} strokeWidth="0.8" rx="2" />
              <Text x={tx + 1} y={ty - 4} textAnchor="middle" fontFamily="Helvetica-Bold" fontSize="6" fill={WARN_TEXT}>{ISH_ABOVE[i].label}</Text>
              {contentLines.map((line, li) => (
                <Text key={li} x={tx - 40} y={ty + 6 + li * 9} fontFamily="Helvetica" fontSize="6" fill={DARK}>{line}</Text>
              ))}
            </G>
          )
        })}

        {/* Ramas inferiores */}
        {ISH_BX.map((bx, i) => {
          const tx = bx - 38
          const ty = ISH_MY + ISH_TIP_DY
          const contentLines = svgLineas(ishikawa[ISH_BELOW[i].key] ?? '', 16, 2)
          return (
            <G key={`l${i}`}>
              <Line x1={bx} y1={ISH_MY} x2={tx} y2={ty - 18} stroke={PRIMARY} strokeWidth="1.5" />
              {contentLines.map((line, li) => (
                <Text key={li} x={tx - 40} y={ty - 26 + li * 9} fontFamily="Helvetica" fontSize="6" fill={DARK}>{line}</Text>
              ))}
              <Rect x={tx - 40} y={ty - 2} width="82" height="16" fill={INFO_FILL} stroke={PRIMARY} strokeWidth="0.8" rx="2" />
              <Text x={tx + 1} y={ty + 9} textAnchor="middle" fontFamily="Helvetica-Bold" fontSize="6" fill={INFO_TEXT}>{ISH_BELOW[i].label}</Text>
            </G>
          )
        })}
      </Svg>
    </View>
  )
}

// ── Componente raíz ───────────────────────────────────────────────────────────

export function AccionesCorrectivasPDF({
  orgNombre,
  ranchoNombre,
  fechaTitulo,
  acciones,
}: AccionesCorrectivasPDFProps) {
  const headerFixed = (
    <View style={s.header} fixed>
      <MadyLogoPDF width={56} />
      <View style={s.headerInfo}>
        <Text style={s.headerTitle}>Formato de Acciones Correctivas</Text>
        <Text style={s.headerSub}>M.A.D.Y — DuoMind Solutions</Text>
      </View>
    </View>
  )

  const footerFixed = (
    <View style={s.footerFixed} fixed>
      <Text style={s.footerText}>M.A.D.Y — DuoMind Solutions | Formato de Acciones Correctivas</Text>
      <Text style={s.pageNum} render={({ pageNumber, totalPages }) => `${pageNumber} / ${totalPages}`} />
    </View>
  )

  return (
    <Document>
      <Page size="A4" orientation="landscape" style={s.page}>
        {headerFixed}

        <InfoGrid orgNombre={orgNombre} ranchoNombre={ranchoNombre} fechaTitulo={fechaTitulo} />

        <View style={s.nota}>
          <Text style={s.notaText}>
            Las no-conformidades deben atenderse en un maximo de 30 dias naturales a partir de la fecha de deteccion.
            Conserve evidencia documental del cierre de cada accion correctiva.
          </Text>
        </View>

        {/* Tabla resumen */}
        <Text style={s.sectionTitle}>ACCIONES CORRECTIVAS ({acciones.length})</Text>
        {acciones.length === 0 ? (
          <Text style={{ fontSize: 9, color: MUTED }}>Sin no-conformidades registradas.</Text>
        ) : (
          <AccionesTabla acciones={acciones} />
        )}

        {/* Fichas + Ishikawa por no-conformidad */}
        {acciones.map((a, i) => {
          const hasIsh = a.ishikawa && Object.values(a.ishikawa).some((v) => v?.trim())
          return (
            <View key={i} break={i === 0}>
              <FichaNC accion={a} />
              {hasIsh && (
                <IshikawaDiagram
                  nc={`${a.codigo_pregunta} — ${a.no_conformidad ?? ''}`}
                  ishikawa={a.ishikawa!}
                />
              )}
            </View>
          )
        })}

        {footerFixed}
      </Page>
    </Document>
  )
}
