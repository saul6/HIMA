// PDF M80 — Reporte de visita del Checklist de documentos (A4 horizontal).
// Mismo sistema visual que el M13 rediseñado (raya menta, franja de datos, títulos con barra,
// líneas finas, encabezado compacto en páginas 2+, pie y marca de agua). Los estilos se
// copian aquí a propósito: no se toca nada de m13/ ni de components/.
// Helvetica built-in, sin Unicode especial; iconos vectoriales (Svg). Los saltos de página
// se calculan antes de dibujar (cursor de altura estimada, conservador) para repetir el
// encabezado de cada tabla en la página nueva.

import { Document, Page, View, Text, Image, Svg, Path, Rect, Circle, StyleSheet } from '@react-pdf/renderer'
import type { ReactNode } from 'react'
import { LOGO_MADY_PDF } from '@/lib/pdf/assets/logoMadyPdf'
import { ISOTIPO_MARCA_AGUA } from '@/lib/pdf/disenoNuevo/isotipoMarcaAgua'
import { PdfFirmas } from '@/lib/pdf/disenoNuevo/PdfFirmas'
import { PC } from '@/lib/pdf/components/tokens'
import { partirParaAncho } from '@/lib/pdf/disenoNuevo/medirTexto'
import { TextoLargo, esTextoLargo, resumenTexto } from '@/lib/pdf/disenoNuevo/TextoLargo'
import { codigoFormato } from '@/lib/codigoFormato'
import type { FirmaParaPdf, FirmaEnteradoParaPdf } from '@/hooks/useFirmasRegistro'
import { SIN_ENCOGER } from '@/lib/pdf/disenoNuevo/estilos'

// ── Tipos (forma de chk_visita_reporte) ───────────────────────────────────────

export type EstadoRev = 'al_dia' | 'actualizar' | 'corregir' | 'faltan_firmas' | 'sin_reportes' | 'otro'

export interface ReporteVisitaItem {
  id: string
  tipo: 'modulo' | 'formato' | 'documento'
  area: string | null
  codigo_formato: string | null
  modulo_codigo: string | null
  nombre: string
  responsable: string | null
  frecuencia: string | null
  vence_el: string | null
  revisado_en_visita: boolean
  revision: {
    estado: EstadoRev
    observacion: string | null
    notas_auto: { tipo: string; texto: string }[] | null
    revisado_en: string
    revisado_por: string | null
  } | null
  revision_anterior: { estado: EstadoRev; observacion: string | null; revisado_en: string } | null
}

export interface ReporteVisita {
  organizacion: { nombre: string }
  sitio: { id: string; nombre: string; codigo: string | null }
  visita: {
    id: string
    fecha: string
    estado: string
    realizada_en: string | null
    revisor: string | null
    nota: string | null
    fecha_original: string | null
    nota_cierre: string | null
    reprogramaciones: { fecha_anterior: string; fecha_nueva: string; motivo: string | null; creado_en: string }[] | null
  }
  resumen: {
    total: number
    revisados: number
    no_revisados: number
    por_estado: Partial<Record<EstadoRev, number>>
  }
  items: ReporteVisitaItem[]
}

export interface ChecklistVisitaPDFProps {
  reporte: ReporteVisita
  codigoClave?: string
  terminoSitio?: string
  firmaRealizo?: FirmaParaPdf | null
  firmaVerifico?: FirmaParaPdf | null
  firmaEnterado?: FirmaEnteradoParaPdf | null
}

// ── Constantes visuales ───────────────────────────────────────────────────────

const PAD_TOP = 40
const PAD_X = 40
const ANCHO = 842 - PAD_X * 2   // A4 horizontal

// Estados: texto con color suave. Tonos de la paleta oficial (theme.css):
//   verde-azul = --agro-success-text, ámbar = propio del PDF, rojo = --agro-danger-text.
const C_OK = '#0D5A8F'
const C_AMBAR = '#854F0B'
const C_ROJO = '#993C1D'
const C_NEUTRO = PC.textSub

