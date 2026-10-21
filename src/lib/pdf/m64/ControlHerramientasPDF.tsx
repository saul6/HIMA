import { Document } from '@react-pdf/renderer'
import { PaginaEstandar, Seccion } from '@/lib/pdf/disenoNuevo/PaginaEstandar'
import { TablaDatos, type ColumnaDato } from '@/lib/pdf/disenoNuevo/TablaDatos'
import { PdfFirmas } from '@/lib/pdf/disenoNuevo/PdfFirmas'
import { codigoFormato } from '@/lib/codigoFormato'
import type { FirmaParaPdf } from '@/hooks/useFirmasRegistro'
import { fechaPdf } from '@/lib/pdf/disenoNuevo/fechas'

export interface ControlHerramientasRow {
  fecha: string
  rancho: string
  trabajador: string
  herramienta: string
  cantidad: number
  entrega_nombre: string
  recibe_nombre: string
  devuelto: boolean
  fecha_devolucion: string | null
  realizo: string | null
  observaciones: string | null
}

interface Props {
  rows: ControlHerramientasRow[]
  orgNombre?: string | null
  desde: string
  hasta: string
  codigoClave: string
  terminoSitio?: string
  firmaRealizo?: FirmaParaPdf | null
  firmaVerifico?: FirmaParaPdf | null
}

function fmtFecha(iso: string): string {
  return fechaPdf(iso)
}

// Anchos relativos de columna (la tabla se escala al ancho útil de la hoja)
const COLS = (terminoSitio: string): ColumnaDato[] => [
  { texto: 'Fecha', ancho: 50 },
  { texto: terminoSitio, ancho: 65 },
  { texto: 'Trabajador', ancho: 75 },
  { texto: 'Herramienta', ancho: 85 },
  { texto: 'Cant.', ancho: 35, align: 'center' },
  { texto: 'Entrega', ancho: 75 },
  { texto: 'Recibe', ancho: 75 },
  { texto: 'Devuelto', ancho: 40, align: 'center' },
  { texto: 'F. devolución', ancho: 55 },
  { texto: 'Realizó', ancho: 65 },
  { texto: 'Observaciones', ancho: 80 },
]

export function ControlHerramientasPDF({ rows, orgNombre, desde, hasta, codigoClave, terminoSitio = 'Instalación', firmaRealizo, firmaVerifico }: Props) {
  const periodo = desde === hasta ? fmtFecha(desde) : `${fmtFecha(desde)} - ${fmtFecha(hasta)}`
  const codigoFmt = codigoFormato('M64-CTRL-HERR', codigoClave)

  return (
    <Document>
      <PaginaEstandar
        titulo="CONTROL DE HERRAMIENTAS"
        subtitulo={"Registro de entrega y devolución de herramientas"}
        codigoFmt={codigoFmt}
        folio={periodo}
        emision={periodo}
        etiquetaEmision="Periodo"
        tituloDatos="1. INFORMACIÓN GENERAL"
        camposDatos={[
          { icono: 'usuario', etiqueta: 'Organización', valor: orgNombre ?? '—' },
          { icono: 'calendario', etiqueta: 'Periodo', valor: periodo },
        ]}
      >
        <Seccion titulo="2. REGISTROS">
          <TablaDatos
            columnas={COLS(terminoSitio)}
            fuente={6.5}
            filas={rows.map((r) => [
              fmtFecha(r.fecha), r.rancho, r.trabajador, r.herramienta, String(r.cantidad), r.entrega_nombre, r.recibe_nombre, r.devuelto ? 'Si' : 'No', r.fecha_devolucion ? fmtFecha(r.fecha_devolucion) : '—', r.realizo ?? '—', r.observaciones ?? '',
            ])}
          />
        </Seccion>

        <PdfFirmas
          signatures={[
            { label: '', nombre: '', caption: 'Realizó', firma: firmaRealizo ?? null },
            { label: '', nombre: '', caption: 'Verificó: Responsable de Inocuidad', firma: firmaVerifico ?? null },
          ]}
        />
      </PaginaEstandar>
    </Document>
  )
}
