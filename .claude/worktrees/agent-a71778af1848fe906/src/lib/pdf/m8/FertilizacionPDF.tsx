// PATRÓN INOCUIDAD — PDF M8
// FertilizacionPagina: una página A4 por registro de jornada (reutilizable en individual y consolidado).
// FertilizacionPDF: documento individual (1 página).
// FertilizacionConsolidadoPDF: documento multi-página, una FertilizacionPagina por registro.

import { Document, Page, View, Text, StyleSheet } from '@react-pdf/renderer'
import { MadyLogoPDF } from '@/lib/pdf/MadyLogoPDF'

export interface FertilizacionPDFProps {
  folio: string
  rancho: string
  ranchoCodigo: string
  fecha: string
  sector: string | null
  responsableNombre: string
  fertilizantes: {
    nombre_comercial: string
    ingrediente_activo: string | null
    concentracion: string | null
    metodo: string
    superficie_ha: number
    dosis_kg_l_ha: number
    cantidad_total: number
  }[]
}

export interface FertilizacionConsolidadoPDFProps {
  registros: FertilizacionPDFProps[]
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

  // ── Fertilizantes table ────────────────────────────────────────────────
  fertTable: {
    borderLeftWidth: 1,
    borderLeftColor: BORDER,
    borderLeftStyle: 'solid',
    borderTopWidth: 1,
    borderTopColor: BORDER,
    borderTopStyle: 'solid',
    marginBottom: 4,
  },
  fertHeaderRow: { flexDirection: 'row', backgroundColor: PRIMARY },
  fertRow:       { flexDirection: 'row' },
  fertRowAlt:    { flexDirection: 'row', backgroundColor: ROW_ALT },
  fertHeaderCell: {
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
  fertCell: {
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
  fertCellCentered: {
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

// ── FertilizacionPagina ───────────────────────────────────────────────────────
// Unidad de contenido: una página A4 con el formato oficial de un registro de jornada.

export function FertilizacionPagina({
  folio,
  rancho,
  ranchoCodigo,
  fecha,
  sector,
  responsableNombre,
  fertilizantes,
}: FertilizacionPDFProps) {
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
          <Text style={s.headerTitle}>REGISTRO DE FERTILIZACION</Text>
          <Text style={s.headerTitleSub}>
            Clave: MXA-F-SC-SIG-030.14 · FORMATOS MANUAL DEL SAIA Y BPA's
          </Text>
        </View>
        <View style={{ flex: 2, alignItems: 'flex-end' }}>
          <Text style={s.headerMeta}>Folio: {folio}</Text>
          <Text style={s.headerMeta}>Emision: {emision}</Text>
        </View>
      </View>

      {/* Sección 1 — Datos */}
      <Text style={s.sectionTitle}>1. DATOS DEL RANCHO Y JORNADA</Text>
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
          <View style={s.infoCell}>
            <Text style={s.infoCellLabel}>SECTOR</Text>
            <Text style={s.infoCellValue}>{sector ?? '—'}</Text>
          </View>
          <View style={[s.infoCell, { flex: 2 }]}>
            <Text style={s.infoCellLabel}>FECHA DE REGISTRO</Text>
            <Text style={s.infoCellValue}>{formatFechaPDF(fecha)}</Text>
          </View>
          <View style={s.infoCell}>
            <Text style={s.infoCellLabel}>TOTAL FERTILIZANTES</Text>
            <Text style={s.infoCellValue}>{fertilizantes.length}</Text>
          </View>
        </View>
      </View>

      {/* Sección 2 — Fertilizantes aplicados */}
      <Text style={s.sectionTitle}>2. FERTILIZANTES APLICADOS</Text>
      <View style={s.fertTable}>
        <View style={s.fertHeaderRow}>
          <Text style={[s.fertHeaderCell, { flex: 3 }]}>Nombre Comercial</Text>
          <Text style={[s.fertHeaderCell, { flex: 2.5 }]}>Ingrediente Activo</Text>
          <Text style={[s.fertHeaderCell, { flex: 1.5, textAlign: 'center' }]}>Metodo</Text>
          <Text style={[s.fertHeaderCell, { flex: 1, textAlign: 'center' }]}>Sup. (ha)</Text>
          <Text style={[s.fertHeaderCell, { flex: 1.5, textAlign: 'center' }]}>Dosis</Text>
          <Text style={[s.fertHeaderCell, { flex: 1.5, textAlign: 'center' }]}>Cantidad Total</Text>
        </View>
        {fertilizantes.map((f, i) => (
          <View key={i} style={i % 2 === 0 ? s.fertRow : s.fertRowAlt}>
            <Text style={[s.fertCell, { flex: 3 }]}>{f.nombre_comercial}</Text>
            <Text style={[s.fertCell, { flex: 2.5 }]}>
              {f.ingrediente_activo ?? '—'}{f.concentracion ? ` ${f.concentracion}` : ''}
            </Text>
            <Text style={[s.fertCellCentered, { flex: 1.5 }]}>{f.metodo}</Text>
            <Text style={[s.fertCellCentered, { flex: 1 }]}>{f.superficie_ha}</Text>
            <Text style={[s.fertCellCentered, { flex: 1.5 }]}>{f.dosis_kg_l_ha}</Text>
            <Text style={[s.fertCellCentered, { flex: 1.5 }]}>{f.cantidad_total.toFixed(2)}</Text>
          </View>
        ))}
      </View>

      {/* Sección 3 — Firmas */}
      <Text style={[s.sectionTitle, { marginTop: 20 }]}>3. FIRMAS Y RESPONSABLES</Text>
      <View style={s.firmasSection}>
        <View style={s.firmasRow}>
          <View style={s.firmaBox}>
            <Text style={s.firmaLabel}>Realizo la aplicacion</Text>
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

// ── FertilizacionPDF ──────────────────────────────────────────────────────────
// Documento individual: exactamente 1 página.

export function FertilizacionPDF(props: FertilizacionPDFProps) {
  return (
    <Document
      title={`Fertilizacion ${props.folio}`}
      author="M.A.D.Y"
      subject="Registro de Fertilizacion"
    >
      <FertilizacionPagina {...props} />
    </Document>
  )
}

// ── FertilizacionConsolidadoPDF ───────────────────────────────────────────────
// Documento consolidado: una FertilizacionPagina por cada registro, en orden de fecha.

export function FertilizacionConsolidadoPDF({
  registros,
  ranchoNombre,
  desde,
  hasta,
}: FertilizacionConsolidadoPDFProps) {
  return (
    <Document
      title={`Fertilizacion Consolidado ${ranchoNombre} ${desde} ${hasta}`}
      author="M.A.D.Y"
      subject="Registro Consolidado de Fertilizacion"
    >
      {registros.map((reg) => (
        <FertilizacionPagina key={reg.folio} {...reg} />
      ))}
    </Document>
  )
}
