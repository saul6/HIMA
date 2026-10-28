import { useEffect, useRef, useState } from 'react'
import { toast } from 'sonner'
import { ChevronDown, FileText, Loader2 } from 'lucide-react'
import { BottomSheet } from '@/app/components/BottomSheet'
import { TextareaContador } from '@/app/components/TextareaContador'
import { limiteTexto } from '@/lib/limitesTexto'
import { Input } from '@/app/components/ui/input'
import { FirmasRegistro } from '@/app/components/FirmasRegistro'
import { useFirmasRegistro, type MapaFirmas } from '@/hooks/useFirmasRegistro'
import { useConexion } from '@/hooks/useConexion'
import { hoyMX } from '@/lib/fecha'
import { Pildora } from './Pildora'
import { fechaLarga } from './constantes'
import { useColaboradoresChk } from './useColaboradores'
import type { ChkVisita, ChkVisitaEvento, useChecklist } from '@/hooks/useChecklist'
import { Boton } from '@/app/components/ui-mady/Boton'
import { FilaRegistro } from '@/app/components/ui-mady/FilaRegistro'
import { SkeletonFilas } from '@/app/components/SkeletonFilas'

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

interface OpcionesPdf {
  codigoClave?: string
  terminoSitio?: string
}

/** Genera (descarga) o previsualiza el PDF de una visita; errores de la BD en toast tal cual. */
function usePdfVisita(opc: OpcionesPdf) {
  const { online } = useConexion()
  const [generando, setGenerando] = useState<string | null>(null)

  async function generar(visitaId: string, previa = false) {
    if (generando) return
    if (!online) { toast.warning('Necesitas conexión para generar el PDF'); return }
    setGenerando(visitaId)
    try {
      // Import dinámico: @react-pdf pesa y solo se necesita al generar
      const m = await import('@/lib/pdf/m80/generarChecklistVisitaPDF')
      if (previa) await m.previsualizarChecklistVisitaPDF(visitaId, opc)
      else await m.generarChecklistVisitaPDF(visitaId, opc)
    } catch (e) {
      toast.error(e instanceof Error && e.message ? e.message : 'No se pudo generar el PDF')
    } finally {
      setGenerando(null)
    }
  }
  return { generando, generar }
}

function BotonPdf({ visitaId, previa, generando, onClick }: { visitaId: string; previa?: boolean; generando: string | null; onClick: () => void }) {
  const ocupado = generando === visitaId
  return (
    <button
      type="button"
      onClick={onClick}
      disabled={!!generando}
      className="h-8 px-3 rounded-lg border border-border bg-card text-xs text-foreground inline-flex items-center gap-1.5 transition-colors hover:bg-muted disabled:opacity-50 font-semibold"
    >
      {ocupado ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <FileText className="w-3.5 h-3.5" />}
      {previa ? 'Vista previa' : 'PDF'}
    </button>
  )
}

interface AccionProps extends OpcionesPdf {
  modo: ModoVisita | null
  ranchoId: string
  hook: Hook
  onClose: () => void
  onGuardado: () => void
}

export function VisitaAccionSheet({ modo, ...resto }: AccionProps) {
  // Tras terminar, el mismo sheet pasa a "Firmas de la visita"
  const [firmasDe, setFirmasDe] = useState<ChkVisita | null>(null)
  const cerrar = () => { setFirmasDe(null); resto.onClose() }

  return (
    <BottomSheet
      open={!!modo || !!firmasDe}
      onClose={cerrar}
      height={firmasDe ? '85%' : undefined}
      title={firmasDe ? 'Firmas de la visita' : modo ? TITULOS[modo.tipo] : ''}
    >
      {firmasDe ? (
        <PasoFirmasVisita visita={firmasDe} codigoClave={resto.codigoClave} terminoSitio={resto.terminoSitio} onCerrar={cerrar} />
      ) : modo && (
        <FormularioAccion modo={modo} {...resto} onClose={cerrar} onTerminada={setFirmasDe} />
      )}
    </BottomSheet>
  )
}

function PasoFirmasVisita({ visita, codigoClave, terminoSitio, onCerrar }: OpcionesPdf & { visita: ChkVisita; onCerrar: () => void }) {
  const { firmas, loading, refetch } = useFirmasRegistro('M80', [visita.id])
  const { generando, generar } = usePdfVisita({ codigoClave, terminoSitio })

  async function generarYCerrar() {
    await generar(visita.id)
    onCerrar()
  }

  return (
    <div className="flex-1 overflow-y-auto px-4 py-4 space-y-4">
      <p className="text-xs text-muted-foreground">
        Visita del {fechaLarga(visita.fecha)}. Firma ahora o más tarde desde la lista de visitas.
      </p>
      <FirmasRegistro
        modulo="M80"
        registroId={visita.id}
        fechaRegistro={visita.fecha}
        firma={firmas[visita.id]}
        loadingFirmas={loading}
        onFirmado={refetch}
      />
      <div className="flex gap-2">
        <Boton type="button" onClick={generarYCerrar} cargando={!!generando} className="flex-1">
          {generando ? <Loader2 className="w-4 h-4 animate-spin mx-auto" /> : 'Generar PDF'}
        </Boton>
        <button
          type="button"
          onClick={onCerrar}
          disabled={!!generando}
          className="h-11 px-5 rounded-lg border border-border bg-card text-sm text-foreground transition-colors hover:bg-muted font-semibold"
        >
          Después
        </button>
      </div>
    </div>
  )
}

