import { useEffect, useRef, useState } from 'react'
import { useNavigate } from 'react-router'
import { toast } from 'sonner'
import { ExternalLink, Loader2 } from 'lucide-react'
import { BottomSheet } from '@/app/components/BottomSheet'
import { TextareaContador } from '@/app/components/TextareaContador'
import { Input } from '@/app/components/ui/input'
import { Pildora } from './Pildora'
import { NotasItem, codigoItem } from './ItemCard'
import { ESTADO_REVISION_LABEL, TONO_ESTADO, fechaLarga, haceDias } from './constantes'
import {
  ESTADOS_REVISION, FRECUENCIAS, ORIGENES_FRECUENCIA,
  type ChkEstadoRevision, type ChkFrecuencia, type ChkFrecuenciaOrigen, type ChkItem, type ChkSinActividad, type ChkRevisionHistorial, type useChecklist,
} from '@/hooks/useChecklist'
import { SinOperacion } from './SinOperacion'
import { useColaboradoresChk, type ColaboradorChk } from './useColaboradores'

type Hook = ReturnType<typeof useChecklist>

interface Props {
  item: ChkItem | null
  /** Abrir directo en el formulario de revisión */
  modoRevisar: boolean
  ranchoId: string
  codigoClave: string
  puedeEditar: boolean
  sinActividad: ChkSinActividad[]
  visitaAbierta: { id: string; fecha: string } | null
  hook: Hook
  onClose: () => void
  onCambio: () => void
}

export function ItemDetalleSheet(p: Props) {
  return (
    <BottomSheet open={!!p.item} onClose={p.onClose} height="85%" title={p.item?.nombre ?? ''}>
      {p.item && <Contenido key={p.item.id} {...p} item={p.item} />}
    </BottomSheet>
  )
}

