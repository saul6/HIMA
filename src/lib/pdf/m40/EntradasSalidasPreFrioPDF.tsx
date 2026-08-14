import { Document, Page, Text, View, StyleSheet } from '@react-pdf/renderer'
import { codigoFormato } from '@/lib/codigoFormato'

export interface M40LineaPDF {
  orden: number
  cuarto_prefrio: string | null
  fruta: string | null
  presentacion: string | null
  num_tarimas: number | null
  restos: string | null
  entrada_hora: string | null
  entrada_temp: number | null
  salida_hora: string | null
  salida_temp: number | null
  tiempo_total: string | null
}

export interface M40RegistroDataPDF {
  orgNombre: string
  instalacion: string
  fecha: string
  empresa: string | null
  observaciones: string | null
  lineas: M40LineaPDF[]
}

function fmtFecha(iso: string): string {
  try {
    const [y, m, d] = iso.split('-')
    return `${d}/${m}/${y}`
  } catch { return iso }
}

const t = (v: string | null | undefined): string => v ?? '—'
const n = (v: number | null | undefined): string => v != null ? String(v) : '—'

const s = StyleSheet.create({
  page:     { fontFamily: 'Helvetica', fontSize: 7.5, padding: 20, backgroundColor: '#ffffff' },
  hdr:      { flexDirection: 'row', justifyContent: 'space-between', marginBottom: 8, alignItems: 'flex-start' },
  title:    { fontSize: 11, fontFamily: 'Helvetica-Bold', marginBottom: 1 },
  codigo:   { fontSize: 7, color: '#666666', marginBottom: 3 },
  meta:     { fontSize: 7.5, color: '#333333', marginBottom: 1 },
  secTitle: { fontSize: 7.5, fontFamily: 'Helvetica-Bold', marginBottom: 3, color: '#333333' },
  table:    { borderTop: '1pt solid #cccccc', borderLeft: '1pt solid #cccccc', marginBottom: 10 },
  row:      { flexDirection: 'row', borderBottom: '1pt solid #cccccc' },
  th:       { fontFamily: 'Helvetica-Bold', padding: 3, borderRight: '1pt solid #cccccc', backgroundColor: '#f3f3f3', fontSize: 6.5, textAlign: 'center' },
  td:       { padding: 3, borderRight: '1pt solid #cccccc', fontSize: 7 },
  footer:   { marginTop: 14, flexDirection: 'row', justifyContent: 'space-between', alignItems: 'flex-end' },
  firma:    { width: 200, borderTop: '1pt solid #000000', paddingTop: 3, fontSize: 6.5, textAlign: 'center' },
  marca:    { fontSize: 6.5, color: '#aaaaaa' },
})

const W = { cuarto: 60, fruta: 60, pres: 55, tar: 28, restos: 40, hora: 30, temp: 28, tiempo: 34 }

export function EntradasSalidasPreFrioPDF({ d, codigoClave }: { d: M40RegistroDataPDF; codigoClave: string }) {
  return (
    <Document>
      <Page size="A4" orientation="landscape" style={s.page}>

        {/* Encabezado */}
        <View style={s.hdr}>
          <View style={{ flex: 1 }}>
            <Text style={s.title}>Entradas y Salidas de Producto en Pre-enfriamiento</Text>
            <Text style={s.codigo}>{codigoFormato('F-FRUS-PRO-04', codigoClave)}</Text>
            <Text style={s.meta}>{d.orgNombre}</Text>
            <Text style={s.meta}>Instalacion: {d.instalacion}</Text>
            {d.empresa ? <Text style={s.meta}>Empresa: {d.empresa}</Text> : null}
          </View>
          <View style={{ alignItems: 'flex-end' }}>
            <Text style={[s.meta, { fontFamily: 'Helvetica-Bold' }]}>Fecha: {fmtFecha(d.fecha)}</Text>
            <Text style={[s.meta, { fontSize: 6.5, color: '#888888', marginTop: 2 }]}>M.A.D.Y</Text>
          </View>
        </View>

        {/* Tabla de lineas */}
        <View style={s.table}>
          <View style={s.row}>
            <Text style={[s.th, { width: 22 }]}>No.</Text>
            <Text style={[s.th, { width: W.cuarto }]}>Cuarto Pre-frio</Text>
            <Text style={[s.th, { width: W.fruta }]}>Fruta</Text>
            <Text style={[s.th, { width: W.pres }]}>Presentacion</Text>
            <Text style={[s.th, { width: W.tar }]}>Tarimas</Text>
            <Text style={[s.th, { width: W.restos }]}>Restos</Text>
            <Text style={[s.th, { width: W.hora }]}>E. Hora</Text>
            <Text style={[s.th, { width: W.temp }]}>E. Temp</Text>
            <Text style={[s.th, { width: W.hora }]}>S. Hora</Text>
            <Text style={[s.th, { width: W.temp }]}>S. Temp</Text>
            <Text style={[s.th, { width: W.tiempo }]}>Tiempo</Text>
          </View>
          {d.lineas.map((l, i) => (
            <View key={i} style={s.row}>
              <Text style={[s.td, { width: 22 }]}>{l.orden}</Text>
              <Text style={[s.td, { width: W.cuarto }]}>{t(l.cuarto_prefrio)}</Text>
              <Text style={[s.td, { width: W.fruta }]}>{t(l.fruta)}</Text>
              <Text style={[s.td, { width: W.pres }]}>{t(l.presentacion)}</Text>
              <Text style={[s.td, { width: W.tar }]}>{n(l.num_tarimas)}</Text>
              <Text style={[s.td, { width: W.restos }]}>{t(l.restos)}</Text>
              <Text style={[s.td, { width: W.hora }]}>{t(l.entrada_hora)}</Text>
              <Text style={[s.td, { width: W.temp }]}>{n(l.entrada_temp)}</Text>
              <Text style={[s.td, { width: W.hora }]}>{t(l.salida_hora)}</Text>
              <Text style={[s.td, { width: W.temp }]}>{n(l.salida_temp)}</Text>
              <Text style={[s.td, { width: W.tiempo }]}>{t(l.tiempo_total)}</Text>
            </View>
          ))}
        </View>

        {/* Observaciones */}
        {d.observaciones ? (
          <View style={{ marginBottom: 10 }}>
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
          <Text style={s.marca}>M.A.D.Y — DuoMind Solutions</Text>
        </View>

      </Page>
    </Document>
  )
}
