import { useState } from 'react'
import { CloudUpload, CheckCircle, AlertCircle, Clock, RotateCcw, Trash2, RefreshCw, Wifi, WifiOff, Eye, X } from 'lucide-react'
import { toast } from 'sonner'
import { useNavigate } from 'react-router'
import { useOutbox } from '@/hooks/useOutbox'
import { useConexion } from '@/hooks/useConexion'
import { useAuthContext } from '@/context/AuthContext'
import { eliminarLote, actualizarLote } from '@/lib/offline/outbox'
import { sincronizarLote } from '@/lib/offline/sync'
import type { LoteOutbox } from '@/lib/offline/tipos'
import { ModuloHeader } from '@/app/components/ModuloHeader'
import { motivoLote } from '@/lib/offline/motivosRechazo'
import { EstadoVacio } from '@/app/components/ui-mady/EstadoVacio'
import { Boton } from '@/app/components/ui-mady/Boton'
import { FilaRegistro } from '@/app/components/ui-mady/FilaRegistro'

function formatFechaCaptura(iso: string): string {
  try {
    return new Date(iso).toLocaleString('es-MX', {
      day: 'numeric', month: 'short', year: 'numeric',
      hour: '2-digit', minute: '2-digit',
    })
  } catch { return iso }
}

function horasTranscurridas(iso: string): number {
  return (Date.now() - new Date(iso).getTime()) / 3_600_000
}

function ChipEstado({ lote }: { lote: LoteOutbox }) {
  if (lote.estado === 'pendiente') {
    return (
      <span
        className="text-caption px-2 py-0.5 rounded font-semibold"
        style={{ backgroundColor: 'var(--agro-info-fill)', color: 'var(--agro-info-text)' }}
      >
        Pendiente de subir
      </span>
    )
  }
  if (lote.estado === 'rechazado') {
    return (
      <span
        className="text-caption px-2 py-0.5 rounded font-semibold"
        style={{ backgroundColor: 'var(--agro-danger-fill)', color: 'var(--agro-danger-text)' }}
      >
        No se pudo subir
      </span>
    )
  }
  if (lote.tarde) {
    return (
      <span
        className="text-caption px-2 py-0.5 rounded font-semibold"
        style={{ backgroundColor: 'var(--agro-info-fill)', color: 'var(--agro-info-text)' }}
      >
        Sincronizado tarde
      </span>
    )
  }
  return (
    <span
      className="text-caption px-2 py-0.5 rounded font-semibold"
      style={{ backgroundColor: 'var(--agro-success-fill)', color: 'var(--agro-success-text)' }}
    >
      Subido
    </span>
  )
}

function CardLote({
  lote,
  onReintentar,
  onDescartar,
  onVer,
}: {
  lote: LoteOutbox
  onReintentar?: (id: string) => void
  onDescartar?: (id: string) => void
  onVer?: (lote: LoteOutbox) => void
}) {
  const horas = horasTranscurridas(lote.capturadoEn)
  const advertencia48h = lote.estado === 'pendiente' && horas >= 48

  return (
    <FilaRegistro
      variante="tarjeta"
      titulo={lote.descripcion}
      lineas={
        <>
          <span className="block">Capturado: {formatFechaCaptura(lote.capturadoEn)}</span>
          {lote.sincronizadoEn && <span className="block">Subido: {formatFechaCaptura(lote.sincronizadoEn)}</span>}
        </>
      }
      derecha={<ChipEstado lote={lote} />}
      acciones={
        <>
          {lote.estado === 'pendiente' && onReintentar && (
            <Boton tamano="sm" onClick={() => onReintentar(lote.id)}>
              <RefreshCw className="w-3 h-3" />
              Reintentar
            </Boton>
          )}
          {lote.estado === 'rechazado' && onVer && (
            <button
              onClick={() => onVer(lote)}
              className="flex items-center gap-1.5 text-xs px-3 py-1.5 rounded-lg border border-border font-semibold"
            >
              <Eye className="w-3 h-3" />
              Ver lo que capturé
            </button>
          )}
          {lote.estado === 'rechazado' && onDescartar && (
            <button
              onClick={() => onDescartar(lote.id)}
              className="flex items-center gap-1.5 text-xs px-3 py-1.5 rounded-lg border border-agro-danger-text font-semibold"
              style={{ color: 'var(--agro-danger-text)' }}
            >
              <Trash2 className="w-3 h-3" />
              Descartar
            </button>
          )}
        </>
      }
    >
      {lote.estado === 'rechazado' && (
        <p className="text-xs" style={{ color: 'var(--agro-danger-text)' }}>
          {motivoLote(lote)}
        </p>
      )}
      {lote.estado === 'pendiente' && lote.error && (
        <p className="text-xs text-muted-foreground">
          Aún no se sube; se reintentará automáticamente.
        </p>
      )}

      {advertencia48h && (
        <p className="text-xs" style={{ color: 'var(--agro-info-text)' }}>
          Conéctate pronto: después de 72 h ya no se podrá subir.
        </p>
      )}

      {lote.intentos > 0 && lote.estado === 'pendiente' && (
        <p className="text-caption text-muted-foreground">{lote.intentos} {lote.intentos === 1 ? 'intento' : 'intentos'}</p>
      )}
    </FilaRegistro>
  )
}

