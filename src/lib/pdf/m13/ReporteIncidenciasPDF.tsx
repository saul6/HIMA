// PATRÓN INOCUIDAD — PDF M13 (rediseño minimalista de alto contraste)
// Reporte visual con fotos: tabla dos columnas EVIDENCIA | INCIDENCIAS, A4 portrait.
// Las fotos se reciben como data URIs base64 (ya descargadas y re-comprimidas).
// Helvetica built-in, sin Unicode; el diseño sale de lib/pdf/disenoNuevo (kit compartido). Firmas digitales
// vía PdfFirmas (en blanco si no hay). Los saltos de página se calculan
// antes de dibujar (planificarIncidencias.ts).

import { Document, Page, View, Text, Image, StyleSheet } from '@react-pdf/renderer'
import { PC } from '@/lib/pdf/components/tokens'
import type { FirmaParaPdf, FirmaEnteradoParaPdf } from '@/hooks/useFirmasRegistro'
import { partirParaAncho } from '@/lib/pdf/disenoNuevo/medirTexto'
import {
  EncabezadoPrimeraPagina, EncabezadoCompacto, estiloColumnaCompacta, FranjaDatos, TituloSeccion,
  EncabezadoTabla, MarcaDeAgua, Pie, PdfFirmas, estiloPagina,
} from '@/lib/pdf/disenoNuevo'
import {
  planificarIncidencias, altoUsadoPagina1, COL_EVIDENCIA, PAD_CELDA, FOTO_W, GAP_FOTOS, type BloquePlan,
} from './planificarIncidencias'
import { fechaPdf } from '@/lib/pdf/disenoNuevo/fechas'

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
  page: estiloPagina,
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

// ── Helpers ───────────────────────────────────────────────────────────────────

function formatFechaPDF(iso: string): string {
  try {
    return fechaPdf(iso, {
      day: '2-digit', month: 'short', year: 'numeric',
    })
  } catch { return iso }
}

// ── Piezas ────────────────────────────────────────────────────────────────────

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
            <Text style={s.descripcion} hyphenationCallback={partirParaAncho(288, 9)}>{b.texto ?? b.descripcion}</Text>
          )}
        </View>
      </View>
    </View>
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
  const bloques = planificarIncidencias(incidencias, altoUsadoPagina1(auditorNombre))

  return (
    <Page size="A4" style={s.page}>

      <MarcaDeAgua />

      {/* Encabezado compacto: solo páginas 2+ de este reporte (subPageNumber, no el global) */}
      <View
        fixed
        style={{}}
        render={({ subPageNumber }) => (subPageNumber > 1 ? (
          <EncabezadoCompacto
            titulo="REPORTE DE INCIDENCIAS"
            folio={folio}
            columnas={<>
              <Text style={{ ...estiloColumnaCompacta, width: COL_EVIDENCIA, paddingLeft: PAD_CELDA }}>EVIDENCIA</Text>
              <Text style={{ ...estiloColumnaCompacta, flexGrow: 1, paddingLeft: 12 }}>INCIDENCIAS</Text>
            </>}
          />
        ) : <View />)}
      />

      <Pie codigo="M13" />

      {/* Encabezado de la página 1 (a 40 pt: compensa el paddingTop reservado para el compacto) */}
      <View style={{ marginTop: PAD_TOP_P1 - PAD_TOP }}>
        <EncabezadoPrimeraPagina
          titulo="REPORTE DE INCIDENCIAS"
          subtitulo={<>Reporte visual · {terminoSitio}: {rancho}{ranchoCodigo ? ` (${ranchoCodigo})` : ''}</>}
        />

        <FranjaDatos
          campos={[
            { icono: 'usuario', etiqueta: 'Realizó el recorrido', valor: auditorNombre ?? '—' },
            { icono: 'folio', etiqueta: 'Folio', valor: folio },
            { icono: 'calendario', etiqueta: 'Fecha', valor: fechaFormateada },
            { icono: 'codigo', etiqueta: 'Código', valor: codigoFmt },
          ]}
        />

        <TituloSeccion texto="REGISTRO DE INCIDENCIAS" />
        <EncabezadoTabla
          columnas={[
            { ancho: COL_EVIDENCIA, icono: 'imagen', texto: 'EVIDENCIA' },
            { icono: 'alerta', texto: 'INCIDENCIAS' },
          ]}
        />
      </View>

      {/* Tarjetas de incidencias */}
      {bloques.map((b) => <Tarjeta key={b.key} b={b} />)}

      {/* Firmas digitales; en blanco para firma a mano si no existen */}
      <PdfFirmas
        signatures={[
          {
            label: 'Realizó el recorrido',
            nombre: auditorNombre ?? '',
            caption: 'Realizó - Firma',
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
