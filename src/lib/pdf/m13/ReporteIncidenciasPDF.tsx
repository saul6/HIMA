// PATRÓN INOCUIDAD — PDF M13 (rediseño minimalista de alto contraste)
// Reporte visual con fotos: tabla dos columnas EVIDENCIA | INCIDENCIAS, A4 portrait.
// Las fotos se reciben como data URIs base64 (ya descargadas y re-comprimidas).
// Helvetica built-in, sin Unicode; los iconos son vectores (Svg). Firmas digitales
// vía PdfSignaturesM13 (en blanco si no hay). Los saltos de página se calculan
// antes de dibujar (planificarIncidencias.ts).

import { Document, Page, View, Text, Image, Svg, Path, Rect, Circle, StyleSheet } from '@react-pdf/renderer'
import type { ReactNode } from 'react'
import { LOGO_MADY_PDF } from '@/lib/pdf/assets/logoMadyPdf'
import { PC } from '@/lib/pdf/components/tokens'
import type { FirmaParaPdf, FirmaEnteradoParaPdf } from '@/hooks/useFirmasRegistro'
import { partirPalabraLarga } from '@/lib/pdf/components/texto'
import { PdfSignaturesM13 } from './PdfSignaturesM13'
import {
  planificarIncidencias, COL_EVIDENCIA, PAD_CELDA, FOTO_W, GAP_FOTOS, type BloquePlan,
} from './planificarIncidencias'

// ── Tipos ─────────────────────────────────────────────────────────────────────

export interface IncidenciaPDFRow {
  orden: number
  descripcion: string
  dataUris: string[]  // data URIs base64; '' = foto que fallo (celda en blanco)
}

export interface ReporteIncidenciasPDFProps {
  folio: string
  rancho: string
  ranchoCodigo: string
  fecha: string
  auditorNombre: string | null
  incidencias: IncidenciaPDFRow[]
  codigoClave?: string
  terminoSitio?: string
  firmaRealizo?: FirmaParaPdf | null
  firmaVerifico?: FirmaParaPdf | null
  firmaEnterado?: FirmaEnteradoParaPdf | null
}

const PAD_TOP = 40        // reserva el encabezado compacto de las páginas 2+
const PAD_TOP_P1 = 40      // la página 1 arranca a 40 pt (margen del diseño)

// ── Estilos ───────────────────────────────────────────────────────────────────

const s = StyleSheet.create({
  page: {
    fontFamily: 'Helvetica',
    fontSize: 9,
    color: PC.m13Texto,
    paddingTop: PAD_TOP,
    paddingBottom: 56,
    paddingLeft: 40,
    paddingRight: 40,
    backgroundColor: PC.white,
  },
  card: {
    flexDirection: 'row',
    borderWidth: 0.75,
    borderColor: PC.border,
    borderRadius: 6,
    marginBottom: 8,
    overflow: 'hidden',
  },
  cellEvidencia: {
    width: COL_EVIDENCIA,
    padding: PAD_CELDA,
    alignItems: 'center',
    borderRightWidth: 0.75,
    borderRightColor: PC.border,
  },
  cellIncidencia: {
    flex: 1,
    flexDirection: 'row',
  },
  barraMenta: { width: 2.5, backgroundColor: PC.m13Menta },
  contenidoIncidencia: { flex: 1, padding: PAD_CELDA, paddingLeft: 10 },
  pildora: {
    alignSelf: 'flex-start',
    backgroundColor: PC.m13MentaSuave,
    color: PC.m13Navy,
    fontFamily: 'Helvetica-Bold',
    fontSize: 7,
    paddingTop: 2,
    paddingBottom: 2,
    paddingLeft: 7,
    paddingRight: 7,
    borderRadius: 8,
    marginBottom: 6,
  },
  descripcion: { fontSize: 9, color: PC.m13Texto, lineHeight: 1.4 },
  fotoBase: { borderRadius: 4, borderWidth: 0.5, borderColor: PC.border },
  encTabla: { flexDirection: 'row', height: 22, marginBottom: 6 },
  encCelda: {
    flexDirection: 'row',
    alignItems: 'center',
    height: 22,
    paddingLeft: PAD_CELDA,
    borderBottomWidth: 1,
    borderBottomColor: PC.m13Navy,
  },
  encTexto: { fontFamily: 'Helvetica-Bold', fontSize: 8, color: PC.m13Navy, marginLeft: 5 },
})

// ── Iconos vectoriales (viewBox 24, trazo navy) ───────────────────────────────

type IconoNombre = 'usuario' | 'folio' | 'calendario' | 'codigo' | 'imagen' | 'alerta'

