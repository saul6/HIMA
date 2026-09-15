import { useEffect } from 'react'
import { Outlet, useLocation, useNavigate } from 'react-router'
import { toast } from 'sonner'
import { useModulosContext } from '@/context/ModulosContext'

export function RequireModulo() {
  const { modulos, loading } = useModulosContext()
  const location = useLocation()
  const navigate = useNavigate()

  useEffect(() => {
    if (loading || modulos.length === 0) return
    if (!modulos.some(m => m.ruta === location.pathname)) {
      navigate('/', { replace: true })
      toast.warning('Módulo no disponible en tu plan')
    }
  }, [loading, location.pathname, modulos, navigate])

  return <Outlet />
}
