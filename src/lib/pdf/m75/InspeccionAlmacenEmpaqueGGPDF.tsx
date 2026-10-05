import { Document, Page, View, Text } from '@react-pdf/renderer'
import { TopBar, PdfFooter } from '@/lib/pdf/components/PdfPage'
import { PdfHeader } from '@/lib/pdf/components/PdfHeader'
import { PdfSectionBanner } from '@/lib/pdf/components/PdfSectionBanner'
import { PdfFieldGrid, PdfFieldRow, PdfField } from '@/lib/pdf/components/PdfFieldGrid'
import { PdfMonthlyMatrix } from '@/lib/pdf/components/PdfMonthlyMatrix'
import { PdfSignatures } from '@/lib/pdf/components/PdfSignatures'
import { PC } from '@/lib/pdf/components/tokens'
import type { FirmaParaPdf } from '@/hooks/useFirmasRegistro'

export interface M75ItemPDF {
  id: string
  numero: number
  texto: string
}

export interface M75AccionPDF {
  dia: number
  texto: string
}

export interface InspeccionAlmacenEmpaqueGGPaginaProps {
  rancho: string
  orgNombre?: string | null
  mes: string
  mesLabel: string
  cultivo: string | null
  realizoNombre: string | null
  observaciones: string | null
  items: M75ItemPDF[]
  diasConResultados: Set<number>
  matriz: Record<number, Record<string, string>>
  acciones: M75AccionPDF[]
  firmaRealizo?: FirmaParaPdf | null
  firmaVerifico?: FirmaParaPdf | null
}

const MARGIN = 20
const PAGE_W = 841.89 - MARGIN * 2
const ITEM_COL_W = 220

function diasDelMes(mesDate: string): number {
  const d = new Date(mesDate + 'T12:00:00')
  return new Date(d.getFullYear(), d.getMonth() + 1, 0).getDate()
}

function diaToISO(mesDate: string, dia: number): string {
  const d = new Date(mesDate + 'T12:00:00')
  const y = d.getFullYear()
  const m = String(d.getMonth() + 1).padStart(2, '0')
  return `${y}-${m}-${String(dia).padStart(2, '0')}`
}

function normalizar(val: string): string {
  if (val === 'si' || val === 'SI') return 'Si'
  if (val === 'no' || val === 'NO') return 'No'
  return 'N/A'
}