function Icono({ nombre, size = 11, color = PC.m13Navy }: { nombre: IconoNombre; size?: number; color?: string }) {
  const p = { stroke: color, strokeWidth: 2, fill: 'none', strokeLinecap: 'round', strokeLinejoin: 'round' } as const
  let cuerpo: ReactNode
  switch (nombre) {
    case 'usuario':
      cuerpo = (<><Circle cx={12} cy={8} r={4} {...p} /><Path d="M4 21 C4 16 8 14 12 14 C16 14 20 16 20 21" {...p} /></>)
      break
    case 'folio':
      cuerpo = (<><Rect x={5} y={3} width={14} height={18} rx={2} {...p} /><Path d="M9 8 H15 M9 12 H15 M9 16 H13" {...p} /></>)
      break
    case 'calendario':
      cuerpo = (<><Rect x={3} y={5} width={18} height={16} rx={2} {...p} /><Path d="M3 10 H21 M8 3 V7 M16 3 V7" {...p} /></>)
      break
    case 'codigo':
      cuerpo = (<Path d="M8 7 L3 12 L8 17 M16 7 L21 12 L16 17 M14 5 L10 19" {...p} />)
      break
    case 'imagen':
      cuerpo = (<><Rect x={3} y={4} width={18} height={16} rx={2} {...p} /><Circle cx={9} cy={10} r={1.8} {...p} /><Path d="M3 17 L9 12 L13 16 L16 13 L21 18" {...p} /></>)
      break
    case 'alerta':
      cuerpo = (<><Path d="M12 3 L22 20 H2 Z" {...p} /><Path d="M12 9 V14" {...p} /><Circle cx={12} cy={17} r={0.8} stroke={color} strokeWidth={1} fill={color} /></>)
      break
  }
  return <Svg viewBox="0 0 24 24" width={size} height={size}>{cuerpo}</Svg>
}

// ── Helpers ───────────────────────────────────────────────────────────────────

function formatFechaPDF(iso: string): string {
  try {
    return new Date(iso + 'T12:00:00').toLocaleDateString('es-MX', {
      day: '2-digit', month: 'short', year: 'numeric',
    })
  } catch { return iso }
}

// ── Piezas ────────────────────────────────────────────────────────────────────

function CeldaEncabezado({ ancho, icono, texto }: { ancho?: number; icono: IconoNombre; texto: string }) {
  return (
    <View
      style={{
        width: ancho,
        flexGrow: ancho ? 0 : 1,
        flexDirection: 'row',
        alignItems: 'center',
        height: 22,
        paddingLeft: ancho ? PAD_CELDA : 12,
        borderBottomWidth: 1,
        borderBottomColor: PC.m13Navy,
      }}
    >
      <Icono nombre={icono} />
      <Text style={{ fontFamily: 'Helvetica-Bold', fontSize: 8, color: PC.m13Navy, marginLeft: 5 }}>{texto}</Text>
    </View>
  )
}

function EncabezadoTabla() {
  return (
    <View style={{ flexDirection: 'row', height: 22, marginBottom: 6 }}>
      <CeldaEncabezado ancho={COL_EVIDENCIA} icono="imagen" texto="EVIDENCIA" />
      <CeldaEncabezado icono="alerta" texto="INCIDENCIAS" />
    </View>
  )
}

// Versión sin Svg ni filas anidadas: dentro del `render` de un elemento fixed
// react-pdf no calcula bien el layout de Svg ni de filas con celdas anidadas.
function EncabezadoCompacto({ folio }: { folio: string }) {
  const th = {
    fontFamily: 'Helvetica-Bold',
    fontSize: 8,
    color: PC.m13Navy,
    paddingTop: 6,
    paddingBottom: 5,
    borderBottomWidth: 1,
    borderBottomColor: PC.m13Navy,
  } as const
  return (
    <View>
      <View style={{ flexDirection: 'row', justifyContent: 'space-between', paddingBottom: 6 }}>
        <View>
          <Text style={{ fontFamily: 'Helvetica-Bold', fontSize: 11, color: PC.m13Navy }}>REPORTE DE INCIDENCIAS</Text>
          <Text style={{ fontSize: 7, color: PC.textSub, marginTop: 1 }}>Folio: {folio}</Text>
        </View>
        <Image src={LOGO_MADY_PDF} style={{ height: 22, width: 61 }} />
      </View>
      <View style={{ borderTopWidth: 0.75, borderTopColor: PC.border, marginBottom: 8 }} />
      <View style={{ flexDirection: 'row', marginBottom: 6 }}>
        <Text style={{ ...th, width: COL_EVIDENCIA, paddingLeft: PAD_CELDA }}>EVIDENCIA</Text>
        <Text style={{ ...th, flexGrow: 1, paddingLeft: 12 }}>INCIDENCIAS</Text>
      </View>
    </View>
  )
}

