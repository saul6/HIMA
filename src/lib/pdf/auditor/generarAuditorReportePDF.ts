// generarAuditorReportePDF — reporte PDF del auditor externo.
// Formato idéntico a AuditoriaPagina (M14-M18), una Page por módulo aplicable.
// Datos siempre desde el servidor (no desde el estado de la pantalla).

import { pdf, Document } from '@react-pdf/renderer'
import { createElement } from 'react'
import { AuditoriaPagina, type AuditoriaPaginaProps } from '@/lib/pdf/auditoria/AuditoriaPDF'
import { SCORE_MATRIX, RESP_TO_CLASS, type ScoreMatrixKey } from '@/lib/scoring/matriz'
import { supabase } from '@/lib/supabase'
import type { AuditorAuditoriaDetalle, HerenciaInfo } from '@/hooks/useAuditorAuditoria'

// eslint-disable-next-line @typescript-eslint/no-explicit-any
const tbl = (name: string) => (supabase as any).from(name)

const HERENCIA_EXCLUIR = new Set(['sin_confirmar', 'conflicto', 'revalidar', 'rechazado'])

const NOTA_FINAL =
  'M.A.D.Y organiza, valida y da seguimiento. No sustituye a PrimusGFS, a Azzule Systems, al auditor autorizado ni al organismo de certificacion. La decision oficial corresponde al proceso externo.'

export interface GenerarParams {
  auditoria: AuditorAuditoriaDetalle
}

function calcPuntosOtorgados(maxPuntos: number, respuesta: string): number {
  const cls = (RESP_TO_CLASS as Record<string, string>)[respuesta]
  if (!cls) return 0
  const row = SCORE_MATRIX[maxPuntos as ScoreMatrixKey]
  if (!row) return 0
  return (row as Record<string, number>)[cls] ?? 0
}

// Orden natural para question_id: "2.02.03" < "2.02.03a" < "2.02.04" < "2.02.10"
function naturalSortQid(a: string, b: string): number {
  const pa = a.split('.')
  const pb = b.split('.')
  const len = Math.max(pa.length, pb.length)
  for (let i = 0; i < len; i++) {
    const sa = pa[i] ?? ''
    const sb = pb[i] ?? ''
    if (sa === sb) continue
    const ma = sa.match(/^(\d*)([a-z]*)$/i) ?? []
    const mb = sb.match(/^(\d*)([a-z]*)$/i) ?? []
    const na = parseInt(ma[1] || '0', 10)
    const nb = parseInt(mb[1] || '0', 10)
    if (na !== nb) return na - nb
    const la = (ma[2] ?? '').toLowerCase()
    const lb = (mb[2] ?? '').toLowerCase()
    if (la !== lb) return la < lb ? -1 : 1
  }
  return 0
}

