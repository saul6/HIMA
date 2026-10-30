// PDF M80 — Reporte de visita del Checklist (v2). Se arma SOLO del snapshot de chk_vis_reporte
// (o de chk_vis_preview, con la marca "Vista previa — no válido", si la visita aún no cierra).
// Kit compartido: src/lib/pdf/disenoNuevo (PaginaEstandar, TablaDatos, PdfFirmas).
import { Document, Text } from '@react-pdf/renderer'
import { PaginaEstandar, Seccion, fechaEmisionHoy } from '@/lib/pdf/disenoNuevo/PaginaEstandar'
import { TablaDatos, type CeldaDato, type ColumnaDato, type FilaBanda } from '@/lib/pdf/disenoNuevo/TablaDatos'
import { FranjaDatos } from '@/lib/pdf/disenoNuevo/Franja'
import { PdfFirmas } from '@/lib/pdf/disenoNuevo/PdfFirmas'
import { fechaPdf } from '@/lib/pdf/disenoNuevo/fechas'
import { PC } from '@/lib/pdf/components/tokens'
import type { FirmaParaPdf } from '@/hooks/useFirmasRegistro'
import type { Reporte, ReporteDoc } from '@/hooks/useChecklistV2'

interface Props {
  reporte: Reporte
  /** true = la visita sigue en curso: se imprime la marca de vista previa. */
  vistaPrevia?: boolean
  firmaRealizo?: FirmaParaPdf | null
}

const ETIQUETA_CAMPO: Record<string, string> = {
  revision: 'Rev', responsable_llenado: 'Responsable', ultimo_registro_fecha: 'Fecha de registro',
  ultimo_registro_texto: 'Último registro', ultimo_registro_precision: 'Precisión', vence_el: 'Vence',
}

const val = (v: unknown) => {
  if (v == null || v === '') return '(vacío)'
  const s = String(v)
  return /^\d{4}-\d{2}-\d{2}/.test(s) ? fechaPdf(s) : s
}

function detalleCambios(d: ReporteDoc): string[] {
  const out: string[] = []
  for (const [k, v] of Object.entries(d.cambios ?? {})) {
    if (k === 'ultimo_registro_precision') continue
    const o = v as { antes?: unknown; despues?: unknown } | null
    const etiqueta = ETIQUETA_CAMPO[k] ?? k
    if (o && typeof o === 'object' && ('antes' in o || 'despues' in o)) out.push(`${etiqueta}: ${val(o.antes)} -> ${val(o.despues)}`)
    else out.push(`${etiqueta}: ${val(v)}`)
  }
  return out
}

const ESTADO_TXT: Record<ReporteDoc['estado'], string> = {
  correcto: 'Verificado', incidencia: 'No conforme', pendiente: 'Pendiente', no_aplica: 'No aplica', sin_revisar: 'Sin revisar',
}
const NOMBRE_SECCION: Record<number, string> = { 1: 'TABLA 1 · FORMATOS', 2: 'TABLA 2 · CONTROLES COMPLEMENTARIOS', 3: 'TABLA 3 · ORGÁNICO' }
const VIGENCIA_TXT: Record<string, string> = { vigente: '', proximo: 'Por vencer', vencido: 'Vencido', sin_dato: '' }

const COLS_DOCS: ColumnaDato[] = [
  { texto: 'Código', ancho: 70 },
  { texto: 'Documento', ancho: 150 },
  { texto: 'Rev', ancho: 24, align: 'center' },
  { texto: 'Último registro documental', ancho: 70 },
  { texto: 'Vence', ancho: 52 },
  { texto: 'Estado', ancho: 62 },
  { texto: 'Detalle', ancho: 156 },
]
// Tabla 2 y Tabla 3 no llevan código ni revisión
const COLS_SIN_CODIGO: ColumnaDato[] = [
  { texto: 'Documento', ancho: 214 },
  { texto: 'Último registro documental', ancho: 80 },
  { texto: 'Estado', ancho: 62 },
  { texto: 'Detalle', ancho: 158 },
]

