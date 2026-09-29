import { useState, useEffect, useCallback } from 'react'
import { supabase } from '@/lib/supabase'

export interface OrgFirmaConfig {
  obligatoria: boolean
  desde: string | null
}

export function useFirmaObligatoria(userId: string | undefined) {
  const [obligatoria, setObligatoria] = useState(false)
  const [desde, setDesde] = useState<string | null>(null)
  const [tengoFirma, setTengoFirma] = useState(false)
  const [loading, setLoading] = useState(true)

  const cargar = useCallback(async () => {
    if (!userId) {
      setLoading(false)
      return
    }
    setLoading(true)
    try {
      const [configRes, firmaRes] = await Promise.all([
        (supabase as any).rpc('org_firma_config'),
        (supabase as any).rpc('mi_firma'),
      ])
      if (!configRes.error && configRes.data) {
        setObligatoria(configRes.data.obligatoria ?? false)
        setDesde(configRes.data.desde ?? null)
      }
      if (!firmaRes.error && firmaRes.data) {
        setTengoFirma(firmaRes.data.tiene === true)
      }
    } catch {
      // silencioso — defaults sin firma obligatoria
    } finally {
      setLoading(false)
    }
  }, [userId])

  useEffect(() => { cargar() }, [cargar])

  const refrescar = useCallback(async () => {
    try {
      const firmaRes = await (supabase as any).rpc('mi_firma')
      if (!firmaRes.error && firmaRes.data) {
        setTengoFirma(firmaRes.data.tiene === true)
      }
    } catch {}
  }, [])

  return { obligatoria, desde, tengoFirma, loading, refrescar }
}