function DatoFranja({ icono, etiqueta, valor, primero }: { icono: IconoNombre; etiqueta: string; valor: string; primero?: boolean }) {
  return (
    <View
      style={{
        flex: 1,
        paddingLeft: primero ? 0 : 10,
        paddingRight: 6,
        borderLeftWidth: primero ? 0 : 0.75,
        borderLeftColor: PC.border,
      }}
    >
      <View style={{ flexDirection: 'row', alignItems: 'center', marginBottom: 3 }}>
        <Icono nombre={icono} size={10} />
        <Text style={{ fontSize: 7, color: PC.textSub, marginLeft: 4 }}>{etiqueta}</Text>
      </View>
      <Text style={{ fontFamily: 'Helvetica-Bold', fontSize: 9, color: PC.m13Navy }} hyphenationCallback={partirPalabraLarga}>
        {valor}
      </Text>
    </View>
  )
}

function Tarjeta({ b }: { b: BloquePlan }) {
  return (
    <View style={s.card} wrap={b.noPartir ? false : undefined}>
      <View style={s.cellEvidencia}>
        {b.fotos.map((f, i) => {
          const w = FOTO_W * b.escala
          const estilo = { ...s.fotoBase, width: w, height: w * f.ratio, marginTop: i === 0 ? 0 : GAP_FOTOS }
          return f.uri
            ? <Image key={i} src={f.uri} style={{ ...estilo, objectFit: 'contain' }} />
            : <View key={i} style={{ ...estilo, backgroundColor: '#F0F0F0' }} />
        })}
      </View>
      <View style={s.cellIncidencia}>
        <View style={s.barraMenta} />
        <View style={s.contenidoIncidencia}>
          <Text style={s.pildora}>{b.continua ? `Incidencia ${b.orden} (continúa)` : `Incidencia ${b.orden}`}</Text>
          {b.conTexto && (
            <Text style={s.descripcion} hyphenationCallback={partirPalabraLarga}>{b.descripcion}</Text>
          )}
        </View>
      </View>
    </View>
  )
}

function PieM13() {
  return (
    <>
      {/* Isotipo tenue en la esquina inferior derecha, en el margen (no tapa la paginación) */}
      <Image
        fixed
        src={LOGO_MADY_PDF}
        style={{ position: 'absolute', bottom: 2, right: 6, width: 42, height: 15, opacity: 0.08 }}
      />
      <View
        fixed
        style={{
          position: 'absolute',
          bottom: 18,
          left: 40,
          right: 40,
          borderTopWidth: 0.75,
          borderTopColor: PC.border,
          paddingTop: 5,
          flexDirection: 'row',
          alignItems: 'center',
        }}
      >
        <Text style={{ flex: 1, fontSize: 7, color: PC.footerGray }}>M13</Text>
        <View style={{ flexDirection: 'row', alignItems: 'center' }}>
          <Text style={{ fontSize: 7, fontFamily: 'Helvetica-Bold', color: PC.m13Navy }}>M.A.D.Y.</Text>
          <View style={{ width: 0.75, height: 8, backgroundColor: PC.border, marginLeft: 6, marginRight: 6 }} />
          <Text style={{ fontSize: 7, color: PC.textSub }}>Inocuidad Inteligente</Text>
        </View>
        <Text
          style={{ flex: 1, fontSize: 7, color: PC.footerGray, textAlign: 'right' }}
          render={({ pageNumber, totalPages }) => `Página ${pageNumber} de ${totalPages}`}
        />
      </View>
    </>
  )
}

// ── Componente de pagina ──────────────────────────────────────────────────────

