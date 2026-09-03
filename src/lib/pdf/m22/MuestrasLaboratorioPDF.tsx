import { Document, Page, View, Text } from '@react-pdf/renderer'
import { TopBar, PdfFooter } from '@/lib/pdf/components/PdfPage'
import { PdfHeader } from '@/lib/pdf/components/PdfHeader'
import { PdfSectionBanner } from '@/lib/pdf/components/PdfSectionBanner'
import { PdfFieldGrid, PdfFieldRow, PdfField } from '@/lib/pdf/components/PdfFieldGrid'
import { PdfSignatures } from '@/lib/pdf/components/PdfSignatures'
import { PdfLegend } from '@/lib/pdf/components/PdfLegend'
import { codigoFormato } from '@/lib/codigoFormato'
import { PC } from '@/lib/pdf/components/tokens'

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
  codigoClave: string
  terminoSitio?: string
}

export interface MuestrasLaboratorioConsolidadoProps {
  instalacion: string
  instalacionCodigo: string
  desde: string
  hasta: string
  microorganismos: MicroorganismoPDF[]
  muestras: MuestraPDF[]
  codigoClave: string
}

const MARGIN = 14

const NUM_W = 20
const FECHA_W = 44
const HORA_W = 28
const DESC_W = 90
const MICRO_W = 22
const LAB_W = 60
const SOL_W = 56

const thStyle = {
  padding: 3,
  borderRightWidth: 1,
  borderRightColor: '#5599CC',
  borderBottomWidth: 1,
  borderBottomColor: '#5599CC',
  justifyContent: 'center',
  alignItems: 'center',
} as const

const tdStyle = {
  borderRightWidth: 1,
  borderRightColor: PC.border,
  borderBottomWidth: 1,
  borderBottomColor: PC.border,
  justifyContent: 'center',
  alignItems: 'center',
  padding: 1,
} as const

const HDR_BG = '#EFF7F9'
const ROW_ALT = '#F5F9FE'

function formatFecha(f: string) {
  if (!f) return '—'
  const [y, m, d] = f.split('-')
  return `${d}/${m}/${y}`
}

function GrupoHeaderRow({ indicadores, patogenos }: { indicadores: MicroorganismoPDF[]; patogenos: MicroorganismoPDF[] }) {
  const indW = indicadores.length * MICRO_W
  const patW = patogenos.length * MICRO_W
  return (
    <View style={{ flexDirection: 'row', backgroundColor: PC.section }}>
      <View style={[thStyle, { width: NUM_W + FECHA_W + HORA_W + DESC_W, backgroundColor: PC.section }]} />
      <View style={[thStyle, { width: indW, backgroundColor: PC.section }]}>
        <Text style={{ fontFamily: 'Helvetica-Bold', fontSize: 6.5, color: PC.white }}>m.o. Indicadores</Text>
      </View>
      <View style={[thStyle, { width: patW, backgroundColor: PC.section }]}>
        <Text style={{ fontFamily: 'Helvetica-Bold', fontSize: 6.5, color: PC.white }}>m.o. Patogenos</Text>
      </View>
      <View style={{ width: LAB_W + SOL_W, backgroundColor: PC.section }} />
    </View>
  )
}

function ColumnHeaderRow({ indicadores, patogenos }: { indicadores: MicroorganismoPDF[]; patogenos: MicroorganismoPDF[] }) {
  return (
    <View style={{ flexDirection: 'row', backgroundColor: HDR_BG }}>
      <View style={[thStyle, { width: NUM_W, backgroundColor: HDR_BG }]}>
        <Text style={{ fontFamily: 'Helvetica-Bold', fontSize: 6.5, color: PC.fieldValue }}>No.</Text>
      </View>
      <View style={[thStyle, { width: FECHA_W, backgroundColor: HDR_BG, alignItems: 'flex-start' }]}>
        <Text style={{ fontFamily: 'Helvetica-Bold', fontSize: 6.5, color: PC.fieldValue }}>Fecha de muestreo</Text>
      </View>
      <View style={[thStyle, { width: HORA_W, backgroundColor: HDR_BG, alignItems: 'flex-start' }]}>
        <Text style={{ fontFamily: 'Helvetica-Bold', fontSize: 6.5, color: PC.fieldValue }}>Hora</Text>
      </View>
      <View style={[thStyle, { width: DESC_W, backgroundColor: HDR_BG, alignItems: 'flex-start' }]}>
        <Text style={{ fontFamily: 'Helvetica-Bold', fontSize: 6.5, color: PC.fieldValue }}>Descripcion de la muestra</Text>
      </View>
      {[...indicadores, ...patogenos].map((m) => (
        <View key={m.codigo} style={[thStyle, { width: MICRO_W, backgroundColor: HDR_BG }]}>
          <Text style={{ fontFamily: 'Helvetica-Bold', fontSize: 6.5, color: PC.fieldValue }}>{m.codigo}</Text>
        </View>
      ))}
      <View style={[thStyle, { width: LAB_W, backgroundColor: HDR_BG, alignItems: 'flex-start' }]}>
        <Text style={{ fontFamily: 'Helvetica-Bold', fontSize: 6.5, color: PC.fieldValue }}>Laboratorio</Text>
      </View>
      <View style={[thStyle, { width: SOL_W, backgroundColor: HDR_BG, alignItems: 'flex-start', borderRightWidth: 0 }]}>
        <Text style={{ fontFamily: 'Helvetica-Bold', fontSize: 6.5, color: PC.fieldValue }}>Solicitante</Text>
      </View>
    </View>
  )
}

