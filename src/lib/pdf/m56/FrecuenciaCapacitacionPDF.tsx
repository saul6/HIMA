import { Document } from '@react-pdf/renderer'
import { PaginaEstandar } from '@/lib/pdf/disenoNuevo/PaginaEstandar'
import { TablaDatos, ANCHO_UTIL, type ColumnaDato } from '@/lib/pdf/disenoNuevo/TablaDatos'
import { PC } from '@/lib/pdf/components/tokens'

export interface M56RowPDF {
  tema: string
  anio: number
  mes: number
  capacitador: string | null
  realizado: boolean
  observaciones: string | null
}

export interface FrecuenciaCapacitacionPDFProps {
  orgNombre: string
  registros: M56RowPDF[]
  anioFiltro?: number | null
}

const MESES = ['Enero','Febrero','Marzo','Abril','Mayo','Junio','Julio','Agosto','Septiembre','Octubre','Noviembre','Diciembre']

function fechaHoy(): string {
  return new Date().toLocaleDateString('es-MX', {
    day: '2-digit', month: '2-digit', year: 'numeric',
    timeZone: 'America/Mexico_City',
  })
}

// Anchos relativos de columna (la tabla se escala al ancho útil de la hoja)
const COLS: ColumnaDato[] = [
  { texto: 'Tema', ancho: 3 },
  { texto: 'Ano', ancho: 1 },
  { texto: 'Mes', ancho: 1.5 },
  { texto: 'Capacitador', ancho: 2 },
  { texto: 'Realizado', ancho: 1, align: 'center' },
  { texto: 'Observaciones', ancho: 2 },
]

export function FrecuenciaCapacitacionPDF({ orgNombre, registros, anioFiltro }: FrecuenciaCapacitacionPDFProps) {
  return (
    <Document>
      <PaginaEstandar
        orientacion="portrait"
        titulo="FRECUENCIA DE CAPACITACIÓN"
        subtitulo={orgNombre}
        codigoFmt="M56"
        folio={anioFiltro ? String(anioFiltro) : 'Todos'}
        emision={fechaHoy()}
        etiquetaEmision="Fecha"
        camposDatos={[]}
      >
        <TablaDatos
          columnas={COLS}
          anchoTotal={ANCHO_UTIL.portrait}
          fuente={7}
          vacio="Sin registros"
          filas={registros.map((row) => [
            row.tema, String(row.anio), MESES[(row.mes - 1)] ?? String(row.mes), row.capacitador ?? '—', row.realizado ? { texto: 'Si', color: PC.m13Navy, negrita: true } : 'No', row.observaciones ?? '',
          ])}
        />
      </PaginaEstandar>
    </Document>
  )
}
