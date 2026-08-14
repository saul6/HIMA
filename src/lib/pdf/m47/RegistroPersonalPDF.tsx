import { Document, Page, Text, View, StyleSheet } from '@react-pdf/renderer'
import { codigoFormato } from '@/lib/codigoFormato'

export interface M47ItemPDF {
  id: string
  nombre: string
}

export interface M47TrabajadorPDF {
  numero: number
  puesto: string | null
  nombre: string
  direccion: string | null
  telefono_casa: string | null
  celular: string | null
  fecha_nacimiento: string | null
  emergencia_nombre: string | null
  emergencia_parentesco: string | null
  emergencia_telefono: string | null
  observaciones: string | null
  checklist: Record<string, boolean>
}

export interface RegistroPersonalPDFProps {
  orgNombre: string
  rancho: string
  fechaPDF: string
  trabajadores: M47TrabajadorPDF[]
  documentos: M47ItemPDF[]
  capacitaciones: M47ItemPDF[]
  codigoClave: string
}

const t = (v: string | null | undefined): string => v ?? '—'

function fmtFecha(iso: string | null): string {
  if (!iso) return '—'
  try {
    const [, m, d] = iso.split('-')
    const y = iso.slice(0, 4)
    return `${d}/${m}/${y}`
  } catch { return iso }
}

function fmtFechaCorta(iso: string): string {
  try {
    const [y, m, d] = iso.split('-')
    return `${d}/${m}/${y}`
  } catch { return iso }
}

// Column widths
const COL_NO = 16
const COL_PUESTO = 42
const COL_NOMBRE = 78
const COL_DIR = 60
const COL_TCASA = 36
const COL_CEL = 36
const COL_FNAC = 42
const COL_EM_NOM = 58
const COL_EM_PAR = 36
const COL_EM_TEL = 36
const COL_ITEM = 20

const s = StyleSheet.create({
  page:     { fontFamily: 'Helvetica', fontSize: 6.5, padding: 20, backgroundColor: '#ffffff', color: '#222' },
  hdr:      { flexDirection: 'row', justifyContent: 'space-between', marginBottom: 6, alignItems: 'flex-start' },
  title:    { fontSize: 11, fontFamily: 'Helvetica-Bold', marginBottom: 1 },
  codigo:   { fontSize: 6.5, color: '#666', marginBottom: 1 },
  metaBold: { fontSize: 7, fontFamily: 'Helvetica-Bold' },
  meta:     { fontSize: 6.5, color: '#444' },
  // Table
  groupRow: { flexDirection: 'row', backgroundColor: '#dce8f5' },
  groupCell:{ fontFamily: 'Helvetica-Bold', fontSize: 5.5, padding: '2 3', textAlign: 'center', borderRight: '0.5pt solid #bbb' },
  headRow:  { flexDirection: 'row', backgroundColor: '#f0f4f8' },
  th:       { fontFamily: 'Helvetica-Bold', fontSize: 5.5, padding: '2 2', borderRight: '0.5pt solid #ccc', borderBottom: '0.5pt solid #bbb' },
  tr:       { flexDirection: 'row', borderBottom: '0.5pt solid #eee' },
  trAlt:    { backgroundColor: '#f9fbfd' },
  td:       { fontSize: 6, padding: '2 2', borderRight: '0.5pt solid #eee' },
  tdC:      { fontSize: 6, padding: '2 2', borderRight: '0.5pt solid #eee', textAlign: 'center' },
  // Legend
  legend:   { marginTop: 8, flexDirection: 'row', flexWrap: 'wrap', gap: 4 },
  legendItem:{ fontSize: 5.5, color: '#555' },
  // Footer
  footer:   { marginTop: 10, flexDirection: 'row', justifyContent: 'space-between', alignItems: 'flex-end' },
  firma:    { width: 180, borderTop: '0.5pt solid #555', paddingTop: 3, fontSize: 6, textAlign: 'center', color: '#444' },
  marca:    { fontSize: 5.5, color: '#aaa' },
})