function DataRow({ muestra, num, indicadores, patogenos, alt }: { muestra: MuestraPDF; num: number; indicadores: MicroorganismoPDF[]; patogenos: MicroorganismoPDF[]; alt: boolean }) {
  const allMicro = [...indicadores, ...patogenos]
  const bg = alt ? ROW_ALT : PC.white
  return (
    <View style={{ flexDirection: 'row', backgroundColor: bg }}>
      <View style={[tdStyle, { width: NUM_W }]}><Text style={{ fontSize: 6.5, color: PC.fieldValue }}>{num}</Text></View>
      <View style={[tdStyle, { width: FECHA_W, alignItems: 'flex-start', padding: 3 }]}><Text style={{ fontSize: 6.5, color: PC.fieldValue }}>{formatFecha(muestra.fecha_muestreo)}</Text></View>
      <View style={[tdStyle, { width: HORA_W, alignItems: 'flex-start', padding: 3 }]}><Text style={{ fontSize: 6.5, color: PC.fieldValue }}>{muestra.hora_muestreo ?? ''}</Text></View>
      <View style={[tdStyle, { width: DESC_W, alignItems: 'flex-start', padding: 3 }]}><Text style={{ fontSize: 6.5, color: PC.fieldValue }}>{muestra.descripcion_muestra}</Text></View>
      {allMicro.map((m) => (
        <View key={m.codigo} style={[tdStyle, { width: MICRO_W }]}>
          <Text style={{ fontSize: 6.5, color: PC.fieldValue }}>{muestra.microorganismos.includes(m.codigo) ? 'X' : ''}</Text>
        </View>
      ))}
      <View style={[tdStyle, { width: LAB_W, alignItems: 'flex-start', padding: 3 }]}><Text style={{ fontSize: 6.5, color: PC.fieldValue }}>{muestra.laboratorio}</Text></View>
      <View style={[tdStyle, { width: SOL_W, alignItems: 'flex-start', padding: 3, borderRightWidth: 0 }]}><Text style={{ fontSize: 6.5, color: PC.fieldValue }}>{muestra.solicitante_nombre}</Text></View>
    </View>
  )
}

export function MuestrasLaboratorioPagina({
  instalacion,
  instalacionCodigo,
  fecha,
  microorganismos,
  muestras,
  consolidado,
  desde,
  hasta,
  codigoClave,
  terminoSitio = 'Instalación',
}: MuestrasLaboratorioPaginaProps) {
  const indicadores = microorganismos.filter(m => m.tipo === 'indicador').sort((a, b) => a.orden - b.orden)
  const patogenos = microorganismos.filter(m => m.tipo === 'patogeno').sort((a, b) => a.orden - b.orden)
  const periodoLabel = consolidado && desde && hasta
    ? `${formatFecha(desde)} al ${formatFecha(hasta)}`
    : formatFecha(fecha)
  const codigoFmt = codigoFormato('F-FRUS-CAL-24', codigoClave)

  return (
    <Page
      size="A4"
      orientation="landscape"
      style={{ fontFamily: 'Helvetica', fontSize: 7, padding: MARGIN, paddingBottom: 50, backgroundColor: PC.white }}
    >
      <PdfFooter moduloCodigo="M22" />
      <TopBar />
      <PdfHeader
        titulo="REGISTRO DE MUESTRAS ENVIADAS AL LABORATORIO"
        subtitulo={`Muestras al laboratorio | ${instalacion}`}
        codigoFormato={codigoFmt}
        folio={periodoLabel}
        fecha={periodoLabel}
      />

      <PdfSectionBanner>1. Datos del sitio</PdfSectionBanner>
      <PdfFieldGrid>
        <PdfFieldRow>
          <PdfField label={terminoSitio} value={instalacion} />
          <PdfField label="Codigo" value={instalacionCodigo || '—'} />
          <PdfField label="Periodo" value={periodoLabel} />
        </PdfFieldRow>
      </PdfFieldGrid>

      <PdfSectionBanner>2. Muestras enviadas</PdfSectionBanner>

      <View style={{ marginTop: 4, borderWidth: 1, borderColor: PC.border }}>
        <GrupoHeaderRow indicadores={indicadores} patogenos={patogenos} />
        <ColumnHeaderRow indicadores={indicadores} patogenos={patogenos} />
        {muestras.map((m, i) => (
          <DataRow key={m.id} muestra={m} num={i + 1} indicadores={indicadores} patogenos={patogenos} alt={i % 2 === 1} />
        ))}
      </View>

      <PdfLegend
        entradas={[
          {
            titulo: 'Microorganismos',
            items: microorganismos.map(m => ({ codigo: m.codigo, label: m.label })),
          },
        ]}
      />

      <PdfSignatures
        signatures={[{ label: '', nombre: '', caption: 'Firma del solicitante' }]}
      />
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

export function MuestrasLaboratorioConsolidadoPDF({ instalacion, instalacionCodigo, desde, hasta, microorganismos, muestras, codigoClave }: MuestrasLaboratorioConsolidadoProps) {
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
        codigoClave={codigoClave}
      />
    </Document>
  )
}
