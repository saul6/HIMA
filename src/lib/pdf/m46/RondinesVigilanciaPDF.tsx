import { Document, Page, Text, View, StyleSheet } from '@react-pdf/renderer'
import { codigoFormato } from '@/lib/codigoFormato'

export interface M46ItemPDF {
  id: string
  area: string
  nombre: string
}

export interface M46RondaPDF {
  numero: number
  hora: string | null
}

export interface M46ResultadoPDF {
  item_id: string
  ronda: number
  valor: 'sin_novedad' | 'con_novedad'
}

interface Props {
  rancho: string
  fecha: string
  turno: string | null
  vigilante: string
  jefe_seguridad: string | null
  observaciones: string | null
  items: M46ItemPDF[]
  rondas: M46RondaPDF[]
  resultados: M46ResultadoPDF[]
  codigoClave: string
}

const COL_PUNTO = 220
const COL_RONDA = 78

const s = StyleSheet.create({
  page: { fontFamily: 'Helvetica', fontSize: 8, padding: 30, color: '#222' },
  titulo: { fontSize: 11, fontFamily: 'Helvetica-Bold', textAlign: 'center', marginBottom: 2 },
  codigo: { fontSize: 7.5, textAlign: 'center', marginBottom: 8, color: '#555' },
  infoRow: { flexDirection: 'row', gap: 8, marginBottom: 5 },
  infoBlock: { flex: 1 },
  label: { fontFamily: 'Helvetica-Bold', fontSize: 7, color: '#666' },
  value: { fontSize: 8, marginTop: 1 },
  table: { border: '0.5 solid #bbb', marginTop: 10 },
  thead: { flexDirection: 'row', backgroundColor: '#dce8f5' },
  th: {
    fontFamily: 'Helvetica-Bold', fontSize: 7, padding: 4,
    borderRight: '0.5 solid #bbb', borderBottom: '0.5 solid #bbb',
  },
  areaHeader: {
    flexDirection: 'row', backgroundColor: '#f0f0f0',
    borderBottom: '0.5 solid #ddd',
  },
  areaLabel: { fontFamily: 'Helvetica-Bold', fontSize: 7, padding: '3 4', flex: 1 },
  tr: { flexDirection: 'row', borderBottom: '0.5 solid #eee' },
  trAlt: { backgroundColor: '#fafafa' },
  td: { fontSize: 7, padding: 4, borderRight: '0.5 solid #eee' },
  tdNovedad: { fontSize: 7, padding: 4, borderRight: '0.5 solid #eee', color: '#c02a2a', fontFamily: 'Helvetica-Bold' },
  obs: { marginTop: 10 },
  firmasRow: { flexDirection: 'row', gap: 20, marginTop: 24 },
  firma: { flex: 1, borderTop: '0.5 solid #555', paddingTop: 5, fontSize: 7, color: '#555' },
  footer: { marginTop: 14, fontSize: 7, textAlign: 'center', color: '#aaa' },
})

function fmtFecha(f: string): string {
  try {
    const [y, m, d] = f.split('-')
    return `${d}/${m}/${y}`
  } catch { return f }
}

export function RondinesVigilanciaPDF({
  rancho, fecha, turno, vigilante, jefe_seguridad, observaciones,
  items, rondas, resultados, codigoClave,
}: Props) {
  const codigo = codigoFormato('F-FRUS-ADM-07', codigoClave)

  const areas = Array.from(new Set(items.map((i) => i.area)))

  const resMap: Record<string, string> = {}
  for (const r of resultados) {
    resMap[`${r.item_id}|${r.ronda}`] = r.valor
  }

  const horaMap: Record<number, string> = {}
  for (const r of rondas) {
    horaMap[r.numero] = r.hora ?? '—'
  }

  const RONDAS = [1, 2, 3, 4]

  return (
    <Document>
      <Page size="A4" style={s.page}>
        <Text style={s.titulo}>Bitacora de Rondines de Vigilancia</Text>
        <Text style={s.codigo}>{codigo}  |  M.A.D.Y — DuoMind Solutions</Text>

        <View style={s.infoRow}>
          <View style={s.infoBlock}>
            <Text style={s.label}>Instalacion:</Text>
            <Text style={s.value}>{rancho}</Text>
          </View>
          <View style={s.infoBlock}>
            <Text style={s.label}>Fecha:</Text>
            <Text style={s.value}>{fmtFecha(fecha)}</Text>
          </View>
          <View style={s.infoBlock}>
            <Text style={s.label}>Turno:</Text>
            <Text style={s.value}>{turno ?? '—'}</Text>
          </View>
        </View>
        <View style={s.infoRow}>
          <View style={s.infoBlock}>
            <Text style={s.label}>Vigilante:</Text>
            <Text style={s.value}>{vigilante}</Text>
          </View>
          <View style={s.infoBlock}>
            <Text style={s.label}>Jefe de Seguridad:</Text>
            <Text style={s.value}>{jefe_seguridad ?? '—'}</Text>
          </View>
          <View style={s.infoBlock} />
        </View>

        {/* Tabla */}
        <View style={s.table}>
          {/* Encabezado */}
          <View style={s.thead}>
            <Text style={[s.th, { width: COL_PUNTO }]}>Area / Punto de supervision</Text>
            {RONDAS.map((n) => (
              <Text key={n} style={[s.th, { width: COL_RONDA, textAlign: 'center' }]}>
                {`Ronda ${n}\n${horaMap[n] ?? '—'}`}
              </Text>
            ))}
          </View>

          {/* Filas por área */}
          {areas.map((area) => {
            const areaItems = items.filter((i) => i.area === area)
            return (
              <View key={area}>
                <View style={s.areaHeader}>
                  <Text style={s.areaLabel}>{area}</Text>
                </View>
                {areaItems.map((item, idx) => (
                  <View key={item.id} style={[s.tr, idx % 2 === 1 ? s.trAlt : {}]}>
                    <Text style={[s.td, { width: COL_PUNTO }]}>{item.nombre}</Text>
                    {RONDAS.map((n) => {
                      const val = resMap[`${item.id}|${n}`] ?? 'sin_novedad'
                      const esNovedad = val === 'con_novedad'
                      return (
                        <Text
                          key={n}
                          style={[esNovedad ? s.tdNovedad : s.td, { width: COL_RONDA, textAlign: 'center' }]}
                        >
                          {esNovedad ? 'Con novedad' : 'Sin novedad'}
                        </Text>
                      )
                    })}
                  </View>
                ))}
              </View>
            )
          })}
        </View>

        {observaciones && (
          <View style={s.obs}>
            <Text style={[s.label, { marginBottom: 2 }]}>Observaciones:</Text>
            <Text style={s.value}>{observaciones}</Text>
          </View>
        )}

        <View style={s.firmasRow}>
          <View style={s.firma}>
            <Text>Firma del vigilante</Text>
          </View>
          <View style={s.firma}>
            <Text>Jefe de Seguridad</Text>
          </View>
        </View>

        <Text style={s.footer}>M.A.D.Y — DuoMind Solutions</Text>
      </Page>
    </Document>
  )
}
