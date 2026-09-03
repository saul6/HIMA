import { Document, Page, View, Text } from '@react-pdf/renderer'
import { TopBar, PdfFooter } from '@/lib/pdf/components/PdfPage'
import { PdfHeader } from '@/lib/pdf/components/PdfHeader'
import { PdfSectionBanner } from '@/lib/pdf/components/PdfSectionBanner'
import { PdfSignatures } from '@/lib/pdf/components/PdfSignatures'
import { codigoFormato } from '@/lib/codigoFormato'
import { PC } from '@/lib/pdf/components/tokens'

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

const MARGIN = 20

const thStyle = {
  padding: 3,
  borderRightWidth: 1,
  borderRightColor: '#5599CC',
  borderBottomWidth: 1,
  borderBottomColor: '#5599CC',
  justifyContent: 'center' as const,
  alignItems: 'center' as const,
  fontFamily: 'Helvetica-Bold',
  fontSize: 6.5,
  backgroundColor: PC.section,
  color: PC.white,
} as const

const tdStyle = {
  borderRightWidth: 1,
  borderRightColor: PC.border,
  borderBottomWidth: 1,
  borderBottomColor: PC.border,
  padding: 3,
  fontSize: 7,
  color: PC.fieldValue,
} as const

const ROW_ALT = '#F5F9FE'

const TW = { ord: 20, tar: 38, cajas: 28, pres: 60, ts: 34, tm: 34, ti: 34 }
const TEMP_COL = 40