const ESTADOS: { clave: EstadoRev; label: string; color: string; fondo: string }[] = [
  { clave: 'al_dia', label: 'Al día', color: C_OK, fondo: '#E3F2FD' },            // --agro-success-fill
  { clave: 'actualizar', label: 'Actualizar', color: C_AMBAR, fondo: '#FAEEDA' }, // ámbar propio del PDF
  { clave: 'corregir', label: 'Corregir', color: C_ROJO, fondo: '#FAECE7' },      // --agro-danger-fill
  { clave: 'faltan_firmas', label: 'Faltan firmas', color: C_AMBAR, fondo: '#FAEEDA' },
  { clave: 'sin_reportes', label: 'Sin reportes', color: C_NEUTRO, fondo: PC.m13Fondo },
  { clave: 'otro', label: 'Otro', color: C_NEUTRO, fondo: PC.m13Fondo },
]
const estadoInfo = (e: EstadoRev) => ESTADOS.find((x) => x.clave === e) ?? ESTADOS[5]

const s = StyleSheet.create({
  page: {
    fontFamily: 'Helvetica',
    fontSize: 8,
    color: PC.m13Texto,
    paddingTop: PAD_TOP,
    paddingBottom: 56,
    paddingLeft: PAD_X,
    paddingRight: PAD_X,
    backgroundColor: PC.white,
  },
  th: {
    fontFamily: 'Helvetica-Bold',
    fontSize: 7.5,
    color: PC.m13Navy,
    paddingTop: 5,
    paddingBottom: 5,
    paddingLeft: 6,
    borderBottomWidth: 1,
    borderBottomColor: PC.m13Navy,
  },
  td: { paddingTop: 4, paddingBottom: 4, paddingLeft: 6, paddingRight: 4, flexShrink: 0 },
  fila: { flexDirection: 'row', borderBottomWidth: 0.5, borderBottomColor: PC.border },
  obs: { fontSize: 8, lineHeight: 1.3 },
  nota: { fontSize: 7, color: PC.textSub, lineHeight: 1.3, marginTop: 3 },
})

// ── Fechas (sin Date: evita correr el día por zona horaria) ───────────────────

const MESES = ['enero', 'febrero', 'marzo', 'abril', 'mayo', 'junio', 'julio', 'agosto', 'septiembre', 'octubre', 'noviembre', 'diciembre']

function partes(iso: string | null | undefined): [number, number, number] | null {
  if (!iso) return null
  const [y, m, d] = iso.slice(0, 10).split('-').map(Number)
  return y && m && d ? [y, m, d] : null
}
function fechaLarga(iso: string | null | undefined, conAnio = false): string {
  const p = partes(iso)
  if (!p) return ''
  return `${p[2]} de ${MESES[p[1] - 1]}${conAnio ? ` de ${p[0]}` : ''}`
}

// ── Iconos ────────────────────────────────────────────────────────────────────

type IconoNombre = 'usuario' | 'calendario' | 'sitio' | 'revisados'

function Icono({ nombre, size = 10, color = PC.m13Navy }: { nombre: IconoNombre; size?: number; color?: string }) {
  const p = { stroke: color, strokeWidth: 2, fill: 'none', strokeLinecap: 'round', strokeLinejoin: 'round' } as const
  let cuerpo: ReactNode
  switch (nombre) {
    case 'usuario':
      cuerpo = (<><Circle cx={12} cy={8} r={4} {...p} /><Path d="M4 21 C4 16 8 14 12 14 C16 14 20 16 20 21" {...p} /></>)
      break
    case 'calendario':
      cuerpo = (<><Rect x={3} y={5} width={18} height={16} rx={2} {...p} /><Path d="M3 10 H21 M8 3 V7 M16 3 V7" {...p} /></>)
      break
    case 'sitio':
      cuerpo = (<><Path d="M12 21 C12 21 5 14 5 9 A7 7 0 0 1 19 9 C19 14 12 21 12 21 Z" {...p} /><Circle cx={12} cy={9} r={2.5} {...p} /></>)
      break
    case 'revisados':
      cuerpo = (<><Rect x={5} y={3} width={14} height={18} rx={2} {...p} /><Path d="M9 12 L11 14 L15 9" {...p} /></>)
      break
  }
  return <Svg viewBox="0 0 24 24" width={size} height={size}>{cuerpo}</Svg>
}

