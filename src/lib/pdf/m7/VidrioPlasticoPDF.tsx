// PATRÓN INOCUIDAD — PDF M7
// VidrioPlasticoPagina: una página A4 por inspección (reutilizable en individual y consolidado).
// VidrioPlasticoPDF: documento individual (1 página).
// VidrioPlasticoConsolidadoPDF: documento multi-página, una VidrioPlasticoPagina por inspección.

import { Document, Page, View, Text, StyleSheet } from '@react-pdf/renderer'
import { MadyLogoPDF } from '@/lib/pdf/MadyLogoPDF'

export interface VidrioPlasticoPDFProps {
  folio: string
  rancho: string
  ranchoCodigo: string
  fecha: string
  responsableNombre: string
  materiales: {
    area: string
    material_equipo: string
    protegido: boolean
    estado: 'Bueno' | 'Deteriorado' | 'Reemplazo'
    observaciones: string | null
  }[]
}

export interface VidrioPlasticoConsolidadoPDFProps {
  inspecciones: VidrioPlasticoPDFProps[]
  ranchoNombre: string
  desde: string
  hasta: string
}

// ── Paleta ────────────────────────────────────────────────────────────────────

const PRIMARY = '#2B7AB5'
const DARK = '#1A1A1A'
const BORDER = '#CCCCCC'
const WHITE = '#FFFFFF'
const MUTED = '#555555'
const ROW_ALT = '#F5F9FE'

const ESTADO_COLORS: Record<string, { bg: string; text: string }> = {
  'Bueno':       { bg: '#E3F2FD', text: '#0D5A8F' },
  'Deteriorado': { bg: '#FAEEDA', text: '#854F0B' },
  'Reemplazo':   { bg: '#FAECE7', text: '#993C1D' },
}

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

  // ── Header ──────────────────────────────────────────────────────────────
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 12,
    borderBottomWidth: 2,
    borderBottomColor: PRIMARY,
    borderBottomStyle: 'solid',
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
  headerMeta:    { width: 80, fontSize: 7, textAlign: 'right', color: MUTED },

  // ── Section title bar ──────────────────────────────────────────────────
  sectionTitle: {
    backgroundColor: PRIMARY,
    color: WHITE,
    fontFamily: 'Helvetica-Bold',
    fontSize: 8,
    paddingTop: 4,
    paddingBottom: 4,
    paddingLeft: 8,
    paddingRight: 8,
    marginTop: 12,
  },

  // ── Info table ─────────────────────────────────────────────────────────
  infoTable: {
    borderLeftWidth: 1,
    borderLeftColor: BORDER,
    borderLeftStyle: 'solid',
    borderTopWidth: 1,
    borderTopColor: BORDER,
    borderTopStyle: 'solid',
    marginBottom: 4,
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

  // ── Materiales table ───────────────────────────────────────────────────
  matTable: {
    borderLeftWidth: 1,
    borderLeftColor: BORDER,
    borderLeftStyle: 'solid',
    borderTopWidth: 1,
    borderTopColor: BORDER,
    borderTopStyle: 'solid',
    marginBottom: 4,
  },
  matHeaderRow: { flexDirection: 'row', backgroundColor: PRIMARY },
  matRow:       { flexDirection: 'row' },
  matRowAlt:    { flexDirection: 'row', backgroundColor: ROW_ALT },
  matHeaderCell: {
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
  matCell: {
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
  matCellCentered: {
    fontSize: 8,
    paddingTop: 5,
    paddingBottom: 5,
    paddingLeft: 4,
    paddingRight: 4,
    textAlign: 'center',
    borderRightWidth: 1,
    borderRightColor: BORDER,
    borderRightStyle: 'solid',
    borderBottomWidth: 1,
    borderBottomColor: BORDER,
    borderBottomStyle: 'solid',
    fontFamily: 'Helvetica-Bold',
  },

  // ── Firmas ─────────────────────────────────────────────────────────────
  firmasSection: { marginTop: 36 },
  firmasRow:     { flexDirection: 'row', gap: 32 },
  firmaBox:      { flex: 1 },
  firmaLinea: {
    borderTopWidth: 1,
    borderTopColor: DARK,
    borderTopStyle: 'solid',
    paddingTop: 4,
    marginTop: 32,
  },
  firmaLabel:  { fontSize: 7, color: MUTED },
  firmaNombre: { fontSize: 9, fontFamily: 'Helvetica-Bold', marginTop: 2 },

  // ── Footer (fijo por página) ───────────────────────────────────────────
  footer: {
    position: 'absolute',
    bottom: 20,
    left: 40,
    right: 40,
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
      weekday: 'long',
      year: 'numeric',
      month: 'long',
      day: 'numeric',
    })
  } catch {
    return iso
  }
}

// ── VidrioPlasticoPagina ──────────────────────────────────────────────────────
// Unidad de contenido: una página A4 con el formato oficial de una inspección.

