import { useState, useEffect, useRef } from 'react'
import { LogOut, Pencil, Check, X, ChevronRight, Building2, PenLine, Receipt, Banknote } from 'lucide-react'
import { motion } from 'motion/react'
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
import { EncabezadoPantalla } from '@/app/components/EncabezadoPantalla'
import { Boton } from '@/app/components/ui-mady/Boton'
import { Panel } from '@/app/components/ui-mady/Panel'
import { AvisoCargaLenta } from '@/app/components/ui-mady/AvisoCargaLenta'
import { useConfirmar } from '@/app/components/ui-mady/ConfirmarSheet'
import { useEntradaPantalla } from '@/lib/motion'
import { fechaHora } from '@/lib/formato'
import { useMisVouchers } from '@/hooks/useNomina'

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
  const { datos: misVouchers } = useMisVouchers()
  const { confirmar, confirmarElemento } = useConfirmar()

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
  const ent = useEntradaPantalla(true)

  const [updateDisponible, setUpdateDisponible] = useState(isUpdateDisponible())
  useEffect(() => {
    const h = () => setUpdateDisponible(isUpdateDisponible())
    window.addEventListener(UPDATE_DISPONIBLE_EVENT, h)
    return () => window.removeEventListener(UPDATE_DISPONIBLE_EVENT, h)
  }, [])

  const fechaBuild = (() => {
    try {
      return fechaHora(__APP_BUILD__)
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
      const ok = await confirmar({
        titulo: 'Cerrar sesión',
        descripcion: `Tienes ${n} registro${n !== 1 ? 's' : ''} sin subir. Si cierras sesión se perderán. ¿Continuar?`,
        textoConfirmar: 'Cerrar sesión',
        tono: 'peligro',
      })
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
      <EncabezadoPantalla titulo="Perfil" />

      {/* Celular: una columna en el orden de siempre. Escritorio (lg): fila 1 = cuenta | firma (misma altura);
          fila 2 = logo | organización, ajustes y cerrar sesión. Sin estirar lo que queda más corto. */}
      <div className="p-4 flex flex-col gap-4 lg:grid lg:grid-cols-2">
        {/* Tarjeta de usuario */}
        <motion.div {...ent(0)} className="order-1 lg:col-start-1 lg:row-start-1 lg:flex">
        <Panel className="p-6 flex-1">
          <div className="flex items-center gap-4">
            <div className="w-16 h-16 bg-primary rounded-full flex items-center justify-center flex-shrink-0">
              <span className="text-primary-foreground text-xl font-semibold">{iniciales}</span>
            </div>

            <div className="flex-1 min-w-0">
              {editando ? (
                <div className="flex items-center gap-2">
                  <input
                    value={nuevoNombre}
                    onChange={(e) => setNuevoNombre(e.target.value)}
                    autoFocus
                    className="flex-1 h-9 px-3 rounded-lg border border-border-control bg-input-background text-sm
                      focus:outline-none focus:border-primary focus:ring-1 focus:ring-primary"
                  />
                  <button aria-label="Guardar nombre"
                    onClick={handleGuardarNombre}
                    disabled={guardando || !nuevoNombre.trim()}
                    className="p-1.5 rounded-lg bg-primary text-primary-foreground disabled:opacity-50"
                  >
                    <Check className="w-4 h-4" />
                  </button>
                  <button aria-label="Cerrar"
                    onClick={handleCancelarEdicion}
                    className="p-1.5 rounded-lg border border-border text-muted-foreground"
                  >
                    <X className="w-4 h-4" />
                  </button>
                </div>
              ) : (
                <div className="flex items-center gap-2">
                  <h2 className="text-foreground truncate font-semibold">{nombre}</h2>
                  <button aria-label="Editar"
                    onClick={() => {
                      setNuevoNombre(profile?.nombre_completo ?? '')
                      setEditando(true)
                    }}
                    className="p-1 text-muted-foreground transition-colors duration-[var(--motion-fast)] ease-[var(--ease-out)] hover:text-foreground flex-shrink-0"
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
        </Panel>
        </motion.div>
        {/* Mi firma — para todos excepto auditor */}
        {!esAuditor && (
          <motion.div {...ent(1)} className="order-5 lg:col-start-2 lg:row-start-1 lg:flex">
          <Panel className="space-y-3 flex-1">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <div className="w-9 h-9 bg-primary/10 rounded-lg flex items-center justify-center flex-shrink-0">
                  <PenLine className="w-4 h-4 text-primary" />
                </div>
                <div>
                  <p className="text-sm text-foreground font-semibold">Mi firma</p>
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
              <>
                <Skeleton className="h-20 w-full rounded-lg" />
                <AvisoCargaLenta />
              </>
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
                  <Boton onClick={handleGuardarFirma} cargando={guardandoFirma} disabled={firmaInfo.puntos < 15} className="flex-1">
                    Guardar firma
                  </Boton>
                </div>
              </div>
            )}
          </Panel>
          </motion.div>
        )}


        {/* Info de la app */}
        <motion.div {...ent(4)} className="order-6 lg:col-start-1 lg:row-start-2 lg:self-start">
        <Panel>
          <div className="text-center">
            <div className="text-sm mb-1 font-semibold"><MadyLogo theme={resolvedTheme} className="h-80 mx-auto" /></div>
            <div className="text-xs text-muted-foreground mb-1">
              Versión {__APP_VERSION__} · {fechaBuild}
            </div>
            {updateDisponible && (
              <div className="flex items-center justify-center gap-2 mt-1 mb-1">
                <span className="text-xs" style={{ color: 'var(--muted-foreground)' }}>
                  Actualización pendiente
                </span>
                <Boton tamano="sm" onClick={ejecutarActualizacion}>
                  Actualizar ahora
                </Boton>
              </div>
            )}
            <div className="text-xs text-muted-foreground">
              © 2026 M.A.D.Y
            </div>
          </div>
        </Panel>
        </motion.div>
        {/* Columna derecha (fila 2): en celular es `contents` y `order-N` conserva el orden de siempre */}
        <div className="contents lg:flex lg:flex-col lg:gap-4 lg:col-start-2 lg:row-start-2 lg:self-start">
        {/* Mi organización — solo para admin_org */}
        {profile?.rol === 'admin_org' && (
          <motion.div {...ent(1)} className="order-2">
          <button
            onClick={() => navigate('/perfil/mi-organizacion')}
            className="w-full bg-card border border-border rounded-xl p-4 flex items-center gap-3 text-left hover:bg-muted transition-colors"
          >
            <div className="w-10 h-10 bg-primary/10 rounded-lg flex items-center justify-center flex-shrink-0">
              <Building2 className="w-5 h-5 text-primary" />
            </div>
            <div className="flex-1 min-w-0">
              <p className="text-foreground text-sm font-semibold">
                Mi organización
              </p>
              <p className="text-xs text-muted-foreground mt-0.5">
                Gestionar ranchos y configuración
              </p>
            </div>
            <ChevronRight className="w-5 h-5 text-muted-foreground flex-shrink-0" />
          </button>
          </motion.div>
        )}

        {/* Mis vouchers — solo si el usuario está ligado a un trabajador con cortes aprobados */}
        {misVouchers.length > 0 && (
          <motion.div {...ent(2)} className="order-3">
          <button
            onClick={() => navigate('/mis-vouchers')}
            className="w-full bg-card border border-border rounded-xl p-4 flex items-center gap-3 text-left hover:bg-muted transition-colors"
          >
            <div className="w-10 h-10 bg-primary/10 rounded-lg flex items-center justify-center flex-shrink-0">
              <Receipt className="w-5 h-5 text-primary" />
            </div>
            <div className="flex-1 min-w-0">
              <p className="text-foreground text-sm font-semibold">Mis vouchers</p>
              <p className="text-xs text-muted-foreground mt-0.5">Pagos semanales aprobados</p>
            </div>
            <ChevronRight className="w-5 h-5 text-muted-foreground flex-shrink-0" />
          </button>
          </motion.div>
        )}

        {/* Habilitar "Actividades y pagos" por organización — solo super_admin */}
        {profile?.rol === 'super_admin' && (
          <motion.div {...ent(3)} className="order-4">
          <button
            onClick={() => navigate('/admin/nomina-orgs')}
            className="w-full bg-card border border-border rounded-xl p-4 flex items-center gap-3 text-left hover:bg-muted transition-colors"
          >
            <div className="w-10 h-10 bg-primary/10 rounded-lg flex items-center justify-center flex-shrink-0">
              <Banknote className="w-5 h-5 text-primary" />
            </div>
            <div className="flex-1 min-w-0">
              <p className="text-foreground text-sm font-semibold">Actividades y pagos por organización</p>
              <p className="text-xs text-muted-foreground mt-0.5">Habilitar o deshabilitar el módulo</p>
            </div>
            <ChevronRight className="w-5 h-5 text-muted-foreground flex-shrink-0" />
          </button>
          </motion.div>
        )}

        {/* Sincronización */}
        <motion.div {...ent(5)} className="order-7">
        <button
          onClick={() => navigate('/sincronizacion')}
          className="w-full h-12 bg-card border border-border rounded-xl flex items-center gap-3 px-4 hover:bg-muted transition-colors"
          style={{ fontWeight: 500 }}
        >
          <ChevronRight className="w-4 h-4 text-muted-foreground" />
          <span className="text-sm text-foreground flex-1 text-left">Sincronización offline</span>
        </button>

        </motion.div>
        {/* Cerrar sesión */}
        <motion.div {...ent(6)} className="order-8">
        <button
          onClick={handleCerrarSesion}
          className="w-full h-14 bg-card border border-agro-red text-agro-red rounded-xl flex items-center justify-center gap-2 hover:bg-agro-danger-fill transition-colors font-semibold"
        >
          <LogOut className="w-5 h-5" />
          Cerrar sesión
        </button>
        </motion.div>
        </div>
      </div>
      {confirmarElemento}
    </div>
  )
}
