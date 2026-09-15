import { useState, useEffect } from 'react'
import { supabase } from '@/lib/supabase'
import type { CatalogoProducto } from '@/types/database.types'

interface UseCatalogoProductosResult {
  productos: CatalogoProducto[]
  loading: boolean
  error: string | null
}

export function useCatalogoProductos(): UseCatalogoProductosResult {
  const [productos, setProductos] = useState<CatalogoProducto[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    supabase
      .from('catalogo_productos')
      .select('*')
      .eq('activo', true)
      .order('nombre_comercial')
      .then(({ data, error: err }) => {
        console.log('[catalogo] data:', data, '| error:', err)
        if (err) setError(err.message)
        else setProductos(data ?? [])
      })
      .finally(() => setLoading(false))
  }, [])

  return { productos, loading, error }
}
