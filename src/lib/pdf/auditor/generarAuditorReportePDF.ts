import { pdf } from '@react-pdf/renderer'
import { createElement } from 'react'
import { AuditorReportePDF } from './AuditorReportePDF'
import type { AuditorReportePDFProps, ReviewIssueReporte } from './AuditorReportePDF'
import type { AuditorAuditoriaDetalle, ModuloConPreguntas } from '@/hooks/useAuditorAuditoria'
import type { AudComentarioEsquema, AudRespuesta } from '@/types/database.types'

interface GenerarParams {
  auditoria: AuditorAuditoriaDetalle
  modulosData: ModuloConPreguntas[]
  esquemaMap: Map<string, AudComentarioEsquema[]>
  respuestasMap: Map<string, AudRespuesta>
  valoresMap: Map<string, Map<string, string>>
  observacionesMap: Map<string, string>
  reviewIssues?: ReviewIssueReporte[]
}

export async function generarAuditorReportePDF(params: GenerarParams): Promise<void> {
  const { auditoria, modulosData, esquemaMap, respuestasMap, valoresMap, observacionesMap, reviewIssues } = params

  const modulosReporte: AuditorReportePDFProps['modulos'] = modulosData.map(mod => ({
    nombre: mod.modulo_nombre,
    bloques: mod.bloques.map(bloque => ({
      id: bloque.id,
      codigo: bloque.codigo,
      nombre: bloque.nombre,
      preguntas: mod.preguntas
        .filter(p => p.bloque_id === bloque.id)
        .map(p => {
          const esquemas = esquemaMap.get(p.id) ?? []
          const camposPreg = valoresMap.get(p.id) ?? new Map<string, string>()
          const campos = esquemas
            .filter(esq => camposPreg.has(esq.id) || (camposPreg.get(esq.id) ?? '').trim() !== '')
            .map(esq => ({
              etiqueta: esq.etiqueta,
              valor: camposPreg.get(esq.id) ?? '',
            }))
            .filter(c => c.valor.trim() !== '')
          return {
            id: p.id,
            question_id: p.question_id,
            texto: p.texto,
            trigger_falla_automatica: p.trigger_falla_automatica,
            respuesta: respuestasMap.get(p.id) as string | undefined,
            campos,
            observacion: observacionesMap.get(p.id),
          }
        }),
    })).filter(b => b.preguntas.length > 0),
  }))

  const props: AuditorReportePDFProps = {
    auditoriaId: auditoria.id,
    fecha: auditoria.fecha,
    auditorNombre: auditoria.auditor_nombre,
    tipoOperacion: auditoria.tipo_operacion,
    producto: auditoria.producto,
    periodo: auditoria.periodo,
    instalacionNombre: auditoria.instalacion_nombre,
    instalacionUbicacion: auditoria.instalacion_ubicacion,
    productorNombre: auditoria.productor_nombre,
    ranchoNombre: auditoria.rancho_nombre,
    modulos: modulosReporte,
    reviewIssues,
  }

  const blob = await pdf(createElement(AuditorReportePDF, props)).toBlob()
  const url = URL.createObjectURL(blob)
  const a = document.createElement('a')
  a.href = url
  a.download = `reporte-auditoria-${auditoria.fecha}.pdf`
  a.click()
  setTimeout(() => URL.revokeObjectURL(url), 10_000)
}
