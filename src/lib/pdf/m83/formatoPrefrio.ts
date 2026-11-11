// Formato puro de M83 (sin dependencias de red): lo usan la pantalla y el PDF.
export type Unidad = 'C' | 'F'

/** Hora local (America/Mexico_City, UTC-6 sin horario de verano) de hoy → ISO con zona. */
export function isoDesdeHoraLocal(fechaISO: string, hhmm: string): string {
  return `${fechaISO}T${hhmm}:00-06:00`
}

export function horaLocal(iso: string): string {
  return new Date(iso).toLocaleTimeString('en-GB', { timeZone: 'America/Mexico_City', hour: '2-digit', minute: '2-digit', hour12: false })
}

export function fechaLocal(iso: string): string {
  return new Date(iso).toLocaleDateString('en-CA', { timeZone: 'America/Mexico_City' })
}

export function duracionHHMM(min: number): string {
  const h = Math.floor(min / 60), m = min % 60
  return `${h}:${String(m).padStart(2, '0')}`
}

export function fmtTemp(v: number, u: Unidad): string {
  return `${Number(v).toFixed(1)} °${u}`
}

