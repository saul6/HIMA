import { Document, Page, View, Text, StyleSheet, Image } from '@react-pdf/renderer'
import { MadyLogoPDF } from '@/lib/pdf/MadyLogoPDF'

export interface AccionPDFFila {
  codigo_pregunta: string
  modulo_label: string
  no_conformidad: string | null
  causa: string | null
  accion_correctiva: string | null
  accion_preventiva: string | null
  fecha_deteccion: string | null
  fecha_cumplimiento: string | null
  realizo: string | null
  verifico: string | null
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

const PRIMARY = '#2B7AB5'
const DARK = '#1A1A1A'
const BORDER = '#CCCCCC'
const WHITE = '#FFFFFF'
const MUTED = '#717182'
const ROW_ALT = '#F5F9FE'
const WARN_FILL = '#FAEEDA'
const WARN_TEXT = '#854F0B'
const SUCCESS_FILL = '#E3F2FD'

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
  tableHeadCell: { flex: 1, padding: 5, fontSize: 7, fontFamily: 'Helvetica-Bold', color: WHITE, textAlign: 'center' },
  tableHeadCellWide: { flex: 2, padding: 5, fontSize: 7, fontFamily: 'Helvetica-Bold', color: WHITE },
  tableRow: { flexDirection: 'row', borderTopWidth: 1, borderTopColor: BORDER },
  tableRowAlt: { flexDirection: 'row', borderTopWidth: 1, borderTopColor: BORDER, backgroundColor: ROW_ALT },
  tableCell: { flex: 1, padding: 5, fontSize: 8 },
  tableCellWide: { flex: 2, padding: 5, fontSize: 8 },
  tableCellCenter: { flex: 1, padding: 5, fontSize: 8, textAlign: 'center' },
  chip: {
    borderRadius: 4,
    paddingHorizontal: 6,
    paddingVertical: 2,
    fontSize: 7,
    fontFamily: 'Helvetica-Bold',
    alignSelf: 'flex-start',
  },
  evidenciaSection: { marginBottom: 14 },
  evidenciaTitle: { fontSize: 9, fontFamily: 'Helvetica-Bold', color: DARK, marginBottom: 6, borderBottomWidth: 1, borderBottomColor: BORDER, paddingBottom: 4 },
  evidenciaGrid: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
  evidenciaItem: { width: '48%', marginBottom: 8 },
  evidenciaImg: { width: '100%', height: 140, objectFit: 'cover', borderRadius: 3, borderWidth: 1, borderColor: BORDER },
  evidenciaLeyenda: { fontSize: 7, color: MUTED, marginTop: 3, textAlign: 'center' },
  evidenciaTipo: { fontSize: 7, fontFamily: 'Helvetica-Bold', marginTop: 2, textAlign: 'center' },
  footerFixed: { position: 'absolute', bottom: 20, left: 40, right: 40, flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', borderTopWidth: 1, borderTopColor: BORDER, paddingTop: 4 },
  footerText: { fontSize: 7, color: MUTED },
  pageNum: { fontSize: 7, color: MUTED },
  nota: {
    padding: 8,
    borderRadius: 3,
    marginBottom: 14,
    borderWidth: 1,
    borderColor: '#F5A623',
    backgroundColor: WARN_FILL,
  },
  notaText: { fontSize: 7.5, color: WARN_TEXT, lineHeight: 1.4 },
})

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

