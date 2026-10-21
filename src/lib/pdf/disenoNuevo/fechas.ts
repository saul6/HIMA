// Fechas que se muestran en los PDF. Un solo formateador para todos.
//  - `date` (AAAA-MM-DD), o con T00:00:00 sin hora real: se toma el día tal cual, sin convertir zona.
//  - `timestamptz` con hora real: se convierte a America/Mexico_City (mismo criterio que hoyMX()).
// Si una fecha llega como `timestamptz` a medianoche UTC se muestra como fecha (no se adivina un corrimiento).
// Solo cambia lo que se imprime: nombres de archivo, folios y valores internos no pasan por aquí.

const TZ = 'America/Mexico_City'
const SOLO_DIA = /^(\d{4})-(\d{2})-(\d{2})$/
const MEDIANOCHE = /^(\d{4})-(\d{2})-(\d{2})[T ]00:00(?::00(?:\.0+)?)?(?:Z|[+-]00(?::?00)?)?$/
const CON_HORA = /^\d{4}-\d{2}-\d{2}[T ]\d{2}:\d{2}/

const dia = new Intl.DateTimeFormat('en-CA', { timeZone: TZ, year: 'numeric', month: '2-digit', day: '2-digit' })
const horaMX = new Intl.DateTimeFormat('en-GB', { timeZone: TZ, hour: '2-digit', minute: '2-digit', hour12: false })

/** Día de calendario ('AAAA-MM-DD') que corresponde mostrar, o null si el valor no es una fecha. */
export function diaPdf(valor: string | null | undefined): string | null {
  if (!valor) return null
  const v = valor.trim()
  const solo = SOLO_DIA.exec(v)
  if (solo) return v
  const medianoche = MEDIANOCHE.exec(v)
  if (medianoche) return `${medianoche[1]}-${medianoche[2]}-${medianoche[3]}`
  if (CON_HORA.test(v)) {
    const t = new Date(v)
    if (!Number.isNaN(t.getTime())) return dia.format(t)
  }
  return null
}

/**
 * Fecha para imprimir. Sin `opciones`: dd/mm/aaaa. Con `opciones`: `toLocaleDateString('es-MX', opciones)`
 * sobre el día de calendario (mediodía local, para que no se corra de día).
 * Un valor que no es fecha se devuelve como llegó.
 */
export function fechaPdf(valor: string | null | undefined, opciones?: Intl.DateTimeFormatOptions): string {
  const d = diaPdf(valor)
  if (!d) return valor ?? ''
  if (!opciones) {
    const [a, m, dd] = d.split('-')
    return `${dd}/${m}/${a}`
  }
  return new Date(`${d}T12:00:00`).toLocaleDateString('es-MX', opciones)
}

/** dd/mm/aaaa HH:mm en hora de México (para marcas de tiempo con hora real). */
export function fechaHoraPdf(valor: string | null | undefined): string {
  if (!valor) return ''
  if (!CON_HORA.test(valor.trim()) || MEDIANOCHE.test(valor.trim())) return fechaPdf(valor)
  const t = new Date(valor)
  if (Number.isNaN(t.getTime())) return valor
  return `${fechaPdf(valor)} ${horaMX.format(t)}`
}
