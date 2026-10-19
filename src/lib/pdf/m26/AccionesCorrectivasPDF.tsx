// PATRÓN INOCUIDAD — PDF M26 (plantilla homogénea M.A.D.Y)
// Plan de Acciones Correctivas — A4 landscape, multi-página.
// Encabezado fijo (TopBar + logo + meta), PdfFooter. Diagrama Ishikawa SVG.

import { Document, View, Text, Svg, Line, Rect, Path, G } from '@react-pdf/renderer'
import { PaginaEstandar } from '@/lib/pdf/disenoNuevo/PaginaEstandar'
import { TituloSeccion } from '@/lib/pdf/disenoNuevo/TituloSeccion'
import { TablaDatos, type ColumnaDato } from '@/lib/pdf/disenoNuevo/TablaDatos'
import { Fotos } from '@/lib/pdf/disenoNuevo/Fotos'
import { PC } from '@/lib/pdf/components/tokens'
import { partirPalabraLarga } from '@/lib/pdf/components/texto'

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

// ── Ishikawa constants ────────────────────────────────────────────────────────

const ISH_W  = 710
const ISH_H  = 200
const ISH_MY = 100
const ISH_BX = [130, 280, 430]
const ISH_TIP_DY = 55

const ISH_ABOVE = [
  { key: 'medio_ambiente', label: 'MEDIO AMBIENTE' },
  { key: 'metodo',         label: 'MÉTODO' },
  { key: 'mano_de_obra',  label: 'MANO DE OBRA' },
]
const ISH_BELOW = [
  { key: 'materiales',  label: 'MATERIALES' },
  { key: 'herramientas', label: 'HERRAMIENTAS' },
  { key: 'medicion',    label: 'MEDICIÓN' },
]

// ── Componentes internos ──────────────────────────────────────────────────────

const COLS: ColumnaDato[] = [
  { texto: 'Fecha detección', ancho: 80 },
  { texto: 'No conformidad', ancho: 180 },
  { texto: 'Causa', ancho: 160 },
  { texto: 'Acción correctiva', ancho: 160 },
  { texto: 'Acción preventiva', ancho: 160 },
  { texto: 'Fecha cumplimiento', ancho: 80 },
  { texto: 'Realizó', ancho: 100 },
  { texto: 'Verificó', ancho: 100 },
]

function AccionesTabla({ acciones }: { acciones: AccionPDFFila[] }) {
  return (
    <TablaDatos
      columnas={COLS}
      filas={acciones.map((a) => [
        fmtFecha(a.fecha_deteccion),
        {
          nodo: (
            <>
              <Text style={{ fontSize: 7, color: PC.m13Navy, fontFamily: 'Helvetica-Bold', marginBottom: 2 }}>{a.codigo_pregunta}</Text>
              <Text style={{ fontSize: 8, color: PC.fieldValue }} hyphenationCallback={partirPalabraLarga}>{fmt(a.no_conformidad)}</Text>
            </>
          ),
        },
        fmt(a.causa),
        fmt(a.accion_correctiva),
        fmt(a.accion_preventiva),
        fmtFecha(a.fecha_cumplimiento),
        fmt(a.realizo),
        fmt(a.verifico),
      ])}
    />
  )
}

// Barra de subtítulo de una ficha: barra menta + bold navy
function SubtituloFicha({ texto }: { texto: string }) {
  return (
    <View style={{ flexDirection: 'row', alignItems: 'center', backgroundColor: PC.m13Fondo, paddingVertical: 5, paddingRight: 8 }}>
      <View style={{ width: 2.5, alignSelf: 'stretch', backgroundColor: PC.m13Menta, marginRight: 6 }} />
      <Text style={{ fontSize: 8, fontFamily: 'Helvetica-Bold', color: PC.m13Navy }}>{texto}</Text>
    </View>
  )
}

function FichaNC({ accion }: { accion: AccionPDFFila }) {
  return (
    <View style={{ marginBottom: 14, borderWidth: 0.5, borderColor: PC.border, borderRadius: 6, overflow: 'hidden' }}>
      <View wrap={false}>
        <SubtituloFicha texto="No conformidad observada." />
        <View style={{ padding: 8 }}>
          <Text style={{ fontSize: 7, fontFamily: 'Helvetica-Bold', color: PC.m13Navy, marginBottom: 3 }} hyphenationCallback={partirPalabraLarga}>{accion.codigo_pregunta}</Text>
          <Text style={{ fontSize: 8, color: PC.fieldValue, lineHeight: 1.4 }} hyphenationCallback={partirPalabraLarga}>{fmt(accion.no_conformidad)}</Text>
        </View>
      </View>
      <View wrap={false}>
        <SubtituloFicha texto="Acción correctiva." />
        <View style={{ padding: 8 }}>
          <Text style={{ fontSize: 8, color: PC.fieldValue, lineHeight: 1.4 }} hyphenationCallback={partirPalabraLarga}>{fmt(accion.accion_correctiva)}</Text>
        </View>
      </View>
      <SubtituloFicha texto="Evidencia." />
      <View style={{ padding: 8 }}>
        {accion.fotos.length === 0 ? (
          <Text style={{ fontSize: 7.5, color: PC.textSub }}>Sin evidencia fotografica.</Text>
        ) : (
          <Fotos
            uris={accion.fotos.map((f) => f.dataUri)}
            pies={accion.fotos.map((f) => ({
              titulo: f.tipo === 'no_conformidad' ? 'No conformidad' : 'Evidencia de correccion',
              leyenda: f.leyenda,
            }))}
          />
        )}
      </View>
    </View>
  )
}

