import React from 'react'
import { Page, Text, View, Document, StyleSheet } from '@react-pdf/renderer'

export interface MicroorganismoPDF {
  codigo: string
  label: string
  tipo: 'indicador' | 'patogeno'
  orden: number
}

export interface MuestraPDF {
  id: string
  fecha_muestreo: string
  hora_muestreo: string | null
  descripcion_muestra: string
  microorganismos: string[]
  laboratorio: string
  solicitante_nombre: string
}

export interface MuestrasLaboratorioPaginaProps {
  instalacion: string
  instalacionCodigo: string
  fecha: string
  microorganismos: MicroorganismoPDF[]
  muestras: MuestraPDF[]
  consolidado?: boolean
  desde?: string
  hasta?: string
}

export interface MuestrasLaboratorioConsolidadoProps {
  instalacion: string
  instalacionCodigo: string
  desde: string
  hasta: string
  microorganismos: MicroorganismoPDF[]
  muestras: MuestraPDF[]
}

const styles = StyleSheet.create({
  page: { fontSize: 7, fontFamily: 'Helvetica', padding: '10 14', backgroundColor: '#fff' },
  headerBox: { borderWidth: 1, borderColor: '#000', marginBottom: 4 },
  headerRow: { flexDirection: 'row', borderBottomWidth: 1, borderColor: '#000' },
  headerCell: { padding: '2 4', borderRightWidth: 1, borderColor: '#000' },
  headerCellLast: { padding: '2 4' },
  titleBlock: { flex: 1, padding: '3 6', alignItems: 'center', justifyContent: 'center' },
  title: { fontSize: 9, fontFamily: 'Helvetica-Bold', textAlign: 'center' },
  subtitle: { fontSize: 7, textAlign: 'center', marginTop: 1 },
  metaRow: { flexDirection: 'row' },
  metaLabel: { fontFamily: 'Helvetica-Bold' },
  table: { borderWidth: 1, borderColor: '#000', marginBottom: 6 },
  tableHeaderRow: { flexDirection: 'row', backgroundColor: '#e0e0e0' },
  tableGroupRow: { flexDirection: 'row', backgroundColor: '#c8d8e8' },
  tableRow: { flexDirection: 'row', borderTopWidth: 1, borderColor: '#000' },
  cellBase: { padding: '2 3', borderRightWidth: 1, borderColor: '#000', fontSize: 6.5 },
  cellLast: { padding: '2 3', fontSize: 6.5 },
  cellBold: { fontFamily: 'Helvetica-Bold' },
  signatureRow: { flexDirection: 'row', marginTop: 12, justifyContent: 'flex-end' },
  signatureBox: { width: 180, borderTopWidth: 1, borderColor: '#000', paddingTop: 3, alignItems: 'center' },
  footer: { position: 'absolute', bottom: 8, left: 14, right: 14, textAlign: 'center', fontSize: 6, color: '#666' },
})

const NUM_W = 20
const FECHA_W = 44
const HORA_W = 28
const DESC_W = 90
const MICRO_W = 22
const LAB_W = 60
const SOL_W = 56

function formatFecha(f: string) {
  if (!f) return '—'
  const [y, m, d] = f.split('-')
  return `${d}/${m}/${y}`
}

function GrupoHeaderRow({ indicadores, patogenos }: { indicadores: MicroorganismoPDF[]; patogenos: MicroorganismoPDF[] }) {
  const totalMicro = indicadores.length + patogenos.length
  const totalW = NUM_W + FECHA_W + HORA_W + DESC_W + totalMicro * MICRO_W + LAB_W + SOL_W
  const indW = indicadores.length * MICRO_W
  const patW = patogenos.length * MICRO_W
  return (
    <View style={styles.tableGroupRow}>
      <View style={[styles.cellBase, { width: NUM_W + FECHA_W + HORA_W + DESC_W }]} />
      <View style={[styles.cellBase, { width: indW, alignItems: 'center' }]}>
        <Text style={styles.cellBold}>m.o. Indicadores</Text>
      </View>
      <View style={[styles.cellBase, { width: patW, alignItems: 'center' }]}>
        <Text style={styles.cellBold}>m.o. Patogenos</Text>
      </View>
      <View style={{ width: LAB_W + SOL_W }} />
    </View>
  )
}

function ColumnHeaderRow({ indicadores, patogenos }: { indicadores: MicroorganismoPDF[]; patogenos: MicroorganismoPDF[] }) {
  return (
    <View style={styles.tableHeaderRow}>
      <View style={[styles.cellBase, { width: NUM_W, alignItems: 'center' }]}><Text style={styles.cellBold}>No.</Text></View>
      <View style={[styles.cellBase, { width: FECHA_W }]}><Text style={styles.cellBold}>Fecha de muestreo</Text></View>
      <View style={[styles.cellBase, { width: HORA_W }]}><Text style={styles.cellBold}>Hora</Text></View>
      <View style={[styles.cellBase, { width: DESC_W }]}><Text style={styles.cellBold}>Descripcion de la muestra</Text></View>
      {[...indicadores, ...patogenos].map((m, i) => (
        <View key={m.codigo} style={[styles.cellBase, { width: MICRO_W, alignItems: 'center' }]}>
          <Text style={styles.cellBold}>{m.codigo}</Text>
        </View>
      ))}
      <View style={[styles.cellBase, { width: LAB_W }]}><Text style={styles.cellBold}>Laboratorio</Text></View>
      <View style={[styles.cellLast, { width: SOL_W }]}><Text style={styles.cellBold}>Solicitante</Text></View>
    </View>
  )
}

