// Búsqueda por inicio de palabra, compartida por el buscador de Inicio y el de
// la ventana "Módulos" de Historial. Ignora mayúsculas y acentos. Un resultado
// aparece solo si cada palabra escrita coincide con el inicio de alguna palabra
// del nombre (o del código, si se pasa).
const collator = new Intl.Collator('es', { sensitivity: 'base', numeric: true })
const DIACRITICOS = new RegExp('[\u0300-\u036f]', 'g')
const SEPARADORES = /[\s·\-/'’()[\],.:;]+/

// NFD + quitar marcas conserva los índices 1:1 con el texto original (NFC).
export function normalizarBusqueda(s: string): string {
  return s.normalize('NFD').replace(DIACRITICOS, '').toLowerCase()
}

export function palabrasConsulta(query: string): string[] {
  return normalizarBusqueda(query).split(SEPARADORES).filter(Boolean)
}

interface Palabra { inicio: number; texto: string }

function palabrasDe(texto: string): Palabra[] {
  const norm = normalizarBusqueda(texto)
  const out: Palabra[] = []
  const re = new RegExp(`[^${SEPARADORES.source.slice(1, -2)}]+`, 'g')
  let m: RegExpExecArray | null
  while ((m = re.exec(norm))) out.push({ inicio: m.index, texto: m[0] })
  return out
}

export interface Coincidencia {
  /** Cada palabra escrita coincide con el inicio de alguna palabra. */
  coincide: boolean
  /** La primera palabra escrita coincide con la primera palabra del nombre. */
  alInicio: boolean
  /** Rangos [desde, hasta) del nombre original a resaltar (solo lo escrito). */
  rangos: [number, number][]
}

export function coincidenciaPorInicio(nombre: string, query: string, codigo?: string): Coincidencia {
  const q = palabrasConsulta(query)
  const sin: Coincidencia = { coincide: false, alInicio: false, rangos: [] }
  if (q.length === 0) return { coincide: true, alInicio: true, rangos: [] }
  const palabras = palabrasDe(nombre)
  const codigoNorm = codigo ? normalizarBusqueda(codigo) : ''
  const usadas = new Set<number>()
  const rangos: [number, number][] = []
  let alInicio = false
  for (let i = 0; i < q.length; i++) {
    const w = q[i]
    let idx = palabras.findIndex((p, k) => !usadas.has(k) && p.texto.startsWith(w))
    if (idx === -1) idx = palabras.findIndex((p) => p.texto.startsWith(w))
    if (idx !== -1) {
      usadas.add(idx)
      rangos.push([palabras[idx].inicio, palabras[idx].inicio + w.length])
      if (i === 0 && idx === 0) alInicio = true
    } else if (!(codigoNorm && codigoNorm.startsWith(w))) {
      return sin
    }
  }
  return { coincide: true, alInicio, rangos }
}

/** Filtra y ordena: primero los que empiezan con lo buscado, luego el resto;
 *  dentro de cada grupo, orden alfabético es-MX. Sin búsqueda: orden alfabético. */
export function buscarPorInicio<T>(
  items: T[],
  query: string,
  nombre: (item: T) => string,
  codigo?: (item: T) => string,
): T[] {
  const orden = (a: T, b: T) => collator.compare(nombre(a), nombre(b))
  if (palabrasConsulta(query).length === 0) return [...items].sort(orden)
  const grupo1: T[] = []
  const grupo2: T[] = []
  for (const it of items) {
    const c = coincidenciaPorInicio(nombre(it), query, codigo?.(it))
    if (!c.coincide) continue
    ;(c.alInicio ? grupo1 : grupo2).push(it)
  }
  return [...grupo1.sort(orden), ...grupo2.sort(orden)]
}
