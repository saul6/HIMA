import { useState, useEffect, useCallback, useMemo } from 'react'
import { supabase } from '@/lib/supabase'
import { useAuthContext } from '@/context/AuthContext'
import { useOutbox } from '@/hooks/useOutbox'
import { useGuardarOffline } from '@/hooks/useGuardarOffline'
import { leerConCache } from '@/lib/offline/cacheLectura'
import { opInsert, opUpdate, opUpsert } from '@/lib/offline/construirOperaciones'
import { SYNC_OK_EVENT } from '@/lib/offline/sync'
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
  /** Capturada sin conexión; sigue en el outbox */
  sin_subir?: boolean
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
  const { profile, user } = useAuthContext()
  const userId = user?.id ?? null
  const { guardar: guardarOffline } = useGuardarOffline(modulo.toUpperCase())
  const { pendientes } = useOutbox(modulo.toUpperCase())

  const [secciones, setSecciones] = useState<AuditoriaSeccion[]>([])
  const [preguntas, setPreguntas] = useState<AuditoriaPregunta[]>([])
  const [loadingCatalogo, setLoadingCatalogo] = useState(true)

  const [auditoriasBase, setAuditoriasBase] = useState<AuditoriaConRancho[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  // Load global catalog (no org_id filter)
  useEffect(() => {
    if (!userId || !profile?.org_id) { setLoadingCatalogo(false); return }
    const orgId = profile.org_id
    let cancelado = false
    async function loadCatalogo() {
      try {
        const r = await leerConCache<{ secs: AuditoriaSeccion[]; pregs: AuditoriaPregunta[] }>(
          `${modulo}_catalogo`,
          userId!,
          orgId,
          async () => {
            const [{ data: secsData, error: secsErr }, { data: pregsData, error: pregsErr }] =
              await Promise.all([
                tbl(`${modulo}_secciones`).select('*').order('orden'),
                tbl(`${modulo}_preguntas`).select('*').eq('activo', true).order('orden_seccion'),
              ])
            if (secsErr) throw secsErr
            if (pregsErr) throw pregsErr
            return { secs: secsData ?? [], pregs: pregsData ?? [] }
          },
        )
        if (cancelado) return
        setSecciones(r.datos.secs)
        setPreguntas(r.datos.pregs)
      } finally {
        if (!cancelado) setLoadingCatalogo(false)
      }
    }
    loadCatalogo().catch(() => {})
    return () => { cancelado = true }
  }, [modulo, userId, profile?.org_id])

  const cargar = useCallback(async () => {
    if (!profile?.org_id || !userId) { setLoading(false); return }
    const orgId = profile.org_id
    setLoading(true)
    setError(null)
    try {
      const resultado = await leerConCache(`${modulo}_auditorias`, userId, orgId, async () => {
        const { data, error: err } = await tbl(`${modulo}_auditorias`)
          .select('*, ranchos(nombre, codigo)')
          .eq('org_id', orgId)
          .order('fecha', { ascending: false })
          .limit(50)
        if (err) throw err
        return data ?? []
      })
      setAuditoriasBase(
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        (resultado.datos as any[]).map((r: any) => ({
          ...r,
          rancho_nombre: r.ranchos?.nombre ?? '—',
          rancho_codigo: r.ranchos?.codigo ?? '—',
          portada: r.portada ?? null,
          requiere_correccion: r.requiere_correccion ?? false,
          comentario_correccion: r.comentario_correccion ?? null,
        }))
      )
    } catch (e: unknown) {
      setError((e as { message?: string })?.message ?? 'Error al cargar auditorías')
    } finally {
      setLoading(false)
    }
  }, [modulo, profile?.org_id, userId])

  useEffect(() => { cargar() }, [cargar])

  // Al terminar de sincronizar se vuelve a leer para mostrar lo ya real
  useEffect(() => {
    const h = () => { cargar() }
    window.addEventListener(SYNC_OK_EVENT, h)
    return () => window.removeEventListener(SYNC_OK_EVENT, h)
  }, [cargar])

  // Auditorías (nuevas o editadas) capturadas sin conexión que siguen en el outbox
  const { auditorias, idsLocales } = useMemo(() => {
    const porId = new Map<string, AuditoriaConRancho>(auditoriasBase.map(a => [a.id, a]))
    const locales = new Set<string>()
    for (const lote of pendientes) {
      const meta = (lote.metadatos ?? {}) as { rancho_nombre?: string; rancho_codigo?: string }
      for (const op of lote.operaciones) {
        if (op.tabla !== `${modulo}_auditorias`) continue
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        const f = op.fila as Record<string, any>
        const previa = porId.get(f.id)
        if (op.tipo === 'update' && !previa) continue
        if (op.tipo !== 'update') locales.add(f.id)
        porId.set(f.id, {
          ...(previa ?? {
            rancho_nombre: meta.rancho_nombre ?? '—',
            rancho_codigo: meta.rancho_codigo ?? '—',
            requiere_correccion: false,
            comentario_correccion: null,
          } as unknown as AuditoriaConRancho),
          ...f,
          portada: f.portada ?? previa?.portada ?? null,
          sin_subir: true,
        } as AuditoriaConRancho)
      }
    }
    const lista = Array.from(porId.values()).sort((a, b) => (b.fecha ?? '').localeCompare(a.fecha ?? ''))
    return { auditorias: lista, idsLocales: locales }
  }, [auditoriasBase, pendientes, modulo])

  async function cargarRespuestas(auditoriaId: string): Promise<AuditoriaRespuesta[]> {
    let base: AuditoriaRespuesta[] = []
    try {
      if (userId && profile?.org_id) {
        const r = await leerConCache<AuditoriaRespuesta[]>(
          `${modulo}_respuestas:${auditoriaId}`,
          userId,
          profile.org_id,
          async () => {
            const { data, error: err } = await tbl(`${modulo}_respuestas`)
              .select('*')
              .eq('auditoria_id', auditoriaId)
            if (err) throw err
            return data ?? []
          },
        )
        base = r.datos
      }
    } catch (e) {
      // Una auditoría creada sin conexión aún no existe en el servidor: solo hay pendientes
      if (!idsLocales.has(auditoriaId)) throw e
    }
    // Respuestas capturadas sin conexión (las más recientes ganan)
    const porPregunta = new Map<string, AuditoriaRespuesta>(base.map(r => [r.pregunta_id, r]))
    for (const lote of pendientes) {
      for (const op of lote.operaciones) {
        if (op.tabla !== `${modulo}_respuestas`) continue
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        const f = op.fila as Record<string, any>
        if (f.auditoria_id !== auditoriaId) continue
        porPregunta.set(f.pregunta_id, f as unknown as AuditoriaRespuesta)
      }
    }
    return Array.from(porPregunta.values())
  }

  // Devuelve el id de la auditoría, o null si no se pudo guardar sin conexión (ya se avisó al usuario).
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
    rancho_nombre?: string
    rancho_codigo?: string
  }): Promise<string | null> {
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

    if (!navigator.onLine) {
      // Sin red: cabecera (o su UPDATE con los totales) y respuestas en un solo lote
      const idOff = params.auditoriaId ?? crypto.randomUUID()
      const filasOff = Array.from(params.respuestasMap.entries()).map(([pregunta_id, respuesta]) => {
        const preg = preguntas.find((p) => p.id === pregunta_id)
        return opUpsert(`${modulo}_respuestas`, {
          auditoria_id: idOff,
          pregunta_id,
          respuesta,
          comentario: params.comentariosMap.get(pregunta_id) ?? null,
          puntos_otorgados: respuesta === 'cumple' ? (preg?.puntos ?? 0) : 0,
        }, ['auditoria_id', 'pregunta_id'])
      })
      const cabecera = params.auditoriaId
        ? opUpdate(`${modulo}_auditorias`, idOff, campos)
        : opInsert(`${modulo}_auditorias`, { ...campos, id: idOff, realizado_por_id: profile.id })
      const ok = await guardarOffline({
        descripcion: `Auditoría ${modulo.toUpperCase()} · ${params.rancho_nombre ?? ''} · ${params.fecha}`,
        metadatos: {
          rancho_id: params.rancho_id,
          rancho_nombre: params.rancho_nombre,
          rancho_codigo: params.rancho_codigo,
          fecha: params.fecha,
          estado: params.estado,
        },
        operaciones: [cabecera, ...filasOff],
      })
      return ok ? idOff : null
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
