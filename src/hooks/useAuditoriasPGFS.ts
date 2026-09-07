import { useState, useEffect, useCallback } from 'react'
import { supabase } from '@/lib/supabase'
import { useAuthContext } from '@/context/AuthContext'
import type {
  AudBloque, AudPregunta, AudComentarioEsquema,
  AudModuloNorma, AudRespuesta, AudEstado,
} from '@/types/database.types'
import { calcularFallaAutomatica } from '@/hooks/useAuditoriaV2'

// eslint-disable-next-line @typescript-eslint/no-explicit-any
const tbl = (name: string) => (supabase as any).from(name)

export interface AuditoriaListItem {
  id: string
  rancho_id: string
  rancho_nombre: string
  fecha: string
  auditor_nombre: string | null
  estado: AudEstado
  modulo_norma_id: string
  modulo_nombre: string
}

export interface AuditoriaDetalle extends AuditoriaListItem {
  org_id: string
}

export function useAuditoriasPGFS() {
  const { profile } = useAuthContext()

  const [versionId, setVersionId] = useState<string | null>(null)
  const [modulos, setModulos] = useState<AudModuloNorma[]>([])
  const [loadingModulos, setLoadingModulos] = useState(true)

  const [auditorias, setAuditorias] = useState<AuditoriaListItem[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    let cancelado = false
    async function init() {
      try {
        const { data: verData, error: verErr } = await tbl('aud_versiones_norma')
          .select('id').eq('vigente', true).single()
        if (verErr) throw verErr
        const vid = verData.id as string
        if (!cancelado) setVersionId(vid)

        const { data: modData, error: modErr } = await tbl('aud_modulos_norma')
          .select('id, nombre, app_modulo_codigo, orden')
          .eq('version_id', vid)
          .order('orden')
        if (modErr) throw modErr
        if (!cancelado) setModulos(modData ?? [])
      } catch (e) {
        if (!cancelado) console.error('[PGFS] módulos:', e)
      } finally {
        if (!cancelado) setLoadingModulos(false)
      }
    }
    init()
    return () => { cancelado = true }
  }, [])

  const cargar = useCallback(async () => {
    if (!profile?.org_id) { setLoading(false); return }
    setLoading(true)
    setError(null)
    try {
      const { data, error: err } = await tbl('aud_auditorias')
        .select(`
          id, rancho_id, fecha, auditor_nombre, estado,
          ranchos(nombre),
          aud_auditoria_modulos!inner(modulo_norma_id, aud_modulos_norma(nombre))
        `)
        .eq('org_id', profile.org_id)
        .order('fecha', { ascending: false })
        .limit(100)
      if (err) throw err
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      setAuditorias((data ?? []).map((r: any) => {
        const am = Array.isArray(r.aud_auditoria_modulos)
          ? r.aud_auditoria_modulos[0]
          : r.aud_auditoria_modulos
        return {
          id: r.id,
          rancho_id: r.rancho_id,
          rancho_nombre: r.ranchos?.nombre ?? '—',
          fecha: r.fecha,
          auditor_nombre: r.auditor_nombre ?? null,
          estado: r.estado as AudEstado,
          modulo_norma_id: am?.modulo_norma_id ?? '',
          modulo_nombre: am?.aud_modulos_norma?.nombre ?? '—',
        }
      }))
    } catch (e: unknown) {
      setError(e instanceof Error ? e.message : 'Error al cargar auditorías')
    } finally {
      setLoading(false)
    }
  }, [profile?.org_id])

  useEffect(() => { cargar() }, [cargar])

  async function cargarAuditoria(auditoriaId: string): Promise<AuditoriaDetalle> {
    const { data, error: err } = await tbl('aud_auditorias')
      .select(`
        id, rancho_id, fecha, auditor_nombre, estado,
        ranchos(nombre),
        aud_auditoria_modulos!inner(modulo_norma_id, aud_modulos_norma(nombre))
      `)
      .eq('id', auditoriaId)
      .single()
    if (err) throw err
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const am = Array.isArray((data as any).aud_auditoria_modulos)
      ? (data as any).aud_auditoria_modulos[0]
      : (data as any).aud_auditoria_modulos
    return {
      id: data.id,
      org_id: profile?.org_id ?? '',
      rancho_id: data.rancho_id,
      rancho_nombre: (data as any).ranchos?.nombre ?? '—',
      fecha: data.fecha,
      auditor_nombre: data.auditor_nombre ?? null,
      estado: data.estado as AudEstado,
      modulo_norma_id: am?.modulo_norma_id ?? '',
      modulo_nombre: am?.aud_modulos_norma?.nombre ?? '—',
    }
  }

  async function cargarCatalogo(moduloNormaId: string): Promise<{
    bloques: AudBloque[]
    preguntas: AudPregunta[]
    esquemas: AudComentarioEsquema[]
  }> {
    const [blRes, preRes] = await Promise.all([
      tbl('aud_bloques').select('*').eq('modulo_norma_id', moduloNormaId).order('orden'),
      tbl('aud_preguntas').select('*').eq('modulo_norma_id', moduloNormaId).order('orden'),
    ])
    if (blRes.error) throw blRes.error
    if (preRes.error) throw preRes.error

    const pregIds = ((preRes.data ?? []) as AudPregunta[]).map((p) => p.id)
    let eqData: AudComentarioEsquema[] = []
    if (pregIds.length > 0) {
      const { data: eqRaw, error: eqErr } = await tbl('aud_comentario_esquema')
        .select('*').in('pregunta_id', pregIds).order('orden')
      if (eqErr) throw eqErr
      eqData = eqRaw ?? []
    }
    return { bloques: blRes.data ?? [], preguntas: preRes.data ?? [], esquemas: eqData }
  }

  async function cargarInstancias(auditoriaId: string): Promise<{
    respuestasMap: Map<string, AudRespuesta>
    valoresMap: Map<string, Map<string, string>>
    observacionesMap: Map<string, string>
  }> {
    const [instRes, obsRes] = await Promise.all([
      tbl('aud_instancia_pregunta')
        .select('id, pregunta_id, respuesta')
        .eq('auditoria_id', auditoriaId),
      tbl('aud_observaciones')
        .select('pregunta_id, texto')
        .eq('auditoria_id', auditoriaId),
    ])
    if (instRes.error) throw instRes.error

    const instancias = (instRes.data ?? []) as { id: string; pregunta_id: string; respuesta: string }[]
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
      for (const val of (valData ?? []) as any[]) {
        const pregId = instIdToPreg.get(val.instancia_id)
        if (!pregId) continue
        if (!valoresMap.has(pregId)) valoresMap.set(pregId, new Map())
        const texto = val.valor_texto ?? (Array.isArray(val.valor_opciones) ? val.valor_opciones.join(', ') : '')
        valoresMap.get(pregId)!.set(val.esquema_id, texto)
      }
    }

    const observacionesMap = new Map<string, string>()
    for (const obs of (obsRes.data ?? []) as { pregunta_id: string; texto: string | null }[]) {
      if (obs.texto) observacionesMap.set(obs.pregunta_id, obs.texto)
    }

    return { respuestasMap, valoresMap, observacionesMap }
  }

  async function crearAuditoria(params: {
    modulo_norma_id: string
    rancho_id: string
    fecha: string
    auditor_nombre: string
  }): Promise<string> {
    if (!profile?.org_id) throw new Error('Sin organización activa')
    if (!versionId) throw new Error('Versión no cargada')

    const { data, error: err } = await tbl('aud_auditorias')
      .insert({
        org_id: profile.org_id,
        version_id: versionId,
        rancho_id: params.rancho_id,
        fecha: params.fecha,
        auditor_nombre: params.auditor_nombre || null,
        estado: 'en_proceso',
        scoring_isolation_key: crypto.randomUUID(),
      })
      .select('id')
      .single()
    if (err) throw err
    const auditoriaId = (data as { id: string }).id

    const { error: modErr } = await tbl('aud_auditoria_modulos')
      .insert({
        auditoria_id: auditoriaId,
        modulo_norma_id: params.modulo_norma_id,
        aplicable: true,
        estado: 'en_proceso',
      })
    if (modErr) throw modErr

    return auditoriaId
  }

  async function guardarRespuesta(params: {
    auditoriaId: string
    preguntaId: string
    respuesta: AudRespuesta
    trigger: string
    valoresMap: Map<string, string>
    observacion?: string
  }): Promise<void> {
    if (!profile?.org_id) throw new Error('Sin organización activa')
    // calcularFallaAutomatica acepta string como primer param
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const falla = calcularFallaAutomatica(params.trigger as any, params.respuesta)

    const { data: instData, error: instErr } = await tbl('aud_instancia_pregunta')
      .upsert(
        {
          auditoria_id: params.auditoriaId,
          pregunta_id: params.preguntaId,
          respuesta: params.respuesta,
          estado_falla_automatica: falla,
          fuente: 'capturado',
        },
        { onConflict: 'auditoria_id,pregunta_id' },
      )
      .select('id')
      .single()
    if (instErr) throw instErr
    const instanciaId = (instData as { id: string }).id

    if (params.valoresMap.size > 0) {
      const valores = Array.from(params.valoresMap.entries()).map(([esquemaId, valor]) => ({
        instancia_id: instanciaId,
        esquema_id: esquemaId,
        valor_texto: valor || null,
        valor_opciones: null,
        fuente: 'capturado',
      }))
      const { error: valErr } = await tbl('aud_instancia_valores')
        .upsert(valores, { onConflict: 'instancia_id,esquema_id' })
      if (valErr) throw valErr
    }

    if (params.observacion !== undefined) {
      const texto = params.observacion.trim()
      if (texto) {
        const { error: obsErr } = await tbl('aud_observaciones')
          .upsert(
            {
              auditoria_id: params.auditoriaId,
              pregunta_id: params.preguntaId,
              org_id: profile.org_id,
              texto,
            },
            { onConflict: 'auditoria_id,pregunta_id' },
          )
        if (obsErr) throw obsErr
      }
    }
  }

  async function completarAuditoria(auditoriaId: string): Promise<void> {
    if (!profile?.org_id) throw new Error('Sin organización activa')
    const { error: err } = await tbl('aud_auditorias')
      .update({ estado: 'cerrada' })
      .eq('id', auditoriaId)
      .eq('org_id', profile.org_id)
    if (err) throw err
    await tbl('aud_auditoria_modulos')
      .update({ estado: 'cerrada' })
      .eq('auditoria_id', auditoriaId)
  }

  return {
    versionId,
    modulos,
    loadingModulos,
    auditorias,
    loading,
    error,
    refetch: cargar,
    cargarAuditoria,
    cargarCatalogo,
    cargarInstancias,
    crearAuditoria,
    guardarRespuesta,
    completarAuditoria,
  }
}
