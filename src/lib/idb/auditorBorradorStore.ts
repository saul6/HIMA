// Borrador local de lo que el auditor escribe en una pregunta (comentarios + observación).
// Se escribe mientras teclea y se borra solo cuando el guardado en el servidor se confirma,
// para que recargar la página no pierda texto. Todas las funciones fallan en silencio.

const DB_NAME = 'aud_borradores'
const STORE_NAME = 'borradores'
const DB_VERSION = 1
const MAX_AGE_MS = 14 * 24 * 60 * 60 * 1000

export interface AuditorBorrador {
  savedAt: number
  valores: Array<[string, string]>
  observacion: string | undefined
}

function openDB(): Promise<IDBDatabase> {
  if (typeof indexedDB === 'undefined') return Promise.reject(new Error('IndexedDB no disponible'))
  return new Promise((resolve, reject) => {
    const req = indexedDB.open(DB_NAME, DB_VERSION)
    req.onupgradeneeded = (e) => {
      const db = (e.target as IDBOpenDBRequest).result
      if (!db.objectStoreNames.contains(STORE_NAME)) db.createObjectStore(STORE_NAME)
    }
    req.onsuccess = (e) => resolve((e.target as IDBOpenDBRequest).result)
    req.onerror = () => reject(req.error)
  })
}

export const claveBorradorAuditor = (auditoriaId: string, preguntaId: string) => `${auditoriaId}:${preguntaId}`

export async function guardarBorradorAuditor(key: string, data: AuditorBorrador): Promise<void> {
  try {
    const db = await openDB()
    await new Promise<void>((resolve) => {
      const tx = db.transaction(STORE_NAME, 'readwrite')
      tx.objectStore(STORE_NAME).put(data, key)
      tx.oncomplete = () => { db.close(); resolve() }
      tx.onerror = () => { db.close(); resolve() }
    })
  } catch { /* sin IndexedDB: no hay borrador, la captura sigue funcionando */ }
}

export async function cargarBorradorAuditor(key: string): Promise<AuditorBorrador | null> {
  try {
    const db = await openDB()
    return await new Promise<AuditorBorrador | null>((resolve) => {
      const tx = db.transaction(STORE_NAME, 'readonly')
      const req = tx.objectStore(STORE_NAME).get(key)
      req.onsuccess = () => {
        db.close()
        const d = (req.result as AuditorBorrador | undefined) ?? null
        resolve(d && Date.now() - d.savedAt < MAX_AGE_MS ? d : null)
      }
      req.onerror = () => { db.close(); resolve(null) }
    })
  } catch { return null }
}

export async function borrarBorradorAuditor(key: string): Promise<void> {
  try {
    const db = await openDB()
    await new Promise<void>((resolve) => {
      const tx = db.transaction(STORE_NAME, 'readwrite')
      tx.objectStore(STORE_NAME).delete(key)
      tx.oncomplete = () => { db.close(); resolve() }
      tx.onerror = () => { db.close(); resolve() }
    })
  } catch { /* nada que borrar */ }
}
