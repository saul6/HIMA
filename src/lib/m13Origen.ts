import { supabase } from '@/lib/supabase'

export interface IncidenciaOrigenResultado {
  incidencia_id: string
  reporte_id: string
  ya_existia: boolean
}

interface Params {
  ranchoId: string
  fecha: string
  origenModulo: string
  origenRegistroId: string
  origenClave: string
  descripcion: string
  reporteId?: string | null
}

// Crea reporte + incidencia M13 en una sola transacción; si la clave ya existe devuelve la existente.
export async function crearIncidenciaDesdeOrigen(p: Params): Promise<IncidenciaOrigenResultado> {
  const { data, error } = await (supabase as any).rpc('m13_incidencia_desde_origen', {
    p_rancho: p.ranchoId,
    p_fecha: p.fecha,
    p_origen_modulo: p.origenModulo,
    p_origen_registro_id: p.origenRegistroId,
    p_origen_clave: p.origenClave,
    p_descripcion: p.descripcion,
    p_reporte_id: p.reporteId ?? null,
  })
  if (error) throw error
  const r = Array.isArray(data) ? data[0] : data
  return r as IncidenciaOrigenResultado
}

// Columnas de origen para el insert offline (opUpsert con este conflicto).
export const CONFLICTO_INCIDENCIA_ORIGEN = ['org_id', 'origen_modulo', 'origen_clave']

export function camposOrigen(modulo: string, registroId: string, clave: string) {
  return { origen_modulo: modulo, origen_registro_id: registroId, origen_clave: clave }
}
