import { Document, Page, View, Text } from '@react-pdf/renderer'
import { TopBar, PdfFooter } from '@/lib/pdf/components/PdfPage'
import { PdfHeader } from '@/lib/pdf/components/PdfHeader'
import { PdfSectionBanner } from '@/lib/pdf/components/PdfSectionBanner'
import { PdfFieldGrid, PdfFieldRow, PdfField } from '@/lib/pdf/components/PdfFieldGrid'
import { PdfSignatures } from '@/lib/pdf/components/PdfSignatures'
import { PC } from '@/lib/pdf/components/tokens'
import { codigoFormato } from '@/lib/codigoFormato'

export interface ProductoAutorizadoRow {
  cultivo: string
  ingrediente_activo: string
  nombre_comercial: string
  concentracion: string
  empresa: string
  dosis_ha: string
  intervalo_seguridad_dias: number | null
  plagas_control: string
  mercado: string
}

interface Props {
  orgNombre: string
  productos: ProductoAutorizadoRow[]
  codigoClave: string
  cultivoFiltro?: string | null
  fecha?: string
}

const MARGIN = 20

const thStyle = {
  padding: 3,
  borderRightWidth: 1,
  borderRightColor: '#5599CC',
  borderBottomWidth: 1,
  borderBottomColor: '#5599CC',
  justifyContent: 'center' as const,
  alignItems: 'center' as const,
}

const tdStyle = {
  borderRightWidth: 1,
  borderRightColor: PC.border,
  borderBottomWidth: 1,
  borderBottomColor: PC.border,
  justifyContent: 'center' as const,
  alignItems: 'center' as const,
  padding: 1,
}

const ROW_ALT = '#F5F9FE'

const C = { ING: 100, COM: 95, CONC: 55, EMP: 80, DOS: 50, IS: 35, PLA: 110, MER: 55 }

function fmtFecha(iso: string): string {
  try {
    const [y, m, d] = iso.split('-')
    return `${d}/${m}/${y}`
  } catch { return iso }
}

