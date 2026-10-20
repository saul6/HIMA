import { X, Loader2 } from 'lucide-react'
import { BottomSheet } from '@/app/components/BottomSheet'
import { Boton } from '@/app/components/ui-mady/Boton'

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
      <div className="pt-4 px-4 pb-4">
        <div className="flex items-center justify-between mb-4">
          <h2 className="text-base text-foreground font-semibold">Exportar consolidado</h2>
          <button aria-label="Cerrar" type="button" onClick={onClose}>
            <X className="w-5 h-5 text-muted-foreground" />
          </button>
        </div>
        <div className="space-y-4">
          <div className="space-y-1">
            <label className="text-xs text-muted-foreground font-semibold">{termino} *</label>
            <select
              value={ranchoId}
              onChange={(e) => onRanchoChange(e.target.value)}
              className="w-full h-11 px-3 rounded-xl border border-border-control bg-input-background text-sm"
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
              <label className="text-xs text-muted-foreground font-semibold">Desde</label>
              <input
                type="month"
                value={desde}
                onChange={(e) => onDesdeChange(e.target.value)}
                className="w-full h-11 px-3 rounded-xl border border-border-control bg-input-background text-sm"
              />
            </div>
            <div className="flex-1 space-y-1">
              <label className="text-xs text-muted-foreground font-semibold">Hasta</label>
              <input
                type="month"
                value={hasta}
                onChange={(e) => onHastaChange(e.target.value)}
                className="w-full h-11 px-3 rounded-xl border border-border-control bg-input-background text-sm"
              />
            </div>
          </div>
          <Boton type="button" onClick={onGenerar} cargando={generando} className="w-full">
            {generando ? (
              <><Loader2 className="w-4 h-4 animate-spin" />Generando…</>
            ) : (
              'Descargar PDF'
            )}
          </Boton>
        </div>
      </div>
    </BottomSheet>
  )
}
