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
        style={{ backgroundColor: 'var(--agro-info-fill)', color: 'var(--agro-info-text)', fontWeight: 600 }}
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
        style={{ backgroundColor: 'var(--agro-info-fill)', color: 'var(--agro-info-text)', fontWeight: 600 }}
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
        {lote.estado === 'rechazado' && onVer && (
          <button
            onClick={() => onVer(lote)}
            className="flex items-center gap-1.5 text-xs px-3 py-1.5 rounded-lg border border-border"
            style={{ fontWeight: 600 }}
          >
            <Eye className="w-3 h-3" />
            Ver lo que capturé
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
            <p className="text-sm text-foreground" style={{ fontWeight: 600 }}>{lote.descripcion}</p>
            <p className="text-xs text-muted-foreground">Capturado: {formatFechaCaptura(lote.capturadoEn)}</p>
          </div>
          <button onClick={onCerrar} aria-label="Cerrar" className="w-8 h-8 rounded-lg flex items-center justify-center hover:bg-muted">
            <X className="w-4 h-4" />
          </button>
        </div>
        <div className="p-4 space-y-4">
          {lote.operaciones.map((op, i) => (
            <div key={i} className="space-y-1">
              <p className="text-xs text-muted-foreground" style={{ fontWeight: 600 }}>{etiqueta(op.tabla)}</p>
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
      {verLote && <DetalleCapturado lote={verLote} onCerrar={() => setVerLote(null)} />}
    </div>
  )
}
