// PDF M74 — Monitoreo de solución germicida GlobalGAP, REG-10.1 (diseño nuevo: lib/pdf/disenoNuevo).
import { Document, Text } from '@react-pdf/renderer'
import { PaginaEstandar } from '@/lib/pdf/disenoNuevo/PaginaEstandar'
import { TablaDatos, type ColumnaDato } from '@/lib/pdf/disenoNuevo/TablaDatos'
import { PdfFirmas } from '@/lib/pdf/disenoNuevo/PdfFirmas'
import { PC } from '@/lib/pdf/components/tokens'
import type { FirmaParaPdf } from '@/hooks/useFirmasRegistro'
import { fechaPdf } from '@/lib/pdf/disenoNuevo/fechas'

export interface GermicidaGGFilaPDF {
  id: string
  rancho: string
  fecha: string
  producto: string | null
  material_utilizado: string | null
  sector: string | null
  hora1: string | null
  ppm1: number | null
  ajuste1: string | null
  hora2: string | null
  ppm2: number | null
  ajuste2: string | null
  hora3: string | null
  ppm3: number | null
  ajuste3: string | null
  realizo: string | null
  observaciones: string | null
}

export interface GermicidaGGPDFProps {
  rancho: string
  orgNombre?: string | null
  filas: GermicidaGGFilaPDF[]
  firmaRealizo?: FirmaParaPdf | null
  firmaVerifico?: FirmaParaPdf | null
}

// Anchos relativos de columna (la tabla se escala al ancho útil de la hoja)
const COL = {
  fecha: 55,
  mat: 115,
  sector: 80,
  hora: 40,
  ppm: 40,
  ajuste: 40,
  realizo: 80,
  obs: 110,
}

function formatFecha(f: string) {
  try {
    return fechaPdf(f, { day: '2-digit', month: 'short', year: 'numeric' })
  } catch { return f }
}

const TOMA: ColumnaDato[] = [
  { texto: 'Hora', ancho: COL.hora, align: 'center' },
  { texto: 'ppm', ancho: COL.ppm, align: 'center' },
  { texto: 'Ajuste', ancho: COL.ajuste, align: 'center' },
]

const COLUMNAS: ColumnaDato[] = [
  { texto: '', ancho: COL.fecha },
  { texto: '', ancho: COL.mat },
  { texto: '', ancho: COL.sector },
  ...TOMA, ...TOMA, ...TOMA,
  { texto: '', ancho: COL.realizo },
  { texto: '', ancho: COL.obs },
]

const tomaW = COL.hora + COL.ppm + COL.ajuste
const GRUPOS = [
  { texto: 'Fecha', ancho: COL.fecha },
  { texto: 'Material utilizado', ancho: COL.mat },
  { texto: 'Sector', ancho: COL.sector },
  { texto: 'Hora de monitoreo 1', ancho: tomaW },
  { texto: 'Hora de monitoreo 2', ancho: tomaW },
  { texto: 'Hora de monitoreo 3', ancho: tomaW },
  { texto: 'Realizó', ancho: COL.realizo },
  { texto: 'Observaciones', ancho: COL.obs },
]

export function GermicidaGGPagina({ rancho, orgNombre, filas, firmaRealizo, firmaVerifico }: GermicidaGGPDFProps) {
  const folio = fechaPdf(filas[0]?.fecha) || '—'
  const producto = filas[0]?.producto ?? null

  return (
    <PaginaEstandar
      titulo="MONITOREO DE SOLUCIÓN GERMICIDA"
      subtitulo={`REG-10.1 · Global G.A.P. v6 | ${rancho}`}
      codigoFmt="REG-10.1"
      folio={folio}
      emision={folio}
      etiquetaEmision="Fecha"
      tituloDatos="DATOS GENERALES"
      camposDatos={[
        ...(orgNombre ? [{ icono: 'usuario' as const, etiqueta: 'Compañía', valor: orgNombre }] : []),
        { icono: 'ubicacion', etiqueta: 'Rancho', valor: rancho },
        ...(producto ? [{ etiqueta: 'Producto', valor: producto }] : []),
      ]}
    >
      <Text style={{ fontSize: 6, color: PC.textSub, fontFamily: 'Helvetica-Oblique', marginBottom: 4 }}>
        Se debe llevar la verificación de la sanitización diariamente y/o cada que haya cosecha, especificando la hora de monitoreo y las ppm (Lavado de manos 1.5-3.0 ppm / Agua de desinfección de herramienta, cubetas 100-200 ppm).
      </Text>

      <TablaDatos
        columnas={COLUMNAS}
        encabezadoSuperior={GRUPOS}
        fuente={7}
        fuenteEnc={6.5}
        filas={filas.map((f) => [
          formatFecha(f.fecha),
          f.material_utilizado ?? '',
          f.sector ?? '',
          f.hora1 ?? '', f.ppm1 !== null ? String(f.ppm1) : '', f.ajuste1 ?? '',
          f.hora2 ?? '', f.ppm2 !== null ? String(f.ppm2) : '', f.ajuste2 ?? '',
          f.hora3 ?? '', f.ppm3 !== null ? String(f.ppm3) : '', f.ajuste3 ?? '',
          f.realizo ?? '',
          f.observaciones ?? '',
        ])}
      />

      <PdfFirmas
        signatures={[
          { label: '', nombre: filas[0]?.realizo ?? '', caption: 'Nombre y firma de quien realiza', firma: firmaRealizo ?? null },
          { label: '', nombre: '', caption: 'Nombre y firma de quien verifica', firma: firmaVerifico ?? null },
        ]}
      />
    </PaginaEstandar>
  )
}

export function GermicidaGGPDF(props: GermicidaGGPDFProps) {
  return (
    <Document>
      <GermicidaGGPagina {...props} />
    </Document>
  )
}

export function GermicidaGGConsolidadoPDF({ filas, orgNombre }: {
  filas: GermicidaGGFilaPDF[]
  orgNombre?: string | null
}) {
  const ranchos = [...new Set(filas.map(f => f.rancho))]
  return (
    <Document>
      {ranchos.map(r => (
        <GermicidaGGPagina
          key={r}
          rancho={r}
          orgNombre={orgNombre}
          filas={filas.filter(f => f.rancho === r)}
        />
      ))}
    </Document>
  )
}
