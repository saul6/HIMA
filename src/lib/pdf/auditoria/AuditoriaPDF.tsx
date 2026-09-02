// AuditoriaPDF — formato checklist PrimusGFS para M14–M18
// Plantilla homogénea M.A.D.Y: degradado superior, logo imagen, colores #3277AE, pie estándar.
// AuditoriaPagina : una <Page> A4 portrait por auditoría (auto-pagina con wrap)
// AuditoriaPDF    : Document individual
// AuditoriaConsolidadoPDF: Document multi-página

import { Document, Page, View, Text, Image, StyleSheet } from '@react-pdf/renderer'
import { TopBar, PdfFooter } from '@/lib/pdf/components/PdfPage'
import { LOGO_MADY_PDF } from '@/lib/pdf/assets/logoMadyPdf'
import { PC } from '@/lib/pdf/components/tokens'
import { formatPortadaM15, formatPortadaM16, formatPortadaM17, type PortadaLinea } from './portadaConfig'
import type { ModuloAuditoria } from '@/hooks/useAuditoria'

// ── Tipos internos ────────────────────────────────────────────────────────────

interface SeccionRow  { id: string; codigo: string; nombre: string; orden: number }
interface PreguntaRow { id: string; seccion_id: string; codigo: string; texto: string; puntos: number; orden_seccion: number }
interface RespuestaRow { pregunta_id: string; respuesta: string; comentario: string | null; puntos_otorgados: number }

export interface AuditoriaPaginaProps {
  modulo: ModuloAuditoria
  auditoriaId: string
  ranchoNombre: string
  ranchoCodigo: string
  fecha: string
  auditorNombre: string | null
  puntos_obtenidos: number
  puntos_posibles: number
  porcentaje: number
  portada: Record<string, unknown> | null
  secciones: SeccionRow[]
  preguntas: PreguntaRow[]
  respuestas: RespuestaRow[]
  codigoClave?: string
  terminoSitio?: string
}

// ── Config por módulo ─────────────────────────────────────────────────────────

const MODULO_CONFIG: Record<ModuloAuditoria, { titulo: string; subtitulo: string }> = {
  m14: {
    titulo: 'Auditoría — Módulo 1 SAIA',
    subtitulo: 'Requisitos del Sistema Administrativo de la Inocuidad Alimentaria',
  },
  m15: {
    titulo: 'Auditoría — Módulo 2 Granja',
    subtitulo: 'Buenas Prácticas Agrícolas',
  },
  m16: {
    titulo: 'Auditoría — Módulo 4 Cuadrilla de Cosecha',
    subtitulo: 'Buenas Prácticas Agrícolas',
  },
  m17: {
    titulo: 'Auditoría — Módulo 5 Operaciones BPM',
    subtitulo: 'Buenas Prácticas de Manufactura',
  },
  m18: {
    titulo: 'Auditoría — Módulo 6 HACCP',
    subtitulo: 'Requisitos del Sistema HACCP',
  },
}

// ── Colores locales (específicos del checklist de auditoría) ──────────────────

const ROW_ALT     = '#F5F9FE'
const CUMPLE_BG   = '#E3F2FD'
const CUMPLE_FG   = '#0D5A8F'
const NOCUMPLE_BG = '#FAEEDA'
const NOCUMPLE_FG = '#854F0B'

// ── Anchos de columna (contenido A4 portrait = 595.28 - 50 - 50 = 495pt) ─────

const C_CODIGO   = 42
const C_PREGUNTA = 220
const C_PUNTOS   = 35
const C_RESULT   = 100
const C_COMENT   = 98

// ── Helpers ───────────────────────────────────────────────────────────────────

function formatFechaPDF(iso: string): string {
  try {
    const d = new Date(iso + 'T12:00:00')
    const dd = String(d.getDate()).padStart(2, '0')
    const mm = ['Ene','Feb','Mar','Abr','May','Jun','Jul','Ago','Sep','Oct','Nov','Dic'][d.getMonth()]
    const yy = String(d.getFullYear()).slice(2)
    return `${dd}-${mm}-${yy}`
  } catch { return iso }
}

function respLabel(r: string | undefined): string {
  if (r === 'cumple')    return 'Cumple'
  if (r === 'no_cumple') return 'No cumple'
  if (r === 'na')        return 'N/A'
  return 'Sin resp.'
}

