import { Document, Page, Text, View, StyleSheet } from '@react-pdf/renderer'
import { codigoFormato } from '@/lib/codigoFormato'

export interface M42MovimientoPDF {
  orgNombre: string
  instalacion: string
  empresa: string | null
  fecha: string
  descripcion_material: string | null
  entrada: number | null
  salida: number | null
  total: number | null
  entrega: string | null
  recibe: string | null
  mat_integro: boolean
  mat_buen_estado: boolean
  mat_limpio: boolean
  mat_libre_olores: boolean
  mat_libre_plagas: boolean
  mat_otros: string | null
  tr_integro: boolean
  tr_buen_estado: boolean
  tr_limpio: boolean
  tr_libre_olores: boolean
  tr_libre_plagas: boolean
  tr_otros: string | null
  observaciones: string | null
}

function fmtFecha(iso: string): string {
  try {
    const [y, m, d] = iso.split('-')
    return `${d}/${m}/${y}`
  } catch { return iso }
}

const sn = (v: boolean) => v ? 'Si' : 'No'
const nn = (v: number | null | undefined) => v != null ? String(v) : '—'

const s = StyleSheet.create({
  page:     { fontFamily: 'Helvetica', fontSize: 7.5, padding: 20, backgroundColor: '#ffffff' },
  hdr:      { flexDirection: 'row', justifyContent: 'space-between', marginBottom: 6, alignItems: 'flex-start' },
  title:    { fontSize: 11, fontFamily: 'Helvetica-Bold', marginBottom: 1 },
  codigo:   { fontSize: 7, color: '#666666', marginBottom: 2 },
  meta:     { fontSize: 7.5, color: '#333333', marginBottom: 1 },
  section:  { marginBottom: 8 },
  secTitle: { fontSize: 7.5, fontFamily: 'Helvetica-Bold', marginBottom: 3, color: '#333333' },
  table:    { borderTop: '1pt solid #cccccc', borderLeft: '1pt solid #cccccc', marginBottom: 8 },
  row:      { flexDirection: 'row', borderBottom: '1pt solid #cccccc' },
  th:       { fontFamily: 'Helvetica-Bold', padding: 3, borderRight: '1pt solid #cccccc', backgroundColor: '#f3f3f3', fontSize: 6.5 },
  td:       { padding: 3, borderRight: '1pt solid #cccccc', fontSize: 7 },
  chklRow:  { flexDirection: 'row', marginBottom: 2 },
  chklLbl:  { fontSize: 7, color: '#555555', width: 110 },
  chklVal:  { fontSize: 7, fontFamily: 'Helvetica-Bold' },
  row2col:  { flexDirection: 'row', gap: 16, marginBottom: 8 },
  col:      { flex: 1, borderTop: '1pt solid #cccccc', borderLeft: '1pt solid #cccccc', borderRight: '1pt solid #cccccc', borderBottom: '1pt solid #cccccc', padding: 6 },
  colTitle: { fontSize: 7.5, fontFamily: 'Helvetica-Bold', marginBottom: 4, color: '#333333' },
  footer:   { marginTop: 10, flexDirection: 'row', justifyContent: 'space-between', alignItems: 'flex-end' },
  firma:    { width: 200, borderTop: '1pt solid #000000', paddingTop: 3, fontSize: 6.5, textAlign: 'center' },
  marca:    { fontSize: 6.5, color: '#aaaaaa' },
})

