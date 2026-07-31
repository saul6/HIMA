// PDF M21 — Revisión de Estaciones de Monitoreo de Plagas (Cuarto Frío)
// Formato F-FRUS-CAL-19 Rev 01. A4 landscape. Helvetica.
// No Unicode: sin checkmarks. Acentos/ñ permitidos. Una firma en blanco.

import { Document, Page, View, Text, StyleSheet } from '@react-pdf/renderer'
import { MadyLogoPDF } from '@/lib/pdf/MadyLogoPDF'

// ── Tipos ─────────────────────────────────────────────────────────────────────

export interface CatalogoCodigo {
  codigo: string
  label: string
}

export interface EstacionResultadoPDF {
  numero: string
  // Para cebo / interior / mecanica
  tipo_consumo?: string | null
  estado_trampa?: string | null   // código
  condiciones?: string | null     // código
  senalizacion?: string | null
  // Para luz
  estado_equipo?: string | null
  estado_lampara?: string | null
  plaga_detectada?: string[]      // códigos
  tiene_hallazgo: boolean
}

export interface GrupoEstacionesPDF {
  tipo_trampa: 'cebo' | 'interior' | 'mecanica' | 'luz'
  label: string
  estaciones: EstacionResultadoPDF[]
}

export interface MonitoreoEstacionesPaginaProps {
  folio: string
  instalacion: string
  instalacionCodigo: string
  fecha: string
  inspector: string | null
  observaciones: string | null
  grupos: GrupoEstacionesPDF[]
  catalogoEstado: CatalogoCodigo[]
  catalogoCondiciones: CatalogoCodigo[]
  catalogoPlagas: CatalogoCodigo[]
}

export interface MonitoreoEstacionesConsolidadoPDFProps {
  revisiones: MonitoreoEstacionesPaginaProps[]
  instalacionNombre: string
  desde: string
  hasta: string
}

// ── Paleta ────────────────────────────────────────────────────────────────────

const PRIMARY       = '#2B7AB5'
const DARK          = '#1A1A1A'
const BORDER        = '#CCCCCC'
const WHITE         = '#FFFFFF'
const MUTED         = '#555555'
const HEADER_BG     = '#E8F0F8'
const HALLAZGO_BG   = '#FAECE7'
const HALLAZGO_TEXT = '#993C1D'

// ── Estilos ───────────────────────────────────────────────────────────────────

