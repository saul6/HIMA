import { Document, Page, Text, View, StyleSheet } from '@react-pdf/renderer'
import { codigoFormato } from '@/lib/codigoFormato'

export interface M39LineaAlmacenPDF {
  orden: number
  hora: string | null
  cultivo: string | null
  cajas: number | null
  piezas: number | null
  entrega: string | null
  limp_be: boolean | null
  limp_l: boolean | null
  limp_lp: boolean | null
  codigo_trazabilidad: string | null
}

export interface M39RecepcionAlmacenDataPDF {
  orgNombre: string
  instalacion: string
  fecha: string
  hoja_no: string | null
  empresa: string | null
  observaciones: string | null
  lineas: M39LineaAlmacenPDF[]
}

function fmtFecha(iso: string): string {
  try {
    const [y, m, d] = iso.split('-')
    return `${d}/${m}/${y}`
  } catch { return iso }
}

const t = (v: string | null | undefined): string => v ?? '—'
const n = (v: number | null | undefined): string => v != null ? String(v) : '—'
const b3 = (v: boolean | null): string => v === true ? 'Si' : v === false ? 'No' : '—'

const s = StyleSheet.create({
  page:     { fontFamily: 'Helvetica', fontSize: 7.5, padding: 20, backgroundColor: '#ffffff' },
  hdr:      { flexDirection: 'row', justifyContent: 'space-between', marginBottom: 8, alignItems: 'flex-start' },
  title:    { fontSize: 12, fontFamily: 'Helvetica-Bold', marginBottom: 1 },
  codigo:   { fontSize: 7, color: '#666666', marginBottom: 3 },
  meta:     { fontSize: 7.5, color: '#333333', marginBottom: 1 },
  secTitle: { fontSize: 7.5, fontFamily: 'Helvetica-Bold', marginBottom: 3, color: '#333333' },
  table:    { borderTop: '1pt solid #cccccc', borderLeft: '1pt solid #cccccc', marginBottom: 8 },
  row:      { flexDirection: 'row', borderBottom: '1pt solid #cccccc' },
  th:       { fontFamily: 'Helvetica-Bold', padding: 3, borderRight: '1pt solid #cccccc', backgroundColor: '#f3f3f3', fontSize: 6 },
  td:       { padding: 3, borderRight: '1pt solid #cccccc', fontSize: 7 },
  invBlock: { flexDirection: 'row', flexWrap: 'wrap', gap: 8, marginBottom: 8 },
  invBox:   { backgroundColor: '#f3f3f3', padding: 7, minWidth: 100 },
  invLbl:   { fontSize: 7, fontFamily: 'Helvetica-Bold', color: '#333333', marginBottom: 4 },
  invRow:   { flexDirection: 'row', justifyContent: 'space-between', marginBottom: 2, gap: 8 },
  invKey:   { fontSize: 7, color: '#555555' },
  invVal:   { fontSize: 7, fontFamily: 'Helvetica-Bold', color: '#222222' },
  footer:   { marginTop: 14, flexDirection: 'row', justifyContent: 'space-between', alignItems: 'flex-end' },
  firma:    { width: 200, borderTop: '1pt solid #000000', paddingTop: 3, fontSize: 6.5, textAlign: 'center' },
  marca:    { fontSize: 6.5, color: '#aaaaaa' },
})

