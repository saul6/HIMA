import { useEffect, useState } from 'react'
import { supabase } from '@/lib/supabase'

export type PermisoAud =
  | 'audit.read' | 'audit.write' | 'audit.review'
  | 'evidence.link' | 'evidence.upload'
  | 'nc.read' | 'nc.write' | 'ac.read' | 'ac.write'
  | 'external_status.record' | 'module_record.read'

export function useMisPermisos() {
  const [permisos, setPermisos] = useState<Set<PermisoAud>>(new Set())
  const [cargando, setCargando] = useState(true)

  useEffect(() => {
    let vivo = true
    ;(async () => {
      try {
        const { data, error } = await (supabase as any).rpc('aud_mis_permisos')
        if (error) throw error
        if (vivo) setPermisos(new Set((data ?? []).map((r: any) => r.permiso as PermisoAud)))
      } catch (e) {
        // Falla suave: el RLS sigue protegiendo el backend. Sin permisos → solo lectura.
        console.error('[useMisPermisos]', e)
      } finally {
        if (vivo) setCargando(false)
      }
    })()
    return () => { vivo = false }
  }, [])

  const can = (p: PermisoAud) => permisos.has(p)
  return { permisos, can, cargando }
}
