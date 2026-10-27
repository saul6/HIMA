// Borrador local de M13. Tres almacenes: la cabecera pesa bytes, cada incidencia
// es su propio registro y cada foto también. Un cambio escribe solo lo que cambió.

const DB_NAME = 'm13_drafts'
const DB_VERSION = 2
const ST_V1 = 'drafts'
const ST_CAB = 'borradores'
const ST_INC = 'incidencias'
const ST_FOTO = 'fotos'
const MAX_AGE_MS = 30 * 24 * 60 * 60 * 1000
const REINTENTOS = 2

export interface M13FotoRef {
  uid: string
  /** 'original' = aún sin optimizar. */
  estado: 'original' | 'lista'
  /** Veces que se intentó optimizar; >= 1 en 'original' indica que la página murió procesándola. */
  intentos: number
  /** Ya está en el servidor (fila y archivo). */
  subida?: boolean
}

export interface M13Cabecera {
  draftKey: string
  savedAt: number
  ranchoId: string
  fecha: string
  auditorNombre: string
  ordenIncidencias: string[]
  /** Id con el que se crea (o se creó) el reporte en el servidor: un reintento reusa el mismo y no duplica. */
  reporteServidorId?: string
  /** El reporte ya existe en el servidor. */
  reporteInsertado?: boolean
}

export interface M13IncidenciaReg {
  uid: string
  draftKey: string
  descripcion: string
  fotos: M13FotoRef[]
  actualizadaEn: number
  /** La fila de la incidencia ya está en el servidor. */
  insertada?: boolean
}

export interface M13FotoReg {
  uid: string
  draftKey: string
  incidenciaUid: string
  blob: Blob
  nombre: string
  tipo: string
  guardadaEn: number
}

export interface M13BorradorCargado {
  cabecera: M13Cabecera
  incidencias: Array<{ reg: M13IncidenciaReg; fotos: Array<{ ref: M13FotoRef; reg: M13FotoReg | null }> }>
}

// ── Conexión ─────────────────────────────────────────────────────────────────

let dbPromise: Promise<IDBDatabase> | null = null

function migrarV1(db: IDBDatabase, tx: IDBTransaction) {
  if (!db.objectStoreNames.contains(ST_V1)) return
  const viejo = tx.objectStore(ST_V1)
  const cab = tx.objectStore(ST_CAB)
  const inc = tx.objectStore(ST_INC)
  const fot = tx.objectStore(ST_FOTO)
  const req = viejo.openCursor()
  req.onsuccess = () => {
    const cursor = req.result
    if (!cursor) { db.deleteObjectStore(ST_V1); return }
    const draftKey = String(cursor.key)
    const d = cursor.value as {
      savedAt?: number; ranchoId?: string; fecha?: string; auditorNombre?: string
      incidencias?: Array<{ uid: string; descripcion: string; fotos?: Array<{ uid: string; blob: Blob; nombre: string; tipo: string; estado?: 'original' | 'lista'; intentos?: number }> }>
    }
    const ahora = Date.now()
    const incs = d.incidencias ?? []
    cab.put({
      draftKey, savedAt: d.savedAt ?? ahora, ranchoId: d.ranchoId ?? '', fecha: d.fecha ?? '',
      auditorNombre: d.auditorNombre ?? '', ordenIncidencias: incs.map((i) => i.uid),
    } satisfies M13Cabecera, draftKey)
    for (const i of incs) {
      const fotos = i.fotos ?? []
      inc.put({
        uid: i.uid, draftKey, descripcion: i.descripcion ?? '', actualizadaEn: d.savedAt ?? ahora,
        fotos: fotos.map((f) => ({ uid: f.uid, estado: f.estado ?? 'lista', intentos: f.intentos ?? 0 })),
      } satisfies M13IncidenciaReg, i.uid)
      for (const f of fotos) {
        fot.put({
          uid: f.uid, draftKey, incidenciaUid: i.uid, blob: f.blob, nombre: f.nombre,
          tipo: f.tipo, guardadaEn: d.savedAt ?? ahora,
        } satisfies M13FotoReg, f.uid)
      }
    }
    cursor.continue()
  }
}

function abrir(): Promise<IDBDatabase> {
  if (typeof indexedDB === 'undefined') return Promise.reject(new Error('IndexedDB no disponible'))
  if (dbPromise) return dbPromise
  dbPromise = new Promise<IDBDatabase>((resolve, reject) => {
    const req = indexedDB.open(DB_NAME, DB_VERSION)
    req.onupgradeneeded = () => {
      const db = req.result
      const tx = req.transaction!
      if (!db.objectStoreNames.contains(ST_CAB)) db.createObjectStore(ST_CAB)
      if (!db.objectStoreNames.contains(ST_INC)) db.createObjectStore(ST_INC).createIndex('draftKey', 'draftKey')
      if (!db.objectStoreNames.contains(ST_FOTO)) {
        const f = db.createObjectStore(ST_FOTO)
        f.createIndex('draftKey', 'draftKey')
        f.createIndex('incidenciaUid', 'incidenciaUid')
      }
      migrarV1(db, tx)
    }
    req.onsuccess = () => {
      const db = req.result
      db.onclose = () => { dbPromise = null }
      db.onversionchange = () => { db.close(); dbPromise = null }
      resolve(db)
    }
    req.onerror = () => { dbPromise = null; reject(req.error) }
    req.onblocked = () => { /* otra pestaña con la versión vieja: espera a que cierre */ }
  })
  return dbPromise
}

