// M85 · Lógica pura (sin red): próxima revisión y proyección a la bitácora PRO-05 de cinco bloques.
export const TZ = 'America/Mexico_City'

export interface LecturaBase {
  id: string
  temperatura_f: number
  medida_en: string
  fecha: string
  iniciales: string
  nombre_usuario: string
  estado: 'REGISTRADA' | 'INCIDENCIA_PENDIENTE' | 'INCIDENCIA_DOCUMENTADA'
  observacion: string | null
  accion: string | null
}

export const horaLocal = (iso: string) =>
  new Date(iso).toLocaleTimeString('en-GB', { timeZone: TZ, hour: '2-digit', minute: '2-digit', hour12: false })
export const fechaLocal = (iso: string | Date) => new Date(iso).toLocaleDateString('en-CA', { timeZone: TZ })
const horaNum = (iso: string) => Number(horaLocal(iso).slice(0, 2))
/** Hora local (UTC-6 fijo, sin horario de verano) de una fecha → instante. */
export const instanteLocal = (fechaISO: string, hhmm: string) => new Date(`${fechaISO}T${hhmm}:00-06:00`)
export const fmtF = (v: number) => Number(v).toFixed(1)

/** Valida lo que escribe el operador: entero o decimal (punto o coma), hasta 2 decimales, sin unidades ni exponentes. */
export function parsearTemperatura(txt: string): number | null {
  const t = txt.trim()
  if (!/^-?\d{1,3}([.,]\d{1,2})?$/.test(t)) return null
  const v = Number(t.replace(',', '.'))
  return Number.isFinite(v) && v >= -40 && v <= 120 ? v : null
}

export type Revision =
  | { tipo: 'sin_serie' }
  | { tipo: 'proxima'; hora: string }
  | { tipo: 'pendiente'; desde: string }

/** Cada 2 h desde el inicio de turno configurado o, si no hay, desde la primera lectura del día. Nunca genera temperaturas. */
export function calcularRevision(lecturasHoy: LecturaBase[], turnoInicio: string | null, ahora: Date = new Date()): Revision {
  const hoy = fechaLocal(ahora)
  const orden = lecturasHoy.filter(l => fechaLocal(l.medida_en) === hoy)
    .map(l => new Date(l.medida_en).getTime()).sort((a, b) => a - b)
  let ref: number
  if (turnoInicio) {
    ref = instanteLocal(hoy, turnoInicio.slice(0, 5)).getTime()
    if (ahora.getTime() < ref) return { tipo: 'proxima', hora: turnoInicio.slice(0, 5) }
  } else {
    if (orden.length === 0) return { tipo: 'sin_serie' }
    ref = orden[0]
  }
  const DOS_H = 2 * 3600 * 1000, TOL = 15 * 60 * 1000
  const k = Math.floor((ahora.getTime() - ref) / DOS_H)
  const vence = ref + k * DOS_H
  const cubierta = orden.some(t => t >= vence - TOL)
  return cubierta
    ? { tipo: 'proxima', hora: horaLocal(new Date(vence + DOS_H).toISOString()) }
    : { tipo: 'pendiente', desde: horaLocal(new Date(vence).toISOString()) }
}

/** Día de la bitácora: 01:00–23:59 van a su fecha; 00:00–00:59 van a la columna 24:00 del día anterior (formato 24 h). */
export function fechaBitacora(l: { medida_en: string }): string {
  return fechaLocal(new Date(new Date(l.medida_en).getTime() - 3600 * 1000))
}

export interface Verificacion { fecha: string; nombre: string; verificado_en: string }

export interface Bloque {
  fecha: string
  celdas: Map<number, LecturaBase>  // columna 1..24
  sinColumna: LecturaBase[]          // (sin uso: 00:00–00:59 van a la columna 24:00 del día anterior)
}

/** Cada lectura en la columna de su hora; si la columna ya está ocupada ese día, va a otro bloque de la misma fecha. */
export function proyectarBloques(lecturas: LecturaBase[]): Bloque[] {
  const porFecha = new Map<string, Bloque[]>()
  const fechas: string[] = []
  for (const l of [...lecturas].sort((a, b) => a.medida_en.localeCompare(b.medida_en))) {
    const f = fechaBitacora(l)
    if (!porFecha.has(f)) { porFecha.set(f, [{ fecha: f, celdas: new Map(), sinColumna: [] }]); fechas.push(f) }
    const bloques = porFecha.get(f)!
    const h0 = horaNum(l.medida_en)
    const h = h0 === 0 ? 24 : h0
    let b = bloques.find(x => !x.celdas.has(h))
    if (!b) { b = { fecha: f, celdas: new Map(), sinColumna: [] }; bloques.push(b) }
    b.celdas.set(h, l)
  }
  return fechas.sort().flatMap(f => porFecha.get(f)!)
}

/** Observaciones del bloque: iniciales = nombre, horas reales distintas a la columna, incidencias y lecturas sin columna. */
export function observacionesBloque(b: Bloque, limites: { min: number; max: number }, verif?: Verificacion | null): string[] {
  const todas = [...b.celdas.values(), ...b.sinColumna]
  const nombres = new Map<string, string>()
  for (const l of todas) nombres.set(l.iniciales, l.nombre_usuario)
  const obs: string[] = []
  if (nombres.size) obs.push(Array.from(nombres.entries()).map(([i, n]) => `${i} = ${n}`).join('; '))
  const horas = [...b.celdas.entries()].sort((a, c) => a[0] - c[0])
  const desfasadas = horas.filter(([c, l]) => c === 24 || horaLocal(l.medida_en).slice(3) !== '00')
    .map(([c, l]) => c === 24 ? `24:00 (medida ${horaLocal(l.medida_en)} del ${fechaLocal(l.medida_en).split('-').reverse().join('/')})` : `${String(c).padStart(2, '0')}:00 (medida ${horaLocal(l.medida_en)})`)
  if (desfasadas.length) obs.push(`Hora real de medición: ${desfasadas.join(', ')}`)
  for (const [, l] of horas) {
    if (l.estado === 'REGISTRADA') continue
    const base = `${horaLocal(l.medida_en)} · ${fmtF(l.temperatura_f)} °F fuera de ${limites.min}–${limites.max} °F`
    obs.push(l.estado === 'INCIDENCIA_PENDIENTE' ? `${base}: incidencia pendiente de documentar`
      : `${base}: ${l.observacion ?? ''}${l.accion ? ` · Acción: ${l.accion}` : ''}`)
  }
  if (verif) obs.push(`Verificó (encargado de turno): ${verif.nombre}, ${fechaLocal(verif.verificado_en).split('-').reverse().join('/')} ${horaLocal(verif.verificado_en)}`)
  return obs
}
