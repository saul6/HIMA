// PDF M20 — Registro de Accidentes Laborales (Cuarto Frio)
// Formato F-FRUS-CAL-15 Rev 01. A4 portrait. Helvetica.
// No Unicode: checklist (X) / ( ). Dos firmas en blanco.

import { Document, Page, View, Text, Image, StyleSheet } from '@react-pdf/renderer'
import { MadyLogoPDF } from '@/lib/pdf/MadyLogoPDF'
import { codigoFormato } from '@/lib/codigoFormato'

// ── Constantes ────────────────────────────────────────────────────────────────

export const ATENCIONES_OPCIONES = [
  'Ninguna',
  'Curacion',
  'Primeros auxilios',
  'Atencion de paramedicos',
  'Atencion medica',
  'Hospitalizacion',
]

// ── Tipos ─────────────────────────────────────────────────────────────────────

export interface AccidenteLaboralPaginaProps {
  folio: string
  instalacion: string
  instalacionCodigo: string
  fecha: string                   // YYYY-MM-DD
  trabajadorNombre: string
  descripcionIncidente: string
  atencionRecibida: string[]      // etiquetas como vienen del DB (con acentos)
  requirioIncapacidad: boolean
  incapacidadMotivo: string | null
  codigoClave: string
  requirioLimpieza: boolean
  limpiezaDescripcion: string | null
  productoInvolucrado: boolean
  disposicionProducto: string | null
  dataUris: string[]              // data URIs base64, puede ser vacío
}

