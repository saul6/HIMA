import { useEffect, useRef, useState } from 'react'
import { toast } from 'sonner'
import { ChevronDown, Loader2 } from 'lucide-react'
import { BottomSheet } from '@/app/components/BottomSheet'
import { TextareaContador } from '@/app/components/TextareaContador'
import { Input } from '@/app/components/ui/input'
import { hoyMX } from '@/lib/fecha'
import { Pildora } from './Pildora'
import { fechaLarga } from './constantes'
import { useColaboradoresChk } from './useColaboradores'
import type { ChkVisita, ChkVisitaEvento, useChecklist } from '@/hooks/useChecklist'

type Hook = ReturnType<typeof useChecklist>

export type ModoVisita =
  | { tipo: 'programar' }
  | { tipo: 'reprogramar'; visita: ChkVisita }
  | { tipo: 'cancelar'; visita: ChkVisita }
  | { tipo: 'terminar'; visita: ChkVisita }

const MOTIVOS_RAPIDOS = ['Falta de tiempo', 'Cambio de fecha', 'Clima', 'Otro']

const TITULOS: Record<ModoVisita['tipo'], string> = {
  programar: 'Programar visita',
  reprogramar: 'Reprogramar visita',
  cancelar: 'Cancelar visita',
  terminar: 'Terminar visita',
}

interface AccionProps {
  modo: ModoVisita | null
  ranchoId: string
  hook: Hook
  onClose: () => void
  onGuardado: () => void
}

export function VisitaAccionSheet({ modo, ...resto }: AccionProps) {
  return (
    <BottomSheet open={!!modo} onClose={resto.onClose} title={modo ? TITULOS[modo.tipo] : ''}>
      {modo && <FormularioAccion modo={modo} {...resto} />}
    </BottomSheet>
  )
}