function DataRow({ muestra, num, indicadores, patogenos }: { muestra: MuestraPDF; num: number; indicadores: MicroorganismoPDF[]; patogenos: MicroorganismoPDF[] }) {
  const allMicro = [...indicadores, ...patogenos]
  return (
    <View style={styles.tableRow}>
      <View style={[styles.cellBase, { width: NUM_W, alignItems: 'center' }]}><Text>{num}</Text></View>
      <View style={[styles.cellBase, { width: FECHA_W }]}><Text>{formatFecha(muestra.fecha_muestreo)}</Text></View>
      <View style={[styles.cellBase, { width: HORA_W }]}><Text>{muestra.hora_muestreo ?? ''}</Text></View>
      <View style={[styles.cellBase, { width: DESC_W }]}><Text>{muestra.descripcion_muestra}</Text></View>
      {allMicro.map((m) => (
        <View key={m.codigo} style={[styles.cellBase, { width: MICRO_W, alignItems: 'center' }]}>
          <Text>{muestra.microorganismos.includes(m.codigo) ? 'X' : ''}</Text>
        </View>
      ))}
      <View style={[styles.cellBase, { width: LAB_W }]}><Text>{muestra.laboratorio}</Text></View>
      <View style={[styles.cellLast, { width: SOL_W }]}><Text>{muestra.solicitante_nombre}</Text></View>
    </View>
  )
}

export function MuestrasLaboratorioPagina({ instalacion, instalacionCodigo, fecha, microorganismos, muestras, consolidado, desde, hasta }: MuestrasLaboratorioPaginaProps) {
  const indicadores = microorganismos.filter(m => m.tipo === 'indicador').sort((a, b) => a.orden - b.orden)
  const patogenos = microorganismos.filter(m => m.tipo === 'patogeno').sort((a, b) => a.orden - b.orden)
  const periodoLabel = consolidado && desde && hasta ? `${formatFecha(desde)} al ${formatFecha(hasta)}` : formatFecha(fecha)

  return (
    <Page size="A4" orientation="landscape" style={styles.page}>
      {/* Header */}
      <View style={styles.headerBox}>
        <View style={styles.headerRow}>
          <View style={[styles.headerCell, { width: 80, alignItems: 'center', justifyContent: 'center' }]}>
            <Text style={{ fontSize: 11, fontFamily: 'Helvetica-Bold' }}>M.A.D.Y</Text>
            <Text style={{ fontSize: 6 }}>DuoMind Solutions</Text>
          </View>
          <View style={[styles.titleBlock]}>
            <Text style={styles.title}>REGISTRO DE MUESTRAS ENVIADAS AL LABORATORIO</Text>
            <Text style={styles.subtitle}>F-FRUS-CAL-24  |  Rev 01</Text>
          </View>
          <View style={[styles.headerCell, { width: 120 }]}>
            <Text><Text style={styles.metaLabel}>Instalacion: </Text>{instalacion}</Text>
            <Text style={{ marginTop: 2 }}><Text style={styles.metaLabel}>Periodo: </Text>{periodoLabel}</Text>
          </View>
        </View>
      </View>

      {/* Table */}
      <View style={styles.table}>
        <GrupoHeaderRow indicadores={indicadores} patogenos={patogenos} />
        <ColumnHeaderRow indicadores={indicadores} patogenos={patogenos} />
        {muestras.map((m, i) => (
          <DataRow key={m.id} muestra={m} num={i + 1} indicadores={indicadores} patogenos={patogenos} />
        ))}
      </View>

      {/* Legend */}
      <View style={{ marginBottom: 6 }}>
        <Text style={{ fontSize: 6, fontFamily: 'Helvetica-Bold', marginBottom: 2 }}>Codigos de microorganismos:</Text>
        <View style={{ flexDirection: 'row', flexWrap: 'wrap' }}>
          {microorganismos.map(m => (
            <Text key={m.codigo} style={{ fontSize: 6, marginRight: 8, marginBottom: 1 }}>
              {m.codigo} = {m.label}
            </Text>
          ))}
        </View>
      </View>

      {/* Signature */}
      <View style={styles.signatureRow}>
        <View style={styles.signatureBox}>
          <Text style={{ fontSize: 7 }}>Firma del solicitante</Text>
        </View>
      </View>

      <Text style={styles.footer}>M.A.D.Y — DuoMind Solutions</Text>
    </Page>
  )
}

export function MuestrasLaboratorioPDF(props: MuestrasLaboratorioPaginaProps) {
  return (
    <Document>
      <MuestrasLaboratorioPagina {...props} />
    </Document>
  )
}

export function MuestrasLaboratorioConsolidadoPDF({ instalacion, instalacionCodigo, desde, hasta, microorganismos, muestras }: MuestrasLaboratorioConsolidadoProps) {
  return (
    <Document>
      <MuestrasLaboratorioPagina
        instalacion={instalacion}
        instalacionCodigo={instalacionCodigo}
        fecha={desde}
        microorganismos={microorganismos}
        muestras={muestras}
        consolidado={true}
        desde={desde}
        hasta={hasta}
      />
    </Document>
  )
}