function calcSeccion(pregs: PreguntaRow[], respsMap: Map<string, RespuestaRow>) {
  let obt = 0, pos = 0
  for (const p of pregs) {
    const r = respsMap.get(p.id)
    if (!r || r.respuesta === 'na') continue
    pos += p.puntos
    if (r.respuesta === 'cumple') obt += p.puntos
  }
  const pct = pos > 0 ? Math.round(obt / pos * 10000) / 100 : 0
  return { obt, pos, pct }
}

// ── Estilos ───────────────────────────────────────────────────────────────────

const s = StyleSheet.create({
  page: {
    fontFamily: 'Helvetica',
    fontSize: 9,
    color: PC.fieldValue,
    paddingTop: 82,      // espacio para header fijo (~75pt) + margen
    paddingBottom: 46,
    paddingLeft: 50,
    paddingRight: 50,
  },

  // ── Resumen puntaje ────────────────────────────────────────────────────────
  scoreSummary: {
    flexDirection: 'row',
    marginBottom: 14,
    borderWidth: 1,
    borderColor: PC.border,
    borderStyle: 'solid',
  },
  scoreMain: {
    width: 110,
    padding: 10,
    alignItems: 'center',
    justifyContent: 'center',
    borderRightWidth: 1,
    borderRightColor: PC.border,
    borderRightStyle: 'solid',
    backgroundColor: '#EBF3FB',
  },
  scorePct:   { fontSize: 26, fontFamily: 'Helvetica-Bold', color: PC.section, lineHeight: 1 },
  scoreLabel: { fontSize: 7, color: PC.textSub, marginTop: 3, textAlign: 'center' },
  scorePts:   { fontSize: 8, color: PC.section, fontFamily: 'Helvetica-Bold', marginTop: 2 },
  scoreTable: { flex: 1, padding: 7 },
  scoreTableTitle: {
    fontSize: 7,
    fontFamily: 'Helvetica-Bold',
    color: PC.fieldValue,
    marginBottom: 4,
    borderBottomWidth: 1,
    borderBottomColor: PC.border,
    borderBottomStyle: 'solid',
    paddingBottom: 2,
  },
  scoreRow:     { flexDirection: 'row', paddingVertical: 1.5 },
  scoreSecName: { flex: 1, fontSize: 7, color: PC.fieldValue },
  scoreSecPct:  { fontSize: 7, fontFamily: 'Helvetica-Bold', color: PC.section, width: 50, textAlign: 'right' },

  // ── Portada (M15/M16/M17) ─────────────────────────────────────────────────
  portadaTitle: {
    backgroundColor: '#E0EDF6',
    paddingVertical: 5,
    paddingHorizontal: 8,
    marginBottom: 4,
    fontFamily: 'Helvetica-Bold',
    fontSize: 8,
    color: PC.titleNavy,
    borderLeftWidth: 3,
    borderLeftColor: PC.section,
    borderLeftStyle: 'solid',
  },
  portadaRow: {
    flexDirection: 'row',
    paddingVertical: 2.5,
    borderBottomWidth: 1,
    borderBottomColor: '#EEEEEE',
    borderBottomStyle: 'solid',
  },
  portadaLabel: { width: 135, fontSize: 7, fontFamily: 'Helvetica-Bold', color: PC.textSub },
  portadaValue: { flex: 1, fontSize: 8, color: PC.fieldValue },

  // ── Tabla checklist ────────────────────────────────────────────────────────
  tableWrap: {
    borderTopWidth: 1,
    borderLeftWidth: 1,
    borderTopColor: PC.border,
    borderLeftColor: PC.border,
    borderTopStyle: 'solid',
    borderLeftStyle: 'solid',
    marginBottom: 16,
  },
  thRow: { flexDirection: 'row', backgroundColor: PC.section },
  thCell: {
    color: PC.white,
    fontFamily: 'Helvetica-Bold',
    fontSize: 7,
    paddingTop: 4,
    paddingBottom: 4,
    paddingLeft: 4,
    paddingRight: 4,
    borderRightWidth: 1,
    borderRightColor: '#5599CC',
    borderRightStyle: 'solid',
    borderBottomWidth: 1,
    borderBottomColor: '#5599CC',
    borderBottomStyle: 'solid',
  },
  // Encabezado de sección — banda azul con texto blanco (igual que PdfSectionBanner)
  secRow: {
    flexDirection: 'row',
    backgroundColor: PC.section,
    borderBottomWidth: 1,
    borderBottomColor: PC.section,
    borderBottomStyle: 'solid',
  },
  secCell: {
    flex: 1,
    fontSize: 8,
    fontFamily: 'Helvetica-Bold',
    color: PC.white,
    paddingVertical: 4,
    paddingLeft: 6,
    paddingRight: 4,
    borderRightWidth: 1,
    borderRightColor: '#5599CC',
    borderRightStyle: 'solid',
  },
  secScore: {
    fontSize: 8,
    fontFamily: 'Helvetica-Bold',
    color: PC.white,
    paddingVertical: 4,
    paddingRight: 6,
    paddingLeft: 4,
  },
  // Filas de preguntas
  qRow:    { flexDirection: 'row', borderBottomWidth: 1, borderBottomColor: PC.border, borderBottomStyle: 'solid' },
  qRowAlt: { flexDirection: 'row', backgroundColor: ROW_ALT, borderBottomWidth: 1, borderBottomColor: PC.border, borderBottomStyle: 'solid' },
  qCell: {
    fontSize: 8,
    paddingTop: 4,
    paddingBottom: 4,
    paddingLeft: 4,
    paddingRight: 4,
    borderRightWidth: 1,
    borderRightColor: PC.border,
    borderRightStyle: 'solid',
    color: PC.fieldValue,
  },
  qCellCumple:   { backgroundColor: CUMPLE_BG, color: CUMPLE_FG, fontFamily: 'Helvetica-Bold' },
  qCellNoCumple: { backgroundColor: NOCUMPLE_BG, color: NOCUMPLE_FG, fontFamily: 'Helvetica-Bold' },
  qCellNA:       { color: PC.textSub },

  // ── Firma ──────────────────────────────────────────────────────────────────
  firmaSection: { marginTop: 40 },
  firmaBox:  { width: 220 },
  firmaLinea: {
    borderTopWidth: 1,
    borderTopColor: PC.fieldValue,
    borderTopStyle: 'solid',
    paddingTop: 4,
    marginTop: 32,
  },
  firmaLabel: { fontSize: 7, color: PC.textSub },
})

