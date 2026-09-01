// PATRÓN INOCUIDAD — PDF M10 (landscape A4)
// CosechaLiberacionPagina: una página A4 landscape por registro de jornada.
// CosechaLiberacionPDF:           documento individual (1 jornada).
// CosechaLiberacionConsolidadoPDF: documento multi-página, una página por jornada.

import { Document, Page, View, Text, StyleSheet } from '@react-pdf/renderer'
import { MadyLogoPDF } from '@/lib/pdf/MadyLogoPDF'

// ── Tipos ─────────────────────────────────────────────────────────────────────

export interface CosechaLiberacionFilaPDF {
  sector: string | null
  cantidad_bandejas: number | null
  lote_liberado: boolean
  numero_comprobante: string | null
  codigo_trazabilidad: string | null
  marca_embalaje: string | null
  destino_final: string | null
  fruta_proceso_kg: number | null
  encargado_nombre: string | null
  verificacion_semanal: boolean
  hora_inicio_cosecha: string | null
  hora_fin_cosecha: string | null
  observaciones: string | null
}

export interface CosechaLiberacionPaginaProps {
  rancho: string
  ranchoCodigo: string
  fecha: string
  liberaciones: CosechaLiberacionFilaPDF[]
}

export interface CosechaLiberacionConsolidadoPDFProps {
  registros: CosechaLiberacionPaginaProps[]
  ranchoNombre: string
  desde: string
  hasta: string
}

// ── Paleta ────────────────────────────────────────────────────────────────────

const PRIMARY = '#2B7AB5'
const DARK    = '#1A1A1A'
const BORDER  = '#CCCCCC'
const WHITE   = '#FFFFFF'
const MUTED   = '#555555'
const ROW_ALT = '#F5F9FE'
const SI_BG   = '#E3F2FD'
const SI_TEXT = '#0D5A8F'
const NO_BG   = '#FAECE7'
const NO_TEXT = '#993C1D'

// Anchos de columna fijos en landscape A4 (disponible ≈781 pts con padding 30 c/lado)
const W = {
  fecha:        45,
  sector:       60,
  bandejas:     45,
  loteLib:      45,
  comprobante:  75,
  trazabilidad: 80,
  marcaEmbalaje:65,
  destino:      70,
  frutaKg:      48,
  encargado:    83,
  verif:        45,
  observaciones:120,
} as const

// ── Estilos ───────────────────────────────────────────────────────────────────

