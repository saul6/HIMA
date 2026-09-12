import { Document, Page, View, Text } from '@react-pdf/renderer'
import { TopBar, PdfFooter } from '@/lib/pdf/components/PdfPage'
import { PdfHeader } from '@/lib/pdf/components/PdfHeader'
import { PdfSectionBanner } from '@/lib/pdf/components/PdfSectionBanner'
import { PC } from '@/lib/pdf/components/tokens'

export interface M57RowPDF {
  cargo: string
  tematica: string
  periodicidad: string
  mes_programado: string
  observaciones: string | null
}

export interface CronogramaCapacitacionPDFProps {
  orgNombre: string
  registros: M57RowPDF[]
}

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

export function CronogramaCapacitacionPDF({ orgNombre, registros }: CronogramaCapacitacionPDFProps) {
  return (
    <Document>
      <Page
        size="A4"
        style={{ fontFamily: 'Helvetica', fontSize: 8, padding: 24, paddingBottom: 46, backgroundColor: PC.white }}
      >
        <PdfFooter moduloCodigo="M57" />
        <View style={{ flex: 1, borderWidth: 1, borderColor: PC.border, borderRadius: 12, overflow: 'hidden' }}>
          <TopBar />
          <PdfHeader
            titulo="Cronograma de Capacitaciones"
            subtitulo={orgNombre}
            codigoFormato="M57"
            folio="Vigente"
            fecha={fechaHoy()}
          />
          <PdfSectionBanner label="Registro de Cronograma de Capacitaciones" />

          <View style={{ marginTop: 8, marginHorizontal: 8, borderWidth: 1, borderColor: PC.border }}>
            <View style={{ flexDirection: 'row', backgroundColor: PC.section }}>
              <View style={[thStyle, { flex: 2 }]}>
                <Text style={{ fontFamily: 'Helvetica-Bold', fontSize: 7, color: PC.white }}>Cargo</Text>
              </View>
              <View style={[thStyle, { flex: 3 }]}>
                <Text style={{ fontFamily: 'Helvetica-Bold', fontSize: 7, color: PC.white }}>Tematica</Text>
              </View>
              <View style={[thStyle, { flex: 1.5 }]}>
                <Text style={{ fontFamily: 'Helvetica-Bold', fontSize: 7, color: PC.white }}>Periodicidad</Text>
              </View>
              <View style={[thStyle, { flex: 1.5 }]}>
                <Text style={{ fontFamily: 'Helvetica-Bold', fontSize: 7, color: PC.white }}>Mes Programado</Text>
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
                  <View style={[tdStyle, { flex: 2 }]}>
                    <Text style={{ fontSize: 7, color: PC.fieldValue }}>{row.cargo}</Text>
                  </View>
                  <View style={[tdStyle, { flex: 3 }]}>
                    <Text style={{ fontSize: 7, color: PC.fieldValue }}>{row.tematica}</Text>
                  </View>
                  <View style={[tdStyle, { flex: 1.5 }]}>
                    <Text style={{ fontSize: 7, color: PC.fieldValue }}>{row.periodicidad}</Text>
                  </View>
                  <View style={[tdStyle, { flex: 1.5 }]}>
                    <Text style={{ fontSize: 7, color: PC.fieldValue }}>{row.mes_programado}</Text>
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