function filasDocs(docs: ReporteDoc[], conCodigo: boolean): (CeldaDato[] | FilaBanda)[] {
  const filas: (CeldaDato[] | FilaBanda)[] = []
  let area: string | null = null
  for (const d of docs) {
    const a = d.area?.trim() || d.categoria?.trim() || 'Sin área'
    if (a !== area) { filas.push({ banda: a }); area = a }
    const detalle = [
      ...(d.actualizado ? ['Actualizado: ' + detalleCambios(d).join('; ')] : []),
      ...(d.incidencia ? ['Incidencia: ' + d.incidencia] : []),
      ...(d.observacion ? [d.observacion] : []),
    ].join('\n')
    const estado = d.estado === 'correcto' && d.actualizado ? 'Actualizado' : ESTADO_TXT[d.estado]
    // Rojo solo en la columna de estado de "No conforme"
    const celdaEstado: CeldaDato = d.estado === 'incidencia' ? { texto: estado, color: PC.negativo } : estado
    if (conCodigo) {
      filas.push([
        d.codigo ?? '',
        d.nombre,
        d.revision ?? '',
        d.ultimo_registro ?? '',
        [d.vence_el ? fechaPdf(d.vence_el) : '', VIGENCIA_TXT[d.vigencia] ?? ''].filter(Boolean).join(' '),
        celdaEstado,
        detalle,
      ])
    } else {
      filas.push([d.nombre, d.ultimo_registro ?? '', celdaEstado, detalle])
    }
  }
  return filas
}

const COLS_INC: ColumnaDato[] = [
  { texto: 'Documento', ancho: 130 },
  { texto: 'Descripción', ancho: 190 },
  { texto: 'Tipo', ancho: 50 },
  { texto: 'Estado', ancho: 62 },
  { texto: 'Responsable', ancho: 70 },
  { texto: 'Compromiso', ancho: 56 },
  { texto: 'Último seguimiento', ancho: 100 },
]

const ESTADO_INC: Record<string, string> = { abierta: 'Abierta', seguimiento: 'En seguimiento', correccion_reportada: 'Corrección reportada', cerrada: 'Cerrada' }

