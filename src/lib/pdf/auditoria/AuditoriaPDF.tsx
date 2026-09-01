// AuditoriaPDF — formato checklist PrimusGFS v3.2 para M14 (SAIA), M15 (Granja), M16 (Cosecha)
// AuditoriaPagina : una <Page> A4 por auditoria (auto-pagina si el contenido desborda)
// AuditoriaPDF    : Document individual (1 auditoria)
// Las dos variantes usan AuditoriaPagina internamente.

import { Document, Page, View, Text, StyleSheet } from '@react-pdf/renderer'
import { MadyLogoPDF } from '@/lib/pdf/MadyLogoPDF'
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
}

// ── Config por modulo ─────────────────────────────────────────────────────────

const MODULO_CONFIG: Record<ModuloAuditoria, { titulo: string; subtitulo: string }> = {
  m14: {
    titulo: 'Modulo 1 - SAIA',
    subtitulo: 'Requisitos del Sistema Administrativo de la Inocuidad Alimentaria',
  },
  m15: {
    titulo: 'Modulo 2 - Granja',
    subtitulo: 'Buenas Practicas Agricolas',
  },
  m16: {
    titulo: 'Modulo 4 - Cuadrilla de Cosecha',
    subtitulo: 'Buenas Practicas Agricolas',
  },
  m17: {
    titulo: 'Modulo 5 - Operaciones BPM',
    subtitulo: 'Buenas Practicas de Manufactura',
  },
  m18: {
    titulo: 'Modulo 6 - HACCP',
    subtitulo: 'Requisitos del Sistema HACCP',
  },
}

// ── Paleta (coherente con M9-M13) ────────────────────────────────────────────

const PRIMARY       = '#2B7AB5'
const PRIMARY_LIGHT = '#E3F2FD'
const PRIMARY_MID   = '#D0E8F5'
const DARK          = '#1A1A1A'
const BORDER        = '#CCCCCC'
const WHITE         = '#FFFFFF'
const MUTED         = '#555555'
const ROW_ALT       = '#F5F9FE'
const SEC_BG        = '#D6E8F5'
const CUMPLE_BG     = '#E3F2FD'
const CUMPLE_FG     = '#0D5A8F'
const NOCUMPLE_BG   = '#FAEEDA'
const NOCUMPLE_FG   = '#854F0B'

// ── Anchos de columna (contenido = 595 - 50 - 50 = 495pt) ────────────────────

