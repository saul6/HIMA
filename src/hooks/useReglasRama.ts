import { useState, useCallback, useMemo } from 'react'
import { supabase } from '@/lib/supabase'

// eslint-disable-next-line @typescript-eslint/no-explicit-any
const rpc = (name: string, args?: object) => (supabase as any).rpc(name, args)
// eslint-disable-next-line @typescript-eslint/no-explicit-any
const tbl = (name: string) => (supabase as any).from(name)

export interface CondicionRegla {
  clave: string
  texto: string
}

export interface ReglaRama {
  id: string
  clase: 'A' | 'B' | 'C'
  habilitada: boolean
  principal: string
  disparador: string | null
  principal_conserva: boolean
  causa: string
  condiciones: CondicionRegla[]
  dependientes: string[]
  notas: string | null
  fuente: string | null
  aplicada: boolean
  dependientes_na: string[]
}

export interface CausaNA {
  pregunta_id: string
  regla_id: string
  causa: string
  explicacion: string | null
  actor_id: string | null
  created_at: string
}

export interface AplicarResultado {
  estado: 'APLICADA' | 'CONFLICTO' | 'CONDICIONES_INCOMPLETAS' | 'DISPARADOR_NO_CUMPLIDO' | 'FUERA_DE_ALCANCE' | 'REQUIERE_VALIDACION' | 'CONFLICTO_CATALOGO' | 'VERSION_INCOMPATIBLE'
  mensaje: string
  afectadas?: string[]
  n?: number
  conflictos?: Array<{ question_id: string; tipo: 'respuesta' | 'hallazgo'; valor: string }>
  faltantes?: string[]
}

export interface RetirarResultado {
  estado: 'RETIRADA'
  reactivadas: string[]
  siguen_na_por_otra_causa: string[]
  revision_pendiente: string[]
}

export function useReglasRama(auditoriaId: string | undefined) {
  const [reglas, setReglas] = useState<ReglaRama[]>([])
  const [causas, setCausas] = useState<CausaNA[]>([])
  const [cargando, setCargando] = useState(false)

  const cargar = useCallback(async () => {
    if (!auditoriaId) return
    setCargando(true)
    try {
      const [reglasRes, causasRes] = await Promise.all([
        rpc('aud_reglas_disponibles', { p_auditoria_id: auditoriaId }),
        tbl('aud_na_causas')
          .select('pregunta_id, regla_id, causa, explicacion, actor_id, created_at')
          .eq('auditoria_id', auditoriaId)
          .eq('activa', true),
      ])
      if (reglasRes.error) {
        console.error('[useReglasRama] aud_reglas_disponibles', reglasRes.error)
      } else {
        setReglas((reglasRes.data ?? []) as ReglaRama[])
      }
      if (causasRes.error) {
        console.error('[useReglasRama] aud_na_causas', causasRes.error)
      } else {
        setCausas((causasRes.data ?? []) as CausaNA[])
      }
    } catch (e) {
      console.error('[useReglasRama] cargar', e)
    } finally {
      setCargando(false)
    }
  }, [auditoriaId])

  const reglasPorPrincipal = useMemo(() => {
    const m = new Map<string, ReglaRama[]>()
    for (const r of reglas) {
      if (r.clase === 'A' || r.clase === 'B') {
        if (!m.has(r.principal)) m.set(r.principal, [])
        m.get(r.principal)!.push(r)
      }
    }
    return m
  }, [reglas])

  const reglasPorMiembroC = useMemo(() => {
    const m = new Map<string, ReglaRama[]>()
    for (const r of reglas) {
      if (r.clase === 'C') {
        for (const dep of r.dependientes) {
          if (!m.has(dep)) m.set(dep, [])
          m.get(dep)!.push(r)
        }
      }
    }
    return m
  }, [reglas])

  const causasPorPregunta = useMemo(() => {
    const m = new Map<string, CausaNA[]>()
    for (const c of causas) {
      if (!m.has(c.pregunta_id)) m.set(c.pregunta_id, [])
      m.get(c.pregunta_id)!.push(c)
    }
    return m
  }, [causas])

  async function aplicarRegla(
    reglaId: string,
    explicacion: string,
    confirmaciones: Record<string, boolean>,
    forzar: boolean,
    eventId: string,
  ): Promise<AplicarResultado> {
    if (!auditoriaId) throw new Error('Sin auditoría')
    const { data, error } = await rpc('aud_aplicar_regla_rama', {
      p_auditoria_id: auditoriaId,
      p_regla_id: reglaId,
      p_explicacion: explicacion,
      p_confirmaciones: confirmaciones,
      p_forzar: forzar,
      p_event_id: eventId,
    })
    if (error) {
      console.error('[useReglasRama] aud_aplicar_regla_rama', error)
      throw error
    }
    return data as AplicarResultado
  }

  async function retirarRegla(
    reglaId: string,
    motivo: string,
    eventId: string,
  ): Promise<RetirarResultado> {
    if (!auditoriaId) throw new Error('Sin auditoría')
    const { data, error } = await rpc('aud_retirar_regla_rama', {
      p_auditoria_id: auditoriaId,
      p_regla_id: reglaId,
      p_motivo: motivo,
      p_event_id: eventId,
    })
    if (error) {
      console.error('[useReglasRama] aud_retirar_regla_rama', error)
      throw error
    }
    return data as RetirarResultado
  }

  async function confirmarRevision(preguntaId: string): Promise<void> {
    if (!auditoriaId) throw new Error('Sin auditoría')
    const { error } = await rpc('aud_confirmar_revision', {
      p_auditoria_id: auditoriaId,
      p_pregunta_id: preguntaId,
    })
    if (error) {
      console.error('[useReglasRama] aud_confirmar_revision', error)
      throw error
    }
  }

  return {
    reglas,
    causas,
    reglasPorPrincipal,
    reglasPorMiembroC,
    causasPorPregunta,
    cargando,
    refrescar: cargar,
    aplicarRegla,
    retirarRegla,
    confirmarRevision,
  }
}
