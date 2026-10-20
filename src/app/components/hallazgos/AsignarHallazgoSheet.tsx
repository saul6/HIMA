import { useEffect, useId, useRef, useState } from 'react'
import { Loader2, X } from 'lucide-react'
import { toast } from 'sonner'
import { BottomSheet } from '@/app/components/BottomSheet'
import { useConexion } from '@/hooks/useConexion'
import { hoyMX } from '@/lib/fecha'
import {
  asignar, leerEstado, fechaMinimaAsignacion, esModuloAsignable,
  type ColaboradorAsignable, type EstadoAsignacion,
} from '@/lib/hallazgos/asignacion'

export interface HallazgoAsignable {
  respuesta_id: string
  modulo: string
  codigo_pregunta: string
  texto_pregunta: string
  comentario_respuesta: string | null
}

export function AsignarHallazgoSheet({
  item, colaboradores, cargandoColab, errorColab, onRecargarColab, onGuardado, onClose,
}: {
  item: HallazgoAsignable | null
  colaboradores: ColaboradorAsignable[]
  cargandoColab: boolean
  errorColab: string | null
  onRecargarColab: () => void
  onGuardado: () => void | Promise<void>
  onClose: () => void
}) {
  const uid = useId()
  const { online } = useConexion()
  const [estado, setEstado] = useState<EstadoAsignacion | null>(null)
  const [leyendo, setLeyendo] = useState(false)
  const [errorLectura, setErrorLectura] = useState<string | null>(null)
  const [ownerId, setOwnerId] = useState('')
  const [fecha, setFecha] = useState('')
  const [guardando, setGuardando] = useState(false)
  // Un solo event_id por apertura: los reintentos y el doble clic reusan el mismo
  const eventId = useRef('')

  useEffect(() => {
    if (!item) return
    let cancelado = false
    eventId.current = crypto.randomUUID()
    setEstado(null)
    setOwnerId('')
    setFecha('')
    setErrorLectura(null)
    if (!esModuloAsignable(item.modulo)) return
    setLeyendo(true)
    leerEstado(item.modulo, [item.respuesta_id])
      .then(r => {
        if (cancelado) return
        const e = r[item.respuesta_id] ?? null
        setEstado(e)
        setOwnerId(e?.owner_user_id ?? '')
        setFecha(e?.fecha_limite?.slice(0, 10) ?? '')
      })
      .catch(() => { if (!cancelado) setErrorLectura('No se pudo leer el estado del hallazgo.') })
      .finally(() => { if (!cancelado) setLeyendo(false) })
    return () => { cancelado = true }
  }, [item])

  const cerrado = estado?.hallazgo_estado === 'CLOSED'
  const fechaActual = estado?.fecha_limite?.slice(0, 10) ?? null
  const actualNoDisponible = !!ownerId && !colaboradores.some(c => c.id === ownerId)
  const bloqueado = leyendo || !!errorLectura || cargandoColab || !!errorColab || !online || cerrado

  async function guardar(e: React.FormEvent) {
    e.preventDefault()
    if (!item || guardando || bloqueado || !esModuloAsignable(item.modulo)) return
    if (!ownerId) { toast.warning('Selecciona un colaborador'); return }
    if (!fecha) { toast.warning('Selecciona la fecha límite'); return }
    setGuardando(true)
    try {
      const r = await asignar({
        modulo: item.modulo,
        respuestaId: item.respuesta_id,
        ownerId,
        fechaLimite: fecha,
        huella: estado?.huella ?? null,
        asignacionVersion: estado?.asignacion_version ?? null,
        eventId: eventId.current,
      })
      toast.success(r.sin_cambios ? 'La asignación ya estaba guardada' : 'Hallazgo asignado')
      await onGuardado()
      onClose()
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'No se pudo guardar la asignación')
    } finally {
      setGuardando(false)
    }
  }

  const numeral = estado?.numeral || item?.codigo_pregunta || ''

  return (
    <BottomSheet open={!!item} onClose={() => { if (!guardando) onClose() }} height="75%">
      <form onSubmit={guardar} className="flex flex-col min-h-0 flex-1">
        <div className="flex items-start justify-between px-4 pt-4 pb-3 border-b border-border flex-shrink-0">
          <h2 className="text-base text-foreground" style={{ fontWeight: 600 }}>
            Asignar hallazgo {numeral}
          </h2>
          <button type="button" onClick={() => !guardando && onClose()} className="p-1" aria-label="Cerrar">
            <X className="w-5 h-5 text-muted-foreground" />
          </button>
        </div>

        <div className="flex-1 overflow-y-auto px-4 py-4 space-y-4">
          <p className="text-sm text-foreground">{item?.comentario_respuesta || item?.texto_pregunta}</p>

          {!online && (
            <div className="rounded-xl p-3" style={{ backgroundColor: 'var(--agro-info-fill)' }}>
              <p className="text-xs" style={{ color: 'var(--agro-info-text)', fontWeight: 600 }}>
                Necesitas conexión para asignar un hallazgo.
              </p>
            </div>
          )}
          {cerrado && (
            <p className="text-xs" style={{ color: 'var(--agro-danger-text)', fontWeight: 600 }}>
              El hallazgo ya está cerrado.
            </p>
          )}
          {errorLectura && (
            <p role="alert" className="text-xs" style={{ color: 'var(--agro-danger-text)' }}>{errorLectura}</p>
          )}

          <div className="space-y-1">
            <label htmlFor={`${uid}-colab`} className="text-xs text-muted-foreground" style={{ fontWeight: 600 }}>
              COLABORADOR *
            </label>
            <select
              id={`${uid}-colab`}
              value={ownerId}
              onChange={e => setOwnerId(e.target.value)}
              disabled={bloqueado || guardando}
              className="w-full h-11 px-3 rounded-lg bg-input-background border border-border text-sm text-foreground disabled:opacity-50"
            >
              <option value="">
                {cargandoColab || leyendo ? 'Cargando…' : 'Selecciona un colaborador'}
              </option>
              {actualNoDisponible && (
                <option value={ownerId} disabled>{estado?.owner_nombre ?? 'Responsable actual no disponible'}</option>
              )}
              {colaboradores.map(c => <option key={c.id} value={c.id}>{c.nombre}</option>)}
            </select>
            {errorColab && (
              <p role="alert" className="text-xs" style={{ color: 'var(--agro-danger-text)' }}>
                {errorColab}{' '}
                <button type="button" onClick={onRecargarColab} className="underline text-primary">Volver a cargar</button>
              </p>
            )}
          </div>

          <div className="space-y-1">
            <label htmlFor={`${uid}-fecha`} className="text-xs text-muted-foreground" style={{ fontWeight: 600 }}>
              FECHA LÍMITE *
            </label>
            <input
              id={`${uid}-fecha`}
              type="date"
              value={fecha}
              min={fechaMinimaAsignacion(hoyMX(), fechaActual)}
              onChange={e => setFecha(e.target.value)}
              disabled={bloqueado || guardando}
              className="w-full h-11 px-3 rounded-lg bg-input-background border border-border text-sm text-foreground disabled:opacity-50"
            />
            <p className="text-xs text-muted-foreground">Incluye todo ese día (hora de Ciudad de México).</p>
          </div>
        </div>

        <div className="px-4 pb-6 pt-4 border-t border-border flex gap-3 flex-shrink-0">
          <button
            type="button"
            onClick={onClose}
            disabled={guardando}
            className="h-12 px-5 rounded-3xl border border-border text-sm text-foreground disabled:opacity-50"
          >
            Cancelar
          </button>
          <button
            type="submit"
            disabled={guardando || bloqueado}
            className="flex-1 h-12 bg-primary text-white rounded-3xl flex items-center justify-center gap-2 disabled:opacity-50 hover:bg-agro-blue transition-colors"
            style={{ fontWeight: 600 }}
          >
            {guardando && <Loader2 className="w-4 h-4 animate-spin" />}
            {guardando ? 'Guardando…' : 'Guardar'}
          </button>
        </div>
      </form>
    </BottomSheet>
  )
}