function FormularioAccion({ modo, ranchoId, hook, onClose, onGuardado }: AccionProps & { modo: ModoVisita }) {
  const hoy = hoyMX()
  const { admins } = useColaboradoresChk(modo.tipo === 'programar' || modo.tipo === 'reprogramar')
  const visita = modo.tipo === 'programar' ? null : modo.visita
  const [fecha, setFecha] = useState(visita && modo.tipo === 'reprogramar' ? (visita.fecha < hoy ? hoy : visita.fecha) : '')
  const [revisor, setRevisor] = useState(visita?.revisor_id ?? '')
  const [nota, setNota] = useState('')
  const [motivoRapido, setMotivoRapido] = useState<string | null>(null)
  const [motivoTexto, setMotivoTexto] = useState('')
  const [guardando, setGuardando] = useState(false)
  // Un solo p_event_id por ventana: reintentos reusan el mismo
  const eventId = useRef(crypto.randomUUID())

  const pideMotivo = modo.tipo === 'reprogramar' || modo.tipo === 'cancelar'
  const motivoFinal = [motivoRapido && motivoRapido !== 'Otro' ? motivoRapido : null, motivoTexto.trim() || null]
    .filter(Boolean).join(' · ')

  async function guardar() {
    if (guardando) return
    if ((modo.tipo === 'programar' || modo.tipo === 'reprogramar') && !fecha) { toast.warning('Elige la fecha'); return }
    if (pideMotivo && !motivoFinal) { toast.warning('El motivo es obligatorio'); return }
    if (pideMotivo && motivoRapido === 'Otro' && !motivoTexto.trim()) { toast.warning('Escribe el motivo'); return }
    setGuardando(true)
    let res
    if (modo.tipo === 'programar') {
      res = await hook.visitaProgramar({ rancho: ranchoId, fecha, revisor: revisor || undefined, nota, eventId: eventId.current })
    } else if (modo.tipo === 'reprogramar') {
      res = await hook.visitaReprogramar({ visita: modo.visita.id, fecha, motivo: motivoFinal, revisor: revisor || undefined, eventId: eventId.current })
    } else if (modo.tipo === 'cancelar') {
      res = await hook.visitaCancelar({ visita: modo.visita.id, motivo: motivoFinal, eventId: eventId.current })
    } else {
      res = await hook.visitaTerminar({ visita: modo.visita.id, nota, eventId: eventId.current })
    }
    setGuardando(false)
    if (!res.ok) { toast.error(res.mensaje ?? 'No se pudo completar la acción'); return }
    toast.success({
      programar: 'Visita programada',
      reprogramar: 'Visita reprogramada',
      cancelar: 'Visita cancelada',
      terminar: 'Visita terminada',
    }[modo.tipo])
    onGuardado()
    onClose()
  }

  const conFecha = modo.tipo === 'programar' || modo.tipo === 'reprogramar'

  return (
    <div className="px-4 py-4 space-y-4 overflow-y-auto">
      {visita && (
        <p className="text-xs text-muted-foreground">Visita del {fechaLarga(visita.fecha)}</p>
      )}
      {conFecha && (
        <label className="block space-y-1">
          <span className="text-xs text-muted-foreground">Fecha</span>
          <Input type="date" value={fecha} min={hoy} onChange={e => setFecha(e.target.value)} />
        </label>
      )}
      {conFecha && (
        <label className="block space-y-1">
          <span className="text-xs text-muted-foreground">Quién revisa</span>
          <select
            value={revisor}
            onChange={e => setRevisor(e.target.value)}
            className="w-full h-9 rounded-md border border-border bg-input-background px-3 text-sm text-foreground"
          >
            <option value="">Yo</option>
            {admins.map(a => <option key={a.id} value={a.id}>{a.nombre}</option>)}
          </select>
        </label>
      )}
      {pideMotivo && (
        <div className="space-y-2">
          <span className="text-xs text-muted-foreground">Motivo (obligatorio)</span>
          <div className="flex flex-wrap gap-2">
            {MOTIVOS_RAPIDOS.map(m => (
              <Pildora key={m} activa={motivoRapido === m} onClick={() => setMotivoRapido(motivoRapido === m ? null : m)}>{m}</Pildora>
            ))}
          </div>
          <TextareaContador
            limite={2000}
            value={motivoTexto}
            onChange={e => setMotivoTexto(e.target.value)}
            placeholder="Detalle del motivo"
            rows={2}
          />
        </div>
      )}
      {(modo.tipo === 'programar' || modo.tipo === 'terminar') && (
        <div>
          <span className="text-xs text-muted-foreground">Nota (opcional)</span>
          <TextareaContador limite={2000} value={nota} onChange={e => setNota(e.target.value)} rows={2} />
        </div>
      )}
      <button
        type="button"
        onClick={guardar}
        disabled={guardando}
        className="w-full h-11 rounded-lg text-sm transition active:scale-[0.99] disabled:opacity-50"
        style={
          modo.tipo === 'cancelar'
            ? { backgroundColor: 'var(--agro-danger-fill)', color: 'var(--agro-danger-text)', fontWeight: 600 }
            : { backgroundColor: 'var(--primary)', color: 'var(--primary-foreground)', fontWeight: 600 }
        }
      >
        {guardando ? <Loader2 className="w-4 h-4 animate-spin mx-auto" /> : {
          programar: 'Programar',
          reprogramar: 'Reprogramar',
          cancelar: 'Cancelar visita',
          terminar: 'Terminar visita',
        }[modo.tipo]}
      </button>
    </div>
  )
}

// ── Lista de visitas con bitácora ─────────────────────────────────────────────

const ETIQUETA_EVENTO: Record<string, string> = {
  programada: 'Programada',
  reprogramada: 'Reprogramada',
  cancelada: 'Cancelada',
  realizada: 'Realizada',
}

interface ListaProps {
  open: boolean
  visitas: ChkVisita[]
  destacada: string | null
  hook: Hook
  onClose: () => void
}

