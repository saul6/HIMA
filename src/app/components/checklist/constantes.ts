const MESES = ['enero', 'febrero', 'marzo', 'abril', 'mayo', 'junio', 'julio', 'agosto', 'septiembre', 'octubre', 'noviembre', 'diciembre']

/** 'YYYY-MM-DD' (o ISO) → "18 de octubre". Sin pasar por Date para no correr el día por zona horaria. */
export function fechaLarga(iso: string | null | undefined): string {
  if (!iso) return ''
  const [y, m, d] = iso.slice(0, 10).split('-').map(Number)
  if (!y || !m || !d) return ''
  return `${d} de ${MESES[m - 1]}`
}

/** 'YYYY-MM-DD' → "18 oct 2026". */
export function fechaCorta(iso: string | null | undefined): string {
  if (!iso) return ''
  const [y, m, d] = iso.slice(0, 10).split('-').map(Number)
  if (!y || !m || !d) return ''
  return `${d} ${MESES[m - 1].slice(0, 3)} ${y}`
}

/** Hora local HH:MM de un timestamp ISO. */
export function horaCorta(iso: string | null | undefined): string {
  if (!iso) return ''
  return new Date(iso).toLocaleTimeString('es-MX', { hour: '2-digit', minute: '2-digit', hour12: false, timeZone: 'America/Mexico_City' })
}
