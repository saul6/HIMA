import { Document, Page, View, Text, StyleSheet } from '@react-pdf/renderer'
import { MadyLogoPDF } from '@/lib/pdf/MadyLogoPDF'
import type { Aplicacion, AplicacionProducto, CatalogoProducto, Rancho, Profile } from '@/types/database.types'
import { formatFenologia } from '@/lib/fenologia'

console.log('PDF version:', Date.now())

type ProductoConCatalogo = AplicacionProducto & {
  catalogo_productos: CatalogoProducto
}

export interface AplicacionPDFProps {
  aplicacion: Aplicacion
  productos: ProductoConCatalogo[]
  rancho: Rancho
  asesor: Profile | null
  responsable: Profile | null
  operario: Profile
  /** Email del productor — fallback si nombre_completo está vacío */
  operarioEmail?: string
}

const PRIMARY = '#2B7AB5'
const DARK = '#1A1A1A'
const BORDER = '#CCCCCC'
const HEADER_TEXT = '#FFFFFF'
const ROW_ALT = '#F5F9FE'
const MUTED = '#555555'

const s = StyleSheet.create({
  page: {
    fontFamily: 'Helvetica',
    fontSize: 8,
    color: DARK,
    paddingTop: 56,
    paddingBottom: 50,
    paddingLeft: 56,
    paddingRight: 56,
  },

  // ── Header ──────────────────────────────────────────────────────────────────
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 10,
    borderBottomWidth: 2,
    borderBottomColor: PRIMARY,
    borderBottomStyle: 'solid',
    paddingBottom: 8,
  },
  headerLogo: {
    fontSize: 11,
    fontFamily: 'Helvetica-Bold',
    color: PRIMARY,
  },
  headerLogoSub: {
    fontSize: 7,
    fontFamily: 'Helvetica',
    color: MUTED,
    marginTop: 2,
  },
  headerTitle: {
    flex: 1,
    textAlign: 'center',
    fontSize: 9,
    fontFamily: 'Helvetica-Bold',
    color: DARK,
  },
  headerTitleSub: {
    textAlign: 'center',
    fontSize: 7,
    color: MUTED,
    marginTop: 2,
  },
  headerMeta: {
    width: 90,
    fontSize: 7,
    textAlign: 'right',
    color: MUTED,
  },

  // ── Section title bar ────────────────────────────────────────────────────────
  sectionTitle: {
    backgroundColor: PRIMARY,
    color: HEADER_TEXT,
    fontFamily: 'Helvetica-Bold',
    fontSize: 8,
    paddingTop: 4,
    paddingBottom: 4,
    paddingLeft: 8,
    paddingRight: 8,
    marginTop: 10,
    marginBottom: 0,
  },

  // ── Info table (2-col label/value grid) ──────────────────────────────────────
  infoTable: {
    borderLeftWidth: 1,
    borderLeftColor: BORDER,
    borderLeftStyle: 'solid',
    borderTopWidth: 1,
    borderTopColor: BORDER,
    borderTopStyle: 'solid',
    marginBottom: 4,
  },
  infoRow: {
    flexDirection: 'row',
  },
  infoCell: {
    flex: 1,
    borderRightWidth: 1,
    borderRightColor: BORDER,
    borderRightStyle: 'solid',
    borderBottomWidth: 1,
    borderBottomColor: BORDER,
    borderBottomStyle: 'solid',
    paddingTop: 4,
    paddingBottom: 4,
    paddingLeft: 6,
    paddingRight: 6,
  },
  infoCellLabel: {
    fontSize: 6,
    color: MUTED,
    marginBottom: 2,
    fontFamily: 'Helvetica-Bold',
    textTransform: 'uppercase',
  },
  infoCellValue: {
    fontSize: 8,
    color: DARK,
  },

  // ── Product table ────────────────────────────────────────────────────────────
  table: {
    borderLeftWidth: 1,
    borderLeftColor: BORDER,
    borderLeftStyle: 'solid',
    borderTopWidth: 1,
    borderTopColor: BORDER,
    borderTopStyle: 'solid',
  },
  tableHeaderRow: {
    flexDirection: 'row',
    backgroundColor: PRIMARY,
  },
  tableRow: {
    flexDirection: 'row',
  },
  tableRowAlt: {
    flexDirection: 'row',
    backgroundColor: ROW_ALT,
  },
  tableHeaderCell: {
    color: HEADER_TEXT,
    fontFamily: 'Helvetica-Bold',
    fontSize: 6,
    paddingTop: 4,
    paddingBottom: 4,
    paddingLeft: 3,
    paddingRight: 3,
    borderRightWidth: 1,
    borderRightColor: '#5599CC',
    borderRightStyle: 'solid',
    borderBottomWidth: 1,
    borderBottomColor: '#5599CC',
    borderBottomStyle: 'solid',
    textAlign: 'center',
  },
  tableCell: {
    fontSize: 7,
    paddingTop: 3,
    paddingBottom: 3,
    paddingLeft: 3,
    paddingRight: 3,
    borderRightWidth: 1,
    borderRightColor: BORDER,
    borderRightStyle: 'solid',
    borderBottomWidth: 1,
    borderBottomColor: BORDER,
    borderBottomStyle: 'solid',
    textAlign: 'center',
  },

  // ── EPP ──────────────────────────────────────────────────────────────────────
  eppRow: {
    flexDirection: 'row',
    paddingTop: 6,
    paddingBottom: 6,
  },
  eppItem: {
    flexDirection: 'row',
    alignItems: 'center',
    marginRight: 16,
  },
  eppBox: {
    width: 10,
    height: 10,
    borderWidth: 1,
    borderColor: BORDER,
    borderStyle: 'solid',
    borderRadius: 2,
    marginRight: 4,
    alignItems: 'center',
    justifyContent: 'center',
  },
  eppBoxChecked: {
    backgroundColor: PRIMARY,
    borderColor: PRIMARY,
  },
  eppCheckMark: {
    color: HEADER_TEXT,
    fontSize: 7,
    fontFamily: 'Helvetica-Bold',
  },
  eppCross: {
    color: '#C02A2A',
    fontSize: 7,
    fontFamily: 'Helvetica-Bold',
  },
  eppLabel: {
    fontSize: 7,
    color: DARK,
  },

  // ── Footer (fixed, every page) ───────────────────────────────────────────────
  footer: {
    position: 'absolute',
    bottom: 20,
    left: 56,
    right: 56,
    flexDirection: 'row',
    justifyContent: 'space-between',
    borderTopWidth: 1,
    borderTopColor: BORDER,
    borderTopStyle: 'solid',
    paddingTop: 4,
  },
  footerText: {
    fontSize: 6,
    color: '#888888',
  },

  // ── Firmas ───────────────────────────────────────────────────────────────────
  firmasRow: {
    flexDirection: 'row',
    marginTop: 24,
  },
  firmaBox: {
    flex: 1,
    marginRight: 16,
  },
  firmaLinea: {
    borderTopWidth: 1,
    borderTopColor: DARK,
    borderTopStyle: 'solid',
    paddingTop: 4,
    marginTop: 20,
  },
  firmaLabel: {
    fontSize: 7,
    color: MUTED,
  },
  firmaNombre: {
    fontSize: 8,
    fontFamily: 'Helvetica-Bold',
    marginTop: 2,
  },
})

