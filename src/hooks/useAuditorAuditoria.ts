import { useState, useEffect, useCallback } from 'react'
import { supabase } from '@/lib/supabase'
import { useAuthContext } from '@/context/AuthContext'
import type {
  AudBloque, AudPregunta, AudComentarioEsquema,
  AudRespuesta, AudEstado, AudTriggerFalla,
} from '@/types/database.types'
import { calcularFallaAutomatica } from '@/hooks/useAuditoriaV2'

// eslint-disable-next-line @typescript-eslint/no-explicit-any
const tbl = (name: string) => (supabase as any).from(name)

export type EstadoAuditoria = AudEstado | 'preliminar'

export interface AuditorAuditoriaDetalle {
  id: string
  org_id: string
  rancho_id: string | null
  rancho_nombre: string
  productor_nombre: string
  instalacion_id: string | null
  instalacion_nombre: string | null
  instalacion_ubicacion: string | null
  expires_at: string | null
  fecha: string
  auditor_nombre: string | null
  estado: EstadoAuditoria
  tipo_operacion: string | null
  producto: string | null
  periodo: string | null
  modulos: { id: string; nombre: string }[]
}

export interface ModuloConPreguntas {
  modulo_id: string
  modulo_nombre: string
  bloques: AudBloque[]
  preguntas: AudPregunta[]
}