const CLAVES_OCULTAS = new Set(['id', 'org_id', 'creado_por', 'rancho_id'])

function etiqueta(clave: string): string {
  const t = clave.replace(/_/g, ' ')
  return t.charAt(0).toUpperCase() + t.slice(1)
}

function valorLegible(v: unknown): string {
  if (v === null || v === undefined || v === '') return '—'
  if (typeof v === 'boolean') return v ? 'Sí' : 'No'
  if (typeof v === 'object') return JSON.stringify(v)
  return String(v)
}

// Vista de solo lectura de lo capturado en un lote rechazado, para volver a capturarlo.
function DetalleCapturado({ lote, onCerrar }: { lote: LoteOutbox; onCerrar: () => void }) {
  return (
    <div className="fixed inset-0 z-50 flex items-end justify-center" style={{ backgroundColor: 'rgba(0,0,0,0.4)' }} onClick={onCerrar}>
      <div
        className="w-full max-w-[390px] bg-card overflow-y-auto"
        style={{ maxHeight: '85dvh', borderTopLeftRadius: '0.625rem', borderTopRightRadius: '0.625rem' }}
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-center justify-between px-4 py-3 border-b border-border">
          <div className="min-w-0">
            <p className="text-sm text-foreground font-semibold">{lote.descripcion}</p>
            <p className="text-xs text-muted-foreground">Capturado: {formatFechaCaptura(lote.capturadoEn)}</p>
          </div>
          <button onClick={onCerrar} aria-label="Cerrar" className="w-8 h-8 rounded-lg flex items-center justify-center hover:bg-muted">
            <X className="w-4 h-4" />
          </button>
        </div>
        <div className="p-4 space-y-4">
          {lote.operaciones.map((op, i) => (
            <div key={i} className="space-y-1">
              <p className="text-xs text-muted-foreground font-semibold">{etiqueta(op.tabla)}</p>
              {Object.entries(op.fila)
                .filter(([k]) => !CLAVES_OCULTAS.has(k) && !k.endsWith('_id'))
                .map(([k, v]) => (
                  <div key={k} className="flex justify-between gap-3 text-xs">
                    <span className="text-muted-foreground">{etiqueta(k)}</span>
                    <span className="text-foreground text-right break-words min-w-0">{valorLegible(v)}</span>
                  </div>
                ))}
            </div>
          ))}
        </div>
      </div>
    </div>
  )
}