export function ReporteVisitaPDF({ reporte, vistaPrevia = false, firmaRealizo }: Props) {
  const { visita, resumen } = reporte
  const tipoCierre = visita.tipo_cierre === 'parcial' ? 'Parcial' : 'Completo'
  const subtitulo = `${vistaPrevia ? 'Vista previa - no válido · ' : ''}Reporte de visita · ${reporte.instalacion}`
  const justificacion = visita.justificacion_parcial?.trim()
  const observaciones = visita.observaciones_generales?.trim()
  // La Tabla 3 solo aparece si estuvo activa; los snapshots anteriores a v1.4 solo traen documentos de la Tabla 1
  const presentes = new Set(reporte.documentos.map(d => d.seccion ?? 1))
  const secciones = [1, 2, 3].filter(n => presentes.has(n) || n === 1 || (n === 2 && !!reporte.secciones?.['2']))
  const notas = (reporte.notas ?? []).filter(n => n.antecedentes?.trim())

  return (
    <Document
      title={`Checklist de documentos ${visita.fecha}`}
      author="M.A.D.Y."
      creator="M.A.D.Y. Inocuidad Inteligente"
      producer="M.A.D.Y. Inocuidad Inteligente"
      subject="Reporte de visita del Checklist de documentos"
      keywords="MADY, inocuidad, checklist, visita"
    >
      <PaginaEstandar
        orientacion="landscape"
        titulo="CHECKLIST DE DOCUMENTOS"
        subtitulo={subtitulo}
        codigoFmt="M80"
        folio=""
        emision={fechaEmisionHoy()}
        sinFolio
        porRenglon={4}
        detalleCompacto={`Reporte de visita · ${reporte.instalacion} · ${fechaPdf(visita.fecha)}`}
        camposDatos={[
          { icono: 'usuario', etiqueta: 'Cliente', valor: reporte.cliente },
          { icono: 'sitio', etiqueta: 'Instalación', valor: reporte.instalacion },
          ...(reporte.alcance ? [{ icono: 'sitio' as const, etiqueta: 'Alcance', valor: reporte.alcance }] : []),
          { icono: 'calendario', etiqueta: 'Fecha de la visita', valor: fechaPdf(visita.fecha) },
          { icono: 'usuario', etiqueta: 'Asesora', valor: visita.asesor ?? '-' },
          { icono: 'revisados', etiqueta: 'Tipo de cierre', valor: vistaPrevia ? 'Pendiente' : tipoCierre },
          { icono: 'sitio', etiqueta: 'Consultoría', valor: reporte.consultoria },
        ]}
      >
        {vistaPrevia ? (
          <Text style={{ fontFamily: 'Helvetica-Bold', fontSize: 9, color: PC.negativo, marginBottom: 6 }}>
            VISTA PREVIA - NO VÁLIDO. La visita sigue en curso; este documento no es el reporte oficial.
          </Text>
        ) : null}

        <Seccion titulo="RESUMEN">
          <FranjaDatos
            porRenglon={4}
            anchoTotal={841.89 - 80}
            margenInferior={8}
            campos={[
              { etiqueta: 'Aplicables', valor: String(resumen.aplicables) },
              { etiqueta: 'Verificados', valor: String(resumen.correctos) },
              { etiqueta: 'No conformes', valor: String(resumen.con_incidencia) },
              { etiqueta: 'Pendientes', valor: String(resumen.pendientes ?? 0) },
              { etiqueta: 'No aplica', valor: String(resumen.no_aplica ?? 0) },
              { etiqueta: 'Sin revisar', valor: String(resumen.sin_revisar) },
              { etiqueta: 'Actualizados', valor: String(resumen.actualizados) },
              { etiqueta: 'Vencidos', valor: String(resumen.vencidos) },
            ]}
          />
          {reporte.organico?.plantilla_disponible && !reporte.organico.activo ? (
            <Text style={{ fontSize: 8, lineHeight: 1.4, marginBottom: 4 }}>Alcance: la revisión orgánica no formó parte de esta visita</Text>
          ) : null}
          {justificacion ? (
            <Text style={{ fontSize: 8, lineHeight: 1.4, marginBottom: 4 }}>
              <Text style={{ fontFamily: 'Helvetica-Bold', color: PC.m13Navy }}>Justificación del cierre parcial: </Text>{justificacion}
            </Text>
          ) : null}
          {observaciones ? (
            <Text style={{ fontSize: 8, lineHeight: 1.4 }}>
              <Text style={{ fontFamily: 'Helvetica-Bold', color: PC.m13Navy }}>Observaciones generales: </Text>{observaciones}
            </Text>
          ) : null}
        </Seccion>

        {secciones.map(n => {
          const docs = reporte.documentos.filter(d => (d.seccion ?? 1) === n)
          const x = reporte.secciones?.[String(n)]
          return (
            <Seccion key={n} titulo={NOMBRE_SECCION[n] ?? `SECCIÓN ${n}`}>
              {x ? (
                <Text style={{ fontSize: 8, marginBottom: 4 }}>
                  {x.aplicables - x.sin_revisar} de {x.aplicables} revisados · {x.correctos} verificados · {x.actualizados} actualizados · {x.pendientes} pendientes · {x.no_aplica} no aplica · {x.con_incidencia} no conformes · {x.sin_revisar} sin revisar
                </Text>
              ) : null}
              <TablaDatos columnas={n === 1 ? COLS_DOCS : COLS_SIN_CODIGO} filas={filasDocs(docs, n === 1)} vacio="Sin documentos aplicables" />
            </Seccion>
          )
        })}

        <Seccion titulo="INCIDENCIAS">
          <TablaDatos
            columnas={COLS_INC}
            vacio="Sin incidencias en esta visita"
            filas={reporte.incidencias.map((i): CeldaDato[] => [
              [i.documento, i.documento_nombre].filter(Boolean).join(' · '),
              i.descripcion,
              i.nueva ? 'Nueva' : 'Seguimiento',
              i.estado === 'cerrada' ? ESTADO_INC.cerrada : { texto: ESTADO_INC[i.estado] ?? i.estado, color: PC.negativo },
              i.responsable ?? '',
              i.fecha_compromiso ? fechaPdf(i.fecha_compromiso) : '',
              i.ultimo_seguimiento ? `${i.ultimo_seguimiento.cliente ? 'Cliente: ' : ''}${i.ultimo_seguimiento.texto ?? ''}` : '',
            ])}
          />
        </Seccion>

        {notas.length > 0 ? (
          <Seccion titulo="ANTECEDENTES">
            {notas.map((n, i) => (
              <Text key={i} style={{ fontSize: 8, lineHeight: 1.4, marginBottom: 4 }}>{n.antecedentes}</Text>
            ))}
          </Seccion>
        ) : null}

        <PdfFirmas
          signatures={[{ label: 'Realizó la visita', nombre: visita.asesor ?? '', caption: 'Realizó - Firma', firma: firmaRealizo ?? null }]}
        />
      </PaginaEstandar>
    </Document>
  )
}
