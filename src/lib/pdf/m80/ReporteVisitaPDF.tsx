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

const ESTADO_TXT: Record<ReporteDoc['estado'], string> = { correcto: 'Correcto', incidencia: 'Incidencia', sin_revisar: 'Sin revisar' }
const VIGENCIA_TXT: Record<string, string> = { vigente: '', proximo: 'Por vencer', vencido: 'Vencido', sin_dato: '' }

const COLS_DOCS: ColumnaDato[] = [
  { texto: 'Código', ancho: 70 },
  { texto: 'Documento', ancho: 150 },
  { texto: 'Rev', ancho: 24, align: 'center' },
  { texto: 'Último registro', ancho: 62 },
  { texto: 'Vence', ancho: 58 },
  { texto: 'Estado', ancho: 56 },
  { texto: 'Detalle', ancho: 170 },
]

function filasDocs(docs: ReporteDoc[]): (CeldaDato[] | FilaBanda)[] {
  const filas: (CeldaDato[] | FilaBanda)[] = []
  let area: string | null = null
  for (const d of docs) {
    const a = d.area?.trim() || 'Sin área'
    if (a !== area) { filas.push({ banda: a }); area = a }
    const detalle = [
      ...(d.actualizado ? ['Actualizado: ' + detalleCambios(d).join('; ')] : []),
      ...(d.incidencia ? ['Incidencia: ' + d.incidencia] : []),
      ...(d.observacion ? [d.observacion] : []),
    ].join('\n')
    const estado = ESTADO_TXT[d.estado] + (d.actualizado && d.estado === 'correcto' ? ' (actualizado)' : '')
    filas.push([
      d.codigo ?? '',
      d.nombre,
      d.revision ?? '',
      d.ultimo_registro ?? '',
      [d.vence_el ? fechaPdf(d.vence_el) : '', VIGENCIA_TXT[d.vigencia] ?? ''].filter(Boolean).join(' '),
      d.estado === 'incidencia' ? { texto: estado, color: PC.negativo } : estado,
      detalle,
    ])
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
            porRenglon={6}
            anchoTotal={841.89 - 80}
            margenInferior={8}
            campos={[
              { etiqueta: 'Aplicables', valor: String(resumen.aplicables) },
              { etiqueta: 'Correctos', valor: String(resumen.correctos) },
              { etiqueta: 'Con incidencia', valor: String(resumen.con_incidencia) },
              { etiqueta: 'Sin revisar', valor: String(resumen.sin_revisar) },
              { etiqueta: 'Actualizados', valor: String(resumen.actualizados) },
              { etiqueta: 'Vencidos', valor: String(resumen.vencidos) },
            ]}
          />
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

        <Seccion titulo="DOCUMENTOS POR ÁREA">
          <TablaDatos columnas={COLS_DOCS} filas={filasDocs(reporte.documentos)} vacio="Sin documentos aplicables" />
        </Seccion>

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

        <PdfFirmas
          signatures={[{ label: 'Realizó la visita', nombre: visita.asesor ?? '', caption: 'Realizó - Firma', firma: firmaRealizo ?? null }]}
        />
      </PaginaEstandar>
    </Document>
  )
}