// ── Estimación de alturas (conservadora, para repartir páginas) ───────────────

const CAP_RESTO = 445   // descuenta el encabezado compacto de las páginas 2+
const lineas = (texto: string, ancho: number, tam: number) => {
  const porLinea = Math.max(1, Math.floor((ancho - 10) / (tam * 0.5)))
  return texto.split('\n').reduce((n, l) => n + Math.max(1, Math.ceil(l.length / porLinea)), 0)
}

// ── Piezas ────────────────────────────────────────────────────────────────────

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
        <Icono nombre={icono} />
        <Text style={{ fontSize: 7, color: PC.textSub, marginLeft: 4 }}>{etiqueta}</Text>
      </View>
      <Text style={{ fontFamily: 'Helvetica-Bold', fontSize: 9, color: PC.m13Navy }} hyphenationCallback={partirParaAncho(160, 9, true)}>
        {valor}
      </Text>
    </View>
  )
}

function TituloSeccion({ texto, salto }: { texto: string; salto?: boolean }) {
  return (
    <View break={salto} style={{ flexDirection: 'row', alignItems: 'center', marginBottom: 6 }}>
      <View style={{ width: 3, height: 13, backgroundColor: PC.m13Menta, marginRight: 7 }} />
      <Text style={{ fontFamily: 'Helvetica-Bold', fontSize: 10, color: PC.m13Navy }}>{texto}</Text>
    </View>
  )
}

interface Col { titulo: string; ancho?: number; resto?: number }

function EncabezadoTabla({ cols, salto }: { cols: Col[]; salto?: boolean }) {
  return (
    <View break={salto} style={{ flexDirection: 'row', marginBottom: 2 }}>
      {cols.map((c, i) => (
        <Text key={i} style={{ ...s.th, width: c.ancho ?? c.resto, flexShrink: 0 }}>{c.titulo}</Text>
      ))}
    </View>
  )
}

function Marca() {
  return (
    <View
      fixed
      style={{ position: 'absolute', top: 0, left: 0, right: 0, bottom: 0, alignItems: 'center', justifyContent: 'center' }}
    >
      <Image src={ISOTIPO_MARCA_AGUA} style={{ width: 250, height: 250, opacity: 0.07 }} />
    </View>
  )
}

function Pie() {
  return (
    <View
      fixed
      style={{
        position: 'absolute',
        bottom: 18,
        left: PAD_X,
        right: PAD_X,
        borderTopWidth: 0.75,
        borderTopColor: PC.border,
        paddingTop: 5,
        flexDirection: 'row',
        alignItems: 'center',
      }}
    >
      <Text style={{ flex: 1, fontSize: 7, color: PC.footerGray }}>M80</Text>
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
  )
}

// Sin Svg ni filas anidadas: dentro del render de un elemento fixed react-pdf no las calcula bien.
function EncabezadoCompacto({ subtitulo }: { subtitulo: string }) {
  return (
    <View>
      <View style={{ flexDirection: 'row', justifyContent: 'space-between', paddingBottom: 6 }}>
        <View style={{ flex: 1, paddingRight: 8 }}>
          <Text style={{ fontFamily: 'Helvetica-Bold', fontSize: 11, color: PC.m13Navy }}>CHECKLIST DE DOCUMENTOS</Text>
          <Text style={{ fontSize: 7, color: PC.textSub, marginTop: 1 }}>{subtitulo}</Text>
        </View>
        <Image src={LOGO_MADY_PDF} style={{ height: 22, width: 61 }} />
      </View>
      <View style={{ borderTopWidth: 0.75, borderTopColor: PC.border, marginBottom: 10 }} />
    </View>
  )
}

