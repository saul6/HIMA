import { useState, useEffect, useCallback } from 'react'
import { supabase } from '@/lib/supabase'
import { useAuthContext } from '@/context/AuthContext'
import type {
  AuditoriaSeccion,
  AuditoriaPregunta,
  AuditoriaBase,
  AuditoriaRespuesta,
  RespuestaAuditoria,
  EstadoAuditoria,
} from '@/types/database.types'

export type ModuloAuditoria = 'm14' | 'm15' | 'm16' | 'm17' | 'm18'

export interface AuditoriaConRancho extends AuditoriaBase {
  rancho_nombre: string
  rancho_codigo: string
  portada: Record<string, unknown> | null
}

export function calcularAgregados(
  preguntas: AuditoriaPregunta[],
  respuestas: Map<string, RespuestaAuditoria>
): { puntos_obtenidos: number; puntos_posibles: number; porcentaje: number } {
  let obtenidos = 0
  let posibles = 0
  for (const p of preguntas) {
    const r = respuestas.get(p.id)
    if (!r || r === 'na') continue
    posibles += p.puntos
    if (r === 'cumple') obtenidos += p.puntos
  }
  const porcentaje = posibles > 0 ? Math.round((obtenidos / posibles) * 10000) / 100 : 0
  return { puntos_obtenidos: obtenidos, puntos_posibles: posibles, porcentaje }
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any
const tbl = (name: string) => (supabase as any).from(name)

export function useAuditoria(modulo: ModuloAuditoria) {
  const { profile } = useAuthContext()

  const [secciones, setSecciones] = useState<AuditoriaSeccion[]>([])
  const [preguntas, setPreguntas] = useState<AuditoriaPregunta[]>([])
  const [loadingCatalogo, setLoadingCatalogo] = useState(true)

  const [auditorias, setAuditorias] = useState<AuditoriaConRancho[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  // Load global catalog (no org_id filter)
  useEffect(() => {
    let cancelado = false
    async function loadCatalogo() {
      try {
        const [{ data: secsData, error: secsErr }, { data: pregsData, error: pregsErr }] =
          await Promise.all([
            tbl(`${modulo}_secciones`).select('*').order('orden'),
            tbl(`${modulo}_preguntas`).select('*').eq('activo', true).order('orden_seccion'),
          ])
        if (cancelado) return
        if (secsErr) throw secsErr
        if (pregsErr) throw pregsErr
        setSecciones(secsData ?? [])
        setPreguntas(pregsData ?? [])
      } finally {
        if (!cancelado) setLoadingCatalogo(false)
      }
    }
    loadCatalogo()
    return () => { cancelado = true }
  }, [modulo])

  const cargar = useCallback(async () => {
    if (!profile?.org_id) { setLoading(false); return }
    setLoading(true)
    setError(null)
    try {
      const { data, error: err } = await tbl(`${modulo}_auditorias`)
        .select('*, ranchos(nombre, codigo)')
        .eq('org_id', profile.org_id)
        .order('fecha', { ascending: false })
        .limit(50)
      if (err) throw err
      setAuditorias(
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        (data ?? []).map((r: any) => ({
          ...r,
          rancho_nombre: r.ranchos?.nombre ?? '—',
          rancho_codigo: r.ranchos?.codigo ?? '—',
          portada: r.portada ?? null,
          requiere_correccion: r.requiere_correccion ?? false,
          comentario_correccion: r.comentario_correccion ?? null,
        }))
      )
    } catch (e: unknown) {
      setError(e instanceof Error ? e.message : 'Error al cargar auditorías')
    } finally {
      setLoading(false)
    }
  }, [modulo, profile?.org_id])

  useEffect(() => { cargar() }, [cargar])

  async function cargarRespuestas(auditoriaId: string): Promise<AuditoriaRespuesta[]> {
    const { data, error: err } = await tbl(`${modulo}_respuestas`)
      .select('*')
      .eq('auditoria_id', auditoriaId)
    if (err) throw err
    return data ?? []
  }

  async function guardar(params: {
    auditoriaId?: string
    rancho_id: string
    fecha: string
    auditor_nombre: string
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    portada?: any
    estado: EstadoAuditoria
    respuestasMap: Map<string, RespuestaAuditoria>
    comentariosMap: Map<string, string>
  }): Promise<string> {
    if (!profile?.org_id) throw new Error('Sin organización activa')

    const { puntos_obtenidos, puntos_posibles, porcentaje } = calcularAgregados(
      preguntas,
      params.respuestasMap
    )

    let auditoriaId: string

    const campos = {
      rancho_id: params.rancho_id,
      fecha: params.fecha,
      auditor_nombre: params.auditor_nombre || null,
      portada: params.portada ?? null,
      estado: params.estado,
      puntos_obtenidos,
      puntos_posibles,
      porcentaje,
    }

    if (params.auditoriaId) {
      const { error: err } = await tbl(`${modulo}_auditorias`)
        .update(campos)
        .eq('id', params.auditoriaId)
        .eq('org_id', profile.org_id)
      if (err) throw err
      auditoriaId = params.auditoriaId
    } else {
      const { data, error: err } = await tbl(`${modulo}_auditorias`)
        .insert({ ...campos, org_id: profile.org_id, realizado_por_id: profile.id })
        .select('id')
        .single()
      if (err) throw err
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      auditoriaId = (data as any).id
    }

    const filas = Array.from(params.respuestasMap.entries()).map(([pregunta_id, respuesta]) => {
      const preg = preguntas.find((p) => p.id === pregunta_id)
      return {
        auditoria_id: auditoriaId,
        org_id: profile.org_id,
        pregunta_id,
        respuesta,
        comentario: params.comentariosMap.get(pregunta_id) ?? null,
        puntos_otorgados: respuesta === 'cumple' ? (preg?.puntos ?? 0) : 0,
      }
    })

    if (filas.length > 0) {
      const { error: err } = await tbl(`${modulo}_respuestas`)
        .upsert(filas, { onConflict: 'auditoria_id,pregunta_id' })
      if (err) throw err
    }

    return auditoriaId
  }

  return {
    secciones,
    preguntas,
    loadingCatalogo,
    auditorias,
    loading,
    error,
    refetch: cargar,
    cargarRespuestas,
    guardar,
  }
}
