import { Document, Page, Text, View, StyleSheet } from '@react-pdf/renderer'
import { codigoFormato } from '@/lib/codigoFormato'

export interface M38LineaPDF {
  orden: number
  tarima: string
  producto: string
  presentacion: string
  cajas: number | null
  temp_superior: number | null
  temp_medio: number | null
  temp_inferior: number | null
}

export interface M38ManifiestoDataPDF {
  orgNombre: string
  instalacion: string
  fecha: string
  folio: string | null
  empresa: string | null
  linea_transportista: string | null
  nombre_chofer: string | null
  placas_tractor: string | null
  caja_pies: string | null
  econ_tractor: string | null
  econ_caja: string | null
  num_sello: string | null
  num_chismografo: string | null
  llegada_hora: string | null
  llegada_temp: number | null
  carga_hora: string | null
  carga_temp: number | null
  salida_hora: string | null
  salida_temp: number | null
  cond_buen_estado: boolean
  cond_limpio: boolean
  cond_presencia_plagas: boolean
  tar_remontado: string
  tar_flejado: string
  tar_limpieza: string
  tar_condicion: string
  tar_distribucion: string
  lineas: M38LineaPDF[]
  observaciones: string | null
}

function fmtFecha(iso: string): string {
  try {
    const [y, m, d] = iso.split('-')
    return `${d}/${m}/${y}`
  } catch { return iso }
}

const t = (v: string | null | undefined): string => v ?? '—'
const n = (v: number | null | undefined): string => v != null ? String(v) : '—'
const si = (v: boolean): string => v ? 'Si' : 'No'
const bm = (v: string): string => v === 'bueno' ? 'Bueno' : 'Malo'

const s = StyleSheet.create({
  page:      { fontFamily: 'Helvetica', fontSize: 7.5, padding: 20, backgroundColor: '#ffffff' },
  hdr:       { flexDirection: 'row', justifyContent: 'space-between', marginBottom: 8, alignItems: 'flex-start' },
  title:     { fontSize: 12, fontFamily: 'Helvetica-Bold', marginBottom: 1 },
  codigo:    { fontSize: 7, color: '#666666', marginBottom: 3 },
  meta:      { fontSize: 7.5, color: '#333333', marginBottom: 1 },
  secTitle:  { fontSize: 7.5, fontFamily: 'Helvetica-Bold', marginBottom: 3, color: '#333333' },
  grid:      { flexDirection: 'row', flexWrap: 'wrap', marginBottom: 6 },
  gcell:     { width: '33%', paddingBottom: 3, paddingRight: 4 },
  gcell2:    { width: '50%', paddingBottom: 3, paddingRight: 4 },
  glabel:    { fontSize: 6, color: '#888888', marginBottom: 1 },
  gvalue:    { fontSize: 7.5, color: '#222222' },
  table:     { borderTop: '1pt solid #cccccc', borderLeft: '1pt solid #cccccc' },
  row:       { flexDirection: 'row', borderBottom: '1pt solid #cccccc' },
  th:        { fontFamily: 'Helvetica-Bold', padding: 3, borderRight: '1pt solid #cccccc', backgroundColor: '#f3f3f3', fontSize: 6.5 },
  td:        { padding: 3, borderRight: '1pt solid #cccccc', fontSize: 7 },
  chkRow:    { flexDirection: 'row', alignItems: 'center', marginBottom: 2.5 },
  chkLabel:  { fontSize: 7.5, flex: 1 },
  chkVal:    { fontSize: 7.5, fontFamily: 'Helvetica-Bold', width: 32, textAlign: 'right' },
  footer:    { marginTop: 14, flexDirection: 'row', justifyContent: 'space-between', alignItems: 'flex-end' },
  firma:     { width: 155, borderTop: '1pt solid #000000', paddingTop: 3, fontSize: 6.5, textAlign: 'center' },
  marca:     { fontSize: 6.5, color: '#aaaaaa' },
})

const TW = { ord: 20, tar: 38, cajas: 28, pres: 60, ts: 34, tm: 34, ti: 34 }
const TEMP_COL = 40

