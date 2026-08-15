import { Document, Page, Text, View, StyleSheet, Image } from '@react-pdf/renderer'
import { MadyLogoPDF } from '@/lib/pdf/MadyLogoPDF'

export interface EtiquetaLPTData {
  lptCodigo: string
  presentacion: string | null
  fechaEmpaque: string
  turno: number
  origenCodigo: string | null
  origenTipo: 'LR' | 'LC' | null
  cantEmpacada: number | null
  unidad: string | null
  orgNombre: string
  ranchoNombre: string
  qrDataUrl: string
}

// 4" x 8" = 288pt x 576pt
const s = StyleSheet.create({
  page: {
    fontFamily: 'Helvetica',
    backgroundColor: '#ffffff',
    padding: 12,
    width: 288,
    height: 576,
  },
  header: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginBottom: 6 },
  logoText: { fontSize: 14, fontFamily: 'Helvetica-Bold' },
  orgText: { fontSize: 6.5, color: '#555', textAlign: 'right', maxWidth: 130 },
  divider: { height: 1, backgroundColor: '#ddd', marginVertical: 5 },
  lptBlock: { alignItems: 'center', marginVertical: 6 },
  lptLabel: { fontSize: 7.5, color: '#888', fontFamily: 'Helvetica-Bold', letterSpacing: 1 },
  lptCodigo: { fontSize: 15, fontFamily: 'Helvetica-Bold', color: '#1a1a1a', marginTop: 2, textAlign: 'center' },
  qrWrap: { alignItems: 'center', marginVertical: 8 },
  qrImg: { width: 160, height: 160 },
  dataGrid: { marginTop: 4 },
  dataRow: { flexDirection: 'row', marginBottom: 4 },
  dataLabel: { fontSize: 6.5, color: '#666', fontFamily: 'Helvetica-Bold', width: 72 },
  dataVal: { fontSize: 6.5, color: '#222', flex: 1 },
  footerMarca: { marginTop: 8, alignItems: 'center' },
  marcaText: { fontSize: 5.5, color: '#bbb' },
})

function fmtFecha(iso: string | null | undefined): string {
  if (!iso) return '—'
  try {
    const [y, m, d] = iso.split('-')
    return `${d}/${m}/${y}`
  } catch { return iso }
}

export function EtiquetaLPTPDF({ d }: { d: EtiquetaLPTData }) {
  return (
    <Document>
      <Page size={[288, 576]} style={s.page}>
        {/* Header */}
        <View style={s.header}>
          <MadyLogoPDF style={s.logoText} />
          <Text style={s.orgText}>{d.orgNombre}{'\n'}{d.ranchoNombre}</Text>
        </View>
        <View style={s.divider} />

        {/* LPT code — main identifier */}
        <View style={s.lptBlock}>
          <Text style={s.lptLabel}>LOTE DE PRODUCTO TERMINADO</Text>
          <Text style={s.lptCodigo}>{d.lptCodigo}</Text>
        </View>

        {/* QR Code */}
        <View style={s.qrWrap}>
          <Image src={d.qrDataUrl} style={s.qrImg} />
        </View>

        <View style={s.divider} />

        {/* Data fields */}
        <View style={s.dataGrid}>
          <View style={s.dataRow}>
            <Text style={s.dataLabel}>Producto:</Text>
            <Text style={s.dataVal}>{d.presentacion ?? '—'}</Text>
          </View>
          <View style={s.dataRow}>
            <Text style={s.dataLabel}>F. Empaque:</Text>
            <Text style={s.dataVal}>{fmtFecha(d.fechaEmpaque)}</Text>
          </View>
          <View style={s.dataRow}>
            <Text style={s.dataLabel}>Turno:</Text>
            <Text style={s.dataVal}>{d.turno}</Text>
          </View>
          <View style={s.dataRow}>
            <Text style={s.dataLabel}>Origen ({d.origenTipo ?? '—'}):</Text>
            <Text style={s.dataVal}>{d.origenCodigo ?? '—'}</Text>
          </View>
          {d.cantEmpacada != null && (
            <View style={s.dataRow}>
              <Text style={s.dataLabel}>Cantidad:</Text>
              <Text style={s.dataVal}>{d.cantEmpacada}{d.unidad ? ` ${d.unidad}` : ''}</Text>
            </View>
          )}
        </View>

        {/* Footer */}
        <View style={s.footerMarca}>
          <Text style={s.marcaText}>M.A.D.Y - DuoMind Solutions</Text>
        </View>
      </Page>
    </Document>
  )
}
