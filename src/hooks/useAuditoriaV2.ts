import { useState, useEffect, useCallback } from 'react'
import { supabase } from '@/lib/supabase'
import { useAuthContext } from '@/context/AuthContext'
import type {
  AudBloque, AudPregunta, AudComentarioEsquema,
  AudAuditoriaConRancho, AudRespuesta, AudEstado, AudFallaAutomatica,
} from '@/types/database.types'
import type { ModuloAuditoria } from '@/hooks/useAuditoria'

const APP_CODIGO: Record<ModuloAuditoria, string> = {
  m14: 'M14', m15: 'M15', m16: 'M16', m17: 'M17', m18: 'M18',
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any
const tbl = (name: string) => (supabase as any).from(name)

export function calcularFallaAutomatica(
  trigger: AudFallaAutomatica | string,
  respuesta: AudRespuesta,
): AudFallaAutomatica {
  if (trigger === 'cualquier_descuento' && respuesta !== 'cumplimiento_total' && respuesta !== 'na') return 'alerta'
  if (trigger === 'solo_cero' && respuesta === 'no_conformidad') return 'alerta'
  return 'ninguno'
}

export function calcularProgresoCatalogo(
  preguntas: AudPregunta[],
  respuestas: Map<string, AudRespuesta>,
): { puntos_obtenidos: number; puntos_posibles: number; porcentaje: number } {
  let obtenidos = 0, posibles = 0
  for (const p of preguntas) {
    const r = respuestas.get(p.id)
    if (!r || r === 'na') continue
    posibles += p.max_puntos
    if (r === 'cumplimiento_total') obtenidos += p.max_puntos
  }
  const porcentaje = posibles > 0 ? Math.round((obtenidos / posibles) * 10000) / 100 : 0
  return { puntos_obtenidos: obtenidos, puntos_posibles: posibles, porcentaje }
}

export function useAuditoriaV2(modulo: ModuloAuditoria) {
  const { profile } = useAuthContext()

  const [bloques, setBloques] = useState<AudBloque[]>([])
  const [preguntas, setPreguntas] = useState<AudPregunta[]>([])
  const [esquemas, setEsquemas] = useState<AudComentarioEsquema[]>([])
  const [moduloNormaId, setModuloNormaId] = useState<string | null>(null)
  const [versionId, setVersionId] = useState<string | null>(null)
  const [loadingCatalogo, setLoadingCatalogo] = useState(true)

  const [auditorias, setAuditorias] = useState<AudAuditoriaConRancho[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    let cancelado = false
    async function loadCatalogo() {
      try {
        const { data: verData, error: verErr } = await tbl('aud_versiones_norma')
          .select('id').eq('vigente', true).single()
        if (verErr) throw verErr
        const vid = verData.id as string
        if (!cancelado) setVersionId(vid)

        const { data: modData, error: modErr } = await tbl('aud_modulos_norma')
          .select('id').eq('version_id', vid).eq('app_modulo_codigo', APP_CODIGO[modulo]).single()
        if (modErr) throw modErr
        const mid = modData.id as string
        if (!cancelado) setModuloNormaId(mid)

        const { data: blData, error: blErr } = await tbl('aud_bloques')
          .select('*').eq('modulo_id', mid).order('orden')
        if (blErr) throw blErr
        const bloqueIds = ((blData ?? []) as AudBloque[]).map((b) => b.id)

        if (bloqueIds.length === 0) {
          if (!cancelado) { setBloques([]); setPreguntas([]); setEsquemas([]) }
          return
        }

        const { data: preData, error: preErr } = await tbl('aud_preguntas')
          .select('*').in('bloque_id', bloqueIds).eq('activo', true).order('orden')
        if (preErr) throw preErr
        const pregIds = ((preData ?? []) as AudPregunta[]).map((p) => p.id)

        let eqData: AudComentarioEsquema[] = []
        if (pregIds.length > 0) {
          const { data: eqRaw, error: eqErr } = await tbl('aud_comentario_esquema')
            .select('*').in('pregunta_id', pregIds).order('orden')
          if (eqErr) throw eqErr
          eqData = eqRaw ?? []
        }

        if (!cancelado) {
          setBloques(blData ?? [])
          setPreguntas(preData ?? [])
          setEsquemas(eqData)
        }
      } catch (e) {
        if (!cancelado) console.error('Error cargando catálogo aud_*:', e)
      } finally {
        if (!cancelado) setLoadingCatalogo(false)
      }
    }
    loadCatalogo()
    return () => { cancelado = true }
  }, [modulo])

  const cargar = useCallback(async () => {
    if (!profile?.org_id) { setLoading(false); return }
    if (!moduloNormaId) return  // catalog still loading; triggered again once mid is set
    setLoading(true)
    setError(null)
    try {
      const { data, error: err } = await tbl('aud_auditorias')
        .select(`
          id, rancho_id, fecha, auditor_nombre, estado,
          requiere_correccion, comentario_correccion,
          ranchos(nombre, codigo),
          aud_auditoria_modulos!inner(modulo_norma_id)
        `)
        .eq('org_id', profile.org_id)
        .eq('aud_auditoria_modulos.modulo_norma_id', moduloNormaId)
        .order('fecha', { ascending: false })
        .limit(50)
      if (err) throw err
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      setAuditorias((data ?? []).map((r: any) => ({
        id: r.id,
        org_id: profile.org_id!,
        rancho_id: r.rancho_id,
        rancho_nombre: r.ranchos?.nombre ?? '—',
        rancho_codigo: r.ranchos?.codigo ?? '—',
        fecha: r.fecha,
        auditor_nombre: r.auditor_nombre ?? null,
        estado: r.estado as AudEstado,
        requiere_correccion: r.requiere_correccion ?? false,
        comentario_correccion: r.comentario_correccion ?? null,
        modulo_norma_id: moduloNormaId,
      })))
    } catch (e: unknown) {
      setError(e instanceof Error ? e.message : 'Error al cargar auditorías')
    } finally {
      setLoading(false)
    }
  }, [profile?.org_id, moduloNormaId])

  useEffect(() => { cargar() }, [cargar])

  async function cargarInstancias(auditoriaId: string): Promise<{
    respuestasMap: Map<string, AudRespuesta>
    valoresMap: Map<string, Map<string, string>>
  }> {
    const { data: instData, error: instErr } = await tbl('aud_instancia_pregunta')
      .select('id, pregunta_id, respuesta')
      .eq('auditoria_id', auditoriaId)
    if (instErr) throw instErr

    const instancias = (instData ?? []) as { id: string; pregunta_id: string; respuesta: string }[]
    const respuestasMap = new Map<string, AudRespuesta>()
    const instIdToPreg = new Map<string, string>()
    for (const inst of instancias) {
      respuestasMap.set(inst.pregunta_id, inst.respuesta as AudRespuesta)
      instIdToPreg.set(inst.id, inst.pregunta_id)
    }

    const valoresMap = new Map<string, Map<string, string>>()
    const instIds = instancias.map((i) => i.id)
    if (instIds.length > 0) {
      const { data: valData, error: valErr } = await tbl('aud_instancia_valores')
        .select('instancia_id, esquema_id, valor_texto, valor_opciones')
        .in('instancia_id', instIds)
      if (valErr) throw valErr
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      for (const val of valData ?? [] as any[]) {
        const pregId = instIdToPreg.get(val.instancia_id)
        if (!pregId) continue
        if (!valoresMap.has(pregId)) valoresMap.set(pregId, new Map())
        const texto = val.valor_texto ?? (Array.isArray(val.valor_opciones) ? val.valor_opciones.join(', ') : '')
        valoresMap.get(pregId)!.set(val.esquema_id, texto)
      }
    }

    return { respuestasMap, valoresMap }
  }

  async function guardar(params: {
    auditoriaId?: string
    rancho_id: string
    fecha: string
    auditor_nombre: string
    estado: AudEstado
    respuestasMap: Map<string, AudRespuesta>
    valoresMap: Map<string, Map<string, string>>
  }): Promise<string> {
    if (!profile?.org_id) throw new Error('Sin organización activa')
    if (!versionId || !moduloNormaId) throw new Error('Catálogo no cargado')

    let auditoriaId: string

    const campos = {
      rancho_id: params.rancho_id,
      fecha: params.fecha,
      auditor_nombre: params.auditor_nombre || null,
      estado: params.estado,
    }

    if (params.auditoriaId) {
      const { error: err } = await tbl('aud_auditorias')
        .update(campos)
        .eq('id', params.auditoriaId)
        .eq('org_id', profile.org_id)
      if (err) throw err

      await tbl('aud_auditoria_modulos')
        .update({ estado: params.estado })
        .eq('auditoria_id', params.auditoriaId)
        .eq('modulo_norma_id', moduloNormaId)

      auditoriaId = params.auditoriaId
    } else {
      const { data, error: err } = await tbl('aud_auditorias')
        .insert({
          ...campos,
          org_id: profile.org_id,
          version_id: versionId,
          scoring_isolation_key: crypto.randomUUID(),
        })
        .select('id')
        .single()
      if (err) throw err
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      auditoriaId = (data as any).id

      const { error: modErr } = await tbl('aud_auditoria_modulos')
        .insert({ auditoria_id: auditoriaId, modulo_norma_id: moduloNormaId, estado: params.estado })
      if (modErr) throw modErr
    }

    // Upsert instancias_pregunta
    if (params.respuestasMap.size === 0) return auditoriaId

    const instancias = Array.from(params.respuestasMap.entries()).map(([pregunta_id, respuesta]) => {
      const preg = preguntas.find((p) => p.id === pregunta_id)
      const falla = preg
        ? calcularFallaAutomatica(preg.trigger_falla_automatica, respuesta)
        : 'ninguno'
      return { auditoria_id: auditoriaId, pregunta_id, respuesta, estado_falla_automatica: falla, fuente: 'capturado' }
    })

    const { data: instData, error: instErr } = await tbl('aud_instancia_pregunta')
      .upsert(instancias, { onConflict: 'auditoria_id,pregunta_id' })
      .select('id, pregunta_id')
    if (instErr) throw instErr

    // Build instancia_id lookup for valores
    const instIdMap = new Map<string, string>()
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    for (const i of (instData ?? []) as any[]) {
      instIdMap.set(i.pregunta_id, i.id)
    }

    const valores: {
      instancia_id: string; esquema_id: string
      valor_texto: string | null; valor_opciones: null; fuente: string
    }[] = []

    for (const [pregId, camposMap] of params.valoresMap.entries()) {
      const instId = instIdMap.get(pregId)
      if (!instId) continue
      for (const [esquemaId, valor] of camposMap.entries()) {
        valores.push({
          instancia_id: instId,
          esquema_id: esquemaId,
          valor_texto: valor || null,
          valor_opciones: null,
          fuente: 'capturado',
        })
      }
    }

    if (valores.length > 0) {
      const { error: valErr } = await tbl('aud_instancia_valores')
        .upsert(valores, { onConflict: 'instancia_id,esquema_id' })
      if (valErr) throw valErr
    }

    return auditoriaId
  }

  return {
    bloques,
    preguntas,
    esquemas,
    moduloNormaId,
    loadingCatalogo,
    auditorias,
    loading,
    error,
    refetch: cargar,
    cargarInstancias,
    guardar,
  }
}
