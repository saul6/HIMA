import { useState } from 'react'
import { toast } from 'sonner'
import { Loader2 } from 'lucide-react'
import { BottomSheet } from '@/app/components/BottomSheet'
import { Switch } from '@/app/components/ui/switch'
import { Pildora } from './Pildora'
import { DIAS_SEMANA } from './constantes'
import { SinOperacion } from './SinOperacion'
import type { ChkSinActividad, useChecklist } from '@/hooks/useChecklist'
import { Boton } from '@/app/components/ui-mady/Boton'

interface Props {
  open: boolean
  ranchoId: string
  diasIniciales: number[]
  resumenInicial: boolean
  sinActividad: ChkSinActividad[]
  hook: ReturnType<typeof useChecklist>
  onClose: () => void
  onGuardado: () => void
}

export function AjustesSheet({ open, ...resto }: Props) {
  return (
    <BottomSheet open={open} onClose={resto.onClose} title="Ajustes del sitio">
      {open && <Formulario {...resto} />}
    </BottomSheet>
  )
}

function Formulario({ ranchoId, diasIniciales, resumenInicial, sinActividad, hook, onClose, onGuardado }: Omit<Props, 'open'>) {
  const [dias, setDias] = useState<number[]>(diasIniciales)
  const [resumen, setResumen] = useState(resumenInicial)
  const [guardando, setGuardando] = useState(false)

  function alternar(n: number) {
    setDias(d => (d.includes(n) ? d.filter(x => x !== n) : [...d, n].sort((a, b) => a - b)))
  }

  async function guardar() {
    if (guardando) return
    if (dias.length === 0) { toast.warning('Marca al menos un día de operación'); return }
    setGuardando(true)
    const res = await hook.configGuardar(ranchoId, dias, resumen)
    setGuardando(false)
    if (!res.ok) { toast.error(res.mensaje ?? 'No se pudieron guardar los ajustes'); return }
    toast.success('Ajustes guardados')
    onGuardado()
    onClose()
  }

  return (
    <div className="px-4 py-4 space-y-5 overflow-y-auto">
      <section className="space-y-2">
        <h3 className="text-sm text-foreground" style={{ fontWeight: 600 }}>Días que opera</h3>
        <p className="text-xs text-muted-foreground">Los módulos diarios solo esperan registros en estos días.</p>
        <div className="flex gap-2 flex-wrap">
          {DIAS_SEMANA.map(d => (
            <Pildora key={d.n} activa={dias.includes(d.n)} onClick={() => alternar(d.n)} className="w-10 px-0">
              <span aria-label={d.nombre}>{d.letra}</span>
            </Pildora>
          ))}
        </div>
      </section>
      <section className="flex items-center justify-between gap-3">
        <div>
          <p className="text-sm text-foreground" style={{ fontWeight: 600 }}>Resumen semanal</p>
          <p className="text-xs text-muted-foreground">Recibe un resumen del checklist cada semana.</p>
        </div>
        <Switch checked={resumen} onCheckedChange={setResumen} aria-label="Resumen semanal" />
      </section>
      <SinOperacion ranchoId={ranchoId} itemId={null} periodos={sinActividad} puedeEditar hook={hook} onCambio={onGuardado} />
      <Boton type="button" onClick={guardar} disabled={guardando} className="w-full">
        {guardando ? <Loader2 className="w-4 h-4 animate-spin mx-auto" /> : 'Guardar'}
      </Boton>
    </div>
  )
}
