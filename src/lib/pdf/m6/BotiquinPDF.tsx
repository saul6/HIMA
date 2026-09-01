// PATRÓN INOCUIDAD — PDF M6
// BotiquinPagina: una página del formato oficial (reutilizable en individual y consolidado).
// BotiquinPDF:    documento individual (1 página).
// BotiquinConsolidadoPDF: documento multi-página, una BotiquinPagina por registro.

import { Document, Page, View, Text, StyleSheet } from '@react-pdf/renderer'
import { MadyLogoPDF } from '@/lib/pdf/MadyLogoPDF'

export interface BotiquinPDFProps {
  folio: string
  rancho: string
  ranchoCodigo: string
  fechaVerificacion: string
  parches_curitas: boolean
  guantes_curacion: boolean
  vendas_tijeras: boolean
  gasas_cinta: boolean
  desinfectante: boolean
  responsableNombre: string
}

export interface BotiquinConsolidadoPDFProps {
  registros: BotiquinPDFProps[]
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
    paddingLeft: 50,
    paddingRight: 50,
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
  headerLogo: { fontSize: 11, fontFamily: 'Helvetica-Bold', color: PRIMARY },
  headerLogoSub: { fontSize: 7, color: MUTED, marginTop: 2 },
  headerTitle: {
    flex: 1,
    textAlign: 'center',
    fontSize: 9,
    fontFamily: 'Helvetica-Bold',
    color: DARK,
  },
  headerTitleSub: { textAlign: 'center', fontSize: 7, color: MUTED, marginTop: 2 },
  headerMeta: { width: 80, fontSize: 7, textAlign: 'right', color: MUTED },

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
  artTable: {
    borderLeftWidth: 1,
    borderLeftColor: BORDER,
    borderLeftStyle: 'solid',
    borderTopWidth: 1,
    borderTopColor: BORDER,
    borderTopStyle: 'solid',
    marginBottom: 4,
  },
  artHeaderRow: { flexDirection: 'row', backgroundColor: PRIMARY },
  artRow: { flexDirection: 'row' },
  artRowAlt: { flexDirection: 'row', backgroundColor: ROW_ALT },
  artHeaderCell: {
    color: WHITE,
    fontFamily: 'Helvetica-Bold',
    fontSize: 7,
    paddingTop: 5,
    paddingBottom: 5,
    paddingLeft: 8,
    paddingRight: 8,
    borderRightWidth: 1,
    borderRightColor: '#5599CC',
    borderRightStyle: 'solid',
    borderBottomWidth: 1,
    borderBottomColor: '#5599CC',
    borderBottomStyle: 'solid',
  },
  artCell: {
    fontSize: 9,
    paddingTop: 6,
    paddingBottom: 6,
    paddingLeft: 8,
    paddingRight: 8,
    borderRightWidth: 1,
    borderRightColor: BORDER,
    borderRightStyle: 'solid',
    borderBottomWidth: 1,
    borderBottomColor: BORDER,
    borderBottomStyle: 'solid',
  },
  artCellEstado: {
    fontSize: 10,
    paddingTop: 6,
    paddingBottom: 6,
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
  // Tiene = artículo presente (azul)
  estadoSi: { color: '#0D5A8F', backgroundColor: '#E3F2FD' },
  // Llenar = artículo ausente, hay que reponerlo (ámbar)
  estadoLlenar: { color: '#854F0B', backgroundColor: '#FAEEDA' },

  // ── Firmas ─────────────────────────────────────────────────────────────
  firmasSection: { marginTop: 36 },
  firmasRow: { flexDirection: 'row', gap: 32 },
  firmaBox: { flex: 1 },
  firmaLinea: {
    borderTopWidth: 1,
    borderTopColor: DARK,
    borderTopStyle: 'solid',
    paddingTop: 4,
    marginTop: 32,
  },
  firmaLabel: { fontSize: 7, color: MUTED },
  firmaNombre: { fontSize: 9, fontFamily: 'Helvetica-Bold', marginTop: 2 },

  // ── Footer (fijo por página) ────────────────────────────────────────────
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

// ── Catálogo de artículos (compartido por ambos documentos) ───────────────────

type ArticuloKey = 'parches_curitas' | 'guantes_curacion' | 'vendas_tijeras' | 'gasas_cinta' | 'desinfectante'

const ARTICULOS: { key: ArticuloKey; label: string }[] = [
  { key: 'parches_curitas', label: 'Parches / Curitas' },
  { key: 'guantes_curacion', label: 'Guantes de curación' },
  { key: 'vendas_tijeras', label: 'Vendas y tijeras' },
  { key: 'gasas_cinta', label: 'Gasas / Cintas' },
  { key: 'desinfectante', label: 'Desinfectante' },
]

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

// ── BotiquinPagina ────────────────────────────────────────────────────────────
// Unidad de contenido: una página A4 con el formato oficial de un registro.
// Usada por BotiquinPDF (1 página) y BotiquinConsolidadoPDF (N páginas).

export function BotiquinPagina({
  folio,
  rancho,
  ranchoCodigo,
  fechaVerificacion,
  parches_curitas,
  guantes_curacion,
  vendas_tijeras,
  gasas_cinta,
  desinfectante,
  responsableNombre,
}: BotiquinPDFProps) {
  const emision = new Date().toLocaleDateString('es-MX')
  const valores: Record<ArticuloKey, boolean> = {
    parches_curitas,
    guantes_curacion,
    vendas_tijeras,
    gasas_cinta,
    desinfectante,
  }
  const presentes = Object.values(valores).filter(Boolean).length

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
          <Text style={s.headerTitle}>
            REVISION DE MATERIALES DE BOTIQUIN DE PRIMEROS AUXILIOS
          </Text>
          <Text style={s.headerTitleSub}>
            Clave: MXA-F-SC-SIG · FORMATOS MANUAL DEL SAIA Y BPA's
          </Text>
        </View>
        <View style={{ flex: 2, alignItems: 'flex-end' }}>
          <Text style={s.headerMeta}>Folio: {folio}</Text>
          <Text style={s.headerMeta}>Emision: {emision}</Text>
        </View>
      </View>

      {/* Sección 1 — Datos del rancho */}
      <Text style={s.sectionTitle}>1. DATOS DEL RANCHO Y VERIFICACION</Text>
      <View style={s.infoTable}>
        <View style={s.infoRow}>
          <View style={s.infoCell}>
            <Text style={s.infoCellLabel}>RANCHO / HUERTO</Text>
            <Text style={s.infoCellValue}>{rancho}</Text>
          </View>
          <View style={s.infoCell}>
            <Text style={s.infoCellLabel}>CODIGO</Text>
            <Text style={s.infoCellValue}>{ranchoCodigo}</Text>
          </View>
        </View>
        <View style={s.infoRow}>
          <View style={s.infoCell}>
            <Text style={s.infoCellLabel}>FECHA DE VERIFICACION</Text>
            <Text style={s.infoCellValue}>{formatFechaPDF(fechaVerificacion)}</Text>
          </View>
          <View style={s.infoCell}>
            <Text style={s.infoCellLabel}>ARTICULOS PRESENTES</Text>
            <Text style={s.infoCellValue}>{presentes} / {ARTICULOS.length}</Text>
          </View>
        </View>
      </View>

      {/* Sección 2 — Materiales */}
      <Text style={s.sectionTitle}>2. REVISION DE MATERIALES</Text>
      <View style={s.artTable}>
        <View style={s.artHeaderRow}>
          <Text style={[s.artHeaderCell, { flex: 4 }]}>Articulo</Text>
          <Text style={[s.artHeaderCell, { flex: 1, textAlign: 'center' }]}>Tiene</Text>
          <Text style={[s.artHeaderCell, { flex: 1, textAlign: 'center' }]}>Llenar</Text>
        </View>
        {ARTICULOS.map((art, i) => {
          const tiene = valores[art.key]
          return (
            <View key={art.key} style={i % 2 === 0 ? s.artRow : s.artRowAlt}>
              <Text style={[s.artCell, { flex: 4 }]}>{art.label}</Text>
              {/* Tiene: marca si el articulo esta disponible. Usar 'Si' — Helvetica no soporta Unicode ✓ */}
              <Text style={[s.artCellEstado, { flex: 1 }, tiene ? s.estadoSi : {}]}>
                {tiene ? 'Si' : ''}
              </Text>
              {/* Llenar: marca si hay que reponerlo */}
              <Text style={[s.artCellEstado, { flex: 1 }, !tiene ? s.estadoLlenar : {}]}>
                {!tiene ? 'Si' : ''}
              </Text>
            </View>
          )
        })}
      </View>

      {/* Sección 3 — Firmas */}
      <Text style={[s.sectionTitle, { marginTop: 20 }]}>3. FIRMAS Y RESPONSABLES</Text>
      <View style={s.firmasSection}>
        <View style={s.firmasRow}>
          <View style={s.firmaBox}>
            <Text style={s.firmaLabel}>Responsable que realizo la verificacion</Text>
            <Text style={s.firmaNombre}>{responsableNombre}</Text>
            <View style={s.firmaLinea}>
              <Text style={s.firmaLabel}>Firma del responsable</Text>
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

// ── BotiquinPDF ───────────────────────────────────────────────────────────────
// Documento individual: exactamente 1 página.

export function BotiquinPDF(props: BotiquinPDFProps) {
  return (
    <Document
      title={`Botiquin ${props.folio}`}
      author="M.A.D.Y"
      subject="Revision de Materiales de Botiquin de Primeros Auxilios"
    >
      <BotiquinPagina {...props} />
    </Document>
  )
}

// ── BotiquinConsolidadoPDF ────────────────────────────────────────────────────
// Documento consolidado: una BotiquinPagina por cada registro, en orden de fecha.

export function BotiquinConsolidadoPDF({ registros, ranchoNombre, desde, hasta }: BotiquinConsolidadoPDFProps) {
  return (
    <Document
      title={`Botiquin Consolidado ${ranchoNombre} ${desde} ${hasta}`}
      author="M.A.D.Y"
      subject="Revision Consolidada de Materiales de Botiquin de Primeros Auxilios"
    >
      {registros.map((r) => (
        <BotiquinPagina key={r.folio} {...r} />
      ))}
    </Document>
  )
}
