// PATRÓN INOCUIDAD — PDF M12 (plantilla homogénea M.A.D.Y)
// LimpiezaBanosPagina: una página A4 portrait por jornada (reutilizable).
// LimpiezaBanosPDF:    documento individual (1 jornada).
// LimpiezaBanosConsolidadoPDF: documento multi-página, uno por jornada.

import { Document } from '@react-pdf/renderer'
import { PaginaEstandar, Seccion } from '@/lib/pdf/disenoNuevo/PaginaEstandar'
import { TablaDatos, ANCHO_UTIL, type ColumnaDato } from '@/lib/pdf/disenoNuevo/TablaDatos'
import { PdfFirmas } from '@/lib/pdf/disenoNuevo/PdfFirmas'
import { PC } from '@/lib/pdf/components/tokens'
import type { FirmaParaPdf } from '@/hooks/useFirmasRegistro'

// ── Tipos ─────────────────────────────────────────────────────────────────────

export interface LimpiezaBanoPDFRow {
  bano_numero: string
  limpieza: boolean
  desinfeccion: boolean
  concentracion_ppm: number
  sustancias: string[]
  abasto_papel: boolean
  succion: boolean
}

export interface LimpiezaBanosPaginaProps {
  rancho: string
  ranchoCodigo: string
  fecha: string       // "2026-06-15" ISO
  banos: LimpiezaBanoPDFRow[]
  terminoSitio?: string
  firmaRealizo?: FirmaParaPdf | null
  firmaVerifico?: FirmaParaPdf | null
}

export interface LimpiezaBanosConsolidadoPDFProps {
  jornadas: LimpiezaBanosPaginaProps[]
  ranchoNombre: string
  desde: string
  hasta: string
}

// ── Columnas ──────────────────────────────────────────────────────────────────

const COLS: ColumnaDato[] = [
  { texto: 'N.° Baño', ancho: 45, align: 'center' },
  { texto: 'Limpieza\n(Lavar y tallar)', ancho: 80, align: 'center' },
  { texto: 'Desinfección\n(3 ml cloro/L)', ancho: 80, align: 'center' },
  { texto: 'Conc.\n(ppm)', ancho: 55, align: 'center' },
  { texto: 'Sustancias utilizadas', ancho: 120 },
  { texto: 'Abasto\nPapel', ancho: 80, align: 'center' },
  { texto: 'Succión', ancho: 60, align: 'center' },
]

// Si en navy, No en rojo suave (el texto no cambia)
const siNoCelda = (v: boolean) => ({ texto: v ? 'Si' : 'No', color: v ? PC.m13Navy : PC.negativo, negrita: true })

// ── Helpers ───────────────────────────────────────────────────────────────────

function formatFechaPDF(iso: string): string {
  try {
    return new Date(iso + 'T12:00:00').toLocaleDateString('es-MX', {
      weekday: 'long', year: 'numeric', month: 'long', day: 'numeric',
    })
  } catch { return iso }
}

function siNo(val: boolean): string { return val ? 'Si' : 'No' }

// ── Componente de página ──────────────────────────────────────────────────────

export function LimpiezaBanosPagina({
  rancho, ranchoCodigo, fecha, banos, terminoSitio = 'Rancho',
  firmaRealizo, firmaVerifico,
}: LimpiezaBanosPaginaProps) {
  const emision = new Date().toLocaleDateString('es-MX')

  return (
    <PaginaEstandar
      orientacion="portrait"
      titulo="LIMPIEZA Y DESINFECCIÓN DE BAÑOS"
      subtitulo={`Registro de limpieza | ${rancho}`}
      codigoFmt="M.A.D.Y-F-SC-SIG-041.14"
      folio={formatFechaPDF(fecha)}
      emision={emision}
      tituloDatos={`1. DATOS DEL ${terminoSitio} Y JORNADA`.toUpperCase()}
      camposDatos={[
        { icono: 'ubicacion', etiqueta: terminoSitio, valor: rancho || '—' },
        { icono: 'codigo', etiqueta: 'Código', valor: ranchoCodigo || '—' },
        { icono: 'calendario', etiqueta: 'Fecha', valor: formatFechaPDF(fecha) },
        { etiqueta: 'Total baños', valor: String(banos.length) },
      ]}
    >
      <Seccion titulo="2. REGISTRO DE LIMPIEZA POR BAÑO">
        <TablaDatos
          columnas={COLS}
          anchoTotal={ANCHO_UTIL.portrait}
          filas={banos.map((b) => [
            { texto: b.bano_numero, negrita: true },
            siNoCelda(b.limpieza),
            siNoCelda(b.desinfeccion),
            String(b.concentracion_ppm),
            b.sustancias.length > 0 ? b.sustancias.join(', ') : '—',
            siNoCelda(b.abasto_papel),
            siNoCelda(b.succion),
          ])}
        />
      </Seccion>

      <Seccion titulo="3. FIRMAS Y RESPONSABLES">
        <PdfFirmas
          signatures={[
            { label: '', nombre: '', caption: 'Realizó la limpieza', firma: firmaRealizo ?? null },
            { label: '', nombre: '', caption: 'Responsable de Inocuidad — Firma', firma: firmaVerifico ?? null },
          ]}
        />
      </Seccion>
    </PaginaEstandar>
  )
}

// ── PDF individual ─────────────────────────────────────────────────────────────

export function LimpiezaBanosPDF(props: LimpiezaBanosPaginaProps) {
  return (
    <Document
      title={`Limpieza de Banos ${props.rancho} ${props.fecha}`}
      author="M.A.D.Y"
      subject="Limpieza y Desinfeccion de Banos"
    >
      <LimpiezaBanosPagina {...props} />
    </Document>
  )
}

// ── PDF consolidado ────────────────────────────────────────────────────────────

export function LimpiezaBanosConsolidadoPDF({
  jornadas, ranchoNombre, desde, hasta,
}: LimpiezaBanosConsolidadoPDFProps) {
  return (
    <Document
      title={`Limpieza Banos Consolidado ${ranchoNombre} ${desde} ${hasta}`}
      author="M.A.D.Y"
      subject="Limpieza y Desinfeccion de Banos Consolidado"
    >
      {jornadas.map((j, i) => (
        <LimpiezaBanosPagina key={i} {...j} />
      ))}
    </Document>
  )
}
