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

// Tras cerrar sesión, las pantallas que siguen montadas lanzaban decenas de consultas con la llave
// anónima (todas respondían 401). Mientras este flag esté activo, las peticiones a datos/almacenamiento
// se cortan en el cliente sin salir a la red. Se limpia al iniciar sesión de nuevo (o al recargar).
let sesionCerrada = false
export function marcarSesionCerrada(valor: boolean) { sesionCerrada = valor }

const fetchConCorte: typeof fetch = (input, init) => {
  if (sesionCerrada) {
    const url = typeof input === 'string' ? input : input instanceof URL ? input.href : (input as Request).url
    if (url.includes('/rest/v1/') || url.includes('/storage/v1/')) {
      return Promise.resolve(new Response(
        JSON.stringify({ code: 'SESION_CERRADA', message: 'Sesión cerrada' }),
        { status: 401, headers: { 'Content-Type': 'application/json' } },
      ))
    }
  }
  return fetch(input, init)
}

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
    fetch: fetchConCorte,
    headers: {
      'X-Client-Info': 'agrocampo-web',
    },
  },
})