// ── Contenido ─────────────────────────────────────────────────────────────────

const COLS_FORMATOS: Col[] = [
  { titulo: 'ÁREA', ancho: 90 },
  { titulo: 'CÓDIGO', ancho: 80 },
  { titulo: 'FORMATO', ancho: 170 },
  { titulo: 'RESPONSABLE', ancho: 105 },
  { titulo: 'ESTADO', ancho: 75 },
  { titulo: 'OBSERVACIONES', resto: ANCHO - 520 },
]
const COLS_DOCS: Col[] = [
  { titulo: 'DOCUMENTO', ancho: 230 },
  { titulo: 'VENCE EL', ancho: 95 },
  { titulo: 'ESTADO', ancho: 80 },
  { titulo: 'OBSERVACIONES', resto: ANCHO - 405 },
]
const OBS_ANCHO = ANCHO - 520
const OBS_DOCS_ANCHO = ANCHO - 405

function notasTexto(i: ReporteVisitaItem): string[] {
  return (i.revision?.notas_auto ?? []).map((n) => n.texto).filter(Boolean)
}

/** Observación larga: en la celda queda un resumen y el texto completo va a lo ancho bajo el renglón (kit TextoLargo). */
function obsLarga(item: ReporteVisitaItem, width: number): string | null {
  const obs = item.revision?.observacion?.trim()
  return obs && esTextoLargo(obs, width - 10, 8) ? obs : null
}

function BloqueObs({ item, width }: { item: ReporteVisitaItem; width: number }) {
  const obs = obsLarga(item, width)
  return obs ? <TextoLargo etiqueta="Observaciones" texto={obs} ancho={ANCHO} fuente={8} conLinea /> : null
}

function CeldaObs({ item, width }: { item: ReporteVisitaItem; width: number }) {
  const larga = obsLarga(item, width)
  const obs = larga ? resumenTexto(larga, width - 10, 8) : item.revision?.observacion?.trim()
  const notas = notasTexto(item)
  return (
    <View style={{ ...s.td, width }}>
      {obs ? <Text style={s.obs} hyphenationCallback={partirParaAncho(width - 10, 8)}>{obs}</Text> : null}
      {notas.map((n, i) => (
        <Text key={i} style={s.nota} hyphenationCallback={partirParaAncho(width - 10, 7)}>{`- ${n}`}</Text>
      ))}
    </View>
  )
}

function CeldaEstado({ estado, ancho }: { estado: EstadoRev | null; ancho: number }) {
  const info = estado ? estadoInfo(estado) : null
  return (
    <View style={{ width: ancho, ...s.td }}>
      <Text style={{ fontFamily: 'Helvetica-Bold', fontSize: 8, color: info?.color ?? PC.footerGray }}>
        {info?.label ?? 'Sin revisar'}
      </Text>
    </View>
  )
}

function alturaObs(i: ReporteVisitaItem, ancho: number): number {
  const larga = obsLarga(i, ancho)
  const obs = larga ? resumenTexto(larga, ancho - 10, 8) : i.revision?.observacion?.trim()
  const notas = notasTexto(i)
  return (obs ? lineas(obs, ancho, 8) * 10.8 : 0) + notas.reduce((n, t) => n + lineas(`- ${t}`, ancho, 7) * 9.6, 0)
}

function FilaFormato({ item, codigoClave, partible }: { item: ReporteVisitaItem; codigoClave: string; partible?: boolean }) {
  const codigo = item.codigo_formato ? codigoFormato(item.codigo_formato, codigoClave) : ''
  return (
    <>
    <View {...(partible ? {} : { wrap: false })} style={s.fila}>
      <Text style={{ ...s.td, width: 90 }} hyphenationCallback={partirParaAncho(78, 8)}>{item.area ?? ''}</Text>
      <Text style={{ ...s.td, width: 80 }} hyphenationCallback={partirParaAncho(68, 8)}>{codigo}</Text>
      <Text style={{ ...s.td, width: 170, fontFamily: 'Helvetica-Bold' }} hyphenationCallback={partirParaAncho(158, 8, true)}>{item.nombre}</Text>
      <Text style={{ ...s.td, width: 105 }} hyphenationCallback={partirParaAncho(93, 8)}>{item.responsable ?? ''}</Text>
      <CeldaEstado estado={item.revision?.estado ?? null} ancho={75} />
      <CeldaObs item={item} width={OBS_ANCHO} />
    </View>
    <BloqueObs item={item} width={OBS_ANCHO} />
    </>
  )
}