const C_CODIGO   = 42
const C_PREGUNTA = 220
const C_PUNTOS   = 35
const C_RESULT   = 100
const C_COMENT   = 98   // sin borde derecho = cierre de tabla

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
    color: DARK,
    paddingTop: 82,    // reserva para el header fijo (~58pt) + margen
    paddingBottom: 46,
    paddingLeft: 50,
    paddingRight: 50,
  },

  // ── Header fijo (repite en cada pagina) ────────────────────────────────────
  pageHeader: {
    position: 'absolute',
    top: 14,
    left: 50,
    right: 50,
  },
  phTop: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    paddingBottom: 5,
    borderBottomWidth: 2,
    borderBottomColor: PRIMARY,
    borderBottomStyle: 'solid',
  },
  phLeft:  { flex: 1 },
  phRight: { alignItems: 'flex-end' },
  phTitulo: {
    fontSize: 9,
    fontFamily: 'Helvetica-Bold',
    color: DARK,
  },
  phSubtitulo: { fontSize: 7, color: MUTED, marginTop: 1 },
  phLogo: { fontSize: 10, fontFamily: 'Helvetica-Bold' },
  phFecha: { fontSize: 7, color: MUTED, marginTop: 2, textAlign: 'right' },
  phMeta: {
    flexDirection: 'row',
    marginTop: 5,
    gap: 12,
  },
  phMetaText: { fontSize: 7.5, color: MUTED },

  // ── Footer fijo ────────────────────────────────────────────────────────────
  footer: {
    position: 'absolute',
    bottom: 16,
    left: 50,
    right: 50,
    flexDirection: 'row',
    justifyContent: 'space-between',
    borderTopWidth: 1,
    borderTopColor: BORDER,
    borderTopStyle: 'solid',
    paddingTop: 3,
  },
  footerText: { fontSize: 6, color: '#888888' },

  // ── Resumen puntaje ────────────────────────────────────────────────────────
  scoreSummary: {
    flexDirection: 'row',
    marginBottom: 14,
    borderWidth: 1,
    borderColor: BORDER,
    borderStyle: 'solid',
  },
  scoreMain: {
    width: 110,
    padding: 10,
    alignItems: 'center',
    justifyContent: 'center',
    borderRightWidth: 1,
    borderRightColor: BORDER,
    borderRightStyle: 'solid',
    backgroundColor: PRIMARY_LIGHT,
  },
  scorePct: {
    fontSize: 26,
    fontFamily: 'Helvetica-Bold',
    color: PRIMARY,
    lineHeight: 1,
  },
  scoreLabel: { fontSize: 7, color: MUTED, marginTop: 3, textAlign: 'center' },
  scorePts:   { fontSize: 8, color: PRIMARY, fontFamily: 'Helvetica-Bold', marginTop: 2 },
  scoreTable: { flex: 1, padding: 7 },
  scoreTableTitle: {
    fontSize: 7,
    fontFamily: 'Helvetica-Bold',
    color: DARK,
    marginBottom: 4,
    borderBottomWidth: 1,
    borderBottomColor: BORDER,
    borderBottomStyle: 'solid',
    paddingBottom: 2,
  },
  scoreRow: {
    flexDirection: 'row',
    paddingVertical: 1.5,
  },
  scoreSecName: { flex: 1, fontSize: 7, color: DARK },
  scoreSecPct: {
    fontSize: 7,
    fontFamily: 'Helvetica-Bold',
    color: PRIMARY,
    width: 50,
    textAlign: 'right',
  },

  // ── Portada ────────────────────────────────────────────────────────────────
  portadaTitle: {
    backgroundColor: PRIMARY_MID,
    paddingVertical: 5,
    paddingHorizontal: 8,
    marginBottom: 4,
    fontFamily: 'Helvetica-Bold',
    fontSize: 8,
    color: DARK,
    borderLeftWidth: 3,
    borderLeftColor: PRIMARY,
    borderLeftStyle: 'solid',
  },
  portadaRow: {
    flexDirection: 'row',
    paddingVertical: 2.5,
    borderBottomWidth: 1,
    borderBottomColor: '#EEEEEE',
    borderBottomStyle: 'solid',
  },
  portadaLabel: {
    width: 135,
    fontSize: 7,
    fontFamily: 'Helvetica-Bold',
    color: MUTED,
  },
  portadaValue: {
    flex: 1,
    fontSize: 8,
    color: DARK,
  },

  // ── Tabla checklist ────────────────────────────────────────────────────────
  tableWrap: {
    borderTopWidth: 1,
    borderLeftWidth: 1,
    borderTopColor: BORDER,
    borderLeftColor: BORDER,
    borderTopStyle: 'solid',
    borderLeftStyle: 'solid',
    marginBottom: 16,
  },
  // Encabezado de columnas
  thRow: {
    flexDirection: 'row',
    backgroundColor: PRIMARY,
  },
  thCell: {
    color: WHITE,
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
  // Encabezado de sección (fila que abarca todas las columnas)
  secRow: {
    flexDirection: 'row',
    backgroundColor: SEC_BG,
    borderBottomWidth: 1,
    borderBottomColor: BORDER,
    borderBottomStyle: 'solid',
  },
  secCell: {
    flex: 1,
    fontSize: 8,
    fontFamily: 'Helvetica-Bold',
    color: DARK,
    paddingVertical: 4,
    paddingLeft: 6,
    paddingRight: 4,
    borderRightWidth: 1,
    borderRightColor: BORDER,
    borderRightStyle: 'solid',
  },
  secScore: {
    fontSize: 8,
    fontFamily: 'Helvetica-Bold',
    color: PRIMARY,
    paddingVertical: 4,
    paddingRight: 6,
    paddingLeft: 4,
  },
  // Fila de pregunta
  qRow: {
    flexDirection: 'row',
    borderBottomWidth: 1,
    borderBottomColor: BORDER,
    borderBottomStyle: 'solid',
  },
  qRowAlt: {
    flexDirection: 'row',
    backgroundColor: ROW_ALT,
    borderBottomWidth: 1,
    borderBottomColor: BORDER,
    borderBottomStyle: 'solid',
  },
  qCell: {
    fontSize: 8,
    paddingTop: 4,
    paddingBottom: 4,
    paddingLeft: 4,
    paddingRight: 4,
    borderRightWidth: 1,
    borderRightColor: BORDER,
    borderRightStyle: 'solid',
  },
  qCellCumple:   { backgroundColor: CUMPLE_BG, color: CUMPLE_FG, fontFamily: 'Helvetica-Bold' },
  qCellNoCumple: { backgroundColor: NOCUMPLE_BG, color: NOCUMPLE_FG, fontFamily: 'Helvetica-Bold' },
  qCellNA:       { color: MUTED },

  // ── Firma ──────────────────────────────────────────────────────────────────
  firmaSection: { marginTop: 40 },
  firmaBox: { width: 220 },
  firmaLinea: {
    borderTopWidth: 1,
    borderTopColor: DARK,
    borderTopStyle: 'solid',
    paddingTop: 4,
    marginTop: 32,
  },
  firmaLabel: { fontSize: 7, color: MUTED },
})

