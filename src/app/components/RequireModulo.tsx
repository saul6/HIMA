import { useEffect } from 'react'
import { Outlet, useLocation, useNavigate } from 'react-router'
import { toast } from 'sonner'
import { Lock, ChevronLeft, WifiOff } from 'lucide-react'
import { useModulosContext } from '@/context/ModulosContext'
import { useConexion } from '@/hooks/useConexion'
import { resolverIcono } from '@/app/components/iconos-modulos'
import type { ModuloVisible } from '@/hooks/useMisModulos'
import { MODULOS_OFFLINE, type CodigoOffline } from '@/lib/offline/modulosOffline'
import { Boton } from '@/app/components/ui-mady/Boton'
import { ErrorCargaModulos } from '@/app/components/ErrorCargaModulos'

function UpsellPage({ modulo }: { modulo: ModuloVisible }) {
  const navigate = useNavigate()
  const ModIcon = resolverIcono(modulo.icono)
  const mailtoHref = `mailto:ventas@mady.com.mx?subject=${encodeURIComponent(`Activar módulo: ${modulo.nombre}`)}`

  return (
    <div className="min-h-full pb-safe-nav flex flex-col">
      <header className="px-4 py-3 border-b border-border flex items-center gap-2">
        <button
          onClick={() => navigate('/', { replace: true })}
          className="w-8 h-8 rounded-lg flex items-center justify-center transition-colors hover:bg-muted"
          aria-label="Volver al inicio"
        >
          <ChevronLeft className="w-5 h-5 text-muted-foreground" />
        </button>
        <span className="text-sm text-foreground font-semibold">
          {modulo.nombre}
        </span>
      </header>

      <div className="flex-1 flex flex-col items-center justify-center px-8 py-12 text-center gap-5">
        <div className="relative">
          <div
            className="w-16 h-16 rounded-2xl flex items-center justify-center"
            style={{ backgroundColor: 'var(--muted)' }}
          >
            <ModIcon className="w-8 h-8" style={{ color: 'var(--muted-foreground)', opacity: 0.5 }} />
          </div>
          <div
            className="absolute -bottom-1.5 -right-1.5 w-6 h-6 rounded-full flex items-center justify-center border-2"
            style={{ backgroundColor: 'var(--card)', borderColor: 'var(--border)' }}
          >
            <Lock className="w-3 h-3" style={{ color: 'var(--muted-foreground)' }} />
          </div>
        </div>

        <div className="space-y-1.5">
          <p className="text-base text-foreground font-semibold">
            Módulo no disponible
          </p>
          <p className="text-sm text-muted-foreground leading-relaxed max-w-xs">
            <strong style={{ color: 'var(--foreground)' }}>{modulo.nombre}</strong> no está incluido en tu plan actual. Contáctanos para activarlo.
          </p>
        </div>

        <a
          href={mailtoHref}
          className="h-10 px-6 rounded-lg text-sm inline-flex items-center justify-center font-semibold"
          style={{ backgroundColor: 'var(--primary)', color: 'var(--primary-foreground)' }}
        >
          Contactar para activarlo
        </a>

        <button
          onClick={() => navigate('/', { replace: true })}
          className="text-xs text-muted-foreground hover:text-foreground transition-colors"
        >
          Volver al inicio
        </button>
      </div>
    </div>
  )
}

function RequiereConexionPage({ modulo }: { modulo: ModuloVisible }) {
  const navigate = useNavigate()
  const ModIcon = resolverIcono(modulo.icono)

  return (
    <div className="min-h-full pb-safe-nav flex flex-col">
      <header className="px-4 py-3 border-b border-border flex items-center gap-2">
        <button
          onClick={() => navigate('/', { replace: true })}
          className="w-8 h-8 rounded-lg flex items-center justify-center transition-colors hover:bg-muted"
          aria-label="Volver al inicio"
        >
          <ChevronLeft className="w-5 h-5 text-muted-foreground" />
        </button>
        <span className="text-sm text-foreground font-semibold">
          {modulo.nombre}
        </span>
      </header>

      <div className="flex-1 flex flex-col items-center justify-center px-8 py-12 text-center gap-5">
        <div className="relative">
          <div
            className="w-16 h-16 rounded-2xl flex items-center justify-center"
            style={{ backgroundColor: 'var(--muted)' }}
          >
            <ModIcon className="w-8 h-8" style={{ color: 'var(--muted-foreground)', opacity: 0.5 }} />
          </div>
          <div
            className="absolute -bottom-1.5 -right-1.5 w-6 h-6 rounded-full flex items-center justify-center border-2"
            style={{ backgroundColor: 'var(--card)', borderColor: 'var(--border)' }}
          >
            <WifiOff className="w-3 h-3" style={{ color: 'var(--muted-foreground)' }} />
          </div>
        </div>

        <div className="space-y-1.5">
          <p className="text-base text-foreground font-semibold">
            Requiere conexión
          </p>
          <p className="text-sm text-muted-foreground leading-relaxed max-w-xs">
            <strong style={{ color: 'var(--foreground)' }}>{modulo.nombre}</strong> no está disponible sin conexión a internet.
          </p>
        </div>

        <Boton onClick={() => navigate('/', { replace: true })}>
          Volver al inicio
        </Boton>
      </div>
    </div>
  )
}

export function RequireModulo() {
  const { modulos, loading, cargado, error, refetch } = useModulosContext()
  const { online } = useConexion()
  const location = useLocation()
  const navigate = useNavigate()

  useEffect(() => {
    if (loading || !cargado || error) return
    if (!modulos.some(m => m.ruta === location.pathname)) {
      navigate('/', { replace: true })
      toast.warning('Módulo no disponible en tu plan')
    }
  }, [loading, cargado, error, location.pathname, modulos, navigate])

  if (!loading && cargado && error && modulos.length === 0) {
    return <ErrorCargaModulos onReintentar={() => { void refetch() }} />
  }

  if (!loading && modulos.length > 0) {
    const modulo = modulos.find(m => m.ruta === location.pathname)
    if (modulo && !modulo.desbloqueado) {
      return <UpsellPage modulo={modulo} />
    }
    // Sin red: módulos no piloto muestran aviso en lugar de fallar
    if (!online && modulo && !MODULOS_OFFLINE.includes(modulo.codigo as CodigoOffline)) {
      return <RequiereConexionPage modulo={modulo} />
    }
  }

  return <Outlet />
}
