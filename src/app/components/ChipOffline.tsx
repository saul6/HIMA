import { WifiOff } from 'lucide-react'
import type { LoteOutbox } from '@/lib/offline/tipos'

interface Props {
  lote: LoteOutbox
}

// Chip de estado para lotes pendientes/rechazados en la lista de cada módulo.
export function ChipOffline({ lote }: Props) {
  return (
    <span
      className="text-[10px] px-2 py-0.5 rounded flex-shrink-0 flex items-center gap-1"
      style={{
        backgroundColor: lote.estado === 'rechazado' ? 'var(--agro-danger-fill)' : 'var(--agro-warning-fill)',
        color: lote.estado === 'rechazado' ? 'var(--agro-danger-text)' : 'var(--agro-warning-text)',
        fontWeight: 600,
      }}
    >
      <WifiOff className="w-3 h-3" />
      {lote.estado === 'rechazado' ? 'Error al subir' : 'Sin subir'}
    </span>
  )
}
