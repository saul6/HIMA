// PATRÓN INOCUIDAD — PDF M12
// LimpiezaBanosPagina: una página A4 portrait por jornada (reutilizable).
// LimpiezaBanosPDF:    documento individual (1 jornada).
// LimpiezaBanosConsolidadoPDF: documento multi-página, uno por jornada.

import { Document, Page, View, Text, StyleSheet } from '@react-pdf/renderer'
import { MadyLogoPDF } from '@/lib/pdf/MadyLogoPDF'

// ── Tipos ─────────────────────────────────────────────────────────────────────

export interface LimpiezaBanoPDFRow {
  bano_numero: string
  limpieza: boolean
  desinfeccion: boolean
  concentracion_ppm: number
  sustancias: string[]
  abasto_papel: boolean
  succion: boolean
}

export interface LimpiezaBanosPaginaProps {
  rancho: string
  ranchoCodigo: string
  fecha: string       // "2026-06-15" ISO
  banos: LimpiezaBanoPDFRow[]
}

export interface LimpiezaBanosConsolidadoPDFProps {
  jornadas: LimpiezaBanosPaginaProps[]
  ranchoNombre: string
  desde: string
  hasta: string
}

// ── Paleta ────────────────────────────────────────────────────────────────────

const PRIMARY  = '#2B7AB5'
const DARK     = '#1A1A1A'
const BORDER   = '#CCCCCC'
const WHITE    = '#FFFFFF'
const MUTED    = '#555555'
const ROW_ALT  = '#F5F9FE'
const SI_BG    = '#E3F2FD'
const SI_TEXT  = '#0D5A8F'
const NO_BG    = '#FAECE7'
const NO_TEXT  = '#993C1D'

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

  // Header
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
  headerTitle: {
    flex: 1,
    textAlign: 'center',
    fontSize: 9,
    fontFamily: 'Helvetica-Bold',
    color: DARK,
  },
  headerTitleSub: { textAlign: 'center', fontSize: 7, color: MUTED, marginTop: 2 },
  headerMeta: { fontSize: 7, textAlign: 'right', color: MUTED },

  // Section bar
  sectionTitle: {
    backgroundColor: PRIMARY,
    color: WHITE,
    fontFamily: 'Helvetica-Bold',
    fontSize: 8,
    paddingTop: 4,
    paddingBottom: 4,
    paddingLeft: 8,
    marginTop: 12,
  },

  // Info table
  infoTable: {
    borderLeftWidth: 1,
    borderLeftColor: BORDER,
    borderTopWidth: 1,
    borderTopColor: BORDER,
    marginBottom: 4,
  },
  infoRow: { flexDirection: 'row' },
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

  // Baños table
  tbl: {
    borderLeftWidth: 1,
    borderLeftColor: BORDER,
    borderTopWidth: 1,
    borderTopColor: BORDER,
    marginBottom: 4,
  },
  hdrRow: { flexDirection: 'row', backgroundColor: PRIMARY },
  dataRow: { flexDirection: 'row' },
  dataRowAlt: { flexDirection: 'row', backgroundColor: ROW_ALT },
  hdrCell: {
    color: WHITE,
    fontFamily: 'Helvetica-Bold',
    fontSize: 7,
    paddingTop: 5,
    paddingBottom: 5,
    paddingLeft: 5,
    paddingRight: 5,
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
    paddingLeft: 5,
    paddingRight: 5,
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

  // Firma
  firmaSection: { marginTop: 32 },
  firmaRow: { flexDirection: 'row', gap: 32 },
  firmaBox: { flex: 1 },
  firmaLinea: {
    borderTopWidth: 1,
    borderTopColor: DARK,
    paddingTop: 4,
    marginTop: 32,
  },
  firmaLabel: { fontSize: 7, color: MUTED },

  // Footer fijo
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

function formatFechaPDF(iso: string): string {
  try {
    return new Date(iso + 'T12:00:00').toLocaleDateString('es-MX', {
      weekday: 'long', year: 'numeric', month: 'long', day: 'numeric',
    })
  } catch { return iso }
}

function siNo(val: boolean): string { return val ? 'Si' : 'No' }

// ── Componente de página ──────────────────────────────────────────────────────

export function LimpiezaBanosPagina({
  rancho, ranchoCodigo, fecha, banos,
}: LimpiezaBanosPaginaProps) {
  const emision = new Date().toLocaleDateString('es-MX')

  return (
    <Page size="A4" style={s.page}>

      {/* Footer fijo */}
      <View fixed style={s.footer}>
        <Text style={s.footerText}>M.A.D.Y · Inocuidad Inteligente</Text>
        <Text style={s.footerText} render={({ pageNumber, totalPages }) => `Pagina ${pageNumber} de ${totalPages}`} />
      </View>

      {/* Header */}
      <View style={s.header}>
        <View style={{ flex: 2 }}>
          <MadyLogoPDF style={s.headerLogo} />
          <Text style={s.headerLogoSub}>Inocuidad Alimentaria</Text>
        </View>
        <View style={{ flex: 6 }}>
          <Text style={s.headerTitle}>LIMPIEZA Y DESINFECCION DE BANOS</Text>
          <Text style={s.headerTitleSub}>Clave: MXA-F-SC-SIG-041.14 · FORMATOS MANUAL DEL SAIA Y BPA's</Text>
        </View>
        <View style={{ flex: 2, alignItems: 'flex-end' }}>
          <Text style={s.headerMeta}>Emision: {emision}</Text>
        </View>
      </View>

      {/* Sección 1 — Datos */}
      <Text style={s.sectionTitle}>1. DATOS DEL RANCHO Y JORNADA</Text>
      <View style={s.infoTable}>
        <View style={s.infoRow}>
          <View style={[s.infoCell, { flex: 3 }]}>
            <Text style={s.infoCellLabel}>RANCHO / HUERTO</Text>
            <Text style={s.infoCellValue}>{rancho}</Text>
          </View>
          <View style={s.infoCell}>
            <Text style={s.infoCellLabel}>CODIGO</Text>
            <Text style={s.infoCellValue}>{ranchoCodigo}</Text>
          </View>
          <View style={[s.infoCell, { flex: 3 }]}>
            <Text style={s.infoCellLabel}>FECHA</Text>
            <Text style={s.infoCellValue}>{formatFechaPDF(fecha)}</Text>
          </View>
          <View style={s.infoCell}>
            <Text style={s.infoCellLabel}>TOTAL BANOS</Text>
            <Text style={s.infoCellValue}>{banos.length}</Text>
          </View>
        </View>
      </View>

      {/* Sección 2 — Tabla de baños */}
      <Text style={s.sectionTitle}>2. REGISTRO DE LIMPIEZA POR BANO</Text>
      <View style={s.tbl}>
        {/* Header */}
        <View style={s.hdrRow}>
          <Text style={[s.hdrCell, { width: 45 }]}>N. Bano</Text>
          <Text style={[s.hdrCell, { flex: 2 }]}>Limpieza{'\n'}(Lavar y tallar)</Text>
          <Text style={[s.hdrCell, { flex: 2 }]}>Desinfeccion{'\n'}(3 ml cloro/L)</Text>
          <Text style={[s.hdrCell, { width: 55 }]}>Conc.{'\n'}(ppm)</Text>
          <Text style={[s.hdrCell, { flex: 3 }]}>Sustancias utilizadas</Text>
          <Text style={[s.hdrCell, { flex: 2 }]}>Abasto{'\n'}Papel</Text>
          <Text style={[s.hdrCell, { flex: 1.5 }]}>Succion</Text>
        </View>

        {/* Filas */}
        {banos.map((b, i) => (
          <View key={i} style={i % 2 === 0 ? s.dataRow : s.dataRowAlt}>
            <Text style={[s.cell, { width: 45, textAlign: 'center', fontFamily: 'Helvetica-Bold' }]}>
              {b.bano_numero}
            </Text>
            <Text
              style={[
                s.cellCenter,
                { flex: 2 },
                b.limpieza
                  ? { backgroundColor: SI_BG, color: SI_TEXT }
                  : { backgroundColor: NO_BG, color: NO_TEXT },
              ]}
            >
              {siNo(b.limpieza)}
            </Text>
            <Text
              style={[
                s.cellCenter,
                { flex: 2 },
                b.desinfeccion
                  ? { backgroundColor: SI_BG, color: SI_TEXT }
                  : { backgroundColor: NO_BG, color: NO_TEXT },
              ]}
            >
              {siNo(b.desinfeccion)}
            </Text>
            <Text style={[s.cellCenter, { width: 55, color: DARK }]}>
              {b.concentracion_ppm}
            </Text>
            <Text style={[s.cell, { flex: 3, fontSize: 7 }]}>
              {b.sustancias.join(', ')}
            </Text>
            <Text
              style={[
                s.cellCenter,
                { flex: 2 },
                b.abasto_papel
                  ? { backgroundColor: SI_BG, color: SI_TEXT }
                  : { backgroundColor: NO_BG, color: NO_TEXT },
              ]}
            >
              {siNo(b.abasto_papel)}
            </Text>
            <Text
              style={[
                s.cellCenter,
                { flex: 1.5 },
                b.succion
                  ? { backgroundColor: SI_BG, color: SI_TEXT }
                  : { backgroundColor: NO_BG, color: NO_TEXT },
              ]}
            >
              {siNo(b.succion)}
            </Text>
          </View>
        ))}
      </View>

      {/* Sección 3 — Firmas */}
      <Text style={[s.sectionTitle, { marginTop: 20 }]}>3. FIRMAS Y RESPONSABLES</Text>
      <View style={s.firmaSection}>
        <View style={s.firmaRow}>
          <View style={s.firmaBox}>
            <Text style={s.firmaLabel}>Realizo la limpieza</Text>
            <View style={s.firmaLinea}>
              <Text style={s.firmaLabel}>Firma</Text>
            </View>
          </View>
          <View style={s.firmaBox}>
            <Text style={s.firmaLabel}>&nbsp;</Text>
            <View style={s.firmaLinea}>
              <Text style={s.firmaLabel}>Responsable de Inocuidad — Firma</Text>
            </View>
          </View>
        </View>
      </View>

    </Page>
  )
}

// ── PDF individual ─────────────────────────────────────────────────────────────

export function LimpiezaBanosPDF(props: LimpiezaBanosPaginaProps) {
  return (
    <Document
      title={`Limpieza de Banos ${props.rancho} ${props.fecha}`}
      author="M.A.D.Y"
      subject="Limpieza y Desinfeccion de Banos"
    >
      <LimpiezaBanosPagina {...props} />
    </Document>
  )
}

// ── PDF consolidado ────────────────────────────────────────────────────────────

export function LimpiezaBanosConsolidadoPDF({
  jornadas, ranchoNombre, desde, hasta,
}: LimpiezaBanosConsolidadoPDFProps) {
  return (
    <Document
      title={`Limpieza Banos Consolidado ${ranchoNombre} ${desde} ${hasta}`}
      author="M.A.D.Y"
      subject="Limpieza y Desinfeccion de Banos Consolidado"
    >
      {jornadas.map((j, i) => (
        <LimpiezaBanosPagina key={i} {...j} />
      ))}
    </Document>
  )
}