async function tx<T>(
  stores: string[],
  modo: IDBTransactionMode,
  fn: (t: IDBTransaction) => Promise<T> | T,
): Promise<T> {
  const db = await abrir()
  return new Promise<T>((resolve, reject) => {
    const t = db.transaction(stores, modo)
    let resultado: T
    t.oncomplete = () => resolve(resultado)
    t.onerror = () => reject(t.error)
    t.onabort = () => reject(t.error ?? new Error('transacción cancelada'))
    Promise.resolve(fn(t)).then((r) => { resultado = r }, (e) => { try { t.abort() } catch { /* ya terminó */ } reject(e) })
  })
}

function pedir<T>(req: IDBRequest<T>): Promise<T> {
  return new Promise((resolve, reject) => {
    req.onsuccess = () => resolve(req.result)
    req.onerror = () => reject(req.error)
  })
}

// ── Cola de escritura en serie por clave, con reintentos ─────────────────────

export interface FalloBorrador {
  etapa: string
  nombreError: string
  mensaje: string
}

type Oyente = (ok: boolean, fallo?: FalloBorrador) => void
const oyentes = new Set<Oyente>()

export function suscribirEstadoBorrador(fn: Oyente): () => void {
  oyentes.add(fn)
  return () => { oyentes.delete(fn) }
}

const colas = new Map<string, Promise<void>>()
const enVuelo = new Set<Promise<void>>()

function encolar(clave: string, etapa: string, op: () => Promise<unknown>): Promise<void> {
  const previa = colas.get(clave) ?? Promise.resolve()
  const tarea = previa.then(async () => {
    let ultimo: unknown
    for (let intento = 0; intento <= REINTENTOS; intento++) {
      try {
        await op()
        oyentes.forEach((o) => o(true))
        return
      } catch (e) {
        ultimo = e
        if (intento < REINTENTOS) await new Promise((r) => setTimeout(r, 150 * (intento + 1)))
      }
    }
    const err = ultimo as { name?: string; message?: string } | null
    oyentes.forEach((o) => o(false, {
      etapa,
      nombreError: String(err?.name ?? 'Error'),
      mensaje: String(err?.message ?? ultimo).slice(0, 200),
    }))
  })
  colas.set(clave, tarea)
  enVuelo.add(tarea)
  void tarea.finally(() => {
    enVuelo.delete(tarea)
    if (colas.get(clave) === tarea) colas.delete(clave)
  })
  return tarea
}

/** Espera a que terminen todas las escrituras iniciadas hasta ahora (y las que se encadenen). */
export async function vaciarEscrituras(): Promise<void> {
  while (enVuelo.size > 0) await Promise.all([...enVuelo])
}

// ── Escrituras puntuales ─────────────────────────────────────────────────────

function cabeceraVacia(draftKey: string): M13Cabecera {
  return { draftKey, savedAt: Date.now(), ranchoId: '', fecha: '', auditorNombre: '', ordenIncidencias: [] }
}

export function guardarCabecera(draftKey: string, parcial: Partial<Omit<M13Cabecera, 'draftKey'>>): Promise<void> {
  return encolar(`cab:${draftKey}`, 'cabecera', () => tx([ST_CAB], 'readwrite', async (t) => {
    const st = t.objectStore(ST_CAB)
    const actual = (await pedir(st.get(draftKey))) as M13Cabecera | undefined
    st.put({ ...(actual ?? cabeceraVacia(draftKey)), ...parcial, draftKey, savedAt: Date.now() }, draftKey)
  }))
}

/** Une `parcial` a la cabecera sin pisar `reporteServidorId` (u otros) cuando no vienen. */
export const actualizarCabecera = guardarCabecera

export function guardarIncidencia(reg: M13IncidenciaReg): Promise<void> {
  return encolar(`inc:${reg.uid}`, 'incidencia', () => tx([ST_CAB, ST_INC], 'readwrite', async (t) => {
    t.objectStore(ST_INC).put({ ...reg, actualizadaEn: Date.now() }, reg.uid)
    const cab = t.objectStore(ST_CAB)
    const actual = (await pedir(cab.get(reg.draftKey))) as M13Cabecera | undefined
    cab.put(
      { ...(actual ?? cabeceraVacia(reg.draftKey)), savedAt: Date.now() },
      reg.draftKey,
    )
  }))
}

