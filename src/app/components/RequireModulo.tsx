import { useEffect } from 'react'
import { Outlet, useLocation, useNavigate } from 'react-router'
import { toast } from 'sonner'
import { Lock, ChevronLeft } from 'lucide-react'
import { useModulosContext } from '@/context/ModulosContext'
import { resolverIcono } from '@/app/components/iconos-modulos'
import type { ModuloVisible } from '@/hooks/useMisModulos'

function UpsellPage({ modulo }: { modulo: ModuloVisible }) {
  const navigate = useNavigate()
  const ModIcon = resolverIcono(modulo.icono)
  const mailtoHref = `mailto:contacto@duomindsolutions.com?subject=${encodeURIComponent(`Activar módulo: ${modulo.nombre}`)}`

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
        <span className="text-sm text-foreground" style={{ fontWeight: 600 }}>
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
          <p className="text-base text-foreground" style={{ fontWeight: 600 }}>
            Módulo no disponible
          </p>
          <p className="text-sm text-muted-foreground leading-relaxed max-w-xs">
            <strong style={{ color: 'var(--foreground)' }}>{modulo.nombre}</strong> no está incluido en tu plan actual. Contáctanos para activarlo.
          </p>
        </div>

        <a
          href={mailtoHref}
          className="h-10 px-6 rounded-lg text-sm inline-flex items-center justify-center"
          style={{ backgroundColor: 'var(--primary)', color: 'var(--primary-foreground)', fontWeight: 600 }}
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

  if (!loading && modulos.length > 0) {
    const modulo = modulos.find(m => m.ruta === location.pathname)
    if (modulo && !modulo.desbloqueado) {
      return <UpsellPage modulo={modulo} />
    }
  }

  return <Outlet />
}
