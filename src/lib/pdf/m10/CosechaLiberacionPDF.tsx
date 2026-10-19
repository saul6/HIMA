// PATRÓN INOCUIDAD — PDF M10 (plantilla homogénea M.A.D.Y)
// CosechaLiberacionPagina: una Page A4 landscape por jornada.
// CosechaLiberacionPDF:    documento individual.
// CosechaLiberacionConsolidadoPDF: documento multi-página.

import { Document, View } from '@react-pdf/renderer'
import { PaginaEstandar, Seccion } from '@/lib/pdf/disenoNuevo/PaginaEstandar'
import { TablaDatos, type ColumnaDato } from '@/lib/pdf/disenoNuevo/TablaDatos'
import { PdfFirmas } from '@/lib/pdf/disenoNuevo/PdfFirmas'
import { PC } from '@/lib/pdf/components/tokens'
import type { FirmaParaPdf } from '@/hooks/useFirmasRegistro'

// ── Tipos ─────────────────────────────────────────────────────────────────────

export interface CosechaLiberacionFilaPDF {
  sector: string | null
  cantidad_bandejas: number | null
  lote_liberado: boolean
  numero_comprobante: string | null
  codigo_trazabilidad: string | null
  marca_embalaje: string | null
  destino_final: string | null
  fruta_proceso_kg: number | null
  encargado_nombre: string | null
  verificacion_semanal: boolean
  hora_inicio_cosecha: string | null
  hora_fin_cosecha: string | null
  observaciones: string | null
}

export interface CosechaLiberacionPaginaProps {
  rancho: string
  ranchoCodigo: string
  fecha: string
  liberaciones: CosechaLiberacionFilaPDF[]
  folio?: string
  codigoClave?: string
  terminoSitio?: string
  firmaRealizo?: FirmaParaPdf | null
  firmaVerifico?: FirmaParaPdf | null
}

export interface CosechaLiberacionConsolidadoPDFProps {
  registros: CosechaLiberacionPaginaProps[]
  ranchoNombre: string
  desde: string
  hasta: string
}

// Anchos relativos de columna (la tabla se escala al ancho útil de la hoja)
const COLS: ColumnaDato[] = [
  { texto: 'Fecha', ancho: 44, align: 'center' },
  { texto: 'Sector', ancho: 50 },
  { texto: 'Cant.\nBandejas', ancho: 36, align: 'center' },
  { texto: 'Lote\nLib. S/N', ancho: 36, align: 'center' },
  { texto: 'No. Comprobante\no Vale Interno', ancho: 60 },
  { texto: 'Código de\nTrazabilidad', ancho: 66 },
  { texto: 'Marca y\nEmbalaje', ancho: 54 },
  { texto: 'Destino\nFinal', ancho: 58 },
  { texto: 'Fruta\nProc. Kg', ancho: 40, align: 'center' },
  { texto: 'Encargado de la\nLiberacion', ancho: 70 },
  { texto: 'Verif.\nSemanal', ancho: 36, align: 'center' },
  { texto: 'Observaciones\n(Hora inicio y final)', ancho: 214 },
]

function formatFechaPDF(iso: string): string {
  try {
    return new Date(iso + 'T12:00:00').toLocaleDateString('es-MX', {
      weekday: 'long', year: 'numeric', month: 'long', day: 'numeric',
    })
  } catch { return iso }
}

function siNo(val: boolean): string { return val ? 'Si' : 'No' }

function formatObservaciones(inicio: string | null, fin: string | null, obs: string | null): string {
  const partes: string[] = []
  if (inicio || fin) partes.push(`${inicio ?? '--:--'} - ${fin ?? '--:--'}`)
  if (obs) partes.push(obs)
  return partes.join('\n') || '—'
}

// Si en navy, No en rojo suave (el texto no cambia)
const siNoCelda = (v: boolean) => ({ texto: siNo(v), color: v ? PC.m13Navy : PC.negativo, negrita: true })

// ── CosechaLiberacionPagina ───────────────────────────────────────────────────

