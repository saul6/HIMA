import { cacheGet, cachePut } from './db'

const MAX_EDAD_DEFAULT  = 30 * 60 * 1000          // 30 min — umbral para refrescar con red
const MAX_EDAD_OFFLINE  = 7 * 24 * 60 * 60 * 1000 // 7 días — máximo sin red

interface EntradaCache<T> {
  datos: T
  guardadoEn: number
  userId: string
  orgId: string
}

export interface ResultadoCache<T> {
  datos: T
  desdeCache: boolean
  guardadoEn: number
}

function esErrorDeRed(err: unknown): boolean {
  if (!navigator.onLine) return true
  if (err instanceof TypeError) return true
  const msg = err instanceof Error ? err.message : String(err)
  return (
    msg.includes('Failed to fetch') ||
    msg.includes('NetworkError') ||
    msg.includes('Network request failed') ||
    msg.includes('ERR_NETWORK') ||
    msg.includes('ERR_INTERNET_DISCONNECTED')
  )
}

export async function leerConCache<T>(
  clave: string,
  userId: string,
  orgId: string,
  fetcher: () => Promise<T>,
  opts: { maxEdad?: number; maxEdadOffline?: number } = {},
): Promise<ResultadoCache<T>> {
  const maxEdad       = opts.maxEdad       ?? MAX_EDAD_DEFAULT
  const maxEdadOffline = opts.maxEdadOffline ?? MAX_EDAD_OFFLINE

  async function leerDesdeCache(aceptarViejo: boolean): Promise<ResultadoCache<T> | null> {
    const entrada = await cacheGet<EntradaCache<T>>(clave)
    if (!entrada || entrada.userId !== userId || entrada.orgId !== orgId) return null
    const edad  = Date.now() - entrada.guardadoEn
    const limite = aceptarViejo ? maxEdadOffline : maxEdad
    if (edad > limite) return null
    return { datos: entrada.datos, desdeCache: true, guardadoEn: entrada.guardadoEn }
  }

  // Con red: intenta la red primero; si falla por red, cae a caché
  if (navigator.onLine) {
    try {
      const datos = await fetcher()
      const entrada: EntradaCache<T> = { datos, guardadoEn: Date.now(), userId, orgId }
      await cachePut(clave, entrada).catch(() => {})
      return { datos, desdeCache: false, guardadoEn: Date.now() }
    } catch (err) {
      if (!esErrorDeRed(err)) throw err  // Error de BD/auth/RLS — propagar
      // Error de red con onLine=true (Supabase caído, señal débil) — cae a caché
      const cached = await leerDesdeCache(true)
      if (cached) return cached
      throw err
    }
  }

  // Sin red: acepta caché aunque sea vieja, hasta maxEdadOffline
  const cached = await leerDesdeCache(true)
  if (cached) return cached
  throw new Error('Sin conexión y sin datos en caché')
}

export async function precargarCache(
  userId: string,
  orgId: string,
  claves: Array<{ clave: string; fetcher: () => Promise<unknown>; maxEdad?: number }>,
): Promise<void> {
  if (!navigator.onLine) return
  await Promise.allSettled(
    claves.map(({ clave, fetcher, maxEdad }) =>
      leerConCache(clave, userId, orgId, fetcher, { maxEdad }),
    ),
  )
}
