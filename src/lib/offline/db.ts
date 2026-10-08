// IndexedDB: mady_offline
// stores: cache, lotes, adjuntos, mapeo_ids
//
// Al incrementar DB_VERSION para añadir stores nuevos, el patrón
// if (!db.objectStoreNames.contains(...)) { db.createObjectStore(...) }
// en onupgradeneeded preserva los stores existentes — los lotes y adjuntos
// pendientes de subir nunca se borran en una actualización de versión.

const DB_NAME = 'mady_offline'
const DB_VERSION = 2

type StoreName = 'cache' | 'lotes' | 'adjuntos' | 'mapeo_ids'

function abrirDB(): Promise<IDBDatabase> {
  if (typeof indexedDB === 'undefined') {
    return Promise.reject(new Error('IndexedDB no disponible'))
  }
  return new Promise((resolve, reject) => {
    const req = indexedDB.open(DB_NAME, DB_VERSION)

    req.onupgradeneeded = (e) => {
      const db = (e.target as IDBOpenDBRequest).result

      if (!db.objectStoreNames.contains('cache')) {
        db.createObjectStore('cache')
      }

      if (!db.objectStoreNames.contains('lotes')) {
        const lotes = db.createObjectStore('lotes', { keyPath: 'id' })
        lotes.createIndex('userId', 'userId', { unique: false })
        lotes.createIndex('userIdEstado', ['userId', 'estado'], { unique: false })
        lotes.createIndex('creadoEn', 'creadoEn', { unique: false })
      }

      if (!db.objectStoreNames.contains('adjuntos')) {
        const adj = db.createObjectStore('adjuntos', { keyPath: 'uid' })
        adj.createIndex('loteId', 'loteId', { unique: false })
      }

      if (!db.objectStoreNames.contains('mapeo_ids')) {
        db.createObjectStore('mapeo_ids', { keyPath: 'userId' })
      }
    }

    req.onsuccess = (e) => resolve((e.target as IDBOpenDBRequest).result)
    req.onerror = () => reject(req.error)
  })
}

// ── cache store ──────────────────────────────────────────────────────────────

export async function cacheGet<T>(key: string): Promise<T | undefined> {
  const db = await abrirDB()
  return new Promise((resolve, reject) => {
    const tx = db.transaction('cache', 'readonly')
    const req = tx.objectStore('cache').get(key)
    req.onsuccess = () => { db.close(); resolve(req.result as T | undefined) }
    req.onerror = () => { db.close(); reject(req.error) }
  })
}

export async function cachePut(key: string, value: unknown): Promise<void> {
  const db = await abrirDB()
  return new Promise((resolve, reject) => {
    const tx = db.transaction('cache', 'readwrite')
    tx.objectStore('cache').put(value, key)
    tx.oncomplete = () => { db.close(); resolve() }
    tx.onerror = () => { db.close(); reject(tx.error) }
  })
}

export async function cacheDelete(key: string): Promise<void> {
  const db = await abrirDB()
  return new Promise((resolve, reject) => {
    const tx = db.transaction('cache', 'readwrite')
    tx.objectStore('cache').delete(key)
    tx.oncomplete = () => { db.close(); resolve() }
    tx.onerror = () => { db.close(); reject(tx.error) }
  })
}

export async function cacheClearUser(userId: string): Promise<void> {
  const db = await abrirDB()
  return new Promise((resolve) => {
    const tx = db.transaction('cache', 'readwrite')
    const store = tx.objectStore('cache')
    const req = store.openCursor()
    req.onsuccess = (e) => {
      const cursor = (e.target as IDBRequest<IDBCursorWithValue>).result
      if (!cursor) { db.close(); resolve(); return }
      const v = cursor.value as { userId?: string }
      if (v?.userId === userId) cursor.delete()
      cursor.continue()
    }
    req.onerror = () => { db.close(); resolve() }
  })
}

// ── lotes store ──────────────────────────────────────────────────────────────

export async function lotePut(lote: unknown): Promise<void> {
  const db = await abrirDB()
  return new Promise((resolve, reject) => {
    const tx = db.transaction('lotes', 'readwrite')
    tx.objectStore('lotes').put(lote)
    tx.oncomplete = () => { db.close(); resolve() }
    tx.onerror = () => { db.close(); reject(tx.error) }
  })
}

export async function loteGet<T>(id: string): Promise<T | undefined> {
  const db = await abrirDB()
  return new Promise((resolve, reject) => {
    const tx = db.transaction('lotes', 'readonly')
    const req = tx.objectStore('lotes').get(id)
    req.onsuccess = () => { db.close(); resolve(req.result as T | undefined) }
    req.onerror = () => { db.close(); reject(req.error) }
  })
}