export function ManifiestoEmbarquePDF({
  d,
  codigoClave,
  terminoSitio = 'Instalación',
}: {
  d: M38ManifiestoDataPDF
  codigoClave: string
  terminoSitio?: string
}) {
  const codigoFmt = codigoFormato('F-FRUS-PRO-01', codigoClave)

  const totales: Record<string, number> = {}
  for (const l of d.lineas) {
    if (l.producto.trim()) {
      totales[l.producto.trim()] = (totales[l.producto.trim()] ?? 0) + (l.cajas ?? 0)
    }
  }

  return (
    <Document>
      <Page
        size="A4"
        orientation="landscape"
        style={{
          fontFamily: 'Helvetica',
          fontSize: 7.5,
          padding: MARGIN,
          paddingBottom: 50,
          backgroundColor: PC.white,
        }}
      >
        <PdfFooter moduloCodigo="M38" />
        <TopBar />
        <PdfHeader
          titulo="MANIFIESTO DE EMBARQUE"
          subtitulo={`Embarque | ${d.instalacion} | ${fmtFecha(d.fecha)}`}
          codigoFormato={codigoFmt}
          folio={d.folio ?? '—'}
          fecha={d.fecha}
        />

        {/* Datos generales del embarque */}
        <View style={{ flexDirection: 'row', flexWrap: 'wrap', marginBottom: 6 }}>
          {[
            { label: 'Empresa / Cliente',    value: t(d.empresa),              w: '50%' },
            { label: 'Linea transportista',  value: t(d.linea_transportista),  w: '50%' },
            { label: 'Nombre del chofer',    value: t(d.nombre_chofer),        w: '50%' },
            { label: 'Placas del tractor',   value: t(d.placas_tractor),       w: '50%' },
            { label: 'Caja (pies)',          value: t(d.caja_pies),            w: '33%' },
            { label: 'Economico tractor',    value: t(d.econ_tractor),         w: '33%' },
            { label: 'Economico caja',       value: t(d.econ_caja),            w: '33%' },
            { label: 'No. sello',            value: t(d.num_sello),            w: '50%' },
            { label: 'No. chismografo',      value: t(d.num_chismografo),      w: '50%' },
          ].map(({ label, value, w }) => (
            <View key={label} style={{ width: w, paddingBottom: 3, paddingRight: 4 }}>
              <Text style={{ fontSize: 6, color: PC.fieldLabel, marginBottom: 1 }}>{label}</Text>
              <Text style={{ fontSize: 7.5, color: PC.fieldValue }}>{value}</Text>
            </View>
          ))}
        </View>

        {/* Cuerpo principal: tarimas (izquierda) + datos del camion y checklists (derecha) */}
        <View style={{ flexDirection: 'row', gap: 10, flex: 1 }}>

          {/* Tabla de tarimas */}
          <View style={{ flex: 1 }}>
            <PdfSectionBanner>Tarimas embarcadas</PdfSectionBanner>
            <View style={{ borderTopWidth: 1, borderTopColor: PC.section, borderLeftWidth: 1, borderLeftColor: PC.section }}>
              {/* Header */}
              <View style={{ flexDirection: 'row' }}>
                <Text style={[thStyle, { width: TW.ord }]}>No.</Text>
                <Text style={[thStyle, { width: TW.tar }]}>Tarima</Text>
                <Text style={[thStyle, { flex: 1 }]}>Producto</Text>
                <Text style={[thStyle, { width: TW.pres }]}>Presentacion</Text>
                <Text style={[thStyle, { width: TW.cajas }]}>Cajas</Text>
                <Text style={[thStyle, { width: TW.ts }]}>T. Sup.</Text>
                <Text style={[thStyle, { width: TW.tm }]}>T. Med.</Text>
                <Text style={[thStyle, { width: TW.ti, borderRightWidth: 0 }]}>T. Inf.</Text>
              </View>
              {d.lineas.map((l, i) => (
                <View key={i} style={{ flexDirection: 'row', backgroundColor: i % 2 === 1 ? ROW_ALT : PC.white }}>
                  <Text style={[tdStyle, { width: TW.ord }]}>{l.orden}</Text>
                  <Text style={[tdStyle, { width: TW.tar }]}>{l.tarima}</Text>
                  <Text style={[tdStyle, { flex: 1 }]}>{l.producto}</Text>
                  <Text style={[tdStyle, { width: TW.pres }]}>{l.presentacion}</Text>
                  <Text style={[tdStyle, { width: TW.cajas }]}>{n(l.cajas)}</Text>
                  <Text style={[tdStyle, { width: TW.ts }]}>{n(l.temp_superior)}</Text>
                  <Text style={[tdStyle, { width: TW.tm }]}>{n(l.temp_medio)}</Text>
                  <Text style={[tdStyle, { width: TW.ti, borderRightWidth: 0 }]}>{n(l.temp_inferior)}</Text>
                </View>
              ))}
            </View>

            {/* Totales por producto */}
            {Object.keys(totales).length > 0 && (
              <View style={{ marginTop: 5 }}>
                <Text style={{ fontSize: 7, fontFamily: 'Helvetica-Bold', color: PC.titleNavy, marginBottom: 2 }}>
                  Total por producto
                </Text>
                <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 8 }}>
                  {Object.entries(totales).map(([prod, cajas], i) => (
                    <Text key={i} style={{ fontSize: 7.5, color: PC.fieldValue }}>
                      {prod}: {cajas} cjs
                    </Text>
                  ))}
                </View>
              </View>
            )}

            {/* Observaciones */}
            {d.observaciones && (
              <View style={{ marginTop: 6 }}>
                <Text style={{ fontSize: 7, fontFamily: 'Helvetica-Bold', color: PC.titleNavy, marginBottom: 2 }}>
                  Observaciones
                </Text>
                <Text style={{ fontSize: 7.5, color: PC.fieldValue }}>{d.observaciones}</Text>
              </View>
            )}
          </View>

          {/* Columna derecha */}
          <View style={{ width: 195 }}>

            {/* Temperatura del camion */}
            <PdfSectionBanner>Temperatura del camion</PdfSectionBanner>
            <View style={{ borderTopWidth: 1, borderTopColor: PC.section, borderLeftWidth: 1, borderLeftColor: PC.section, marginBottom: 8 }}>
              <View style={{ flexDirection: 'row' }}>
                <Text style={[thStyle, { width: 46 }]}>Momento</Text>
                <Text style={[thStyle, { width: TEMP_COL }]}>Hora</Text>
                <Text style={[thStyle, { flex: 1, borderRightWidth: 0 }]}>Temp. (C)</Text>
              </View>
              {([
                { label: 'Llegada', hora: d.llegada_hora, temp: d.llegada_temp },
                { label: 'Carga',   hora: d.carga_hora,   temp: d.carga_temp   },
                { label: 'Salida',  hora: d.salida_hora,  temp: d.salida_temp  },
              ] as const).map((row, i) => (
                <View key={i} style={{ flexDirection: 'row', backgroundColor: i % 2 === 1 ? ROW_ALT : PC.white }}>
                  <Text style={[tdStyle, { width: 46 }]}>{row.label}</Text>
                  <Text style={[tdStyle, { width: TEMP_COL }]}>{t(row.hora)}</Text>
                  <Text style={[tdStyle, { flex: 1, borderRightWidth: 0 }]}>{n(row.temp)}</Text>
                </View>
              ))}
            </View>

            {/* Condiciones del transporte */}
            <PdfSectionBanner>Condiciones del transporte</PdfSectionBanner>
            <View style={{ marginBottom: 8 }}>
              {([
                { label: 'En buen estado',            value: si(d.cond_buen_estado),     esNegativo: !d.cond_buen_estado },
                { label: 'Limpio y sin malos olores', value: si(d.cond_limpio),           esNegativo: !d.cond_limpio },
                { label: 'Presencia de plagas',       value: si(d.cond_presencia_plagas), esNegativo: d.cond_presencia_plagas },
              ] as const).map((c, i) => (
                <View key={i} style={{ flexDirection: 'row', alignItems: 'center', marginBottom: 2.5 }}>
                  <Text style={{ fontSize: 7.5, flex: 1, color: PC.fieldValue }}>{c.label}</Text>
                  <Text style={{
                    fontSize: 7.5,
                    fontFamily: 'Helvetica-Bold',
                    width: 32,
                    textAlign: 'right',
                    color: c.esNegativo ? '#C02A2A' : PC.section,
                  }}>
                    {c.value}
                  </Text>
                </View>
              ))}
            </View>

            {/* Condiciones de las tarimas */}
            <PdfSectionBanner>Condiciones de las tarimas</PdfSectionBanner>
            <View>
              {([
                { label: 'Remontado',              value: bm(d.tar_remontado)    },
                { label: 'Flejado',                value: bm(d.tar_flejado)      },
                { label: 'Limpieza',               value: bm(d.tar_limpieza)     },
                { label: 'Condicion de la tarima', value: bm(d.tar_condicion)    },
                { label: 'Distribucion embarque',  value: bm(d.tar_distribucion) },
              ] as const).map((c, i) => (
                <View key={i} style={{ flexDirection: 'row', alignItems: 'center', marginBottom: 2.5 }}>
                  <Text style={{ fontSize: 7.5, flex: 1, color: PC.fieldValue }}>{c.label}</Text>
                  <Text style={{
                    fontSize: 7.5,
                    fontFamily: 'Helvetica-Bold',
                    width: 32,
                    textAlign: 'right',
                    color: c.value === 'Malo' ? '#C02A2A' : PC.section,
                  }}>
                    {c.value}
                  </Text>
                </View>
              ))}
            </View>
          </View>
        </View>

        {/* Firmas */}
        <PdfSignatures
          signatures={[
            { label: 'Responsable de la instalacion' },
            { label: 'Responsable de la empresa' },
            { label: 'Firma del chofer' },
          ]}
        />

      </Page>
    </Document>
  )
}
