import { Document } from '@react-pdf/renderer'
import { PaginaEstandar, Seccion } from '@/lib/pdf/disenoNuevo/PaginaEstandar'
import { FranjaDatos } from '@/lib/pdf/disenoNuevo/Franja'
import { TablaDatos, ANCHO_UTIL, type ColumnaDato } from '@/lib/pdf/disenoNuevo/TablaDatos'
import { PdfFirmas } from '@/lib/pdf/disenoNuevo/PdfFirmas'
import type { FirmaParaPdf } from '@/hooks/useFirmasRegistro'

export interface FuentesAguaItemRow {
  numero: number
  descripcion: string
  respuesta: 'si' | 'no' | 'na'
  comentario: string | null
}

export interface FuentesAguaPDFProps {
  rancho: string
  orgNombre?: string | null
  fecha: string
  tipo_fuente: string | null
  realizo: string | null
  observaciones: string | null
  items: FuentesAguaItemRow[]
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

function labelRespuesta(r: 'si' | 'no' | 'na'): string {
  if (r === 'si') return 'Si'
  if (r === 'no') return 'No'
  return 'N/A'
}

// Anchos relativos de columna (la tabla se escala al ancho útil de la hoja)
const COLS: ColumnaDato[] = [
  { texto: 'No.', ancho: 28, align: 'center' },
  { texto: 'Criterio de inspección', ancho: 240 },
  { texto: 'Respuesta', ancho: 45, align: 'center', negativo: true },
  { texto: 'Comentario', ancho: 220 },
]

export function FuentesAguaPage({
  rancho, orgNombre, fecha, tipo_fuente, realizo, observaciones, items,
  terminoSitio = 'Instalación',
  firmaRealizo,
  firmaVerifico,
}: FuentesAguaPDFProps) {
  return (
    <PaginaEstandar
      orientacion="portrait"
      titulo="INSPECCIÓN DE FUENTES DE AGUA"
      subtitulo={`Inspección de fuente | ${rancho}`}
      codigoFmt="M62"
      folio={fmtFecha(fecha)}
      emision={fmtFecha(fecha)}
      etiquetaEmision="Fecha"
      tituloDatos="1. DATOS GENERALES"
      camposDatos={[
        { icono: 'ubicacion', etiqueta: terminoSitio, valor: rancho },
        ...(orgNombre ? [{ icono: 'usuario' as const, etiqueta: 'Organización', valor: orgNombre }] : []),
        { icono: 'calendario', etiqueta: 'Fecha', valor: fmtFecha(fecha) },
        { etiqueta: 'Tipo de fuente', valor: tipo_fuente ?? '—' },
        { icono: 'usuario', etiqueta: 'Realizó', valor: realizo ?? '—' },
      ]}
    >
      <FranjaDatos campos={[{ etiqueta: 'Observaciones', valor: observaciones ?? '—' }]} />

      <Seccion titulo="2. CHECKLIST DE INSPECCIÓN">
        <TablaDatos
          columnas={COLS}
          anchoTotal={ANCHO_UTIL.portrait}
          fuente={8}
          filas={items.map((item) => [
            String(item.numero),
            item.descripcion,
            labelRespuesta(item.respuesta),
            item.comentario ?? '—',
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

export function FuentesAguaPDF(props: FuentesAguaPDFProps) {
  return (
    <Document>
      <FuentesAguaPage {...props} />
    </Document>
  )
}
