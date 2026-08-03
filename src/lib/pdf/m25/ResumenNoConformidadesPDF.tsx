import { Document, Page, View, Text, StyleSheet } from '@react-pdf/renderer'
import { MadyLogoPDF } from '@/lib/pdf/MadyLogoPDF'

export interface NcrFila {
  ncr: number
  modulo: string
  codigo_pregunta: string
  seccion: string
  texto_pregunta: string
  comentario: string
}

export interface ResumenNoConformidadesPDFProps {
  orgNombre: string
  ranchoNombre: string
  fecha: string
  auditorNombre: string
  clienteNombre: string
  paPgfs: string | null
  ncrs: NcrFila[]
  notaPlazo?: string
}

const PRIMARY = '#2B7AB5'
const DARK = '#1A1A1A'
const BORDER = '#CCCCCC'
const WHITE = '#FFFFFF'
const MUTED = '#555555'
const ROW_ALT = '#F5F9FE'
const DANGER_FILL = '#FAECE7'
const DANGER_TEXT = '#993C1D'
const WARN_FILL = '#FFFDE7'

const NOTE_DEFAULT =
  'Las no-conformidades deben atenderse en un maximo de 30 dias naturales a partir de la fecha de auditoria.'

const s = StyleSheet.create({
  page: {
    fontFamily: 'Helvetica',
    fontSize: 9,
    color: DARK,
    paddingTop: 50,
    paddingBottom: 50,
    paddingLeft: 50,
    paddingRight: 50,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 12,
    borderBottomWidth: 2,
    borderBottomColor: PRIMARY,
    borderBottomStyle: 'solid',
    paddingBottom: 8,
  },
  headerTitle: {
    flex: 1,
    textAlign: 'center',
    fontSize: 10,
    fontFamily: 'Helvetica-Bold',
    color: DARK,
  },
  headerTitleSub: { textAlign: 'center', fontSize: 7, color: MUTED, marginTop: 2 },
  headerMeta: { width: 80, fontSize: 7, textAlign: 'right', color: MUTED },
  sectionTitle: {
    backgroundColor: PRIMARY,
    color: WHITE,
    fontFamily: 'Helvetica-Bold',
    fontSize: 8,
    paddingTop: 4,
    paddingBottom: 4,
    paddingLeft: 8,
    paddingRight: 8,
    marginTop: 10,
    marginBottom: 0,
  },
  infoTable: {
    borderLeftWidth: 1,
    borderLeftColor: BORDER,
    borderLeftStyle: 'solid',
    borderTopWidth: 1,
    borderTopColor: BORDER,
    borderTopStyle: 'solid',
    marginBottom: 0,
  },
  infoRow: { flexDirection: 'row' },
  infoCell: {
    flex: 1,
    borderRightWidth: 1,
    borderRightColor: BORDER,
    borderRightStyle: 'solid',
    borderBottomWidth: 1,
    borderBottomColor: BORDER,
    borderBottomStyle: 'solid',
    paddingTop: 5,
    paddingBottom: 5,
    paddingLeft: 8,
    paddingRight: 8,
  },
  infoCellLabel: {
    fontSize: 6,
    color: MUTED,
    marginBottom: 2,
    fontFamily: 'Helvetica-Bold',
    textTransform: 'uppercase',
  },
  infoCellValue: { fontSize: 9, color: DARK },
  table: {
    borderLeftWidth: 1,
    borderLeftColor: BORDER,
    borderLeftStyle: 'solid',
    borderTopWidth: 1,
    borderTopColor: BORDER,
    borderTopStyle: 'solid',
  },
  tableHeaderRow: { flexDirection: 'row', backgroundColor: PRIMARY },
  tableRow: { flexDirection: 'row' },
  tableRowAlt: { flexDirection: 'row', backgroundColor: ROW_ALT },
  tableHeaderCell: {
    color: WHITE,
    fontFamily: 'Helvetica-Bold',
    fontSize: 7,
    paddingTop: 5,
    paddingBottom: 5,
    paddingLeft: 6,
    paddingRight: 6,
    borderRightWidth: 1,
    borderRightColor: '#5599CC',
    borderRightStyle: 'solid',
    borderBottomWidth: 1,
    borderBottomColor: '#5599CC',
    borderBottomStyle: 'solid',
  },
  tableCell: {
    fontSize: 8,
    paddingTop: 5,
    paddingBottom: 5,
    paddingLeft: 6,
    paddingRight: 6,
    borderRightWidth: 1,
    borderRightColor: BORDER,
    borderRightStyle: 'solid',
    borderBottomWidth: 1,
    borderBottomColor: BORDER,
    borderBottomStyle: 'solid',
  },
  noteBox: {
    marginTop: 10,
    borderWidth: 1,
    borderColor: '#E0C860',
    borderStyle: 'solid',
    padding: 8,
    backgroundColor: WARN_FILL,
  },
  noteText: { fontSize: 7, color: '#6D4C00' },
  firmasSection: { marginTop: 28 },
  firmasRow: { flexDirection: 'row', gap: 32 },
  firmaBox: { flex: 1 },
  firmaLinea: {
    borderTopWidth: 1,
    borderTopColor: DARK,
    borderTopStyle: 'solid',
    paddingTop: 4,
    marginTop: 36,
  },
  firmaLabel: { fontSize: 7, color: MUTED },
  firmaSub: { fontSize: 7, color: MUTED, marginTop: 2 },
  footer: {
    position: 'absolute',
    bottom: 20,
    left: 50,
    right: 50,
    flexDirection: 'row',
    justifyContent: 'space-between',
    borderTopWidth: 1,
    borderTopColor: BORDER,
    borderTopStyle: 'solid',
    paddingTop: 4,
  },
  footerText: { fontSize: 6, color: '#888888' },
})

