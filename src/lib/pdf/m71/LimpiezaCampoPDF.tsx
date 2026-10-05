import { Document, Page, View, Text } from '@react-pdf/renderer'
import { TopBar, PdfFooter } from '@/lib/pdf/components/PdfPage'
import { PdfHeader } from '@/lib/pdf/components/PdfHeader'
import { PdfSectionBanner } from '@/lib/pdf/components/PdfSectionBanner'
import { PdfFieldGrid, PdfFieldRow, PdfField } from '@/lib/pdf/components/PdfFieldGrid'
import { PdfMonthlyMatrix } from '@/lib/pdf/components/PdfMonthlyMatrix'
import { PdfSignatures } from '@/lib/pdf/components/PdfSignatures'
import { PC } from '@/lib/pdf/components/tokens'
import type { FirmaParaPdf } from '@/hooks/useFirmasRegistro'

export interface M71ItemPDF {
  id: string
  seccion: string
  numero: number
  texto: string
}

export interface LimpiezaCampoPaginaProps {
  rancho: string
  orgNombre?: string | null
  mes: string
  mesLabel: string
  realizoNombre: string | null
  observaciones: string | null
  items: M71ItemPDF[]
  diasConResultados: Set<number>
  matriz: Record<number, Record<string, string>>
  firmaRealizo?: FirmaParaPdf | null
  firmaVerifico?: FirmaParaPdf | null
}

const MARGIN = 20
const PAGE_W = 841.89 - MARGIN * 2
const ITEM_COL_W = 200

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

export function LimpiezaCampoPagina({
  rancho, orgNombre, mes, mesLabel, realizoNombre, observaciones,
  items, diasConResultados, matriz,
  firmaRealizo, firmaVerifico,
}: LimpiezaCampoPaginaProps) {
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

  const matrixItems = items.map(it => ({
    id: it.id,
    seccion_label: it.seccion,
    item: `${it.numero}. ${it.texto}`,
  }))

  return (
    <Page
      size="A4"
      orientation="landscape"
      style={{ fontFamily: 'Helvetica', fontSize: 8, padding: MARGIN, paddingBottom: 50, backgroundColor: PC.white }}
    >
      <PdfFooter moduloCodigo="REG-10" />
      <TopBar />
      <PdfHeader
        titulo="LIMPIEZA Y DESINFECCION EN GENERAL / DERRAMES EN CAMPO"
        subtitulo={`REG-10 · GlobalG.A.P. v6 | ${rancho}`}
        codigoFormato="REG-10"
        folio={mesLabel}
        fecha={mesLabel}
      />

      <PdfSectionBanner>Datos generales</PdfSectionBanner>
      <PdfFieldGrid>
        <PdfFieldRow>
          {orgNombre && <PdfField label="Compania" value={orgNombre} />}
          <PdfField label="Rancho" value={rancho} />
          <PdfField label="Mes y Año" value={mesLabel} />
          {realizoNombre && <PdfField label="Realizo" value={realizoNombre} />}
        </PdfFieldRow>
      </PdfFieldGrid>

      <View style={{ marginBottom: 3 }}>
        <Text style={{ fontSize: 6.5, color: PC.textSub, fontStyle: 'italic' }}>
          Colocar (Si) si se realiza la accion indicada, (X) si no se realiza y N/A si no aplica.
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

      {observaciones && (
        <PdfFieldGrid>
          <PdfFieldRow>
            <PdfField label="Observaciones" value={observaciones} />
          </PdfFieldRow>
        </PdfFieldGrid>
      )}

      <PdfSignatures
        signatures={[
          { label: '', nombre: realizoNombre ?? '', caption: 'Nombre y Firma de quien verifica', firma: firmaRealizo ?? null },
          { label: '', nombre: '', caption: 'Nombre y Firma de quien autoriza', firma: firmaVerifico ?? null },
        ]}
      />
    </Page>
  )
}

export function LimpiezaCampoPDF(props: LimpiezaCampoPaginaProps) {
  return (
    <Document>
      <LimpiezaCampoPagina {...props} />
    </Document>
  )
}

export function LimpiezaCampoConsolidadoPDF({ paginas }: { paginas: LimpiezaCampoPaginaProps[] }) {
  return (
    <Document>
      {paginas.map((p, i) => <LimpiezaCampoPagina key={i} {...p} />)}
    </Document>
  )
}