export function Sincronizacion() {
  const navigate = useNavigate()
  const { user } = useAuthContext()
  const { pendientes, rechazados, sincronizados, totalPendientes, recargar } = useOutbox()
  const { online } = useConexion()
  const [descartando, setDescartando] = useState<string | null>(null)
  const [reintentando, setReintentando] = useState<string | null>(null)
  const [verLote, setVerLote] = useState<LoteOutbox | null>(null)

  async function handleReintentar(id: string) {
    if (!online) { toast.warning('Sin conexión — reintenta cuando tengas señal'); return }
    setReintentando(id)
    try {
      const resultado = await sincronizarLote(id)
      if (resultado?.ok) {
        toast.success('Registro subido correctamente')
        recargar()
      } else if (resultado?.ok === false) {
        toast.error(resultado.error ?? 'No se pudo subir el registro')
      } else {
        toast.warning('Sin conexión — el registro se reintentará automáticamente')
      }
    } catch {
      toast.error('Error al reintentar')
    } finally {
      setReintentando(null)
    }
  }

  async function handleDescartar(id: string) {
    const lote = rechazados.find(l => l.id === id)
    if (!lote) return
    const confirmar = window.confirm(`¿Descartar "${lote.descripcion}"? El registro se perderá permanentemente.`)
    if (!confirmar) return
    setDescartando(id)
    try {
      await eliminarLote(id)
      toast.success('Registro descartado')
      recargar()
    } finally {
      setDescartando(null)
    }
  }

  const mostrarVacio = pendientes.length === 0 && rechazados.length === 0 && sincronizados.length === 0

  return (
    <div className="min-h-full pb-safe-nav">
      <ModuloHeader tituloFallback="Sincronización" />

      {/* Estado de conexión */}
      <div className="px-4 pt-3">
        <div
          className="flex items-center gap-2 px-3 py-2.5 rounded-lg text-sm"
          style={{
            backgroundColor: online ? 'var(--agro-success-fill)' : 'var(--agro-danger-fill)',
            color: online ? 'var(--agro-success-text)' : 'var(--agro-danger-text)',
          }}
        >
          {online
            ? <Wifi className="w-4 h-4 flex-shrink-0" />
            : <WifiOff className="w-4 h-4 flex-shrink-0" />}
          <span className="font-semibold">
            {online ? 'Conectado' : 'Sin conexión'}
          </span>
          {online && totalPendientes > 0 && (
            <span className="ml-auto text-xs">Sincronizando {totalPendientes} registro{totalPendientes !== 1 ? 's' : ''}…</span>
          )}
        </div>
      </div>

      <div className="p-4 space-y-6">

        {mostrarVacio && (
          <EstadoVacio icono={CloudUpload} titulo="Todo sincronizado" />
        )}

        {/* Pendientes */}
        {pendientes.length > 0 && (
          <section>
            <div className="flex items-center gap-2 mb-3">
              <Clock className="w-4 h-4 text-muted-foreground" />
              <h2 className="text-sm text-muted-foreground font-semibold">
                Pendientes de subir ({pendientes.length})
              </h2>
            </div>
            <div className="space-y-3">
              {pendientes.map(l => (
                <CardLote
                  key={l.id}
                  lote={l}
                  onReintentar={reintentando ? undefined : handleReintentar}
                />
              ))}
            </div>
          </section>
        )}

        {/* Rechazados */}
        {rechazados.length > 0 && (
          <section>
            <div className="flex items-center gap-2 mb-3">
              <AlertCircle className="w-4 h-4" style={{ color: 'var(--agro-danger-text)' }} />
              <h2 className="text-sm font-semibold" style={{ color: 'var(--agro-danger-text)' }}>
                No se pudieron subir ({rechazados.length})
              </h2>
            </div>
            <div className="space-y-3">
              {rechazados.map(l => (
                <CardLote
                  key={l.id}
                  lote={l}
                  onDescartar={descartando ? undefined : handleDescartar}
                  onVer={setVerLote}
                />
              ))}
            </div>
          </section>
        )}

        {/* Sincronizados recientes */}
        {sincronizados.length > 0 && (
          <section>
            <div className="flex items-center gap-2 mb-3">
              <CheckCircle className="w-4 h-4" style={{ color: 'var(--agro-success-text)' }} />
              <h2 className="text-sm text-muted-foreground font-semibold">
                Subidos (últimos 7 días)
              </h2>
            </div>
            <div className="space-y-3">
              {sincronizados.map(l => (
                <CardLote key={l.id} lote={l} />
              ))}
            </div>
          </section>
        )}
      </div>
      {verLote && <DetalleCapturado lote={verLote} onCerrar={() => setVerLote(null)} />}
    </div>
  )
}
