import { Document, Page, View, Text, StyleSheet } from '@react-pdf/renderer'
import { MadyLogoPDF } from '@/lib/pdf/MadyLogoPDF'

// ── Tipos ─────────────────────────────────────────────────────────────────────

export interface PreparacionPDFRow {
  fecha: string
  area: string
  litros_agua: number
  ml_cloro: number
  responsable: string | null
  observaciones: string | null
}

export interface PreparacionCloroPaginaProps {
  rancho: string
  orgNombre?: string | null
  desde: string
  hasta: string
  preparaciones: PreparacionPDFRow[]
}

// ── Paleta ────────────────────────────────────────────────────────────────────

const PRIMARY = '#2B7AB5'
const DARK    = '#1A1A1A'
const BORDER  = '#CCCCCC'
const WHITE   = '#FFFFFF'
const MUTED   = '#555555'
const ROW_ALT = '#F5F9FE'

// ── Estilos ───────────────────────────────────────────────────────────────────

const s = StyleSheet.create({
  page: {
    fontFamily: 'Helvetica',
    fontSize: 9,
    color: DARK,
    paddingTop: 50,
    paddingBottom: 50,
    paddingLeft: 40,
    paddingRight: 40,
  },

  header: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 12,
    borderBottomWidth: 2,
    borderBottomColor: PRIMARY,
    paddingBottom: 8,
  },
  headerLogo:    { fontSize: 11, fontFamily: 'Helvetica-Bold', color: PRIMARY },
  headerLogoSub: { fontSize: 7, color: MUTED, marginTop: 2 },
  headerTitle:   { flex: 1, textAlign: 'center', fontSize: 10, fontFamily: 'Helvetica-Bold', color: DARK },
  headerSub:     { textAlign: 'center', fontSize: 7, color: MUTED, marginTop: 2 },
  headerMeta:    { fontSize: 7, textAlign: 'right', color: MUTED },

  infoTable: {
    borderLeftWidth: 1,
    borderLeftColor: BORDER,
    borderTopWidth: 1,
    borderTopColor: BORDER,
    marginBottom: 10,
  },
  infoRow:    { flexDirection: 'row' },
  infoCell: {
    flex: 1,
    borderRightWidth: 1,
    borderRightColor: BORDER,
    borderBottomWidth: 1,
    borderBottomColor: BORDER,
    paddingTop: 5,
    paddingBottom: 5,
    paddingLeft: 8,
    paddingRight: 8,
  },
  infoCellLabel: { fontSize: 6, color: MUTED, marginBottom: 2, fontFamily: 'Helvetica-Bold' },
  infoCellValue: { fontSize: 9, color: DARK },

  tbl: {
    borderLeftWidth: 1,
    borderLeftColor: BORDER,
    borderTopWidth: 1,
    borderTopColor: BORDER,
  },
  hdrRow:     { flexDirection: 'row', backgroundColor: PRIMARY },
  dataRow:    { flexDirection: 'row' },
  dataRowAlt: { flexDirection: 'row', backgroundColor: ROW_ALT },
  hdrCell: {
    color: WHITE,
    fontFamily: 'Helvetica-Bold',
    fontSize: 7,
    paddingTop: 5,
    paddingBottom: 5,
    paddingLeft: 4,
    paddingRight: 4,
    borderRightWidth: 1,
    borderRightColor: '#5599CC',
    borderBottomWidth: 1,
    borderBottomColor: '#5599CC',
    textAlign: 'center',
  },
  cell: {
    fontSize: 8,
    paddingTop: 5,
    paddingBottom: 5,
    paddingLeft: 4,
    paddingRight: 4,
    borderRightWidth: 1,
    borderRightColor: BORDER,
    borderBottomWidth: 1,
    borderBottomColor: BORDER,
  },
  cellCenter: {
    fontSize: 8,
    paddingTop: 5,
    paddingBottom: 5,
    paddingLeft: 4,
    paddingRight: 4,
    borderRightWidth: 1,
    borderRightColor: BORDER,
    borderBottomWidth: 1,
    borderBottomColor: BORDER,
    textAlign: 'center',
    fontFamily: 'Helvetica-Bold',
  },

  nota: {
    marginTop: 10,
    padding: 8,
    borderWidth: 1,
    borderColor: BORDER,
  },
  notaText: { fontSize: 7, color: MUTED },

  firmaSection: { marginTop: 32 },
  firmaRow:     { flexDirection: 'row', gap: 32 },
  firmaBox:     { flex: 1 },
  firmaLinea: {
    borderTopWidth: 1,
    borderTopColor: DARK,
    paddingTop: 4,
    marginTop: 32,
  },
  firmaLabel: { fontSize: 7, color: MUTED },

  footer: {
    position: 'absolute',
    bottom: 20,
    left: 40,
    right: 40,
    flexDirection: 'row',
    justifyContent: 'space-between',
    borderTopWidth: 1,
    borderTopColor: BORDER,
    paddingTop: 4,
  },
  footerText: { fontSize: 6, color: '#888888' },
})

// ── Helpers ───────────────────────────────────────────────────────────────────

function fmt(iso: string): string {
  try {
    return new Date(iso + 'T12:00:00').toLocaleDateString('es-MX', {
      day: '2-digit', month: 'short', year: 'numeric',
    })
  } catch { return iso }
}