function AccionesTabla({ acciones }: { acciones: AccionPDFFila[] }) {
  return (
    <View style={s.table}>
      <View style={s.tableHead}>
        <View style={{ ...s.tableHeadCell, flex: 0.8 }}><Text>Fecha deteccion</Text></View>
        <View style={{ ...s.tableHeadCellWide, flex: 1.6 }}><Text>No conformidad</Text></View>
        <View style={{ ...s.tableHeadCellWide, flex: 1.6 }}><Text>Causa</Text></View>
        <View style={{ ...s.tableHeadCellWide, flex: 1.6 }}><Text>Accion correctiva</Text></View>
        <View style={{ ...s.tableHeadCellWide, flex: 1.6 }}><Text>Accion preventiva</Text></View>
        <View style={{ ...s.tableHeadCell, flex: 0.8 }}><Text>Fecha cumplimiento</Text></View>
        <View style={{ ...s.tableHeadCell, flex: 1 }}><Text>Realizo</Text></View>
        <View style={{ ...s.tableHeadCell, flex: 1 }}><Text>Verifico</Text></View>
      </View>
      {acciones.map((a, i) => {
        const RowStyle = i % 2 === 1 ? s.tableRowAlt : s.tableRow
        const cod = `${a.modulo_label} | ${a.codigo_pregunta}`
        return (
          <View key={i} style={RowStyle} wrap={false}>
            <View style={{ ...s.tableCell, flex: 0.8 }}><Text>{fmtFecha(a.fecha_deteccion)}</Text></View>
            <View style={{ ...s.tableCellWide, flex: 1.6 }}>
              <Text style={{ fontSize: 7, color: MUTED, marginBottom: 2 }}>{cod}</Text>
              <Text>{fmt(a.no_conformidad)}</Text>
            </View>
            <View style={{ ...s.tableCellWide, flex: 1.6 }}><Text>{fmt(a.causa)}</Text></View>
            <View style={{ ...s.tableCellWide, flex: 1.6 }}><Text>{fmt(a.accion_correctiva)}</Text></View>
            <View style={{ ...s.tableCellWide, flex: 1.6 }}><Text>{fmt(a.accion_preventiva)}</Text></View>
            <View style={{ ...s.tableCell, flex: 0.8 }}><Text>{fmtFecha(a.fecha_cumplimiento)}</Text></View>
            <View style={{ ...s.tableCell, flex: 1 }}><Text>{fmt(a.realizo)}</Text></View>
            <View style={{ ...s.tableCell, flex: 1 }}><Text>{fmt(a.verifico)}</Text></View>
          </View>
        )
      })}
    </View>
  )
}

function EvidenciaSection({ acciones }: { acciones: AccionPDFFila[] }) {
  const conFotos = acciones.filter((a) => a.fotos.length > 0)
  if (conFotos.length === 0) return null
  return (
    <View>
      <Text style={{ ...s.sectionTitle, marginTop: 8 }}>EVIDENCIA FOTOGRAFICA</Text>
      {conFotos.map((a, ai) => (
        <View key={ai} style={s.evidenciaSection} wrap={false}>
          <Text style={s.evidenciaTitle}>{a.codigo_pregunta} — {a.modulo_label}</Text>
          <View style={s.evidenciaGrid}>
            {a.fotos.map((f, fi) => (
              <View key={fi} style={s.evidenciaItem}>
                <Image src={f.dataUri} style={s.evidenciaImg} />
                <Text style={s.evidenciaTipo}>
                  {f.tipo === 'no_conformidad' ? 'No conformidad observada' : 'Evidencia de accion correctiva'}
                </Text>
                {f.leyenda ? <Text style={s.evidenciaLeyenda}>{f.leyenda}</Text> : null}
              </View>
            ))}
          </View>
        </View>
      ))}
    </View>
  )
}

export function AccionesCorrectivasPDF({
  orgNombre,
  ranchoNombre,
  fechaTitulo,
  acciones,
}: AccionesCorrectivasPDFProps) {
  return (
    <Document>
      <Page size="A4" orientation="landscape" style={s.page}>
        {/* Header */}
        <View style={s.header} fixed>
          <MadyLogoPDF width={56} />
          <View style={s.headerInfo}>
            <Text style={s.headerTitle}>Formato de Acciones Correctivas</Text>
            <Text style={s.headerSub}>M.A.D.Y — DuoMind Solutions</Text>
          </View>
        </View>

        {/* Info */}
        <InfoGrid orgNombre={orgNombre} ranchoNombre={ranchoNombre} fechaTitulo={fechaTitulo} />

        {/* Nota de plazo */}
        <View style={s.nota}>
          <Text style={s.notaText}>
            Las no-conformidades deben atenderse en un maximo de 30 dias naturales a partir de la fecha de deteccion. Conserve evidencia documental del cierre de cada accion correctiva.
          </Text>
        </View>

        {/* Tabla */}
        <Text style={s.sectionTitle}>ACCIONES CORRECTIVAS ({acciones.length})</Text>
        {acciones.length === 0 ? (
          <Text style={{ fontSize: 9, color: MUTED }}>Sin no-conformidades registradas.</Text>
        ) : (
          <AccionesTabla acciones={acciones} />
        )}

        {/* Evidencia */}
        <EvidenciaSection acciones={acciones} />

        {/* Footer */}
        <View style={s.footerFixed} fixed>
          <Text style={s.footerText}>M.A.D.Y — DuoMind Solutions | Formato de Acciones Correctivas</Text>
          <Text style={s.pageNum} render={({ pageNumber, totalPages }) => `${pageNumber} / ${totalPages}`} />
        </View>
      </Page>
    </Document>
  )
}
