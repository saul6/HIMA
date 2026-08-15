import { Document, Page, Text, View, StyleSheet, Image } from '@react-pdf/renderer'

// Archivo requerido: public/images/logo-los-gemelos.png
// Sin ese archivo el PDF falla al generar (Image no puede cargar la URL).
export const LOGO_LOS_GEMELOS_PATH = '/images/logo-los-gemelos.png'

export interface EtiquetaLPTData {
  lptCodigo: string
  producto: string           // segmento del codigo, ej. 'COC'
  presentacion: string | null
  fechaEmpaque: string
  turno: number
  origenCodigo: string | null // codigo LR o LC de origen
  origenTipo: 'LR' | 'LC' | null
  proveedorCodigo: string | null
  clienteDestino: string
  cantEmpacada: number | null
  orgNombre: string
  ranchoNombre: string
  qrDataUrl: string
  logoUrl: string            // URL absoluta del logo del cliente
}

const BD = '#2a2a2a'
const PAD = 4

const s = StyleSheet.create({
  page: {
    fontFamily: 'Helvetica',
    backgroundColor: '#ffffff',
    padding: 0,
    width: 288,
    height: 576,
  },
  outer: {
    flex: 1,
    margin: PAD,
    borderWidth: 1,
    borderColor: BD,
    borderStyle: 'solid',
    flexDirection: 'column',
  },
  // ── Header ───────────────────────────────────────────────────────────────
  headerRow: {
    flexDirection: 'row',
    height: 52,
    borderBottomWidth: 1,
    borderBottomColor: BD,
    borderBottomStyle: 'solid',
  },
  logoCell: {
    width: 72,
    alignItems: 'center',
    justifyContent: 'center',
    borderRightWidth: 1,
    borderRightColor: BD,
    borderRightStyle: 'solid',
    padding: 4,
  },
  logoImg: { width: 62, height: 40, objectFit: 'contain' },
  titleCell: { flex: 1, justifyContent: 'center', padding: 6 },
  titleText: { fontSize: 9.5, fontFamily: 'Helvetica-Bold', color: '#111', marginBottom: 2 },
  subtitleText: { fontSize: 7.5, color: '#444' },
  // ── Filas de datos ────────────────────────────────────────────────────────
  row: {
    flexDirection: 'row',
    borderBottomWidth: 1,
    borderBottomColor: BD,
    borderBottomStyle: 'solid',
  },
  cell: {
    flex: 1,
    padding: 4,
    borderRightWidth: 1,
    borderRightColor: BD,
    borderRightStyle: 'solid',
  },
  cellLast: { flex: 1, padding: 4 },
  cLabel: { fontSize: 5.5, color: '#555', fontFamily: 'Helvetica-Bold', marginBottom: 2, letterSpacing: 0.4 },
  cVal: { fontSize: 8, color: '#111', fontFamily: 'Helvetica-Bold' },
  cValSm: { fontSize: 6.5, color: '#111', fontFamily: 'Helvetica-Bold' },
  // ── Fila LPT ─────────────────────────────────────────────────────────────
  lptRow: {
    flexDirection: 'row',
    height: 52,
    borderBottomWidth: 1,
    borderBottomColor: BD,
    borderBottomStyle: 'solid',
  },
  lptCell: {
    flex: 3,
    padding: 5,
    borderRightWidth: 1,
    borderRightColor: BD,
    borderRightStyle: 'solid',
    justifyContent: 'center',
  },
  lptLabel: { fontSize: 5.5, color: '#555', fontFamily: 'Helvetica-Bold', marginBottom: 3, letterSpacing: 0.4 },
  lptCode: { fontSize: 11, fontFamily: 'Helvetica-Bold', color: '#111' },
  clienteCell: { flex: 2, padding: 5, justifyContent: 'center' },
  // ── Seccion QR ───────────────────────────────────────────────────────────
  qrSection: { flex: 1, alignItems: 'center', justifyContent: 'center', padding: 6 },
  qrSectionLabel: { fontSize: 6.5, color: '#555', fontFamily: 'Helvetica-Bold', letterSpacing: 0.5, marginBottom: 5 },
  qrImg: { width: 160, height: 160 },
  qrCode: { fontSize: 7.5, fontFamily: 'Helvetica-Bold', color: '#111', marginTop: 5, textAlign: 'center' },
})

function ff(iso: string | null | undefined): string {
  if (!iso) return '—'
  try { const [y, m, d] = iso.split('-'); return `${d}/${m}/${y}` } catch { return iso }
}

export function EtiquetaLPTPDF({ d }: { d: EtiquetaLPTData }) {
  const origenLabel = d.origenTipo ? `LR / LC (${d.origenTipo})` : 'LR / LC'
  return (
    <Document>
      <Page size={[288, 576]} style={s.page}>
        <View style={s.outer}>

          {/* Header: logo cliente | titulo */}
          <View style={s.headerRow}>
            <View style={s.logoCell}>
              <Image src={d.logoUrl} style={s.logoImg} />
            </View>
            <View style={s.titleCell}>
              <Text style={s.titleText}>Etiqueta de trazabilidad</Text>
              <Text style={s.subtitleText}>{d.orgNombre}</Text>
            </View>
          </View>

          {/* Fila 1: Producto | Presentacion | Turno */}
          <View style={[s.row, { height: 36 }]}>
            <View style={s.cell}>
              <Text style={s.cLabel}>PRODUCTO</Text>
              <Text style={s.cVal}>{d.producto}</Text>
            </View>
            <View style={s.cell}>
              <Text style={s.cLabel}>PRESENTACION</Text>
              <Text style={s.cValSm}>{d.presentacion ?? 'Caja / segun cliente'}</Text>
            </View>
            <View style={s.cellLast}>
              <Text style={s.cLabel}>TURNO</Text>
              <Text style={s.cVal}>T{d.turno}</Text>
            </View>
          </View>

          {/* Fila 2: Fecha empaque | LR/LC | Proveedor */}
          <View style={[s.row, { height: 36 }]}>
            <View style={s.cell}>
              <Text style={s.cLabel}>FECHA DE EMPAQUE</Text>
              <Text style={s.cVal}>{ff(d.fechaEmpaque)}</Text>
            </View>
            <View style={s.cell}>
              <Text style={s.cLabel}>{origenLabel}</Text>
              <Text style={s.cValSm}>{d.origenCodigo ?? '—'}</Text>
            </View>
            <View style={s.cellLast}>
              <Text style={s.cLabel}>ORIGEN / PROVEEDOR</Text>
              <Text style={s.cVal}>{d.proveedorCodigo ?? '—'}</Text>
            </View>
          </View>

          {/* Fila 3: LPT en grande | Cliente/destino */}
          <View style={s.lptRow}>
            <View style={s.lptCell}>
              <Text style={s.lptLabel}>LOTE DE PRODUCTO TERMINADO</Text>
              <Text style={s.lptCode}>{d.lptCodigo}</Text>
            </View>
            <View style={s.clienteCell}>
              <Text style={s.cLabel}>CLIENTE / DESTINO</Text>
              <Text style={[s.cValSm, { fontSize: 7 }]}>{d.clienteDestino}</Text>
            </View>
          </View>

          {/* Seccion QR */}
          <View style={s.qrSection}>
            <Text style={s.qrSectionLabel}>CODIGO VISUAL DEL LOTE</Text>
            <Image src={d.qrDataUrl} style={s.qrImg} />
            <Text style={s.qrCode}>{d.lptCodigo}</Text>
          </View>

        </View>
      </Page>
    </Document>
  )
}
