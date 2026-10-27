import { useState, useEffect, useRef } from 'react'
import { type User, type Session } from '@supabase/supabase-js'
import { supabase, initialAuthParams, marcarSesionCerrada } from '@/lib/supabase'
import type { Profile, Productor } from '@/types/database.types'
import { devLog } from '@/lib/log'
import { registrarEvento } from '@/lib/diagnostico'
import { cacheGet, cachePut, cacheClearUser } from '@/lib/offline/db'

export interface AuthState {
  user: User | null
  profile: Profile | null
  productor: Productor | null
  asesorProfile: Profile | null
  responsableProfile: Profile | null
  // Interruptor de emergencia por organización (organizaciones.offline_habilitado). Default true.
  offlineHabilitado: boolean
  loading: boolean
  error: string | null
  isRecovery: boolean
}

export type UseAuthReturn = AuthState & {
  refreshProfile: () => Promise<void>
  clearRecovery: () => void
}

// Capturado al cargar el módulo, antes de que Supabase procese el hash
const IS_INITIAL_RECOVERY = initialAuthParams.get('type') === 'recovery'

const SIN_SESION: Omit<AuthState, 'loading'> = {
  user: null,
  profile: null,
  productor: null,
  asesorProfile: null,
  responsableProfile: null,
  offlineHabilitado: true,
  error: null,
  isRecovery: false,
}

const CACHE_PERFIL_TTL = 24 * 60 * 60 * 1000

async function guardarPerfilCache(userId: string, datos: Omit<AuthState, 'user' | 'loading' | 'isRecovery'>): Promise<void> {
  await cachePut(`perfil:${userId}`, { datos, guardadoEn: Date.now(), userId, orgId: datos.profile?.org_id ?? '' }).catch(() => {})
}

async function cargarPerfilCache(userId: string): Promise<Omit<AuthState, 'user' | 'loading' | 'isRecovery'> | null> {
  try {
    const entrada = await cacheGet<{ datos: Omit<AuthState, 'user' | 'loading' | 'isRecovery'>; guardadoEn: number; userId: string }>(`perfil:${userId}`)
    if (!entrada || entrada.userId !== userId) return null
    if (Date.now() - entrada.guardadoEn > CACHE_PERFIL_TTL) return null
    return { ...entrada.datos, offlineHabilitado: entrada.datos.offlineHabilitado !== false }
  } catch { return null }
}

// Garantiza que NUNCA lanza — cualquier error interno queda atrapado y devuelve
// un resultado parcial en lugar de propagarse al callback de onAuthStateChange.
async function cargarDatosPerfilBase(
  userId: string
): Promise<Omit<AuthState, 'user' | 'loading' | 'isRecovery' | 'offlineHabilitado'>> {
  try {
    devLog('[auth] cargarDatosPerfil → profiles query para', userId)
    const { data: profile, error: profileError } = await supabase
      .from('profiles')
      .select('*')
      .eq('id', userId)
      .single()

    devLog('[auth] profiles result:', { profile, error: profileError?.message })

    if (profileError || !profile) {
      return {
        profile: null,
        productor: null,
        asesorProfile: null,
        responsableProfile: null,
        error: profileError?.message ?? 'Perfil no encontrado',
      }
    }

    if (profile.rol !== 'operario' && profile.rol !== 'admin_org') {
      devLog('[auth] rol sin productor asociado:', profile.rol)
      return { profile, productor: null, asesorProfile: null, responsableProfile: null, error: null }
    }

    devLog('[auth] rol operario → buscando productor')
    const { data: productor, error: productorError } = await supabase
      .from('productores')
      .select('*')
      .eq('profile_id', userId)
      .single()

    devLog('[auth] productores result:', { productor, error: productorError?.message })

    if (!productor) {
      return { profile, productor: null, asesorProfile: null, responsableProfile: null, error: null }
    }

    // Carga asesor y responsable en paralelo — errores individuales no bloquean
    let asesorProfile: Profile | null = null
    let responsableProfile: Profile | null = null

    try {
      devLog('[auth] cargando asesor y responsable en paralelo')
      await Promise.all([
        (async () => {
          if (!productor.asesor_id) return
          const { data, error } = await supabase
            .from('profiles')
            .select('*')
            .eq('id', productor.asesor_id)
            .single()
          devLog('[auth] asesorProfile result:', { data, error: error?.message })
          asesorProfile = data
        })(),
        (async () => {
          if (!productor.responsable_inocuidad_id) return
          const { data, error } = await supabase
            .from('profiles')
            .select('*')
            .eq('id', productor.responsable_inocuidad_id)
            .single()
          devLog('[auth] responsableProfile result:', { data, error: error?.message })
          responsableProfile = data
        })(),
      ])
    } catch (innerErr) {
      // No bloquear si falla la carga de asesor/responsable — son datos secundarios
      devLog('[auth] error al cargar asesor/responsable (no bloquea):', innerErr instanceof Error ? innerErr.message : innerErr)
    }

    return { profile, productor, asesorProfile, responsableProfile, error: null }
  } catch (err) {
    // Captura cualquier error inesperado (red caída, timeout, etc.)
    console.error('[auth] cargarDatosPerfil error inesperado:', err)
    return {
      profile: null,
      productor: null,
      asesorProfile: null,
      responsableProfile: null,
      error: err instanceof Error ? err.message : 'Error cargando perfil',
    }
  }
}

