// Hoja "Exportar consolidado" por rango de fechas (M82–M86). La generación la hace cada módulo con onGenerar.
import { useEffect, useState } from 'react'
import { X } from 'lucide-react'
import { toast } from 'sonner'
import { BottomSheet } from '@/app/components/BottomSheet'
import { Boton } from '@/app/components/ui-mady/Boton'
import { hoyMX } from '@/lib/fecha'

const fieldCls = 'w-full h-10 rounded-[0.625rem] border border-border-control bg-input-background px-3 text-sm'

export function ConsolidadoRangoSheet({ open, onClose, titulo = 'Exportar consolidado', ayuda, vacio = 'No hay registros en ese periodo', onGenerar }: {
  open: boolean
  onClose: () => void
  titulo?: string
  ayuda?: string
  vacio?: string
  /** Genera y descarga; devuelve cuántos registros/días incluyó (0 = nada que exportar). */
  onGenerar: (desde: string, hasta: string) => Promise<number>
}) {
  const [desde, setDesde] = useState(hoyMX().slice(0, 8) + '01')
  const [hasta, setHasta] = useState(hoyMX())
  const [cargando, setCargando] = useState(false)
  useEffect(() => { if (open) { setDesde(hoyMX().slice(0, 8) + '01'); setHasta(hoyMX()) } }, [open])

  async function generar() {
    if (!desde || !hasta || hasta < desde) { toast.error('El rango de fechas no es válido'); return }
    setCargando(true)
    try {
      const n = await onGenerar(desde, hasta)
      if (n === 0) toast.info(vacio); else onClose()
    } catch (e: any) { toast.error(e?.message ?? 'Error al generar el PDF') } finally { setCargando(false) }
  }

  return (
    <BottomSheet open={open} onClose={() => { if (!cargando) onClose() }} height="85%">
      <div className="flex items-center justify-between px-4 pt-4 pb-3 border-b border-border">
        <h2 className="text-base text-foreground font-semibold">{titulo}</h2>
        <button aria-label="Cerrar" type="button" onClick={() => { if (!cargando) onClose() }}><X className="w-5 h-5 text-muted-foreground" /></button>
      </div>
      <div className="overflow-y-auto px-4 pb-6 pt-3 space-y-4" style={{ flex: 1 }}>
        <div className="flex gap-3">
          <div className="flex-1 space-y-1">
            <label className="text-xs text-muted-foreground font-semibold">Desde</label>
            <input type="date" className={fieldCls} value={desde} max={hoyMX()} onChange={e => setDesde(e.target.value)} />
          </div>
          <div className="flex-1 space-y-1">
            <label className="text-xs text-muted-foreground font-semibold">Hasta</label>
            <input type="date" className={fieldCls} value={hasta} max={hoyMX()} onChange={e => setHasta(e.target.value)} />
          </div>
        </div>
        {ayuda && <p className="text-xs text-muted-foreground">{ayuda}</p>}
        <Boton type="button" onClick={generar} cargando={cargando} className="w-full">Generar PDF</Boton>
      </div>
    </BottomSheet>
  )
}