export function VidrioPlasticoPagina({
  folio,
  rancho,
  ranchoCodigo,
  fecha,
  responsableNombre,
  materiales,
}: VidrioPlasticoPDFProps) {
  const emision = new Date().toLocaleDateString('es-MX')

  return (
    <Page size="A4" style={s.page}>

      {/* Footer fijo en esta página */}
      <View fixed style={s.footer}>
        <Text style={s.footerText}>
          M.A.D.Y · Inocuidad Inteligente
        </Text>
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
          <Text style={s.headerTitle}>INSPECCION DE VIDRIO Y PLASTICO DURO</Text>
          <Text style={s.headerTitleSub}>
            Clave: MXA-F-SC-SIG-029.14 · FORMATOS MANUAL DEL SAIA Y BPA's
          </Text>
        </View>
        <View style={{ flex: 2, alignItems: 'flex-end' }}>
          <Text style={s.headerMeta}>Folio: {folio}</Text>
          <Text style={s.headerMeta}>Emision: {emision}</Text>
        </View>
      </View>

      {/* Sección 1 — Datos */}
      <Text style={s.sectionTitle}>1. DATOS DEL RANCHO E INSPECCION</Text>
      <View style={s.infoTable}>
        <View style={s.infoRow}>
          <View style={[s.infoCell, { flex: 2 }]}>
            <Text style={s.infoCellLabel}>RANCHO / HUERTO</Text>
            <Text style={s.infoCellValue}>{rancho}</Text>
          </View>
          <View style={s.infoCell}>
            <Text style={s.infoCellLabel}>CODIGO</Text>
            <Text style={s.infoCellValue}>{ranchoCodigo}</Text>
          </View>
          <View style={[s.infoCell, { flex: 2 }]}>
            <Text style={s.infoCellLabel}>FECHA DE INSPECCION</Text>
            <Text style={s.infoCellValue}>{formatFechaPDF(fecha)}</Text>
          </View>
          <View style={s.infoCell}>
            <Text style={s.infoCellLabel}>TOTAL MATERIALES</Text>
            <Text style={s.infoCellValue}>{materiales.length}</Text>
          </View>
        </View>
      </View>

      {/* Sección 2 — Materiales inspeccionados */}
      <Text style={s.sectionTitle}>2. MATERIALES INSPECCIONADOS</Text>
      <View style={s.matTable}>
        <View style={s.matHeaderRow}>
          <Text style={[s.matHeaderCell, { flex: 2 }]}>Area</Text>
          <Text style={[s.matHeaderCell, { flex: 3 }]}>Material / Equipo</Text>
          <Text style={[s.matHeaderCell, { flex: 1, textAlign: 'center' }]}>Protegido</Text>
          <Text style={[s.matHeaderCell, { flex: 2, textAlign: 'center' }]}>Estado</Text>
          <Text style={[s.matHeaderCell, { flex: 3 }]}>Observaciones</Text>
        </View>
        {materiales.map((m, i) => {
          const estadoColors = ESTADO_COLORS[m.estado] ?? { bg: WHITE, text: DARK }
          return (
            <View key={i} style={i % 2 === 0 ? s.matRow : s.matRowAlt}>
              <Text style={[s.matCell, { flex: 2 }]}>{m.area}</Text>
              <Text style={[s.matCell, { flex: 3 }]}>{m.material_equipo}</Text>
              <Text
                style={[
                  s.matCellCentered,
                  { flex: 1 },
                  m.protegido
                    ? { color: '#0D5A8F', backgroundColor: '#E3F2FD' }
                    : { color: '#993C1D', backgroundColor: '#FAECE7' },
                ]}
              >
                {m.protegido ? 'Si' : 'No'}
              </Text>
              <Text
                style={[
                  s.matCellCentered,
                  { flex: 2 },
                  { backgroundColor: estadoColors.bg, color: estadoColors.text },
                ]}
              >
                {m.estado}
              </Text>
              <Text style={[s.matCell, { flex: 3 }]}>{m.observaciones ?? ''}</Text>
            </View>
          )
        })}
      </View>

      {/* Sección 3 — Firmas */}
      <Text style={[s.sectionTitle, { marginTop: 20 }]}>3. FIRMAS Y RESPONSABLES</Text>
      <View style={s.firmasSection}>
        <View style={s.firmasRow}>
          <View style={s.firmaBox}>
            <Text style={s.firmaLabel}>Realizo la inspeccion</Text>
            <Text style={s.firmaNombre}>{responsableNombre}</Text>
            <View style={s.firmaLinea}>
              <Text style={s.firmaLabel}>Firma</Text>
            </View>
          </View>
          <View style={s.firmaBox}>
            <Text style={s.firmaLabel}>&nbsp;</Text>
            <Text style={s.firmaNombre}>&nbsp;</Text>
            <View style={s.firmaLinea}>
              <Text style={s.firmaLabel}>Responsable de Inocuidad — Firma</Text>
            </View>
          </View>
        </View>
      </View>

    </Page>
  )
}

// ── VidrioPlasticoPDF ─────────────────────────────────────────────────────────
// Documento individual: exactamente 1 página.

export function VidrioPlasticoPDF(props: VidrioPlasticoPDFProps) {
  return (
    <Document
      title={`Vidrio y Plastico ${props.folio}`}
      author="M.A.D.Y"
      subject="Inspeccion de Vidrio y Plastico Duro"
    >
      <VidrioPlasticoPagina {...props} />
    </Document>
  )
}

// ── VidrioPlasticoConsolidadoPDF ──────────────────────────────────────────────
// Documento consolidado: una VidrioPlasticoPagina por cada inspección, en orden de fecha.

export function VidrioPlasticoConsolidadoPDF({
  inspecciones,
  ranchoNombre,
  desde,
  hasta,
}: VidrioPlasticoConsolidadoPDFProps) {
  return (
    <Document
      title={`Vidrio y Plastico Consolidado ${ranchoNombre} ${desde} ${hasta}`}
      author="M.A.D.Y"
      subject="Inspeccion Consolidada de Vidrio y Plastico Duro"
    >
      {inspecciones.map((insp) => (
        <VidrioPlasticoPagina key={insp.folio} {...insp} />
      ))}
    </Document>
  )
}
