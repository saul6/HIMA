import { supabase } from '@/lib/supabase'

/** Clave de caché del nombre de la organización (compartida con la precarga). */
export const claveOrgNombre = (orgId: string) => `org_nombre:${orgId}`

export async function fetchOrgNombre(orgId: string): Promise<string> {
  const { data, error } = await supabase.from('organizaciones').select('nombre').eq('id', orgId).single()
  if (error || !data) throw error ?? new Error('Organización no encontrada')
  return data.nombre as string
}
