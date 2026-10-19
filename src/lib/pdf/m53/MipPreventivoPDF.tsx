import { Document } from '@react-pdf/renderer'
import { PaginaEstandar, Seccion } from '@/lib/pdf/disenoNuevo/PaginaEstandar'
import { FranjaDatos } from '@/lib/pdf/disenoNuevo/Franja'
import { TablaDatos, type ColumnaDato } from '@/lib/pdf/disenoNuevo/TablaDatos'
import { PdfFirmas } from '@/lib/pdf/disenoNuevo/PdfFirmas'
import { PC } from '@/lib/pdf/components/tokens'
import type { FirmaParaPdf } from '@/hooks/useFirmasRegistro'

export interface MipItemRow {
  numero: number | null
  texto: string
  contra_maleza: boolean
  contra_insectos: boolean
  contra_enfermedades: boolean
  contra_vertebrados: boolean
  comentario: string | null
}

export interface MipPreventivoPDFProps {
  rancho: string
  orgNombre?: string | null
  fecha: string
  producto: string | null
  region: string | null
  realizo: string | null
  observaciones: string | null
  items: MipItemRow[]
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

// Marca de la técnica ("X"): es una selección, no un valor negativo
const marca = (v: boolean) => (v ? { texto: 'X', color: PC.m13Navy, negrita: true } : '')

const COLS: ColumnaDato[] = [
  { texto: 'No.', ancho: 20, align: 'center' },
  { texto: 'Técnica preventiva', ancho: 300 },
  { texto: 'Maleza', ancho: 56, align: 'center' },
  { texto: 'Insectos e\nInvertebrados', ancho: 56, align: 'center' },
  { texto: 'Enfermedades y\nNematodos', ancho: 56, align: 'center' },
  { texto: 'Plagas\nVertebradas', ancho: 56, align: 'center' },
  { texto: 'Comentario', ancho: 190 },
]

export function MipPreventivoPDFPage({
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
}: MipPreventivoPDFProps) {
  return (
    <PaginaEstandar
      titulo="MIP - TÉCNICAS PREVENTIVAS"
      subtitulo={`Manejo Integrado de Plagas | ${rancho}`}
      codigoFmt="M53"
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

      <Seccion titulo="2. MATRIZ DE TECNICAS PREVENTIVAS">
        <TablaDatos
          columnas={COLS}
          fuente={8}
          fuenteEnc={6}
          sinNegativos
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

export function MipPreventivoPDF(props: MipPreventivoPDFProps) {
  return (
    <Document>
      <MipPreventivoPDFPage {...props} />
    </Document>
  )
}
