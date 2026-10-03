import { useState, useCallback } from 'react'
import { supabase } from '@/lib/supabase'

// eslint-disable-next-line @typescript-eslint/no-explicit-any
const rpc = (fn: string, args?: Record<string, unknown>) => (supabase as any).rpc(fn, args)

export interface JornadaCandidataFila {
  auditoria_id: string
  estado: string
  fecha: string
  productor: string
  operacion: string
  operacion_codigo: string | null
  tipo_operacion: string | null
  producto: string | null
  modulos: number[]
  efimera: boolean
  en_jornada_abierta: boolean
}

export interface JornadaResumen {
  jornada_id: string
  nombre: string
  fecha: string
  estado: 'abierta' | 'terminada'
  contexto: JornadaContexto | null
  operaciones: { auditoria_id: string; productor: string; operacion: string }[]
}

export interface JornadaContexto {
  auditoria_id?: string
  question_id?: string
  campo?: string
}

export interface JornadaConteo {
  total: number
  pendientes: number
  resueltas: number
}

export interface JornadaOperacionDetalle {
  auditoria_id: string
  productor: string
  operacion: string
  operacion_codigo: string | null
  tipo_operacion: string | null
  producto: string | null
  estado: string
  fecha: string
  orden: number
  disponible: boolean
  motivo: string | null
  conteo: JornadaConteo
  estado_calculo: string
  herencia_pendiente: number
  issues_abiertos: number
}

export interface JornadaDetalle {
  jornada: {
    id: string
    nombre: string
    fecha: string
    estado: 'abierta' | 'terminada'
    contexto: JornadaContexto | null
  }
  operaciones: JornadaOperacionDetalle[]
}

export interface JornadaPreguntaDestino {
  auditoria_id: string
  pregunta_id: string
  respuesta: string | null
  aplicabilidad: string | null
  herencia_pendiente: boolean
}

export interface JornadaPregunta {
  question_id: string
  modulo: string
  texto: string
  destinos: JornadaPreguntaDestino[]
}

export function useAuditorJornada() {
  const [candidatas, setCandidatas] = useState<JornadaCandidataFila[]>([])
  const [cargandoCandidatas, setCargandoCandidatas] = useState(false)
  const [errorCandidatas, setErrorCandidatas] = useState<string | null>(null)

  const [jornadas, setJornadas] = useState<JornadaResumen[]>([])
  const [cargandoJornadas, setCargandoJornadas] = useState(false)

  const cargarCandidatas = useCallback(async () => {
    setCargandoCandidatas(true)
    setErrorCandidatas(null)
    try {
      const { data, error } = await rpc('aud_jornada_candidatas')
      if (error) throw error
      setCandidatas((data ?? []) as JornadaCandidataFila[])
    } catch (e) {
      console.error('[useAuditorJornada] candidatas', e)
      setErrorCandidatas('No se pudieron cargar las operaciones disponibles.')
    } finally {
      setCargandoCandidatas(false)
    }
  }, [])

  const cargarJornadas = useCallback(async () => {
    setCargandoJornadas(true)
    try {
      const { data, error } = await rpc('aud_jornadas_mias')
      if (error) throw error
      setJornadas((data ?? []) as JornadaResumen[])
    } catch (e) {
      console.error('[useAuditorJornada] jornadas', e)
    } finally {
      setCargandoJornadas(false)
    }
  }, [])

  const crearJornada = useCallback(async (nombre: string, auditoriaIds: string[]): Promise<string> => {
    const eventId = crypto.randomUUID()
    const { data, error } = await rpc('aud_jornada_crear', {
      p_nombre: nombre,
      p_auditorias: auditoriaIds,
      p_event_id: eventId,
    })
    if (error) throw error
    return (data as { jornada_id: string }).jornada_id
  }, [])

  const cargarDetalle = useCallback(async (jornadaId: string): Promise<JornadaDetalle | null> => {
    const { data, error } = await rpc('aud_jornada_detalle', { p_jornada: jornadaId })
    if (error) {
      console.error('[useAuditorJornada] detalle', error)
      return null
    }
    return data as JornadaDetalle
  }, [])

  const cargarPreguntas = useCallback(async (jornadaId: string, modulo?: string): Promise<JornadaPregunta[]> => {
    const args: Record<string, unknown> = { p_jornada: jornadaId }
    if (modulo) args.p_modulo = modulo
    const { data, error } = await rpc('aud_jornada_preguntas', args)
    if (error) {
      console.error('[useAuditorJornada] preguntas', error)
      return []
    }
    return (data ?? []) as JornadaPregunta[]
  }, [])

  const agregarOperacion = useCallback(async (jornadaId: string, auditoriaId: string): Promise<void> => {
    const { error } = await rpc('aud_jornada_agregar', { p_jornada: jornadaId, p_auditoria: auditoriaId })
    if (error) throw error
  }, [])

  const retirarOperacion = useCallback(async (jornadaId: string, auditoriaId: string): Promise<void> => {
    const { error } = await rpc('aud_jornada_retirar', { p_jornada: jornadaId, p_auditoria: auditoriaId })
    if (error) throw error
  }, [])

  const terminarJornada = useCallback(async (jornadaId: string): Promise<void> => {
    const { error } = await rpc('aud_jornada_terminar', { p_jornada: jornadaId })
    if (error) throw error
  }, [])

  const guardarContexto = useCallback(async (jornadaId: string, contexto: JornadaContexto): Promise<void> => {
    await rpc('aud_jornada_guardar_contexto', { p_jornada: jornadaId, p_contexto: contexto })
  }, [])

  return {
    candidatas, cargandoCandidatas, errorCandidatas, cargarCandidatas,
    jornadas, cargandoJornadas, cargarJornadas,
    crearJornada,
    cargarDetalle, cargarPreguntas,
    agregarOperacion, retirarOperacion,
    terminarJornada, guardarContexto,
  }
}
