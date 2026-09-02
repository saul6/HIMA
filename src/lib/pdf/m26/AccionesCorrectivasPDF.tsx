// PATRÓN INOCUIDAD — PDF M26 (plantilla homogénea M.A.D.Y)
// Plan de Acciones Correctivas — A4 landscape, multi-página.
// Encabezado fijo (TopBar + logo + meta), PdfFooter. Diagrama Ishikawa SVG.

import { Document, Page, View, Text, Image, Svg, Line, Rect, Path, G } from '@react-pdf/renderer'
import { TopBar, PdfFooter } from '@/lib/pdf/components/PdfPage'
import { LOGO_MADY_PDF } from '@/lib/pdf/assets/logoMadyPdf'
import { PC } from '@/lib/pdf/components/tokens'

// ── Tipos ─────────────────────────────────────────────────────────────────────

export interface AccionPDFFila {
  codigo_pregunta: string
  modulo_label: string
  no_conformidad: string | null
  causa: string | null
  accion_correctiva: string | null
  accion_preventiva: string | null
  fecha_deteccion: string | null
  fecha_cumplimiento: string | null
  realizo: string | null
  verifico: string | null
  ishikawa: Record<string, string> | null
  fotos: Array<{
    tipo: 'no_conformidad' | 'evidencia_correccion'
    leyenda: string | null
    dataUri: string
  }>
}

export interface AccionesCorrectivasPDFProps {
  orgNombre: string
  ranchoNombre: string
  fechaTitulo: string
  acciones: AccionPDFFila[]
  terminoSitio?: string
}

// ── Colores semánticos locales ─────────────────────────────────────────────────

const INFO_FILL   = '#E3F2FD'
const INFO_TEXT   = '#0D5A8F'
const WARN_FILL   = '#FAEEDA'
const WARN_TEXT   = '#854F0B'
const WARN_BORDER = '#F5A623'
const ROW_ALT     = '#F5F9FE'
const OK_FILL     = '#2E7D32'

// ── Helpers ───────────────────────────────────────────────────────────────────

function fmt(s: string | null | undefined): string {
  return s?.trim() || '—'
}

function fmtFecha(iso: string | null | undefined): string {
  if (!iso) return '—'
  try {
    const [y, m, d] = iso.split('-')
    return `${d}/${m}/${y}`
  } catch { return iso }
}

function svgLineas(text: string, maxChars: number, maxLines: number): string[] {
  if (!text?.trim()) return []
  const words = text.split(/\s+/)
  const lines: string[] = []
  let cur = ''
  for (const word of words) {
    if (lines.length >= maxLines) break
    const next = cur ? `${cur} ${word}` : word
    if (next.length <= maxChars) { cur = next }
    else { if (cur) { lines.push(cur) } cur = word.slice(0, maxChars) }
  }
  if (cur && lines.length < maxLines) lines.push(cur)
  return lines
}

// ── Estilos de tabla inline ───────────────────────────────────────────────────

const thCell = {
  color: PC.white,
  fontFamily: 'Helvetica-Bold' as const,
  fontSize: 7,
  padding: 5,
  borderRightWidth: 1,
  borderRightColor: '#5599CC',
  borderBottomWidth: 1,
  borderBottomColor: '#5599CC',
  textAlign: 'center' as const,
}

const tdCell = {
  fontSize: 8,
  padding: 5,
  borderRightWidth: 1,
  borderRightColor: PC.border,
  borderBottomWidth: 1,
  borderBottomColor: PC.border,
  color: PC.fieldValue,
}

// ── Ishikawa constants ────────────────────────────────────────────────────────

const ISH_W  = 710
const ISH_H  = 200
const ISH_MY = 100
const ISH_BX = [130, 280, 430]
const ISH_TIP_DY = 55

const ISH_ABOVE = [
  { key: 'medio_ambiente', label: 'MEDIO AMBIENTE' },
  { key: 'metodo',         label: 'METODO' },
  { key: 'mano_de_obra',  label: 'MANO DE OBRA' },
]
const ISH_BELOW = [
  { key: 'materiales',  label: 'MATERIALES' },
  { key: 'herramientas', label: 'HERRAMIENTAS' },
  { key: 'medicion',    label: 'MEDICION' },
]

