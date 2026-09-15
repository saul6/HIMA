import { createContext, useContext, useState, useEffect, type ReactNode } from 'react'
import { supabase } from '@/lib/supabase'
import { useAuth, type UseAuthReturn } from '@/hooks/useAuth'

interface AuthContextValue extends UseAuthReturn {
  signIn: (email: string, password: string, captchaToken?: string) => Promise<{ error: string | null }>
  signOut: () => Promise<void>
  signUp: (
    email: string,
    password: string,
    nombreCompleto: string,
    captchaToken?: string
  ) => Promise<{ error: string | null; requiresConfirmation: boolean }>
  codigoClave: string
}

const AuthContext = createContext<AuthContextValue | null>(null)

export function AuthProvider({ children }: { children: ReactNode }) {
  const authState = useAuth()
  const [codigoClave, setCodigoClave] = useState('FRUS')

  useEffect(() => {
    if (!authState.user) { setCodigoClave('FRUS'); return }
    supabase.rpc('get_mi_codigo_clave').then(({ data }) => {
      if (data) setCodigoClave(data as string)
    })
  }, [authState.user?.id])

  async function signIn(email: string, password: string, captchaToken?: string): Promise<{ error: string | null }> {
    const { error } = await supabase.auth.signInWithPassword({
      email,
      password,
      options: captchaToken ? { captchaToken } : undefined,
    })
    return { error: error?.message ?? null }
  }

  async function signOut(): Promise<void> {
    await supabase.auth.signOut()
  }

  async function signUp(
    email: string,
    password: string,
    nombreCompleto: string,
    captchaToken?: string
  ): Promise<{ error: string | null; requiresConfirmation: boolean }> {
    const { data, error } = await supabase.auth.signUp({
      email,
      password,
      options: {
        data: { nombre_completo: nombreCompleto },
        ...(captchaToken ? { captchaToken } : {}),
      },
    })
    if (error) return { error: error.message, requiresConfirmation: false }
    // Si no hay sesión, Supabase requiere confirmación por correo
    return { error: null, requiresConfirmation: !data.session }
  }

  return (
    <AuthContext.Provider value={{ ...authState, signIn, signOut, signUp, codigoClave }}>
      {children}
    </AuthContext.Provider>
  )
}

export function useAuthContext(): AuthContextValue {
  const ctx = useContext(AuthContext)
  if (!ctx) throw new Error('useAuthContext debe usarse dentro de AuthProvider')
  return ctx
}