export function VisitasSheet({ open, visitas, destacada, hook, onClose }: ListaProps) {
  const [abierta, setAbierta] = useState<string | null>(destacada)
  useEffect(() => { if (open) setAbierta(destacada) }, [open, destacada])

  return (
    <BottomSheet open={open} onClose={onClose} height="85%" title="Visitas de revisión">
      <div className="flex-1 overflow-y-auto px-4 py-4 space-y-3">
        {visitas.length === 0 && <p className="text-sm text-muted-foreground text-center py-8">Aún no hay visitas.</p>}
        {visitas.map(v => (
          <FilaVisita key={v.id} visita={v} abierta={abierta === v.id} onToggle={() => setAbierta(abierta === v.id ? null : v.id)} hook={hook} />
        ))}
      </div>
    </BottomSheet>
  )
}

function FilaVisita({ visita, abierta, onToggle, hook }: { visita: ChkVisita; abierta: boolean; onToggle: () => void; hook: Hook }) {
  const [eventos, setEventos] = useState<ChkVisitaEvento[] | null>(null)

  useEffect(() => {
    if (!abierta || eventos) return
    let vivo = true
    hook.visitaEventos(visita.id).then(r => { if (vivo) setEventos(r.ok ? (r.data ?? []) : []) })
    return () => { vivo = false }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [abierta, visita.id])

  const tono = visita.atrasada
    ? { fill: 'var(--agro-warning-fill)', text: 'var(--agro-warning-text)' }
    : visita.estado === 'cancelada'
      ? { fill: 'var(--agro-danger-fill)', text: 'var(--agro-danger-text)' }
      : visita.estado === 'realizada'
        ? { fill: 'var(--agro-success-fill)', text: 'var(--agro-success-text)' }
        : { fill: 'var(--muted)', text: 'var(--foreground)' }

  return (
    <div className="rounded-xl border border-border bg-card">
      <button type="button" onClick={onToggle} className="w-full flex items-center justify-between gap-3 p-3 text-left">
        <div className="min-w-0">
          <p className="text-sm text-foreground" style={{ fontWeight: 600 }}>{fechaLarga(visita.fecha)}</p>
          {visita.revisor && <p className="text-xs text-muted-foreground">Revisa: {visita.revisor}</p>}
        </div>
        <div className="flex items-center gap-2 flex-shrink-0">
          <span className="rounded-full px-2 py-0.5 text-[11px]" style={{ backgroundColor: tono.fill, color: tono.text, fontWeight: 600 }}>
            {visita.atrasada ? 'Atrasada' : visita.estado === 'programada' ? 'Programada' : visita.estado === 'realizada' ? 'Realizada' : 'Cancelada'}
          </span>
          <ChevronDown className={`w-4 h-4 text-muted-foreground transition-transform ${abierta ? 'rotate-180' : ''}`} />
        </div>
      </button>
      {abierta && (
        <div className="border-t border-border px-3 py-3 space-y-2">
          {visita.nota && <p className="text-xs text-foreground whitespace-pre-wrap">{visita.nota}</p>}
          {eventos === null ? (
            <p className="text-xs text-muted-foreground">Cargando…</p>
          ) : eventos.length === 0 ? (
            <p className="text-xs text-muted-foreground">Sin movimientos.</p>
          ) : (
            <ul className="space-y-2">
              {eventos.map((e, i) => (
                <li key={i} className="text-xs">
                  <p className="text-foreground" style={{ fontWeight: 600 }}>
                    {ETIQUETA_EVENTO[e.tipo] ?? e.tipo}
                    <span className="text-muted-foreground" style={{ fontWeight: 400 }}>
                      {' · '}{fechaLarga(e.fecha)}{e.actor ? ` · ${e.actor}` : ''}
                    </span>
                  </p>
                  {e.nota && <p className="text-muted-foreground whitespace-pre-wrap">{e.nota}</p>}
                </li>
              ))}
            </ul>
          )}
        </div>
      )}
    </div>
  )
}
