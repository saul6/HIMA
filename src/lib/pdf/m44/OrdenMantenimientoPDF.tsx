import { Document, Page, View, Text, StyleSheet } from '@react-pdf/renderer'
import { MadyLogoPDF } from '@/lib/pdf/MadyLogoPDF'
import { codigoFormato } from '@/lib/codigoFormato'

export type PrioridadM44PDF = 'inmediata' | 'turno' | 'siguientes_dias'

export interface OrdenMantenimientoPDFProps {
  organizacion: string
  instalacion: string
  instalacionCodigo: string
  fecha: string
  folio: string | null
  descripcion_solicitud: string | null
  prioridad: PrioridadM44PDF
  solicita: string | null
  recibe_mtto: string | null
  equipo_produccion: boolean
  lavado_sanitizado: boolean
  observaciones: string | null
  entrega_mtto: string | null
  recibe: string | null
  codigoClave: string
}

const PRIMARY = '#2B7AB5'
const DARK    = '#1A1A1A'
const BORDER  = '#CCCCCC'
const MUTED   = '#717182'
const HDR_BG  = '#E8F1F9'

const MARGIN = 30

const s = StyleSheet.create({
  page: {
    fontFamily: 'Helvetica',
    fontSize: 9,
    color: DARK,
    paddingTop: MARGIN,
    paddingBottom: MARGIN + 12,
    paddingLeft: MARGIN,
    paddingRight: MARGIN,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 10,
    borderBottomWidth: 2,
    borderBottomColor: PRIMARY,
    paddingBottom: 8,
  },
  headerTitle: { flex: 1, textAlign: 'center', fontSize: 11, fontFamily: 'Helvetica-Bold' },
  headerMeta:  { fontSize: 6.5, color: MUTED, textAlign: 'right' },
  infoRow: { flexDirection: 'row', gap: 6, marginBottom: 8 },
  infoBox: {
    flex: 1, borderWidth: 1, borderColor: BORDER, borderRadius: 3,
    paddingTop: 4, paddingBottom: 4, paddingLeft: 6, paddingRight: 6,
  },
  infoLabel: { fontSize: 6.5, color: MUTED, marginBottom: 1 },
  infoValue:  { fontSize: 9, fontFamily: 'Helvetica-Bold' },
  section: {
    borderWidth: 1, borderColor: BORDER, borderRadius: 4,
    marginBottom: 8, overflow: 'hidden',
  },
  sectionHeader: {
    backgroundColor: HDR_BG, paddingTop: 4, paddingBottom: 4,
    paddingLeft: 8, paddingRight: 8,
  },
  sectionHeaderText: { fontSize: 8, fontFamily: 'Helvetica-Bold', color: PRIMARY },
  sectionBody: { paddingTop: 6, paddingBottom: 6, paddingLeft: 8, paddingRight: 8 },
  bodyText:    { fontSize: 9, lineHeight: 1.4 },
  prioRow: { flexDirection: 'row', alignItems: 'center', gap: 6, marginBottom: 4 },
  prioBox: {
    width: 11, height: 11, borderWidth: 1, borderColor: BORDER, borderRadius: 2,
    alignItems: 'center', justifyContent: 'center',
  },
  prioBoxMark: { fontSize: 8, fontFamily: 'Helvetica-Bold', color: PRIMARY },
  prioLabel:   { fontSize: 9 },
  twoCol: { flexDirection: 'row', gap: 10 },
  col:    { flex: 1 },
  colLabel: { fontSize: 7, color: MUTED, marginBottom: 2 },
  colValue: { fontSize: 9, fontFamily: 'Helvetica-Bold', minHeight: 14 },
  siNoRow:  { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 6 },
  siNoLabel:{ flex: 1, fontSize: 9 },
  siNoVal:  { fontSize: 9, fontFamily: 'Helvetica-Bold', width: 30, textAlign: 'right' },
  firmaRow:  { flexDirection: 'row', gap: 20, marginTop: 16 },
  firmaBloque: { flex: 1, borderTopWidth: 1, borderTopColor: BORDER, paddingTop: 5, alignItems: 'center' },
  firmaLabel:  { fontSize: 7.5, color: MUTED },
  piePagina: {
    position: 'absolute', bottom: 12, left: MARGIN, right: MARGIN,
    textAlign: 'center', fontSize: 6, color: MUTED,
  },
})

const PRIORIDAD_LABELS: Record<string, string> = {
  inmediata:       'Atencion inmediata',
  turno:           'Atencion durante el turno',
  siguientes_dias: 'Atencion durante los siguientes dias',
}

function PrioCheckbox({ id, seleccionada, label }: { id: string; seleccionada: boolean; label: string }) {
  return (
    <View style={s.prioRow}>
      <View style={s.prioBox}>
        {seleccionada && <Text style={s.prioBoxMark}>X</Text>}
      </View>
      <Text style={s.prioLabel}>{label}</Text>
    </View>
  )
}

function formatFecha(iso: string): string {
  try {
    const [y, m, d] = iso.split('-')
    return `${d}/${m}/${y}`
  } catch { return iso }
}

