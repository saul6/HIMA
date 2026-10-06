import { useCallback } from 'react'
import { supabase } from '@/lib/supabase'
import { toast } from 'sonner'

export interface ColaboradorProductividad {
  profile_id: string
  nombre: string
  rol: string
  activo: boolean
  posicion: number
  registros: number
  dias_matriz: number
  capturas: number
  correcciones: number
  pct_correccion: number | null
  sin_firma: number
  por_modulo: Record<string, number> | null
}

export interface VerificacionProductividad {
  verificados: number
  pendientes_verificar: number
  horas_promedio: number | null
  por_verificador: Record<string, number>
}

export interface MetProductividad {
  es_admin: boolean
  colaboradores: ColaboradorProductividad[] | null
  verificacion: VerificacionProductividad | null
  total_colaboradores: number
  colaboradores_con_capturas: number
}

export interface ColaboradorAgenda {
  profile_id: string
  nombre: string
  asignadas: number
  cerradas: number
  a_tiempo: number
  vencidas_abiertas: number
  regresadas: number
  dias_promedio_cierre: number | null
}

export interface MetAgenda {
  es_admin: boolean
  colaboradores: ColaboradorAgenda[] | null
}

export interface AuditoriaInterna {
  modulo: string
  nombre: string
  fecha: string
  rancho: string
  porcentaje: number
  puntos: number
  posibles: number
  estado: string
}

export interface AuditoriaExterna {
  fecha: string
  resultado: string
  falla_automatica: boolean
  por_modulo: Record<string, unknown> | null
  nc_abiertas: number
}

export interface FallaRecurrente {
  modulo: string
  punto: string
  veces: number
}

export interface MetCumplimiento {
  permitido: boolean
  internas: AuditoriaInterna[] | null
  internas_promedio: Record<string, number> | null
  externas: AuditoriaExterna[] | null
  incidencias: { reportes: number; incidencias: number; por_mes: Record<string, number> } | null
  fallas_recurrentes: FallaRecurrente[] | null
}

export interface ModuloConstancia {
  modulo: string
  nombre: string
  frecuencia: string
  rancho_id: string
  rancho: string
  esperados: number
  cubiertos: number
  pct: number
  huecos_recientes: string[] | null
}

export interface MetConstancia {
  permitido: boolean
  modulos: ModuloConstancia[] | null
}

export interface MetCampo {
  permitido: boolean
  aplicaciones_por_mes: Record<string, { aplicaciones: number; ha: number }> | null
  productos_top: { producto: string; aplicaciones: number }[] | null
  cosechas_en_intervalo: { fecha: string; rancho: string; sector: string; aplicacion_fecha: string; cosecha_permitida_desde: string }[] | null
}

function errorGenerico() {
  toast.error('No se pudieron cargar las métricas')
}

export function useMetricas() {
  const cargarProductividad = useCallback(async (
    desde: string,
    hasta: string,
    rancho: string | null
  ): Promise<MetProductividad | null> => {
    try {
      const { data, error } = await supabase.rpc('met_productividad', {
        p_desde: desde,
        p_hasta: hasta,
        p_rancho: rancho ?? null,
      })
      if (error) throw error
      return data as MetProductividad
    } catch {
      errorGenerico()
      return null
    }
  }, [])

  const cargarAgenda = useCallback(async (
    desde: string,
    hasta: string
  ): Promise<MetAgenda | null> => {
    try {
      const { data, error } = await supabase.rpc('met_agenda', {
        p_desde: desde,
        p_hasta: hasta,
      })
      if (error) throw error
      return data as MetAgenda
    } catch {
      errorGenerico()
      return null
    }
  }, [])

  const cargarCumplimiento = useCallback(async (
    desde: string,
    hasta: string,
    rancho: string | null
  ): Promise<MetCumplimiento | null> => {
    try {
      const { data, error } = await supabase.rpc('met_cumplimiento', {
        p_desde: desde,
        p_hasta: hasta,
        p_rancho: rancho ?? null,
      })
      if (error) throw error
      return data as MetCumplimiento
    } catch {
      errorGenerico()
      return null
    }
  }, [])

  const cargarConstancia = useCallback(async (
    desde: string,
    hasta: string,
    rancho: string | null
  ): Promise<MetConstancia | null> => {
    try {
      const { data, error } = await supabase.rpc('met_constancia', {
        p_desde: desde,
        p_hasta: hasta,
        p_rancho: rancho ?? null,
      })
      if (error) throw error
      return data as MetConstancia
    } catch {
      errorGenerico()
      return null
    }
  }, [])

  const cargarCampo = useCallback(async (
    desde: string,
    hasta: string,
    rancho: string | null
  ): Promise<MetCampo | null> => {
    try {
      const { data, error } = await supabase.rpc('met_campo', {
        p_desde: desde,
        p_hasta: hasta,
        p_rancho: rancho ?? null,
      })
      if (error) throw error
      return data as MetCampo
    } catch {
      errorGenerico()
      return null
    }
  }, [])

  return { cargarProductividad, cargarAgenda, cargarCumplimiento, cargarConstancia, cargarCampo }
}
