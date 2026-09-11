import { X, Loader2 } from 'lucide-react'
import { BottomSheet } from '@/app/components/BottomSheet'

interface ConsolidadoSheetLimpiezaProps {
  open: boolean
  onClose: () => void
  termino: string
  terminoGenero: string
  ranchoOptions: { value: string; label: string }[]
  ranchoId: string
  onRanchoChange: (id: string) => void
  errRancho: boolean
  desde: string
  onDesdeChange: (v: string) => void
  hasta: string
  onHastaChange: (v: string) => void
  onGenerar: () => void
  generando: boolean
}

export function ConsolidadoSheetLimpieza({
  open,
  onClose,
  termino,
  terminoGenero,
  ranchoOptions,
  ranchoId,
  onRanchoChange,
  errRancho,
  desde,
  onDesdeChange,
  hasta,
  onHastaChange,
  onGenerar,
  generando,
}: ConsolidadoSheetLimpiezaProps) {
  return (
    <BottomSheet open={open} onClose={onClose} height="85%">
      <div className="flex justify-center pt-3 pb-1">
        <div className="w-9 h-1 rounded-full bg-border" />
      </div>
      <div className="px-4 pb-4">
        <div className="flex items-center justify-between mb-4">
          <h2 className="text-base text-foreground" style={{ fontWeight: 600 }}>Exportar consolidado</h2>
          <button type="button" onClick={onClose}>
            <X className="w-5 h-5 text-muted-foreground" />
          </button>
        </div>
        <div className="space-y-4">
          <div className="space-y-1">
            <label className="text-xs text-muted-foreground" style={{ fontWeight: 600 }}>{termino} *</label>
            <select
              value={ranchoId}
              onChange={(e) => onRanchoChange(e.target.value)}
              className="w-full h-11 px-3 rounded-xl border border-border bg-input-background text-sm"
              style={{ borderColor: errRancho ? 'var(--agro-red)' : undefined }}
            >
              <option value="">Selecciona {terminoGenero === 'f' ? 'una' : 'un'} {termino.toLowerCase()}</option>
              {ranchoOptions.map((o) => (
                <option key={o.value} value={o.value}>{o.label}</option>
              ))}
            </select>
            {errRancho && <p className="text-xs" style={{ color: 'var(--agro-red)' }}>Requerido</p>}
          </div>
          <div className="flex flex-col gap-3 sm:flex-row">
            <div className="flex-1 space-y-1">
              <label className="text-xs text-muted-foreground" style={{ fontWeight: 600 }}>Desde</label>
              <input
                type="month"
                value={desde}
                onChange={(e) => onDesdeChange(e.target.value)}
                className="w-full h-11 px-3 rounded-xl border border-border bg-input-background text-sm"
              />
            </div>
            <div className="flex-1 space-y-1">
              <label className="text-xs text-muted-foreground" style={{ fontWeight: 600 }}>Hasta</label>
              <input
                type="month"
                value={hasta}
                onChange={(e) => onHastaChange(e.target.value)}
                className="w-full h-11 px-3 rounded-xl border border-border bg-input-background text-sm"
              />
            </div>
          </div>
          <button
            type="button"
            onClick={onGenerar}
            disabled={generando}
            className="w-full h-11 rounded-xl text-sm text-white disabled:opacity-60 flex items-center justify-center gap-2"
            style={{ backgroundColor: 'var(--primary)', fontWeight: 600 }}
          >
            {generando ? (
              <><Loader2 className="w-4 h-4 animate-spin" />Generando…</>
            ) : (
              'Descargar PDF'
            )}
          </button>
        </div>
      </div>
    </BottomSheet>
  )
}
