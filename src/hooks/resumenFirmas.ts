import { esFirmaUnica, type FirmasDeRegistro } from '@/hooks/useFirmasRegistro'

export type EstadoFirmas = 'firmado' | 'pendiente' | 'neutro'

export interface ResumenFirmas {
  hechas: number
  total: number
  estado: EstadoFirmas
}

/** Resumen visual de firmas de un registro, con el `firmas[id]` que la pantalla ya tiene.
 * Sin consultas. `hechas` = firmas vigentes (Realizó, Verificó, Enterado); `total` = los huecos
 * que pinta FirmasRegistro (3, o 2 con firma única). `firmado` = Realizó y Verificó vigentes
 * (el enterado no cuenta). Sin datos todavía (`cargando`) devuelve `neutro`. */
export function resumenFirmas(firma: FirmasDeRegistro | undefined | null, cargando = false): ResumenFirmas {
  if (!firma) {
    return cargando
      ? { hechas: 0, total: 3, estado: 'neutro' }
      : { hechas: 0, total: 3, estado: 'pendiente' }
  }
  const unica = esFirmaUnica(firma)
  const realizo = firma.realizo?.estado === 'vigente'
  const verifico = firma.verifico?.estado === 'vigente'
  const enterado = firma.enterado?.estado === 'vigente'
  const hechas = unica
    ? (realizo && verifico ? 1 : 0) + (enterado ? 1 : 0)
    : (realizo ? 1 : 0) + (verifico ? 1 : 0) + (enterado ? 1 : 0)
  return { hechas, total: unica ? 2 : 3, estado: realizo && verifico ? 'firmado' : 'pendiente' }
}

/** "N registros · N pendientes de firma". Sin `pendientes` (firmas sin cargar) solo "N registros". */
export function textoResumenLista(total: number, pendientes: number | null): string {
  const base = `${total} ${total === 1 ? 'registro' : 'registros'}`
  if (pendientes === null) return base
  return `${base} · ${pendientes} ${pendientes === 1 ? 'pendiente' : 'pendientes'} de firma`
}
