import { useState } from 'react'
import { LogOut, Pencil, Check, X, ChevronRight, Building2 } from 'lucide-react'
import { useNavigate } from 'react-router'
import { toast } from 'sonner'
import { useAuthContext } from '@/context/AuthContext'
import { actualizarNombreCompleto } from '@/lib/queries'
import { MadyLogo } from '@/app/components/MadyLogo'

const ROL_LABEL: Record<string, string> = {
  super_admin: 'Super Admin',
  admin_org: 'Administrador',
  asesor_tecnico: 'Asesor Técnico',
  operario: 'Operario de campo',
}

function inicialesDe(nombre: string): string {
  return nombre
    .split(' ')
    .filter(Boolean)
    .slice(0, 2)
    .map((p) => p[0].toUpperCase())
    .join('')
}

export function Perfil() {
  const navigate = useNavigate()
  const { user, profile, signOut, refreshProfile } = useAuthContext()

  const [editando, setEditando] = useState(false)
  const [nuevoNombre, setNuevoNombre] = useState(profile?.nombre_completo ?? '')
  const [guardando, setGuardando] = useState(false)

  async function handleGuardarNombre() {
    if (!user || !nuevoNombre.trim()) return
    setGuardando(true)
    try {
      await actualizarNombreCompleto(user.id, nuevoNombre.trim())
      await refreshProfile()
      setEditando(false)
      toast.success('Nombre actualizado')
    } catch {
      toast.error('No se pudo actualizar el nombre')
    } finally {
      setGuardando(false)
    }
  }

  function handleCancelarEdicion() {
    setNuevoNombre(profile?.nombre_completo ?? '')
    setEditando(false)
  }

  const nombre = profile?.nombre_completo ?? '—'
  const rol = profile?.rol ? (ROL_LABEL[profile.rol] ?? profile.rol) : '—'
  const iniciales = nombre !== '—' ? inicialesDe(nombre) : '?'

  return (
    <div className="min-h-full pb-safe-nav">
      {/* Header */}
      <header className="bg-card border-b border-border px-4 py-4">
        <h1 className="text-foreground" style={{ fontWeight: 600 }}>
          Perfil y Configuración
        </h1>
      </header>

      <div className="p-4 space-y-4">
        {/* Tarjeta de usuario */}
        <div className="bg-card border border-border rounded-xl p-6">
          <div className="flex items-center gap-4">
            <div className="w-16 h-16 bg-primary rounded-full flex items-center justify-center flex-shrink-0">
              <span className="text-white text-xl" style={{ fontWeight: 600 }}>{iniciales}</span>
            </div>

            <div className="flex-1 min-w-0">
              {editando ? (
                <div className="flex items-center gap-2">
                  <input
                    value={nuevoNombre}
                    onChange={(e) => setNuevoNombre(e.target.value)}
                    autoFocus
                    className="flex-1 h-9 px-3 rounded-lg border border-border bg-input-background text-sm
                      focus:outline-none focus:border-primary focus:ring-1 focus:ring-primary"
                  />
                  <button
                    onClick={handleGuardarNombre}
                    disabled={guardando || !nuevoNombre.trim()}
                    className="p-1.5 rounded-lg bg-primary text-white disabled:opacity-50"
                  >
                    <Check className="w-4 h-4" />
                  </button>
                  <button
                    onClick={handleCancelarEdicion}
                    className="p-1.5 rounded-lg border border-border text-muted-foreground"
                  >
                    <X className="w-4 h-4" />
                  </button>
                </div>
              ) : (
                <div className="flex items-center gap-2">
                  <h2 className="text-foreground truncate" style={{ fontWeight: 600 }}>{nombre}</h2>
                  <button
                    onClick={() => {
                      setNuevoNombre(profile?.nombre_completo ?? '')
                      setEditando(true)
                    }}
                    className="p-1 text-muted-foreground hover:text-foreground flex-shrink-0"
                  >
                    <Pencil className="w-4 h-4" />
                  </button>
                </div>
              )}
              <p className="text-sm text-muted-foreground mt-0.5">{rol}</p>
              {user?.email && (
                <p className="text-xs text-muted-foreground truncate mt-0.5">{user.email}</p>
              )}
            </div>
          </div>
        </div>

        {/* Mi organización — solo para admin_org */}
        {profile?.rol === 'admin_org' && (
          <button
            onClick={() => navigate('/perfil/mi-organizacion')}
            className="w-full bg-card border border-border rounded-xl p-4 flex items-center gap-3 text-left hover:bg-muted transition-colors"
          >
            <div className="w-10 h-10 bg-primary/10 rounded-lg flex items-center justify-center flex-shrink-0">
              <Building2 className="w-5 h-5 text-primary" />
            </div>
            <div className="flex-1 min-w-0">
              <p className="text-foreground text-sm" style={{ fontWeight: 600 }}>
                Mi organización
              </p>
              <p className="text-xs text-muted-foreground mt-0.5">
                Gestionar ranchos y configuración
              </p>
            </div>
            <ChevronRight className="w-5 h-5 text-muted-foreground flex-shrink-0" />
          </button>
        )}

        {/* Info de la app */}
        <div className="bg-card border border-border rounded-xl p-4">
          <div className="text-center">
            <div className="text-sm mb-1" style={{ fontWeight: 600 }}><MadyLogo theme="light" /></div>
            <div className="text-xs text-muted-foreground mb-1">Versión 2.1.0</div>
            <div className="text-xs text-muted-foreground">
              © 2026 DuoMind Solutions
            </div>
          </div>
        </div>

        {/* Cerrar sesión */}
        <button
          onClick={() => signOut()}
          className="w-full h-14 bg-card border border-agro-red text-agro-red rounded-xl flex items-center justify-center gap-2 hover:bg-agro-danger-fill transition-colors"
          style={{ fontWeight: 600 }}
        >
          <LogOut className="w-5 h-5" />
          Cerrar sesión
        </button>
      </div>
    </div>
  )
}
