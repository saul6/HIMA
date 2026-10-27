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
