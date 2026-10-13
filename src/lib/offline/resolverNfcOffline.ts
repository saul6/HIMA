import { supabase } from '@/lib/supabase'
import { leerConCache } from './cacheLectura'
import type { M21Estacion } from '@/hooks/useM21EstacionesRancho'

// Claves de caché compartidas con la precarga (ModulosContext)
export const CLAVE_ESTACIONES_ORG = 'm21_estaciones_org'
export const CLAVE_NFC_ACTIVO = 'org_nfc_activo'

export type NfcMotivo = 'TOKEN_INVALIDO' | 'FUNCION_NO_ACTIVA' | 'SIN_ACCESO' | 'ESTACION_INACTIVA'

export type NfcRespuesta =
  | { ok: true; estacion_id: string; rancho_id: string; tipo_trampa: string; numero: string; ruta: string }
  | { ok: false; motivo: NfcMotivo }

export async function fetchEstacionesOrg(orgId: string): Promise<M21Estacion[]> {
  const { data, error } = await (supabase as any)
    .from('m21_estaciones')
    .select('*')
    .eq('org_id', orgId)
  if (error) throw error
  return data ?? []
}

export async function fetchNfcActivo(orgId: string): Promise<boolean> {
  const { data, error } = await (supabase as any)
    .from('organizaciones')
    .select('nfc_trampas_activo')
    .eq('id', orgId)
    .single()
  if (error) throw error
  return data?.nfc_trampas_activo === true
}

// Replica resolver_nfc_estacion con las estaciones y el indicador en caché.
// Devuelve null si no hay caché utilizable (el llamador muestra "Sin conexión").
// Nota: las estaciones de otra organización no están en caché (RLS), así que sin red un chip ajeno
// se reporta como TOKEN_INVALIDO; el motivo SIN_ACCESO solo lo distingue el servidor.
export async function resolverNfcOffline(
  token: string,
  userId: string,
  orgId: string,
): Promise<NfcRespuesta | null> {
  let estaciones: M21Estacion[]
  let activa: boolean
  try {
    // Sin red leerConCache devuelve la caché (hasta 7 días) o lanza si no hay
    estaciones = (await leerConCache(CLAVE_ESTACIONES_ORG, userId, orgId, () => fetchEstacionesOrg(orgId))).datos
    activa = (await leerConCache(CLAVE_NFC_ACTIVO, userId, orgId, () => fetchNfcActivo(orgId))).datos
  } catch {
    return null
  }
  const e = estaciones.find(x => x.nfc_token === token)
  if (!e) return { ok: false, motivo: 'TOKEN_INVALIDO' }
  if (!activa) return { ok: false, motivo: 'FUNCION_NO_ACTIVA' }
  if (e.org_id !== orgId) return { ok: false, motivo: 'SIN_ACCESO' }
  if (!e.activo) return { ok: false, motivo: 'ESTACION_INACTIVA' }
  return {
    ok: true,
    estacion_id: e.id,
    rancho_id: e.rancho_id,
    tipo_trampa: e.tipo_trampa,
    numero: e.numero,
    ruta: '/inocuidad/monitoreo-plagas',
  }
}
