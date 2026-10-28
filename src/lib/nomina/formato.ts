// Formato y fechas de M81 — solo para mostrar. El front no calcula importes.

const cache = new Map<string, Intl.NumberFormat>()

export function formatoMoneda(monto: number | null | undefined, moneda = 'MXN'): string {
  let nf = cache.get(moneda)
  if (!nf) {
    nf = new Intl.NumberFormat('es-MX', { style: 'currency', currency: moneda })
    cache.set(moneda, nf)
  }
  return nf.format(Number(monto ?? 0))
}

/** Redondeo a 2 decimales de lo capturado (monto) o 4 (cantidad). */
export const r2 = (n: number) => parseFloat(n.toFixed(2))
export const r4 = (n: number) => parseFloat(n.toFixed(4))

/**
 * Lector estricto de números tecleados. NaN si está vacío o es ambiguo/inválido.
 * - Con coma y punto: las comas son miles en grupos de 3 ('1,250.50' sí; '1,25.50' no).
 * - Solo comas: miles si son grupos de 3 ('1,250' = 1250); si es una coma con `decimalesComa`
 *   dígitos es decimal ('1250,5' = 1250.5); otro caso, inválido.
 * - Sin negativos, notación científica ni más de `maxDecimales`.
 */
function leerEstricto(texto: string, maxDecimales: number, decimalesComa: number[]): number {
  const t = texto.replace(/[\s$]/g, '')
  if (t === '' || /[^0-9.,]/.test(t)) return NaN
  let normal: string
  if (t.includes(',') && t.includes('.')) {
    if (!/^\d{1,3}(,\d{3})+\.\d+$/.test(t)) return NaN
    normal = t.replace(/,/g, '')
  } else if (t.includes(',')) {
    if (/^\d{1,3}(,\d{3})+$/.test(t)) normal = t.replace(/,/g, '')
    else {
      const m = /^(\d+),(\d+)$/.exec(t)
      if (!m || !decimalesComa.includes(m[2].length)) return NaN
      normal = `${m[1]}.${m[2]}`
    }
  } else {
    if (!/^(\d+(\.\d+)?|\.\d+)$/.test(t)) return NaN
    normal = t
  }
  const dec = normal.split('.')[1]
  if (dec && dec.length > maxDecimales) return NaN
  return Number(normal)
}

/** Monto en pesos: hasta 2 decimales. */
export const leerMonto = (texto: string) => leerEstricto(texto, 2, [1, 2])
/** Cantidad de una actividad: hasta 4 decimales. */
export const leerCantidad = (texto: string) => leerEstricto(texto, 4, [1, 2, 4])

function aUtc(f: string): Date {
  const [y, m, d] = f.split('-').map(Number)
  return new Date(Date.UTC(y, m - 1, d))
}
function aIso(d: Date): string {
  return d.toISOString().slice(0, 10)
}
export function sumarDias(f: string, n: number): string {
  const d = aUtc(f)
  d.setUTCDate(d.getUTCDate() + n)
  return aIso(d)
}
/** Lunes de la semana de la fecha (semana lunes–domingo). */
export function lunesDe(f: string): string {
  const dow = (aUtc(f).getUTCDay() + 6) % 7
  return sumarDias(f, -dow)
}
export const domingoDe = (f: string) => sumarDias(lunesDe(f), 6)
export function diasSemana(lunes: string): string[] {
  return Array.from({ length: 7 }, (_, i) => sumarDias(lunes, i))
}
export const maxFecha = (a: string, b: string) => (a > b ? a : b)
export const minFecha = (a: string, b: string) => (a < b ? a : b)

const DIAS = ['dom', 'lun', 'mar', 'mié', 'jue', 'vie', 'sáb']
const MESES = ['ene', 'feb', 'mar', 'abr', 'may', 'jun', 'jul', 'ago', 'sep', 'oct', 'nov', 'dic']
export function fechaCorta(f: string): string {
  const d = aUtc(f)
  return `${d.getUTCDate()} ${MESES[d.getUTCMonth()]}`
}
export function diaCorto(f: string): string {
  return DIAS[aUtc(f).getUTCDay()]
}
export function rangoSemana(lunes: string): string {
  const fin = sumarDias(lunes, 6)
  return `${fechaCorta(lunes)} – ${fechaCorta(fin)} ${aUtc(fin).getUTCFullYear()}`
}

export const METODOS_PAGO: { valor: string; etiqueta: string }[] = [
  { valor: 'efectivo', etiqueta: 'Efectivo' },
  { valor: 'transferencia', etiqueta: 'Transferencia' },
  { valor: 'deposito', etiqueta: 'Depósito' },
  { valor: 'cheque', etiqueta: 'Cheque' },
  { valor: 'vale', etiqueta: 'Vale' },
  { valor: 'otro', etiqueta: 'Otro' },
]
export const etiquetaMetodo = (m: string | null | undefined) =>
  METODOS_PAGO.find(x => x.valor === m)?.etiqueta ?? (m ?? '')


export const ETIQUETA_OTRO_MOVIMIENTO: Record<string, string> = {
  prestamo_otorgado: 'Préstamo otorgado',
  abono_prestamo: 'Abono a préstamo',
  prestamo_cancelado: 'Préstamo cancelado',
  ahorro_devuelto: 'Ahorro devuelto',
}

export function etiquetaOrigenPrestamo(origen: string | null | undefined): string {
  return origen === 'exceso_anticipo' ? 'Excedente de anticipo' : 'Préstamo'
}

/** Estado de pago en texto corto (sin depender de componentes de pantalla). */
export function estadoPagoTexto(p: { estado_pago?: string } | undefined): string {
  switch (p?.estado_pago) {
    case 'pagado': return 'Pagado'
    case 'parcial': return 'Pago parcial'
    case 'sin_importe': return 'Sin importe'
    default: return 'Pendiente de pago'
  }
}
