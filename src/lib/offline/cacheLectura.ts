import { cacheGet, cachePut } from './db'

const MAX_EDAD_DEFAULT = 30 * 60 * 1000 // 30 min

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

export async function leerConCache<T>(
  clave: string,
  userId: string,
  orgId: string,
  fetcher: () => Promise<T>,
  opts: { maxEdad?: number } = {},
): Promise<ResultadoCache<T>> {
  const maxEdad = opts.maxEdad ?? MAX_EDAD_DEFAULT

  // Intenta la red primero si hay conexión
  if (navigator.onLine) {
    try {
      const datos = await fetcher()
      const entrada: EntradaCache<T> = { datos, guardadoEn: Date.now(), userId, orgId }
      await cachePut(clave, entrada).catch(() => {})
      return { datos, desdeCache: false, guardadoEn: Date.now() }
    } catch (err) {
      // Red falló — cae al cache
    }
  }

  // Intentar desde caché
  const entrada = await cacheGet<EntradaCache<T>>(clave)
  if (entrada && entrada.userId === userId && entrada.orgId === orgId) {
    const edad = Date.now() - entrada.guardadoEn
    if (edad <= maxEdad) {
      return { datos: entrada.datos, desdeCache: true, guardadoEn: entrada.guardadoEn }
    }
  }

  // Sin caché válida y sin red — lanza para que el caller maneje
  throw new Error('Sin conexión y sin datos en caché')
}

// Precarga varios recursos en paralelo (llamar al iniciar sesión con red)
export async function precargarCache(
  userId: string,
  orgId: string,
  claves: Array<{ clave: string; fetcher: () => Promise<unknown>; maxEdad?: number }>,
): Promise<void> {
  if (!navigator.onLine) return
  await Promise.allSettled(
    claves.map(({ clave, fetcher, maxEdad }) =>
      leerConCache(clave, userId, orgId, fetcher, { maxEdad })
    ),
  )
}
