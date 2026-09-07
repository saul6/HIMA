const DB_NAME = 'm13_drafts'
const STORE_NAME = 'drafts'
const DB_VERSION = 1
const MAX_AGE_MS = 30 * 24 * 60 * 60 * 1000

export interface M13FotoDraft {
  uid: string
  blob: Blob
  nombre: string
  tipo: string
}

export interface M13IncidenciaDraft {
  uid: string
  descripcion: string
  fotos: M13FotoDraft[]
}

export interface M13DraftData {
  savedAt: number
  ranchoId: string
  fecha: string
  auditorNombre: string
  incidencias: M13IncidenciaDraft[]
}

function openDB(): Promise<IDBDatabase> {
  if (typeof indexedDB === 'undefined') return Promise.reject(new Error('IndexedDB no disponible'))
  return new Promise((resolve, reject) => {
    const req = indexedDB.open(DB_NAME, DB_VERSION)
    req.onupgradeneeded = (e) => {
      const db = (e.target as IDBOpenDBRequest).result
      if (!db.objectStoreNames.contains(STORE_NAME)) {
        db.createObjectStore(STORE_NAME)
      }
    }
    req.onsuccess = (e) => resolve((e.target as IDBOpenDBRequest).result)
    req.onerror = () => reject(req.error)
  })
}

export async function guardarBorrador(key: string, data: M13DraftData): Promise<void> {
  const db = await openDB()
  return new Promise((resolve, reject) => {
    const tx = db.transaction(STORE_NAME, 'readwrite')
    tx.objectStore(STORE_NAME).put(data, key)
    tx.oncomplete = () => { db.close(); resolve() }
    tx.onerror = () => { db.close(); reject(tx.error) }
  })
}

export async function cargarBorrador(key: string): Promise<M13DraftData | null> {
  const db = await openDB()
  return new Promise((resolve, reject) => {
    const tx = db.transaction(STORE_NAME, 'readonly')
    const req = tx.objectStore(STORE_NAME).get(key)
    req.onsuccess = () => { db.close(); resolve((req.result as M13DraftData) ?? null) }
    req.onerror = () => { db.close(); reject(req.error) }
  })
}

export async function borrarBorrador(key: string): Promise<void> {
  const db = await openDB()
  return new Promise((resolve, reject) => {
    const tx = db.transaction(STORE_NAME, 'readwrite')
    tx.objectStore(STORE_NAME).delete(key)
    tx.oncomplete = () => { db.close(); resolve() }
    tx.onerror = () => { db.close(); reject(tx.error) }
  })
}

export async function limpiarBorradoresViejos(): Promise<void> {
  const db = await openDB()
  return new Promise((resolve) => {
    const tx = db.transaction(STORE_NAME, 'readwrite')
    const store = tx.objectStore(STORE_NAME)
    const req = store.openCursor()
    const ahora = Date.now()
    req.onsuccess = (e) => {
      const cursor = (e.target as IDBRequest<IDBCursorWithValue>).result
      if (!cursor) { db.close(); resolve(); return }
      const data = cursor.value as M13DraftData
      if (ahora - data.savedAt > MAX_AGE_MS) cursor.delete()
      cursor.continue()
    }
    req.onerror = () => { db.close(); resolve() }
  })
}