export function CosechaLiberacionPagina({
  rancho, ranchoCodigo, fecha, liberaciones,
  folio, codigoClave = 'MXA', terminoSitio = 'Rancho',
  firmaRealizo, firmaVerifico,
}: CosechaLiberacionPaginaProps) {
  const emision = new Date().toLocaleDateString('es-MX')
  const codigoFmt = `${codigoClave}-F-SC-SIG`
  const folioDisplay = folio ?? fecha

  return (
    <PaginaEstandar
      titulo="REGISTRO DE COSECHA Y LIBERACIÓN"
      subtitulo={`Formato operativo | ${rancho}`}
      codigoFmt={codigoFmt}
      folio={folioDisplay}
      emision={emision}
      tituloDatos="1. DATOS DEL SITIO Y JORNADA"
      camposDatos={[
        { icono: 'ubicacion', etiqueta: terminoSitio, valor: rancho },
        { icono: 'codigo', etiqueta: 'Código', valor: ranchoCodigo || '—' },
        { icono: 'calendario', etiqueta: 'Fecha de registro', valor: formatFechaPDF(fecha) },
        { etiqueta: 'Total liberaciones', valor: String(liberaciones.length) },
      ]}
    >
      <Seccion titulo="2. REGISTRO DE LIBERACIONES">
        <TablaDatos
          columnas={COLS}
          fuente={7}
          fuenteEnc={6}
          vacio="Sin liberaciones registradas"
          filas={liberaciones.map((lib) => [
            fecha,
            lib.sector ?? '—',
            lib.cantidad_bandejas != null ? String(lib.cantidad_bandejas) : '—',
            siNoCelda(lib.lote_liberado),
            lib.numero_comprobante ?? '—',
            lib.codigo_trazabilidad ?? '—',
            lib.marca_embalaje ?? '—',
            lib.destino_final ?? '—',
            lib.fruta_proceso_kg != null ? lib.fruta_proceso_kg.toString() : '—',
            lib.encargado_nombre ?? '—',
            siNoCelda(lib.verificacion_semanal),
            formatObservaciones(lib.hora_inicio_cosecha, lib.hora_fin_cosecha, lib.observaciones),
          ])}
        />
      </Seccion>

      <View wrap={false}>
        <Seccion titulo="3. FIRMAS Y RESPONSABLES">
          <PdfFirmas
            signatures={[
              { label: 'Responsable que realizó el registro', nombre: '', caption: 'Realizó — Firma', firma: firmaRealizo ?? null },
              { label: '', nombre: '', caption: 'Responsable de Inocuidad — Verificó', firma: firmaVerifico ?? null },
            ]}
          />
        </Seccion>
      </View>
    </PaginaEstandar>
  )
}

// ── CosechaLiberacionPDF ──────────────────────────────────────────────────────

export function CosechaLiberacionPDF(props: CosechaLiberacionPaginaProps) {
  return (
    <Document
      title={`Cosecha y Liberacion ${props.fecha}`}
      author="M.A.D.Y."
      creator="M.A.D.Y. Inocuidad Inteligente"
      producer="M.A.D.Y. Inocuidad Inteligente"
      subject={`Registro de Cosecha y Liberación — ${props.rancho}`}
      keywords="MADY, inocuidad, cosecha, liberacion"
    >
      <CosechaLiberacionPagina {...props} />
    </Document>
  )
}

// ── CosechaLiberacionConsolidadoPDF ──────────────────────────────────────────

export function CosechaLiberacionConsolidadoPDF({
  registros, ranchoNombre, desde, hasta,
}: CosechaLiberacionConsolidadoPDFProps) {
  return (
    <Document
      title={`Cosecha y Liberacion Consolidado ${ranchoNombre} ${desde} ${hasta}`}
      author="M.A.D.Y."
      creator="M.A.D.Y. Inocuidad Inteligente"
      producer="M.A.D.Y. Inocuidad Inteligente"
      subject="Registro Consolidado de Cosecha y Liberación"
      keywords="MADY, inocuidad, cosecha, liberacion, consolidado"
    >
      {registros.map((reg, i) => (
        <CosechaLiberacionPagina key={i} {...reg} />
      ))}
    </Document>
  )
}