// ── Componentes internos ──────────────────────────────────────────────────────

function InfoGrid({ orgNombre, ranchoNombre, fechaTitulo, terminoSitio }: {
  orgNombre: string; ranchoNombre: string; fechaTitulo: string; terminoSitio: string
}) {
  const cellBase = { flex: 1, padding: 6, borderRightWidth: 1, borderRightColor: PC.border, borderBottomWidth: 1, borderBottomColor: PC.border }
  return (
    <View style={{ borderLeftWidth: 1, borderLeftColor: PC.border, borderTopWidth: 1, borderTopColor: PC.border, flexDirection: 'row', marginBottom: 10 }}>
      <View style={cellBase}>
        <Text style={{ fontSize: 6, color: PC.textSub, fontFamily: 'Helvetica-Bold', marginBottom: 2 }}>ORGANIZACION</Text>
        <Text style={{ fontSize: 9, fontFamily: 'Helvetica-Bold', color: PC.fieldValue }}>{fmt(orgNombre)}</Text>
      </View>
      <View style={cellBase}>
        <Text style={{ fontSize: 6, color: PC.textSub, fontFamily: 'Helvetica-Bold', marginBottom: 2 }}>INSTALACION / {terminoSitio.toUpperCase()}</Text>
        <Text style={{ fontSize: 9, fontFamily: 'Helvetica-Bold', color: PC.fieldValue }}>{fmt(ranchoNombre)}</Text>
      </View>
      <View style={{ ...cellBase, borderRightWidth: 0 }}>
        <Text style={{ fontSize: 6, color: PC.textSub, fontFamily: 'Helvetica-Bold', marginBottom: 2 }}>FECHA</Text>
        <Text style={{ fontSize: 9, fontFamily: 'Helvetica-Bold', color: PC.fieldValue }}>{fechaTitulo}</Text>
      </View>
    </View>
  )
}

function AccionesTabla({ acciones }: { acciones: AccionPDFFila[] }) {
  return (
    <View style={{ borderLeftWidth: 1, borderLeftColor: PC.border, borderTopWidth: 1, borderTopColor: PC.border, marginBottom: 14 }}>
      <View style={{ flexDirection: 'row', backgroundColor: PC.section }}>
        <Text style={[thCell, { flex: 0.8 }]}>Fecha deteccion</Text>
        <Text style={[thCell, { flex: 1.8 }]}>No conformidad</Text>
        <Text style={[thCell, { flex: 1.6 }]}>Causa</Text>
        <Text style={[thCell, { flex: 1.6 }]}>Accion correctiva</Text>
        <Text style={[thCell, { flex: 1.6 }]}>Accion preventiva</Text>
        <Text style={[thCell, { flex: 0.8 }]}>Fecha cumplimiento</Text>
        <Text style={[thCell, { flex: 1 }]}>Realizo</Text>
        <Text style={[thCell, { flex: 1, borderRightWidth: 0 }]}>Verifico</Text>
      </View>
      {acciones.map((a, i) => (
        <View key={i} style={{ flexDirection: 'row', backgroundColor: i % 2 === 1 ? ROW_ALT : PC.white }} wrap={false}>
          <View style={[tdCell, { flex: 0.8 }]}><Text>{fmtFecha(a.fecha_deteccion)}</Text></View>
          <View style={[tdCell, { flex: 1.8 }]}>
            <Text style={{ fontSize: 7, color: PC.section, marginBottom: 2 }}>{a.codigo_pregunta}</Text>
            <Text>{fmt(a.no_conformidad)}</Text>
          </View>
          <View style={[tdCell, { flex: 1.6 }]}><Text>{fmt(a.causa)}</Text></View>
          <View style={[tdCell, { flex: 1.6 }]}><Text>{fmt(a.accion_correctiva)}</Text></View>
          <View style={[tdCell, { flex: 1.6 }]}><Text>{fmt(a.accion_preventiva)}</Text></View>
          <View style={[tdCell, { flex: 0.8 }]}><Text>{fmtFecha(a.fecha_cumplimiento)}</Text></View>
          <View style={[tdCell, { flex: 1 }]}><Text>{fmt(a.realizo)}</Text></View>
          <View style={[tdCell, { flex: 1, borderRightWidth: 0 }]}><Text>{fmt(a.verifico)}</Text></View>
        </View>
      ))}
    </View>
  )
}