export function ProductosAutorizadosPDF({ orgNombre, productos, codigoClave, cultivoFiltro, fecha }: Props) {
  const codigoFmt = codigoFormato('M66-PROD-AUT', codigoClave)
  const fechaDisplay = fecha ? fmtFecha(fecha) : new Date().toLocaleDateString('es-MX')

  // Agrupar por cultivo
  const cultivosUnicos = [...new Set(productos.map(p => p.cultivo))].sort()

  return (
    <Document>
      <Page
        size="A4"
        orientation="landscape"
        style={{ fontFamily: 'Helvetica', fontSize: 7, padding: MARGIN, paddingBottom: 50, backgroundColor: PC.white }}
      >
        <PdfFooter moduloCodigo="M66" />
        <TopBar />
        <PdfHeader
          titulo="LISTA DE PRODUCTOS AUTORIZADOS"
          subtitulo={`Plaguicidas y agroquimicos aprobados${cultivoFiltro ? ` | ${cultivoFiltro}` : ''}`}
          codigoFormato={codigoFmt}
          folio={fechaDisplay}
          fecha={fechaDisplay}
        />

        <PdfSectionBanner>1. Informacion general</PdfSectionBanner>
        <PdfFieldGrid>
          <PdfFieldRow>
            <PdfField label="Organizacion" value={orgNombre} />
            <PdfField label="Cultivo" value={cultivoFiltro ?? 'Todos'} />
            <PdfField label="Fecha de emision" value={fechaDisplay} />
          </PdfFieldRow>
        </PdfFieldGrid>

        {cultivosUnicos.map(cultivo => {
          const filas = productos.filter(p => p.cultivo === cultivo)
          return (
            <View key={cultivo}>
              <PdfSectionBanner>{cultivo}</PdfSectionBanner>

              <View style={{ marginTop: 4, borderWidth: 1, borderColor: PC.border, marginBottom: 8 }}>
                <View style={{ flexDirection: 'row', backgroundColor: PC.section }}>
                  <View style={[thStyle, { width: C.ING, backgroundColor: PC.section, alignItems: 'flex-start' }]}>
                    <Text style={{ fontFamily: 'Helvetica-Bold', fontSize: 6, color: PC.white }}>Ingrediente activo</Text>
                  </View>
                  <View style={[thStyle, { width: C.COM, backgroundColor: PC.section, alignItems: 'flex-start' }]}>
                    <Text style={{ fontFamily: 'Helvetica-Bold', fontSize: 6, color: PC.white }}>Nombre comercial</Text>
                  </View>
                  <View style={[thStyle, { width: C.CONC, backgroundColor: PC.section, alignItems: 'flex-start' }]}>
                    <Text style={{ fontFamily: 'Helvetica-Bold', fontSize: 6, color: PC.white }}>Concentracion</Text>
                  </View>
                  <View style={[thStyle, { width: C.EMP, backgroundColor: PC.section, alignItems: 'flex-start' }]}>
                    <Text style={{ fontFamily: 'Helvetica-Bold', fontSize: 6, color: PC.white }}>Empresa</Text>
                  </View>
                  <View style={[thStyle, { width: C.DOS, backgroundColor: PC.section, alignItems: 'flex-start' }]}>
                    <Text style={{ fontFamily: 'Helvetica-Bold', fontSize: 6, color: PC.white }}>Dosis/ha</Text>
                  </View>
                  <View style={[thStyle, { width: C.IS, backgroundColor: PC.section }]}>
                    <Text style={{ fontFamily: 'Helvetica-Bold', fontSize: 6, color: PC.white }}>I.S.</Text>
                  </View>
                  <View style={[thStyle, { width: C.PLA, backgroundColor: PC.section, alignItems: 'flex-start' }]}>
                    <Text style={{ fontFamily: 'Helvetica-Bold', fontSize: 6, color: PC.white }}>Plagas que controla</Text>
                  </View>
                  <View style={[thStyle, { width: C.MER, backgroundColor: PC.section, alignItems: 'flex-start', borderRightWidth: 0 }]}>
                    <Text style={{ fontFamily: 'Helvetica-Bold', fontSize: 6, color: PC.white }}>Mercado</Text>
                  </View>
                </View>

                {filas.map((p, i) => {
                  const bg = i % 2 === 1 ? ROW_ALT : PC.white
                  return (
                    <View key={i} style={{ flexDirection: 'row', backgroundColor: bg }}>
                      <View style={[tdStyle, { width: C.ING, alignItems: 'flex-start', padding: 4 }]}>
                        <Text style={{ fontSize: 6, color: PC.fieldValue }}>{p.ingrediente_activo}</Text>
                      </View>
                      <View style={[tdStyle, { width: C.COM, alignItems: 'flex-start', padding: 4 }]}>
                        <Text style={{ fontSize: 6, color: PC.fieldValue }}>{p.nombre_comercial}</Text>
                      </View>
                      <View style={[tdStyle, { width: C.CONC, alignItems: 'flex-start', padding: 4 }]}>
                        <Text style={{ fontSize: 6, color: PC.fieldValue }}>{p.concentracion}</Text>
                      </View>
                      <View style={[tdStyle, { width: C.EMP, alignItems: 'flex-start', padding: 4 }]}>
                        <Text style={{ fontSize: 6, color: PC.fieldValue }}>{p.empresa}</Text>
                      </View>
                      <View style={[tdStyle, { width: C.DOS, alignItems: 'flex-start', padding: 4 }]}>
                        <Text style={{ fontSize: 6, color: PC.fieldValue }}>{p.dosis_ha}</Text>
                      </View>
                      <View style={[tdStyle, { width: C.IS, padding: 4 }]}>
                        <Text style={{ fontSize: 6, color: PC.fieldValue }}>{p.intervalo_seguridad_dias != null ? `${p.intervalo_seguridad_dias}d` : '—'}</Text>
                      </View>
                      <View style={[tdStyle, { width: C.PLA, alignItems: 'flex-start', padding: 4 }]}>
                        <Text style={{ fontSize: 6, color: PC.fieldValue }}>{p.plagas_control}</Text>
                      </View>
                      <View style={[tdStyle, { width: C.MER, alignItems: 'flex-start', padding: 4, borderRightWidth: 0 }]}>
                        <Text style={{ fontSize: 6, color: PC.fieldValue }}>{p.mercado}</Text>
                      </View>
                    </View>
                  )
                })}
              </View>
            </View>
          )
        })}

        <PdfSignatures
          signatures={[{ label: '', nombre: '', caption: 'Verifico: Responsable de Inocuidad' }]}
        />
      </Page>
    </Document>
  )
}