function formatFechaPDF(iso: string): string {
  try {
    return new Date(iso + 'T12:00:00').toLocaleDateString('es-MX', {
      year: 'numeric',
      month: 'long',
      day: 'numeric',
    })
  } catch { return iso }
}

export function ResumenNoConformidadesPDF({
  orgNombre,
  ranchoNombre,
  fecha,
  auditorNombre,
  clienteNombre,
  paPgfs,
  ncrs,
  notaPlazo = NOTE_DEFAULT,
}: ResumenNoConformidadesPDFProps) {
  const emision = new Date().toLocaleDateString('es-MX')

  return (
    <Document
      title={`Resumen_No_Conformidades_${fecha}`}
      author="M.A.D.Y — DuoMind Solutions"
      subject="Resumen de No-Conformidades PrimusGFS"
    >
      <Page size="A4" style={s.page}>
        <View fixed style={s.footer}>
          <Text style={s.footerText}>M.A.D.Y — DuoMind Solutions</Text>
          <Text
            style={s.footerText}
            render={({ pageNumber, totalPages }) => `Pagina ${pageNumber} de ${totalPages}`}
          />
        </View>

        {/* Header */}
        <View style={s.header}>
          <View style={{ flex: 2 }}>
            <MadyLogoPDF style={{ fontSize: 11, fontFamily: 'Helvetica-Bold', color: PRIMARY }} />
            <Text style={{ fontSize: 7, color: MUTED, marginTop: 2 }}>Inocuidad Alimentaria</Text>
          </View>
          <View style={{ flex: 6 }}>
            <Text style={s.headerTitle}>RESUMEN DE NO-CONFORMIDADES</Text>
            <Text style={s.headerTitleSub}>PrimusGFS — Auditoria Combinada</Text>
          </View>
          <View style={{ flex: 2, alignItems: 'flex-end' }}>
            <Text style={s.headerMeta}>Emision: {emision}</Text>
            {paPgfs ? <Text style={s.headerMeta}>PA-PGFS: {paPgfs}</Text> : null}
          </View>
        </View>

        {/* Sección 1: Info general */}
        <Text style={s.sectionTitle}>1. INFORMACION GENERAL</Text>
        <View style={s.infoTable}>
          <View style={s.infoRow}>
            <View style={s.infoCell}>
              <Text style={s.infoCellLabel}>ORGANIZACION</Text>
              <Text style={s.infoCellValue}>{orgNombre}</Text>
            </View>
            <View style={s.infoCell}>
              <Text style={s.infoCellLabel}>OPERACION / INSTALACION</Text>
              <Text style={s.infoCellValue}>{ranchoNombre}</Text>
            </View>
          </View>
          <View style={s.infoRow}>
            <View style={s.infoCell}>
              <Text style={s.infoCellLabel}>FECHA DE AUDITORIA</Text>
              <Text style={s.infoCellValue}>{formatFechaPDF(fecha)}</Text>
            </View>
            <View style={s.infoCell}>
              <Text style={s.infoCellLabel}>AUDITOR</Text>
              <Text style={s.infoCellValue}>{auditorNombre || '—'}</Text>
            </View>
          </View>
          <View style={s.infoRow}>
            <View style={s.infoCell}>
              <Text style={s.infoCellLabel}>CLIENTE / REPRESENTANTE</Text>
              <Text style={s.infoCellValue}>{clienteNombre || '—'}</Text>
            </View>
            <View style={s.infoCell}>
              <Text style={s.infoCellLabel}>TOTAL DE NO-CONFORMIDADES</Text>
              <Text style={[s.infoCellValue, { fontFamily: 'Helvetica-Bold', color: DANGER_TEXT }]}>
                {ncrs.length} NCR{ncrs.length !== 1 ? 's' : ''}
              </Text>
            </View>
          </View>
        </View>

        {/* Sección 2: Tabla NCRs */}
        <Text style={s.sectionTitle}>2. NO-CONFORMIDADES DETECTADAS</Text>
        <View style={s.table}>
          <View style={s.tableHeaderRow}>
            <Text style={[s.tableHeaderCell, { width: 38, textAlign: 'center' }]}>No.</Text>
            <Text style={[s.tableHeaderCell, { flex: 2 }]}>Modulo / Seccion / Pregunta</Text>
            <Text style={[s.tableHeaderCell, { flex: 2 }]}>Descripcion de la no-conformidad</Text>
          </View>
          {ncrs.length === 0 ? (
            <View style={s.tableRow}>
              <Text style={[s.tableCell, { flex: 1, textAlign: 'center', color: MUTED, fontSize: 8 }]}>
                Sin no-conformidades en esta visita
              </Text>
            </View>
          ) : (
            ncrs.map((ncr, i) => (
              <View key={ncr.ncr} style={i % 2 === 0 ? s.tableRow : s.tableRowAlt} wrap={false}>
                <Text
                  style={[
                    s.tableCell,
                    { width: 38, textAlign: 'center', fontFamily: 'Helvetica-Bold', color: DANGER_TEXT, backgroundColor: DANGER_FILL },
                  ]}
                >
                  NCR{ncr.ncr}
                </Text>
                <View style={[s.tableCell, { flex: 2 }]}>
                  <Text style={{ fontSize: 7, color: MUTED, fontFamily: 'Helvetica-Bold' }}>
                    {ncr.modulo.toUpperCase()} — {ncr.seccion}
                  </Text>
                  <Text style={{ fontSize: 7, color: MUTED, marginTop: 1 }}>{ncr.codigo_pregunta}</Text>
                  <Text style={{ marginTop: 2 }}>{ncr.texto_pregunta}</Text>
                </View>
                <View style={[s.tableCell, { flex: 2 }]}>
                  <Text>{ncr.comentario || '—'}</Text>
                </View>
              </View>
            ))
          )}
        </View>

        {/* Nota de plazo */}
        <View style={s.noteBox}>
          <Text style={s.noteText}>Nota: {notaPlazo}</Text>
        </View>

        {/* Sección 3: Firmas */}
        <Text style={[s.sectionTitle, { marginTop: 14 }]}>3. FIRMAS</Text>
        <View style={s.firmasSection}>
          <View style={s.firmasRow}>
            <View style={s.firmaBox}>
              <View style={s.firmaLinea}>
                <Text style={s.firmaLabel}>Firma del Cliente</Text>
                <Text style={s.firmaSub}>{clienteNombre || ' '}</Text>
              </View>
            </View>
            <View style={s.firmaBox}>
              <View style={s.firmaLinea}>
                <Text style={s.firmaLabel}>Firma del Auditor</Text>
                <Text style={s.firmaSub}>{auditorNombre || ' '}</Text>
              </View>
            </View>
          </View>
        </View>
      </Page>
    </Document>
  )
}