// Carga el perfil y, con él, el interruptor de emergencia de la organización.
// Si la lectura del interruptor falla, conserva el último valor cacheado (o true).
async function cargarDatosPerfil(userId: string): Promise<Omit<AuthState, 'user' | 'loading' | 'isRecovery'>>{
  const base = await cargarDatosPerfilBase(userId)
  let offlineHabilitado = true
  const orgId = base.profile?.org_id
  if (orgId) {
    try {
      const { data, error } = await (supabase as any)
        .from('organizaciones')
        .select('offline_habilitado')
        .eq('id', orgId)
        .single()
      if (!error && data && typeof data.offline_habilitado === 'boolean') {
        offlineHabilitado = data.offline_habilitado
      } else {
        const previo = await cargarPerfilCache(userId)
        offlineHabilitado = previo?.offlineHabilitado ?? true
      }
    } catch {
      const previo = await cargarPerfilCache(userId)
      offlineHabilitado = previo?.offlineHabilitado ?? true
    }
  }
  return { ...base, offlineHabilitado }
}

export function useAuth(): UseAuthReturn {
  const [state, setState] = useState<AuthState>({
    ...SIN_SESION,
    loading: true,
  })
  const estadoRef = useRef(state)
  estadoRef.current = state

  useEffect(() => {
    devLog('[auth] useAuth montado → iniciando estrategia mixta')

    let authResolved = false
    let subscriptionRef: { unsubscribe: () => void } | null = null

    const timeout = setTimeout(async () => {
      if (authResolved) return
      // Sin red la sesión guardada puede tardar en restaurarse: no cerrarla ni mandar a /login
      if (!navigator.onLine) return
      devLog('[auth] timeout de 5 s alcanzado — sesión posiblemente corrupta, limpiando')
      await supabase.auth.signOut()
      setState({ ...SIN_SESION, loading: false })
    }, 5000)

    async function init() {
      // Verificar sesión existente primero (cubre el caso de recarga de página)
      devLog('[auth] getSession → buscando sesión en storage')
      const { data: { session: initialSession } } = await supabase.auth.getSession()
      devLog('[auth] getSession resultado:', initialSession ? 'sesión presente' : 'sin sesión')

      if (initialSession) {
        try {
          const datosPerfil = await cargarDatosPerfil(initialSession.user.id)
          // Guardar en caché cuando la carga fue exitosa
          if (datosPerfil.profile) {
            guardarPerfilCache(initialSession.user.id, datosPerfil)
          }
          // Si no hay perfil (posiblemente sin red), intentar desde caché
          const datosFinales = (!datosPerfil.profile && datosPerfil.error)
            ? (await cargarPerfilCache(initialSession.user.id)) ?? datosPerfil
            : datosPerfil
          setState({ user: initialSession.user, ...datosFinales, loading: false, isRecovery: IS_INITIAL_RECOVERY })
        } catch (err) {
          console.error('[auth] error cargando perfil desde sesión inicial:', err)
          const cacheado = await cargarPerfilCache(initialSession.user.id)
          setState({
            user: initialSession.user,
            ...(cacheado ?? {
              profile: null,
              productor: null,
              asesorProfile: null,
              responsableProfile: null,
              offlineHabilitado: true,
              error: err instanceof Error ? err.message : 'Error cargando perfil',
            }),
            loading: false,
            isRecovery: IS_INITIAL_RECOVERY,
          })
        } finally {
          authResolved = true
          clearTimeout(timeout)
        }
      }

      // Suscribirse a cambios futuros (login nuevo y logout)
      // El callback NO puede esperar consultas de Supabase: auth-js lo ejecuta con su candado
      // interno tomado y esas consultas piden la sesión (mismo candado) → bloqueo circular.
      // Solo se difiere el trabajo con setTimeout para que corra fuera del candado.
      const manejarEvento = async (event: string, session: Session | null) => {
        try {
          if (event === 'PASSWORD_RECOVERY') {
            if (session) {
              const datosPerfil = await cargarDatosPerfil(session.user.id)
              setState({ user: session.user, ...datosPerfil, loading: false, isRecovery: true })
            }
          }
          if (event === 'SIGNED_IN') marcarSesionCerrada(false)
          if (event === 'SIGNED_IN' && session && session.access_token !== initialSession?.access_token) {
            const actual = estadoRef.current
            const mismoUsuario = actual.user?.id === session.user.id
            if (mismoUsuario && actual.profile) {
              // Renovación de sesión (p. ej. al volver a la pestaña): no recargar el perfil
              setState(prev => ({ ...prev, user: session.user, loading: false }))
            } else {
              registrarEvento('AUTH', 'evento_auth', { event, mismo_usuario: mismoUsuario, recarga_perfil: true }, actual.profile?.org_id)
              const datosPerfil = await cargarDatosPerfil(session.user.id)
              if (datosPerfil.profile) {
                guardarPerfilCache(session.user.id, datosPerfil)
                setState({ user: session.user, ...datosPerfil, loading: false, isRecovery: false })
              } else {
                // Falla de red: conservar el perfil previo o el cacheado
                const cacheado = mismoUsuario && actual.profile ? null : await cargarPerfilCache(session.user.id)
                setState(prev => ({
                  ...prev,
                  ...(cacheado ?? (mismoUsuario ? {} : datosPerfil)),
                  user: session.user,
                  loading: false,
                  isRecovery: false,
                }))
              }
            }
          }
          if (event === 'SIGNED_OUT') {
            // Limpiar caché del usuario anterior
            const idPrevio = estadoRef.current.user?.id ?? initialSession?.user.id
            if (idPrevio) {
              cacheClearUser(idPrevio).catch(() => {})
            }
            setState({ ...SIN_SESION, loading: false })
          }
        } catch (err) {
          console.error('[auth] error crítico en onAuthStateChange (salvavidas):', err)
          setState(prev => ({
            ...prev,
            user: session?.user ?? prev.user,
            loading: false,
            error: err instanceof Error ? err.message : 'Error inesperado de autenticación',
            isRecovery: event === 'PASSWORD_RECOVERY',
          }))
        } finally {
          authResolved = true
          clearTimeout(timeout)
        }
      }

      const { data: { subscription } } = supabase.auth.onAuthStateChange((event, session) => {
        devLog('[auth] onAuthStateChange event:', event, '| session:', session ? 'presente' : 'null')
        setTimeout(() => { void manejarEvento(event, session) }, 0)
      })

      subscriptionRef = subscription

      // Sin sesión inicial — resuelve loading aquí mismo
      if (!initialSession) {
        setState({ ...SIN_SESION, loading: false })
        authResolved = true
        clearTimeout(timeout)
      }
    }

    init()

    return () => {
      clearTimeout(timeout)
      subscriptionRef?.unsubscribe()
      devLog('[auth] useAuth desmontado → limpieza completa')
    }
  }, [])

  async function refreshProfile() {
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) return
    const datos = await cargarDatosPerfil(user.id)
    setState(prev => ({ ...prev, ...datos }))
  }

  function clearRecovery() {
    setState(prev => ({ ...prev, isRecovery: false }))
  }

  return { ...state, refreshProfile, clearRecovery }
}