export async function loteDelete(id: string): Promise<void> {
  const db = await abrirDB()
  return new Promise((resolve, reject) => {
    const tx = db.transaction('lotes', 'readwrite')
    tx.objectStore('lotes').delete(id)
    tx.oncomplete = () => { db.close(); resolve() }
    tx.onerror = () => { db.close(); reject(tx.error) }
  })
}

export async function lotesPorUsuario<T>(userId: string): Promise<T[]> {
  const db = await abrirDB()
  return new Promise((resolve, reject) => {
    const tx = db.transaction('lotes', 'readonly')
    const index = tx.objectStore('lotes').index('userId')
    const req = index.getAll(userId)
    req.onsuccess = () => { db.close(); resolve((req.result ?? []) as T[]) }
    req.onerror = () => { db.close(); reject(req.error) }
  })
}

// ── adjuntos store ────────────────────────────────────────────────────────────

export async function adjuntoPut(adj: unknown): Promise<void> {
  const db = await abrirDB()
  return new Promise((resolve, reject) => {
    const tx = db.transaction('adjuntos', 'readwrite')
    tx.objectStore('adjuntos').put(adj)
    tx.oncomplete = () => { db.close(); resolve() }
    tx.onerror = () => { db.close(); reject(tx.error) }
  })
}

export async function adjuntosDelLote<T>(loteId: string): Promise<T[]> {
  const db = await abrirDB()
  return new Promise((resolve, reject) => {
    const tx = db.transaction('adjuntos', 'readonly')
    const index = tx.objectStore('adjuntos').index('loteId')
    const req = index.getAll(loteId)
    req.onsuccess = () => { db.close(); resolve((req.result ?? []) as T[]) }
    req.onerror = () => { db.close(); reject(req.error) }
  })
}

export async function adjuntoDelete(uid: string): Promise<void> {
  const db = await abrirDB()
  return new Promise((resolve, reject) => {
    const tx = db.transaction('adjuntos', 'readwrite')
    tx.objectStore('adjuntos').delete(uid)
    tx.oncomplete = () => { db.close(); resolve() }
    tx.onerror = () => { db.close(); reject(tx.error) }
  })
}

// ── mapeo_ids store — id local → id real, por usuario ────────────────────────

export interface EntradaMapeoId {
  realId: string
  creadoEn: string
}

export async function mapeoGet(userId: string): Promise<Record<string, EntradaMapeoId>> {
  const db = await abrirDB()
  return new Promise((resolve, reject) => {
    const tx = db.transaction('mapeo_ids', 'readonly')
    const req = tx.objectStore('mapeo_ids').get(userId)
    req.onsuccess = () => { db.close(); resolve((req.result as any)?.mapeo ?? {}) }
    req.onerror = () => { db.close(); reject(req.error) }
  })
}

export async function mapeoPut(userId: string, nuevoMapeo: Record<string, string>): Promise<void> {
  const db = await abrirDB()
  const existente = await mapeoGet(userId).catch(() => ({}))
  const ahora = new Date().toISOString()
  const merged: Record<string, EntradaMapeoId> = { ...existente }
  for (const [localId, realId] of Object.entries(nuevoMapeo)) {
    merged[localId] = { realId, creadoEn: ahora }
  }
  return new Promise((resolve, reject) => {
    const tx = db.transaction('mapeo_ids', 'readwrite')
    tx.objectStore('mapeo_ids').put({ userId, mapeo: merged })
    tx.oncomplete = () => { db.close(); resolve() }
    tx.onerror = () => { db.close(); reject(tx.error) }
  })
}

export async function mapeoLimpiar(userId: string): Promise<void> {
  const db = await abrirDB()
  const existente = await mapeoGet(userId).catch(() => ({}))
  const limite = Date.now() - 7 * 24 * 60 * 60 * 1000
  const filtrado: Record<string, EntradaMapeoId> = {}
  for (const [k, v] of Object.entries(existente)) {
    if (new Date(v.creadoEn).getTime() > limite) filtrado[k] = v
  }
  return new Promise((resolve, reject) => {
    const tx = db.transaction('mapeo_ids', 'readwrite')
    tx.objectStore('mapeo_ids').put({ userId, mapeo: filtrado })
    tx.oncomplete = () => { db.close(); resolve() }
    tx.onerror = () => { db.close(); reject(tx.error) }
  })
}