function FichaNC({ accion }: { accion: AccionPDFFila }) {
  const hdrAmbar = { backgroundColor: WARN_FILL, borderBottomWidth: 1, borderBottomColor: WARN_BORDER, paddingHorizontal: 8, paddingVertical: 5 }
  const hdrBlue  = { backgroundColor: INFO_FILL, borderBottomWidth: 1, borderBottomColor: PC.section, paddingHorizontal: 8, paddingVertical: 5 }
  return (
    <View style={{ marginBottom: 14, borderWidth: 1, borderColor: PC.border, borderRadius: 3 }} wrap={false}>
      <View style={hdrAmbar}>
        <Text style={{ fontSize: 8, fontFamily: 'Helvetica-Bold', color: WARN_TEXT }}>No conformidad observada.</Text>
      </View>
      <View style={{ padding: 8 }}>
        <Text style={{ fontSize: 7, fontFamily: 'Helvetica-Bold', color: PC.section, marginBottom: 3 }}>{accion.codigo_pregunta}</Text>
        <Text style={{ fontSize: 8, color: PC.fieldValue, lineHeight: 1.4 }}>{fmt(accion.no_conformidad)}</Text>
      </View>
      <View style={hdrBlue}>
        <Text style={{ fontSize: 8, fontFamily: 'Helvetica-Bold', color: INFO_TEXT }}>Accion correctiva.</Text>
      </View>
      <View style={{ padding: 8 }}>
        <Text style={{ fontSize: 8, color: PC.fieldValue, lineHeight: 1.4 }}>{fmt(accion.accion_correctiva)}</Text>
      </View>
      <View style={hdrBlue}>
        <Text style={{ fontSize: 8, fontFamily: 'Helvetica-Bold', color: INFO_TEXT }}>Evidencia.</Text>
      </View>
      <View style={{ padding: 8 }}>
        {accion.fotos.length === 0 ? (
          <Text style={{ fontSize: 7.5, color: PC.textSub }}>Sin evidencia fotografica.</Text>
        ) : (
          <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 8 }}>
            {accion.fotos.map((f, fi) => (
              <View key={fi} style={{ width: '48%', marginBottom: 8 }}>
                <Image src={f.dataUri} style={{ width: '100%', height: 130, objectFit: 'cover', borderRadius: 3, borderWidth: 1, borderColor: PC.border }} />
                <Text style={{ fontSize: 7, fontFamily: 'Helvetica-Bold', marginTop: 3, textAlign: 'center', color: PC.textSub }}>
                  {f.tipo === 'no_conformidad' ? 'No conformidad' : 'Evidencia de correccion'}
                </Text>
                {f.leyenda ? <Text style={{ fontSize: 7, color: PC.fieldValue, marginTop: 2, textAlign: 'center' }}>{f.leyenda}</Text> : null}
              </View>
            ))}
          </View>
        )}
      </View>
    </View>
  )
}