// ── AuditoriaPagina ───────────────────────────────────────────────────────────

export function AuditoriaPagina({
  modulo, auditoriaId, ranchoNombre, ranchoCodigo, fecha, auditorNombre,
  puntos_obtenidos, puntos_posibles, porcentaje, portada,
  secciones, preguntas, respuestas,
  codigoClave = 'MXA', terminoSitio = 'Rancho',
}: AuditoriaPaginaProps) {
  const config    = MODULO_CONFIG[modulo]
  const fechaFmt  = formatFechaPDF(fecha)
  const codigoFmt = `${codigoClave}-F-SC-SIG`
  const folioDsp  = auditoriaId.slice(0, 8).toUpperCase()

  const respsMap = new Map<string, RespuestaRow>()
  for (const r of respuestas) respsMap.set(r.pregunta_id, r)

  const secsSorted = [...secciones].sort((a, b) => a.orden - b.orden)

  let portadaLineas: PortadaLinea[] = []
  if (modulo === 'm15' && portada) portadaLineas = formatPortadaM15(portada)
  if (modulo === 'm16' && portada) portadaLineas = formatPortadaM16(portada)
  if (modulo === 'm17' && portada) portadaLineas = formatPortadaM17(portada)

  return (
    <Page size="A4" style={s.page} wrap>

      {/* ── Header fijo: barra de degradado + logo + título + meta ───────── */}
      <View fixed style={{ position: 'absolute', top: 0, left: 0, right: 0, backgroundColor: PC.white }}>
        <TopBar />
        {/* Fila: logo · título · folio */}
        <View style={{ flexDirection: 'row', alignItems: 'center', paddingTop: 6, paddingBottom: 6, paddingLeft: 50, paddingRight: 50 }}>
          <View style={{ flex: 2 }}>
            <Image src={LOGO_MADY_PDF} style={{ height: 38, width: 106 }} />
          </View>
          <View style={{ flex: 6, alignItems: 'center' }}>
            <Text style={{ fontFamily: 'Helvetica-Bold', fontSize: 10, color: PC.titleNavy, textAlign: 'center' }}>
              {config.titulo}
            </Text>
            <Text style={{ fontSize: 7, color: PC.textSub, marginTop: 2, textAlign: 'center' }}>
              {config.subtitulo}
            </Text>
          </View>
          <View style={{ flex: 2, alignItems: 'flex-end' }}>
            <View style={{ backgroundColor: PC.folioBox, borderRadius: 5, paddingTop: 5, paddingBottom: 5, paddingLeft: 7, paddingRight: 7, alignItems: 'flex-end' }}>
              <Text style={{ fontSize: 8, fontFamily: 'Helvetica-Bold', color: PC.titleNavy }}>{codigoFmt}</Text>
              <Text style={{ fontSize: 7, color: PC.textSub, marginTop: 1 }}>Folio: {folioDsp}</Text>
              <Text style={{ fontSize: 7, color: PC.textSub, marginTop: 1 }}>{fechaFmt}</Text>
            </View>
          </View>
        </View>
        {/* Meta bar: tipo, sitio, auditor */}
        <View style={{ borderTopWidth: 1, borderTopColor: PC.border, flexDirection: 'row', gap: 14, paddingTop: 3, paddingBottom: 4, paddingLeft: 50, paddingRight: 50 }}>
          <Text style={{ fontSize: 7, color: PC.textSub }}>Auditoría interna</Text>
          <Text style={{ fontSize: 7, color: PC.textSub }}>
            {terminoSitio}: {ranchoNombre}{ranchoCodigo ? ` (${ranchoCodigo})` : ''}
          </Text>
          <Text style={{ fontSize: 7, color: PC.textSub }}>
            Auditor: {auditorNombre ?? '—'}
          </Text>
        </View>
      </View>

      {/* ── Footer fijo ──────────────────────────────────────────────────── */}
      <PdfFooter moduloCodigo={modulo.toUpperCase()} />

      {/* ── Resumen de puntaje ────────────────────────────────────────────── */}
      <View style={s.scoreSummary}>
        <View style={s.scoreMain}>
          <Text style={s.scorePct}>
            {puntos_posibles > 0 ? `${porcentaje}%` : 'N/D'}
          </Text>
          <Text style={s.scoreLabel}>Cumplimiento{'\n'}global</Text>
          <Text style={s.scorePts}>
            {puntos_obtenidos} / {puntos_posibles} pts
          </Text>
        </View>
        <View style={s.scoreTable}>
          <Text style={s.scoreTableTitle}>PUNTAJE POR SECCIÓN</Text>
          {secsSorted.map((sec) => {
            const pregsS = preguntas
              .filter((p) => p.seccion_id === sec.id)
              .sort((a, b) => a.orden_seccion - b.orden_seccion)
            const { obt, pos, pct } = calcSeccion(pregsS, respsMap)
            return (
              <View key={sec.id} style={s.scoreRow}>
                <Text style={s.scoreSecName}>{sec.codigo} - {sec.nombre}</Text>
                <Text style={s.scoreSecPct}>{pos > 0 ? `${pct}%` : 'N/A'}</Text>
              </View>
            )
          })}
        </View>
      </View>

      {/* ── Portada (M15 / M16 / M17) ────────────────────────────────────── */}
      {portadaLineas.length > 0 && (
        <View style={{ marginBottom: 14 }}>
          <Text style={s.portadaTitle}>DATOS DE LA OPERACIÓN</Text>
          {portadaLineas.map((lin, i) => (
            <View key={i} style={s.portadaRow} wrap={false}>
              <Text style={s.portadaLabel}>{lin.label}</Text>
              <Text style={s.portadaValue}>{lin.valor}</Text>
            </View>
          ))}
        </View>
      )}

      {/* ── Tabla checklist ──────────────────────────────────────────────── */}
      <View style={s.tableWrap}>
        {/* Encabezado de columnas — se repite en cada página */}
        <View style={s.thRow} fixed>
          <Text style={[s.thCell, { width: C_CODIGO }]}>P#</Text>
          <Text style={[s.thCell, { width: C_PREGUNTA }]}>PREGUNTA</Text>
          <Text style={[s.thCell, { width: C_PUNTOS, textAlign: 'center' }]}>PTS</Text>
          <Text style={[s.thCell, { width: C_RESULT, textAlign: 'center' }]}>RESULTADO</Text>
          <Text style={[s.thCell, { width: C_COMENT, borderRightWidth: 0 }]}>
            COMENTARIOS DEL AUDITOR
          </Text>
        </View>

        {/* Secciones + preguntas */}
        {secsSorted.map((sec) => {
          const pregsS = preguntas
            .filter((p) => p.seccion_id === sec.id)
            .sort((a, b) => a.orden_seccion - b.orden_seccion)
          const { obt, pos, pct } = calcSeccion(pregsS, respsMap)

          return (
            <View key={sec.id}>
              {/* Encabezado de sección */}
              <View style={s.secRow} wrap={false}>
                <Text style={s.secCell}>{sec.codigo} - {sec.nombre}</Text>
                <Text style={s.secScore}>
                  {pos > 0
                    ? `${pct}% (${obt}/${pos} pts)`
                    : `${pregsS.length} preg. informativas`}
                </Text>
              </View>

              {/* Preguntas */}
              {pregsS.map((preg, idx) => {
                const resp    = respsMap.get(preg.id)
                const rowStyle = idx % 2 === 1 ? s.qRowAlt : s.qRow
                const resStr  = resp ? respLabel(resp.respuesta) : '—'
                const resColor =
                  resp?.respuesta === 'cumple'    ? s.qCellCumple
                  : resp?.respuesta === 'no_cumple' ? s.qCellNoCumple
                  : resp?.respuesta === 'na'         ? s.qCellNA
                  : {}
                const ptsLabel = preg.puntos > 0 && resp
                  ? `\n${resp.puntos_otorgados}/${preg.puntos} pts`
                  : ''

                return (
                  <View key={preg.id} style={rowStyle} wrap={false}>
                    <Text style={[s.qCell, { width: C_CODIGO, fontSize: 7 }]}>{preg.codigo}</Text>
                    <Text style={[s.qCell, { width: C_PREGUNTA }]}>{preg.texto}</Text>
                    <Text style={[s.qCell, { width: C_PUNTOS, textAlign: 'center' }]}>
                      {preg.puntos > 0 ? String(preg.puntos) : 'Info'}
                    </Text>
                    <Text style={[s.qCell, { width: C_RESULT, textAlign: 'center' }, resColor]}>
                      {resStr}{ptsLabel}
                    </Text>
                    <Text style={[s.qCell, { width: C_COMENT, borderRightWidth: 0 }]}>
                      {resp?.comentario ?? ''}
                    </Text>
                  </View>
                )
              })}
            </View>
          )
        })}
      </View>

      {/* ── Firma (en blanco — nunca rellenar programáticamente) ─────────── */}
      <View style={s.firmaSection}>
        <View style={s.firmaBox}>
          <View style={s.firmaLinea}>
            <Text style={s.firmaLabel}>Responsable de Inocuidad — Firma</Text>
          </View>
        </View>
      </View>

    </Page>
  )
}

