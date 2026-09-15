// PATRÓN INOCUIDAD — hook de datos M6
// M7-M12 replican esta estructura en src/hooks/use<Modulo>.ts:
//   - Filtra por org_id del contexto de auth (nunca del usuario)
//   - Expone { registros, loading, error, refetch }
//   - Join con ranchos para mostrar nombre y código sin queries adicionales

import { useState, useEffect, useCallback } from 'react'
import { supabase } from '@/lib/supabase'
import { useAuthContext } from '@/context/AuthContext'

export interface M6BotiquinConRancho {
  id: string
  rancho_id: string
  rancho_nombre: string
  rancho_codigo: string
  fecha_verificacion: string
  parches_curitas: boolean
  guantes_curacion: boolean
  vendas_tijeras: boolean
  gasas_cinta: boolean
  desinfectante: boolean
  responsable_id: string | null
  firma_verificacion: boolean
  org_id: string
  created_at: string
  creado_por: string | null
  creado_por_nombre: string
  requiere_correccion: boolean
  comentario_correccion: string | null
  marcado_por: string | null
  marcado_en: string | null
}

export function useBotiquin() {
  const { profile } = useAuthContext()
  const [registros, setRegistros] = useState<M6BotiquinConRancho[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  const cargar = useCallback(async () => {
    if (!profile?.org_id) {
      setLoading(false)
      return
    }
    setLoading(true)
    setError(null)
    try {
      const { data, error: err } = await supabase
        .from('m6_botiquin')
        .select('*, ranchos(nombre, codigo), creador:profiles!creado_por(nombre_completo)')
        .eq('org_id', profile.org_id)
        .order('fecha_verificacion', { ascending: false })
        .limit(100)
      if (err) throw err
      setRegistros(
        (data ?? []).map((r: any) => ({
          ...r,
          rancho_nombre: r.ranchos?.nombre ?? '—',
          rancho_codigo: r.ranchos?.codigo ?? '—',
          creado_por: r.creado_por ?? null,
          creado_por_nombre: r.creador?.nombre_completo ?? '—',
          requiere_correccion: r.requiere_correccion ?? false,
          comentario_correccion: r.comentario_correccion ?? null,
          marcado_por: r.marcado_por ?? null,
          marcado_en: r.marcado_en ?? null,
        }))
      )
    } catch (e: unknown) {
      setError(e instanceof Error ? e.message : 'Error al cargar registros')
    } finally {
      setLoading(false)
    }
  }, [profile?.org_id])

  useEffect(() => {
    cargar()
  }, [cargar])

  return { registros, loading, error, refetch: cargar }
}
