// PATRÓN INOCUIDAD — PDF M13 (plantilla homogénea M.A.D.Y)
// Reporte visual con fotos: tabla dos columnas EVIDENCIA | INCIDENCIAS, A4 portrait.
// Las fotos se reciben como data URIs base64 (ya descargadas y re-comprimidas).
// Helvetica built-in, sin Unicode, firma en blanco.

import { Document, Page, View, Text, Image, StyleSheet } from '@react-pdf/renderer'
import { TopBar, PdfFooter } from '@/lib/pdf/components/PdfPage'
import { LOGO_MADY_PDF } from '@/lib/pdf/assets/logoMadyPdf'
import { PC } from '@/lib/pdf/components/tokens'

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
  codigoClave?: string
  terminoSitio?: string
}

// Ancho columna izquierda ~40%, derecha ~60% (sobre 515pt usables en A4 portrait con padding 40)
const COL_EVIDENCIA  = 206
const COL_INCIDENCIA = 309
const FOTO_MAX_H     = 130    // altura maxima por foto embebida (pt)

// ── Estilos ───────────────────────────────────────────────────────────────────

const s = StyleSheet.create({
  page: {
    fontFamily: 'Helvetica',
    fontSize: 9,
    color: PC.fieldValue,
    paddingTop: 84,
    paddingBottom: 55,
    paddingLeft: 40,
    paddingRight: 40,
    backgroundColor: PC.white,
  },

  // ── Tabla principal ────────────────────────────────────────────────────────
  table: {
    borderLeftWidth: 1,
    borderLeftColor: PC.border,
    borderTopWidth: 1,
    borderTopColor: PC.border,
    marginBottom: 16,
  },
  tblHdrRow: {
    flexDirection: 'row',
    backgroundColor: PC.section,
  },
  tblHdrCell: {
    color: PC.white,
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
    borderRightColor: PC.border,
    borderBottomWidth: 1,
    borderBottomColor: PC.border,
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
    borderRightColor: PC.border,
    borderBottomWidth: 1,
    borderBottomColor: PC.border,
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
    borderColor: PC.border,
  },
  numIncidencia: {
    fontSize: 7,
    color: PC.textSub,
    fontFamily: 'Helvetica-Bold',
    marginBottom: 4,
  },
  descripcion: {
    fontSize: 9,
    color: PC.fieldValue,
    lineHeight: 1.4,
  },

  // ── Firma ──────────────────────────────────────────────────────────────────
  firmaSection: { marginTop: 24 },
  firmaLinea: {
    borderTopWidth: 1,
    borderTopColor: PC.fieldValue,
    paddingTop: 4,
    marginTop: 32,
    width: '50%',
  },
  firmaLabel: { fontSize: 7, color: PC.textSub },
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
  codigoClave = 'MXA',
  terminoSitio = 'Rancho',
}: ReporteIncidenciasPDFProps) {
  const fechaFormateada = formatFechaPDF(fecha)
  const codigoFmt = `${codigoClave}-F-SC-SIG`

  return (
    <Page size="A4" style={s.page}>

      {/* Encabezado fijo — se repite en cada pagina */}
      <View fixed style={{ position: 'absolute', top: 0, left: 0, right: 0, backgroundColor: PC.white }}>
        <TopBar />
        <View style={{ flexDirection: 'row', alignItems: 'center', paddingTop: 6, paddingBottom: 6, paddingLeft: 40, paddingRight: 40 }}>
          <View style={{ flex: 6 }}>
            <Text style={{ fontFamily: 'Helvetica-Bold', fontSize: 11, color: PC.titleNavy }}>
              REPORTE DE INCIDENCIAS
            </Text>
            <Text style={{ fontSize: 7, color: PC.textSub, marginTop: 2 }}>
              Reporte visual · {terminoSitio}: {rancho}{ranchoCodigo ? ` (${ranchoCodigo})` : ''}
            </Text>
          </View>
          <View style={{ flex: 4, alignItems: 'flex-end' }}>
            <Image src={LOGO_MADY_PDF} style={{ height: 36, width: 101 }} />
          </View>
        </View>
        <View style={{ borderTopWidth: 1, borderTopColor: PC.border, flexDirection: 'row', gap: 20, paddingTop: 3, paddingBottom: 4, paddingLeft: 40, paddingRight: 40 }}>
          <Text style={{ fontSize: 7, color: PC.textSub }}>
            Realizo el recorrido: {auditorNombre ?? '—'}
          </Text>
          <Text style={{ fontSize: 7, color: PC.textSub }}>Folio: {folio}</Text>
          <Text style={{ fontSize: 7, color: PC.textSub }}>Fecha: {fechaFormateada}</Text>
          <Text style={{ fontSize: 7, color: PC.textSub }}>Codigo: {codigoFmt}</Text>
        </View>
      </View>

      <PdfFooter moduloCodigo="M13" />

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
      title={`Reporte de Incidencias ${props.fecha}`}
      author="M.A.D.Y."
      creator="M.A.D.Y. Inocuidad Inteligente"
      producer="M.A.D.Y. Inocuidad Inteligente"
      subject={`Reporte de Incidencias — ${props.rancho}`}
      keywords="MADY, inocuidad, incidencias, reporte"
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
      author="M.A.D.Y."
      creator="M.A.D.Y. Inocuidad Inteligente"
      producer="M.A.D.Y. Inocuidad Inteligente"
      subject="Reporte Consolidado de Incidencias"
      keywords="MADY, inocuidad, incidencias, consolidado"
    >
      {reportes.map((r, i) => (
        <ReporteIncidenciasPagina key={i} {...r} />
      ))}
    </Document>
  )
}
