import { Document } from '@react-pdf/renderer'
import { PaginaEstandar, Seccion } from '@/lib/pdf/disenoNuevo/PaginaEstandar'
import { TablaDatos, type ColumnaDato } from '@/lib/pdf/disenoNuevo/TablaDatos'
import { PdfFirmas } from '@/lib/pdf/disenoNuevo/PdfFirmas'
import type { FirmaParaPdf } from '@/hooks/useFirmasRegistro'

export interface ConsumoEnergiaRow {
  mes: string
  tipo_combustible: string | null
  cantidad_litros: number | null
  costo_combustible: number | null
  actividad: string | null
  luz_costo: number | null
  luz_kwh: number | null
  realizo: string | null
  observaciones: string | null
}

interface Props {
  rancho: string
  orgNombre?: string | null
  desde: string
  hasta: string
  registros: ConsumoEnergiaRow[]
  terminoSitio?: string
  firmaRealizo?: FirmaParaPdf | null
  firmaVerifico?: FirmaParaPdf | null
}

function fmtFecha(iso: string): string {
  try {
    const [y, m, d] = iso.split('-')
    if (!d) {
      return new Date(iso + '-01T12:00:00').toLocaleDateString('es-MX', { month: 'long', year: 'numeric' })
        .replace(/^\w/, c => c.toUpperCase())
    }
    return `${d}/${m}/${y}`
  } catch { return iso }
}

function fmtMes(iso: string): string {
  try {
    return new Date(iso + 'T12:00:00').toLocaleDateString('es-MX', { month: 'long', year: 'numeric' })
      .replace(/^\w/, c => c.toUpperCase())
  } catch { return iso }
}

// Anchos relativos de columna (la tabla se escala al ancho útil de la hoja)
const COLS: ColumnaDato[] = [
  { texto: 'Mes', ancho: 65 },
  { texto: 'Tipo combustible', ancho: 75 },
  { texto: 'Litros', ancho: 45, align: 'center' },
  { texto: 'Costo combust.', ancho: 55, align: 'center' },
  { texto: 'Actividad', ancho: 150 },
  { texto: 'Costo luz', ancho: 50, align: 'center' },
  { texto: 'kWh', ancho: 45, align: 'center' },
  { texto: 'Realizó', ancho: 90 },
  { texto: 'Observaciones', ancho: 220 },
]

export function ConsumoEnergiaPDF({ rancho, orgNombre, desde, hasta, registros, terminoSitio = 'Instalación', firmaRealizo, firmaVerifico }: Props) {
  const periodo = desde === hasta ? fmtMes(desde) : `${fmtFecha(desde)} - ${fmtFecha(hasta)}`

  return (
    <Document>
      <PaginaEstandar
        titulo="CONSUMO DE COMBUSTIBLE Y ENERGÍA"
        subtitulo={`Registro de energia | ${rancho}`}
        codigoFmt="M60"
        folio={periodo}
        emision={periodo}
        etiquetaEmision="Periodo"
        tituloDatos="1. DATOS DEL SITIO"
        camposDatos={[
          { icono: 'ubicacion', etiqueta: terminoSitio, valor: rancho },
          ...(orgNombre ? [{ icono: 'usuario' as const, etiqueta: 'Organización', valor: orgNombre }] : []),
          { icono: 'calendario', etiqueta: 'Periodo', valor: periodo },
        ]}
      >
        <Seccion titulo="2. REGISTROS DE CONSUMO">
          <TablaDatos
            columnas={COLS}
            fuente={7}
            filas={registros.map((r) => [
              fmtMes(r.mes), r.tipo_combustible ?? '—', r.cantidad_litros != null ? String(r.cantidad_litros) : '—', r.costo_combustible != null ? `$${r.costo_combustible}` : '—', r.actividad ?? '—', r.luz_costo != null ? `$${r.luz_costo}` : '—', r.luz_kwh != null ? String(r.luz_kwh) : '—', r.realizo ?? '—', r.observaciones ?? '—',
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
