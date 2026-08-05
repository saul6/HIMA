import { useState, useEffect } from 'react'
import { type User } from '@supabase/supabase-js'
import { supabase } from '@/lib/supabase'
import type { Profile, Productor } from '@/types/database.types'
import { devLog } from '@/lib/log'

export interface AuthState {
  user: User | null
  profile: Profile | null
  productor: Productor | null
  asesorProfile: Profile | null
  responsableProfile: Profile | null
  loading: boolean
  error: string | null
}

export type UseAuthReturn = AuthState & {
  refreshProfile: () => Promise<void>
}

const SIN_SESION: Omit<AuthState, 'loading'> = {
  user: null,
  profile: null,
  productor: null,
  asesorProfile: null,
  responsableProfile: null,
  error: null,
}

// Garantiza que NUNCA lanza — cualquier error interno queda atrapado y devuelve
// un resultado parcial en lugar de propagarse al callback de onAuthStateChange.
async function cargarDatosPerfil(
  userId: string
): Promise<Omit<AuthState, 'user' | 'loading'>> {
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

export function useAuth(): UseAuthReturn {
  const [state, setState] = useState<AuthState>({
    ...SIN_SESION,
    loading: true,
  })

  useEffect(() => {
    devLog('[auth] useAuth montado → iniciando estrategia mixta')

    let authResolved = false
    let subscriptionRef: { unsubscribe: () => void } | null = null

    const timeout = setTimeout(async () => {
      if (authResolved) return
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
          setState({ user: initialSession.user, ...datosPerfil, loading: false })
        } catch (err) {
          console.error('[auth] error cargando perfil desde sesión inicial:', err)
          setState({
            user: initialSession.user,
            profile: null,
            productor: null,
            asesorProfile: null,
            responsableProfile: null,
            loading: false,
            error: err instanceof Error ? err.message : 'Error cargando perfil',
          })
        } finally {
          authResolved = true
          clearTimeout(timeout)
        }
      }

      // Suscribirse a cambios futuros (login nuevo y logout)
      const { data: { subscription } } = supabase.auth.onAuthStateChange(async (event, session) => {
        devLog('[auth] onAuthStateChange event:', event, '| session:', session ? 'presente' : 'null')

        try {
          if (event === 'SIGNED_IN' && !initialSession) {
            // Solo para logins nuevos — la sesión de recarga ya fue manejada por getSession
            const datosPerfil = await cargarDatosPerfil(session!.user.id)
            setState({ user: session!.user, ...datosPerfil, loading: false })
          }
          if (event === 'SIGNED_OUT') {
            setState({ ...SIN_SESION, loading: false })
          }
        } catch (err) {
          console.error('[auth] error crítico en onAuthStateChange (salvavidas):', err)
          setState({
            user: session?.user ?? null,
            profile: null,
            productor: null,
            asesorProfile: null,
            responsableProfile: null,
            loading: false,
            error: err instanceof Error ? err.message : 'Error inesperado de autenticación',
          })
        } finally {
          authResolved = true
          clearTimeout(timeout)
        }
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

  return { ...state, refreshProfile }
}
