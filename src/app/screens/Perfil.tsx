import { useState, useEffect, useRef } from 'react'
import { LogOut, Pencil, Check, X, ChevronRight, Building2, PenLine, Loader2 } from 'lucide-react'
import { useNavigate } from 'react-router'
import { toast } from 'sonner'
import { useAuthContext } from '@/context/AuthContext'
import { useTheme } from '@/context/ThemeContext'
import { actualizarNombreCompleto } from '@/lib/queries'
import { MadyLogo } from '@/app/components/MadyLogo'
import { supabase } from '@/lib/supabase'
import { FirmaPad, type FirmaPadRef } from '@/app/components/FirmaPad'
import { FirmaSvg } from '@/app/components/FirmaSvg'
import { Skeleton } from '@/app/components/ui/skeleton'
import { contarPendientes } from '@/lib/offline/outbox'
import { isUpdateDisponible, UPDATE_DISPONIBLE_EVENT, ejecutarActualizacion } from '@/lib/offline/actualizacionSegura'

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
  const { resolvedTheme } = useTheme()

  const [editando, setEditando] = useState(false)
  const [nuevoNombre, setNuevoNombre] = useState(profile?.nombre_completo ?? '')
  const [guardando, setGuardando] = useState(false)

  // ── Estado firma ────────────────────────────────────────────────────────────
  const [loadingFirma, setLoadingFirma] = useState(true)
  const [tieneFirma, setTieneFirma] = useState(false)
  const [firmaExistente, setFirmaExistente] = useState<{
    trazos?: Array<Array<{ x: number; y: number }>>
    firma_png?: string
  } | null>(null)
  const [cambiandoFirma, setCambiandoFirma] = useState(false)
  const [firmaInfo, setFirmaInfo] = useState({ vacia: true, puntos: 0 })
  const [guardandoFirma, setGuardandoFirma] = useState(false)
  const firmaPadRef = useRef<FirmaPadRef>(null)

  const esAuditor = profile?.rol === 'auditor'

  const [updateDisponible, setUpdateDisponible] = useState(isUpdateDisponible())
  useEffect(() => {
    const h = () => setUpdateDisponible(isUpdateDisponible())
    window.addEventListener(UPDATE_DISPONIBLE_EVENT, h)
    return () => window.removeEventListener(UPDATE_DISPONIBLE_EVENT, h)
  }, [])

  const fechaBuild = (() => {
    try {
      return new Date(__APP_BUILD__).toLocaleString('es-MX', {
        timeZone: 'America/Mexico_City',
        day: 'numeric',
        month: 'short',
        year: 'numeric',
        hour: '2-digit',
        minute: '2-digit',
      })
    } catch {
      return __APP_BUILD__
    }
  })()

  useEffect(() => {
    let cancelled = false
    ;(supabase as any).rpc('mi_firma').then(({ data }: any) => {
      if (cancelled) return
      if (data && data.tiene) {
        setTieneFirma(true)
        setFirmaExistente(data)
      } else {
        setTieneFirma(false)
        setFirmaExistente(null)
      }
      setLoadingFirma(false)
    }).catch(() => {
      if (!cancelled) setLoadingFirma(false)
    })
    return () => { cancelled = true }
  }, [])

  async function handleGuardarFirma() {
    if (!firmaPadRef.current) return
    const { png, trazos } = firmaPadRef.current.exportar()
    setGuardandoFirma(true)
    try {
      const eventId = crypto.randomUUID()
      const { error } = await (supabase as any).rpc('mi_firma_guardar', {
        p_firma_png: png,
        p_trazos: trazos,
        p_event_id: eventId,
      })
      if (error) throw error
      setTieneFirma(true)
      setFirmaExistente({ trazos, firma_png: png })
      setCambiandoFirma(false)
      firmaPadRef.current?.limpiar()
      setFirmaInfo({ vacia: true, puntos: 0 })
      toast.success('Firma guardada correctamente')
    } catch (err: any) {
      console.error('[Perfil] guardar firma error:', err)
      toast.error('No se pudo guardar la firma')
    } finally {
      setGuardandoFirma(false)
    }
  }

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

  async function handleCerrarSesion() {
    const n = user?.id ? await contarPendientes(user.id).catch(() => 0) : 0
    if (n > 0) {
      const ok = window.confirm(
        `Tienes ${n} registro${n !== 1 ? 's' : ''} sin subir. Si cierras sesión se perderán. ¿Continuar?`
      )
      if (!ok) return
    }
    try {
      await signOut()
    } finally {
      window.location.replace('/login')
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

        {/* Mi firma — para todos excepto auditor */}
        {!esAuditor && (
          <div className="bg-card border border-border rounded-xl p-4 space-y-3">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <div className="w-9 h-9 bg-primary/10 rounded-lg flex items-center justify-center flex-shrink-0">
                  <PenLine className="w-4 h-4 text-primary" />
                </div>
                <div>
                  <p className="text-sm text-foreground" style={{ fontWeight: 600 }}>Mi firma</p>
                  <p className="text-xs text-muted-foreground">Para firma digital de registros</p>
                </div>
              </div>
              {tieneFirma && !cambiandoFirma && (
                <button
                  onClick={() => setCambiandoFirma(true)}
                  className="text-xs px-3 py-1.5 rounded-lg border transition-colors"
                  style={{ borderColor: 'var(--border)', color: 'var(--muted-foreground)' }}
                >
                  Cambiar firma
                </button>
              )}
            </div>

            {loadingFirma ? (
              <Skeleton className="h-20 w-full rounded-lg" />
            ) : tieneFirma && !cambiandoFirma ? (
              /* Mostrar firma existente */
              <div
                className="rounded-lg border p-2"
                style={{ borderColor: 'var(--border)', backgroundColor: 'var(--input-background)' }}
              >
                {firmaExistente?.trazos && firmaExistente.trazos.length > 0 ? (
                  <FirmaSvg
                    trazos={firmaExistente.trazos}
                    className="h-20 w-auto mx-auto"
                    style={{ color: 'var(--foreground)' }}
                  />
                ) : firmaExistente?.firma_png ? (
                  <img
                    src={firmaExistente.firma_png}
                    alt="Mi firma"
                    className="h-20 w-auto mx-auto"
                    style={{ backgroundColor: '#fff' }}
                  />
                ) : (
                  <p className="text-xs text-center py-4" style={{ color: 'var(--muted-foreground)' }}>
                    Firma guardada
                  </p>
                )}
              </div>
            ) : (
              /* Pad para registrar / cambiar firma */
              <div className="space-y-2">
                {cambiandoFirma && (
                  <p className="text-xs" style={{ color: 'var(--muted-foreground)' }}>
                    Al guardar, tu firma anterior sera reemplazada.
                  </p>
                )}
                <FirmaPad
                  ref={firmaPadRef}
                  onChange={(info) => setFirmaInfo(info)}
                />
                <div className="flex gap-2">
                  {cambiandoFirma && (
                    <button
                      onClick={() => {
                        setCambiandoFirma(false)
                        firmaPadRef.current?.limpiar()
                        setFirmaInfo({ vacia: true, puntos: 0 })
                      }}
                      className="flex-1 h-10 rounded-lg text-sm border transition-colors"
                      style={{ borderColor: 'var(--border)', color: 'var(--muted-foreground)' }}
                    >
                      Cancelar
                    </button>
                  )}
                  <button
                    onClick={handleGuardarFirma}
                    disabled={guardandoFirma || firmaInfo.puntos < 15}
                    className="flex-1 h-10 rounded-lg text-sm font-semibold flex items-center justify-center gap-2 disabled:opacity-40 transition-colors"
                    style={{ backgroundColor: 'var(--primary)', color: 'white' }}
                  >
                    {guardandoFirma ? (
                      <Loader2 className="w-4 h-4 animate-spin" />
                    ) : 'Guardar firma'}
                  </button>
                </div>
              </div>
            )}
          </div>
        )}

        {/* Info de la app */}
        <div className="bg-card border border-border rounded-xl p-4">
          <div className="text-center">
            <div className="text-sm mb-1" style={{ fontWeight: 600 }}><MadyLogo theme={resolvedTheme} className="h-80 mx-auto" /></div>
            <div className="text-xs text-muted-foreground mb-1">
              Versión {__APP_VERSION__} · {fechaBuild}
            </div>
            {updateDisponible && (
              <div className="flex items-center justify-center gap-2 mt-1 mb-1">
                <span className="text-xs" style={{ color: 'var(--muted-foreground)' }}>
                  Actualización pendiente
                </span>
                <button
                  onClick={ejecutarActualizacion}
                  className="text-xs px-2.5 py-1 rounded-lg"
                  style={{ backgroundColor: 'var(--primary)', color: 'var(--primary-foreground)', fontWeight: 600 }}
                >
                  Actualizar ahora
                </button>
              </div>
            )}
            <div className="text-xs text-muted-foreground">
              © 2026 M.A.D.Y
            </div>
          </div>
        </div>

        {/* Sincronización */}
        <button
          onClick={() => navigate('/sincronizacion')}
          className="w-full h-12 bg-card border border-border rounded-xl flex items-center gap-3 px-4 hover:bg-muted transition-colors"
          style={{ fontWeight: 500 }}
        >
          <ChevronRight className="w-4 h-4 text-muted-foreground" />
          <span className="text-sm text-foreground flex-1 text-left">Sincronización offline</span>
        </button>

        {/* Cerrar sesión */}
        <button
          onClick={handleCerrarSesion}
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