function FormularioAccion({ modo, ranchoId, hook, onClose, onGuardado, onTerminada }: AccionProps & { modo: ModoVisita; onTerminada: (v: ChkVisita) => void }) {
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
    if (modo.tipo === 'terminar') onTerminada(modo.visita)
    else onClose()
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
            className="w-full h-9 rounded-md border border-border-control bg-input-background px-3 text-sm text-foreground"
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
            limite={limiteTexto('chk_visita_eventos', 'motivo') ?? 2000}
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
          <TextareaContador limite={limiteTexto('chk_visitas', 'nota') ?? 2000} value={nota} onChange={e => setNota(e.target.value)} rows={2} />
        </div>
      )}
      <button
        type="button"
        onClick={guardar}
        disabled={guardando}
        className="w-full h-11 rounded-lg text-sm transition disabled:opacity-50"
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

interface ListaProps extends OpcionesPdf {
  open: boolean
  visitas: ChkVisita[]
  destacada: string | null
  hook: Hook
  onClose: () => void
}

export function VisitasSheet({ open, visitas, destacada, hook, onClose, codigoClave, terminoSitio }: ListaProps) {
  const [abierta, setAbierta] = useState<string | null>(destacada)
  useEffect(() => { if (open) setAbierta(destacada) }, [open, destacada])
  const pdf = usePdfVisita({ codigoClave, terminoSitio })
  // Firmas solo de las visitas realizadas, y solo con el sheet abierto
  const idsRealizadas = open ? visitas.filter(v => v.estado === 'realizada').map(v => v.id) : []
  const { firmas, loading: loadingFirmas, refetch } = useFirmasRegistro('M80', idsRealizadas)

  return (
    <BottomSheet open={open} onClose={onClose} height="85%" title="Visitas de revisión">
      <div className="flex-1 overflow-y-auto px-4 py-4 space-y-3">
        {visitas.length === 0 && <p className="text-sm text-muted-foreground text-center py-8">Aún no hay visitas.</p>}
        {visitas.map(v => (
          <FilaVisita key={v.id} visita={v} abierta={abierta === v.id} onToggle={() => setAbierta(abierta === v.id ? null : v.id)} hook={hook}
            pdf={pdf} firmas={firmas} loadingFirmas={loadingFirmas} onFirmado={refetch} />
        ))}
      </div>
    </BottomSheet>
  )
}

interface FilaProps {
  visita: ChkVisita
  abierta: boolean
  onToggle: () => void
  hook: Hook
  pdf: ReturnType<typeof usePdfVisita>
  firmas: MapaFirmas
  loadingFirmas: boolean
  onFirmado: () => void
}

function FilaVisita({ visita, abierta, onToggle, hook, pdf, firmas, loadingFirmas, onFirmado }: FilaProps) {
  const [eventos, setEventos] = useState<ChkVisitaEvento[] | null>(null)

  useEffect(() => {
    if (!abierta || eventos) return
    let vivo = true
    hook.visitaEventos(visita.id).then(r => { if (vivo) setEventos(r.ok ? (r.data ?? []) : []) })
    return () => { vivo = false }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [abierta, visita.id])

  const tono = visita.atrasada
    ? { fill: 'var(--agro-info-fill)', text: 'var(--agro-info-text)' }
    : visita.estado === 'cancelada'
      ? { fill: 'var(--agro-danger-fill)', text: 'var(--agro-danger-text)' }
      : visita.estado === 'realizada'
        ? { fill: 'var(--agro-success-fill)', text: 'var(--agro-success-text)' }
        : { fill: 'var(--muted)', text: 'var(--foreground)' }

  return (
    <FilaRegistro
      variante="tarjeta"
      relleno="compacto"
      titulo={fechaLarga(visita.fecha)}
      lineas={visita.revisor ? `Revisa: ${visita.revisor}` : undefined}
      onClick={onToggle}
      expandido={abierta}
      derecha={
        <div className="flex items-center gap-2 flex-shrink-0 self-center">
          <span className="rounded-full px-2 py-0.5 text-caption font-semibold" style={{ backgroundColor: tono.fill, color: tono.text }}>
            {visita.atrasada ? 'Atrasada' : visita.estado === 'programada' ? 'Programada' : visita.estado === 'realizada' ? 'Realizada' : 'Cancelada'}
          </span>
          <ChevronDown className={`w-4 h-4 text-muted-foreground transition-transform ${abierta ? 'rotate-180' : ''}`} />
        </div>
      }
      detalle={abierta ? (
        <>
          {visita.nota && <p className="text-xs text-foreground whitespace-pre-wrap">{visita.nota}</p>}
          {(visita.estado === 'realizada' || visita.estado === 'programada') && (
            <div className="flex justify-end">
              <BotonPdf
                visitaId={visita.id}
                previa={visita.estado === 'programada'}
                generando={pdf.generando}
                onClick={() => pdf.generar(visita.id, visita.estado === 'programada')}
              />
            </div>
          )}
          {eventos === null ? (
            <SkeletonFilas rows={2} />
          ) : eventos.length === 0 ? (
            <p className="text-xs text-muted-foreground">Sin movimientos.</p>
          ) : (
            <ul className="space-y-2">
              {eventos.map((e, i) => (
                <li key={i} className="text-xs">
                  <p className="text-foreground font-semibold">
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
          {visita.estado === 'realizada' && (
            <FirmasRegistro
              modulo="M80"
              registroId={visita.id}
              fechaRegistro={visita.fecha}
              firma={firmas[visita.id]}
              loadingFirmas={loadingFirmas}
              onFirmado={onFirmado}
            />
          )}
        </>
      ) : undefined}
    />
  )
}