const s = StyleSheet.create({
  page: {
    fontFamily: 'Helvetica',
    fontSize: 8,
    color: DARK,
    paddingTop: 40,
    paddingBottom: 55,
    paddingLeft: 36,
    paddingRight: 36,
  },

  // Header
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 10,
    borderBottomWidth: 2,
    borderBottomColor: PRIMARY,
    paddingBottom: 6,
  },
  headerLogoSub: { fontSize: 7, color: MUTED, marginTop: 2 },
  headerCenter: { flex: 1, alignItems: 'center' },
  headerTitle: { fontSize: 9, fontFamily: 'Helvetica-Bold', color: DARK, textAlign: 'center' },
  headerSub:   { fontSize: 7, color: MUTED, textAlign: 'center', marginTop: 2 },
  headerRight: { alignItems: 'flex-end' },
  headerMeta:  { fontSize: 7, color: MUTED, textAlign: 'right' },

  // Datos generales
  infoTable: {
    borderLeftWidth: 1,
    borderLeftColor: BORDER,
    borderTopWidth: 1,
    borderTopColor: BORDER,
    marginBottom: 0,
  },
  infoRow: { flexDirection: 'row' },
  infoCell: {
    borderRightWidth: 1,
    borderRightColor: BORDER,
    borderBottomWidth: 1,
    borderBottomColor: BORDER,
    paddingTop: 4,
    paddingBottom: 4,
    paddingLeft: 6,
    paddingRight: 6,
  },
  infoCellLabel: { fontSize: 6, color: MUTED, marginBottom: 2, fontFamily: 'Helvetica-Bold' },
  infoCellValue: { fontSize: 8, color: DARK },

  // Sección bar
  sectionBar: {
    backgroundColor: PRIMARY,
    color: WHITE,
    fontFamily: 'Helvetica-Bold',
    fontSize: 7,
    paddingTop: 3,
    paddingBottom: 3,
    paddingLeft: 6,
    marginTop: 8,
    marginBottom: 0,
  },
  sectionBarSmall: {
    backgroundColor: MUTED,
    color: WHITE,
    fontFamily: 'Helvetica-Bold',
    fontSize: 6.5,
    paddingTop: 2,
    paddingBottom: 2,
    paddingLeft: 6,
    marginTop: 6,
    marginBottom: 0,
  },

  // Encabezado de tabla
  tableHeader: {
    flexDirection: 'row',
    backgroundColor: HEADER_BG,
    borderLeftWidth: 1,
    borderLeftColor: BORDER,
    borderTopWidth: 1,
    borderTopColor: BORDER,
  },
  thCell: {
    borderRightWidth: 1,
    borderRightColor: BORDER,
    paddingTop: 4,
    paddingBottom: 4,
    paddingLeft: 5,
    paddingRight: 5,
    fontFamily: 'Helvetica-Bold',
    fontSize: 7,
    color: DARK,
  },

  // Filas de datos
  tableRow: {
    flexDirection: 'row',
    borderLeftWidth: 1,
    borderLeftColor: BORDER,
    borderBottomWidth: 1,
    borderBottomColor: BORDER,
  },
  tableRowAlt: { backgroundColor: '#F9FAFB' },
  tdCell: {
    borderRightWidth: 1,
    borderRightColor: BORDER,
    paddingTop: 3,
    paddingBottom: 3,
    paddingLeft: 5,
    paddingRight: 5,
    fontSize: 7,
    color: DARK,
  },
  tdCellHallazgo: {
    backgroundColor: HALLAZGO_BG,
    color: HALLAZGO_TEXT,
    fontFamily: 'Helvetica-Bold',
  },
  tdEmpty: {
    fontFamily: 'Helvetica',
    fontSize: 7,
    color: MUTED,
    fontStyle: 'italic',
  },

  // Observaciones
  obsBlock: {
    borderLeftWidth: 1,
    borderLeftColor: BORDER,
    borderRightWidth: 1,
    borderRightColor: BORDER,
    borderBottomWidth: 1,
    borderBottomColor: BORDER,
    paddingTop: 5,
    paddingBottom: 5,
    paddingLeft: 6,
    paddingRight: 6,
    minHeight: 28,
  },
  obsText: { fontSize: 8, color: DARK, lineHeight: 1.4 },

  // Leyendas
  leyendaRow: { flexDirection: 'row', gap: 12, marginTop: 4 },
  leyendaText: { fontSize: 6.5, color: MUTED, flex: 1 },

  // Firma
  firmaSection: { marginTop: 16, alignItems: 'center' },
  firmaLinea: {
    borderTopWidth: 1,
    borderTopColor: DARK,
    paddingTop: 4,
    marginTop: 32,
    width: 220,
    alignItems: 'center',
  },
  firmaLabel: { fontSize: 7, color: MUTED, textAlign: 'center' },

  // Footer fijo
  footer: {
    position: 'absolute',
    bottom: 20,
    left: 36,
    right: 36,
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

export function labelDesde(codigo: string, catalogo: CatalogoCodigo[]): string {
  const found = catalogo.find((c) => c.codigo === codigo)
  return found ? found.label : codigo
}

// ── Columnas por tipo de trampa ───────────────────────────────────────────────

function EncabezadoCeboInteriorMecanica() {
  return (
    <View style={s.tableHeader}>
      <Text style={[s.thCell, { width: 40 }]}>No.</Text>
      <Text style={[s.thCell, { flex: 1 }]}>Tipo de consumo</Text>
      <Text style={[s.thCell, { flex: 1 }]}>Estado de la trampa</Text>
      <Text style={[s.thCell, { width: 60 }]}>Condiciones</Text>
      <Text style={[s.thCell, { width: 65 }]}>Señalización</Text>
      <Text style={[s.thCell, { width: 50 }]}>Hallazgo</Text>
    </View>
  )
}

function EncabezadoLuz() {
  return (
    <View style={s.tableHeader}>
      <Text style={[s.thCell, { width: 40 }]}>No.</Text>
      <Text style={[s.thCell, { flex: 1 }]}>Estado del equipo</Text>
      <Text style={[s.thCell, { flex: 1 }]}>Estado de la lámpara</Text>
      <Text style={[s.thCell, { flex: 2 }]}>Plaga detectada</Text>
      <Text style={[s.thCell, { width: 50 }]}>Hallazgo</Text>
    </View>
  )
}

function FilaCeboInteriorMecanica({
  est,
  index,
  catalogoEstado,
  catalogoCondiciones,
}: {
  est: EstacionResultadoPDF
  index: number
  catalogoEstado: CatalogoCodigo[]
  catalogoCondiciones: CatalogoCodigo[]
}) {
  const rowStyle = [s.tableRow, index % 2 === 1 ? s.tableRowAlt : {}]
  return (
    <View style={rowStyle}>
      <Text style={[s.tdCell, { width: 40 }]}>{est.numero}</Text>
      <Text style={[s.tdCell, { flex: 1 }]}>{est.tipo_consumo ?? ''}</Text>
      <Text style={[s.tdCell, { flex: 1 }]}>
        {est.estado_trampa ? labelDesde(est.estado_trampa, catalogoEstado) : ''}
      </Text>
      <Text style={[s.tdCell, { width: 60 }]}>
        {est.condiciones ? labelDesde(est.condiciones, catalogoCondiciones) : ''}
      </Text>
      <Text style={[s.tdCell, { width: 65 }]}>{est.senalizacion ?? ''}</Text>
      <Text
        style={[
          s.tdCell,
          { width: 50, textAlign: 'center' },
          est.tiene_hallazgo ? s.tdCellHallazgo : {},
        ]}
      >
        {est.tiene_hallazgo ? '!' : ''}
      </Text>
    </View>
  )
}

function FilaLuz({
  est,
  index,
  catalogoEstado,
  catalogoPlagas,
}: {
  est: EstacionResultadoPDF
  index: number
  catalogoEstado: CatalogoCodigo[]
  catalogoPlagas: CatalogoCodigo[]
}) {
  const rowStyle = [s.tableRow, index % 2 === 1 ? s.tableRowAlt : {}]
  const plagasLabel = (est.plaga_detectada ?? [])
    .map((c) => labelDesde(c, catalogoPlagas))
    .join(', ')
  return (
    <View style={rowStyle}>
      <Text style={[s.tdCell, { width: 40 }]}>{est.numero}</Text>
      <Text style={[s.tdCell, { flex: 1 }]}>
        {est.estado_equipo ? labelDesde(est.estado_equipo, catalogoEstado) : ''}
      </Text>
      <Text style={[s.tdCell, { flex: 1 }]}>
        {est.estado_lampara ? labelDesde(est.estado_lampara, catalogoEstado) : ''}
      </Text>
      <Text style={[s.tdCell, { flex: 2 }]}>{plagasLabel}</Text>
      <Text
        style={[
          s.tdCell,
          { width: 50, textAlign: 'center' },
          est.tiene_hallazgo ? s.tdCellHallazgo : {},
        ]}
      >
        {est.tiene_hallazgo ? '!' : ''}
      </Text>
    </View>
  )
}

// ── Componente de página ──────────────────────────────────────────────────────

export function MonitoreoEstacionesPagina({
  folio,
  instalacion,
  instalacionCodigo,
  fecha,
  inspector,
  observaciones,
  grupos,
  catalogoEstado,
  catalogoCondiciones,
  catalogoPlagas,
}: MonitoreoEstacionesPaginaProps) {
  const emision = new Date().toLocaleDateString('es-MX')

  return (
    <Page size="A4" orientation="landscape" style={s.page}>

      {/* Footer fijo */}
      <View fixed style={s.footer}>
        <Text style={s.footerText}>M.A.D.Y — DuoMind Solutions</Text>
        <Text style={s.footerText} render={({ pageNumber, totalPages }) => `Pagina ${pageNumber} de ${totalPages}`} />
      </View>

      {/* Header */}
      <View style={s.header}>
        <View style={{ flex: 2 }}>
          <MadyLogoPDF style={{ fontSize: 11, fontFamily: 'Helvetica-Bold', color: PRIMARY }} />
          <Text style={s.headerLogoSub}>Inocuidad Alimentaria</Text>
        </View>
        <View style={s.headerCenter}>
          <Text style={s.headerTitle}>REVISION DE ESTACIONES DE MONITOREO DE PLAGAS</Text>
          <Text style={s.headerSub}>F-FRUS-CAL-19  Rev. 01</Text>
        </View>
        <View style={{ flex: 2, alignItems: 'flex-end' }}>
          <Text style={s.headerMeta}>Emision: {emision}</Text>
          <Text style={s.headerMeta}>Folio: {folio}</Text>
        </View>
      </View>

      {/* Datos generales */}
      <View style={s.infoTable}>
        <View style={s.infoRow}>
          <View style={[s.infoCell, { flex: 3 }]}>
            <Text style={s.infoCellLabel}>INSTALACION</Text>
            <Text style={s.infoCellValue}>{instalacion}</Text>
          </View>
          <View style={[s.infoCell, { flex: 1 }]}>
            <Text style={s.infoCellLabel}>CODIGO</Text>
            <Text style={s.infoCellValue}>{instalacionCodigo}</Text>
          </View>
          <View style={[s.infoCell, { flex: 2 }]}>
            <Text style={s.infoCellLabel}>FECHA</Text>
            <Text style={s.infoCellValue}>{formatFechaPDF(fecha)}</Text>
          </View>
          <View style={[s.infoCell, { flex: 3 }]}>
            <Text style={s.infoCellLabel}>INSPECTOR</Text>
            <Text style={s.infoCellValue}>{inspector ?? '—'}</Text>
          </View>
        </View>
      </View>

      {/* Tablas por tipo de trampa */}
      {grupos.map((grupo) => (
        <View key={grupo.tipo_trampa}>
          <Text style={s.sectionBar}>{grupo.label.toUpperCase()}</Text>

          {grupo.tipo_trampa === 'luz' ? (
            <>
              <EncabezadoLuz />
              {grupo.estaciones.length === 0 ? (
                <View style={[s.tableRow, { borderLeftWidth: 1, borderLeftColor: BORDER, borderBottomWidth: 1, borderBottomColor: BORDER }]}>
                  <Text style={[s.tdCell, { flex: 1 }, s.tdEmpty]}>Sin estaciones registradas</Text>
                </View>
              ) : (
                grupo.estaciones.map((est, i) => (
                  <FilaLuz
                    key={est.numero}
                    est={est}
                    index={i}
                    catalogoEstado={catalogoEstado}
                    catalogoPlagas={catalogoPlagas}
                  />
                ))
              )}
            </>
          ) : (
            <>
              <EncabezadoCeboInteriorMecanica />
              {grupo.estaciones.length === 0 ? (
                <View style={[s.tableRow, { borderLeftWidth: 1, borderLeftColor: BORDER, borderBottomWidth: 1, borderBottomColor: BORDER }]}>
                  <Text style={[s.tdCell, { flex: 1 }, s.tdEmpty]}>Sin estaciones registradas</Text>
                </View>
              ) : (
                grupo.estaciones.map((est, i) => (
                  <FilaCeboInteriorMecanica
                    key={est.numero}
                    est={est}
                    index={i}
                    catalogoEstado={catalogoEstado}
                    catalogoCondiciones={catalogoCondiciones}
                  />
                ))
              )}
            </>
          )}
        </View>
      ))}

      {/* Observaciones */}
      {observaciones && observaciones.trim() !== '' && (
        <>
          <Text style={s.sectionBar}>OBSERVACIONES</Text>
          <View style={s.obsBlock}>
            <Text style={s.obsText}>{observaciones}</Text>
          </View>
        </>
      )}

      {/* Leyendas */}
      <Text style={s.sectionBarSmall}>LEYENDA</Text>
      <View style={s.leyendaRow}>
        <Text style={s.leyendaText}>
          Estado de la trampa: {catalogoEstado.map((c) => `${c.codigo}=${c.label}`).join('  ')}
        </Text>
        <Text style={s.leyendaText}>
          Condiciones: {catalogoCondiciones.map((c) => `${c.codigo}=${c.label}`).join('  ')}
        </Text>
        <Text style={s.leyendaText}>
          Plagas: {catalogoPlagas.map((c) => `${c.codigo}=${c.label}`).join('  ')}
        </Text>
      </View>

      {/* Firma */}
      <View style={s.firmaSection}>
        <View style={s.firmaLinea}>
          <Text style={s.firmaLabel}>Firma del Responsable del Cooler</Text>
        </View>
      </View>

    </Page>
  )
}

// ── PDF individual ─────────────────────────────────────────────────────────────

export function MonitoreoEstacionesPDF(props: MonitoreoEstacionesPaginaProps) {
  return (
    <Document
      title={`Monitoreo de Plagas ${props.instalacion} ${props.fecha}`}
      author="M.A.D.Y — DuoMind Solutions"
      subject="Revisión de Estaciones de Monitoreo de Plagas"
    >
      <MonitoreoEstacionesPagina {...props} />
    </Document>
  )
}

// ── PDF consolidado ────────────────────────────────────────────────────────────

export function MonitoreoEstacionesConsolidadoPDF({
  revisiones,
  instalacionNombre,
  desde,
  hasta,
}: MonitoreoEstacionesConsolidadoPDFProps) {
  return (
    <Document
      title={`Monitoreo de Plagas Consolidado ${instalacionNombre} ${desde} ${hasta}`}
      author="M.A.D.Y — DuoMind Solutions"
      subject="Revisión de Estaciones de Monitoreo de Plagas Consolidado"
    >
      {revisiones.map((r, i) => (
        <MonitoreoEstacionesPagina key={i} {...r} />
      ))}
    </Document>
  )
}
