import { Document } from '@react-pdf/renderer'
import { PaginaEstandar, Seccion } from '@/lib/pdf/disenoNuevo/PaginaEstandar'
import { TablaDatos, type ColumnaDato } from '@/lib/pdf/disenoNuevo/TablaDatos'
import { PdfFirmas } from '@/lib/pdf/disenoNuevo/PdfFirmas'
import { codigoFormato } from '@/lib/codigoFormato'
import type { FirmaParaPdf } from '@/hooks/useFirmasRegistro'

export interface BasculaRow {
  fecha: string
  uso_bascula: string
  pesa_patron_kg: number | null
  punto_calibracion: string
  peso_medido_kg: number | null
  desviacion: number | null
  dentro_tolerancia: boolean | null
  realizo: string
  observaciones: string | null
}

interface Props {
  rancho: string
  orgNombre?: string | null
  desde: string
  hasta: string
  registros: BasculaRow[]
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

function fmtNum(n: number | null, dec = 3): string {
  if (n === null || n === undefined) return '—'
  return Number(n).toFixed(dec)
}

// Anchos relativos de columna (la tabla se escala al ancho útil de la hoja)
const COLS: ColumnaDato[] = [
  { texto: 'Fecha', ancho: 55, align: 'left' },
  { texto: 'Uso Báscula', ancho: 120, align: 'left' },
  { texto: 'Pesa patrón (kg)', ancho: 70, align: 'center' },
  { texto: 'Punto calibración', ancho: 110, align: 'left' },
  { texto: 'Peso medido (kg)', ancho: 70, align: 'center' },
  { texto: 'Desviación', ancho: 65, align: 'center' },
  { texto: 'Dentro tolerancia', ancho: 70, align: 'center' },
  { texto: 'Realizó', ancho: 70, align: 'left' },
  { texto: 'Observaciones', ancho: 90, align: 'left' },
]

export function CalibracionBasculasPDF({
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
  const codigoFmt = codigoFormato('REG-05', codigoClave)

  return (
    <Document>
      <PaginaEstandar
        titulo="CALIBRACIÓN DE BÁSCULAS"
        subtitulo={`Calibración de básculas | ${rancho}`}
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
              fmtFecha(r.fecha), r.uso_bascula, fmtNum(r.pesa_patron_kg, 3), r.punto_calibracion, fmtNum(r.peso_medido_kg, 3), fmtNum(r.desviacion, 3), r.dentro_tolerancia === true ? 'Si' : r.dentro_tolerancia === false ? 'No' : '—', r.realizo || '—', r.observaciones ?? '',
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