function IshikawaDiagram({ nc, ishikawa }: { nc: string; ishikawa: Record<string, string> }) {
  const ncLines = svgLineas(nc, 22, 4)
  return (
    <View style={{ marginBottom: 14 }}>
      <Text style={{ fontSize: 8, fontFamily: 'Helvetica-Bold', color: PC.fieldValue, textTransform: 'uppercase', marginBottom: 6, borderBottomWidth: 1, borderBottomColor: PC.border, paddingBottom: 3 }}>
        Analisis de causa — Diagrama de Ishikawa
      </Text>
      <Svg viewBox={`0 0 ${ISH_W} ${ISH_H}`} style={{ width: ISH_W, height: ISH_H }}>
        {/* Eje principal */}
        <Line x1="20" y1={ISH_MY} x2="540" y2={ISH_MY} stroke={PC.fieldValue} strokeWidth="2" />
        <Path d={`M530 ${ISH_MY - 6} L548 ${ISH_MY} L530 ${ISH_MY + 6} Z`} fill={PC.fieldValue} />

        {/* Caja EFECTO */}
        <Rect x="552" y={ISH_MY - 50} width="150" height="100" fill={INFO_FILL} stroke={PC.section} strokeWidth="1.5" rx="4" />
        <Text x="627" y={ISH_MY - 32} textAnchor="middle" fontFamily="Helvetica-Bold" fontSize="8" fill={INFO_TEXT}>EFECTO</Text>
        {ncLines.map((line, i) => (
          <Text key={i} x="627" y={ISH_MY - 15 + i * 12} textAnchor="middle" fontFamily="Helvetica" fontSize="7" fill={PC.fieldValue}>{line}</Text>
        ))}

        <Text x="22" y={ISH_MY - 8} fontFamily="Helvetica-Bold" fontSize="8" fill={PC.textSub}>CAUSAS</Text>

        {/* Ramas superiores */}
        {ISH_BX.map((bx, i) => {
          const tx = bx - 38
          const ty = ISH_MY - ISH_TIP_DY
          const contentLines = svgLineas(ishikawa[ISH_ABOVE[i].key] ?? '', 16, 2)
          return (
            <G key={`u${i}`}>
              <Line x1={bx} y1={ISH_MY} x2={tx} y2={ty + 18} stroke={PC.section} strokeWidth="1.5" />
              <Rect x={tx - 40} y={ty - 14} width="82" height="16" fill={WARN_FILL} stroke={WARN_BORDER} strokeWidth="0.8" rx="2" />
              <Text x={tx + 1} y={ty - 4} textAnchor="middle" fontFamily="Helvetica-Bold" fontSize="6" fill={WARN_TEXT}>{ISH_ABOVE[i].label}</Text>
              {contentLines.map((line, li) => (
                <Text key={li} x={tx - 40} y={ty + 6 + li * 9} fontFamily="Helvetica" fontSize="6" fill={PC.fieldValue}>{line}</Text>
              ))}
            </G>
          )
        })}

        {/* Ramas inferiores */}
        {ISH_BX.map((bx, i) => {
          const tx = bx - 38
          const ty = ISH_MY + ISH_TIP_DY
          const contentLines = svgLineas(ishikawa[ISH_BELOW[i].key] ?? '', 16, 2)
          return (
            <G key={`l${i}`}>
              <Line x1={bx} y1={ISH_MY} x2={tx} y2={ty - 18} stroke={PC.section} strokeWidth="1.5" />
              {contentLines.map((line, li) => (
                <Text key={li} x={tx - 40} y={ty - 26 + li * 9} fontFamily="Helvetica" fontSize="6" fill={PC.fieldValue}>{line}</Text>
              ))}
              <Rect x={tx - 40} y={ty - 2} width="82" height="16" fill={INFO_FILL} stroke={PC.section} strokeWidth="0.8" rx="2" />
              <Text x={tx + 1} y={ty + 9} textAnchor="middle" fontFamily="Helvetica-Bold" fontSize="6" fill={INFO_TEXT}>{ISH_BELOW[i].label}</Text>
            </G>
          )
        })}
      </Svg>
    </View>
  )
}

// ── AccionesCorrectivasPDF ────────────────────────────────────────────────────