export function borrarIncidencia(uid: string): Promise<void> {
  return encolar(`inc:${uid}`, 'quitar_incidencia', () => tx([ST_INC, ST_FOTO], 'readwrite', async (t) => {
    t.objectStore(ST_INC).delete(uid)
    const fotos = t.objectStore(ST_FOTO)
    const claves = (await pedir(fotos.index('incidenciaUid').getAllKeys(uid))) as IDBValidKey[]
    claves.forEach((k) => fotos.delete(k))
  }))
}

export function guardarFoto(reg: M13FotoReg): Promise<void> {
  return encolar(`foto:${reg.uid}`, 'foto', () => tx([ST_FOTO], 'readwrite', (t) => {
    t.objectStore(ST_FOTO).put({ ...reg, guardadaEn: Date.now() }, reg.uid)
  }))
}

export function borrarFoto(uid: string): Promise<void> {
  return encolar(`foto:${uid}`, 'quitar_foto', () => tx([ST_FOTO], 'readwrite', (t) => {
    t.objectStore(ST_FOTO).delete(uid)
  }))
}

// ── Lectura / borrado ────────────────────────────────────────────────────────

async function porBorrador<T>(t: IDBTransaction, store: string, draftKey: string): Promise<T[]> {
  return (await pedir(t.objectStore(store).index('draftKey').getAll(draftKey))) as T[]
}

async function clavesPorBorrador(t: IDBTransaction, store: string, draftKey: string): Promise<IDBValidKey[]> {
  return (await pedir(t.objectStore(store).index('draftKey').getAllKeys(draftKey))) as IDBValidKey[]
}

/** `conFotos: false` omite los archivos (solo cabecera y registros): para saber si hay borrador sin cargar blobs. */
export async function cargarBorrador(draftKey: string, conFotos = true): Promise<M13BorradorCargado | null> {
  return tx([ST_CAB, ST_INC, ST_FOTO], 'readonly', async (t) => {
    const cab = (await pedir(t.objectStore(ST_CAB).get(draftKey))) as M13Cabecera | undefined
    const incs = await porBorrador<M13IncidenciaReg>(t, ST_INC, draftKey)
    if (!cab && incs.length === 0) return null
    const fotos = new Map<string, M13FotoReg>(
      conFotos ? (await porBorrador<M13FotoReg>(t, ST_FOTO, draftKey)).map((f) => [f.uid, f] as const) : [],
    )
    const porUid = new Map(incs.map((i) => [i.uid, i]))
    const orden = cab?.ordenIncidencias ?? []
    // Incidencias con registro pero fuera del orden (la página murió entre escrituras): se conservan al final.
    const uids = [...orden, ...incs.filter((i) => !orden.includes(i.uid)).map((i) => i.uid)]
    return {
      cabecera: cab ?? cabeceraVacia(draftKey),
      incidencias: uids.map((uid) => {
        const reg = porUid.get(uid) ?? { uid, draftKey, descripcion: '', fotos: [], actualizadaEn: 0 }
        return { reg, fotos: reg.fotos.map((ref) => ({ ref, reg: fotos.get(ref.uid) ?? null })) }
      }),
    }
  })
}

/** Borra cabecera, incidencias y fotos del borrador. */
export async function borrarBorrador(draftKey: string): Promise<void> {
  await vaciarEscrituras()
  await tx([ST_CAB, ST_INC, ST_FOTO], 'readwrite', async (t) => {
    t.objectStore(ST_CAB).delete(draftKey)
    for (const store of [ST_INC, ST_FOTO]) {
      const st = t.objectStore(store)
      for (const k of await clavesPorBorrador(t, store, draftKey)) st.delete(k)
    }
  })
}

/** Borra borradores con más de 30 días y registros huérfanos (sin cabecera viva). */
export async function limpiarBorradoresViejos(): Promise<void> {
  await tx([ST_CAB, ST_INC, ST_FOTO], 'readwrite', async (t) => {
    const cabs = t.objectStore(ST_CAB)
    const [vals, keys] = await Promise.all([pedir(cabs.getAll()) as Promise<M13Cabecera[]>, pedir(cabs.getAllKeys())])
    const ahora = Date.now()
    const vivos = new Set<string>()
    vals.forEach((c, i) => {
      if (ahora - c.savedAt > MAX_AGE_MS) cabs.delete(keys[i])
      else vivos.add(String(keys[i]))
    })
    for (const store of [ST_INC, ST_FOTO]) {
      const st = t.objectStore(store)
      const cursor = st.index('draftKey').openKeyCursor()
      await new Promise<void>((resolve, reject) => {
        cursor.onsuccess = () => {
          const c = cursor.result
          if (!c) { resolve(); return }
          if (!vivos.has(String(c.key))) st.delete(c.primaryKey)
          c.continue()
        }
        cursor.onerror = () => reject(cursor.error)
      })
    }
  })
}

/** Pide almacenamiento persistente (silencioso). */
export function pedirAlmacenamientoPersistente(): void {
  try { void navigator.storage?.persist?.().catch(() => {}) } catch { /* ignore */ }
}