function FilaDocumento({ item, fechaVisita, partible }: { item: ReporteVisitaItem; fechaVisita: string; partible?: boolean }) {
  const vencido = !!item.vence_el && item.vence_el.slice(0, 10) < fechaVisita.slice(0, 10)
  return (
    <>
    <View {...(partible ? {} : { wrap: false })} style={s.fila}>
      <Text style={{ ...s.td, width: 230, fontFamily: 'Helvetica-Bold' }} hyphenationCallback={partirParaAncho(218, 8, true)}>{item.nombre}</Text>
      <View style={{ width: 95, ...s.td }}>
        <Text>{item.vence_el ? fechaLarga(item.vence_el, true) : 'Sin vencimiento'}</Text>
        {vencido && <Text style={{ fontFamily: 'Helvetica-Bold', fontSize: 7, color: C_ROJO, marginTop: 1 }}>Vencido</Text>}
      </View>
      <CeldaEstado estado={item.revision?.estado ?? null} ancho={80} />
      <CeldaObs item={item} width={OBS_DOCS_ANCHO} />
    </View>
    <BloqueObs item={item} width={OBS_DOCS_ANCHO} />
    </>
  )
}

/** Altura estimada de una fila de la tabla de formatos. */
const alturaFormato = (i: ReporteVisitaItem) => Math.max(
  8 + lineas(i.nombre, 170, 8) * 10.8,
  8 + lineas(i.area ?? '', 90, 8) * 10.8,
  8 + lineas(i.responsable ?? '', 105, 8) * 10.8,
  8 + alturaObs(i, OBS_ANCHO),
  22,
)
/** Altura estimada de una fila de la tabla de documentos. */
const alturaDocumento = (i: ReporteVisitaItem) => Math.max(
  8 + lineas(i.nombre, 230, 8) * 10.8,
  8 + alturaObs(i, OBS_DOCS_ANCHO),
  26,
)

function ultimaRevision(i: ReporteVisitaItem): string {
  const r = i.revision_anterior
  if (!r) return 'Sin revisiones'
  return `Última revisión: ${fechaLarga(r.revisado_en, true)} (${estadoInfo(r.estado).label})`
}

/**
 * Tabla con encabezado repetido en cada página (encabezado fijo). El título, el encabezado y la primera fila
 * viajan juntos: una caja de alto cero con `minPresenceAhead` antes del título manda todo a la hoja siguiente si
 * no caben.
 */
function Tabla({
  titulo, cols, filas, alturas,
}: {
  titulo: string
  cols: Col[]
  filas: ReactNode[]
  alturas: number[]
}) {
  const primera = Math.min(alturas[0] ?? 22, CAP_RESTO * 0.5)
  return (
    <>
      <View minPresenceAhead={22 + 22 + primera} style={{ height: 0 }} />
      <TituloSeccion texto={titulo} />
      <View style={{ marginBottom: 14, ...SIN_ENCOGER }}>
        <View fixed style={SIN_ENCOGER}>
          <EncabezadoTabla cols={cols} />
        </View>
        {filas}
      </View>
    </>
  )
}

// ── Página ────────────────────────────────────────────────────────────────────

