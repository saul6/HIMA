import React from 'react'
import { Page, Text, View, Document, StyleSheet } from '@react-pdf/renderer'
import { codigoFormato } from '@/lib/codigoFormato'

export interface MovimientoPDF {
  fecha: string
  persona_solicita: string
  area: string
  tipo: 'entrada' | 'salida'
  cantidad: number
}

export interface InventarioQuimicosProps {
  instalacion: string
  quimicoNombre: string
  unidad: string
  movimientos: MovimientoPDF[]
  consolidado?: boolean
  desde?: string
  hasta?: string
  codigoClave: string
}

const s = StyleSheet.create({
  page: { fontSize: 7, fontFamily: 'Helvetica', padding: '14 16', backgroundColor: '#fff' },
  headerBox: { borderWidth: 1, borderColor: '#000', marginBottom: 6 },
  headerTopRow: { flexDirection: 'row', borderBottomWidth: 1, borderColor: '#000' },
  logoCell: { width: 72, padding: '4 6', alignItems: 'center', justifyContent: 'center', borderRightWidth: 1, borderColor: '#000' },
  titleBlock: { flex: 1, padding: '4 8', alignItems: 'center', justifyContent: 'center' },
  title: { fontSize: 8.5, fontFamily: 'Helvetica-Bold', textAlign: 'center' },
  subtitle: { fontSize: 6, textAlign: 'center', marginTop: 2 },
  metaCol: { width: 130, padding: '3 5', borderLeftWidth: 1, borderColor: '#000' },
  quimicoRow: { padding: '3 6', flexDirection: 'row', flexWrap: 'wrap' },
  bold: { fontFamily: 'Helvetica-Bold' },
  table: { borderWidth: 1, borderColor: '#000', marginBottom: 10 },
  th: { flexDirection: 'row', backgroundColor: '#e0e0e0' },
  tr: { flexDirection: 'row', borderTopWidth: 1, borderColor: '#000' },
  td: { padding: '2 3', borderRightWidth: 1, borderColor: '#000' },
  tdLast: { padding: '2 3' },
  sigRow: { flexDirection: 'row', justifyContent: 'space-between', marginTop: 24 },
  sigBox: { width: 152, borderTopWidth: 1, borderColor: '#000', paddingTop: 3, alignItems: 'center' },
  footer: { position: 'absolute', bottom: 8, left: 16, right: 16, textAlign: 'center', fontSize: 6, color: '#666' },
})

const W_FECHA = 44
const W_PERSONA = 100
const W_AREA = 80
const W_ENT = 36
const W_SAL = 36
const W_TOT = 38

function fmt(f: string) {
  if (!f) return '—'
  const [y, m, d] = f.split('-')
  return `${d}/${m}/${y}`
}

function calcSaldo(movs: MovimientoPDF[]) {
  let saldo = 0
  return movs.map(m => {
    saldo = m.tipo === 'entrada' ? saldo + m.cantidad : saldo - m.cantidad
    return { ...m, saldo }
  })
}

export function InventarioQuimicosPagina({
  instalacion, quimicoNombre, unidad, movimientos, consolidado, desde, hasta, codigoClave,
}: InventarioQuimicosProps) {
  const filas = calcSaldo(movimientos)
  const periodo = consolidado && desde && hasta
    ? `${fmt(desde)} al ${fmt(hasta)}`
    : filas.length > 0
      ? `${fmt(filas[0].fecha)} al ${fmt(filas[filas.length - 1].fecha)}`
      : '—'

  return (
    <Page size="A4" orientation="portrait" style={s.page}>
      <View style={s.headerBox}>
        <View style={s.headerTopRow}>
          <View style={s.logoCell}>
            <Text style={{ fontSize: 10, fontFamily: 'Helvetica-Bold' }}>M.A.D.Y</Text>
            <Text style={{ fontSize: 5 }}>M.A.D.Y</Text>
          </View>
          <View style={s.titleBlock}>
            <Text style={s.title}>CONTROL DE INVENTARIO DE QUIMICOS E INSUMOS</Text>
            <Text style={s.subtitle}>{codigoFormato('F-FRUS-SAN-02', codigoClave)}  |  Rev 01</Text>
          </View>
          <View style={s.metaCol}>
            <Text><Text style={s.bold}>Instalacion: </Text>{instalacion}</Text>
            <Text style={{ marginTop: 2 }}><Text style={s.bold}>Periodo: </Text>{periodo}</Text>
          </View>
        </View>
        <View style={s.quimicoRow}>
          <Text style={{ marginRight: 16 }}><Text style={s.bold}>Quimico / Insumo: </Text>{quimicoNombre}</Text>
          <Text><Text style={s.bold}>Unidad: </Text>{unidad}</Text>
        </View>
      </View>

      <View style={s.table}>
        <View style={s.th}>
          <View style={[s.td, { width: W_FECHA }]}><Text style={s.bold}>Fecha</Text></View>
          <View style={[s.td, { width: W_PERSONA }]}><Text style={s.bold}>Persona que solicita</Text></View>
          <View style={[s.td, { width: W_AREA }]}><Text style={s.bold}>Area</Text></View>
          <View style={[s.td, { width: W_ENT, textAlign: 'center' }]}><Text style={s.bold}>Entrada</Text></View>
          <View style={[s.td, { width: W_SAL, textAlign: 'center' }]}><Text style={s.bold}>Salida</Text></View>
          <View style={[s.tdLast, { width: W_TOT, textAlign: 'center' }]}><Text style={s.bold}>Total</Text></View>
        </View>
        {filas.map((f, i) => (
          <View key={i} style={s.tr}>
            <View style={[s.td, { width: W_FECHA }]}><Text>{fmt(f.fecha)}</Text></View>
            <View style={[s.td, { width: W_PERSONA }]}><Text>{f.persona_solicita}</Text></View>
            <View style={[s.td, { width: W_AREA }]}><Text>{f.area}</Text></View>
            <View style={[s.td, { width: W_ENT, textAlign: 'center' }]}>
              <Text>{f.tipo === 'entrada' ? String(f.cantidad) : ''}</Text>
            </View>
            <View style={[s.td, { width: W_SAL, textAlign: 'center' }]}>
              <Text>{f.tipo === 'salida' ? String(f.cantidad) : ''}</Text>
            </View>
            <View style={[s.tdLast, { width: W_TOT, textAlign: 'center' }]}>
              <Text>{String(f.saldo)}</Text>
            </View>
          </View>
        ))}
      </View>

      <View style={s.sigRow}>
        <View style={s.sigBox}><Text style={{ fontSize: 6.5 }}>Encargado de limpieza</Text></View>
        <View style={s.sigBox}><Text style={{ fontSize: 6.5 }}>Gerente Administrativo</Text></View>
        <View style={s.sigBox}><Text style={{ fontSize: 6.5 }}>Gerente General</Text></View>
      </View>

      <Text style={s.footer}>M.A.D.Y · Inocuidad Inteligente</Text>
    </Page>
  )
}

export function InventarioQuimicosPDF(props: InventarioQuimicosProps) {
  return (
    <Document>
      <InventarioQuimicosPagina {...props} />
    </Document>
  )
}