export function AccionesCorrectivasPDF({
  orgNombre,
  ranchoNombre,
  fechaTitulo,
  acciones,
  terminoSitio = 'Instalación',
}: AccionesCorrectivasPDFProps) {
  const emision = new Date().toLocaleDateString('es-MX')

  return (
    <Document
      title={`Acciones_Correctivas_${fechaTitulo}`}
      author="M.A.D.Y."
      creator="M.A.D.Y. Inocuidad Inteligente"
      producer="M.A.D.Y. Inocuidad Inteligente"
      subject="Plan de Acciones Correctivas"
      keywords="MADY, inocuidad, acciones correctivas, no conformidades"
    >
      <Page
        size="A4"
        orientation="landscape"
        style={{
          fontFamily: 'Helvetica',
          fontSize: 8,
          color: PC.fieldValue,
          paddingTop: 82,
          paddingBottom: 55,
          paddingLeft: 40,
          paddingRight: 40,
          backgroundColor: PC.white,
        }}
      >
        {/* Encabezado fijo */}
        <View fixed style={{ position: 'absolute', top: 0, left: 0, right: 0, backgroundColor: PC.white }}>
          <TopBar />
          <View style={{ flexDirection: 'row', alignItems: 'center', paddingTop: 6, paddingBottom: 6, paddingLeft: 40, paddingRight: 40 }}>
            <View style={{ flex: 6 }}>
              <Text style={{ fontFamily: 'Helvetica-Bold', fontSize: 11, color: PC.titleNavy }}>
                PLAN DE ACCIONES CORRECTIVAS
              </Text>
              <Text style={{ fontSize: 7, color: PC.textSub, marginTop: 2 }}>
                Acciones correctivas  ·  {terminoSitio}: {ranchoNombre}
              </Text>
            </View>
            <View style={{ flex: 4, alignItems: 'flex-end' }}>
              <Image src={LOGO_MADY_PDF} style={{ height: 36, width: 101 }} />
            </View>
          </View>
          <View style={{ borderTopWidth: 1, borderTopColor: PC.border, flexDirection: 'row', gap: 20, paddingTop: 3, paddingBottom: 4, paddingLeft: 40, paddingRight: 40 }}>
            <Text style={{ fontSize: 7, color: PC.textSub }}>Emision: {emision}</Text>
            <Text style={{ fontSize: 7, color: PC.textSub }}>Fecha: {fechaTitulo}</Text>
          </View>
        </View>

        <PdfFooter moduloCodigo="M26" />

        {/* Datos generales */}
        <InfoGrid orgNombre={orgNombre} ranchoNombre={ranchoNombre} fechaTitulo={fechaTitulo} terminoSitio={terminoSitio} />

        {/* Nota */}
        <View style={{ padding: 8, borderRadius: 3, marginBottom: 14, borderWidth: 1, borderColor: WARN_BORDER, backgroundColor: WARN_FILL }}>
          <Text style={{ fontSize: 7.5, color: WARN_TEXT, lineHeight: 1.4 }}>
            Las no-conformidades deben atenderse en un maximo de 30 dias naturales a partir de la fecha de deteccion.
            Conserve evidencia documental del cierre de cada accion correctiva.
          </Text>
        </View>

        {/* Tabla resumen */}
        <Text style={{ fontSize: 9, fontFamily: 'Helvetica-Bold', color: PC.section, marginBottom: 6, textTransform: 'uppercase' }}>
          ACCIONES CORRECTIVAS ({acciones.length})
        </Text>
        {acciones.length === 0 ? (
          <Text style={{ fontSize: 9, color: PC.textSub }}>Sin no-conformidades registradas.</Text>
        ) : (
          <AccionesTabla acciones={acciones} />
        )}

        {/* Fichas + Ishikawa por no-conformidad */}
        {acciones.map((a, i) => {
          const hasIsh = a.ishikawa && Object.values(a.ishikawa).some((v) => v?.trim())
          return (
            <View key={i} break={i === 0}>
              <FichaNC accion={a} />
              {hasIsh && (
                <IshikawaDiagram
                  nc={`${a.codigo_pregunta} — ${a.no_conformidad ?? ''}`}
                  ishikawa={a.ishikawa!}
                />
              )}
            </View>
          )
        })}
      </Page>
    </Document>
  )
}