export function ManifiestoEmbarquePDF({ d, codigoClave }: { d: M38ManifiestoDataPDF; codigoClave: string }) {
  const totales: Record<string, number> = {}
  for (const l of d.lineas) {
    if (l.producto.trim()) {
      totales[l.producto.trim()] = (totales[l.producto.trim()] ?? 0) + (l.cajas ?? 0)
    }
  }

  return (
    <Document>
      <Page size="A4" orientation="landscape" style={s.page}>

        {/* Encabezado */}
        <View style={s.hdr}>
          <View style={{ flex: 1 }}>
            <Text style={s.title}>Manifiesto de Embarque</Text>
            <Text style={s.codigo}>{codigoFormato('F-FRUS-PRO-01', codigoClave)}</Text>
            <Text style={s.meta}>{d.orgNombre}</Text>
            <Text style={s.meta}>Instalacion: {d.instalacion}</Text>
          </View>
          <View style={{ alignItems: 'flex-end' }}>
            <Text style={[s.meta, { fontFamily: 'Helvetica-Bold' }]}>Fecha: {fmtFecha(d.fecha)}</Text>
            <Text style={s.meta}>Folio: {t(d.folio)}</Text>
            <Text style={[s.meta, { fontSize: 6.5, color: '#888888', marginTop: 2 }]}>M.A.D.Y</Text>
          </View>
        </View>

        {/* Datos generales del embarque */}
        <View style={s.grid}>
          <View style={s.gcell2}>
            <Text style={s.glabel}>Empresa / Cliente</Text>
            <Text style={s.gvalue}>{t(d.empresa)}</Text>
          </View>
          <View style={s.gcell2}>
            <Text style={s.glabel}>Linea transportista</Text>
            <Text style={s.gvalue}>{t(d.linea_transportista)}</Text>
          </View>
          <View style={s.gcell2}>
            <Text style={s.glabel}>Nombre del chofer</Text>
            <Text style={s.gvalue}>{t(d.nombre_chofer)}</Text>
          </View>
          <View style={s.gcell2}>
            <Text style={s.glabel}>Placas del tractor</Text>
            <Text style={s.gvalue}>{t(d.placas_tractor)}</Text>
          </View>
          <View style={s.gcell}>
            <Text style={s.glabel}>Caja (pies)</Text>
            <Text style={s.gvalue}>{t(d.caja_pies)}</Text>
          </View>
          <View style={s.gcell}>
            <Text style={s.glabel}>Economico tractor</Text>
            <Text style={s.gvalue}>{t(d.econ_tractor)}</Text>
          </View>
          <View style={s.gcell}>
            <Text style={s.glabel}>Economico caja</Text>
            <Text style={s.gvalue}>{t(d.econ_caja)}</Text>
          </View>
          <View style={s.gcell}>
            <Text style={s.glabel}>No. sello</Text>
            <Text style={s.gvalue}>{t(d.num_sello)}</Text>
          </View>
          <View style={s.gcell}>
            <Text style={s.glabel}>No. chismografo</Text>
            <Text style={s.gvalue}>{t(d.num_chismografo)}</Text>
          </View>
        </View>

        {/* Cuerpo principal: tarimas (izquierda) + datos del camion y checklists (derecha) */}
        <View style={{ flexDirection: 'row', gap: 10, flex: 1 }}>

          {/* Tabla de tarimas */}
          <View style={{ flex: 1 }}>
            <Text style={s.secTitle}>Tarimas embarcadas</Text>
            <View style={s.table}>
              <View style={s.row}>
                <Text style={[s.th, { width: TW.ord }]}>No.</Text>
                <Text style={[s.th, { width: TW.tar }]}>Tarima</Text>
                <Text style={[s.th, { flex: 1 }]}>Producto</Text>
                <Text style={[s.th, { width: TW.pres }]}>Presentacion</Text>
                <Text style={[s.th, { width: TW.cajas }]}>Cajas</Text>
                <Text style={[s.th, { width: TW.ts }]}>T. Sup.</Text>
                <Text style={[s.th, { width: TW.tm }]}>T. Med.</Text>
                <Text style={[s.th, { width: TW.ti }]}>T. Inf.</Text>
              </View>
              {d.lineas.map((l, i) => (
                <View key={i} style={s.row}>
                  <Text style={[s.td, { width: TW.ord }]}>{l.orden}</Text>
                  <Text style={[s.td, { width: TW.tar }]}>{l.tarima}</Text>
                  <Text style={[s.td, { flex: 1 }]}>{l.producto}</Text>
                  <Text style={[s.td, { width: TW.pres }]}>{l.presentacion}</Text>
                  <Text style={[s.td, { width: TW.cajas }]}>{n(l.cajas)}</Text>
                  <Text style={[s.td, { width: TW.ts }]}>{n(l.temp_superior)}</Text>
                  <Text style={[s.td, { width: TW.tm }]}>{n(l.temp_medio)}</Text>
                  <Text style={[s.td, { width: TW.ti }]}>{n(l.temp_inferior)}</Text>
                </View>
              ))}
            </View>

            {/* Totales por producto */}
            {Object.keys(totales).length > 0 && (
              <View style={{ marginTop: 5 }}>
                <Text style={[s.secTitle, { marginBottom: 2 }]}>Total por producto</Text>
                <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 8 }}>
                  {Object.entries(totales).map(([prod, cajas], i) => (
                    <Text key={i} style={{ fontSize: 7.5, color: '#333333' }}>
                      {prod}: {cajas} cjs
                    </Text>
                  ))}
                </View>
              </View>
            )}

            {/* Observaciones */}
            {d.observaciones && (
              <View style={{ marginTop: 6 }}>
                <Text style={s.secTitle}>Observaciones</Text>
                <Text style={{ fontSize: 7.5, color: '#333333' }}>{d.observaciones}</Text>
              </View>
            )}
          </View>

          {/* Columna derecha */}
          <View style={{ width: 195 }}>

            {/* Temperatura del camion */}
            <Text style={s.secTitle}>Temperatura del camion</Text>
            <View style={[s.table, { marginBottom: 10 }]}>
              <View style={s.row}>
                <Text style={[s.th, { width: 46 }]}>Momento</Text>
                <Text style={[s.th, { width: TEMP_COL }]}>Hora</Text>
                <Text style={[s.th, { flex: 1 }]}>Temp. (C)</Text>
              </View>
              {([
                { label: 'Llegada', hora: d.llegada_hora, temp: d.llegada_temp },
                { label: 'Carga',   hora: d.carga_hora,   temp: d.carga_temp   },
                { label: 'Salida',  hora: d.salida_hora,  temp: d.salida_temp  },
              ] as const).map((row, i) => (
                <View key={i} style={s.row}>
                  <Text style={[s.td, { width: 46 }]}>{row.label}</Text>
                  <Text style={[s.td, { width: TEMP_COL }]}>{t(row.hora)}</Text>
                  <Text style={[s.td, { flex: 1 }]}>{n(row.temp)}</Text>
                </View>
              ))}
            </View>

            {/* Condiciones del transporte */}
            <Text style={s.secTitle}>Condiciones del transporte</Text>
            <View style={{ marginBottom: 10 }}>
              {([
                { label: 'En buen estado',             value: si(d.cond_buen_estado)       },
                { label: 'Limpio y sin malos olores',  value: si(d.cond_limpio)             },
                { label: 'Presencia de plagas',        value: si(d.cond_presencia_plagas)   },
              ] as const).map((c, i) => (
                <View key={i} style={s.chkRow}>
                  <Text style={s.chkLabel}>{c.label}</Text>
                  <Text style={[s.chkVal, {
                    color: c.value === 'Si' && c.label.includes('plagas') ? '#C02A2A' : '#222222',
                  }]}>
                    {c.value}
                  </Text>
                </View>
              ))}
            </View>

            {/* Condiciones de las tarimas */}
            <Text style={s.secTitle}>Condiciones de las tarimas</Text>
            <View>
              {([
                { label: 'Remontado',              value: bm(d.tar_remontado)    },
                { label: 'Flejado',                value: bm(d.tar_flejado)      },
                { label: 'Limpieza',               value: bm(d.tar_limpieza)     },
                { label: 'Condicion de la tarima', value: bm(d.tar_condicion)    },
                { label: 'Distribucion embarque',  value: bm(d.tar_distribucion) },
              ] as const).map((c, i) => (
                <View key={i} style={s.chkRow}>
                  <Text style={s.chkLabel}>{c.label}</Text>
                  <Text style={[s.chkVal, { color: c.value === 'Malo' ? '#C02A2A' : '#222222' }]}>
                    {c.value}
                  </Text>
                </View>
              ))}
            </View>
          </View>
        </View>

        {/* Firmas */}
        <View style={s.footer}>
          <View style={s.firma}>
            <Text>Responsable de la instalacion</Text>
          </View>
          <View style={s.firma}>
            <Text>Responsable de la empresa</Text>
          </View>
          <View style={s.firma}>
            <Text>Firma del chofer</Text>
          </View>
          <Text style={s.marca}>M.A.D.Y — DuoMind Solutions</Text>
        </View>

      </Page>
    </Document>
  )
}