export function RecepcionFrutaAlmacenPDF({ d, codigoClave }: { d: M39RecepcionAlmacenDataPDF; codigoClave: string }) {
  const invCultivo: Record<string, { cajas: number; piezas: number }> = {}
  for (const l of d.lineas) {
    const k = l.cultivo?.trim() || 'Sin cultivo'
    if (!invCultivo[k]) invCultivo[k] = { cajas: 0, piezas: 0 }
    invCultivo[k].cajas += l.cajas ?? 0
    invCultivo[k].piezas += l.piezas ?? 0
  }
  const cultivoEntries = Object.entries(invCultivo)

  return (
    <Document>
      <Page size="A4" orientation="landscape" style={s.page}>

        <View style={s.hdr}>
          <View style={{ flex: 1 }}>
            <Text style={s.title}>Recepcion Diaria de Fruta</Text>
            <Text style={s.codigo}>{codigoFormato('F-FRUS-PRO-02', codigoClave)}</Text>
            <Text style={s.meta}>{d.orgNombre}</Text>
            <Text style={s.meta}>Instalacion: {d.instalacion}</Text>
            {d.empresa ? <Text style={s.meta}>Empresa: {d.empresa}</Text> : null}
          </View>
          <View style={{ alignItems: 'flex-end' }}>
            <Text style={[s.meta, { fontFamily: 'Helvetica-Bold' }]}>Fecha: {fmtFecha(d.fecha)}</Text>
            {d.hoja_no ? <Text style={s.meta}>Hoja No.: {d.hoja_no}</Text> : null}
            <Text style={[s.meta, { fontSize: 6.5, color: '#888888', marginTop: 2 }]}>M.A.D.Y</Text>
          </View>
        </View>

        <Text style={s.secTitle}>Lineas de recepcion</Text>
        <View style={s.table}>
          <View style={s.row}>
            <Text style={[s.th, { width: 22 }]}>No.</Text>
            <Text style={[s.th, { width: 36 }]}>Hora</Text>
            <Text style={[s.th, { flex: 1 }]}>Cultivo</Text>
            <Text style={[s.th, { width: 34 }]}>Cajas</Text>
            <Text style={[s.th, { width: 34 }]}>Piezas</Text>
            <Text style={[s.th, { width: 48 }]}>Entrega</Text>
            <Text style={[s.th, { width: 34 }]}>Limp. BE</Text>
            <Text style={[s.th, { width: 34 }]}>Limp. L</Text>
            <Text style={[s.th, { width: 34 }]}>Limp. LP</Text>
            <Text style={[s.th, { width: 78 }]}>Cod. Trazabilidad</Text>
          </View>
          {d.lineas.map((l, i) => (
            <View key={i} style={s.row}>
              <Text style={[s.td, { width: 22 }]}>{l.orden}</Text>
              <Text style={[s.td, { width: 36 }]}>{t(l.hora)}</Text>
              <Text style={[s.td, { flex: 1 }]}>{t(l.cultivo)}</Text>
              <Text style={[s.td, { width: 34 }]}>{n(l.cajas)}</Text>
              <Text style={[s.td, { width: 34 }]}>{n(l.piezas)}</Text>
              <Text style={[s.td, { width: 48 }]}>{t(l.entrega)}</Text>
              <Text style={[s.td, { width: 34, textAlign: 'center' }]}>{b3(l.limp_be)}</Text>
              <Text style={[s.td, { width: 34, textAlign: 'center' }]}>{b3(l.limp_l)}</Text>
              <Text style={[s.td, { width: 34, textAlign: 'center' }]}>{b3(l.limp_lp)}</Text>
              <Text style={[s.td, { width: 78 }]}>{t(l.codigo_trazabilidad)}</Text>
            </View>
          ))}
        </View>

        {cultivoEntries.length > 0 && (
          <View style={{ marginBottom: 8 }}>
            <Text style={s.secTitle}>Inventario por cultivo</Text>
            <View style={s.invBlock}>
              {cultivoEntries.map(([cultivo, tot]) => (
                <View key={cultivo} style={s.invBox}>
                  <Text style={s.invLbl}>{cultivo}</Text>
                  <View style={s.invRow}>
                    <Text style={s.invKey}>Cajas:</Text>
                    <Text style={s.invVal}>{tot.cajas}</Text>
                  </View>
                  <View style={s.invRow}>
                    <Text style={s.invKey}>Piezas:</Text>
                    <Text style={s.invVal}>{tot.piezas}</Text>
                  </View>
                </View>
              ))}
            </View>
          </View>
        )}

        {d.observaciones ? (
          <View style={{ marginBottom: 8 }}>
            <Text style={s.secTitle}>Observaciones</Text>
            <Text style={{ fontSize: 7.5, color: '#333333' }}>{d.observaciones}</Text>
          </View>
        ) : null}

        <View style={s.footer}>
          <View style={s.firma}>
            <Text>Responsable Empaque</Text>
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
