import { WifiOff } from 'lucide-react'
import type { LoteOutbox } from '@/lib/offline/tipos'
import { motivoLote } from '@/lib/offline/motivosRechazo'
import { Etiqueta } from '@/app/components/ui-mady/Etiqueta'

interface Props {
  lote?: LoteOutbox
}

// Chip de estado para lotes pendientes/rechazados en la lista de cada módulo.
export function ChipOffline({ lote }: Props) {
  if (!lote) return null
  return (
    <Etiqueta
      tono={lote.estado === 'rechazado' ? 'error' : 'pendiente'}
      title={motivoLote(lote) ?? undefined}
      icono={<WifiOff className="w-3 h-3" />}
    >
      {lote.estado === 'rechazado' ? 'Error al subir' : 'Sin subir'}
    </Etiqueta>
  )
}
