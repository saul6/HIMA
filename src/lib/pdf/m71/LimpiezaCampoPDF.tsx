import { Document } from '@react-pdf/renderer'
import { PaginaMatrizMensual } from '@/lib/pdf/disenoNuevo/PaginaMatrizMensual'
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
  if (val === 'si' || val === 'SI') return 'Sí'
  if (val === 'no' || val === 'NO') return 'No'
  return 'N/A'
}

export function LimpiezaCampoPagina({
  rancho, orgNombre, mes, mesLabel, realizoNombre, observaciones,
  items, diasConResultados, matriz,
  firmaRealizo, firmaVerifico,
}: LimpiezaCampoPaginaProps) {
  const inspeccionados = Array.from(diasConResultados).map(d => diaToISO(mes, d))

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
    <PaginaMatrizMensual
      titulo="LIMPIEZA Y DESINFECCIÓN EN GENERAL / DERRAMES EN CAMPO"
      subtitulo={`REG-10 · GlobalG.A.P. v6 | ${rancho}`}
      codigoFmt="REG-10"
      folio={mesLabel}
      emision={mesLabel}
      etiquetaEmision="Fecha"
      itemColW={200}
      campos={[
        ...(orgNombre ? [{ icono: 'usuario' as const, etiqueta: 'Compañía', valor: orgNombre }] : []),
        { icono: 'ubicacion', etiqueta: 'Rancho', valor: rancho },
        { icono: 'calendario', etiqueta: 'Mes y Año', valor: mesLabel },
        ...(realizoNombre ? [{ icono: 'usuario' as const, etiqueta: 'Realizó', valor: realizoNombre }] : []),
      ]}
      notaAntes="Colocar (Si) si se realiza la acción indicada, (X) si no se realiza y N/A si no aplica."
      items={matrixItems}
      mesDate={mes}
      diasInspeccionados={inspeccionados}
      matriz={matrizISO}
      defaultVal="N/A"
      notas={observaciones ? [{ etiqueta: 'Observaciones', valor: observaciones }] : []}
      firmas={[
        { label: '', nombre: realizoNombre ?? '', caption: 'Nombre y Firma de quien verifica', firma: firmaRealizo ?? null },
        { label: '', nombre: '', caption: 'Nombre y Firma de quien autoriza', firma: firmaVerifico ?? null },
      ]}
    />
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
