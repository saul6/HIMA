// M86 · Lógica pura (sin red) del manifiesto.
import type { M86Tarima } from '@/hooks/useM86Manifiesto'

export const TZ = 'America/Mexico_City'
export const horaLocal = (iso: string | null) => (iso ? new Date(iso).toLocaleTimeString('en-GB', { timeZone: TZ, hour: '2-digit', minute: '2-digit', hour12: false }) : '')
export const fechaLocal = (iso: string) => new Date(iso).toLocaleDateString('en-CA', { timeZone: TZ })
export const fmtT = (v: number | null | undefined) => (v === null || v === undefined ? '' : Number(v).toFixed(1))

/** Totales de cajas cargadas por presentación (solo tarimas CARGADAS), en orden de aparición. */
export function totalesPorPresentacion(tarimas: M86Tarima[]): { codigo: string; presentacion: string; clasificacion: string; cajas: number }[] {
  const mapa = new Map<string, { codigo: string; presentacion: string; clasificacion: string; cajas: number }>()
  for (const t of tarimas) if (t.estado === 'CARGADA') for (const l of t.lineas) {
    const x = mapa.get(l.codigo) ?? { codigo: l.codigo, presentacion: l.presentacion, clasificacion: l.clasificacion, cajas: 0 }
    x.cajas += l.cajas
    mapa.set(l.codigo, x)
  }
  return Array.from(mapa.values())
}