export function ChecklistVisitaPDF({
  reporte, codigoClave = '', terminoSitio = 'Rancho', firmaRealizo, firmaVerifico, firmaEnterado,
}: ChecklistVisitaPDFProps) {
  const { visita, sitio, resumen } = reporte
  const enCurso = visita.estado !== 'realizada'
  const nombreSitio = `${sitio.nombre}${sitio.codigo ? ` (${sitio.codigo})` : ''}`
  const subtitulo = `Reporte de visita${enCurso ? ' · en curso' : ''} · ${nombreSitio}`

  const fechaTxt = visita.fecha_original && visita.fecha_original.slice(0, 10) !== visita.fecha.slice(0, 10)
    ? `${fechaLarga(visita.fecha)} (programada el ${partes(visita.fecha_original)?.[2]})`
    : fechaLarga(visita.fecha, true)

  const revisados = reporte.items.filter((i) => i.revisado_en_visita)
  const formatos = revisados.filter((i) => i.tipo !== 'documento')
  const documentos = reporte.items.filter((i) => i.tipo === 'documento')
  const sinRevisar = reporte.items.filter((i) => !i.revisado_en_visita && i.frecuencia !== 'no_aplica' && i.tipo !== 'documento')

  const pildoras = ESTADOS.filter((e) => (resumen.por_estado?.[e.clave] ?? 0) > 0)
  const reprog = visita.reprogramaciones ?? []
  const nota = visita.nota_cierre?.trim()

  const tablaFormatos = formatos.length > 0 && (
    <Tabla
      titulo="FORMATOS REVISADOS"
      cols={COLS_FORMATOS}
      filas={formatos.map((i) => <FilaFormato key={i.id} item={i} codigoClave={codigoClave} partible={alturaFormato(i) > CAP_RESTO * 0.85} />)}
      alturas={formatos.map(alturaFormato)}
    />
  )

  const tablaDocs = documentos.length > 0 && (
    <Tabla
      titulo="DOCUMENTOS"
      cols={COLS_DOCS}
      filas={documentos.map((i) => <FilaDocumento key={i.id} item={i} fechaVisita={visita.fecha} partible={alturaDocumento(i) > CAP_RESTO * 0.85} />)}
      alturas={documentos.map(alturaDocumento)}
    />
  )

  // Sin revisar: 2 columnas, cada fila del grid = un par
  const pares: ReporteVisitaItem[][] = []
  for (let i = 0; i < sinRevisar.length; i += 2) pares.push(sinRevisar.slice(i, i + 2))
  const MITAD = ANCHO / 2
  const tablaSinRevisar = pares.length > 0 && (
    <Tabla
      titulo="SIN REVISAR EN ESTA VISITA"
      cols={[{ titulo: 'FORMATO Y ÚLTIMA REVISIÓN', resto: ANCHO }]}
      filas={pares.map((par, idx) => (
        <View key={idx} wrap={false} style={s.fila}>
          {par.map((i) => (
            <View key={i.id} style={{ width: MITAD, ...s.td }}>
              <Text style={{ fontFamily: 'Helvetica-Bold', fontSize: 8 }} hyphenationCallback={partirParaAncho(MITAD - 16, 8, true)}>
                {[i.codigo_formato ? codigoFormato(i.codigo_formato, codigoClave) : null, i.nombre].filter(Boolean).join(' · ')}
              </Text>
              <Text style={s.nota}>{ultimaRevision(i)}</Text>
            </View>
          ))}
        </View>
      ))}
      alturas={pares.map((par) => Math.max(
        ...par.map((i) => 8 + lineas([i.codigo_formato, i.nombre].filter(Boolean).join(' · '), MITAD - 10, 8) * 10.8 + 9.6),
      ))}
    />
  )

  return (
    <Document
      title={`Checklist de documentos ${visita.fecha}`}
      author="M.A.D.Y."
      creator="M.A.D.Y. Inocuidad Inteligente"
      producer="M.A.D.Y. Inocuidad Inteligente"
      subject="Reporte de visita del Checklist de documentos"
      keywords="MADY, inocuidad, checklist, visita"
    >
      <Page size="A4" orientation="landscape" style={s.page}>
        <Marca />
        <View
          fixed
          render={({ subPageNumber }) => (subPageNumber !== 1 ? <EncabezadoCompacto subtitulo={subtitulo} /> : <View />)}
        />
        <Pie />

        {/* Encabezado página 1 */}
        <View style={{ flexDirection: 'row', alignItems: 'flex-start', justifyContent: 'space-between' }}>
          <View style={{ flex: 1, paddingRight: 12 }}>
            <View style={{ width: 28, height: 3, backgroundColor: PC.m13Menta, marginBottom: 8 }} />
            <Text style={{ fontFamily: 'Helvetica-Bold', fontSize: 20, color: PC.m13Navy }}>CHECKLIST DE DOCUMENTOS</Text>
            <Text style={{ fontSize: 8, color: PC.textSub, marginTop: 4 }} hyphenationCallback={partirParaAncho(590, 8)}>
              Reporte de visita{enCurso ? <Text style={{ fontFamily: 'Helvetica-Bold' }}> · en curso</Text> : ''} · {nombreSitio}
            </Text>
          </View>
          <Image src={LOGO_MADY_PDF} style={{ height: 36, width: 101 }} />
        </View>
        <View style={{ borderTopWidth: 0.75, borderTopColor: PC.border, marginTop: 10, marginBottom: 10 }} />

        {/* Franja de datos */}
        <View style={{ flexDirection: 'row', backgroundColor: PC.m13Fondo, borderRadius: 6, padding: 10, marginBottom: 14 }}>
          <DatoFranja primero icono="usuario" etiqueta="Revisó" valor={visita.revisor ?? '-'} />
          <DatoFranja icono="calendario" etiqueta="Fecha de la visita" valor={fechaTxt} />
          <DatoFranja icono="sitio" etiqueta={terminoSitio} valor={nombreSitio} />
          <DatoFranja icono="revisados" etiqueta="Revisados" valor={`${resumen.revisados} de ${resumen.total}`} />
        </View>

        {/* Resumen */}
        <View style={{ marginBottom: 14 }}>
          <TituloSeccion texto="RESUMEN" />
          {pildoras.length > 0 && (
            <View style={{ flexDirection: 'row', flexWrap: 'wrap', marginBottom: 6 }}>
              {pildoras.map((p) => (
                <Text
                  key={p.clave}
                  style={{
                    backgroundColor: p.fondo, color: p.color, fontFamily: 'Helvetica-Bold', fontSize: 7.5,
                    paddingTop: 2, paddingBottom: 2, paddingLeft: 7, paddingRight: 7, borderRadius: 8,
                    marginRight: 6, marginBottom: 4,
                  }}
                >
                  {`${p.label} · ${resumen.por_estado[p.clave]}`}
                </Text>
              ))}
            </View>
          )}
          {nota ? (
            <Text style={{ fontSize: 8, lineHeight: 1.4 }} hyphenationCallback={partirParaAncho(ANCHO - 4, 8)}>
              <Text style={{ fontFamily: 'Helvetica-Bold', color: PC.m13Navy }}>Observación general: </Text>{nota}
            </Text>
          ) : null}
          {reprog.map((r, i) => (
            <Text key={i} style={{ fontSize: 7.5, color: PC.textSub, marginTop: 2 }} hyphenationCallback={partirParaAncho(ANCHO - 4, 7.5)}>
              {`Reprogramada: ${fechaLarga(r.fecha_anterior)} al ${fechaLarga(r.fecha_nueva)}${r.motivo ? ` · ${r.motivo}` : ''}`}
            </Text>
          ))}
        </View>

        {tablaFormatos}
        {tablaDocs}
        {tablaSinRevisar}

        <PdfFirmas
          signatures={[
            { label: 'Realizó la visita', nombre: visita.revisor ?? '', caption: 'Realizó - Firma', firma: firmaRealizo ?? null },
            { label: '', nombre: '', caption: 'Verificó - Firma', firma: firmaVerifico ?? null },
          ]}
          enterado={firmaEnterado ?? null}
        />
      </Page>
    </Document>
  )
}
