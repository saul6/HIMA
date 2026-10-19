import { Document, Text } from '@react-pdf/renderer'
import { PaginaMatrizMensual } from '@/lib/pdf/disenoNuevo/PaginaMatrizMensual'
import { Seccion } from '@/lib/pdf/disenoNuevo/PaginaEstandar'
import { TablaDatos, type ColumnaDato } from '@/lib/pdf/disenoNuevo/TablaDatos'
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

// Acciones tomadas: día y texto (anchos relativos)
const COLS_ACCIONES: ColumnaDato[] = [
  { texto: 'Dia', ancho: 40 },
  { texto: 'Acción tomada', ancho: 700 },
]

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
    seccion_label: 'Inspección de Almacén de Empaque',
    item: `${it.numero}. ${it.texto}`,
  }))

  return (
    <PaginaMatrizMensual
      titulo="INSPECCIÓN DE ALMACÉN DE MATERIAL DE EMPAQUE Y/O EMBALAJE"
      subtitulo={`REG-22 · GlobalG.A.P. v6 | ${rancho}`}
      codigoFmt="REG-22"
      folio={mesLabel}
      emision={mesLabel}
      etiquetaEmision="Fecha"
      itemColW={220}
      campos={[
        ...(orgNombre ? [{ icono: 'usuario' as const, etiqueta: 'Compañía', valor: orgNombre }] : []),
        { icono: 'ubicacion', etiqueta: 'Rancho', valor: rancho },
        ...(cultivo ? [{ etiqueta: 'Cultivo', valor: cultivo }] : []),
        { icono: 'calendario', etiqueta: 'Mes y Año', valor: mesLabel },
      ]}
      notaAntes="Si = cumple, No = no cumple, N/A = no aplica."
      items={matrixItems}
      mesDate={mes}
      diasInspeccionados={inspeccionados}
      matriz={matrizISO}
      defaultVal="N/A"
      notas={observaciones ? [{ etiqueta: 'Observaciones', valor: observaciones }] : []}
      extra={
        acciones.length > 0 ? (
          <Seccion titulo="ACCIONES TOMADAS">
            <Text style={{ fontSize: 6.5, color: PC.textSub, fontFamily: 'Helvetica-Oblique', marginBottom: 3 }}>
              En caso de encontrar alguna incidencia inusual, especificar la ACCIÓN CORRECTIVA tomada.
            </Text>
            <TablaDatos
              columnas={COLS_ACCIONES}
              fuente={7}
              filas={acciones.map((a) => [String(a.dia), a.texto])}
            />
          </Seccion>
        ) : undefined
      }
      firmas={[
        { label: '', nombre: realizoNombre ?? '', caption: 'Nombre y firma de quien realiza', firma: firmaRealizo ?? null },
        { label: '', nombre: '', caption: 'Nombre y firma de quien verifica', firma: firmaVerifico ?? null },
      ]}
    />
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