function ChecklistBlock({ d, tipo }: { d: M42MovimientoPDF; tipo: 'mat' | 'tr' }) {
  const integro    = tipo === 'mat' ? d.mat_integro    : d.tr_integro
  const buen       = tipo === 'mat' ? d.mat_buen_estado : d.tr_buen_estado
  const limpio     = tipo === 'mat' ? d.mat_limpio     : d.tr_limpio
  const olores     = tipo === 'mat' ? d.mat_libre_olores : d.tr_libre_olores
  const plagas     = tipo === 'mat' ? d.mat_libre_plagas : d.tr_libre_plagas
  const otros      = tipo === 'mat' ? d.mat_otros      : d.tr_otros
  const titulo     = tipo === 'mat' ? 'Condicion del material' : 'Condicion del transporte'

  return (
    <View style={s.col}>
      <Text style={s.colTitle}>{titulo}</Text>
      {[
        ['Integro', integro],
        ['En buen estado', buen],
        ['Limpio', limpio],
        ['Libre de malos olores', olores],
        ['Libre de plagas', plagas],
      ].map(([label, val]) => (
        <View key={label as string} style={s.chklRow}>
          <Text style={s.chklLbl}>{label as string}:</Text>
          <Text style={[s.chklVal, { color: val ? '#1a5276' : '#922b21' }]}>{sn(val as boolean)}</Text>
        </View>
      ))}
      {otros ? (
        <View style={{ marginTop: 3 }}>
          <Text style={{ fontSize: 6.5, color: '#555555' }}>Otros: {otros}</Text>
        </View>
      ) : null}
    </View>
  )
}

export function MaterialEmpaquePDF({ d, codigoClave }: { d: M42MovimientoPDF; codigoClave: string }) {
  return (
    <Document>
      <Page size="A4" orientation="landscape" style={s.page}>

        {/* Encabezado */}
        <View style={s.hdr}>
          <View style={{ flex: 1 }}>
            <Text style={s.title}>Entradas y Salidas de Material de Empaque</Text>
            <Text style={s.codigo}>{codigoFormato('F-FRUS-PRO-03', codigoClave)}</Text>
            <Text style={s.meta}>{d.orgNombre}</Text>
            <Text style={s.meta}>Instalacion: {d.instalacion}</Text>
            {d.empresa ? <Text style={s.meta}>Empresa: {d.empresa}</Text> : null}
          </View>
          <View style={{ alignItems: 'flex-end' }}>
            <Text style={[s.meta, { fontFamily: 'Helvetica-Bold' }]}>Fecha: {fmtFecha(d.fecha)}</Text>
            <Text style={[s.meta, { fontSize: 6.5, color: '#888888', marginTop: 2 }]}>M.A.D.Y</Text>
          </View>
        </View>

        {/* Datos del movimiento */}
        <View style={s.table}>
          <View style={s.row}>
            <Text style={[s.th, { width: 90 }]}>Descripcion del material</Text>
            <Text style={[s.th, { width: 45 }]}>Entrada</Text>
            <Text style={[s.th, { width: 45 }]}>Salida</Text>
            <Text style={[s.th, { width: 45 }]}>Total</Text>
            <Text style={[s.th, { flex: 1 }]}>Entrega</Text>
            <Text style={[s.th, { flex: 1 }]}>Recibe</Text>
          </View>
          <View style={s.row}>
            <Text style={[s.td, { width: 90 }]}>{d.descripcion_material ?? '—'}</Text>
            <Text style={[s.td, { width: 45, textAlign: 'center' }]}>{nn(d.entrada)}</Text>
            <Text style={[s.td, { width: 45, textAlign: 'center' }]}>{nn(d.salida)}</Text>
            <Text style={[s.td, { width: 45, textAlign: 'center' }]}>{nn(d.total)}</Text>
            <Text style={[s.td, { flex: 1 }]}>{d.entrega ?? '—'}</Text>
            <Text style={[s.td, { flex: 1 }]}>{d.recibe ?? '—'}</Text>
          </View>
        </View>

        {/* Checklists */}
        <View style={s.row2col}>
          <ChecklistBlock d={d} tipo="mat" />
          <ChecklistBlock d={d} tipo="tr" />
        </View>

        {/* Observaciones */}
        {d.observaciones ? (
          <View style={s.section}>
            <Text style={s.secTitle}>Observaciones</Text>
            <Text style={{ fontSize: 7.5, color: '#333333' }}>{d.observaciones}</Text>
          </View>
        ) : null}

        {/* Firmas */}
        <View style={s.footer}>
          <View style={s.firma}>
            <Text>Responsable de la instalacion</Text>
          </View>
          <View style={s.firma}>
            <Text>Responsable de la empresa</Text>
          </View>
          <Text style={s.marca}>M.A.D.Y · Inocuidad Inteligente</Text>
        </View>

      </Page>
    </Document>
  )
}
