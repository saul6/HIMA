import { useState, useEffect } from 'react'
import { supabase } from '@/lib/supabase'
import { useAuthContext } from '@/context/AuthContext'

// eslint-disable-next-line @typescript-eslint/no-explicit-any
const tbl = (name: string) => (supabase as any).from(name)

export interface OrgAsignada {
  org_id: string
  nombre: string
  tipo: string | null
  num_ranchos: number
  certificadora_org_id: string
}

export function useAuditorAsignaciones() {
  const { profile } = useAuthContext()
  const [orgs, setOrgs] = useState<OrgAsignada[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    if (!profile?.id) return
    let cancelado = false

    async function cargar() {
      setLoading(true)
      setError(null)
      try {
        const { data: asigs, error: aErr } = await tbl('auditor_asignaciones')
          .select('productor_org_id, certificadora_org_id')
          .eq('auditor_profile_id', profile!.id)
          .eq('activo', true)
        if (aErr) throw aErr

        if (!asigs || asigs.length === 0) {
          if (!cancelado) { setOrgs([]); setLoading(false) }
          return
        }

        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        const orgIds = (asigs as any[]).map(a => a.productor_org_id)
        const certMap = new Map<string, string>(
          // eslint-disable-next-line @typescript-eslint/no-explicit-any
          (asigs as any[]).map(a => [a.productor_org_id, a.certificadora_org_id])
        )

        const [orgRes, ranchoRes] = await Promise.all([
          tbl('organizaciones').select('id, nombre, tipo').in('id', orgIds),
          tbl('ranchos').select('org_id').in('org_id', orgIds),
        ])
        if (orgRes.error) throw orgRes.error

        const ranCounts = new Map<string, number>()
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        for (const r of (ranchoRes.data ?? []) as any[]) {
          ranCounts.set(r.org_id, (ranCounts.get(r.org_id) ?? 0) + 1)
        }

        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        const result: OrgAsignada[] = (orgRes.data ?? []).map((o: any) => ({
          org_id: o.id,
          nombre: o.nombre,
          tipo: o.tipo ?? null,
          num_ranchos: ranCounts.get(o.id) ?? 0,
          certificadora_org_id: certMap.get(o.id) ?? profile!.org_id ?? '',
        }))

        if (!cancelado) setOrgs(result)
      } catch (e: unknown) {
        if (!cancelado) setError(e instanceof Error ? e.message : 'Error al cargar organizaciones')
      } finally {
        if (!cancelado) setLoading(false)
      }
    }

    cargar()
    return () => { cancelado = true }
  }, [profile?.id])

  return { orgs, loading, error }
}