const s = StyleSheet.create({
  page: {
    fontFamily: 'Helvetica',
    fontSize: 8,
    color: DARK,
    paddingTop: 36,
    paddingBottom: 44,
    paddingLeft: 30,
    paddingRight: 30,
  },

  // Header
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 10,
    borderBottomWidth: 2,
    borderBottomColor: PRIMARY,
    paddingBottom: 7,
  },
  headerLogo:    { fontSize: 10, fontFamily: 'Helvetica-Bold', color: PRIMARY },
  headerLogoSub: { fontSize: 6, color: MUTED, marginTop: 2 },
  headerTitle: {
    flex: 1,
    textAlign: 'center',
    fontSize: 9,
    fontFamily: 'Helvetica-Bold',
    color: DARK,
  },
  headerTitleSub: { textAlign: 'center', fontSize: 6.5, color: MUTED, marginTop: 2 },
  headerMeta:    { fontSize: 6.5, textAlign: 'right', color: MUTED },

  // Section bar
  sectionTitle: {
    backgroundColor: PRIMARY,
    color: WHITE,
    fontFamily: 'Helvetica-Bold',
    fontSize: 7,
    paddingTop: 3,
    paddingBottom: 3,
    paddingLeft: 7,
    marginTop: 10,
  },

  // Info table
  infoTable: {
    borderLeftWidth: 1,
    borderLeftColor: BORDER,
    borderTopWidth: 1,
    borderTopColor: BORDER,
    marginBottom: 4,
  },
  infoRow:  { flexDirection: 'row' },
  infoCell: {
    flex: 1,
    borderRightWidth: 1,
    borderRightColor: BORDER,
    borderBottomWidth: 1,
    borderBottomColor: BORDER,
    paddingTop: 4,
    paddingBottom: 4,
    paddingLeft: 6,
    paddingRight: 6,
  },
  infoCellLabel: { fontSize: 5.5, color: MUTED, marginBottom: 2, fontFamily: 'Helvetica-Bold' },
  infoCellValue: { fontSize: 8, color: DARK },

  // Tabla de liberaciones
  tbl: {
    borderLeftWidth: 1,
    borderLeftColor: BORDER,
    borderTopWidth: 1,
    borderTopColor: BORDER,
    marginBottom: 4,
  },
  hdrRow:     { flexDirection: 'row', backgroundColor: PRIMARY },
  dataRow:    { flexDirection: 'row' },
  dataRowAlt: { flexDirection: 'row', backgroundColor: ROW_ALT },

  hdrCell: {
    color: WHITE,
    fontFamily: 'Helvetica-Bold',
    fontSize: 6,
    paddingTop: 4,
    paddingBottom: 4,
    paddingLeft: 3,
    paddingRight: 3,
    borderRightWidth: 1,
    borderRightColor: '#5599CC',
    borderBottomWidth: 1,
    borderBottomColor: '#5599CC',
    textAlign: 'center',
  },
  cell: {
    fontSize: 7,
    paddingTop: 4,
    paddingBottom: 4,
    paddingLeft: 3,
    paddingRight: 3,
    borderRightWidth: 1,
    borderRightColor: BORDER,
    borderBottomWidth: 1,
    borderBottomColor: BORDER,
  },
  cellCenter: {
    fontSize: 7,
    paddingTop: 4,
    paddingBottom: 4,
    paddingLeft: 3,
    paddingRight: 3,
    textAlign: 'center',
    fontFamily: 'Helvetica-Bold',
    borderRightWidth: 1,
    borderRightColor: BORDER,
    borderBottomWidth: 1,
    borderBottomColor: BORDER,
  },

  // Firma
  firmaSection: { marginTop: 24 },
  firmaRow:     { flexDirection: 'row', gap: 32 },
  firmaBox:     { flex: 1 },
  firmaLinea: {
    borderTopWidth: 1,
    borderTopColor: DARK,
    paddingTop: 4,
    marginTop: 28,
  },
  firmaLabel: { fontSize: 6.5, color: MUTED },

  // Footer fijo
  footer: {
    position: 'absolute',
    bottom: 18,
    left: 30,
    right: 30,
    flexDirection: 'row',
    justifyContent: 'space-between',
    borderTopWidth: 1,
    borderTopColor: BORDER,
    paddingTop: 3,
  },
  footerText: { fontSize: 5.5, color: '#888888' },
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

function formatObservaciones(
  horaInicio: string | null,
  horaFin: string | null,
  obs: string | null,
): string {
  const partes: string[] = []
  if (horaInicio || horaFin) {
    partes.push(`${horaInicio ?? '--:--'} - ${horaFin ?? '--:--'}`)
  }
  if (obs) partes.push(obs)
  return partes.join('\n') || '—'
}

// ── CosechaLiberacionPagina ───────────────────────────────────────────────────

export function CosechaLiberacionPagina({
  rancho, ranchoCodigo, fecha, liberaciones,
}: CosechaLiberacionPaginaProps) {
  const emision = new Date().toLocaleDateString('es-MX')

  return (
    <Page size="A4" orientation="landscape" style={s.page}>

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
          <Text style={s.headerTitle}>REGISTRO DE COSECHA Y LIBERACION</Text>
          <Text style={s.headerTitleSub}>Clave: MXA-F-SC-SIG-038.14 · FORMATOS MANUAL DEL SAIA Y BPA's</Text>
        </View>
        <View style={{ flex: 2, alignItems: 'flex-end' }}>
          <Text style={s.headerMeta}>Emision: {emision}</Text>
        </View>
      </View>

      {/* Sección 1 — Datos */}
      <Text style={s.sectionTitle}>1. DATOS DEL RANCHO Y JORNADA</Text>
      <View style={s.infoTable}>
        <View style={s.infoRow}>
          <View style={[s.infoCell, { flex: 4 }]}>
            <Text style={s.infoCellLabel}>RANCHO / HUERTO</Text>
            <Text style={s.infoCellValue}>{rancho}</Text>
          </View>
          <View style={[s.infoCell, { flex: 1 }]}>
            <Text style={s.infoCellLabel}>CODIGO</Text>
            <Text style={s.infoCellValue}>{ranchoCodigo}</Text>
          </View>
          <View style={[s.infoCell, { flex: 4 }]}>
            <Text style={s.infoCellLabel}>FECHA DE REGISTRO</Text>
            <Text style={s.infoCellValue}>{formatFechaPDF(fecha)}</Text>
          </View>
          <View style={[s.infoCell, { flex: 1 }]}>
            <Text style={s.infoCellLabel}>TOTAL LIBERACIONES</Text>
            <Text style={s.infoCellValue}>{liberaciones.length}</Text>
          </View>
        </View>
      </View>

      {/* Sección 2 — Tabla de liberaciones */}
      <Text style={s.sectionTitle}>2. REGISTRO DE LIBERACIONES</Text>
      <View style={s.tbl}>
        {/* Header de tabla */}
        <View style={s.hdrRow} fixed>
          <Text style={[s.hdrCell, { width: W.fecha }]}>Fecha</Text>
          <Text style={[s.hdrCell, { width: W.sector }]}>Sector</Text>
          <Text style={[s.hdrCell, { width: W.bandejas }]}>Cant.{'\n'}Bandejas</Text>
          <Text style={[s.hdrCell, { width: W.loteLib }]}>Lote{'\n'}Lib. S/N</Text>
          <Text style={[s.hdrCell, { width: W.comprobante }]}>No. Comprobante{'\n'}o Vale Interno</Text>
          <Text style={[s.hdrCell, { width: W.trazabilidad }]}>Codigo de{'\n'}Trazabilidad</Text>
          <Text style={[s.hdrCell, { width: W.marcaEmbalaje }]}>Marca y{'\n'}Embalaje</Text>
          <Text style={[s.hdrCell, { width: W.destino }]}>Destino{'\n'}Final</Text>
          <Text style={[s.hdrCell, { width: W.frutaKg }]}>Fruta{'\n'}Proc. Kg</Text>
          <Text style={[s.hdrCell, { width: W.encargado }]}>Encargado de la{'\n'}Liberacion</Text>
          <Text style={[s.hdrCell, { width: W.verif }]}>Verif.{'\n'}Semanal</Text>
          <Text style={[s.hdrCell, { width: W.observaciones }]}>Observaciones{'\n'}(Hora inicio y final cosecha)</Text>
        </View>

        {/* Filas */}
        {liberaciones.map((lib, i) => (
          <View key={i} style={i % 2 === 0 ? s.dataRow : s.dataRowAlt}>
            <Text style={[s.cell, { width: W.fecha, textAlign: 'center' }]}>{fecha}</Text>
            <Text style={[s.cell, { width: W.sector }]}>{lib.sector ?? '—'}</Text>
            <Text style={[s.cellCenter, { width: W.bandejas, color: DARK }]}>
              {lib.cantidad_bandejas ?? '—'}
            </Text>
            <Text
              style={[
                s.cellCenter,
                { width: W.loteLib },
                lib.lote_liberado
                  ? { backgroundColor: SI_BG, color: SI_TEXT }
                  : { backgroundColor: NO_BG, color: NO_TEXT },
              ]}
            >
              {siNo(lib.lote_liberado)}
            </Text>
            <Text style={[s.cell, { width: W.comprobante, fontSize: 6.5 }]}>
              {lib.numero_comprobante ?? '—'}
            </Text>
            <Text style={[s.cell, { width: W.trazabilidad, fontSize: 6.5 }]}>
              {lib.codigo_trazabilidad ?? '—'}
            </Text>
            <Text style={[s.cell, { width: W.marcaEmbalaje, fontSize: 6.5 }]}>
              {lib.marca_embalaje ?? '—'}
            </Text>
            <Text style={[s.cell, { width: W.destino, fontSize: 6.5 }]}>
              {lib.destino_final ?? '—'}
            </Text>
            <Text style={[s.cellCenter, { width: W.frutaKg, color: DARK }]}>
              {lib.fruta_proceso_kg != null ? lib.fruta_proceso_kg.toString() : '—'}
            </Text>
            <Text style={[s.cell, { width: W.encargado, fontSize: 6.5 }]}>
              {lib.encargado_nombre ?? '—'}
            </Text>
            <Text
              style={[
                s.cellCenter,
                { width: W.verif },
                lib.verificacion_semanal
                  ? { backgroundColor: SI_BG, color: SI_TEXT }
                  : { backgroundColor: NO_BG, color: NO_TEXT },
              ]}
            >
              {siNo(lib.verificacion_semanal)}
            </Text>
            <Text style={[s.cell, { width: W.observaciones, fontSize: 6.5 }]}>
              {formatObservaciones(lib.hora_inicio_cosecha, lib.hora_fin_cosecha, lib.observaciones)}
            </Text>
          </View>
        ))}
      </View>

      {/* Sección 3 — Firma */}
      <Text style={[s.sectionTitle, { marginTop: 16 }]}>3. FIRMA Y RESPONSABLE</Text>
      <View style={s.firmaSection}>
        <View style={s.firmaRow}>
          <View style={s.firmaBox}>
            <Text style={s.firmaLabel}>&nbsp;</Text>
            <View style={s.firmaLinea}>
              <Text style={s.firmaLabel}>Responsable de Inocuidad — Firma</Text>
            </View>
          </View>
          <View style={[s.firmaBox, { flex: 2 }]} />
        </View>
      </View>

    </Page>
  )
}

// ── PDF individual ─────────────────────────────────────────────────────────────

export function CosechaLiberacionPDF(props: CosechaLiberacionPaginaProps) {
  return (
    <Document
      title={`Cosecha y Liberacion ${props.rancho} ${props.fecha}`}
      author="M.A.D.Y"
      subject="Registro de Cosecha y Liberacion"
    >
      <CosechaLiberacionPagina {...props} />
    </Document>
  )
}

// ── PDF consolidado ────────────────────────────────────────────────────────────

export function CosechaLiberacionConsolidadoPDF({
  registros, ranchoNombre, desde, hasta,
}: CosechaLiberacionConsolidadoPDFProps) {
  return (
    <Document
      title={`Cosecha Liberacion Consolidado ${ranchoNombre} ${desde} ${hasta}`}
      author="M.A.D.Y"
      subject="Registro Consolidado de Cosecha y Liberacion"
    >
      {registros.map((reg, i) => (
        <CosechaLiberacionPagina key={i} {...reg} />
      ))}
    </Document>
  )
}