// ── Helpers ──────────────────────────────────────────────────────────────────

const val = (v: string | number | null | undefined, fallback = '—') =>
  v != null && v !== '' ? String(v) : fallback

// Formatea números de dosis a máximo 4 decimales sin notación científica
const valNum = (v: number | null | undefined, fallback = '—') =>
  v != null ? parseFloat(v.toFixed(4)).toString() : fallback

function InfoRow({ left, right }: { left: [string, string]; right: [string, string] }) {
  return (
    <View style={s.infoRow}>
      <View style={s.infoCell}>
        <Text style={s.infoCellLabel}>{left[0]}</Text>
        <Text style={s.infoCellValue}>{left[1]}</Text>
      </View>
      <View style={s.infoCell}>
        <Text style={s.infoCellLabel}>{right[0]}</Text>
        <Text style={s.infoCellValue}>{right[1]}</Text>
      </View>
    </View>
  )
}

const PRODUCT_COLS: { label: string; width: number }[] = [
  { label: 'Justificación / Plaga', width: 82 },
  { label: 'Nivel infestación', width: 44 },
  { label: 'Nombre Comercial', width: 98 },
  { label: 'Ingrediente Activo', width: 93 },
  { label: 'Dosis/ha', width: 46 },
  { label: 'Dosis/barril (200L)', width: 62 },
  { label: 'Dosis total', width: 55 },
  { label: 'Días cosecha', width: 44 },
  { label: 'Re-entrada (hrs)', width: 40 },
  { label: 'RSCO/COFEPRIS', width: 96 },
]