export interface AccidenteLaboralConsolidadoPDFProps {
  registros: AccidenteLaboralPaginaProps[]
  instalacionNombre: string
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

const FOTO_COL = 2  // fotos por fila en la cuadricula

// ── Estilos ───────────────────────────────────────────────────────────────────

const s = StyleSheet.create({
  page: {
    fontFamily: 'Helvetica',
    fontSize: 9,
    color: DARK,
    paddingTop: 50,
    paddingBottom: 55,
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
  headerLogoSub: { fontSize: 7, color: MUTED, marginTop: 2 },
  headerCenter: { flex: 1, alignItems: 'center' },
  headerTitle: { fontSize: 10, fontFamily: 'Helvetica-Bold', color: DARK, textAlign: 'center' },
  headerSub:   { fontSize: 7, color: MUTED, textAlign: 'center', marginTop: 2 },
  headerRight: { alignItems: 'flex-end' },
  headerMeta:  { fontSize: 7, color: MUTED, textAlign: 'right' },

  // Sección bar
  sectionBar: {
    backgroundColor: PRIMARY,
    color: WHITE,
    fontFamily: 'Helvetica-Bold',
    fontSize: 8,
    paddingTop: 4,
    paddingBottom: 4,
    paddingLeft: 8,
    marginTop: 10,
    marginBottom: 0,
  },

  // Info table
  infoTable: {
    borderLeftWidth: 1,
    borderLeftColor: BORDER,
    borderTopWidth: 1,
    borderTopColor: BORDER,
    marginBottom: 0,
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

  // Bloque de descripcion
  descBlock: {
    borderLeftWidth: 1,
    borderLeftColor: BORDER,
    borderRightWidth: 1,
    borderRightColor: BORDER,
    borderBottomWidth: 1,
    borderBottomColor: BORDER,
    paddingTop: 6,
    paddingBottom: 6,
    paddingLeft: 8,
    paddingRight: 8,
    minHeight: 48,
  },
  descText: { fontSize: 9, color: DARK, lineHeight: 1.45 },

  // Checklist atenciones
  checkList: {
    borderLeftWidth: 1,
    borderLeftColor: BORDER,
    borderRightWidth: 1,
    borderRightColor: BORDER,
    borderBottomWidth: 1,
    borderBottomColor: BORDER,
    paddingTop: 6,
    paddingBottom: 6,
    paddingLeft: 8,
    paddingRight: 8,
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 4,
  },
  checkItem: {
    width: '47%',
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    paddingVertical: 2,
  },
  checkMark: { fontSize: 9, fontFamily: 'Helvetica-Bold', color: DARK, width: 14 },
  checkLabel: { fontSize: 9, color: DARK },

  // Bloque Si/No + detalle
  boolRow: {
    flexDirection: 'row',
    borderLeftWidth: 1,
    borderLeftColor: BORDER,
    borderRightWidth: 1,
    borderRightColor: BORDER,
    borderBottomWidth: 1,
    borderBottomColor: BORDER,
  },
  boolChip: {
    paddingTop: 5,
    paddingBottom: 5,
    paddingLeft: 10,
    paddingRight: 10,
    fontFamily: 'Helvetica-Bold',
    fontSize: 9,
    justifyContent: 'center',
    alignItems: 'center',
    borderRightWidth: 1,
    borderRightColor: BORDER,
    width: 40,
    textAlign: 'center',
  },
  boolDetail: {
    flex: 1,
    paddingTop: 5,
    paddingBottom: 5,
    paddingLeft: 8,
    paddingRight: 8,
    fontSize: 9,
    color: DARK,
    minHeight: 28,
  },

  // Fotos cuadricula
  fotosGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 6,
    borderLeftWidth: 1,
    borderLeftColor: BORDER,
    borderRightWidth: 1,
    borderRightColor: BORDER,
    borderBottomWidth: 1,
    borderBottomColor: BORDER,
    paddingTop: 6,
    paddingBottom: 6,
    paddingLeft: 6,
    paddingRight: 6,
  },
  fotoItem: {
    width: '48%',
    height: 120,
  },
  fotoImg: {
    width: '100%',
    height: '100%',
    objectFit: 'contain',
  },
  fotoPlaceholder: {
    width: '100%',
    height: '100%',
    backgroundColor: '#F0F0F0',
    borderWidth: 1,
    borderColor: BORDER,
  },

  // Firmas — dos columnas
  firmasSection: { marginTop: 24 },
  firmasRow: { flexDirection: 'row', gap: 24 },
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
    paddingTop: 3,
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

// Normaliza la cadena para comparar sin acentos/tildes
function normalizar(s: string): string {
  return s.normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase()
}

function estaSeleccionada(opcion: string, seleccionadas: string[]): boolean {
  const n = normalizar(opcion)
  return seleccionadas.some((s) => normalizar(s) === n)
}

// ── Componente de página ──────────────────────────────────────────────────────

export function AccidenteLaboralPagina({
  folio,
  instalacion,
  instalacionCodigo,
  fecha,
  trabajadorNombre,
  descripcionIncidente,
  atencionRecibida,
  requirioIncapacidad,
  incapacidadMotivo,
  codigoClave,
  requirioLimpieza,
  limpiezaDescripcion,
  productoInvolucrado,
  disposicionProducto,
  dataUris,
}: AccidenteLaboralPaginaProps) {
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
          <MadyLogoPDF style={{ fontSize: 11, fontFamily: 'Helvetica-Bold', color: PRIMARY }} />
          <Text style={s.headerLogoSub}>Inocuidad Alimentaria</Text>
        </View>
        <View style={s.headerCenter}>
          <Text style={s.headerTitle}>REGISTRO DE ACCIDENTES LABORALES</Text>
          <Text style={s.headerSub}>{codigoFormato('F-FRUS-CAL-15', codigoClave)}  Rev. 01</Text>
        </View>
        <View style={{ flex: 2, alignItems: 'flex-end' }}>
          <Text style={s.headerMeta}>Emision: {emision}</Text>
          <Text style={s.headerMeta}>Folio: {folio}</Text>
        </View>
      </View>

      {/* Seccion 1 — Datos generales */}
      <Text style={s.sectionBar}>1. DATOS GENERALES</Text>
      <View style={s.infoTable}>
        <View style={s.infoRow}>
          <View style={[s.infoCell, { flex: 3 }]}>
            <Text style={s.infoCellLabel}>INSTALACION</Text>
            <Text style={s.infoCellValue}>{instalacion}</Text>
          </View>
          <View style={s.infoCell}>
            <Text style={s.infoCellLabel}>CODIGO</Text>
            <Text style={s.infoCellValue}>{instalacionCodigo}</Text>
          </View>
          <View style={[s.infoCell, { flex: 3 }]}>
            <Text style={s.infoCellLabel}>FECHA DEL ACCIDENTE</Text>
            <Text style={s.infoCellValue}>{formatFechaPDF(fecha)}</Text>
          </View>
        </View>
        <View style={s.infoRow}>
          <View style={[s.infoCell, { flex: 1 }]}>
            <Text style={s.infoCellLabel}>NOMBRE DEL TRABAJADOR</Text>
            <Text style={s.infoCellValue}>{trabajadorNombre || '—'}</Text>
          </View>
        </View>
      </View>

      {/* Seccion 2 — Descripcion del incidente */}
      <Text style={s.sectionBar}>2. DESCRIPCION DEL INCIDENTE</Text>
      <View style={s.descBlock}>
        <Text style={s.descText}>{descripcionIncidente || '—'}</Text>
      </View>

      {/* Seccion 3 — Atencion recibida */}
      <Text style={s.sectionBar}>3. ATENCION RECIBIDA</Text>
      <View style={s.checkList}>
        {ATENCIONES_OPCIONES.map((op) => {
          const sel = estaSeleccionada(op, atencionRecibida)
          return (
            <View key={op} style={s.checkItem}>
              <Text style={s.checkMark}>{sel ? '(X)' : '( )'}</Text>
              <Text style={s.checkLabel}>{op}</Text>
            </View>
          )
        })}
      </View>

      {/* Seccion 4 — Incapacidad */}
      <Text style={s.sectionBar}>4. REQUIRIO INCAPACIDAD</Text>
      <View style={s.boolRow}>
        <Text
          style={[
            s.boolChip,
            requirioIncapacidad
              ? { backgroundColor: SI_BG, color: SI_TEXT }
              : { backgroundColor: NO_BG, color: NO_TEXT },
          ]}
        >
          {requirioIncapacidad ? 'Si' : 'No'}
        </Text>
        <Text style={s.boolDetail}>
          {requirioIncapacidad && incapacidadMotivo ? incapacidadMotivo : ''}
        </Text>
      </View>

      {/* Seccion 5 — Limpieza del area */}
      <Text style={s.sectionBar}>5. REQUIRIO LIMPIEZA DEL AREA</Text>
      <View style={s.boolRow}>
        <Text
          style={[
            s.boolChip,
            requirioLimpieza
              ? { backgroundColor: SI_BG, color: SI_TEXT }
              : { backgroundColor: NO_BG, color: NO_TEXT },
          ]}
        >
          {requirioLimpieza ? 'Si' : 'No'}
        </Text>
        <Text style={s.boolDetail}>
          {requirioLimpieza && limpiezaDescripcion ? limpiezaDescripcion : ''}
        </Text>
      </View>

      {/* Seccion 6 — Producto involucrado */}
      <Text style={s.sectionBar}>6. PRODUCTO INVOLUCRADO</Text>
      <View style={s.boolRow}>
        <Text
          style={[
            s.boolChip,
            productoInvolucrado
              ? { backgroundColor: SI_BG, color: SI_TEXT }
              : { backgroundColor: NO_BG, color: NO_TEXT },
          ]}
        >
          {productoInvolucrado ? 'Si' : 'No'}
        </Text>
        <Text style={s.boolDetail}>
          {productoInvolucrado && disposicionProducto
            ? `Disposicion: ${disposicionProducto}`
            : ''}
        </Text>
      </View>

      {/* Seccion 7 — Evidencia fotografica (opcional) */}
      {dataUris.length > 0 && (
        <>
          <Text style={s.sectionBar}>7. EVIDENCIA FOTOGRAFICA</Text>
          <View style={s.fotosGrid}>
            {dataUris.map((uri, i) => (
              <View key={i} style={[s.fotoItem, { width: `${Math.floor(100 / FOTO_COL) - 2}%` }]}>
                {uri ? (
                  <Image src={uri} style={s.fotoImg} />
                ) : (
                  <View style={s.fotoPlaceholder} />
                )}
              </View>
            ))}
          </View>
        </>
      )}

      {/* Seccion de firmas */}
      <View style={s.firmasSection}>
        <View style={s.firmasRow}>
          <View style={s.firmaBox}>
            <Text style={s.firmaLabel}>Jefe de Seguridad</Text>
            <View style={s.firmaLinea}>
              <Text style={s.firmaLabel}>Firma del Jefe de Seguridad</Text>
            </View>
          </View>
          <View style={s.firmaBox}>
            <Text style={s.firmaLabel}>Jefe del Cooler</Text>
            <View style={s.firmaLinea}>
              <Text style={s.firmaLabel}>Firma del Jefe del Cooler</Text>
            </View>
          </View>
        </View>
      </View>

    </Page>
  )
}

// ── PDF individual ─────────────────────────────────────────────────────────────

export function AccidenteLaboralPDF(props: AccidenteLaboralPaginaProps) {
  return (
    <Document
      title={`Accidente Laboral ${props.instalacion} ${props.fecha}`}
      author="M.A.D.Y"
      subject="Registro de Accidentes Laborales"
    >
      <AccidenteLaboralPagina {...props} />
    </Document>
  )
}

// ── PDF consolidado ────────────────────────────────────────────────────────────

export function AccidenteLaboralConsolidadoPDF({
  registros,
  instalacionNombre,
  desde,
  hasta,
}: AccidenteLaboralConsolidadoPDFProps) {
  return (
    <Document
      title={`Accidentes Laborales Consolidado ${instalacionNombre} ${desde} ${hasta}`}
      author="M.A.D.Y"
      subject="Registro de Accidentes Laborales Consolidado"
    >
      {registros.map((r, i) => (
        <AccidenteLaboralPagina key={i} {...r} />
      ))}
    </Document>
  )
}
