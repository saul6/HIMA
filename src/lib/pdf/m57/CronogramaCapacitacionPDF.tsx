import { Document } from '@react-pdf/renderer'
import { PaginaEstandar, Seccion } from '@/lib/pdf/disenoNuevo/PaginaEstandar'
import { TablaDatos, ANCHO_UTIL, type ColumnaDato } from '@/lib/pdf/disenoNuevo/TablaDatos'

export interface M57RowPDF {
  cargo: string
  tematica: string
  periodicidad: string
  mes_programado: string
  observaciones: string | null
}

export interface CronogramaCapacitacionPDFProps {
  orgNombre: string
  registros: M57RowPDF[]
}

function fechaHoy(): string {
  return new Date().toLocaleDateString('es-MX', {
    day: '2-digit', month: '2-digit', year: 'numeric',
    timeZone: 'America/Mexico_City',
  })
}

// Anchos relativos de columna (la tabla se escala al ancho útil de la hoja)
const COLS: ColumnaDato[] = [
  { texto: 'Cargo', ancho: 2 },
  { texto: 'Temática', ancho: 3 },
  { texto: 'Periodicidad', ancho: 1.5 },
  { texto: 'Mes Programado', ancho: 1.5 },
  { texto: 'Observaciones', ancho: 2 },
]

export function CronogramaCapacitacionPDF({ orgNombre, registros }: CronogramaCapacitacionPDFProps) {
  return (
    <Document>
      <PaginaEstandar
        orientacion="portrait"
        titulo="CRONOGRAMA DE CAPACITACIONES"
        subtitulo={orgNombre}
        codigoFmt="M57"
        folio={'Vigente'}
        emision={fechaHoy()}
        etiquetaEmision="Fecha"
        camposDatos={[]}
      >
        <Seccion titulo="REGISTRO DE CRONOGRAMA DE CAPACITACIONES">
          <TablaDatos
            columnas={COLS}
            anchoTotal={ANCHO_UTIL.portrait}
            fuente={7}
            vacio="Sin registros"
            filas={registros.map((row) => [
              row.cargo, row.tematica, row.periodicidad, row.mes_programado, row.observaciones ?? '',
            ])}
          />
        </Seccion>
      </PaginaEstandar>
    </Document>
  )
}