export function useAuditorAuditoria(auditoriaId: string | undefined) {
  const { profile } = useAuthContext()

  const [auditoria, setAuditoria] = useState<AuditorAuditoriaDetalle | null>(null)
  const [modulosData, setModulosData] = useState<ModuloConPreguntas[]>([])
  const [esquemaMap, setEsquemaMap] = useState<Map<string, AudComentarioEsquema[]>>(new Map())

  const [respuestasMap, setRespuestasMap] = useState<Map<string, AudRespuesta>>(new Map())
  const [valoresMap, setValoresMap] = useState<Map<string, Map<string, string>>>(new Map())
  const [observacionesMap, setObservacionesMap] = useState<Map<string, string>>(new Map())

  const [cargando, setCargando] = useState(true)
  const [errorMsg, setErrorMsg] = useState<string | null>(null)

  const cargar = useCallback(async () => {
    if (!auditoriaId) return
    setCargando(true)
    setErrorMsg(null)
    try {
      const { data: audData, error: audErr } = await tbl('aud_auditorias')
        .select(`
          id, org_id, rancho_id, instalacion_id, fecha, auditor_nombre, estado, expires_at,
          tipo_operacion, producto, periodo,
          ranchos(nombre),
          productor:organizaciones!aud_auditorias_org_id_fkey(nombre),
          aud_instalaciones(nombre, ubicacion)
        `)
        .eq('id', auditoriaId)
        .single()
      if (audErr) throw audErr

      const { data: amData, error: amErr } = await tbl('aud_auditoria_modulos')
        .select('modulo_norma_id, aud_modulos_norma(nombre)')
        .eq('auditoria_id', auditoriaId)
      if (amErr) throw amErr

      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const moduloIds: string[] = (amData ?? []).map((m: any) => m.modulo_norma_id)

      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const aud: AuditorAuditoriaDetalle = {
        id: audData.id,
        org_id: audData.org_id,
        rancho_id: audData.rancho_id ?? null,
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        rancho_nombre: (audData as any).ranchos?.nombre ?? '—',
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        productor_nombre: (audData as any).productor?.nombre ?? '—',
        instalacion_id: audData.instalacion_id ?? null,
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        instalacion_nombre: (audData as any).aud_instalaciones?.nombre ?? null,
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        instalacion_ubicacion: (audData as any).aud_instalaciones?.ubicacion ?? null,
        expires_at: audData.expires_at ?? null,
        fecha: audData.fecha,
        auditor_nombre: audData.auditor_nombre ?? null,
        estado: audData.estado as EstadoAuditoria,
        tipo_operacion: audData.tipo_operacion ?? null,
        producto: audData.producto ?? null,
        periodo: audData.periodo ?? null,
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        modulos: (amData ?? []).map((m: any) => ({
          id: m.modulo_norma_id,
          nombre: m.aud_modulos_norma?.nombre ?? '—',
        })),
      }
      setAuditoria(aud)

      if (moduloIds.length === 0) {
        setModulosData([])
        setCargando(false)
        return
      }

      const [blRes, prRes] = await Promise.all([
        tbl('aud_bloques').select('*').in('modulo_norma_id', moduloIds).order('orden'),
        tbl('aud_preguntas').select('*').in('modulo_norma_id', moduloIds).order('orden', { nullsFirst: false }).order('question_id'),
      ])
      if (blRes.error) throw blRes.error
      if (prRes.error) throw prRes.error

      const allPreguntas: AudPregunta[] = prRes.data ?? []
      const pregIds = allPreguntas.map(p => p.id)

      let eqData: AudComentarioEsquema[] = []
      if (pregIds.length > 0) {
        const { data: eqRaw, error: eqErr } = await tbl('aud_comentario_esquema')
          .select('*').in('pregunta_id', pregIds).order('orden_render')
        if (eqErr) console.error('[useAuditorAuditoria] aud_comentario_esquema', eqErr)
        eqData = eqRaw ?? []
      }
      const eqMap = new Map<string, AudComentarioEsquema[]>()
      for (const e of eqData) {
        if (!eqMap.has(e.pregunta_id)) eqMap.set(e.pregunta_id, [])
        eqMap.get(e.pregunta_id)!.push(e)
      }
      setEsquemaMap(eqMap)

      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const mdata: ModuloConPreguntas[] = (amData ?? []).map((am: any) => {
        const mid = am.modulo_norma_id
        return {
          modulo_id: mid,
          modulo_nombre: am.aud_modulos_norma?.nombre ?? '—',
          bloques: (blRes.data ?? []).filter((b: AudBloque) => b.modulo_norma_id === mid),
          preguntas: allPreguntas.filter(p => p.modulo_norma_id === mid),
        }
      })
      setModulosData(mdata)

      const { data: instRaw, error: instLoadErr } = await tbl('aud_instancia_pregunta')
        .select('id, pregunta_id, respuesta').eq('auditoria_id', auditoriaId)
      if (instLoadErr) throw instLoadErr

      const instancias = (instRaw ?? []) as { id: string; pregunta_id: string; respuesta: string }[]
      const rm = new Map<string, AudRespuesta>()
      const instIdToPreg = new Map<string, string>()
      for (const inst of instancias) {
        rm.set(inst.pregunta_id, inst.respuesta as AudRespuesta)
        instIdToPreg.set(inst.id, inst.pregunta_id)
      }
      setRespuestasMap(rm)

      const vm = new Map<string, Map<string, string>>()
      const om = new Map<string, string>()
      const instIds = instancias.map(i => i.id)
      if (instIds.length > 0) {
        const [valRes, obsRes] = await Promise.all([
          tbl('aud_instancia_valores')
            .select('instancia_id, esquema_id, valor_texto, valor_opciones')
            .in('instancia_id', instIds),
          tbl('aud_observaciones')
            .select('instancia_id, observacion')
            .in('instancia_id', instIds),
        ])
        if (valRes.error) throw valRes.error
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        for (const val of (valRes.data ?? []) as any[]) {
          const pregId = instIdToPreg.get(val.instancia_id)
          if (!pregId) continue
          if (!vm.has(pregId)) vm.set(pregId, new Map())
          const texto = val.valor_texto ?? (Array.isArray(val.valor_opciones) ? val.valor_opciones.join(', ') : '')
          vm.get(pregId)!.set(val.esquema_id, texto)
        }
        if (obsRes.error) console.error('[useAuditorAuditoria] aud_observaciones', obsRes.error)
        for (const obs of (obsRes.data ?? []) as { instancia_id: string; observacion: string | null }[]) {
          const pregId = instIdToPreg.get(obs.instancia_id)
          if (pregId && obs.observacion) om.set(pregId, obs.observacion)
        }
      }
      setValoresMap(vm)
      setObservacionesMap(om)

    } catch (e: unknown) {
      console.error('[useAuditorAuditoria]', e)
      const msg = (e as { message?: string })?.message ?? 'Error al cargar auditoría'
      setErrorMsg(msg)
    } finally {
      setCargando(false)
    }
  }, [auditoriaId])

  useEffect(() => { cargar() }, [cargar])

  async function guardarRespuesta(params: {
    preguntaId: string
    respuesta: AudRespuesta
    trigger: AudTriggerFalla
    valoresMap: Map<string, string>
    observacion?: string
  }): Promise<void> {
    if (!auditoriaId) throw new Error('Sin auditoría activa')
    const orgId = auditoria?.org_id
    if (!orgId) throw new Error('No se pudo identificar la empresa auditada, recarga la auditoría')
    const falla = calcularFallaAutomatica(params.trigger, params.respuesta)

    const { data: instData, error: instErr } = await tbl('aud_instancia_pregunta')
      .upsert(
        {
          org_id: orgId,
          auditoria_id: auditoriaId,
          pregunta_id: params.preguntaId,
          respuesta: params.respuesta,
          estado_aplicabilidad: params.respuesta === 'na' ? 'na_manual' : 'aplicable',
          origen_na: params.respuesta === 'na' ? 'manual' : null,
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
              instancia_id: instanciaId,
              org_id: orgId,
              observacion: texto,
              modo_confirmacion: 'visual',
              capturado_por: profile?.id,
            },
            { onConflict: 'instancia_id' },
          )
        if (obsErr) throw obsErr
      }
    }
  }

  async function cambiarEstado(nuevoEstado: EstadoAuditoria): Promise<void> {
    if (!auditoriaId) throw new Error('Sin auditoría')
    const { error: err } = await tbl('aud_auditorias')
      .update({ estado: nuevoEstado })
      .eq('id', auditoriaId)
    if (err) throw err
    if (nuevoEstado === 'cerrada') {
      await tbl('aud_auditoria_modulos')
        .update({ estado: 'cerrada' })
        .eq('auditoria_id', auditoriaId)
    }
    setAuditoria(prev => prev ? { ...prev, estado: nuevoEstado } : prev)
  }

  return {
    auditoria,
    modulosData,
    esquemaMap,
    respuestasMap,
    setRespuestasMap,
    valoresMap,
    setValoresMap,
    observacionesMap,
    setObservacionesMap,
    cargando,
    errorMsg,
    guardarRespuesta,
    cambiarEstado,
    refetch: cargar,
  }
}
