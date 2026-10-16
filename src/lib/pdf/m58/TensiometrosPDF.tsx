import { Document } from '@react-pdf/renderer'
import { PaginaEstandar, Seccion } from '@/lib/pdf/disenoNuevo/PaginaEstandar'
import { TablaDatos, type ColumnaDato } from '@/lib/pdf/disenoNuevo/TablaDatos'
import { PdfFirmas } from '@/lib/pdf/disenoNuevo/PdfFirmas'
import { PC } from '@/lib/pdf/components/tokens'
import { partirPalabraLarga } from '@/lib/pdf/components/texto'
import type { FirmaParaPdf } from '@/hooks/useFirmasRegistro'

export interface TensiometrosRow {
  fecha: string
  hora: string | null
  prof_15cm: number | null
  prof_45cm: number | null
  prof_otra_cm: number | null
  lectura_otra: number | null
  realizo: string | null
  observaciones: string | null
}

interface Props {
  rancho: string
  orgNombre?: string | null
  desde: string
  hasta: string
  registros: TensiometrosRow[]
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

// Anchos relativos de columna (la tabla se escala al ancho útil de la hoja)
const COLS: ColumnaDato[] = [
  { texto: 'Fecha', ancho: 55 },
  { texto: 'Hora', ancho: 40, align: 'center' },
  { texto: '15 cm', ancho: 45, align: 'center' },
  { texto: '45 cm', ancho: 45, align: 'center' },
  { texto: 'Otra (cm)', ancho: 45, align: 'center' },
  { texto: 'Lect. otra', ancho: 45, align: 'center' },
  { texto: 'Realizo', ancho: 100 },
  { texto: 'Observaciones', ancho: 300 },
]

export function TensiometrosPDF({ rancho, orgNombre, desde, hasta, registros, terminoSitio = 'Instalacion', firmaRealizo, firmaVerifico }: Props) {
  const periodo = desde === hasta ? fmtFecha(desde) : `${fmtFecha(desde)} - ${fmtFecha(hasta)}`

  return (
    <Document>
      <PaginaEstandar
        titulo="LECTURA DE TENSIÓMETROS"
        subtitulo={`Monitoreo de humedad del suelo | ${rancho}`}
        codigoFmt="M58"
        folio={periodo}
        emision={periodo}
        etiquetaEmision="Periodo"
        tituloDatos="1. DATOS DEL SITIO"
        camposDatos={[
          { icono: 'ubicacion', etiqueta: terminoSitio, valor: rancho },
          ...(orgNombre ? [{ icono: 'usuario' as const, etiqueta: 'Organizacion', valor: orgNombre }] : []),
          { icono: 'calendario', etiqueta: 'Periodo', valor: periodo },
        ]}
      >
        <Seccion titulo="2. LECTURAS REGISTRADAS">
          <TablaDatos
            columnas={COLS}
            fuente={7}
            filas={registros.map((r) => [
              fmtFecha(r.fecha), r.hora ?? '—', r.prof_15cm != null ? String(r.prof_15cm) : '—', r.prof_45cm != null ? String(r.prof_45cm) : '—', r.prof_otra_cm != null ? String(r.prof_otra_cm) : '—', r.lectura_otra != null ? String(r.lectura_otra) : '—', r.realizo ?? '—', r.observaciones ?? '—',
            ])}
          />
        </Seccion>

        <PdfFirmas
          signatures={[
            { label: '', nombre: '', caption: 'Realizo', firma: firmaRealizo ?? null },
            { label: '', nombre: '', caption: 'Responsable de Inocuidad', firma: firmaVerifico ?? null },
          ]}
        />
      </PaginaEstandar>
    </Document>
  )
}
