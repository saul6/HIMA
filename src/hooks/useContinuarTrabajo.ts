import { useState, useEffect } from 'react'
import { supabase } from '@/lib/supabase'
import { useAuthContext } from '@/context/AuthContext'

interface LastWorkspace {
  route: string
  entity_type: string
  entity_id: string
  anchor: string | null
  titulo: string
  updated_at: string
}

export interface GuardarWorkspaceParams {
  profileId: string
  route: string
  entity_type: string
  entity_id: string
  anchor?: string | null
  titulo: string
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any
const tbl = () => (supabase as any).from('aud_last_workspace')

export async function guardarLastWorkspace(params: GuardarWorkspaceParams): Promise<void> {
  try {
    const { error } = await tbl().upsert(
      {
        profile_id: params.profileId,
        route: params.route,
        entity_type: params.entity_type,
        entity_id: params.entity_id,
        anchor: params.anchor ?? null,
        titulo: params.titulo,
      },
      { onConflict: 'profile_id' }
    )
    if (error) console.error('[guardarLastWorkspace]', error)
  } catch (e) {
    console.error('[guardarLastWorkspace]', e)
  }
}

export function useLastWorkspace() {
  const { profile } = useAuthContext()
  const [workspace, setWorkspace] = useState<LastWorkspace | null | undefined>(undefined)

  useEffect(() => {
    if (!profile?.id) {
      setWorkspace(null)
      return
    }
    tbl()
      .select('route, entity_type, entity_id, anchor, titulo, updated_at')
      .maybeSingle()
      .then(({ data, error }: { data: LastWorkspace | null; error: unknown }) => {
        if (error) {
          console.error('[useLastWorkspace]', error)
          setWorkspace(null)
          return
        }
        setWorkspace(data)
      })
  }, [profile?.id])

  return { workspace }
}
