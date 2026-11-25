import { useState, useEffect, useCallback } from 'react'
import { supabase } from '@/lib/supabase'
import { useAuthContext } from '@/context/AuthContext'
import { mensajeErrorBd } from '@/lib/erroresBd'
import type { EquipoListado } from '@/hooks/useEquipo'

export type FirmaEstado = 'firmado' | 'falta_verifico' | 'sin_firma'
export type TipoActividad = 'registro' | 'jornada' | 'dia'
export type FiltroSolo = 'correccion' | 'sin_verificar' | 'sin_firma'

export interface ActividadItem {
  clave: string
  modulo: string
  modulo_nombre: string
  ruta: string
  tabla: string
  tipo: TipoActividad
  registro_id: string
  ids: string[]
  rancho_id: string | null
  rancho_nombre: string | null
  fecha: string
  creado_en: string
  hora_exacta: boolean
  creado_por: string | null
  creado_por_nombre: string | null
  requiere_correccion: boolean
  comentario_correccion: string | null
  marcado_por_nombre: string | null
  marcado_en: string | null
  puede_marcar: boolean
  firma: FirmaEstado
}

export interface ResumenActividad {
  total: number
  hoy: number
  semana: number
  sin_verificar: number
  sin_firma: number
  por_corregir: number
}

export interface EmpleadoBasico {
  id: string
  nombre_completo: string
}

export interface FiltrosActividad {
  desde: string
  hasta: string
  usuario: string
  modulo: string
  rancho: string
  solo: FiltroSolo | ''
}

interface RespuestaActividad {
  resumen?: ResumenActividad
  total_filtrado?: number
  truncado?: boolean
  items?: ActividadItem[]
}

const RESUMEN_VACIO: ResumenActividad = {
  total: 0, hoy: 0, semana: 0, sin_verificar: 0, sin_firma: 0, por_corregir: 0,
}

export function useActividadEquipo(filtros: FiltrosActividad) {
  const { profile } = useAuthContext()
  const [items, setItems] = useState<ActividadItem[]>([])
  const [resumen, setResumen] = useState<ResumenActividad>(RESUMEN_VACIO)
  const [totalFiltrado, setTotalFiltrado] = useState(0)
  const [truncado, setTruncado] = useState(false)
  const [empleados, setEmpleados] = useState<EmpleadoBasico[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [restringido, setRestringido] = useState(false)

  const { desde, hasta, usuario, modulo, rancho, solo } = filtros
  // Administrador y Encargado ven la actividad del equipo (solo lectura)
  const esAdmin = profile?.rol === 'admin_org' || profile?.rol === 'asesor_tecnico' || profile?.rol === 'super_admin'
  const esEncargado = profile?.rol === 'asesor_tecnico'

  const cargar = useCallback(async () => {
    if (!profile?.org_id || !esAdmin) {
      setLoading(false)
      return
    }
    setLoading(true)
    setError(null)
    try {
      // Encargado con el interruptor prendido: el filtro de colaboradores es su equipo
      // (equipo_listar), no toda la organización. Apagado, como siempre (profiles).
      let equipoEncargado: EquipoListado | null = null
      if (esEncargado) {
        equipoEncargado = await (supabase as any)
          .rpc('equipo_listar')
          .then(({ data, error: err }: { data: EquipoListado | null; error: unknown }) => {
            if (err) throw err
            return data
          })
      }
      const restringe = !!equipoEncargado?.restringir_encargados
      setRestringido(restringe)
      const [empResult, actResult] = await Promise.all([
        restringe
          ? Promise.resolve({
              data: [
                { id: profile.id, nombre_completo: profile.nombre_completo ?? 'Yo' },
                ...(equipoEncargado!.encargados
                  .find((e) => e.encargado_id === profile.id)
                  ?.operarios.map((o) => ({ id: o.operario_id, nombre_completo: o.nombre })) ?? []),
              ] as EmpleadoBasico[],
              error: null,
            })
          : supabase
              .from('profiles')
              .select('id, nombre_completo')
              .eq('org_id', profile.org_id)
              .eq('activo', true),
        supabase.rpc('actividad_equipo', {
          p_desde: desde,
          p_hasta: hasta,
          p_usuario: usuario || null,
          p_modulo: modulo || null,
          p_rancho: rancho || null,
          p_solo: solo || null,
        }),
      ])
      if (empResult.error) throw empResult.error
      if (actResult.error) throw actResult.error
      setEmpleados(empResult.data ?? [])
      const r = (actResult.data ?? {}) as RespuestaActividad
      setItems(r.items ?? [])
      setResumen(r.resumen ?? RESUMEN_VACIO)
      setTotalFiltrado(r.total_filtrado ?? (r.items?.length ?? 0))
      setTruncado(!!r.truncado)
    } catch (e: unknown) {
      setError(mensajeErrorBd(e, 'Error al cargar la actividad del equipo'))
    } finally {
      setLoading(false)
    }
  }, [profile?.org_id, profile?.id, profile?.nombre_completo, esAdmin, esEncargado, desde, hasta, usuario, modulo, rancho, solo])

  useEffect(() => {
    cargar()
  }, [cargar])

  return { items, resumen, totalFiltrado, truncado, empleados, restringido, loading, error, refetch: cargar }
}