export function ReporteIncidenciasPagina({
  folio,
  rancho,
  ranchoCodigo,
  fecha,
  auditorNombre,
  incidencias,
  codigoClave = 'MXA',
  terminoSitio = 'Rancho',
  firmaRealizo,
  firmaVerifico,
  firmaEnterado,
}: ReporteIncidenciasPDFProps) {
  const fechaFormateada = formatFechaPDF(fecha)
  const codigoFmt = `${codigoClave}-F-SC-SIG`
  const bloques = planificarIncidencias(incidencias)

  return (
    <Page size="A4" style={s.page}>

      {/* Encabezado compacto: solo páginas 2+ de este reporte (subPageNumber, no el global) */}
      <View
        fixed
        style={{}}
        render={({ subPageNumber }) => (subPageNumber > 1 ? <EncabezadoCompacto folio={folio} /> : <View />)}
      />

      <PieM13 />

      {/* Encabezado de la página 1 (a 40 pt: compensa el paddingTop reservado para el compacto) */}
      <View style={{ marginTop: PAD_TOP_P1 - PAD_TOP }}>
        <View style={{ flexDirection: 'row', alignItems: 'flex-start', justifyContent: 'space-between' }}>
          <View style={{ flex: 1, paddingRight: 12 }}>
            <View style={{ width: 28, height: 3, backgroundColor: PC.m13Menta, marginBottom: 8 }} />
            <Text style={{ fontFamily: 'Helvetica-Bold', fontSize: 20, color: PC.m13Navy }}>REPORTE DE INCIDENCIAS</Text>
            <Text style={{ fontSize: 8, color: PC.textSub, marginTop: 4 }} hyphenationCallback={partirPalabraLarga}>
              Reporte visual · {terminoSitio}: {rancho}{ranchoCodigo ? ` (${ranchoCodigo})` : ''}
            </Text>
          </View>
          <Image src={LOGO_MADY_PDF} style={{ height: 36, width: 101 }} />
        </View>
        <View style={{ borderTopWidth: 0.75, borderTopColor: PC.border, marginTop: 10, marginBottom: 10 }} />

        {/* Franja de datos */}
        <View style={{ flexDirection: 'row', backgroundColor: PC.m13Fondo, borderRadius: 6, padding: 10, marginBottom: 16 }}>
          <DatoFranja primero icono="usuario" etiqueta="Realizó el recorrido" valor={auditorNombre ?? '—'} />
          <DatoFranja icono="folio" etiqueta="Folio" valor={folio} />
          <DatoFranja icono="calendario" etiqueta="Fecha" valor={fechaFormateada} />
          <DatoFranja icono="codigo" etiqueta="Código" valor={codigoFmt} />
        </View>

        {/* Título de sección */}
        <View style={{ flexDirection: 'row', alignItems: 'center', marginBottom: 8 }}>
          <View style={{ width: 3, height: 14, backgroundColor: PC.m13Menta, marginRight: 7 }} />
          <Text style={{ fontFamily: 'Helvetica-Bold', fontSize: 10, color: PC.m13Navy }}>REGISTRO DE INCIDENCIAS</Text>
        </View>
        <EncabezadoTabla />
      </View>

      {/* Tarjetas de incidencias */}
      {bloques.map((b) => <Tarjeta key={b.key} b={b} />)}

      {/* Firmas digitales; en blanco para firma a mano si no existen */}
      <PdfSignaturesM13
        signatures={[
          {
            label: 'Realizo el recorrido',
            nombre: auditorNombre ?? '',
            caption: 'Realizo - Firma',
            firma: firmaRealizo ?? null,
          },
          {
            label: '',
            nombre: '',
            caption: 'Responsable de Inocuidad - Firma',
            firma: firmaVerifico ?? null,
          },
        ]}
        enterado={firmaEnterado ?? null}
      />

    </Page>
  )
}

// ── Documento individual ───────────────────────────────────────────────────────

export function ReporteIncidenciasPDF(props: ReporteIncidenciasPDFProps) {
  return (
    <Document
      title={`Reporte de Incidencias ${props.fecha}`}
      author="M.A.D.Y."
      creator="M.A.D.Y. Inocuidad Inteligente"
      producer="M.A.D.Y. Inocuidad Inteligente"
      subject={`Reporte de Incidencias — ${props.rancho}`}
      keywords="MADY, inocuidad, incidencias, reporte"
    >
      <ReporteIncidenciasPagina {...props} />
    </Document>
  )
}

// ── Documento consolidado (multiples reportes) ────────────────────────────────

export function ReporteIncidenciasConsolidadoPDF({
  reportes,
}: {
  reportes: ReporteIncidenciasPDFProps[]
}) {
  return (
    <Document
      title="Reporte de Incidencias Consolidado"
      author="M.A.D.Y."
      creator="M.A.D.Y. Inocuidad Inteligente"
      producer="M.A.D.Y. Inocuidad Inteligente"
      subject="Reporte Consolidado de Incidencias"
      keywords="MADY, inocuidad, incidencias, consolidado"
    >
      {reportes.map((r, i) => (
        <ReporteIncidenciasPagina key={i} {...r} />
      ))}
    </Document>
  )
}
