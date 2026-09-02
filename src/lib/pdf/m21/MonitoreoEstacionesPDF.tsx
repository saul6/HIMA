// PATRÓN INOCUIDAD — PDF M21 (plantilla homogénea M.A.D.Y)
// Revisión de Estaciones de Monitoreo de Plagas — A4 landscape.
// Formato F-FRUS-CAL-19 Rev 01. Helvetica. Sin Unicode.
// Una firma en blanco. PdfLegend al pie.

import { Document, Page, View, Text } from '@react-pdf/renderer'
import { TopBar, PdfFooter } from '@/lib/pdf/components/PdfPage'
import { PdfHeader } from '@/lib/pdf/components/PdfHeader'
import { PdfSectionBanner } from '@/lib/pdf/components/PdfSectionBanner'
import { PdfFieldGrid, PdfFieldRow, PdfField } from '@/lib/pdf/components/PdfFieldGrid'
import { PdfSignatures } from '@/lib/pdf/components/PdfSignatures'
import { PdfLegend } from '@/lib/pdf/components/PdfLegend'
import { PC } from '@/lib/pdf/components/tokens'

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
}

export interface MonitoreoEstacionesConsolidadoPDFProps {
  revisiones: MonitoreoEstacionesPaginaProps[]
  instalacionNombre: string
  desde: string
  hasta: string
}

// ── Colores locales ───────────────────────────────────────────────────────────

const HALLAZGO_BG   = '#FAECE7'
const HALLAZGO_TEXT = '#993C1D'
const ROW_ALT       = '#F5F9FE'

// ── Helpers ───────────────────────────────────────────────────────────────────

function formatFechaPDF(iso: string): string {
  try {
    return new Date(iso + 'T12:00:00').toLocaleDateString('es-MX', {
      weekday: 'long', year: 'numeric', month: 'long', day: 'numeric',
    })
  } catch { return iso }
}

export function labelDesde(codigo: string, catalogo: CatalogoCodigo[]): string {
  return catalogo.find((c) => c.codigo === codigo)?.label ?? codigo
}

// ── Estilos de tabla compartidos ──────────────────────────────────────────────

const thCell = {
  color: PC.white,
  fontFamily: 'Helvetica-Bold' as const,
  fontSize: 7,
  paddingTop: 4,
  paddingBottom: 4,
  paddingLeft: 5,
  paddingRight: 5,
  borderRightWidth: 1,
  borderRightColor: '#5599CC',
  borderBottomWidth: 1,
  borderBottomColor: '#5599CC',
  textAlign: 'center' as const,
}

const tdCell = {
  borderRightWidth: 1,
  borderRightColor: PC.border,
  paddingTop: 3,
  paddingBottom: 3,
  paddingLeft: 5,
  paddingRight: 5,
  fontSize: 7,
  color: PC.fieldValue,
}

const tableWrap = {
  borderLeftWidth: 1,
  borderLeftColor: PC.border,
  borderTopWidth: 1,
  borderTopColor: PC.border,
}

const tableRow = {
  flexDirection: 'row' as const,
  borderBottomWidth: 1,
  borderBottomColor: PC.border,
}

// ── Encabezados de columnas por tipo de trampa ────────────────────────────────

function EncabezadoCeboInteriorMecanica() {
  return (
    <View style={{ flexDirection: 'row', backgroundColor: PC.section }}>
      <Text style={[thCell, { width: 40 }]}>No.</Text>
      <Text style={[thCell, { flex: 1 }]}>Tipo de consumo</Text>
      <Text style={[thCell, { flex: 1 }]}>Estado de la trampa</Text>
      <Text style={[thCell, { width: 60 }]}>Condiciones</Text>
      <Text style={[thCell, { width: 65 }]}>Senalizacion</Text>
      <Text style={[thCell, { width: 50, borderRightWidth: 0 }]}>Hallazgo</Text>
    </View>
  )
}

function EncabezadoLuz() {
  return (
    <View style={{ flexDirection: 'row', backgroundColor: PC.section }}>
      <Text style={[thCell, { width: 40 }]}>No.</Text>
      <Text style={[thCell, { flex: 1 }]}>Estado del equipo</Text>
      <Text style={[thCell, { flex: 1 }]}>Estado de la lampara</Text>
      <Text style={[thCell, { flex: 2 }]}>Plaga detectada</Text>
      <Text style={[thCell, { width: 50, borderRightWidth: 0 }]}>Hallazgo</Text>
    </View>
  )
}

// ── Filas de datos ────────────────────────────────────────────────────────────

function FilaCeboInteriorMecanica({
  est, index, catalogoEstado, catalogoCondiciones,
}: { est: EstacionResultadoPDF; index: number; catalogoEstado: CatalogoCodigo[]; catalogoCondiciones: CatalogoCodigo[] }) {
  const bg = index % 2 === 1 ? ROW_ALT : PC.white
  return (
    <View style={[tableRow, { backgroundColor: bg }]}>
      <Text style={[tdCell, { width: 40 }]}>{est.numero}</Text>
      <Text style={[tdCell, { flex: 1 }]}>{est.tipo_consumo ?? ''}</Text>
      <Text style={[tdCell, { flex: 1 }]}>
        {est.estado_trampa ? labelDesde(est.estado_trampa, catalogoEstado) : ''}
      </Text>
      <Text style={[tdCell, { width: 60 }]}>
        {est.condiciones ? labelDesde(est.condiciones, catalogoCondiciones) : ''}
      </Text>
      <Text style={[tdCell, { width: 65 }]}>{est.senalizacion ?? ''}</Text>
      <Text style={[tdCell, { width: 50, borderRightWidth: 0, textAlign: 'center',
        ...(est.tiene_hallazgo ? { backgroundColor: HALLAZGO_BG, color: HALLAZGO_TEXT, fontFamily: 'Helvetica-Bold' } : {}) }]}>
        {est.tiene_hallazgo ? 'Si' : ''}
      </Text>
    </View>
  )
}

