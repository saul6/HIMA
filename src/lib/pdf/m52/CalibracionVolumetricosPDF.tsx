import { Document } from '@react-pdf/renderer'
import { PaginaEstandar, Seccion } from '@/lib/pdf/disenoNuevo/PaginaEstandar'
import { TablaDatos, type ColumnaDato } from '@/lib/pdf/disenoNuevo/TablaDatos'
import { PdfFirmas } from '@/lib/pdf/disenoNuevo/PdfFirmas'
import { codigoFormato } from '@/lib/codigoFormato'
import type { FirmaParaPdf } from '@/hooks/useFirmasRegistro'
import { fechaPdf } from '@/lib/pdf/disenoNuevo/fechas'

export interface VolumetricoRow {
  fecha: string
  uso_articulo: string
  capacidad: number | null
  unidad: string
  lectura1_ml: number | null
  lectura2_ml: number | null
  lectura3_ml: number | null
  desviacion: number | null
  realizo: string
  observaciones: string | null
}

interface Props {
  rancho: string
  orgNombre?: string | null
  desde: string
  hasta: string
  registros: VolumetricoRow[]
  codigoClave: string
  terminoSitio?: string
  firmaRealizo?: FirmaParaPdf | null
  firmaVerifico?: FirmaParaPdf | null
}

function fmtFecha(iso: string): string {
  return fechaPdf(iso)
}

function fmtNum(n: number | null, dec = 2): string {
  if (n === null || n === undefined) return '—'
  return Number(n).toFixed(dec)
}

// Anchos relativos de columna (la tabla se escala al ancho útil de la hoja)
const COLS: ColumnaDato[] = [
  { texto: 'Fecha', ancho: 55, align: 'left' },
  { texto: 'Uso / Artículo', ancho: 110, align: 'left' },
  { texto: 'Capacidad', ancho: 65, align: 'center' },
  { texto: 'Unidad', ancho: 60, align: 'left' },
  { texto: 'Lectura 1 (ml)', ancho: 62, align: 'center' },
  { texto: 'Lectura 2 (ml)', ancho: 62, align: 'center' },
  { texto: 'Lectura 3 (ml)', ancho: 62, align: 'center' },
  { texto: 'Desviación', ancho: 62, align: 'center' },
  { texto: 'Realizó', ancho: 70, align: 'left' },
  { texto: 'Observaciones', ancho: 90, align: 'left' },
]

export function CalibracionVolumetricosPDF({
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
  const codigoFmt = codigoFormato('REG-06', codigoClave)

  return (
    <Document>
      <PaginaEstandar
        titulo="CALIBRACIÓN DE VOLUMÉTRICOS"
        subtitulo={`Calibración de volumétricos | ${rancho}`}
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
              fmtFecha(r.fecha), r.uso_articulo, fmtNum(r.capacidad, 2), r.unidad, fmtNum(r.lectura1_ml, 1), fmtNum(r.lectura2_ml, 1), fmtNum(r.lectura3_ml, 1), fmtNum(r.desviacion, 2), r.realizo || '—', r.observaciones ?? '',
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
