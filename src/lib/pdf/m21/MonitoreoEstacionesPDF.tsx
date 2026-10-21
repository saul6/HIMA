// PATRÓN INOCUIDAD — PDF M21 (plantilla homogénea M.A.D.Y)
// Revisión de Estaciones de Monitoreo de Plagas — A4 landscape.
// Formato F-FRUS-CAL-19 Rev 01. Helvetica. Sin Unicode.
// Una firma en blanco. PdfLegend al pie.

import { Document } from '@react-pdf/renderer'
import { PaginaEstandar, Seccion, fechaEmisionHoy } from '@/lib/pdf/disenoNuevo/PaginaEstandar'
import { FranjaDatos } from '@/lib/pdf/disenoNuevo/Franja'
import { TablaDatos, type ColumnaDato, type CeldaDato } from '@/lib/pdf/disenoNuevo/TablaDatos'
import { Leyenda } from '@/lib/pdf/disenoNuevo/Leyenda'
import { PdfFirmas } from '@/lib/pdf/disenoNuevo/PdfFirmas'
import { PC } from '@/lib/pdf/components/tokens'
import type { FirmaParaPdf } from '@/hooks/useFirmasRegistro'
import { fechaPdf } from '@/lib/pdf/disenoNuevo/fechas'

// ── Tipos ─────────────────────────────────────────────────────────────────────

export interface CatalogoCodigo {
  codigo: string
  label: string
}

export interface EstacionResultadoPDF {
  numero: string
  // Para cebo / interior / mecanica / pegamento
  tipo_consumo?: string | null
  estado_trampa?: string | null   // código
  condiciones?: string | null     // código
  senalizacion?: string | null
  // Para luz
  estado_equipo?: string | null
  estado_lampara?: string | null
  plaga_detectada?: string[]      // códigos
  tiene_hallazgo: boolean
}

export interface GrupoEstacionesPDF {
  tipo_trampa: 'cebo' | 'interior' | 'mecanica' | 'pegamento' | 'luz'
  label: string
  estaciones: EstacionResultadoPDF[]
}

export interface MonitoreoEstacionesPaginaProps {
  folio: string
  instalacion: string
  instalacionCodigo: string
  fecha: string
  inspector: string | null
  observaciones: string | null
  grupos: GrupoEstacionesPDF[]
  catalogoEstado: CatalogoCodigo[]
  catalogoCondiciones: CatalogoCodigo[]
  catalogoPlagas: CatalogoCodigo[]
  codigoClave?: string
  terminoSitio?: string
  firmaRealizo?: FirmaParaPdf | null
  firmaVerifico?: FirmaParaPdf | null
}

export interface MonitoreoEstacionesConsolidadoPDFProps {
  revisiones: MonitoreoEstacionesPaginaProps[]
  instalacionNombre: string
  desde: string
  hasta: string
}

// ── Helpers ───────────────────────────────────────────────────────────────────

function formatFechaPDF(iso: string): string {
  try {
    return fechaPdf(iso, {
      weekday: 'long', year: 'numeric', month: 'long', day: 'numeric',
    })
  } catch { return iso }
}

export function labelDesde(codigo: string, catalogo: CatalogoCodigo[]): string {
  return catalogo.find((c) => c.codigo === codigo)?.label ?? codigo
}

// ── Columnas por tipo de trampa ───────────────────────────────────────────────

const COLS_GENERAL: ColumnaDato[] = [
  { texto: 'No.', ancho: 40 },
  { texto: 'Tipo de consumo', ancho: 120 },
  { texto: 'Estado de la trampa', ancho: 120 },
  { texto: 'Condiciones', ancho: 60 },
  { texto: 'Señalización', ancho: 65 },
  { texto: 'Hallazgo', ancho: 50, align: 'center' },
]

const COLS_LUZ: ColumnaDato[] = [
  { texto: 'No.', ancho: 40 },
  { texto: 'Estado del equipo', ancho: 120 },
  { texto: 'Estado de la lampara', ancho: 120 },
  { texto: 'Plaga detectada', ancho: 240 },
  { texto: 'Hallazgo', ancho: 50, align: 'center' },
]

// Hallazgo: Si en rojo suave (el texto no cambia)
const hallazgo = (v: boolean): CeldaDato => (v ? { texto: 'Si', color: PC.negativo, negrita: true } : '')

// ── MonitoreoEstacionesPagina ─────────────────────────────────────────────────

