import { createClient, navigatorLock, processLock } from '@supabase/supabase-js'
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
  const url = typeof input === 'string' ? input : input instanceof URL ? input.href : (input as Request).url
  // Ninguna petición espera para siempre: si la red no responde sale como error normal.
  // Una petición colgada dentro de la renovación del token dejaba tomado el candado de sesión.
  const ms = url.includes('/storage/v1/') ? 120_000 : (url.includes('/rest/v1/') || url.includes('/auth/v1/')) ? 30_000 : 0
  if (!ms) return fetch(input, init)
  const limite = AbortSignal.timeout(ms)
  const externo = init?.signal ?? (input instanceof Request ? input.signal : undefined)
  const signal = externo ? combinarSenales(externo, limite) : limite
  return fetch(input, { ...init, signal }).catch((e) => {
    if (limite.aborted && !externo?.aborted) throw new Error('TIMEOUT_RED: La conexión tardó demasiado')
    throw e
  })
}

function combinarSenales(a: AbortSignal, b: AbortSignal): AbortSignal {
  if (typeof AbortSignal.any === 'function') return AbortSignal.any([a, b])
  const c = new AbortController()
  const abortar = () => c.abort()
  if (a.aborted || b.aborted) c.abort()
  else { a.addEventListener('abort', abortar, { once: true }); b.addEventListener('abort', abortar, { once: true }) }
  return c.signal
}

// Candado de sesión que nunca espera para siempre. Se usa navigatorLock (coordina pestañas) con
// espera finita; si no se obtiene (candado huérfano de una pestaña congelada), se sigue con el
// candado de proceso (processLock: solo esta pestaña) y se registra el evento. No se usa processLock
// directo para conservar la coordinación de renovación de token entre pestañas abiertas.
const ESPERA_CANDADO_MS = 10_000
const candadoSesion = async <R,>(nombre: string, espera: number, fn: () => Promise<R>): Promise<R> => {
  if (typeof navigator === 'undefined' || !navigator.locks) return processLock(nombre, espera, fn)
  try {
    return await navigatorLock(nombre, espera > 0 ? Math.min(espera, ESPERA_CANDADO_MS) : ESPERA_CANDADO_MS, fn)
  } catch (e) {
    if (!(e as { isAcquireTimeout?: boolean })?.isAcquireTimeout) throw e
    void import('@/lib/diagnostico').then((m) => m.registrarEvento('AUTH', 'lock_timeout', { nombre, espera }))
    return processLock(nombre, ESPERA_CANDADO_MS, fn)
  }
}

// Apps que se suspenden en segundo plano: pausar/reanudar la renovación automática del token.
if (typeof document !== 'undefined') {
  document.addEventListener('visibilitychange', () => {
    // eslint-disable-next-line @typescript-eslint/no-use-before-define
    if (document.visibilityState === 'visible') void supabase.auth.startAutoRefresh()
    else void supabase.auth.stopAutoRefresh()
  })
}

export const supabase = createClient<Database>(supabaseUrl, supabaseAnonKey, {
  auth: {
    storageKey: 'agrocampo-auth',
    autoRefreshToken: true,
    persistSession: true,
    detectSessionInUrl: true,
    lock: candadoSesion,
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
