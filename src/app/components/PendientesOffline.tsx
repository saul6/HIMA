import { usePendientesModulo } from '@/hooks/usePendientesModulo'
import { ChipOffline } from '@/app/components/ChipOffline'
import { motivoLote } from '@/lib/offline/motivosRechazo'

// Lotes guardados sin conexión (o rechazados) de un módulo, para pintarlos arriba de su lista.
export function PendientesOffline({ modulo }: { modulo: string }) {
  const { lotes } = usePendientesModulo(modulo)
  if (lotes.length === 0) return null
  return (
    <div className="space-y-2 pb-2">
      {lotes.map((lote) => (
        <div key={lote.id} className="bg-card border border-border rounded-[0.625rem] p-4">
          <div className="flex items-start justify-between gap-2">
            <div className="flex-1 min-w-0">
              <p className="text-sm font-semibold leading-snug">{lote.descripcion}</p>
              {lote.estado === 'rechazado' && (
                <p className="text-xs mt-0.5" style={{ color: 'var(--agro-danger-text)' }}>{motivoLote(lote)}</p>
              )}
            </div>
            <ChipOffline lote={lote} />
          </div>
        </div>
      ))}
    </div>
  )
}