export function OrdenMantenimientoPDF({
  organizacion, instalacion, instalacionCodigo, fecha, folio,
  descripcion_solicitud, prioridad, solicita, recibe_mtto,
  equipo_produccion, lavado_sanitizado, observaciones, entrega_mtto, recibe, codigoClave,
}: OrdenMantenimientoPDFProps) {
  return (
    <Document>
      <Page size="A4" orientation="portrait" style={s.page}>

        {/* Header */}
        <View style={s.header}>
          <View>
            <MadyLogoPDF style={{ fontSize: 11, fontFamily: 'Helvetica-Bold', color: PRIMARY }} />
            <Text style={{ fontSize: 6.5, color: MUTED, marginTop: 2 }}>Inocuidad Alimentaria</Text>
          </View>
          <View style={{ flex: 1, alignItems: 'center' }}>
            <Text style={s.headerTitle}>ORDEN DE MANTENIMIENTO</Text>
            <Text style={{ fontSize: 7, color: MUTED, marginTop: 2 }}>
              {`Codigo: ${codigoFormato('F-FRUS-MTT-01', codigoClave)}`}
            </Text>
          </View>
          <View>
            <Text style={s.headerMeta}>No. Folio:</Text>
            <Text style={[s.headerMeta, { fontSize: 9, fontFamily: 'Helvetica-Bold', color: DARK }]}>
              {folio ?? '—'}
            </Text>
          </View>
        </View>

        {/* Info row */}
        <View style={s.infoRow}>
          <View style={[s.infoBox, { flex: 3 }]}>
            <Text style={s.infoLabel}>Organizacion</Text>
            <Text style={s.infoValue}>{organizacion}</Text>
          </View>
          <View style={[s.infoBox, { flex: 3 }]}>
            <Text style={s.infoLabel}>Instalacion</Text>
            <Text style={s.infoValue}>{instalacion}</Text>
          </View>
          <View style={s.infoBox}>
            <Text style={s.infoLabel}>Codigo</Text>
            <Text style={s.infoValue}>{instalacionCodigo}</Text>
          </View>
          <View style={[s.infoBox, { flex: 2 }]}>
            <Text style={s.infoLabel}>Fecha</Text>
            <Text style={s.infoValue}>{formatFecha(fecha)}</Text>
          </View>
        </View>

        {/* Descripción */}
        <View style={s.section}>
          <View style={s.sectionHeader}>
            <Text style={s.sectionHeaderText}>Descripcion de la Solicitud</Text>
          </View>
          <View style={[s.sectionBody, { minHeight: 60 }]}>
            <Text style={s.bodyText}>{descripcion_solicitud ?? ''}</Text>
          </View>
        </View>

        {/* Prioridad */}
        <View style={s.section}>
          <View style={s.sectionHeader}>
            <Text style={s.sectionHeaderText}>Prioridad</Text>
          </View>
          <View style={s.sectionBody}>
            {Object.entries(PRIORIDAD_LABELS).map(([id, label]) => (
              <PrioCheckbox key={id} id={id} seleccionada={prioridad === id} label={label} />
            ))}
          </View>
        </View>

        {/* Solicita / Recibe en Mtto */}
        <View style={s.section}>
          <View style={s.sectionHeader}>
            <Text style={s.sectionHeaderText}>Personal</Text>
          </View>
          <View style={[s.sectionBody]}>
            <View style={s.twoCol}>
              <View style={s.col}>
                <Text style={s.colLabel}>Solicita</Text>
                <Text style={s.colValue}>{solicita ?? ''}</Text>
              </View>
              <View style={s.col}>
                <Text style={s.colLabel}>Recibe en Mantenimiento</Text>
                <Text style={s.colValue}>{recibe_mtto ?? ''}</Text>
              </View>
            </View>
          </View>
        </View>

        {/* Equipo de producción / Lavado */}
        <View style={s.section}>
          <View style={s.sectionHeader}>
            <Text style={s.sectionHeaderText}>Condiciones de Entrega</Text>
          </View>
          <View style={s.sectionBody}>
            <View style={s.siNoRow}>
              <Text style={s.siNoLabel}>¿Se reparo un equipo de produccion?</Text>
              <Text style={[s.siNoVal, { color: equipo_produccion ? PRIMARY : MUTED }]}>
                {equipo_produccion ? 'Si' : 'No'}
              </Text>
            </View>
            <View style={s.siNoRow}>
              <Text style={s.siNoLabel}>¿El equipo fue lavado y sanitizado despues de la reparacion?</Text>
              <Text style={[s.siNoVal, { color: lavado_sanitizado ? PRIMARY : MUTED }]}>
                {lavado_sanitizado ? 'Si' : 'No'}
              </Text>
            </View>
          </View>
        </View>

        {/* Observaciones */}
        {observaciones ? (
          <View style={s.section}>
            <View style={s.sectionHeader}>
              <Text style={s.sectionHeaderText}>Observaciones</Text>
            </View>
            <View style={[s.sectionBody, { minHeight: 40 }]}>
              <Text style={s.bodyText}>{observaciones}</Text>
            </View>
          </View>
        ) : null}

        {/* Firmas */}
        <View style={s.firmaRow}>
          <View style={s.firmaBloque}>
            <View style={{ height: 24 }} />
            <Text style={[s.firmaLabel, { marginBottom: 2 }]}>
              {entrega_mtto ?? ''}
            </Text>
            <Text style={s.firmaLabel}>Entrega en Mantenimiento</Text>
          </View>
          <View style={s.firmaBloque}>
            <View style={{ height: 24 }} />
            <Text style={[s.firmaLabel, { marginBottom: 2 }]}>
              {recibe ?? ''}
            </Text>
            <Text style={s.firmaLabel}>Recibe</Text>
          </View>
        </View>

        <Text style={s.piePagina} fixed>M.A.D.Y · Inocuidad Inteligente</Text>
      </Page>
    </Document>
  )
}