export function RegistroPersonalPDF({
  orgNombre, rancho, fechaPDF, trabajadores, documentos, capacitaciones, codigoClave,
}: RegistroPersonalPDFProps) {
  const codigo = codigoFormato('F-FRUS-ADM-04', codigoClave)
  const nDocs = documentos.length
  const nCaps = capacitaciones.length

  // Width of items section
  const wDocs = nDocs * COL_ITEM
  const wCaps = nCaps * COL_ITEM
  // Obs takes remaining width
  const fixedTotal = COL_NO + COL_PUESTO + COL_NOMBRE + COL_DIR + COL_TCASA + COL_CEL + COL_FNAC
    + COL_EM_NOM + COL_EM_PAR + COL_EM_TEL + wDocs + wCaps
  const COL_OBS = Math.max(40, 801 - fixedTotal)

  return (
    <Document>
      <Page size="A4" orientation="landscape" style={s.page}>

        {/* ── Header ── */}
        <View style={s.hdr}>
          <View style={{ flex: 1 }}>
            <Text style={s.title}>Registro de Personal</Text>
            <Text style={s.codigo}>{codigo}</Text>
            <Text style={s.meta}>{orgNombre}</Text>
            <Text style={s.meta}>Instalacion: {rancho}</Text>
          </View>
          <View style={{ alignItems: 'flex-end' }}>
            <Text style={s.metaBold}>Fecha: {fmtFechaCorta(fechaPDF)}</Text>
            <Text style={[s.meta, { color: '#888', marginTop: 2 }]}>M.A.D.Y</Text>
          </View>
        </View>

        {/* ── Table ── */}
        <View style={{ border: '0.5pt solid #bbb' }}>

          {/* Group header row */}
          <View style={s.groupRow}>
            <Text style={[s.groupCell, { width: COL_NO }]}> </Text>
            <Text style={[s.groupCell, { width: COL_PUESTO + COL_NOMBRE + COL_DIR + COL_TCASA + COL_CEL + COL_FNAC }]}>
              Datos personales del trabajador
            </Text>
            <Text style={[s.groupCell, { width: COL_EM_NOM + COL_EM_PAR + COL_EM_TEL }]}>
              Contacto de emergencia
            </Text>
            {nDocs > 0 && (
              <Text style={[s.groupCell, { width: wDocs }]}>Documentacion personal</Text>
            )}
            {nCaps > 0 && (
              <Text style={[s.groupCell, { width: wCaps }]}>Capacitaciones</Text>
            )}
            <Text style={[s.groupCell, { width: COL_OBS, borderRight: 'none' }]}>Observaciones</Text>
          </View>

          {/* Column header row */}
          <View style={s.headRow}>
            <Text style={[s.th, { width: COL_NO }]}>No.</Text>
            <Text style={[s.th, { width: COL_PUESTO }]}>Puesto</Text>
            <Text style={[s.th, { width: COL_NOMBRE }]}>Nombre</Text>
            <Text style={[s.th, { width: COL_DIR }]}>Direccion</Text>
            <Text style={[s.th, { width: COL_TCASA }]}>Tel. Casa</Text>
            <Text style={[s.th, { width: COL_CEL }]}>Celular</Text>
            <Text style={[s.th, { width: COL_FNAC }]}>F. Nac. D/M/A</Text>
            <Text style={[s.th, { width: COL_EM_NOM }]}>Nombre</Text>
            <Text style={[s.th, { width: COL_EM_PAR }]}>Parentesco</Text>
            <Text style={[s.th, { width: COL_EM_TEL }]}>Telefono</Text>
            {documentos.map((d, i) => (
              <Text key={d.id} style={[s.th, { width: COL_ITEM, textAlign: 'center' }]}>
                {`D${i + 1}`}
              </Text>
            ))}
            {capacitaciones.map((c, i) => (
              <Text key={c.id} style={[s.th, { width: COL_ITEM, textAlign: 'center' }]}>
                {`C${i + 1}`}
              </Text>
            ))}
            <Text style={[s.th, { width: COL_OBS, borderRight: 'none' }]}>Observaciones</Text>
          </View>

          {/* Data rows */}
          {trabajadores.map((w, idx) => (
            <View key={idx} style={[s.tr, idx % 2 === 1 ? s.trAlt : {}]}>
              <Text style={[s.td, { width: COL_NO, textAlign: 'center' }]}>{w.numero}</Text>
              <Text style={[s.td, { width: COL_PUESTO }]}>{t(w.puesto)}</Text>
              <Text style={[s.td, { width: COL_NOMBRE, fontFamily: 'Helvetica-Bold' }]}>{w.nombre}</Text>
              <Text style={[s.td, { width: COL_DIR }]}>{t(w.direccion)}</Text>
              <Text style={[s.td, { width: COL_TCASA }]}>{t(w.telefono_casa)}</Text>
              <Text style={[s.td, { width: COL_CEL }]}>{t(w.celular)}</Text>
              <Text style={[s.tdC, { width: COL_FNAC }]}>{fmtFecha(w.fecha_nacimiento)}</Text>
              <Text style={[s.td, { width: COL_EM_NOM }]}>{t(w.emergencia_nombre)}</Text>
              <Text style={[s.td, { width: COL_EM_PAR }]}>{t(w.emergencia_parentesco)}</Text>
              <Text style={[s.td, { width: COL_EM_TEL }]}>{t(w.emergencia_telefono)}</Text>
              {documentos.map((d) => (
                <Text key={d.id} style={[s.tdC, { width: COL_ITEM }]}>
                  {w.checklist[d.id] ? 'Si' : ''}
                </Text>
              ))}
              {capacitaciones.map((c) => (
                <Text key={c.id} style={[s.tdC, { width: COL_ITEM }]}>
                  {w.checklist[c.id] ? 'Si' : ''}
                </Text>
              ))}
              <Text style={[s.td, { width: COL_OBS, borderRight: 'none' }]}>{t(w.observaciones)}</Text>
            </View>
          ))}
        </View>

        {/* ── Leyenda ── */}
        {(nDocs > 0 || nCaps > 0) && (
          <View style={s.legend}>
            {documentos.map((d, i) => (
              <Text key={d.id} style={s.legendItem}>{`D${i + 1}: ${d.nombre}`}</Text>
            ))}
            {capacitaciones.map((c, i) => (
              <Text key={c.id} style={s.legendItem}>{`C${i + 1}: ${c.nombre}`}</Text>
            ))}
          </View>
        )}

        {/* ── Firmas ── */}
        <View style={s.footer}>
          <View style={s.firma}>
            <Text>Responsable de Recursos Humanos</Text>
          </View>
          <View style={s.firma}>
            <Text>Jefe de la instalacion</Text>
          </View>
          <Text style={s.marca}>M.A.D.Y — DuoMind Solutions</Text>
        </View>

      </Page>
    </Document>
  )
}