// ── AuditoriaPDF — documento individual ──────────────────────────────────────

export function AuditoriaPDF(props: AuditoriaPaginaProps) {
  const cfg = MODULO_CONFIG[props.modulo]
  return (
    <Document
      title={`${cfg.titulo} — ${props.ranchoNombre} ${props.fecha}`}
      author="M.A.D.Y."
      creator="M.A.D.Y. Inocuidad Inteligente"
      producer="M.A.D.Y. Inocuidad Inteligente"
      subject={cfg.subtitulo}
      keywords="MADY, inocuidad, auditoria"
    >
      <AuditoriaPagina {...props} />
    </Document>
  )
}

// ── AuditoriaConsolidadoPDF — múltiples auditorías ───────────────────────────

export function AuditoriaConsolidadoPDF({
  auditorias,
  modulo,
}: {
  auditorias: AuditoriaPaginaProps[]
  modulo: ModuloAuditoria
}) {
  const cfg = MODULO_CONFIG[modulo]
  return (
    <Document
      title={`${cfg.titulo} — Consolidado`}
      author="M.A.D.Y."
      creator="M.A.D.Y. Inocuidad Inteligente"
      producer="M.A.D.Y. Inocuidad Inteligente"
      subject={`${cfg.subtitulo} — Reporte consolidado`}
      keywords="MADY, inocuidad, auditoria, consolidado"
    >
      {auditorias.map((a) => (
        <AuditoriaPagina key={a.auditoriaId} {...a} />
      ))}
    </Document>
  )
}
