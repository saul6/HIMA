import { Document } from '@react-pdf/renderer'
import { PaginaEstandar, Seccion } from '@/lib/pdf/disenoNuevo/PaginaEstandar'
import { TablaDatos, type ColumnaDato } from '@/lib/pdf/disenoNuevo/TablaDatos'
import { PdfFirmas } from '@/lib/pdf/disenoNuevo/PdfFirmas'
import { codigoFormato } from '@/lib/codigoFormato'
import type { FirmaParaPdf } from '@/hooks/useFirmasRegistro'

export interface EquipoRow {
  fecha: string
  num_equipo: string
  velocidad_kmh: number | null
  presion_trabajo_bar: number | null
  boquilla: string
  gasto_boquilla_ml: number | null
  resultado: string | null
  realizo: string
  observaciones: string | null
}

interface Props {
  rancho: string
  orgNombre?: string | null
  desde: string
  hasta: string
  registros: EquipoRow[]
  codigoClave: string
  terminoSitio?: string
  firmaRealizo?: FirmaParaPdf | null
  firmaVerifico?: FirmaParaPdf | null
}

function fmtFecha(iso: string): string {
  try {
    const [y, m, d] = iso.split('-')
    return `${d}/${m}/${y}`
  } catch { return iso }
}

function fmtNum(n: number | null, dec = 1): string {
  if (n === null || n === undefined) return '—'
  return Number(n).toFixed(dec)
}

// Anchos relativos de columna (la tabla se escala al ancho útil de la hoja)
const COLS: ColumnaDato[] = [
  { texto: 'Fecha', ancho: 55, align: 'left' },
  { texto: 'N° Equipo', ancho: 80, align: 'left' },
  { texto: 'Vel. (km/h)', ancho: 72, align: 'center' },
  { texto: 'Pres. trabajo (bar)', ancho: 72, align: 'center' },
  { texto: 'Boquilla', ancho: 100, align: 'left' },
  { texto: 'Gasto boquilla (ml)', ancho: 72, align: 'center' },
  { texto: 'Resultado', ancho: 95, align: 'left' },
  { texto: 'Realizó', ancho: 70, align: 'left' },
  { texto: 'Observaciones', ancho: 90, align: 'left' },
]

export function CalibracionEquiposPDF({
  rancho,
  orgNombre,
  desde,
  hasta,
  registros,
  codigoClave,
  terminoSitio = 'Sitio',
  firmaRealizo,
  firmaVerifico,
}: Props) {
  const periodo = desde === hasta ? fmtFecha(desde) : `${fmtFecha(desde)} - ${fmtFecha(hasta)}`
  const codigoFmt = codigoFormato('REG-ASIP-09', codigoClave)

  return (
    <Document>
      <PaginaEstandar
        titulo="CALIBRACIÓN DE EQUIPOS DE APLICACIÓN"
        subtitulo={`Calibración de equipos | ${rancho}`}
        codigoFmt={codigoFmt}
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
        <Seccion titulo="2. REGISTROS DE CALIBRACIÓN">
          <TablaDatos
            columnas={COLS}
            fuente={7}
            filas={registros.map((r) => [
              fmtFecha(r.fecha), r.num_equipo, fmtNum(r.velocidad_kmh, 1), fmtNum(r.presion_trabajo_bar, 2), r.boquilla, fmtNum(r.gasto_boquilla_ml, 1), r.resultado ?? '—', r.realizo || '—', r.observaciones ?? '',
            ])}
          />
        </Seccion>

        <PdfFirmas
          signatures={[
            { label: '', nombre: '', caption: 'Realizó', firma: firmaRealizo ?? null },
            { label: '', nombre: '', caption: 'Verificó: Responsable técnico', firma: firmaVerifico ?? null },
          ]}
        />
      </PaginaEstandar>
    </Document>
  )
}
