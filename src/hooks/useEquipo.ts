import { useCallback, useEffect, useState } from 'react'
import { supabase } from '@/lib/supabase'
import { useAuthContext } from '@/context/AuthContext'

// Funciones equipo_* (encargado → operarios). No están en database.types.ts,
// por eso se llaman sin tipado de BD y se tipan aquí.

export interface OperarioEquipo {
  operario_id: string
  nombre: string
  asignado_en: string
  asignado_por: string | null
}

export interface EncargadoEquipo {
  encargado_id: string
  nombre: string
  operarios: OperarioEquipo[]
}

export interface OperarioSinEncargado {
  operario_id: string
  nombre: string
}

export interface EquipoListado {
  org_id: string
  rol: string
  restringir_encargados: boolean
  encargados: EncargadoEquipo[]
  sin_encargado: OperarioSinEncargado[]
}

export interface EventoConfigEquipo {
  restringir_encargados: boolean
  cambiado_por: string | null
  cambiado_por_nombre: string | null
  cambiado_en: string
}

export interface ConfigEquipo {
  org_id: string
  restringir_encargados: boolean
  cambio: boolean
  cambiado_por: string | null
  cambiado_por_nombre: string | null
  cambiado_en: string | null
  encargados_sin_equipo: { encargado_id: string; nombre: string }[]
  eventos: EventoConfigEquipo[]
}

export interface HistorialEquipoItem {
  asignacion_id: string
  operario_id: string
  operario: string
  encargado_id: string
  encargado: string
  asignado_por: string | null
  asignado_por_nombre: string | null
  asignado_en: string
  quitado_por: string | null
  quitado_por_nombre: string | null
  quitado_en: string | null
  motivo_baja: string | null
  vigente: boolean
}

// `p_org` solo lo usa super_admin; el resto de roles toma la organización de la sesión.
async function rpc<T>(nombre: string, args?: Record<string, unknown>): Promise<T> {
  const { data, error } = await (supabase as any).rpc(nombre, args)
  if (error) throw error
  return data as T
}

export const equipoAsignar = (operario: string, encargado?: string) =>
  rpc('equipo_asignar', { p_operario: operario, ...(encargado ? { p_encargado: encargado } : {}) })

export const equipoQuitar = (operario: string) => rpc('equipo_quitar', { p_operario: operario })

export const equipoConfigurar = (restringir: boolean) =>
  rpc<ConfigEquipo>('equipo_config', { p_restringir: restringir })

export const equipoConsultarConfig = () => rpc<ConfigEquipo>('equipo_config')

export const equipoHistorial = () => rpc<HistorialEquipoItem[]>('equipo_historial')

/** Equipo de la organización (admin) o el propio equipo (encargado). */
export function useEquipo(habilitado: boolean) {
  const { profile } = useAuthContext()
  const [equipo, setEquipo] = useState<EquipoListado | null>(null)
  const [loading, setLoading] = useState(habilitado)
  const [error, setError] = useState<string | null>(null)

  const cargar = useCallback(async () => {
    if (!habilitado || !profile?.org_id) {
      setLoading(false)
      return
    }
    setLoading(true)
    setError(null)
    try {
      setEquipo(await rpc<EquipoListado>('equipo_listar'))
    } catch (e: unknown) {
      setError((e as { message?: string } | null)?.message ?? 'No se pudo cargar el equipo')
    } finally {
      setLoading(false)
    }
  }, [habilitado, profile?.org_id])

  useEffect(() => {
    cargar()
  }, [cargar])

  return { equipo, loading, error, refetch: cargar }
}