function FilaLuz({
  est, index, catalogoEstado, catalogoPlagas,
}: { est: EstacionResultadoPDF; index: number; catalogoEstado: CatalogoCodigo[]; catalogoPlagas: CatalogoCodigo[] }) {
  const bg = index % 2 === 1 ? ROW_ALT : PC.white
  const plagasLabel = (est.plaga_detectada ?? []).map((c) => labelDesde(c, catalogoPlagas)).join(', ')
  return (
    <View style={[tableRow, { backgroundColor: bg }]}>
      <Text style={[tdCell, { width: 40 }]}>{est.numero}</Text>
      <Text style={[tdCell, { flex: 1 }]}>
        {est.estado_equipo ? labelDesde(est.estado_equipo, catalogoEstado) : ''}
      </Text>
      <Text style={[tdCell, { flex: 1 }]}>
        {est.estado_lampara ? labelDesde(est.estado_lampara, catalogoEstado) : ''}
      </Text>
      <Text style={[tdCell, { flex: 2 }]}>{plagasLabel}</Text>
      <Text style={[tdCell, { width: 50, borderRightWidth: 0, textAlign: 'center',
        ...(est.tiene_hallazgo ? { backgroundColor: HALLAZGO_BG, color: HALLAZGO_TEXT, fontFamily: 'Helvetica-Bold' } : {}) }]}>
        {est.tiene_hallazgo ? 'Si' : ''}
      </Text>
    </View>
  )
}

function FilaVacia() {
  return (
    <View style={[tableRow]}>
      <Text style={[tdCell, { flex: 1, borderRightWidth: 0, color: PC.textSub }]}>
        Sin estaciones registradas
      </Text>
    </View>
  )
}

// ── MonitoreoEstacionesPagina ─────────────────────────────────────────────────

export function MonitoreoEstacionesPagina({
  folio, instalacion, instalacionCodigo, fecha, inspector, observaciones,
  grupos, catalogoEstado, catalogoCondiciones, catalogoPlagas,
  codigoClave = 'MXA', terminoSitio = 'Instalación',
}: MonitoreoEstacionesPaginaProps) {
  const emision = new Date().toLocaleDateString('es-MX')
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
    <Page
      size="A4"
      orientation="landscape"
      style={{ fontFamily: 'Helvetica', fontSize: 8, padding: 36, paddingBottom: 55, backgroundColor: PC.white }}
    >
      <PdfFooter moduloCodigo="M21" />

      <TopBar />

      <PdfHeader
        titulo="REVISIÓN DE ESTACIONES DE MONITOREO DE PLAGAS"
        subtitulo={`Formato operativo | ${instalacion}`}
        codigoFormato={codigoFmt}
        folio={folio}
        fecha={emision}
      />

      <PdfSectionBanner>1. Datos del sitio y fecha</PdfSectionBanner>
      <PdfFieldGrid>
        <PdfFieldRow>
          <PdfField label={terminoSitio} value={instalacion} />
          <PdfField label="Código" value={instalacionCodigo || '—'} />
          <PdfField label="Fecha de revisión" value={formatFechaPDF(fecha)} />
          <PdfField label="Inspector" value={inspector ?? '—'} />
        </PdfFieldRow>
      </PdfFieldGrid>

      {/* Tablas por tipo de trampa */}
      {grupos.map((grupo) => (
        <View key={grupo.tipo_trampa}>
          <PdfSectionBanner>{grupo.label.toUpperCase()}</PdfSectionBanner>
          <View style={tableWrap}>
            {grupo.tipo_trampa === 'luz' ? (
              <>
                <EncabezadoLuz />
                {grupo.estaciones.length === 0 ? <FilaVacia /> : grupo.estaciones.map((est, i) => (
                  <FilaLuz key={est.numero} est={est} index={i} catalogoEstado={catalogoEstado} catalogoPlagas={catalogoPlagas} />
                ))}
              </>
            ) : (
              <>
                <EncabezadoCeboInteriorMecanica />
                {grupo.estaciones.length === 0 ? <FilaVacia /> : grupo.estaciones.map((est, i) => (
                  <FilaCeboInteriorMecanica key={est.numero} est={est} index={i} catalogoEstado={catalogoEstado} catalogoCondiciones={catalogoCondiciones} />
                ))}
              </>
            )}
          </View>
        </View>
      ))}

      {/* Observaciones */}
      {observaciones && observaciones.trim() !== '' && (
        <>
          <PdfSectionBanner>Observaciones</PdfSectionBanner>
          <View style={{
            borderLeftWidth: 1, borderLeftColor: PC.border,
            borderRightWidth: 1, borderRightColor: PC.border,
            borderBottomWidth: 1, borderBottomColor: PC.border,
            paddingTop: 5, paddingBottom: 5, paddingLeft: 6, paddingRight: 6,
            minHeight: 24,
          }}>
            <Text style={{ fontSize: 8, color: PC.fieldValue, lineHeight: 1.4 }}>{observaciones}</Text>
          </View>
        </>
      )}

      {/* Leyenda */}
      <PdfLegend entradas={leyendaEntradas} />

      {/* Firma */}
      <PdfSignatures
        signatures={[
          { label: '', nombre: '', caption: `Firma del Responsable del ${terminoSitio}` },
        ]}
      />
    </Page>
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