const EPP_ITEMS: { key: keyof typeof INITIAL_EPP; label: string }[] = [
  { key: 'epp_traje', label: 'Traje protector' },
  { key: 'epp_guantes', label: 'Guantes' },
  { key: 'epp_googles', label: 'Googles' },
  { key: 'epp_botas', label: 'Botas' },
  { key: 'epp_mascarillas', label: 'Mascarillas' },
]

const INITIAL_EPP = {
  epp_traje: false,
  epp_guantes: false,
  epp_googles: false,
  epp_botas: false,
  epp_mascarillas: false,
}

// ── Component ─────────────────────────────────────────────────────────────────

export function AplicacionPDF({
  aplicacion: ap,
  productos,
  rancho,
  asesor,
  responsable,
  operario,
  operarioEmail,
}: AplicacionPDFProps) {
  const productorNombre = operario.nombre_completo || operarioEmail || '—'
  const folio = ap.id.slice(0, 8).toUpperCase()
  const emision = new Date().toLocaleDateString('es-MX')

  return (
    <Document
      key={Date.now()}
      title={`Aplicación Foliar ${folio}`}
      author="M.A.D.Y"
      subject="Registro de Aplicaciones Foliares de Agroquímicos"
    >
      <Page size="A4" orientation="landscape" style={s.page}>

        {/* ── Fixed footer ── */}
        <View fixed style={s.footer}>
          <Text style={s.footerText}>
            M.A.D.Y · Inocuidad Inteligente
          </Text>
          <Text
            style={s.footerText}
            render={({ pageNumber, totalPages }) => `Página ${pageNumber} de ${totalPages}`}
          />
        </View>

        {/* ── Header ── */}
        <View style={s.header}>
          <View style={{ flex: 2 }}>
            <MadyLogoPDF style={s.headerLogo} />
            <Text style={s.headerLogoSub}>Inocuidad Alimentaria</Text>
          </View>
          <View style={{ flex: 6 }}>
            <Text style={s.headerTitle}>
              REGISTRO DE APLICACIONES FOLIARES DE AGROQUÍMICOS
            </Text>
            <Text style={s.headerTitleSub}>
              Clave: MXA-F-SC-SIG · FORMATOS MANUAL DEL SAIA Y BPA's
            </Text>
          </View>
          <View style={{ flex: 2, alignItems: 'flex-end' }}>
            <Text style={s.headerMeta}>Folio: {folio}</Text>
            <Text style={s.headerMeta}>Emisión: {emision}</Text>
          </View>
        </View>

        {/* ── Sección 1 — Datos del productor ── */}
        <Text style={s.sectionTitle}>1. DATOS DEL PRODUCTOR Y PARCELA</Text>
        <View style={s.infoTable}>
          <InfoRow
            left={['Productor', productorNombre]}
            right={['Rancho / Huerto', val(rancho.nombre)]}
          />
          <InfoRow
            left={['Cultivo', val(rancho.cultivo)]}
            right={['Variedad', val(ap.variedad)]}
          />
          <InfoRow
            left={['Código de huerto', val(rancho.codigo)]}
            right={['Sector', val(ap.sector)]}
          />
          <InfoRow
            left={['Superficie (ha)', val(ap.superficie_ha)]}
            right={['Etapa fenológica', formatFenologia(ap.fenologia ?? undefined)]}
          />
        </View>

        {/* ── Sección 2 — Fechas y condiciones ── */}
        <Text style={s.sectionTitle}>2. FECHAS, HORARIOS Y CONDICIONES DE APLICACIÓN</Text>
        <View style={s.infoTable}>
          <InfoRow
            left={['Fecha recomendación asesor', val(ap.fecha_recomendacion)]}
            right={['Fecha real de aplicación', val(ap.fecha_aplicacion)]}
          />
          <InfoRow
            left={['Hora inicio', val(ap.hora_inicio)]}
            right={['Hora fin', val(ap.hora_fin)]}
          />
          <InfoRow
            left={['Tipo de aplicación', val(ap.tipo_aplicacion)]}
            right={['Total agua usada (L)', val(ap.total_agua_l)]}
          />
          <InfoRow
            left={['Equipo de aplicación', val(ap.equipo)]}
            right={['Condición meteorológica', val(ap.condicion_meteorologica)]}
          />
          <InfoRow
            left={[
              'Cloración',
              ap.cloracion
                ? `Sí — ${valNum(ap.cloro_cantidad_l)} ml · pH ${val(ap.cloro_ph)}`
                : 'No',
            ]}
            right={['', '']}
          />
        </View>

        {/* ── Sección 3 — Productos aplicados ── */}
        <Text style={s.sectionTitle}>3. PRODUCTOS APLICADOS</Text>
        <View style={s.table}>
          {/* Header row */}
          <View style={s.tableHeaderRow}>
            {PRODUCT_COLS.map((col) => (
              <Text
                key={col.label}
                style={[s.tableHeaderCell, { width: col.width }]}
              >
                {col.label}
              </Text>
            ))}
          </View>
          {/* Data rows */}
          {productos.length === 0 ? (
            <View style={s.tableRow}>
              <Text style={[s.tableCell, { flex: 1, textAlign: 'center' }]}>
                Sin productos registrados
              </Text>
            </View>
          ) : (
            productos.map((p, i) => (
              <View key={p.id} style={i % 2 === 0 ? s.tableRow : s.tableRowAlt}>
                <Text style={[s.tableCell, { width: PRODUCT_COLS[0].width }]}>
                  {val(p.plaga_objetivo)}
                </Text>
                <Text style={[s.tableCell, { width: PRODUCT_COLS[1].width }]}>
                  {val(p.nivel_infestacion)}
                </Text>
                <Text style={[s.tableCell, { width: PRODUCT_COLS[2].width }]}>
                  {val(p.catalogo_productos.nombre_comercial)}
                </Text>
                <Text style={[s.tableCell, { width: PRODUCT_COLS[3].width }]}>
                  {val(p.catalogo_productos.ingrediente_activo)}
                </Text>
                <Text style={[s.tableCell, { width: PRODUCT_COLS[4].width }]}>
                  {valNum(p.dosis_ha)}
                </Text>
                <Text style={[s.tableCell, { width: PRODUCT_COLS[5].width }]}>
                  {valNum(p.dosis_200l)}
                </Text>
                <Text style={[s.tableCell, { width: PRODUCT_COLS[6].width }]}>
                  {valNum(p.total_producto)}
                </Text>
                <Text style={[s.tableCell, { width: PRODUCT_COLS[7].width }]}>
                  {val(p.dias_cosecha)}
                </Text>
                <Text style={[s.tableCell, { width: PRODUCT_COLS[8].width }]}>
                  {val(p.reentrada_hrs)}
                </Text>
                <Text style={[s.tableCell, { width: PRODUCT_COLS[9].width }]}>
                  {val(p.catalogo_productos.rsco)}
                </Text>
              </View>
            ))
          )}
        </View>

        {/* ── Sección 4 — EPP ── */}
        <Text style={s.sectionTitle}>4. EQUIPO DE PROTECCIÓN PERSONAL (EPP)</Text>
        <View style={s.eppRow}>
          {EPP_ITEMS.map(({ key, label }) => {
            const checked = ap[key] as boolean
            return (
              <View key={key} style={s.eppItem}>
                <View style={[s.eppBox, checked ? s.eppBoxChecked : {}]}>
                  {checked ? (
                    <Text style={s.eppCheckMark}>v</Text>
                  ) : (
                    <Text style={s.eppCross}>x</Text>
                  )}
                </View>
                <Text style={s.eppLabel}>{label}</Text>
              </View>
            )
          })}
        </View>

        {/* ── Sección 5 — Caldos sobrantes ── */}
        <Text style={s.sectionTitle}>5. CALDOS SOBRANTES</Text>
        <View style={s.infoTable}>
          <InfoRow
            left={['¿Hubo caldos sobrantes?', ap.caldos_sobrantes ? 'Sí' : 'No']}
            right={
              ap.caldos_sobrantes
                ? ['Cantidad (L)', val(ap.caldos_cantidad_l)]
                : ['', '']
            }
          />
          {ap.caldos_sobrantes && (
            <InfoRow
              left={['Agua de lavado (L)', val(ap.caldos_agua_lavado_l)]}
              right={[
                '¿Eliminado en área designada?',
                ap.caldos_area_designada === true
                  ? 'Sí'
                  : ap.caldos_area_designada === false
                  ? 'No'
                  : '—',
              ]}
            />
          )}
        </View>

        {/* ── Sección 6 — Observaciones ── */}
        {ap.observaciones && (
          <>
            <Text style={s.sectionTitle}>6. OBSERVACIONES</Text>
            <View style={[s.infoTable]}>
              <View style={s.infoRow}>
                <View style={[s.infoCell, { flex: 1 }]}>
                  <Text style={s.infoCellValue}>{ap.observaciones}</Text>
                </View>
              </View>
            </View>
          </>
        )}

        {/* ── Sección 7 — Firmas ── */}
        <Text style={[s.sectionTitle, { marginTop: 12 }]}>
          {ap.observaciones ? '7.' : '6.'} FIRMAS Y RESPONSABLES
        </Text>
        <View style={s.firmasRow}>
          <View style={s.firmaBox}>
            <Text style={s.firmaLabel}>Nombre(s) del aplicador</Text>
            <Text style={s.firmaNombre}>{val(ap.aplicadores)}</Text>
            <View style={s.firmaLinea}>
              <Text style={s.firmaLabel}>Firma del aplicador</Text>
            </View>
          </View>
          <View style={s.firmaBox}>
            <Text style={s.firmaLabel}>Asesor técnico</Text>
            <Text style={s.firmaNombre}>{val(asesor?.nombre_completo)}</Text>
            <View style={s.firmaLinea}>
              <Text style={s.firmaLabel}>Firma del asesor técnico</Text>
            </View>
          </View>
          <View style={[s.firmaBox, { marginRight: 0 }]}>
            <Text style={s.firmaLabel}>Responsable de inocuidad</Text>
            <Text style={s.firmaNombre}>{val(responsable?.nombre_completo)}</Text>
            <View style={s.firmaLinea}>
              <Text style={s.firmaLabel}>Firma del responsable de inocuidad</Text>
            </View>
          </View>
        </View>

      </Page>
    </Document>
  )
}
