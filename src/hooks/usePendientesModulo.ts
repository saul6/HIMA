import { useOutbox } from '@/hooks/useOutbox'
import type { LoteOutbox } from '@/lib/offline/tipos'

export type { LoteOutbox }

// Devuelve los lotes pendientes y rechazados de un módulo para mostrarlos
// mezclados en la lista del módulo con chip "Sin subir" / "Error al subir".
export function usePendientesModulo(modulo: string) {
  const { lotes } = useOutbox(modulo)
  const visibles = lotes.filter(l => l.estado !== 'sincronizado')
  return { lotes: visibles }
}