export function MonitoreoEstacionesPagina({
  folio, instalacion, instalacionCodigo, fecha, inspector, observaciones,
  grupos, catalogoEstado, catalogoCondiciones, catalogoPlagas,
  codigoClave = 'MXA', terminoSitio = 'Instalación',
  firmaRealizo, firmaVerifico,
}: MonitoreoEstacionesPaginaProps) {
  const emision = fechaEmisionHoy()
  const codigoFmt = `${codigoClave}-F-SC-SIG`

  const leyendaEntradas = [
    {
      titulo: 'Estado de la trampa',
      items: catalogoEstado.map(c => ({ codigo: c.codigo, label: c.label })),
    },
    {
      titulo: 'Condiciones',
      items: catalogoCondiciones.map(c => ({ codigo: c.codigo, label: c.label })),
    },
    {
      titulo: 'Plagas',
      items: catalogoPlagas.map(c => ({ codigo: c.codigo, label: c.label })),
    },
  ]

  return (
    <PaginaEstandar
      titulo="REVISIÓN DE ESTACIONES DE MONITOREO DE PLAGAS"
      subtitulo={`Formato operativo | ${instalacion}`}
      codigoFmt={codigoFmt}
      folio={folio}
      emision={emision}
      tituloDatos="1. DATOS DEL SITIO Y FECHA"
      camposDatos={[
        { icono: 'ubicacion', etiqueta: terminoSitio, valor: instalacion },
        { icono: 'codigo', etiqueta: 'Código', valor: instalacionCodigo || '—' },
        { icono: 'calendario', etiqueta: 'Fecha de revisión', valor: formatFechaPDF(fecha) },
        { icono: 'usuario', etiqueta: 'Inspector', valor: inspector ?? '—' },
      ]}
    >
      {/* Tablas por tipo de trampa */}
      {grupos.map((grupo) => (
        <Seccion key={grupo.tipo_trampa} titulo={grupo.label.toUpperCase()}>
          {grupo.tipo_trampa === 'luz' ? (
            <TablaDatos
              columnas={COLS_LUZ}
              vacio="Sin estaciones registradas"
              fuente={7}
              filas={grupo.estaciones.map((est) => [
                est.numero,
                est.estado_equipo ? labelDesde(est.estado_equipo, catalogoEstado) : '',
                est.estado_lampara ? labelDesde(est.estado_lampara, catalogoEstado) : '',
                (est.plaga_detectada ?? []).map((c) => labelDesde(c, catalogoPlagas)).join(', '),
                hallazgo(est.tiene_hallazgo),
              ])}
            />
          ) : (
            <TablaDatos
              columnas={COLS_GENERAL}
              vacio="Sin estaciones registradas"
              fuente={7}
              filas={grupo.estaciones.map((est) => [
                est.numero,
                est.tipo_consumo ?? '',
                est.estado_trampa ? labelDesde(est.estado_trampa, catalogoEstado) : '',
                est.condiciones ? labelDesde(est.condiciones, catalogoCondiciones) : '',
                est.senalizacion ?? '',
                hallazgo(est.tiene_hallazgo),
              ])}
            />
          )}
        </Seccion>
      ))}

      {/* Observaciones */}
      {observaciones && observaciones.trim() !== '' && (
        <Seccion titulo="OBSERVACIONES">
          <FranjaDatos campos={[{ etiqueta: '', valor: observaciones }]} />
        </Seccion>
      )}

      {/* Leyenda */}
      <Leyenda entradas={leyendaEntradas} />

      {/* Firma */}
      <PdfFirmas
        signatures={[
          { label: '', nombre: '', caption: `Firma del Responsable del ${terminoSitio}`, firma: firmaRealizo ?? null },
          { label: '', nombre: '', caption: 'Verificó — Firma', firma: firmaVerifico ?? null },
        ]}
      />
    </PaginaEstandar>
  )
}

// ── PDF individual ─────────────────────────────────────────────────────────────

export function MonitoreoEstacionesPDF(props: MonitoreoEstacionesPaginaProps) {
  return (
    <Document
      title={`Monitoreo de Plagas ${props.fecha}`}
      author="M.A.D.Y."
      creator="M.A.D.Y. Inocuidad Inteligente"
      producer="M.A.D.Y. Inocuidad Inteligente"
      subject={`Revisión de Estaciones de Monitoreo de Plagas — ${props.instalacion}`}
      keywords="MADY, inocuidad, monitoreo, plagas, estaciones"
    >
      <MonitoreoEstacionesPagina {...props} />
    </Document>
  )
}

// ── PDF consolidado ────────────────────────────────────────────────────────────

export function MonitoreoEstacionesConsolidadoPDF({
  revisiones, instalacionNombre, desde, hasta,
}: MonitoreoEstacionesConsolidadoPDFProps) {
  return (
    <Document
      title={`Monitoreo de Plagas Consolidado ${instalacionNombre} ${desde} ${hasta}`}
      author="M.A.D.Y."
      creator="M.A.D.Y. Inocuidad Inteligente"
      producer="M.A.D.Y. Inocuidad Inteligente"
      subject="Revisión de Estaciones de Monitoreo de Plagas — Consolidado"
      keywords="MADY, inocuidad, monitoreo, plagas, consolidado"
    >
      {revisiones.map((r, i) => (
        <MonitoreoEstacionesPagina key={i} {...r} />
      ))}
    </Document>
  )
}