function IshikawaDiagram({ nc, ishikawa }: { nc: string; ishikawa: Record<string, string> }) {
  const ncLines = svgLineas(nc, 22, 4)
  return (
    <View style={{ marginBottom: 14 }} wrap={false}>
      <Text style={{ fontSize: 8, fontFamily: 'Helvetica-Bold', color: PC.m13Navy, textTransform: 'uppercase', marginBottom: 6, borderBottomWidth: 1, borderBottomColor: PC.border, paddingBottom: 3 }}>
        Analisis de causa — Diagrama de Ishikawa
      </Text>
      <Svg viewBox={`0 0 ${ISH_W} ${ISH_H}`} style={{ width: ISH_W, height: ISH_H }}>
        {/* Eje principal */}
        <Line x1="20" y1={ISH_MY} x2="540" y2={ISH_MY} stroke={PC.fieldValue} strokeWidth="2" />
        <Path d={`M530 ${ISH_MY - 6} L548 ${ISH_MY} L530 ${ISH_MY + 6} Z`} fill={PC.fieldValue} />

        {/* Caja EFECTO */}
        <Rect x="552" y={ISH_MY - 50} width="150" height="100" fill={PC.m13MentaSuave} stroke={PC.m13Navy} strokeWidth="1.5" rx="4" />
        <Text x="627" y={ISH_MY - 32} textAnchor="middle" fontFamily="Helvetica-Bold" fontSize="8" fill={PC.m13Navy}>EFECTO</Text>
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
              <Line x1={bx} y1={ISH_MY} x2={tx} y2={ty + 18} stroke={PC.m13Navy} strokeWidth="1.5" />
              <Rect x={tx - 40} y={ty - 14} width="82" height="16" fill={PC.m13Fondo} stroke={PC.border} strokeWidth="0.8" rx="2" />
              <Text x={tx + 1} y={ty - 4} textAnchor="middle" fontFamily="Helvetica-Bold" fontSize="6" fill={PC.m13Navy}>{ISH_ABOVE[i].label}</Text>
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
              <Line x1={bx} y1={ISH_MY} x2={tx} y2={ty - 18} stroke={PC.m13Navy} strokeWidth="1.5" />
              {contentLines.map((line, li) => (
                <Text key={li} x={tx - 40} y={ty - 26 + li * 9} fontFamily="Helvetica" fontSize="6" fill={PC.fieldValue}>{line}</Text>
              ))}
              <Rect x={tx - 40} y={ty - 2} width="82" height="16" fill={PC.m13MentaSuave} stroke={PC.m13Navy} strokeWidth="0.8" rx="2" />
              <Text x={tx + 1} y={ty + 9} textAnchor="middle" fontFamily="Helvetica-Bold" fontSize="6" fill={PC.m13Navy}>{ISH_BELOW[i].label}</Text>
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
      <PaginaEstandar
        trio={false}
        titulo="PLAN DE ACCIONES CORRECTIVAS"
        subtitulo={`Acciones correctivas  ·  ${terminoSitio}: ${ranchoNombre}`}
        codigoFmt="M26"
        folio={emision}
        emision={emision}
        detalleCompacto={`${terminoSitio}: ${ranchoNombre}  ·  Emisión: ${emision}  ·  Fecha: ${fechaTitulo}`}
        porRenglon={4}
        camposDatos={[
          { icono: 'calendario', etiqueta: 'Emisión', valor: emision },
          { icono: 'usuario', etiqueta: 'Organización', valor: fmt(orgNombre) },
          { icono: 'ubicacion', etiqueta: `Instalación / ${terminoSitio}`, valor: fmt(ranchoNombre) },
          { icono: 'calendario', etiqueta: 'Fecha', valor: fechaTitulo },
        ]}
      >
        {/* Nota */}
        <View wrap={false} style={{ padding: 8, borderRadius: 6, marginBottom: 14, backgroundColor: PC.m13Fondo }}>
          <Text style={{ fontSize: 7.5, color: PC.textSub, lineHeight: 1.4 }}>
            Las no-conformidades deben atenderse en un maximo de 30 dias naturales a partir de la fecha de deteccion.
            Conserve evidencia documental del cierre de cada accion correctiva.
          </Text>
        </View>

        {/* Tabla resumen */}
        <TituloSeccion texto={`ACCIONES CORRECTIVAS (${acciones.length})`} />
        {acciones.length === 0 ? (
          <Text style={{ fontSize: 9, color: PC.textSub }}>Sin no-conformidades registradas.</Text>
        ) : (
          <AccionesTabla acciones={acciones} />
        )}

        {/* Fichas + Ishikawa por no-conformidad */}
        {acciones.map((a, i) => {
          const hasIsh = a.ishikawa && Object.values(a.ishikawa).some((v) => v?.trim())
          return (
            <View key={i}>
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
      </PaginaEstandar>
    </Document>
  )
}
