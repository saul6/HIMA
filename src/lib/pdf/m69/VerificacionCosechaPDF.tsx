import { Document } from '@react-pdf/renderer'
import { PaginaMatrizMensual } from '@/lib/pdf/disenoNuevo/PaginaMatrizMensual'
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

export function VerificacionCosechaPagina({
  rancho, orgNombre, mes, mesLabel, codigo, cultivo, realizoNombre, observaciones,
  items, diasConResultados, matriz,
  firmaRealizo, firmaVerifico,
}: VerificacionCosechaPaginaProps) {
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
      titulo="VERIFICACIÓN DIARIA DE COSECHA"
      subtitulo={`REG-13 · GlobalG.A.P. v6 | ${rancho}`}
      codigoFmt="REG-13"
      folio={mesLabel}
      emision={mesLabel}
      etiquetaEmision="Fecha"
      itemColW={200}
      campos={[
        ...(orgNombre ? [{ icono: 'usuario' as const, etiqueta: 'Compañía', valor: orgNombre }] : []),
        { icono: 'ubicacion', etiqueta: 'Rancho', valor: rancho },
        ...(codigo ? [{ icono: 'codigo' as const, etiqueta: 'Código', valor: codigo }] : []),
        ...(cultivo ? [{ etiqueta: 'Cultivo', valor: cultivo }] : []),
        { icono: 'calendario', etiqueta: 'Mes y Año', valor: mesLabel },
      ]}
      notaAntes="Responde SI si cumple, NO si NO cumple o N/A si no aplica."
      notaDespues="* Colocar (Si) si cumple, (X) si no cumple, (N/A) si no aplica."
      items={matrixItems}
      mesDate={mes}
      diasInspeccionados={inspeccionados}
      matriz={matrizISO}
      defaultVal="N/A"
      notas={observaciones ? [{ etiqueta: 'Observaciones', valor: observaciones }] : []}
      firmas={[
        { label: '', nombre: realizoNombre ?? '', caption: 'Realizado por', firma: firmaRealizo ?? null },
        { label: '', nombre: '', caption: 'Responsable de la Verificación', firma: firmaVerifico ?? null },
      ]}
    />
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
