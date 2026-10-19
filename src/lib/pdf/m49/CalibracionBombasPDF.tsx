import { Document } from '@react-pdf/renderer'
import { PaginaEstandar, Seccion } from '@/lib/pdf/disenoNuevo/PaginaEstandar'
import { TablaDatos, type ColumnaDato } from '@/lib/pdf/disenoNuevo/TablaDatos'
import { PdfFirmas } from '@/lib/pdf/disenoNuevo/PdfFirmas'
import { codigoFormato } from '@/lib/codigoFormato'
import type { FirmaParaPdf } from '@/hooks/useFirmasRegistro'

export interface BombaRow {
  fecha: string
  equipo: string
  num_equipo: string
  cultivo: string
  parcela: string
  distancia_m: number | null
  velocidad_kmh: number | null
  presion_bar: number | null
  volumen_recolectado_ml: number | null
  gasto_l: number | null
  resultado: string | null
  realizo: string
  observaciones: string | null
}

interface Props {
  rancho: string
  orgNombre?: string | null
  desde: string
  hasta: string
  registros: BombaRow[]
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
  { texto: 'Fecha', ancho: 52, align: 'left' },
  { texto: 'Equipo', ancho: 72, align: 'left' },
  { texto: 'N° Equipo', ancho: 58, align: 'left' },
  { texto: 'Cultivo', ancho: 65, align: 'left' },
  { texto: 'Parcela', ancho: 65, align: 'left' },
  { texto: 'Dist. (m)', ancho: 52, align: 'center' },
  { texto: 'Vel. km/h', ancho: 52, align: 'center' },
  { texto: 'Pres. bar', ancho: 52, align: 'center' },
  { texto: 'Vol. ml', ancho: 58, align: 'center' },
  { texto: 'Gasto L', ancho: 52, align: 'center' },
  { texto: 'Resultado', ancho: 72, align: 'left' },
  { texto: 'Realizó', ancho: 70, align: 'left' },
  { texto: 'Observaciones', ancho: 90, align: 'left' },
]

export function CalibracionBombasPDF({
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
  const codigoFmt = codigoFormato('REG-07', codigoClave)

  return (
    <Document>
      <PaginaEstandar
        titulo="CALIBRACIÓN DE BOMBAS DE APLICACIÓN"
        subtitulo={`Calibración de bombas | ${rancho}`}
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
            fuente={6.5}
            filas={registros.map((r) => [
              fmtFecha(r.fecha), r.equipo, r.num_equipo, r.cultivo, r.parcela, fmtNum(r.distancia_m, 1), fmtNum(r.velocidad_kmh, 1), fmtNum(r.presion_bar, 2), fmtNum(r.volumen_recolectado_ml, 1), fmtNum(r.gasto_l, 2), r.resultado ?? '—', r.realizo || '—', r.observaciones ?? '',
            ])}
          />
        </Seccion>

        <PdfFirmas
          signatures={[
            { label: '', nombre: '', caption: 'Realizó', firma: firmaRealizo ?? null },
            { label: '', nombre: '', caption: 'Verifico: Responsable técnico', firma: firmaVerifico ?? null },
          ]}
        />
      </PaginaEstandar>
    </Document>
  )
}
