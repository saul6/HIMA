// PDF M41 — Registro de temperaturas del conservador (diseño nuevo: lib/pdf/disenoNuevo).
import { Document, Text } from '@react-pdf/renderer'
import { PaginaEstandar, Seccion } from '@/lib/pdf/disenoNuevo/PaginaEstandar'
import { FranjaDatos } from '@/lib/pdf/disenoNuevo/Franja'
import { TablaDatos, type ColumnaDato } from '@/lib/pdf/disenoNuevo/TablaDatos'
import { PdfFirmas } from '@/lib/pdf/disenoNuevo/PdfFirmas'
import { codigoFormato } from '@/lib/codigoFormato'
import { PC } from '@/lib/pdf/components/tokens'
import type { FirmaParaPdf } from '@/hooks/useFirmasRegistro'
import { fechaPdf } from '@/lib/pdf/disenoNuevo/fechas'

export interface M41LecturaPDF {
  hora: number
  temperatura: number | null
}

export interface M41RegistroDataPDF {
  orgNombre: string
  instalacion: string
  fecha: string
  temp_min: number | null
  temp_max: number | null
  observaciones: string | null
  lecturas: M41LecturaPDF[]
}

function fmtFecha(iso: string): string {
  return fechaPdf(iso)
}

const t = (v: number | null | undefined): string => v != null ? String(v) : ''

const HORAS = Array.from({ length: 24 }, (_, i) => i + 1)

const COLS: ColumnaDato[] = [
  { texto: 'Hora', ancho: 48 },
  ...HORAS.map((h): ColumnaDato => ({ texto: `${String(h).padStart(2, '0')}:00`, ancho: 28, align: 'center' })),
]

export function TemperaturaConservadorPDF({
  d, codigoClave, terminoSitio = 'Instalación', firmaRealizo, firmaVerifico,
}: {
  d: M41RegistroDataPDF
  codigoClave: string
  terminoSitio?: string
  firmaRealizo?: FirmaParaPdf | null
  firmaVerifico?: FirmaParaPdf | null
}) {
  const lecturaPorHora: Record<number, number | null> = {}
  for (const l of d.lecturas) lecturaPorHora[l.hora] = l.temperatura

  const rangoMin = d.temp_min != null ? `${d.temp_min} C` : '—'
  const rangoMax = d.temp_max != null ? `${d.temp_max} C` : '—'
  const codigoFmt = codigoFormato('F-FRUS-PRO-05', codigoClave)
  const fechaLabel = fmtFecha(d.fecha)

  return (
    <Document>
      <PaginaEstandar
        titulo="REGISTRO DE TEMPERATURAS DEL CONSERVADOR"
        subtitulo={`Temperaturas | ${d.instalacion} | ${fechaLabel}`}
        codigoFmt={codigoFmt}
        folio={fechaLabel}
        emision={fechaLabel}
        etiquetaEmision="Fecha"
        tituloDatos="1. DATOS DEL SITIO"
        porRenglon={5}
        camposDatos={[
          { icono: 'ubicacion', etiqueta: terminoSitio, valor: d.instalacion },
          { icono: 'calendario', etiqueta: 'Fecha', valor: fechaLabel },
          { etiqueta: 'Temp. minima', valor: rangoMin },
          { etiqueta: 'Temp. maxima', valor: rangoMax },
        ]}
      >
        <Seccion titulo="2. LECTURAS DE TEMPERATURA">
          <Text style={{ fontSize: 6.5, color: PC.textSub, marginBottom: 4, fontFamily: 'Helvetica-Oblique' }}>
            Instrucción: revisar temperatura al iniciar turno y cada 2 horas.
          </Text>
          <TablaDatos
            columnas={COLS}
            fuente={6.5}
            fuenteEnc={6}
            filas={[[{ texto: 'Temp. (C)', negrita: true }, ...HORAS.map((h) => t(lecturaPorHora[h]))]]}
          />
        </Seccion>

        {d.observaciones ? <FranjaDatos campos={[{ etiqueta: 'Observaciones', valor: d.observaciones }]} /> : null}

        <PdfFirmas
          signatures={[
            { label: '', nombre: '', caption: 'Responsable de la instalación', firma: firmaRealizo ?? null },
            { label: '', nombre: '', caption: 'Responsable de la empresa', firma: firmaVerifico ?? null },
          ]}
        />
      </PaginaEstandar>
    </Document>
  )
}
