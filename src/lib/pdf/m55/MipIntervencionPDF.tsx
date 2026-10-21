import { Document } from '@react-pdf/renderer'
import { PaginaEstandar, Seccion } from '@/lib/pdf/disenoNuevo/PaginaEstandar'
import { FranjaDatos } from '@/lib/pdf/disenoNuevo/Franja'
import { TablaDatos, type ColumnaDato } from '@/lib/pdf/disenoNuevo/TablaDatos'
import { PdfFirmas } from '@/lib/pdf/disenoNuevo/PdfFirmas'
import { PC } from '@/lib/pdf/components/tokens'
import type { FirmaParaPdf } from '@/hooks/useFirmasRegistro'
import { fechaPdf } from '@/lib/pdf/disenoNuevo/fechas'

export interface MipIntervencionItemRow {
  numero: number | null
  texto: string
  contra_maleza: boolean
  contra_insectos: boolean
  contra_enfermedades: boolean
  contra_vertebrados: boolean
  comentario: string | null
}

export interface MipIntervencionPDFProps {
  rancho: string
  orgNombre?: string | null
  fecha: string
  producto: string | null
  region: string | null
  realizo: string | null
  observaciones: string | null
  items: MipIntervencionItemRow[]
  terminoSitio?: string
  firmaRealizo?: FirmaParaPdf | null
  firmaVerifico?: FirmaParaPdf | null
}

function fmtFecha(iso: string): string {
  return fechaPdf(iso)
}

// Marca de la técnica ("X"): es una selección, no un valor negativo
const marca = (v: boolean) => (v ? { texto: 'X', color: PC.m13Navy, negrita: true } : '')

const COLS: ColumnaDato[] = [
  { texto: 'No.', ancho: 20, align: 'center' },
  { texto: 'Técnica de intervención', ancho: 300 },
  { texto: 'Maleza', ancho: 56, align: 'center' },
  { texto: 'Insectos e\nInvertebrados', ancho: 56, align: 'center' },
  { texto: 'Enfermedades y\nNematodos', ancho: 56, align: 'center' },
  { texto: 'Plagas\nVertebradas', ancho: 56, align: 'center' },
  { texto: 'Comentario', ancho: 190 },
]

export function MipIntervencionPDFPage({
  rancho,
  orgNombre,
  fecha,
  producto,
  region,
  realizo,
  observaciones,
  items,
  terminoSitio = 'Sitio',
  firmaRealizo,
  firmaVerifico,
}: MipIntervencionPDFProps) {
  return (
    <PaginaEstandar
      titulo="MIP - TÉCNICAS DE INTERVENCIÓN"
      subtitulo={`Manejo Integrado de Plagas | ${rancho}`}
      codigoFmt="M55"
      folio={fmtFecha(fecha)}
      emision={fmtFecha(fecha)}
      etiquetaEmision="Fecha"
      tituloDatos="1. DATOS GENERALES"
      camposDatos={[
        { icono: 'ubicacion', etiqueta: terminoSitio, valor: rancho },
        { etiqueta: 'Producto / Cultivo', valor: producto ?? '—' },
        ...(orgNombre ? [{ icono: 'usuario' as const, etiqueta: 'Organización', valor: orgNombre }] : []),
        { icono: 'calendario', etiqueta: 'Fecha', valor: fmtFecha(fecha) },
        { etiqueta: 'Región', valor: region ?? '—' },
        { icono: 'usuario', etiqueta: 'Realizó', valor: realizo ?? '—' },
      ]}
    >
      {observaciones ? <FranjaDatos campos={[{ etiqueta: 'Observaciones', valor: observaciones }]} /> : null}

      <Seccion titulo="2. MATRIZ DE TÉCNICAS DE INTERVENCIÓN">
        <TablaDatos
          columnas={COLS}
          fuente={8}
          fuenteEnc={6}
          filas={items.map((item) => [
            String(item.numero ?? '—'),
            item.texto,
            marca(item.contra_maleza),
            marca(item.contra_insectos),
            marca(item.contra_enfermedades),
            marca(item.contra_vertebrados),
            item.comentario ?? '',
          ])}
        />
      </Seccion>

      <PdfFirmas
        signatures={[
          { label: '', nombre: '', caption: 'Realizó', firma: firmaRealizo ?? null },
          { label: '', nombre: '', caption: 'Responsable de Inocuidad', firma: firmaVerifico ?? null },
        ]}
      />
    </PaginaEstandar>
  )
}

export function MipIntervencionPDF(props: MipIntervencionPDFProps) {
  return (
    <Document>
      <MipIntervencionPDFPage {...props} />
    </Document>
  )
}
