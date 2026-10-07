import { useState } from 'react'
import { CloudUpload, CheckCircle, AlertCircle, Clock, RotateCcw, Trash2, RefreshCw, Wifi, WifiOff } from 'lucide-react'
import { toast } from 'sonner'
import { useNavigate } from 'react-router'
import { useOutbox } from '@/hooks/useOutbox'
import { useConexion } from '@/hooks/useConexion'
import { useAuthContext } from '@/context/AuthContext'
import { eliminarLote, actualizarLote } from '@/lib/offline/outbox'
import { sincronizarLote } from '@/lib/offline/sync'
import type { LoteOutbox } from '@/lib/offline/tipos'
import { ModuloHeader } from '@/app/components/ModuloHeader'

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
        className="text-[10px] px-2 py-0.5 rounded"
        style={{ backgroundColor: 'var(--agro-warning-fill)', color: 'var(--agro-warning-text)', fontWeight: 600 }}
      >
        Pendiente de subir
      </span>
    )
  }
  if (lote.estado === 'rechazado') {
    return (
      <span
        className="text-[10px] px-2 py-0.5 rounded"
        style={{ backgroundColor: 'var(--agro-danger-fill)', color: 'var(--agro-danger-text)', fontWeight: 600 }}
      >
        No se pudo subir
      </span>
    )
  }
  if (lote.tarde) {
    return (
      <span
        className="text-[10px] px-2 py-0.5 rounded"
        style={{ backgroundColor: 'var(--agro-warning-fill)', color: 'var(--agro-warning-text)', fontWeight: 600 }}
      >
        Sincronizado tarde
      </span>
    )
  }
  return (
    <span
      className="text-[10px] px-2 py-0.5 rounded"
      style={{ backgroundColor: 'var(--agro-success-fill)', color: 'var(--agro-success-text)', fontWeight: 600 }}
    >
      Subido
    </span>
  )
}

function CardLote({
  lote,
  onReintentar,
  onDescartar,
}: {
  lote: LoteOutbox
  onReintentar?: (id: string) => void
  onDescartar?: (id: string) => void
}) {
  const horas = horasTranscurridas(lote.capturadoEn)
  const advertencia48h = lote.estado === 'pendiente' && horas >= 48

  return (
    <div className="bg-card border border-border rounded-xl p-4 space-y-2">
      <div className="flex items-start justify-between gap-2">
        <div className="min-w-0">
          <p className="text-sm text-foreground" style={{ fontWeight: 600 }}>{lote.descripcion}</p>
          <p className="text-xs text-muted-foreground mt-0.5">
            Capturado: {formatFechaCaptura(lote.capturadoEn)}
          </p>
          {lote.sincronizadoEn && (
            <p className="text-xs text-muted-foreground">
              Subido: {formatFechaCaptura(lote.sincronizadoEn)}
            </p>
          )}
        </div>
        <ChipEstado lote={lote} />
      </div>

      {lote.error && (
        <p className="text-xs" style={{ color: 'var(--agro-danger-text)' }}>
          {lote.error}
        </p>
      )}

      {advertencia48h && (
        <p className="text-xs" style={{ color: 'var(--agro-warning-text)' }}>
          Conéctate pronto: después de 72 h ya no se podrá subir.
        </p>
      )}

      {lote.intentos > 0 && lote.estado === 'pendiente' && (
        <p className="text-[10px] text-muted-foreground">{lote.intentos} {lote.intentos === 1 ? 'intento' : 'intentos'}</p>
      )}

      <div className="flex gap-2 pt-1">
        {lote.estado === 'pendiente' && onReintentar && (
          <button
            onClick={() => onReintentar(lote.id)}
            className="flex items-center gap-1.5 text-xs px-3 py-1.5 rounded-lg"
            style={{ backgroundColor: 'var(--primary)', color: '#fff', fontWeight: 600 }}
          >
            <RefreshCw className="w-3 h-3" />
            Reintentar
          </button>
        )}
        {lote.estado === 'rechazado' && onDescartar && (
          <button
            onClick={() => onDescartar(lote.id)}
            className="flex items-center gap-1.5 text-xs px-3 py-1.5 rounded-lg border border-agro-danger-text"
            style={{ color: 'var(--agro-danger-text)', fontWeight: 600 }}
          >
            <Trash2 className="w-3 h-3" />
            Descartar
          </button>
        )}
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
          <span style={{ fontWeight: 600 }}>
            {online ? 'Conectado' : 'Sin conexión'}
          </span>
          {online && totalPendientes > 0 && (
            <span className="ml-auto text-xs">Sincronizando {totalPendientes} registro{totalPendientes !== 1 ? 's' : ''}…</span>
          )}
        </div>
      </div>

      <div className="p-4 space-y-6">

        {mostrarVacio && (
          <div className="flex flex-col items-center justify-center py-16 gap-3">
            <CloudUpload className="w-10 h-10 text-muted-foreground" />
            <p className="text-sm text-muted-foreground">Todo sincronizado</p>
          </div>
        )}

        {/* Pendientes */}
        {pendientes.length > 0 && (
          <section>
            <div className="flex items-center gap-2 mb-3">
              <Clock className="w-4 h-4 text-muted-foreground" />
              <h2 className="text-sm text-muted-foreground" style={{ fontWeight: 600 }}>
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
              <h2 className="text-sm" style={{ color: 'var(--agro-danger-text)', fontWeight: 600 }}>
                No se pudieron subir ({rechazados.length})
              </h2>
            </div>
            <div className="space-y-3">
              {rechazados.map(l => (
                <CardLote
                  key={l.id}
                  lote={l}
                  onDescartar={descartando ? undefined : handleDescartar}
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
              <h2 className="text-sm text-muted-foreground" style={{ fontWeight: 600 }}>
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
    </div>
  )
}
