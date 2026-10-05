import { Document, Page, View, Text } from '@react-pdf/renderer'
import { TopBar, PdfFooter } from '@/lib/pdf/components/PdfPage'
import { PdfHeader } from '@/lib/pdf/components/PdfHeader'
import { PdfSectionBanner } from '@/lib/pdf/components/PdfSectionBanner'
import { PdfFieldGrid, PdfFieldRow, PdfField } from '@/lib/pdf/components/PdfFieldGrid'
import { PdfMonthlyMatrix } from '@/lib/pdf/components/PdfMonthlyMatrix'
import { PdfSignatures } from '@/lib/pdf/components/PdfSignatures'
import { PC } from '@/lib/pdf/components/tokens'
import type { FirmaParaPdf } from '@/hooks/useFirmasRegistro'

export interface M69ItemPDF {
  id: string
  seccion: string
  numero: number
  texto: string
}

export interface VerificacionCosechaPaginaProps {
  rancho: string
  orgNombre?: string | null
  mes: string    // '2026-06-01'
  mesLabel: string
  codigo: string | null
  cultivo: string | null
  realizoNombre: string | null
  observaciones: string | null
  items: M69ItemPDF[]
  diasConResultados: Set<number>
  matriz: Record<number, Record<string, string>>  // dia → item_id → valor
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

export function VerificacionCosechaPagina({
  rancho, orgNombre, mes, mesLabel, codigo, cultivo, realizoNombre, observaciones,
  items, diasConResultados, matriz,
  firmaRealizo, firmaVerifico,
}: VerificacionCosechaPaginaProps) {
  const totalDias = diasDelMes(mes)
  const todosLosDias = Array.from({ length: totalDias }, (_, i) => diaToISO(mes, i + 1))
  const inspeccionadosSet = new Set(
    Array.from(diasConResultados).map(d => diaToISO(mes, d))
  )
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
      <PdfFooter moduloCodigo="REG-13" />
      <TopBar />
      <PdfHeader
        titulo="VERIFICACION DIARIA DE COSECHA"
        subtitulo={`REG-13 · GlobalG.A.P. v6 | ${rancho}`}
        codigoFormato="REG-13"
        folio={mesLabel}
        fecha={mesLabel}
      />

      <PdfSectionBanner>Datos generales</PdfSectionBanner>
      <PdfFieldGrid>
        <PdfFieldRow>
          {orgNombre && <PdfField label="Compania" value={orgNombre} />}
          <PdfField label="Rancho" value={rancho} />
          {codigo && <PdfField label="Codigo" value={codigo} />}
          {cultivo && <PdfField label="Cultivo" value={cultivo} />}
          <PdfField label="Mes y Año" value={mesLabel} />
        </PdfFieldRow>
      </PdfFieldGrid>

      <View style={{ marginBottom: 3 }}>
        <Text style={{ fontSize: 6.5, color: PC.textSub, fontStyle: 'italic' }}>
          Responde SI si cumple, NO si NO cumple o N/A si no aplica.
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

      <View style={{ marginTop: 4 }}>
        <Text style={{ fontSize: 6, color: PC.textSub, fontStyle: 'italic' }}>
          * Colocar (Si) si cumple, (X) si no cumple, (N/A) si no aplica.
        </Text>
      </View>

      <PdfSignatures
        signatures={[
          { label: '', nombre: realizoNombre ?? '', caption: 'Realizado por', firma: firmaRealizo ?? null },
          { label: '', nombre: '', caption: 'Responsable de la Verificacion', firma: firmaVerifico ?? null },
        ]}
      />
    </Page>
  )
}

export function VerificacionCosechaPDF(props: VerificacionCosechaPaginaProps) {
  return (
    <Document>
      <VerificacionCosechaPagina {...props} />
    </Document>
  )
}

export function VerificacionCosechaConsolidadoPDF({ paginas }: { paginas: VerificacionCosechaPaginaProps[] }) {
  return (
    <Document>
      {paginas.map((p, i) => <VerificacionCosechaPagina key={i} {...p} />)}
    </Document>
  )
}
