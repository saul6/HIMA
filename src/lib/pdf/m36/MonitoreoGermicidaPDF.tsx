// PDF M36 — Monitoreo de solución germicida (diseño nuevo: lib/pdf/disenoNuevo).
import { Document } from '@react-pdf/renderer'
import { PaginaEstandar, Seccion } from '@/lib/pdf/disenoNuevo/PaginaEstandar'
import { TablaDatos, type ColumnaDato } from '@/lib/pdf/disenoNuevo/TablaDatos'
import { PdfFirmas } from '@/lib/pdf/disenoNuevo/PdfFirmas'
import { codigoFormato } from '@/lib/codigoFormato'
import type { FirmaParaPdf } from '@/hooks/useFirmasRegistro'
import { fechaPdf } from '@/lib/pdf/disenoNuevo/fechas'

export interface MonitoreoRow {
  fecha: string
  tipo_germicida: string
  uso: string
  concentracion: number
  correccion: string | null
  preparado_por: string
}

interface Props {
  rancho: string
  orgNombre?: string | null
  desde: string
  hasta: string
  monitoreos: MonitoreoRow[]
  codigoClave: string
  terminoSitio?: string
  firmaRealizo?: FirmaParaPdf | null
  firmaVerifico?: FirmaParaPdf | null
}

function fmtFecha(iso: string): string {
  return fechaPdf(iso)
}

const COLS: ColumnaDato[] = [
  { texto: 'Fecha', ancho: 55 },
  { texto: 'Tipo de germicida', ancho: 105 },
  { texto: 'Uso', ancho: 105 },
  { texto: 'Conc. ppm', ancho: 52, align: 'center' },
  { texto: 'Corrección', ancho: 100 },
  { texto: 'Preparado por', ancho: 95 },
]

export function MonitoreoGermicidaPDF({ rancho, orgNombre, desde, hasta, monitoreos, codigoClave, terminoSitio = 'Instalación', firmaRealizo, firmaVerifico }: Props) {
  const periodo = desde === hasta ? fmtFecha(desde) : `${fmtFecha(desde)} - ${fmtFecha(hasta)}`
  const codigoFmt = codigoFormato('F-FRUS-SAN-14', codigoClave)

  return (
    <Document>
      <PaginaEstandar
        titulo="MONITOREO DE SOLUCIÓN GERMICIDA"
        subtitulo={`Registro de germicida | ${rancho}`}
        codigoFmt={codigoFmt}
        folio={periodo}
        emision={periodo}
        etiquetaEmision="Periodo"
        tituloDatos="1. DATOS DEL SITIO"
        camposDatos={[
          { icono: 'ubicacion', etiqueta: terminoSitio, valor: rancho },
          { icono: 'calendario', etiqueta: 'Periodo', valor: periodo },
        ]}
      >
        <Seccion titulo="2. REGISTROS">
          <TablaDatos
            columnas={COLS}
            fuente={7}
            filas={monitoreos.map((m) => [
              fmtFecha(m.fecha),
              m.tipo_germicida,
              m.uso,
              `${m.concentracion} ppm`,
              m.correccion ?? '—',
              m.preparado_por,
            ])}
          />
        </Seccion>

        <PdfFirmas
          signatures={[
            { label: '', nombre: '', caption: 'Verificó: Responsable del cooler', firma: firmaRealizo ?? null },
            { label: '', nombre: '', caption: 'Verificó — Firma', firma: firmaVerifico ?? null },
          ]}
        />
      </PaginaEstandar>
    </Document>
  )
}
