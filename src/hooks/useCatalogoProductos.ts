import { useState, useEffect } from 'react'
import { supabase } from '@/lib/supabase'
import { useAuthContext } from '@/context/AuthContext'
import { leerConCache } from '@/lib/offline/cacheLectura'
import type { CatalogoProducto } from '@/types/database.types'

interface UseCatalogoProductosResult {
  productos: CatalogoProducto[]
  loading: boolean
  error: string | null
}

// Catálogo global (sin org_id): el caché es por usuario, igual que el resto de lecturas offline.
export async function fetchCatalogoProductos(): Promise<CatalogoProducto[]> {
  const { data, error } = await supabase
    .from('catalogo_productos')
    .select('*')
    .eq('activo', true)
    .order('nombre_comercial')
  if (error) throw error
  return data ?? []
}

export function useCatalogoProductos(): UseCatalogoProductosResult {
  const { user, profile } = useAuthContext()
  const userId = user?.id ?? null
  const orgId = profile?.org_id ?? null
  const [productos, setProductos] = useState<CatalogoProducto[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    if (!userId || !orgId) { setLoading(false); return }
    leerConCache('catalogo_productos', userId, orgId, fetchCatalogoProductos)
      .then((r) => setProductos(r.datos))
      .catch((err: { message?: string }) => setError(err?.message ?? 'Error al cargar el catálogo'))
      .finally(() => setLoading(false))
  }, [userId, orgId])

  return { productos, loading, error }
}
