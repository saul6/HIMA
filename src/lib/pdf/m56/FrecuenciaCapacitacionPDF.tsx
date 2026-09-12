import { Document, Page, View, Text } from '@react-pdf/renderer'
import { TopBar, PdfFooter } from '@/lib/pdf/components/PdfPage'
import { PdfHeader } from '@/lib/pdf/components/PdfHeader'
import { PdfSectionBanner } from '@/lib/pdf/components/PdfSectionBanner'
import { PC } from '@/lib/pdf/components/tokens'

export interface M56RowPDF {
  tema: string
  anio: number
  mes: number
  capacitador: string | null
  realizado: boolean
  observaciones: string | null
}

export interface FrecuenciaCapacitacionPDFProps {
  orgNombre: string
  registros: M56RowPDF[]
  anioFiltro?: number | null
}

const MESES = ['Enero','Febrero','Marzo','Abril','Mayo','Junio','Julio','Agosto','Septiembre','Octubre','Noviembre','Diciembre']

const ROW_ALT = '#F5F9FE'

const thStyle = {
  padding: 4,
  borderRightWidth: 1,
  borderRightColor: '#5599CC',
  borderBottomWidth: 1,
  borderBottomColor: '#5599CC',
  justifyContent: 'center' as const,
  alignItems: 'flex-start' as const,
}

const tdStyle = {
  borderRightWidth: 1,
  borderRightColor: PC.border,
  borderBottomWidth: 1,
  borderBottomColor: PC.border,
  justifyContent: 'center' as const,
  alignItems: 'flex-start' as const,
  padding: 4,
}

function fechaHoy(): string {
  return new Date().toLocaleDateString('es-MX', {
    day: '2-digit', month: '2-digit', year: 'numeric',
    timeZone: 'America/Mexico_City',
  })
}

export function FrecuenciaCapacitacionPDF({ orgNombre, registros, anioFiltro }: FrecuenciaCapacitacionPDFProps) {
  return (
    <Document>
      <Page
        size="A4"
        style={{ fontFamily: 'Helvetica', fontSize: 8, padding: 24, paddingBottom: 46, backgroundColor: PC.white }}
      >
        <PdfFooter moduloCodigo="M56" />
        <View style={{ flex: 1, borderWidth: 1, borderColor: PC.border, borderRadius: 12, overflow: 'hidden' }}>
          <TopBar />
          <PdfHeader
            titulo="Frecuencia de Capacitacion"
            subtitulo={orgNombre}
            codigoFormato="M56"
            folio={anioFiltro ? String(anioFiltro) : 'Todos'}
            fecha={fechaHoy()}
          />
          <PdfSectionBanner label="Registro de Frecuencia de Capacitacion" />

          <View style={{ marginTop: 8, marginHorizontal: 8, borderWidth: 1, borderColor: PC.border }}>
            <View style={{ flexDirection: 'row', backgroundColor: PC.section }}>
              <View style={[thStyle, { flex: 3 }]}>
                <Text style={{ fontFamily: 'Helvetica-Bold', fontSize: 7, color: PC.white }}>Tema</Text>
              </View>
              <View style={[thStyle, { flex: 1 }]}>
                <Text style={{ fontFamily: 'Helvetica-Bold', fontSize: 7, color: PC.white }}>Ano</Text>
              </View>
              <View style={[thStyle, { flex: 1.5 }]}>
                <Text style={{ fontFamily: 'Helvetica-Bold', fontSize: 7, color: PC.white }}>Mes</Text>
              </View>
              <View style={[thStyle, { flex: 2 }]}>
                <Text style={{ fontFamily: 'Helvetica-Bold', fontSize: 7, color: PC.white }}>Capacitador</Text>
              </View>
              <View style={[thStyle, { flex: 1 }]}>
                <Text style={{ fontFamily: 'Helvetica-Bold', fontSize: 7, color: PC.white }}>Realizado</Text>
              </View>
              <View style={[thStyle, { flex: 2, borderRightWidth: 0 }]}>
                <Text style={{ fontFamily: 'Helvetica-Bold', fontSize: 7, color: PC.white }}>Observaciones</Text>
              </View>
            </View>

            {registros.length === 0 && (
              <View style={{ padding: 16, alignItems: 'center' }}>
                <Text style={{ fontSize: 8, color: PC.textSub }}>Sin registros</Text>
              </View>
            )}

            {registros.map((row, i) => {
              const bg = i % 2 === 1 ? ROW_ALT : PC.white
              return (
                <View key={i} style={{ flexDirection: 'row', backgroundColor: bg }}>
                  <View style={[tdStyle, { flex: 3 }]}>
                    <Text style={{ fontSize: 7, color: PC.fieldValue }}>{row.tema}</Text>
                  </View>
                  <View style={[tdStyle, { flex: 1 }]}>
                    <Text style={{ fontSize: 7, color: PC.fieldValue }}>{row.anio}</Text>
                  </View>
                  <View style={[tdStyle, { flex: 1.5 }]}>
                    <Text style={{ fontSize: 7, color: PC.fieldValue }}>{MESES[(row.mes - 1)] ?? row.mes}</Text>
                  </View>
                  <View style={[tdStyle, { flex: 2 }]}>
                    <Text style={{ fontSize: 7, color: PC.fieldValue }}>{row.capacitador ?? '—'}</Text>
                  </View>
                  <View style={[tdStyle, { flex: 1, alignItems: 'center' as const }]}>
                    <Text style={{
                      fontSize: 7,
                      fontFamily: 'Helvetica-Bold',
                      color: row.realizado ? PC.section : PC.textSub,
                    }}>
                      {row.realizado ? 'Si' : 'No'}
                    </Text>
                  </View>
                  <View style={[tdStyle, { flex: 2, borderRightWidth: 0 }]}>
                    <Text style={{ fontSize: 7, color: PC.fieldValue }}>{row.observaciones ?? ''}</Text>
                  </View>
                </View>
              )
            })}
          </View>
        </View>
      </Page>
    </Document>
  )
}
