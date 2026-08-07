import { Document, Page, Text, View, StyleSheet } from '@react-pdf/renderer'

export interface M41LecturaPDF {
  hora: number
  temperatura: number | null
}

export interface M41RegistroDataPDF {
  orgNombre: string
  instalacion: string
  fecha: string
  temp_min: number | null
  temp_max: number | null
  observaciones: string | null
  lecturas: M41LecturaPDF[]
}

function fmtFecha(iso: string): string {
  try {
    const [y, m, d] = iso.split('-')
    return `${d}/${m}/${y}`
  } catch { return iso }
}

const t = (v: number | null | undefined): string => v != null ? String(v) : ''

const s = StyleSheet.create({
  page:     { fontFamily: 'Helvetica', fontSize: 7.5, padding: 20, backgroundColor: '#ffffff' },
  hdr:      { flexDirection: 'row', justifyContent: 'space-between', marginBottom: 6, alignItems: 'flex-start' },
  title:    { fontSize: 11, fontFamily: 'Helvetica-Bold', marginBottom: 1 },
  codigo:   { fontSize: 7, color: '#666666', marginBottom: 2 },
  meta:     { fontSize: 7.5, color: '#333333', marginBottom: 1 },
  secTitle: { fontSize: 7.5, fontFamily: 'Helvetica-Bold', marginBottom: 2, color: '#333333' },
  instr:    { fontSize: 7, color: '#555555', fontStyle: 'italic', marginBottom: 6 },
  table:    { borderTop: '1pt solid #cccccc', borderLeft: '1pt solid #cccccc', marginBottom: 8 },
  row:      { flexDirection: 'row', borderBottom: '1pt solid #cccccc' },
  lbl:      { fontFamily: 'Helvetica-Bold', padding: 3, borderRight: '1pt solid #cccccc', backgroundColor: '#f3f3f3', fontSize: 6.5, width: 42 },
  th:       { fontFamily: 'Helvetica-Bold', padding: 2, borderRight: '1pt solid #cccccc', backgroundColor: '#f3f3f3', fontSize: 6, flex: 1, textAlign: 'center' },
  td:       { padding: 3, borderRight: '1pt solid #cccccc', fontSize: 7, flex: 1, textAlign: 'center' },
  rango:    { flexDirection: 'row', gap: 16, marginBottom: 8 },
  rangoBox: { flexDirection: 'row', alignItems: 'center', gap: 4 },
  rangoLbl: { fontSize: 7, color: '#555555' },
  rangoVal: { fontSize: 8, fontFamily: 'Helvetica-Bold', color: '#222222' },
  footer:   { marginTop: 10, flexDirection: 'row', justifyContent: 'space-between', alignItems: 'flex-end' },
  firma:    { width: 200, borderTop: '1pt solid #000000', paddingTop: 3, fontSize: 6.5, textAlign: 'center' },
  marca:    { fontSize: 6.5, color: '#aaaaaa' },
})

const HORAS = Array.from({ length: 24 }, (_, i) => i + 1)

export function TemperaturaConservadorPDF({ d }: { d: M41RegistroDataPDF }) {
  const lecturaPorHora: Record<number, number | null> = {}
  for (const l of d.lecturas) lecturaPorHora[l.hora] = l.temperatura

  const rangoMin = d.temp_min != null ? `${d.temp_min} C` : '—'
  const rangoMax = d.temp_max != null ? `${d.temp_max} C` : '—'

  return (
    <Document>
      <Page size="A4" orientation="landscape" style={s.page}>

        {/* Encabezado */}
        <View style={s.hdr}>
          <View style={{ flex: 1 }}>
            <Text style={s.title}>Registro de Temperaturas del Conservador</Text>
            <Text style={s.codigo}>F-FRUS-PRO-05</Text>
            <Text style={s.meta}>{d.orgNombre}</Text>
            <Text style={s.meta}>Instalacion: {d.instalacion}</Text>
          </View>
          <View style={{ alignItems: 'flex-end' }}>
            <Text style={[s.meta, { fontFamily: 'Helvetica-Bold' }]}>Fecha: {fmtFecha(d.fecha)}</Text>
            <Text style={[s.meta, { fontSize: 6.5, color: '#888888', marginTop: 2 }]}>M.A.D.Y</Text>
          </View>
        </View>

        {/* Instruccion */}
        <Text style={s.instr}>
          Instruccion: revisar temperatura al iniciar turno y cada 2 horas durante la jornada.
        </Text>

        {/* Rango objetivo */}
        <View style={s.rango}>
          <View style={s.rangoBox}>
            <Text style={s.rangoLbl}>Temperatura minima objetivo:</Text>
            <Text style={s.rangoVal}>{rangoMin}</Text>
          </View>
          <View style={s.rangoBox}>
            <Text style={s.rangoLbl}>Temperatura maxima objetivo:</Text>
            <Text style={s.rangoVal}>{rangoMax}</Text>
          </View>
        </View>

        {/* Tabla 24 horas */}
        <Text style={s.secTitle}>Lecturas de temperatura por hora</Text>
        <View style={s.table}>
          {/* Header row: horas */}
          <View style={s.row}>
            <Text style={s.lbl}>Hora</Text>
            {HORAS.map(h => (
              <Text key={h} style={s.th}>{String(h).padStart(2, '0')}:00</Text>
            ))}
          </View>
          {/* Data row: temperaturas */}
          <View style={s.row}>
            <Text style={s.lbl}>Temp (C)</Text>
            {HORAS.map(h => (
              <Text key={h} style={s.td}>{t(lecturaPorHora[h])}</Text>
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
