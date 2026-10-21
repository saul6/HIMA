import { Document } from '@react-pdf/renderer'
import { PaginaEstandar, Seccion } from '@/lib/pdf/disenoNuevo/PaginaEstandar'
import { TablaDatos, type ColumnaDato } from '@/lib/pdf/disenoNuevo/TablaDatos'
import { PdfFirmas } from '@/lib/pdf/disenoNuevo/PdfFirmas'
import type { FirmaParaPdf } from '@/hooks/useFirmasRegistro'
import { fechaPdf } from '@/lib/pdf/disenoNuevo/fechas'

export interface FertilizacionGGRow {
  fecha: string
  cultivo: string
  bloque: string | null
  superficie_ha: number | null
  producto: string
  fabricante: string | null
  formula: string | null
  cantidad_total: number | null
  unidad: string | null
  cantidad_ha: string | null
  maquinaria: string | null
  metodo_aplicacion: string | null
  operario: string | null
  observaciones: string | null
}

interface Props {
  rancho: string
  orgNombre?: string | null
  desde: string
  hasta: string
  registros: FertilizacionGGRow[]
  terminoSitio?: string
  firmaRealizo?: FirmaParaPdf | null
  firmaVerifico?: FirmaParaPdf | null
}

function fmtFecha(iso: string): string {
  return fechaPdf(iso)
}

// Anchos relativos de columna (la tabla se escala al ancho útil de la hoja)
const COLS = (terminoSitio: string): ColumnaDato[] => [
  { texto: 'Fecha', ancho: 48 },
  { texto: 'Cultivo', ancho: 58 },
  { texto: 'Bloque/Sector', ancho: 56 },
  { texto: 'Ha', ancho: 30 },
  { texto: 'Nombre comercial', ancho: 85 },
  { texto: 'Fabricante', ancho: 63 },
  { texto: 'Formula fertilizante', ancho: 64 },
  { texto: 'Cant. total', ancho: 44 },
  { texto: 'Unidades', ancho: 44 },
  { texto: 'Cant/ha', ancho: 56 },
  { texto: 'Maquinaria', ancho: 56 },
  { texto: 'Método aplicación', ancho: 71 },
  { texto: 'Operario', ancho: 56 },
  { texto: 'Observaciones', ancho: 61 },
]

export function FertilizacionGGPDF({ registros, rancho, orgNombre, desde, hasta, terminoSitio = 'Rancho', firmaRealizo, firmaVerifico }: Props) {
  const periodo = desde === hasta ? fmtFecha(desde) : `${fmtFecha(desde)} - ${fmtFecha(hasta)}`
  

  return (
    <Document>
      <PaginaEstandar
        titulo="APLICACIÓN DE FERTILIZANTES"
        subtitulo={`REG-18 · GlobalG.A.P. v6 | ${rancho}`}
        codigoFmt={"REG-18"}
        folio={periodo}
        emision={periodo}
        etiquetaEmision="Periodo"
        tituloDatos="1. DATOS DEL SITIO"
        camposDatos={[
          { icono: 'usuario', etiqueta: 'Compañía', valor: orgNombre ?? '—' },
          { icono: 'ubicacion', etiqueta: terminoSitio, valor: rancho },
          { icono: 'calendario', etiqueta: 'Periodo', valor: periodo },
        ]}
      >
        <Seccion titulo="2. REGISTROS DE APLICACIÓN DE FERTILIZANTES">
          <TablaDatos
            columnas={COLS(terminoSitio)}
            fuente={6.5}
            filas={registros.map((r) => [
              fmtFecha(r.fecha), r.cultivo, r.bloque ?? '—', r.superficie_ha != null ? String(r.superficie_ha) : '—', r.producto, r.fabricante ?? '—', r.formula ?? '—', r.cantidad_total != null ? String(r.cantidad_total) : '—', r.unidad ?? '—', r.cantidad_ha ?? '—', r.maquinaria ?? '—', r.metodo_aplicacion ?? '—', r.operario ?? '—', r.observaciones ?? '—',
            ])}
          />
        </Seccion>

        <PdfFirmas
          signatures={[
            { label: '', nombre: '', caption: 'Realizó', firma: firmaRealizo ?? null },
            { label: '', nombre: '', caption: 'Responsable de Inocuidad', firma: firmaVerifico ?? null },
          ]}
        />
      </PaginaEstandar>
    </Document>
  )
}
