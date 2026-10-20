// Formato de números y fechas SOLO para mostrar en pantalla. Nunca usar para valores que se
// guardan, claves, filtros, orden, nombres de archivo, PDF ni Excel.

const MESES_CORTOS = ['ene', 'feb', 'mar', 'abr', 'may', 'jun', 'jul', 'ago', 'sep', 'oct', 'nov', 'dic']
const MESES_LARGOS = [
  'enero', 'febrero', 'marzo', 'abril', 'mayo', 'junio',
  'julio', 'agosto', 'septiembre', 'octubre', 'noviembre', 'diciembre',
]

const ZONA = 'America/Mexico_City'

const NF_PCT = new Intl.NumberFormat('es-MX', { minimumFractionDigits: 0, maximumFractionDigits: 1 })
const NF_NUM = new Intl.NumberFormat('es-MX')
const DTF_PARTES = new Intl.DateTimeFormat('en-CA', {
  timeZone: ZONA,
  year: 'numeric',
  month: '2-digit',
  day: '2-digit',
  hour: '2-digit',
  minute: '2-digit',
  hourCycle: 'h23',
})

interface Partes { anio: number; mes: number; dia: number; hora: number; minuto: number }

/** 'YYYY-MM-DD' (o 'YYYY-MM') se lee como fecha local, sin pasar por UTC (que la corre un día).
 * Un Date o un timestamp con hora se lee en America/Mexico_City, igual que hoyMX(). */
function partes(d: string | Date): Partes | null {
  if (typeof d === 'string') {
    const m = /^(\d{4})-(\d{2})(?:-(\d{2}))?$/.exec(d.trim())
    if (m) return { anio: +m[1], mes: +m[2], dia: m[3] ? +m[3] : 1, hora: 0, minuto: 0 }
  }
  const fecha = d instanceof Date ? d : new Date(d)
  if (Number.isNaN(fecha.getTime())) return null
  const p: Record<string, string> = {}
  for (const x of DTF_PARTES.formatToParts(fecha)) p[x.type] = x.value
  return { anio: +p.year, mes: +p.month, dia: +p.day, hora: +p.hour, minuto: +p.minute }
}

/** 0 → "0 %", 12 → "12 %", 12.5 → "12.5 %". Recibe el porcentaje ya calculado (12.5, no 0.125). */
export function formatoPct(n: number | string | null | undefined): string {
  const v = n == null || n === '' ? NaN : Number(n)
  if (!Number.isFinite(v)) return '—'
  return `${NF_PCT.format(v)} %`
}

/** 1234 → "1,234". */
export function formatoNumero(n: number | string | null | undefined): string {
  const v = n == null || n === '' ? NaN : Number(n)
  if (!Number.isFinite(v)) return '—'
  return NF_NUM.format(v)
}

/** "17 oct 2026". */
export function fechaCorta(d: string | Date | null | undefined): string {
  if (d == null || d === '') return '—'
  const p = partes(d)
  return p ? `${p.dia} ${MESES_CORTOS[p.mes - 1]} ${p.anio}` : '—'
}

/** "17 oct 2026, 14:30". */
export function fechaHora(d: string | Date | null | undefined): string {
  if (d == null || d === '') return '—'
  const p = partes(d)
  if (!p) return '—'
  const hh = String(p.hora).padStart(2, '0')
  const mm = String(p.minuto).padStart(2, '0')
  return `${p.dia} ${MESES_CORTOS[p.mes - 1]} ${p.anio}, ${hh}:${mm}`
}

/** "octubre 2026". */
export function mesAnio(d: string | Date | null | undefined): string {
  if (d == null || d === '') return '—'
  const p = partes(d)
  return p ? `${MESES_LARGOS[p.mes - 1]} ${p.anio}` : '—'
}
