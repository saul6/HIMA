import { Document, Page, View, Text } from '@react-pdf/renderer'
import { TopBar, PdfFooter } from '@/lib/pdf/components/PdfPage'
import { PdfHeader } from '@/lib/pdf/components/PdfHeader'
import { PdfSectionBanner } from '@/lib/pdf/components/PdfSectionBanner'
import { PdfFieldGrid, PdfFieldRow, PdfField } from '@/lib/pdf/components/PdfFieldGrid'
import { PdfSignatures } from '@/lib/pdf/components/PdfSignatures'
import { PC } from '@/lib/pdf/components/tokens'

export interface M68MatrizRow {
  criterio_numero: number
  criterio_descripcion: string
  trampas: boolean[]
}

export interface MonitoreoRoedoresPDFProps {
  rancho: string
  orgNombre?: string | null
  fecha: string
  ubicacion: string
  responsable: string | null
  observaciones: string | null
  matriz: M68MatrizRow[]
  num_trampas: number
}

const MARGIN = 24
const CRITERIO_COL_W = 200
const A4_LANDSCAPE_W = 841.89

function fmtFecha(iso: string): string {
  try {
    const [y, m, d] = iso.split('-')
    return `${d}/${m}/${y}`
  } catch { return iso }
}

export function MonitoreoRoedoresPage({
  rancho,
  orgNombre,
  fecha,
  ubicacion,
  responsable,
  observaciones,
  matriz,
  num_trampas,
}: MonitoreoRoedoresPDFProps) {
  const usable = A4_LANDSCAPE_W - 2 * MARGIN
  const trampaColW = Math.floor((usable - CRITERIO_COL_W) / num_trampas)

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
    padding: 2,
  } as const

  return (
    <Page
      size="A4"
      orientation="landscape"
      style={{ fontFamily: 'Helvetica', fontSize: 8, padding: MARGIN, paddingBottom: 50, backgroundColor: PC.white }}
    >
      <PdfFooter moduloCodigo="REG-23" />
      <TopBar />
      <PdfHeader
        titulo="MONITOREO DE TRAMPAS PARA ROEDORES"
        subtitulo={`REG-23 · GlobalG.A.P. v6 | ${rancho}`}
        codigoFormato="REG-23"
        folio={fmtFecha(fecha)}
        fecha={fmtFecha(fecha)}
      />

      <PdfSectionBanner>1. Datos generales</PdfSectionBanner>
      <PdfFieldGrid>
        <PdfFieldRow>
          <PdfField label="Rancho/Instalacion" value={rancho} />
          <PdfField label="Ubicacion" value={ubicacion} />
          {orgNombre && <PdfField label="Organizacion" value={orgNombre} />}
        </PdfFieldRow>
        <PdfFieldRow>
          <PdfField label="Fecha" value={fmtFecha(fecha)} />
          <PdfField label="No. de trampas" value={String(num_trampas)} />
          <PdfField label="Responsable" value={responsable ?? '—'} />
        </PdfFieldRow>
      </PdfFieldGrid>

      <PdfSectionBanner>2. Monitoreo de trampas</PdfSectionBanner>

      <View style={{ marginTop: 4, borderWidth: 1, borderColor: PC.border }}>
        <View style={{ flexDirection: 'row', backgroundColor: PC.section }}>
          <View style={[thStyle, { width: CRITERIO_COL_W, alignItems: 'flex-start', backgroundColor: PC.section }]}>
            <Text style={{ fontFamily: 'Helvetica-Bold', fontSize: 7, color: PC.white }}>Criterio de evaluacion</Text>
          </View>
          {Array.from({ length: num_trampas }, (_, i) => i + 1).map(n => (
            <View
              key={n}
              style={[
                thStyle,
                {
                  width: trampaColW,
                  backgroundColor: PC.section,
                  borderRightWidth: n === num_trampas ? 0 : 1,
                },
              ]}
            >
              <Text style={{ fontFamily: 'Helvetica-Bold', fontSize: 7, color: PC.white }}>T{n}</Text>
            </View>
          ))}
        </View>

        {matriz.map((row, ri) => {
          const bg = ri % 2 === 1 ? '#F5F9FE' : PC.white
          return (
            <View key={ri} style={{ flexDirection: 'row', backgroundColor: bg }}>
              <View style={[tdStyle, { width: CRITERIO_COL_W, alignItems: 'flex-start', padding: 4 }]}>
                <Text style={{ fontSize: 7, color: PC.fieldValue }}>
                  {row.criterio_numero}. {row.criterio_descripcion}
                </Text>
              </View>
              {Array.from({ length: num_trampas }, (_, ti) => {
                const cumple = row.trampas[ti] ?? false
                return (
                  <View
                    key={ti}
                    style={[tdStyle, { width: trampaColW, borderRightWidth: ti === num_trampas - 1 ? 0 : 1 }]}
                  >
                    {cumple && (
                      <Text style={{ fontSize: 9, fontFamily: 'Helvetica-Bold', color: PC.section }}>X</Text>
                    )}
                  </View>
                )
              })}
            </View>
          )
        })}
      </View>

      {observaciones && (
        <>
          <PdfSectionBanner>3. Observaciones y/o accion correctiva</PdfSectionBanner>
          <View style={{ marginTop: 4, padding: 8, borderWidth: 1, borderColor: PC.border, borderRadius: 4 }}>
            <Text style={{ fontSize: 8, color: PC.fieldValue }}>{observaciones}</Text>
          </View>
        </>
      )}

      <PdfSignatures
        signatures={[{ label: '', nombre: '', caption: 'Responsable de Inocuidad' }]}
      />
    </Page>
  )
}

export function MonitoreoRoedoresPDF(props: MonitoreoRoedoresPDFProps) {
  return (
    <Document>
      <MonitoreoRoedoresPage {...props} />
    </Document>
  )
}
