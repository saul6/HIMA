import { useRef, useState } from 'react'
import { toast } from 'sonner'
import { Loader2, MoonStar } from 'lucide-react'
import { Input } from '@/app/components/ui/input'
import { Pildora } from './Pildora'
import { fechaLarga } from './constantes'
import type { ChkSinActividad, useChecklist } from '@/hooks/useChecklist'
import { Boton } from '@/app/components/ui-mady/Boton'

const MOTIVOS_RAPIDOS = ['Temporada', 'Lluvias', 'Mantenimiento', 'Otro']

interface Props {
  ranchoId: string
  /** null = todo el sitio */
  itemId: string | null
  periodos: ChkSinActividad[]
  puedeEditar: boolean
  hook: ReturnType<typeof useChecklist>
  onCambio: () => void
}

/** Periodos sin operación: se registran y se anulan con motivo, no se editan ni se borran. */
export function SinOperacion({ ranchoId, itemId, periodos, puedeEditar, hook, onCambio }: Props) {
  const lista = periodos.filter(p => p.vigente && (p.item_id ?? null) === itemId)
  const [abierto, setAbierto] = useState(false)
  const [desde, setDesde] = useState('')
  const [hasta, setHasta] = useState('')
  const [rapido, setRapido] = useState<string | null>(null)
  const [texto, setTexto] = useState('')
  const [guardando, setGuardando] = useState(false)
  const eventId = useRef(crypto.randomUUID())

  const [anulando, setAnulando] = useState<string | null>(null)
  const [motivoAnular, setMotivoAnular] = useState('')

  const motivo = [rapido && rapido !== 'Otro' ? rapido : null, texto.trim() || null].filter(Boolean).join(': ')

  async function registrar() {
    if (guardando) return
    if (!desde || !hasta) { toast.warning('Indica desde y hasta'); return }
    if (hasta < desde) { toast.warning('La fecha final no puede ser anterior a la inicial'); return }
    if (!motivo || (rapido === 'Otro' && !texto.trim())) { toast.warning('El motivo es obligatorio'); return }
    setGuardando(true)
    const res = await hook.sinActividadRegistrar({
      rancho: ranchoId, desde, hasta, motivo, item: itemId ?? undefined, eventId: eventId.current,
    })
    setGuardando(false)
    if (!res.ok) { toast.error(res.mensaje ?? 'No se pudo registrar el periodo'); return }
    toast.success('Periodo sin operación registrado')
    eventId.current = crypto.randomUUID()
    setAbierto(false); setDesde(''); setHasta(''); setRapido(null); setTexto('')
    onCambio()
  }

  async function anular(id: string) {
    if (!motivoAnular.trim()) { toast.warning('El motivo es obligatorio'); return }
    setGuardando(true)
    const res = await hook.sinActividadAnular({ id, motivo: motivoAnular })
    setGuardando(false)
    if (!res.ok) { toast.error(res.mensaje ?? 'No se pudo anular el periodo'); return }
    toast.success('Periodo anulado')
    setAnulando(null); setMotivoAnular('')
    onCambio()
  }

  return (
    <section className="space-y-2">
      <h3 className="text-sm text-foreground font-semibold">Periodos sin operación</h3>
      {lista.length === 0 && <p className="text-xs text-muted-foreground">Sin periodos registrados.</p>}
      {lista.length > 0 && (
        <ul className="space-y-2">
          {lista.map(p => (
            <li key={p.id} className="rounded-lg border border-border p-3 space-y-1.5">
              <div className="flex items-start gap-2 text-xs text-foreground">
                <MoonStar className="w-3.5 h-3.5 mt-px flex-shrink-0 text-muted-foreground" />
                <span className="min-w-0">
                  Del {fechaLarga(p.desde)} al {fechaLarga(p.hasta)} · {p.motivo}
                </span>
              </div>
              {puedeEditar && (anulando === p.id ? (
                <div className="space-y-2">
                  <Input value={motivoAnular} maxLength={300} placeholder="Motivo para anular" onChange={e => setMotivoAnular(e.target.value)} />
                  <div className="flex gap-2">
                    <button type="button" onClick={() => { setAnulando(null); setMotivoAnular('') }} className="flex-1 h-9 rounded-lg border border-border text-sm hover:bg-muted">
                      Cancelar
                    </button>
                    <button
                      type="button"
                      onClick={() => anular(p.id)}
                      disabled={guardando}
                      className="flex-1 h-9 rounded-lg text-sm disabled:opacity-50 font-semibold"
                      style={{ backgroundColor: 'var(--agro-danger-fill)', color: 'var(--agro-danger-text)' }}
                    >
                      {guardando ? <Loader2 className="w-4 h-4 animate-spin mx-auto" /> : 'Anular'}
                    </button>
                  </div>
                </div>
              ) : (
                <button
                  type="button"
                  onClick={() => setAnulando(p.id)}
                  className="text-xs underline font-semibold"
                  style={{ color: 'var(--agro-danger-text)' }}
                >
                  Anular
                </button>
              ))}
            </li>
          ))}
        </ul>
      )}

      {puedeEditar && (abierto ? (
        <div className="rounded-lg border border-border p-3 space-y-3">
          <div className="grid grid-cols-2 gap-2">
            <label className="block space-y-1">
              <span className="text-xs text-muted-foreground">Desde</span>
              <Input type="date" value={desde} onChange={e => setDesde(e.target.value)} />
            </label>
            <label className="block space-y-1">
              <span className="text-xs text-muted-foreground">Hasta</span>
              <Input type="date" value={hasta} min={desde || undefined} onChange={e => setHasta(e.target.value)} />
            </label>
          </div>
          <div className="flex flex-wrap gap-2">
            {MOTIVOS_RAPIDOS.map(m => (
              <Pildora key={m} activa={rapido === m} onClick={() => setRapido(rapido === m ? null : m)}>{m}</Pildora>
            ))}
          </div>
          <Input value={texto} maxLength={300} placeholder="Detalle del motivo" onChange={e => setTexto(e.target.value)} />
          <div className="flex gap-2">
            <button type="button" onClick={() => setAbierto(false)} className="flex-1 h-10 rounded-lg border border-border text-sm hover:bg-muted">
              Cancelar
            </button>
            <Boton type="button" onClick={registrar} cargando={guardando} className="flex-1">
              {guardando ? <Loader2 className="w-4 h-4 animate-spin mx-auto" /> : 'Registrar'}
            </Boton>
          </div>
        </div>
      ) : (
        <button
          type="button"
          onClick={() => setAbierto(true)}
          className="w-full h-10 rounded-lg border border-border text-sm transition-colors hover:bg-muted font-semibold"
        >
          Registrar periodo sin operación
        </button>
      ))}
    </section>
  )
}
