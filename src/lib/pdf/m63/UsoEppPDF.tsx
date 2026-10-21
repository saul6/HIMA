import { Document } from '@react-pdf/renderer'
import { PaginaEstandar, Seccion } from '@/lib/pdf/disenoNuevo/PaginaEstandar'
import { TablaDatos, type ColumnaDato } from '@/lib/pdf/disenoNuevo/TablaDatos'
import { PdfFirmas } from '@/lib/pdf/disenoNuevo/PdfFirmas'
import { codigoFormato } from '@/lib/codigoFormato'
import { PC } from '@/lib/pdf/components/tokens'
import type { FirmaParaPdf } from '@/hooks/useFirmasRegistro'
import { fechaPdf } from '@/lib/pdf/disenoNuevo/fechas'

export interface UsoEppRow {
  fecha: string
  rancho: string
  aplicador: string
  momento: string
  botas_ok: boolean
  overol_ok: boolean
  guantes_ok: boolean
  lentes_ok: boolean
  mascarilla_ok: boolean
  realizo: string | null
  observaciones: string | null
}

interface Props {
  rows: UsoEppRow[]
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

function okLabel(val: boolean): string {
  return val ? 'Bueno' : 'Dañado'
}

// Bueno normal; Danado en rojo suave (el texto no cambia)
const okCelda = (v: boolean) => (v ? okLabel(v) : { texto: okLabel(v), color: PC.negativo, negrita: true })

// Anchos relativos de columna (la tabla se escala al ancho útil de la hoja)
const COLS = (terminoSitio: string): ColumnaDato[] => [
  { texto: 'Fecha', ancho: 50 },
  { texto: terminoSitio, ancho: 70 },
  { texto: 'Aplicador', ancho: 75 },
  { texto: 'Momento', ancho: 45, align: 'center' },
  { texto: 'Botas', ancho: 40, align: 'center' },
  { texto: 'Overol', ancho: 40, align: 'center' },
  { texto: 'Guantes', ancho: 40, align: 'center' },
  { texto: 'Lentes', ancho: 40, align: 'center' },
  { texto: 'Mascarilla', ancho: 42, align: 'center' },
  { texto: 'Realizó', ancho: 70 },
  { texto: 'Observaciones', ancho: 90 },
]

export function UsoEppPDF({ rows, orgNombre, desde, hasta, codigoClave, terminoSitio = 'Instalación', firmaRealizo, firmaVerifico }: Props) {
  const periodo = desde === hasta ? fmtFecha(desde) : `${fmtFecha(desde)} - ${fmtFecha(hasta)}`
  const codigoFmt = codigoFormato('M63-USO-EPP', codigoClave)

  return (
    <Document>
      <PaginaEstandar
        titulo="USO DE EQUIPO DE PROTECCIÓN PERSONAL (EPP)"
        subtitulo={"Registro de uso y estado del EPP"}
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
              fmtFecha(r.fecha), r.rancho, r.aplicador, r.momento === 'inicio' ? 'Inicio' : 'Fin', okCelda(r.botas_ok), okCelda(r.overol_ok), okCelda(r.guantes_ok), okCelda(r.lentes_ok), okCelda(r.mascarilla_ok), r.realizo ?? '—', r.observaciones ?? '',
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