// ── Componente de página ──────────────────────────────────────────────────────

export function PreparacionCloroPagina({
  rancho, orgNombre, desde, hasta, preparaciones,
}: PreparacionCloroPaginaProps) {
  const emision = new Date().toLocaleDateString('es-MX')
  const periodoLabel = desde === hasta ? fmt(desde) : `${fmt(desde)} — ${fmt(hasta)}`

  return (
    <Page size="A4" style={s.page}>

      {/* Footer fijo */}
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
          <MadyLogoPDF style={s.headerLogo} />
          <Text style={s.headerLogoSub}>Inocuidad Alimentaria</Text>
        </View>
        <View style={{ flex: 6 }}>
          <Text style={s.headerTitle}>PREPARACION DE CLORO A 200 ppm</Text>
          <Text style={s.headerSub}>F-FRUS-SAN-03</Text>
        </View>
        <View style={{ flex: 2, alignItems: 'flex-end' }}>
          <Text style={s.headerMeta}>Emision: {emision}</Text>
        </View>
      </View>

      {/* Datos generales */}
      <View style={s.infoTable}>
        <View style={s.infoRow}>
          {orgNombre ? (
            <View style={[s.infoCell, { flex: 2 }]}>
              <Text style={s.infoCellLabel}>ORGANIZACION</Text>
              <Text style={s.infoCellValue}>{orgNombre}</Text>
            </View>
          ) : null}
          <View style={[s.infoCell, { flex: 2 }]}>
            <Text style={s.infoCellLabel}>RANCHO / INSTALACION</Text>
            <Text style={s.infoCellValue}>{rancho}</Text>
          </View>
          <View style={[s.infoCell, { flex: 2 }]}>
            <Text style={s.infoCellLabel}>PERIODO</Text>
            <Text style={s.infoCellValue}>{periodoLabel}</Text>
          </View>
          <View style={[s.infoCell, { flex: 1 }]}>
            <Text style={s.infoCellLabel}>TOTAL</Text>
            <Text style={s.infoCellValue}>{preparaciones.length}</Text>
          </View>
        </View>
      </View>

      {/* Tabla */}
      <View style={s.tbl}>
        <View style={s.hdrRow}>
          <Text style={[s.hdrCell, { width: 22 }]}>N.</Text>
          <Text style={[s.hdrCell, { width: 62 }]}>Fecha</Text>
          <Text style={[s.hdrCell, { flex: 3 }]}>Area / Punto de aplicacion</Text>
          <Text style={[s.hdrCell, { width: 48 }]}>Litros{'\n'}agua</Text>
          <Text style={[s.hdrCell, { width: 48 }]}>mL{'\n'}cloro</Text>
          <Text style={[s.hdrCell, { flex: 2 }]}>Responsable</Text>
          <Text style={[s.hdrCell, { flex: 2 }]}>Observaciones</Text>
        </View>

        {preparaciones.map((p, i) => (
          <View key={i} style={i % 2 === 0 ? s.dataRow : s.dataRowAlt}>
            <Text style={[s.cellCenter, { width: 22, fontSize: 7 }]}>{i + 1}</Text>
            <Text style={[s.cell, { width: 62, fontSize: 7 }]}>{fmt(p.fecha)}</Text>
            <Text style={[s.cell, { flex: 3 }]}>{p.area}</Text>
            <Text style={[s.cellCenter, { width: 48 }]}>{p.litros_agua} L</Text>
            <Text style={[s.cellCenter, { width: 48, color: PRIMARY }]}>{p.ml_cloro} mL</Text>
            <Text style={[s.cell, { flex: 2 }]}>{p.responsable ?? ''}</Text>
            <Text style={[s.cell, { flex: 2, fontSize: 7 }]}>{p.observaciones ?? ''}</Text>
          </View>
        ))}
      </View>

      {/* Nota */}
      <View style={s.nota}>
        <Text style={s.notaText}>
          Nota: Para obtener 200 ppm con cloro comercial (~6%): 3.33 mL de cloro por cada litro de agua.
          Formula: mL de cloro = Litros de agua x 10/3
        </Text>
      </View>

      {/* Firmas */}
      <View style={s.firmaSection}>
        <View style={s.firmaRow}>
          <View style={s.firmaBox}>
            <Text style={s.firmaLabel}>Elaboro</Text>
            <View style={s.firmaLinea}>
              <Text style={s.firmaLabel}>Firma</Text>
            </View>
          </View>
          <View style={s.firmaBox}>
            <Text style={s.firmaLabel}>&nbsp;</Text>
            <View style={s.firmaLinea}>
              <Text style={s.firmaLabel}>Verifico — Responsable de Inocuidad — Firma</Text>
            </View>
          </View>
        </View>
      </View>

    </Page>
  )
}

// ── Documento PDF ─────────────────────────────────────────────────────────────

export function PreparacionCloroPDF(props: PreparacionCloroPaginaProps) {
  return (
    <Document
      title={`Preparacion de Cloro ${props.rancho} ${props.desde}`}
      author="M.A.D.Y — DuoMind Solutions"
      subject="Preparacion de Cloro a 200 ppm — F-FRUS-SAN-03"
    >
      <PreparacionCloroPagina {...props} />
    </Document>
  )
}