// ── AuditoriaPagina ───────────────────────────────────────────────────────────

export function AuditoriaPagina({
  modulo, auditoriaId, ranchoNombre, ranchoCodigo, fecha, auditorNombre,
  puntos_obtenidos, puntos_posibles, porcentaje, portada,
  secciones, preguntas, respuestas,
}: AuditoriaPaginaProps) {
  const config  = MODULO_CONFIG[modulo]
  const fechaFmt = formatFechaPDF(fecha)

  // Mapa de respuestas O(1)
  const respsMap = new Map<string, RespuestaRow>()
  for (const r of respuestas) respsMap.set(r.pregunta_id, r)

  // Secciones ordenadas
  const secsSorted = [...secciones].sort((a, b) => a.orden - b.orden)

  // Lineas de portada (solo M15/M16)
  let portadaLineas: PortadaLinea[] = []
  if (modulo === 'm15' && portada) portadaLineas = formatPortadaM15(portada)
  if (modulo === 'm16' && portada) portadaLineas = formatPortadaM16(portada)
  if (modulo === 'm17' && portada) portadaLineas = formatPortadaM17(portada)

  const _ = auditoriaId  // usado solo como key externo

  return (
    <Page size="A4" style={s.page} wrap>

      {/* ── Header fijo ──────────────────────────────────────────────────── */}
      <View fixed style={s.pageHeader}>
        <View style={s.phTop}>
          <View style={s.phLeft}>
            <Text style={s.phTitulo}>{config.titulo}</Text>
            <Text style={s.phSubtitulo}>{config.subtitulo}</Text>
          </View>
          <View style={s.phRight}>
            <MadyLogoPDF style={s.phLogo} />
            <Text style={s.phFecha}>{fechaFmt}</Text>
          </View>
        </View>
        <View style={s.phMeta}>
          <Text style={s.phMetaText}>
            Rancho/Instalación: {ranchoNombre} ({ranchoCodigo})
          </Text>
          <Text style={s.phMetaText}>
            Auditor: {auditorNombre ?? '—'}
          </Text>
        </View>
      </View>

      {/* ── Footer fijo ──────────────────────────────────────────────────── */}
      <View fixed style={s.footer}>
        <Text style={s.footerText}>M.A.D.Y · Inocuidad Inteligente</Text>
        <Text
          style={s.footerText}
          render={({ pageNumber, totalPages }) =>
            `Página ${pageNumber} de ${totalPages}`
          }
        />
      </View>

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
                <Text style={s.scoreSecName}>
                  {sec.codigo} - {sec.nombre}
                </Text>
                <Text style={s.scoreSecPct}>
                  {pos > 0 ? `${pct}%` : 'N/A'}
                </Text>
              </View>
            )
          })}
        </View>
      </View>

      {/* ── Portada (M15 / M16) ──────────────────────────────────────────── */}
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

        {/* Encabezado de columnas */}
        <View style={s.thRow} fixed>
          <Text style={[s.thCell, { width: C_CODIGO }]}>P#</Text>
          <Text style={[s.thCell, { width: C_PREGUNTA }]}>PREGUNTA</Text>
          <Text style={[s.thCell, { width: C_PUNTOS, textAlign: 'center' }]}>PTS</Text>
          <Text style={[s.thCell, { width: C_RESULT, textAlign: 'center' }]}>RESULTADO</Text>
          <Text style={[s.thCell, { width: C_COMENT, borderRightWidth: 0 }]}>
            COMENTARIOS DEL AUDITOR
          </Text>
        </View>

        {/* Secciones */}
        {secsSorted.map((sec) => {
          const pregsS = preguntas
            .filter((p) => p.seccion_id === sec.id)
            .sort((a, b) => a.orden_seccion - b.orden_seccion)
          const { obt, pos, pct } = calcSeccion(pregsS, respsMap)

          return (
            <View key={sec.id}>
              {/* Encabezado de sección */}
              <View style={s.secRow} wrap={false}>
                <Text style={s.secCell}>
                  {sec.codigo} - {sec.nombre}
                </Text>
                <Text style={s.secScore}>
                  {pos > 0
                    ? `${pct}% (${obt}/${pos} pts)`
                    : `${pregsS.length} preg. informativas`}
                </Text>
              </View>

              {/* Preguntas */}
              {pregsS.map((preg, idx) => {
                const resp = respsMap.get(preg.id)
                const isAlt = idx % 2 === 1
                const rowStyle = isAlt ? s.qRowAlt : s.qRow

                const resStr = resp ? respLabel(resp.respuesta) : '—'
                const resColor =
                  resp?.respuesta === 'cumple'    ? s.qCellCumple
                  : resp?.respuesta === 'no_cumple' ? s.qCellNoCumple
                  : resp?.respuesta === 'na'         ? s.qCellNA
                  : {}

                const ptsLabel =
                  preg.puntos > 0 && resp
                    ? `\n${resp.puntos_otorgados}/${preg.puntos} pts`
                    : ''

                return (
                  <View key={preg.id} style={rowStyle} wrap={false}>
                    <Text style={[s.qCell, { width: C_CODIGO, fontSize: 7 }]}>
                      {preg.codigo}
                    </Text>
                    <Text style={[s.qCell, { width: C_PREGUNTA }]}>
                      {preg.texto}
                    </Text>
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

      {/* ── Firma (en blanco — nunca rellenar programaticamente) ─────────── */}
      <View style={s.firmaSection}>
        <View style={s.firmaBox}>
          <View style={s.firmaLinea}>
            <Text style={s.firmaLabel}>Responsable de Inocuidad - Firma</Text>
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
      title={`${cfg.titulo} - ${props.ranchoNombre} ${props.fecha}`}
      author="M.A.D.Y"
      subject={cfg.subtitulo}
    >
      <AuditoriaPagina {...props} />
    </Document>
  )
}

// ── AuditoriaConsolidadoPDF — multiples auditorias ───────────────────────────

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
      title={`${cfg.titulo} - Consolidado`}
      author="M.A.D.Y"
      subject={`${cfg.subtitulo} - Reporte consolidado`}
    >
      {auditorias.map((a) => (
        <AuditoriaPagina key={a.auditoriaId} {...a} />
      ))}
    </Document>
  )
}