export async function generarAuditorReportePDF({ auditoria }: GenerarParams): Promise<void> {
  const aid = auditoria.id

  // 1. Módulos aplicables ordenados por numero
  const { data: amRaw, error: amErr } = await tbl('aud_auditoria_modulos')
    .select('modulo_norma_id, aplicable, aud_modulos_norma(numero, nombre)')
    .eq('auditoria_id', aid)
    .eq('aplicable', true)
  if (amErr) throw amErr

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const modulosApl: any[] = (amRaw ?? []).sort(
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    (a: any, b: any) => (a.aud_modulos_norma?.numero ?? 0) - (b.aud_modulos_norma?.numero ?? 0)
  )
  if (modulosApl.length === 0) throw new Error('Esta auditoria no tiene modulos aplicables')

  const moduloIds: string[] = modulosApl.map((m: any) => m.modulo_norma_id)

  // 2. Bloques y preguntas
  const [blRes, prRes] = await Promise.all([
    tbl('aud_bloques')
      .select('id, modulo_norma_id, codigo, nombre, orden')
      .in('modulo_norma_id', moduloIds)
      .order('orden'),
    tbl('aud_preguntas')
      .select('id, modulo_norma_id, bloque_id, question_id, texto, max_puntos')
      .in('modulo_norma_id', moduloIds),
  ])
  if (blRes.error) throw blRes.error
  if (prRes.error) throw prRes.error

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const allPregs: any[] = prRes.data ?? []
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const allBloques: any[] = blRes.data ?? []
  const pregIds: string[] = allPregs.map((p: any) => p.id)

  // 3. Esquemas de campos mínimos con etiqueta
  const esquemasByPreg = new Map<string, { id: string; etiqueta: string; orden: number }[]>()
  if (pregIds.length > 0) {
    const { data: eqRaw } = await tbl('aud_comentario_esquema')
      .select('id, pregunta_id, etiqueta, orden_render')
      .in('pregunta_id', pregIds)
      .order('orden_render')
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    for (const esq of (eqRaw ?? []) as any[]) {
      if (!esquemasByPreg.has(esq.pregunta_id)) esquemasByPreg.set(esq.pregunta_id, [])
      esquemasByPreg.get(esq.pregunta_id)!.push({ id: esq.id, etiqueta: esq.etiqueta, orden: esq.orden_render ?? 0 })
    }
  }

  // 4. Instancias de respuesta
  const { data: instRaw, error: instErr } = await tbl('aud_instancia_pregunta')
    .select('id, pregunta_id, respuesta, estado_aplicabilidad, origen_na')
    .eq('auditoria_id', aid)
  if (instErr) throw instErr
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const instancias: any[] = instRaw ?? []
  const instIds: string[] = instancias.map((i: any) => i.id)
  const pregToInst = new Map<string, { respuesta: string; instId: string; estadoAp: string | null; origenNa: string | null }>()
  for (const inst of instancias) {
    pregToInst.set(inst.pregunta_id, {
      respuesta: inst.respuesta,
      instId: inst.id,
      estadoAp: inst.estado_aplicabilidad ?? null,
      origenNa: inst.origen_na ?? null,
    })
  }

  // 5. Herencia — excluir campos con estado no confirmado
  const herenciaExcluir = new Set<string>() // "pregunta_id:esquema_id"
  try {
    const { data: hData } = await supabase.rpc('aud_herencia_detalle', { p_auditoria_id: aid })
    for (const h of ((hData ?? []) as HerenciaInfo[])) {
      if (HERENCIA_EXCLUIR.has(h.estado)) {
        herenciaExcluir.add(`${h.pregunta_id}:${h.esquema_id}`)
      }
    }
  } catch {
    // herencia no disponible — continuar sin filtrar
  }

  // 6. Valores de campos mínimos y observaciones
  const comentariosMap = new Map<string, string>()
  if (instIds.length > 0) {
    const [valRes, obsRes] = await Promise.all([
      tbl('aud_instancia_valores')
        .select('instancia_id, esquema_id, valor_texto')
        .in('instancia_id', instIds)
        .not('valor_texto', 'is', null),
      tbl('aud_observaciones')
        .select('instancia_id, observacion')
        .in('instancia_id', instIds),
    ])

    const instIdToPreg = new Map<string, string>(instancias.map((i: any) => [i.id, i.pregunta_id]))

    const valsByInst = new Map<string, Map<string, string>>()
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    for (const v of (valRes.data ?? []) as any[]) {
      if (!v.valor_texto?.trim()) continue
      if (!valsByInst.has(v.instancia_id)) valsByInst.set(v.instancia_id, new Map())
      valsByInst.get(v.instancia_id)!.set(v.esquema_id, v.valor_texto)
    }

    const obsByInst = new Map<string, string>()
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    for (const o of (obsRes.data ?? []) as any[]) {
      if (o.observacion?.trim()) obsByInst.set(o.instancia_id, o.observacion)
    }

    for (const inst of instancias) {
      const pregId = instIdToPreg.get(inst.id)
      if (!pregId) continue
      const esqs = (esquemasByPreg.get(pregId) ?? []).sort((a, b) => a.orden - b.orden)
      const vals = valsByInst.get(inst.id) ?? new Map<string, string>()
      const lines: string[] = []
      for (const esq of esqs) {
        if (herenciaExcluir.has(`${pregId}:${esq.id}`)) continue
        const v = vals.get(esq.id)
        if (v?.trim()) lines.push(`${esq.etiqueta}: ${v}`)
      }
      const obs = obsByInst.get(inst.id)
      if (obs?.trim()) lines.push(obs)
      if (lines.length > 0) comentariosMap.set(pregId, lines.join('\n'))
    }
  }

  // 7. Contexto de la auditoría
  const esBorrador = auditoria.estado !== 'cerrada'
  const esInstalacion = !!auditoria.instalacion_id
  const ranchoNombre = esInstalacion
    ? (auditoria.instalacion_nombre ?? '—')
    : (auditoria.rancho_nombre ?? '—')
  const terminoSitio = esInstalacion ? 'Instalacion' : 'Rancho'

  // 8. Una AuditoriaPaginaProps por módulo
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const pages = modulosApl.map((am: any) => {
    const mid: string = am.modulo_norma_id
    const modNorma = am.aud_modulos_norma
    const titulo = `Modulo ${modNorma?.numero ?? '?'} - ${modNorma?.nombre ?? '—'}`

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const bloques: any[] = allBloques.filter((b: any) => b.modulo_norma_id === mid)
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const pregsRaw: any[] = allPregs.filter((p: any) => p.modulo_norma_id === mid)

    // Secciones ordenadas numéricamente por codigo (2.01, 2.02, ...)
    const bloquesOrd = [...bloques].sort((a, b) => naturalSortQid(a.codigo, b.codigo))
    const secciones = bloquesOrd.map((b, idx) => ({
      id: b.id as string,
      codigo: b.codigo as string,
      nombre: b.nombre as string,
      orden: idx,
    }))

    // Preguntas ordenadas con orden natural del question_id
    const pregsOrd = [...pregsRaw].sort((a, b) => naturalSortQid(a.question_id, b.question_id))
    const preguntas = pregsOrd.map((p, idx) => ({
      id: p.id as string,
      seccion_id: p.bloque_id as string,
      codigo: p.question_id as string,
      texto: p.texto as string,
      puntos: (p.max_puntos as number) ?? 0,
      orden_seccion: idx,
    }))

    // Respuestas con puntos calculados por la matriz oficial
    const respuestas = pregsOrd.flatMap((p) => {
      const inst = pregToInst.get(p.id as string)
      if (!inst) return []
      const resp: string = inst.respuesta
      const maxPts: number = (p.max_puntos as number) ?? 0
      const pts = resp === 'na' ? 0 : calcPuntosOtorgados(maxPts, resp)
      let comentario: string | null = comentariosMap.get(p.id as string) ?? null
      if (inst.origenNa === 'rama' || inst.estadoAp === 'na_rama') {
        const prefix = 'N/A por regla de rama'
        comentario = comentario ? `${prefix}\n${comentario}` : prefix
      }
      return [{ pregunta_id: p.id as string, respuesta: resp, comentario, puntos_otorgados: pts }]
    })

    // Totales del módulo
    const respMap = new Map(respuestas.map(r => [r.pregunta_id, r]))
    let pts_obt = 0, pts_pos = 0
    for (const p of preguntas) {
      const r = respMap.get(p.id)
      if (!r || r.respuesta === 'na') continue
      pts_pos += p.puntos
      pts_obt += r.puntos_otorgados
    }
    const porcentaje = pts_pos > 0 ? Math.round(pts_obt / pts_pos * 10000) / 100 : 0

    const props: AuditoriaPaginaProps = {
      auditoriaId: aid,
      ranchoNombre,
      ranchoCodigo: '',
      fecha: auditoria.fecha,
      auditorNombre: auditoria.auditor_nombre,
      puntos_obtenidos: pts_obt,
      puntos_posibles: pts_pos,
      porcentaje,
      portada: null,
      secciones,
      preguntas,
      respuestas,
      titulo,
      subtitulo: '',
      moduloCodigo: `AUD-M${modNorma?.numero ?? '?'}`,
      firmas: ['Auditor - Firma', 'Responsable de Inocuidad - Firma'],
      notaFinal: NOTA_FINAL,
      esBorrador,
      tipoAuditoria: 'Auditoria externa PrimusGFS',
      terminoSitio,
    }

    return createElement(AuditoriaPagina, { key: mid, ...props })
  })

  const doc = createElement(
    Document,
    {
      title: `Reporte de Auditoria PrimusGFS - ${ranchoNombre} ${auditoria.fecha}`,
      author: 'M.A.D.Y.',
      creator: 'M.A.D.Y. Inocuidad Inteligente',
      producer: 'M.A.D.Y. Inocuidad Inteligente',
      keywords: 'MADY, inocuidad, auditoria, primusgfs',
    },
    ...pages
  )

  const blob = await pdf(doc).toBlob()
  const url = URL.createObjectURL(blob)
  const a = document.createElement('a')
  a.href = url
  a.download = `reporte-auditoria-${auditoria.fecha}.pdf`
  a.click()
  setTimeout(() => URL.revokeObjectURL(url), 10_000)
}
