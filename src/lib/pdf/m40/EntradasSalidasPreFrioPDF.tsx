// PDF M40 — Entradas y salidas en pre-enfriamiento (diseño nuevo: lib/pdf/disenoNuevo).
import { Document } from '@react-pdf/renderer'
import { PaginaEstandar, Seccion } from '@/lib/pdf/disenoNuevo/PaginaEstandar'
import { FranjaDatos } from '@/lib/pdf/disenoNuevo/Franja'
import { TablaDatos, type ColumnaDato } from '@/lib/pdf/disenoNuevo/TablaDatos'
import { PdfFirmas } from '@/lib/pdf/disenoNuevo/PdfFirmas'
import { codigoFormato } from '@/lib/codigoFormato'
import type { FirmaParaPdf } from '@/hooks/useFirmasRegistro'
import { fechaPdf } from '@/lib/pdf/disenoNuevo/fechas'

export interface M40LineaPDF {
  orden: number
  cuarto_prefrio: string | null
  fruta: string | null
  presentacion: string | null
  num_tarimas: number | null
  restos: string | null
  entrada_hora: string | null
  entrada_temp: number | null
  salida_hora: string | null
  salida_temp: number | null
  tiempo_total: string | null
}

export interface M40RegistroDataPDF {
  orgNombre: string
  instalacion: string
  fecha: string
  folio?: string | null
  empresa: string | null
  observaciones: string | null
  lineas: M40LineaPDF[]
}

function fmtFecha(iso: string): string {
  return fechaPdf(iso)
}

const t = (v: string | null | undefined): string => v ?? '—'
const n = (v: number | null | undefined): string => v != null ? String(v) : '—'

const COLS: ColumnaDato[] = [
  { texto: 'No.', ancho: 22, align: 'center' },
  { texto: 'Cuarto Pre-frio', ancho: 90 },
  { texto: 'Fruta', ancho: 90 },
  { texto: 'Presentación', ancho: 80 },
  { texto: 'Tarimas', ancho: 40, align: 'center' },
  { texto: 'Restos', ancho: 250 },
  { texto: 'E. Hora', ancho: 45, align: 'center' },
  { texto: 'E. Temp', ancho: 42, align: 'center' },
  { texto: 'S. Hora', ancho: 45, align: 'center' },
  { texto: 'S. Temp', ancho: 42, align: 'center' },
  { texto: 'Tiempo', ancho: 50, align: 'center' },
]

export function EntradasSalidasPreFrioPDF({
  d, codigoClave, firmaRealizo, firmaVerifico,
}: {
  d: M40RegistroDataPDF
  codigoClave: string
  firmaRealizo?: FirmaParaPdf | null
  firmaVerifico?: FirmaParaPdf | null
}) {
  const codigoFmt = codigoFormato('F-FRUS-PRO-04', codigoClave)

  return (
    <Document>
      <PaginaEstandar
        titulo="ENTRADAS Y SALIDAS EN PRE-ENFRIAMIENTO"
        subtitulo={`${d.instalacion}${d.empresa ? ` | ${d.empresa}` : ''} | ${fmtFecha(d.fecha)}`}
        codigoFmt={codigoFmt}
        folio={d.folio ?? '—'}
        emision={fmtFecha(d.fecha)}
        etiquetaEmision="Fecha"
        camposDatos={[]}
      >
        <Seccion titulo="ENTRADAS Y SALIDAS DE PRODUCTO">
          <TablaDatos
            columnas={COLS}
            fuente={7.5}
            filas={d.lineas.map((l) => [
              String(l.orden), t(l.cuarto_prefrio), t(l.fruta), t(l.presentacion), n(l.num_tarimas), t(l.restos),
              t(l.entrada_hora), n(l.entrada_temp), t(l.salida_hora), n(l.salida_temp), t(l.tiempo_total),
            ])}
          />
        </Seccion>

        {d.observaciones ? <FranjaDatos campos={[{ etiqueta: 'Observaciones', valor: d.observaciones }]} /> : null}

        <PdfFirmas
          signatures={[
            { label: 'Responsable de la instalación', nombre: firmaRealizo?.firmante ?? '', caption: 'Firma del responsable', firma: firmaRealizo ?? null },
            { label: 'Responsable de la empresa', nombre: firmaVerifico?.firmante ?? '', caption: 'Responsable de Inocuidad — Firma', firma: firmaVerifico ?? null },
          ]}
        />
      </PaginaEstandar>
    </Document>
  )
}