function Contenido({
  item, modoRevisar, ranchoId, codigoClave, puedeEditar, sinActividad, visitaAbierta, hook, onClose, onCambio,
}: Props & { item: ChkItem }) {
  const navigate = useNavigate()
  const { colaboradores } = useColaboradoresChk(puedeEditar)
  const esDoc = item.tipo === 'documento'
  const esModulo = item.tipo === 'modulo'

  // Revisión
  const [estado, setEstado] = useState<ChkEstadoRevision | null>(null)
  const [obs, setObs] = useState('')
  const [guardando, setGuardando] = useState(false)
  const eventId = useRef(crypto.randomUUID())
  const revisarRef = useRef<HTMLDivElement>(null)

  // Frecuencia
  const origenInicial: ChkFrecuenciaOrigen =
    item.frecuencia_origen && item.frecuencia_origen !== 'sugerida' ? item.frecuencia_origen : 'admin'
  const [frecuencia, setFrecuencia] = useState<ChkFrecuencia | null>(item.frecuencia)
  const [origen, setOrigen] = useState<ChkFrecuenciaOrigen>(origenInicial)
  const [fuente, setFuente] = useState(item.frecuencia_fuente ?? '')
  const [guardandoFrec, setGuardandoFrec] = useState(false)

  // Datos
  const [datos, setDatos] = useState({
    nombre: item.nombre,
    codigo_formato: item.codigo_formato ?? '',
    area: item.area ?? '',
    responsable_texto: item.responsable_texto ?? '',
    responsable_profile_id: item.responsable_profile_id ?? '',
    vence_el: item.vence_el ?? '',
  })
  const [guardandoDatos, setGuardandoDatos] = useState(false)
  const [confirmarQuitar, setConfirmarQuitar] = useState(false)

  // Historial
  const [historial, setHistorial] = useState<ChkRevisionHistorial[] | null>(null)

  useEffect(() => {
    let vivo = true
    hook.historial(item.id).then(r => { if (vivo) setHistorial(r.ok ? (r.data ?? []) : []) })
    return () => { vivo = false }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [item.id])

  useEffect(() => {
    if (modoRevisar) revisarRef.current?.scrollIntoView({ block: 'start' })
  }, [modoRevisar])

  async function guardarRevision() {
    if (!estado || guardando) return
    if (estado === 'otro' && !obs.trim()) { toast.warning('Con "Otro" la observación es obligatoria'); return }
    setGuardando(true)
    const res = await hook.revisar({
      item: item.id, estado, observacion: obs, visita: visitaAbierta?.id, eventId: eventId.current,
    })
    setGuardando(false)
    if (!res.ok) { toast.error(res.mensaje ?? 'No se pudo guardar la revisión'); return }
    toast.success('Revisión guardada')
    onCambio()
    onClose()
  }

  const pideFuente = origen !== 'admin'
  const frecuenciaCambio =
    frecuencia !== item.frecuencia || origen !== origenInicial || (pideFuente && fuente.trim() !== (item.frecuencia_fuente ?? ''))

  async function guardarFrecuencia() {
    if (guardandoFrec || !frecuencia || !frecuenciaCambio) return
    if (pideFuente && !fuente.trim()) { toast.warning('Escribe el documento y la revisión de donde sale'); return }
    setGuardandoFrec(true)
    const res = await hook.itemGuardar(ranchoId, {
      frecuencia,
      frecuencia_origen: origen,
      frecuencia_fuente: pideFuente ? fuente.trim() : null,
    }, item.id)
    setGuardandoFrec(false)
    if (!res.ok) { toast.error(res.mensaje ?? 'No se pudo guardar la frecuencia'); return }
    toast.success('Frecuencia guardada')
    onCambio()
  }

  async function guardarDatos() {
    if (guardandoDatos) return
    const base: Record<string, unknown> = {
      codigo_formato: datos.codigo_formato.trim() || null,
      area: datos.area.trim() || null,
      responsable_texto: datos.responsable_profile_id ? null : (datos.responsable_texto.trim() || null),
      responsable_profile_id: datos.responsable_profile_id || null,
    }
    if (!esModulo) {
      if (!datos.nombre.trim()) { toast.warning('El nombre es obligatorio'); return }
      base.nombre = datos.nombre.trim()
    }
    if (esDoc) base.vence_el = datos.vence_el || null
    setGuardandoDatos(true)
    const res = await hook.itemGuardar(ranchoId, base, item.id)
    setGuardandoDatos(false)
    if (!res.ok) { toast.error(res.mensaje ?? 'No se pudieron guardar los datos'); return }
    toast.success('Datos guardados')
    onCambio()
  }

  async function quitar() {
    setGuardandoDatos(true)
    const res = await hook.itemGuardar(ranchoId, { activo: false }, item.id)
    setGuardandoDatos(false)
    if (!res.ok) { toast.error(res.mensaje ?? 'No se pudo quitar'); return }
    toast.success(esDoc ? 'Documento quitado' : 'Formato quitado')
    onCambio()
    onClose()
  }

  const codigo = codigoItem(item, codigoClave)
  const responsable = item.responsable_nombre ?? item.responsable_texto

  return (
    <div className="flex-1 overflow-y-auto px-4 py-4 space-y-5">
      <div className="space-y-1">
        {codigo && <p className="text-xs text-muted-foreground">{codigo}</p>}
        {responsable && <p className="text-xs text-muted-foreground">Responsable: {responsable}</p>}
        {item.area && <p className="text-xs text-muted-foreground">Área: {item.area}</p>}
        {esDoc && item.vence_el && <p className="text-xs text-muted-foreground">Vence el {fechaLarga(item.vence_el)}</p>}
        {item.ultimo_registro && esModulo && (
          <p className="text-xs text-muted-foreground">Último registro: {fechaLarga(item.ultimo_registro)}</p>
        )}
      </div>

      <NotasItem item={item} />

      {esModulo && item.modulo_ruta && (
        <button
          type="button"
          onClick={() => navigate(item.modulo_ruta!)}
          className="w-full h-10 rounded-lg border border-border text-sm inline-flex items-center justify-center gap-2 transition-colors hover:bg-muted active:scale-[0.99]"
          style={{ fontWeight: 600, color: 'var(--primary)' }}
        >
          <ExternalLink className="w-4 h-4" />
          Abrir formato
        </button>
      )}

      {puedeEditar && (
        <section ref={revisarRef} className="space-y-3">
          <h3 className="text-sm text-foreground" style={{ fontWeight: 600 }}>Revisar</h3>
          {visitaAbierta && (
            <p className="text-xs rounded-lg px-2.5 py-1.5" style={{ backgroundColor: 'var(--agro-success-fill)', color: 'var(--agro-success-text)' }}>
              Dentro de la visita del {fechaLarga(visitaAbierta.fecha)}
            </p>
          )}
          <div className="flex flex-wrap gap-2">
            {ESTADOS_REVISION.map(e => (
              <Pildora key={e.value} activa={estado === e.value} onClick={() => setEstado(e.value)}>{e.label}</Pildora>
            ))}
          </div>
          <div>
            <TextareaContador
              limite={2000}
              value={obs}
              onChange={e => setObs(e.target.value)}
              placeholder={estado === 'otro' ? 'Observación (obligatoria)' : 'Observación (opcional)'}
              rows={3}
            />
          </div>
          <button
            type="button"
            onClick={guardarRevision}
            disabled={!estado || guardando}
            className="w-full h-11 rounded-lg text-sm transition active:scale-[0.99] disabled:opacity-50"
            style={{ backgroundColor: 'var(--primary)', color: 'var(--primary-foreground)', fontWeight: 600 }}
          >
            {guardando ? <Loader2 className="w-4 h-4 animate-spin mx-auto" /> : 'Guardar revisión'}
          </button>
        </section>
      )}

      {puedeEditar && !esDoc && (
        <section className="space-y-2">
          <h3 className="text-sm text-foreground" style={{ fontWeight: 600 }}>Frecuencia esperada</h3>
          <div className="flex flex-wrap gap-2">
            {FRECUENCIAS.map(f => (
              <Pildora key={f.value} activa={frecuencia === f.value} onClick={() => setFrecuencia(f.value)} disabled={guardandoFrec}>
                {f.label}
                {item.frecuencia_sugerida === f.value && (
                  <span className="ml-1.5 text-[10px] opacity-80" style={{ fontWeight: 400 }}>Sugerida</span>
                )}
              </Pildora>
            ))}
          </div>
          <p className="text-xs text-muted-foreground pt-1">¿De dónde sale?</p>
          <div className="flex flex-wrap gap-2">
            {ORIGENES_FRECUENCIA.map(o => (
              <Pildora key={o.value} activa={origen === o.value} onClick={() => setOrigen(o.value)} disabled={guardandoFrec}>
                {o.label}
              </Pildora>
            ))}
          </div>
          {pideFuente && (
            <Input
              value={fuente}
              maxLength={150}
              placeholder="Documento y revisión (p. ej. POE-SAN-06 Rev. 02)"
              onChange={e => setFuente(e.target.value)}
            />
          )}
          {item.frecuencia_fijada_en && (
            <p className="text-[11px] text-muted-foreground">Fijada el {fechaLarga(item.frecuencia_fijada_en)}</p>
          )}
          <button
            type="button"
            onClick={guardarFrecuencia}
            disabled={!frecuenciaCambio || !frecuencia || guardandoFrec}
            className="w-full h-10 rounded-lg border border-border text-sm transition-colors hover:bg-muted disabled:opacity-50"
            style={{ fontWeight: 600 }}
          >
            {guardandoFrec ? <Loader2 className="w-4 h-4 animate-spin mx-auto" /> : 'Guardar frecuencia'}
          </button>
        </section>
      )}

      {!esDoc && (
        <SinOperacion ranchoId={ranchoId} itemId={item.id} periodos={sinActividad} puedeEditar={puedeEditar} hook={hook} onCambio={onCambio} />
      )}

      {puedeEditar && (
        <section className="space-y-3">
          <h3 className="text-sm text-foreground" style={{ fontWeight: 600 }}>Datos</h3>
          {!esModulo && (
            <Campo etiqueta="Nombre">
              <Input value={datos.nombre} maxLength={150} onChange={e => setDatos(d => ({ ...d, nombre: e.target.value }))} />
            </Campo>
          )}
          <Campo etiqueta="Código del formato">
            <Input value={datos.codigo_formato} maxLength={150} onChange={e => setDatos(d => ({ ...d, codigo_formato: e.target.value }))} />
          </Campo>
          <Campo etiqueta="Área">
            <Input value={datos.area} maxLength={150} onChange={e => setDatos(d => ({ ...d, area: e.target.value }))} />
          </Campo>
          <Campo etiqueta="Responsable">
            <SelectorResponsable
              colaboradores={colaboradores}
              profileId={datos.responsable_profile_id}
              texto={datos.responsable_texto}
              onProfile={id => setDatos(d => ({ ...d, responsable_profile_id: id }))}
              onTexto={t => setDatos(d => ({ ...d, responsable_texto: t }))}
            />
          </Campo>
          {esDoc && (
            <Campo etiqueta="Vence el">
              <Input type="date" value={datos.vence_el} onChange={e => setDatos(d => ({ ...d, vence_el: e.target.value }))} />
            </Campo>
          )}
          <button
            type="button"
            onClick={guardarDatos}
            disabled={guardandoDatos}
            className="w-full h-10 rounded-lg border border-border text-sm transition-colors hover:bg-muted disabled:opacity-50"
            style={{ fontWeight: 600 }}
          >
            {guardandoDatos ? <Loader2 className="w-4 h-4 animate-spin mx-auto" /> : 'Guardar datos'}
          </button>

          {!esModulo && (
            confirmarQuitar ? (
              <div className="flex gap-2">
                <button type="button" onClick={() => setConfirmarQuitar(false)} className="flex-1 h-10 rounded-lg border border-border text-sm hover:bg-muted">
                  No
                </button>
                <button
                  type="button"
                  onClick={quitar}
                  disabled={guardandoDatos}
                  className="flex-1 h-10 rounded-lg text-sm disabled:opacity-50"
                  style={{ backgroundColor: 'var(--agro-danger-fill)', color: 'var(--agro-danger-text)', fontWeight: 600 }}
                >
                  Sí, quitar
                </button>
              </div>
            ) : (
              <button
                type="button"
                onClick={() => setConfirmarQuitar(true)}
                className="w-full h-10 rounded-lg border text-sm transition-colors hover:bg-muted"
                style={{ borderColor: 'var(--agro-red)', color: 'var(--agro-danger-text)', fontWeight: 600 }}
              >
                {esDoc ? 'Quitar documento' : 'Quitar formato'}
              </button>
            )
          )}
        </section>
      )}

      <section className="space-y-2 pb-4">
        <h3 className="text-sm text-foreground" style={{ fontWeight: 600 }}>Historial</h3>
        {historial === null ? (
          <p className="text-xs text-muted-foreground">Cargando…</p>
        ) : historial.length === 0 ? (
          <p className="text-xs text-muted-foreground">Aún no hay revisiones.</p>
        ) : (
          <ul className="space-y-2">
            {historial.map((h, i) => {
              const t = TONO_ESTADO[h.estado]
              return (
                <li key={i} className="rounded-lg border border-border p-3 space-y-1.5">
                  <div className="flex items-center justify-between gap-2">
                    <span className="rounded-full px-2 py-0.5 text-[11px]" style={{ backgroundColor: t.fill, color: t.text, fontWeight: 600 }}>
                      {ESTADO_REVISION_LABEL[h.estado]}
                    </span>
                    <span className="text-[11px] text-muted-foreground">
                      {fechaLarga(h.revisado_en)}{h.revisado_por ? ` · ${h.revisado_por}` : ''}
                    </span>
                  </div>
                  {h.observacion && <p className="text-xs text-foreground whitespace-pre-wrap">{h.observacion}</p>}
                  {h.notas?.map((n, j) => (
                    <p key={j} className="text-[11px] text-muted-foreground">{n.texto}</p>
                  ))}
                </li>
              )
            })}
          </ul>
        )}
        {item.ultima_revision && (
          <p className="text-[11px] text-muted-foreground">Última revisión {haceDias(item.dias_sin_revisar)}</p>
        )}
      </section>
    </div>
  )
}

function Campo({ etiqueta, children }: { etiqueta: string; children: React.ReactNode }) {
  return (
    <label className="block space-y-1">
      <span className="text-xs text-muted-foreground">{etiqueta}</span>
      {children}
    </label>
  )
}

export function SelectorResponsable({
  colaboradores, profileId, texto, onProfile, onTexto,
}: {
  colaboradores: ColaboradorChk[]
  profileId: string
  texto: string
  onProfile: (id: string) => void
  onTexto: (t: string) => void
}) {
  return (
    <div className="space-y-2">
      <select
        value={profileId}
        onChange={e => onProfile(e.target.value)}
        className="w-full h-9 rounded-md border border-border bg-input-background px-3 text-sm text-foreground"
      >
        <option value="">Escribir nombre o puesto</option>
        {colaboradores.map(c => <option key={c.id} value={c.id}>{c.nombre}</option>)}
      </select>
      {!profileId && (
        <Input value={texto} maxLength={150} placeholder="Nombre o puesto" onChange={e => onTexto(e.target.value)} />
      )}
    </div>
  )
}
