import { Document, Page, Text, View, StyleSheet } from '@react-pdf/renderer'

export interface MonitoreoRow {
  fecha: string
  tipo_germicida: string
  uso: string
  concentracion: number
  correccion: string | null
  preparado_por: string
}

interface Props {
  rancho: string
  orgNombre?: string | null
  desde: string
  hasta: string
  monitoreos: MonitoreoRow[]
}

function fmtFecha(iso: string): string {
  try {
    const [y, m, d] = iso.split('-')
    return `${d}/${m}/${y}`
  } catch { return iso }
}

const s = StyleSheet.create({
  page:     { fontFamily: 'Helvetica', fontSize: 8, padding: 28, backgroundColor: '#ffffff' },
  title:    { fontSize: 13, fontFamily: 'Helvetica-Bold', marginBottom: 2 },
  codigo:   { fontSize: 8, color: '#666666', marginBottom: 4 },
  meta:     { fontSize: 8, color: '#333333', marginBottom: 2 },
  table:    { borderTop: '1pt solid #cccccc', borderLeft: '1pt solid #cccccc', marginTop: 12 },
  row:      { flexDirection: 'row', borderBottom: '1pt solid #cccccc' },
  cellHead: { fontFamily: 'Helvetica-Bold', padding: 4, borderRight: '1pt solid #cccccc', backgroundColor: '#f0f0f0', fontSize: 8 },
  cell:     { padding: 4, borderRight: '1pt solid #cccccc', fontSize: 8 },
  footer:   { marginTop: 24, flexDirection: 'row', justifyContent: 'space-between', alignItems: 'flex-end' },
  firma:    { width: 190, borderTop: '1pt solid #000000', paddingTop: 4, fontSize: 7, textAlign: 'center' },
  marca:    { fontSize: 7, color: '#888888' },
})

const C = { FECHA: 55, TIPO: 105, USO: 105, PPM: 52, CORR: 100, PREP: 95 }

export function MonitoreoGermicidaPDF({ rancho, orgNombre, desde, hasta, monitoreos }: Props) {
  const periodo = desde === hasta ? fmtFecha(desde) : `${fmtFecha(desde)} - ${fmtFecha(hasta)}`

  return (
    <Document>
      <Page size="A4" orientation="landscape" style={s.page}>
        <Text style={s.title}>Monitoreo de Solución Germicida</Text>
        <Text style={s.codigo}>F-FRUS-SAN-14</Text>
        {orgNombre ? <Text style={s.meta}>{orgNombre}</Text> : null}
        <Text style={s.meta}>Instalación: {rancho}</Text>
        <Text style={s.meta}>Período: {periodo}</Text>

        <View style={s.table}>
          <View style={s.row}>
            <Text style={[s.cellHead, { width: C.FECHA }]}>Fecha</Text>
            <Text style={[s.cellHead, { width: C.TIPO  }]}>Tipo de germicida</Text>
            <Text style={[s.cellHead, { width: C.USO   }]}>Uso</Text>
            <Text style={[s.cellHead, { width: C.PPM   }]}>Conc. (ppm)</Text>
            <Text style={[s.cellHead, { width: C.CORR  }]}>Corrección</Text>
            <Text style={[s.cellHead, { width: C.PREP  }]}>Preparado por</Text>
          </View>
          {monitoreos.map((m, i) => (
            <View key={i} style={s.row}>
              <Text style={[s.cell, { width: C.FECHA }]}>{fmtFecha(m.fecha)}</Text>
              <Text style={[s.cell, { width: C.TIPO  }]}>{m.tipo_germicida}</Text>
              <Text style={[s.cell, { width: C.USO   }]}>{m.uso}</Text>
              <Text style={[s.cell, { width: C.PPM   }]}>{m.concentracion} ppm</Text>
              <Text style={[s.cell, { width: C.CORR  }]}>{m.correccion ?? ''}</Text>
              <Text style={[s.cell, { width: C.PREP  }]}>{m.preparado_por}</Text>
            </View>
          ))}
        </View>

        <View style={s.footer}>
          <View style={s.firma}>
            <Text>Verifico: Responsable del cooler</Text>
          </View>
          <Text style={s.marca}>M.A.D.Y — DuoMind Solutions</Text>
        </View>
      </Page>
    </Document>
  )
}
