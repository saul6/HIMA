import { useEffect, useState } from 'react'
import { supabase } from '@/lib/supabase'

export interface ColaboradorChk { id: string; nombre: string; rol: string }

/** Colaboradores de la org (RPC org_colaboradores). `admins` = posibles revisores. */
export function useColaboradoresChk(habilitado: boolean) {
  const [colaboradores, setColaboradores] = useState<ColaboradorChk[]>([])

  useEffect(() => {
    if (!habilitado) return
    let vivo = true
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const llamada = (supabase as any).rpc('org_colaboradores')
    llamada.then(({ data, error }: { data: unknown; error: unknown }) => {
      if (!vivo) return
      if (error) { console.error('[useColaboradoresChk]', error); return }
      setColaboradores((data as ColaboradorChk[]) ?? [])
    })
    return () => { vivo = false }
  }, [habilitado])

  return { colaboradores, admins: colaboradores.filter(c => c.rol === 'admin_org') }
}
