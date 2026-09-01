// PDF M13 — Reporte de Incidencias
// Formato oficial: tabla dos columnas EVIDENCIA | INCIDENCIAS, A4 portrait.
// Las fotos se reciben como data URIs base64 (ya descargadas y re-comprimidas).
// Helvetica built-in, sin Unicode, firma en blanco.

import { Document, Page, View, Text, Image, StyleSheet } from '@react-pdf/renderer'
import { MadyLogoPDF } from '@/lib/pdf/MadyLogoPDF'

// ── Tipos ─────────────────────────────────────────────────────────────────────

export interface IncidenciaPDFRow {
  orden: number
  descripcion: string
  dataUris: string[]  // data URIs base64; '' = foto que fallo (celda en blanco)
}

export interface ReporteIncidenciasPDFProps {
  folio: string
  rancho: string
  ranchoCodigo: string
  fecha: string
  auditorNombre: string | null
  incidencias: IncidenciaPDFRow[]
}

// ── Paleta (mismos valores que M12) ──────────────────────────────────────────

const PRIMARY   = '#2B7AB5'
const DARK      = '#1A1A1A'
const BORDER    = '#CCCCCC'
const WHITE     = '#FFFFFF'
const MUTED     = '#555555'
const HDR_BG    = '#E8EEF4'   // franja gris-azul del encabezado oficial
const COL_HDR   = '#3A3A3A'   // texto columna header

// Ancho columna izquierda ~40%, derecha ~60% (sobre 515pt usables en A4)
const COL_EVIDENCIA  = 206
const COL_INCIDENCIA = 309
const FOTO_MAX_H     = 110    // altura maxima por foto embebida (pt)

// ── Estilos ───────────────────────────────────────────────────────────────────

const s = StyleSheet.create({
  page: {
    fontFamily: 'Helvetica',
    fontSize: 9,
    color: DARK,
    // paddingTop para dejar espacio al encabezado fijo (~80pt)
    paddingTop: 82,
    paddingBottom: 55,
    paddingLeft: 40,
    paddingRight: 40,
  },

  // ── Encabezado fijo (position absolute, se repite en cada pagina) ──────────
  pageHeader: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    backgroundColor: HDR_BG,
    paddingLeft: 40,
    paddingRight: 40,
    paddingTop: 8,
    paddingBottom: 6,
  },
  hdrRow1: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 4,
  },
  hdrTitleBlock: { flex: 1 },
  hdrTitle: {
    fontSize: 11,
    fontFamily: 'Helvetica-Bold',
    color: DARK,
  },
  hdrRight: { alignItems: 'flex-end' },
  hdrLogo: { fontSize: 10, fontFamily: 'Helvetica-Bold' },
  hdrFecha: { fontSize: 7, color: MUTED, marginTop: 2 },

  hdrDivider: {
    borderBottomWidth: 1,
    borderBottomColor: BORDER,
    marginBottom: 4,
  },
  hdrRow2: {
    flexDirection: 'row',
    gap: 24,
  },
  hdrMeta: { fontSize: 7, color: COL_HDR },
  hdrMetaLabel: { fontFamily: 'Helvetica-Bold' },

  // ── Tabla principal ────────────────────────────────────────────────────────
  table: {
    borderLeftWidth: 1,
    borderLeftColor: BORDER,
    borderTopWidth: 1,
    borderTopColor: BORDER,
    marginBottom: 16,
  },
  tblHdrRow: {
    flexDirection: 'row',
    backgroundColor: PRIMARY,
  },
  tblHdrCell: {
    color: WHITE,
    fontFamily: 'Helvetica-Bold',
    fontSize: 8,
    paddingTop: 5,
    paddingBottom: 5,
    paddingLeft: 6,
    paddingRight: 6,
    borderRightWidth: 1,
    borderRightColor: '#5599CC',
    borderBottomWidth: 1,
    borderBottomColor: '#5599CC',
    textAlign: 'center',
  },
  tblRow: {
    flexDirection: 'row',
  },
  cellEvidencia: {
    width: COL_EVIDENCIA,
    borderRightWidth: 1,
    borderRightColor: BORDER,
    borderBottomWidth: 1,
    borderBottomColor: BORDER,
    paddingTop: 6,
    paddingBottom: 6,
    paddingLeft: 6,
    paddingRight: 6,
    alignItems: 'center',
    gap: 4,
  },
  cellIncidencia: {
    width: COL_INCIDENCIA,
    borderRightWidth: 1,
    borderRightColor: BORDER,
    borderBottomWidth: 1,
    borderBottomColor: BORDER,
    paddingTop: 8,
    paddingBottom: 8,
    paddingLeft: 8,
    paddingRight: 8,
    justifyContent: 'center',
  },
  foto: {
    width: COL_EVIDENCIA - 12,
    height: FOTO_MAX_H,
    objectFit: 'contain',
  },
  fotoPlaceholder: {
    width: COL_EVIDENCIA - 12,
    height: FOTO_MAX_H,
    backgroundColor: '#F0F0F0',
    borderWidth: 1,
    borderColor: BORDER,
  },
  numIncidencia: {
    fontSize: 7,
    color: MUTED,
    fontFamily: 'Helvetica-Bold',
    marginBottom: 4,
  },
  descripcion: {
    fontSize: 9,
    color: DARK,
    lineHeight: 1.4,
  },

  // ── Firma ──────────────────────────────────────────────────────────────────
  firmaSection: { marginTop: 24 },
  firmaLinea: {
    borderTopWidth: 1,
    borderTopColor: DARK,
    paddingTop: 4,
    marginTop: 32,
    width: '50%',
  },
  firmaLabel: { fontSize: 7, color: MUTED },

  // ── Footer fijo ────────────────────────────────────────────────────────────
  footer: {
    position: 'absolute',
    bottom: 20,
    left: 40,
    right: 40,
    flexDirection: 'row',
    justifyContent: 'space-between',
    borderTopWidth: 1,
    borderTopColor: BORDER,
    paddingTop: 3,
  },
  footerText: { fontSize: 6, color: '#888888' },
})