export function InspeccionAlmacenEmpaqueGGPagina({
  rancho, orgNombre, mes, mesLabel, cultivo, realizoNombre, observaciones,
  items, diasConResultados, matriz, acciones,
  firmaRealizo, firmaVerifico,
}: InspeccionAlmacenEmpaqueGGPaginaProps) {
  const totalDias = diasDelMes(mes)
  const todosLosDias = Array.from({ length: totalDias }, (_, i) => diaToISO(mes, i + 1))
  const inspeccionadosSet = new Set(Array.from(diasConResultados).map(d => diaToISO(mes, d)))
  const dW = Math.floor((PAGE_W - ITEM_COL_W) / Math.max(totalDias, 1))

  const matrizISO: Record<string, Record<string, string>> = {}
  for (const [diaStr, vals] of Object.entries(matriz)) {
    const fecha = diaToISO(mes, Number(diaStr))
    matrizISO[fecha] = {}
    for (const [itemId, val] of Object.entries(vals)) {
      matrizISO[fecha][itemId] = normalizar(val)
    }
  }

  // M75 no tiene secciones en catálogo — agrupamos todos bajo una misma sección
  const matrixItems = items.map(it => ({
    id: it.id,
    seccion_label: 'Inspección de Almacen de Empaque',
    item: `${it.numero}. ${it.texto}`,
  }))

  return (
    <Page
      size="A4"
      orientation="landscape"
      style={{ fontFamily: 'Helvetica', fontSize: 8, padding: MARGIN, paddingBottom: 50, backgroundColor: PC.white }}
    >
      <PdfFooter moduloCodigo="REG-22" />
      <TopBar />
      <PdfHeader
        titulo="INSPECCION DE ALMACEN DE MATERIAL DE EMPAQUE Y/O EMBALAJE"
        subtitulo={`REG-22 · GlobalG.A.P. v6 | ${rancho}`}
        codigoFormato="REG-22"
        folio={mesLabel}
        fecha={mesLabel}
      />

      <PdfSectionBanner>Datos generales</PdfSectionBanner>
      <PdfFieldGrid>
        <PdfFieldRow>
          {orgNombre && <PdfField label="Compania" value={orgNombre} />}
          <PdfField label="Rancho" value={rancho} />
          {cultivo && <PdfField label="Cultivo" value={cultivo} />}
          <PdfField label="Mes y Año" value={mesLabel} />
        </PdfFieldRow>
      </PdfFieldGrid>

      <View style={{ marginBottom: 3 }}>
        <Text style={{ fontSize: 6.5, color: PC.textSub, fontStyle: 'italic' }}>
          Si = cumple, No = no cumple, N/A = no aplica.
        </Text>
      </View>

      <PdfMonthlyMatrix
        items={matrixItems}
        todosLosDias={todosLosDias}
        inspeccionadosSet={inspeccionadosSet}
        matriz={matrizISO}
        itemColW={ITEM_COL_W}
        dayColW={dW}
        defaultVal="N/A"
      />

      {acciones.length > 0 && (
        <>
          <PdfSectionBanner>Acciones Tomadas</PdfSectionBanner>
          <View style={{ marginTop: 4 }}>
            <Text style={{ fontSize: 6.5, color: PC.textSub, fontStyle: 'italic', marginBottom: 3 }}>
              En caso de encontrar alguna incidencia inusual, especificar la ACCION CORRECTIVA tomada.
            </Text>
            <View style={{ borderWidth: 1, borderColor: PC.border }}>
              {/* Header */}
              <View style={{ flexDirection: 'row', backgroundColor: PC.section }}>
                <View style={{ width: 40, padding: 4, borderRightWidth: 1, borderRightColor: '#5599CC' }}>
                  <Text style={{ fontSize: 7, fontFamily: 'Helvetica-Bold', color: PC.white }}>Dia</Text>
                </View>
                <View style={{ flex: 1, padding: 4 }}>
                  <Text style={{ fontSize: 7, fontFamily: 'Helvetica-Bold', color: PC.white }}>Accion tomada</Text>
                </View>
              </View>
              {acciones.map((a, i) => (
                <View key={i} style={{ flexDirection: 'row', backgroundColor: i % 2 === 0 ? PC.white : '#F5F9FE' }}>
                  <View style={{ width: 40, padding: 4, borderRightWidth: 1, borderRightColor: PC.border, borderBottomWidth: 1, borderBottomColor: PC.border }}>
                    <Text style={{ fontSize: 7, color: PC.fieldValue }}>{a.dia}</Text>
                  </View>
                  <View style={{ flex: 1, padding: 4, borderBottomWidth: 1, borderBottomColor: PC.border }}>
                    <Text style={{ fontSize: 7, color: PC.fieldValue }}>{a.texto}</Text>
                  </View>
                </View>
              ))}
            </View>
          </View>
        </>
      )}

      {observaciones && (
        <PdfFieldGrid>
          <PdfFieldRow>
            <PdfField label="Observaciones" value={observaciones} />
          </PdfFieldRow>
        </PdfFieldGrid>
      )}

      <PdfSignatures
        signatures={[
          { label: '', nombre: realizoNombre ?? '', caption: 'Nombre y firma de quien realiza', firma: firmaRealizo ?? null },
          { label: '', nombre: '', caption: 'Nombre y firma de quien verifica', firma: firmaVerifico ?? null },
        ]}
      />
    </Page>
  )
}

export function InspeccionAlmacenEmpaqueGGPDF(props: InspeccionAlmacenEmpaqueGGPaginaProps) {
  return (
    <Document>
      <InspeccionAlmacenEmpaqueGGPagina {...props} />
    </Document>
  )
}

export function InspeccionAlmacenEmpaqueGGConsolidadoPDF({
  paginas,
}: {
  paginas: InspeccionAlmacenEmpaqueGGPaginaProps[]
}) {
  return (
    <Document>
      {paginas.map((p, i) => <InspeccionAlmacenEmpaqueGGPagina key={i} {...p} />)}
    </Document>
  )
}
