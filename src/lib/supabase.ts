import { createClient } from '@supabase/supabase-js'
import type { Database } from '@/types/database.types'

const supabaseUrl = import.meta.env.VITE_SUPABASE_URL
const supabaseAnonKey = import.meta.env.VITE_SUPABASE_ANON_KEY

// Capturado sincrónicamente antes de que createClient procese y limpie el hash de la URL
export const initialAuthParams = (() => {
  if (typeof window === 'undefined') return new URLSearchParams()
  const hash = window.location.hash
  const params = new URLSearchParams(hash.startsWith('#') ? hash.slice(1) : hash)
  // Supabase puede devolver el error en el query string en vez del hash
  new URLSearchParams(window.location.search).forEach((v, k) => {
    if (!params.has(k)) params.set(k, v)
  })
  return params
})()

// Enlace de recuperación/invitación ya usado o vencido
export const enlaceVencidoInicial =
  initialAuthParams.get('error_code') === 'otp_expired' ||
  initialAuthParams.get('error') === 'access_denied'

export const supabase = createClient<Database>(supabaseUrl, supabaseAnonKey, {
  auth: {
    storageKey: 'agrocampo-auth',
    autoRefreshToken: true,
    persistSession: true,
    detectSessionInUrl: true,
  },
  realtime: {
    params: {
      eventsPerSecond: -1,
    },
  },
  global: {
    headers: {
      'X-Client-Info': 'agrocampo-web',
    },
  },
})