// ── Helpers ───────────────────────────────────────────────────────────────────

function formatFechaPDF(iso: string): string {
  try {
    return new Date(iso + 'T12:00:00').toLocaleDateString('es-MX', {
      day: '2-digit', month: 'short', year: 'numeric',
    })
  } catch { return iso }
}

// ── Componente de pagina ──────────────────────────────────────────────────────

export function ReporteIncidenciasPagina({
  folio,
  rancho,
  ranchoCodigo,
  fecha,
  auditorNombre,
  incidencias,
}: ReporteIncidenciasPDFProps) {
  const fechaFormateada = formatFechaPDF(fecha)

  return (
    <Page size="A4" style={s.page}>

      {/* Encabezado fijo — se repite en cada pagina */}
      <View fixed style={s.pageHeader}>
        <View style={s.hdrRow1}>
          <View style={s.hdrTitleBlock}>
            <Text style={s.hdrTitle}>REPORTE DE INCIDENCIAS</Text>
          </View>
          <View style={s.hdrRight}>
            <MadyLogoPDF style={s.hdrLogo} />
            <Text style={s.hdrFecha}>{fechaFormateada}</Text>
          </View>
        </View>
        <View style={s.hdrDivider} />
        <View style={s.hdrRow2}>
          <Text style={s.hdrMeta}>
            <Text style={s.hdrMetaLabel}>Rancho: </Text>
            {rancho}
            {ranchoCodigo && ranchoCodigo !== '—' ? `  (${ranchoCodigo})` : ''}
          </Text>
          <Text style={s.hdrMeta}>
            <Text style={s.hdrMetaLabel}>Realizo el recorrido: </Text>
            {auditorNombre ?? '—'}
          </Text>
          <Text style={s.hdrMeta}>
            <Text style={s.hdrMetaLabel}>Folio: </Text>
            {folio}
          </Text>
        </View>
      </View>

      {/* Footer fijo */}
      <View fixed style={s.footer}>
        <Text style={s.footerText}>M.A.D.Y · Inocuidad Inteligente</Text>
        <Text
          style={s.footerText}
          render={({ pageNumber, totalPages }) => `Pagina ${pageNumber} de ${totalPages}`}
        />
      </View>

      {/* Tabla EVIDENCIA | INCIDENCIAS */}
      <View style={s.table}>
        {/* Header de tabla */}
        <View style={s.tblHdrRow}>
          <Text style={[s.tblHdrCell, { width: COL_EVIDENCIA }]}>EVIDENCIA</Text>
          <Text style={[s.tblHdrCell, { width: COL_INCIDENCIA }]}>INCIDENCIAS</Text>
        </View>

        {/* Filas de incidencias */}
        {incidencias.map((inc) => (
          <View key={inc.orden} style={s.tblRow} wrap={false}>
            {/* Columna izquierda: fotos */}
            <View style={s.cellEvidencia}>
              {inc.dataUris.length === 0 ? (
                <View style={s.fotoPlaceholder} />
              ) : (
                inc.dataUris.map((uri, i) =>
                  uri ? (
                    <Image key={i} src={uri} style={s.foto} />
                  ) : (
                    <View key={i} style={s.fotoPlaceholder} />
                  )
                )
              )}
            </View>

            {/* Columna derecha: descripcion */}
            <View style={s.cellIncidencia}>
              <Text style={s.numIncidencia}>Incidencia {inc.orden}</Text>
              <Text style={s.descripcion}>{inc.descripcion}</Text>
            </View>
          </View>
        ))}
      </View>

      {/* Firma en blanco — nunca se rellena */}
      <View style={s.firmaSection}>
        <View style={s.firmaLinea}>
          <Text style={s.firmaLabel}>Responsable de Inocuidad - Firma</Text>
        </View>
      </View>

    </Page>
  )
}

// ── Documento individual ───────────────────────────────────────────────────────

export function ReporteIncidenciasPDF(props: ReporteIncidenciasPDFProps) {
  return (
    <Document
      title={`Reporte de Incidencias ${props.rancho} ${props.fecha}`}
      author="M.A.D.Y"
      subject="Reporte de Incidencias"
    >
      <ReporteIncidenciasPagina {...props} />
    </Document>
  )
}

// ── Documento consolidado (multiples reportes) ────────────────────────────────

export function ReporteIncidenciasConsolidadoPDF({
  reportes,
}: {
  reportes: ReporteIncidenciasPDFProps[]
}) {
  return (
    <Document
      title="Reporte de Incidencias Consolidado"
      author="M.A.D.Y"
      subject="Reporte de Incidencias Consolidado"
    >
      {reportes.map((r, i) => (
        <ReporteIncidenciasPagina key={i} {...r} />
      ))}
    </Document>
  )
}
