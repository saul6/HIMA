import { Document, Page, Text, View, StyleSheet } from '@react-pdf/renderer'

export interface M39LineaPDF {
  orden: number
  hora: string | null
  codigo_productor: string | null
  tipo: 'organico' | 'convencional'
  pase_anden: boolean
  producto: string | null
  cant_6oz: number | null
  cant_12oz: number | null
  cant_18oz: number | null
}

export interface M39RecepcionDataPDF {
  orgNombre: string
  instalacion: string
  fecha: string
  empresa: string | null
  observaciones: string | null
  lineas: M39LineaPDF[]
}

function fmtFecha(iso: string): string {
  try {
    const [y, m, d] = iso.split('-')
    return `${d}/${m}/${y}`
  } catch { return iso }
}

const t = (v: string | null | undefined): string => v ?? '—'
const n = (v: number | null | undefined): string => v != null ? String(v) : '0'

const s = StyleSheet.create({
  page:     { fontFamily: 'Helvetica', fontSize: 7.5, padding: 20, backgroundColor: '#ffffff' },
  hdr:      { flexDirection: 'row', justifyContent: 'space-between', marginBottom: 8, alignItems: 'flex-start' },
  title:    { fontSize: 12, fontFamily: 'Helvetica-Bold', marginBottom: 1 },
  codigo:   { fontSize: 7, color: '#666666', marginBottom: 3 },
  meta:     { fontSize: 7.5, color: '#333333', marginBottom: 1 },
  secTitle: { fontSize: 7.5, fontFamily: 'Helvetica-Bold', marginBottom: 3, color: '#333333' },
  table:    { borderTop: '1pt solid #cccccc', borderLeft: '1pt solid #cccccc', marginBottom: 8 },
  row:      { flexDirection: 'row', borderBottom: '1pt solid #cccccc' },
  th:       { fontFamily: 'Helvetica-Bold', padding: 3, borderRight: '1pt solid #cccccc', backgroundColor: '#f3f3f3', fontSize: 6.5 },
  td:       { padding: 3, borderRight: '1pt solid #cccccc', fontSize: 7 },
  totBlock: { flexDirection: 'row', gap: 12, marginBottom: 8 },
  totBox:   { flex: 1, backgroundColor: '#f3f3f3', padding: 7 },
  totBoxLbl:{ fontSize: 7, fontFamily: 'Helvetica-Bold', color: '#333333', marginBottom: 4 },
  totRow:   { flexDirection: 'row', justifyContent: 'space-between', marginBottom: 2 },
  totKey:   { fontSize: 7, color: '#555555' },
  totVal:   { fontSize: 7, fontFamily: 'Helvetica-Bold', color: '#222222' },
  footer:   { marginTop: 14, flexDirection: 'row', justifyContent: 'space-between', alignItems: 'flex-end' },
  firma:    { width: 200, borderTop: '1pt solid #000000', paddingTop: 3, fontSize: 6.5, textAlign: 'center' },
  marca:    { fontSize: 6.5, color: '#aaaaaa' },
})

export function RecepcionFrutaPDF({ d }: { d: M39RecepcionDataPDF }) {
  const sumAll = (field: keyof M39LineaPDF) =>
    d.lineas.reduce((acc, l) => acc + ((l[field] as number) ?? 0), 0)
  const sumAnden = (field: keyof M39LineaPDF) =>
    d.lineas.filter(l => l.pase_anden).reduce((acc, l) => acc + ((l[field] as number) ?? 0), 0)

  const t6 = sumAll('cant_6oz');  const t12 = sumAll('cant_12oz');  const t18 = sumAll('cant_18oz')
  const a6 = sumAnden('cant_6oz'); const a12 = sumAnden('cant_12oz'); const a18 = sumAnden('cant_18oz')

  return (
    <Document>
      <Page size="A4" orientation="landscape" style={s.page}>

        {/* Encabezado */}
        <View style={s.hdr}>
          <View style={{ flex: 1 }}>
            <Text style={s.title}>Recepcion Diaria de Fruta</Text>
            <Text style={s.codigo}>F-FRUS-PRO-02</Text>
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
        <Text style={s.secTitle}>Lineas de recepcion</Text>
        <View style={s.table}>
          <View style={s.row}>
            <Text style={[s.th, { width: 22 }]}>No.</Text>
            <Text style={[s.th, { width: 38 }]}>Hora</Text>
            <Text style={[s.th, { width: 62 }]}>Cod. Productor</Text>
            <Text style={[s.th, { width: 36 }]}>Tipo</Text>
            <Text style={[s.th, { width: 44 }]}>Pase Anden</Text>
            <Text style={[s.th, { flex: 1 }]}>Producto</Text>
            <Text style={[s.th, { width: 36 }]}>6 oz</Text>
            <Text style={[s.th, { width: 36 }]}>12 oz</Text>
            <Text style={[s.th, { width: 36 }]}>18 oz</Text>
          </View>
          {d.lineas.map((l, i) => (
            <View key={i} style={s.row}>
              <Text style={[s.td, { width: 22 }]}>{l.orden}</Text>
              <Text style={[s.td, { width: 38 }]}>{t(l.hora)}</Text>
              <Text style={[s.td, { width: 62 }]}>{t(l.codigo_productor)}</Text>
              <Text style={[s.td, { width: 36 }]}>{l.tipo === 'organico' ? 'Org' : 'Conv'}</Text>
              <Text style={[s.td, { width: 44 }]}>{l.pase_anden ? 'Si' : 'No'}</Text>
              <Text style={[s.td, { flex: 1 }]}>{t(l.producto)}</Text>
              <Text style={[s.td, { width: 36 }]}>{n(l.cant_6oz)}</Text>
              <Text style={[s.td, { width: 36 }]}>{n(l.cant_12oz)}</Text>
              <Text style={[s.td, { width: 36 }]}>{n(l.cant_18oz)}</Text>
            </View>
          ))}
        </View>

        {/* Bloques de totales */}
        <View style={s.totBlock}>
          <View style={s.totBox}>
            <Text style={s.totBoxLbl}>Inventario total recepcion del dia</Text>
            {([['6 oz', t6], ['12 oz', t12], ['18 oz', t18]] as const).map(([lbl, val]) => (
              <View key={lbl} style={s.totRow}>
                <Text style={s.totKey}>{lbl}</Text>
                <Text style={s.totVal}>{val}</Text>
              </View>
            ))}
          </View>
          <View style={s.totBox}>
            <Text style={s.totBoxLbl}>Inventario total pase aduanal</Text>
            {([['6 oz', a6], ['12 oz', a12], ['18 oz', a18]] as const).map(([lbl, val]) => (
              <View key={lbl} style={s.totRow}>
                <Text style={s.totKey}>{lbl}</Text>
                <Text style={s.totVal}>{val}</Text>
              </View>
            ))}
          </View>
        </View>

        {/* Observaciones */}
        {d.observaciones ? (
          <View style={{ marginBottom: 8 }}>
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
