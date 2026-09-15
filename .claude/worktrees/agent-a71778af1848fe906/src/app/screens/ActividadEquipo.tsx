import { useState, useMemo } from 'react'
import { useNavigate } from 'react-router'
import {
  ChevronLeft, RefreshCw, Loader2, TriangleAlert, X,
  AlertTriangle, CheckCircle2, Filter, Users,
} from 'lucide-react'
import { toast } from 'sonner'
import { useActividadEquipo } from '@/hooks/useActividadEquipo'
import type { ActividadItem } from '@/hooks/useActividadEquipo'
import { marcarCorreccion } from '@/lib/queries'

// ── Helpers ───────────────────────────────────────────────────────────────────

function formatFecha(iso: string): string {
  if (!iso) return '—'
  try {
    if (iso.length === 7) {
      // YYYY-MM — registro mensual
      const [y, m] = iso.split('-')
      return new Date(Number(y), Number(m) - 1).toLocaleDateString('es-MX', { month: 'long', year: 'numeric' })
    }
    return new Date(iso + 'T12:00:00').toLocaleDateString('es-MX', {
      day: 'numeric', month: 'short', year: 'numeric',
    })
  } catch {
    return iso
  }
}

function formatTimestamp(iso: string | null): string {
  if (!iso) return ''
  try {
    return new Date(iso).toLocaleDateString('es-MX', {
      day: 'numeric', month: 'short', year: 'numeric', hour: '2-digit', minute: '2-digit',
    })
  } catch { return '' }
}

// ── Componente de card ────────────────────────────────────────────────────────

function CardActividad({
  item,
  onMarcar,
}: {
  item: ActividadItem
  onMarcar: (item: ActividadItem) => void
}) {
  return (
    <div
      className="bg-card rounded-xl p-4 border"
      style={{
        borderColor: item.requiere_correccion ? 'var(--agro-amber)' : 'var(--border)',
        backgroundColor: item.requiere_correccion ? 'var(--agro-warning-fill)' : undefined,
      }}
    >
      <div className="flex items-start justify-between gap-3">
        <div className="flex-1 min-w-0">
          {/* Módulo + estado */}
          <div className="flex items-center gap-2 flex-wrap mb-1">
            <span
              className="text-[10px] px-2 py-0.5 rounded bg-muted text-muted-foreground flex-shrink-0"
              style={{ fontWeight: 600 }}
            >
              {item.moduloLabel}
            </span>
            {item.requiere_correccion && (
              <span
                className="text-[10px] px-2 py-0.5 rounded flex items-center gap-1 flex-shrink-0"
                style={{
                  backgroundColor: 'var(--agro-amber)',
                  color: '#fff',
                  fontWeight: 600,
                }}
              >
                <AlertTriangle className="w-3 h-3" />
                Requiere corrección
              </span>
            )}
          </div>

          {/* Rancho y fecha */}
          <p className="text-sm text-foreground truncate" style={{ fontWeight: 600 }}>
            {item.rancho_nombre}
          </p>
          <p className="text-xs text-muted-foreground mt-0.5">
            {formatFecha(item.fecha)}
          </p>

          {/* Capturado por */}
          <p className="text-xs text-muted-foreground mt-0.5">
            Por: {item.creado_por_nombre}
          </p>

          {/* Comentario de corrección */}
          {item.requiere_correccion && item.comentario_correccion && (
            <p
              className="text-xs mt-2 p-2 rounded-lg"
              style={{
                backgroundColor: 'rgba(0,0,0,0.05)',
                color: 'var(--agro-warning-text)',
              }}
            >
              "{item.comentario_correccion}"
            </p>
          )}
        </div>

        {/* Botón marcar/desmarcar */}
        <button
          onClick={() => onMarcar(item)}
          className="flex-shrink-0 text-xs px-3 py-1.5 rounded-lg border transition-colors"
          style={{
            borderColor: item.requiere_correccion ? 'var(--agro-amber)' : 'var(--border)',
            color: item.requiere_correccion ? 'var(--agro-warning-text)' : 'var(--muted-foreground)',
          }}
        >
          {item.requiere_correccion ? 'Desmarcar' : 'Marcar'}
        </button>
      </div>
    </div>
  )
}

// ── Pantalla ──────────────────────────────────────────────────────────────────

export function ActividadEquipo() {
  const navigate = useNavigate()
  const { items, empleados, loading, error, refetch } = useActividadEquipo()

  // Filtros
  const [filtroEmpleado, setFiltroEmpleado] = useState('')
  const [filtroModulo, setFiltroModulo] = useState('')
  const [filtroSolo, setFiltroSolo] = useState<'all' | 'correccion'>('all')
  const [filtrosAbiertos, setFiltrosAbiertos] = useState(false)

  // Sheet de corrección
  const [itemSeleccionado, setItemSeleccionado] = useState<ActividadItem | null>(null)
  const [comentario, setComentario] = useState('')
  const [marcando, setMarcando] = useState(false)

  const modulosUnicos = useMemo(() => {
    const set = new Set(items.map((i) => i.moduloLabel))
    return Array.from(set).sort()
  }, [items])

  const itemsFiltrados = useMemo(() => {
    return items.filter((item) => {
      if (filtroEmpleado && item.creado_por !== filtroEmpleado) return false
      if (filtroModulo && item.moduloLabel !== filtroModulo) return false
      if (filtroSolo === 'correccion' && !item.requiere_correccion) return false
      return true
    })
  }, [items, filtroEmpleado, filtroModulo, filtroSolo])

  const hayFiltrosActivos = filtroEmpleado || filtroModulo || filtroSolo === 'correccion'
  const countCorreccion = items.filter((i) => i.requiere_correccion).length

  function abrirSheet(item: ActividadItem) {
    setItemSeleccionado(item)
    setComentario(item.comentario_correccion ?? '')
  }

  function cerrarSheet() {
    setItemSeleccionado(null)
    setComentario('')
  }

  async function handleMarcar(requiere: boolean) {
    if (!itemSeleccionado) return
    if (requiere && !comentario.trim()) {
      toast.warning('Escribe un comentario explicando qué debe corregirse.')
      return
    }
    setMarcando(true)
    try {
      await marcarCorreccion(
        itemSeleccionado.tabla,
        itemSeleccionado.id,
        requiere,
        comentario.trim(),
      )
      toast.success(requiere ? 'Registro marcado para corrección' : 'Corrección desmarcada')
      cerrarSheet()
      refetch()
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : ''
      if (msg.toLowerCase().includes('rls') || msg.toLowerCase().includes('permission')) {
        toast.error('No tienes permiso para marcar este registro.')
      } else {
        toast.error('No se pudo actualizar el registro.')
      }
    } finally {
      setMarcando(false)
    }
  }

  return (
    <div className="min-h-full pb-safe-nav">

      {/* Header */}
      <header className="bg-card border-b border-border px-4 py-4 flex items-center gap-3">
        <button
          onClick={() => navigate(-1)}
          className="p-1 text-muted-foreground"
          aria-label="Volver"
        >
          <ChevronLeft className="w-5 h-5" />
        </button>
        <div className="flex items-center gap-2 flex-1 min-w-0">
          <Users className="w-5 h-5 text-primary flex-shrink-0" />
          <h1 className="text-foreground truncate" style={{ fontWeight: 600 }}>
            Actividad del equipo
          </h1>
        </div>
        <button
          onClick={refetch}
          className="p-2 text-muted-foreground hover:text-primary transition-colors"
          aria-label="Actualizar"
          disabled={loading}
        >
          <RefreshCw className={`w-4 h-4 ${loading ? 'animate-spin' : ''}`} />
        </button>
      </header>

      <div className="p-4 space-y-4">

        {/* Barra de filtros */}
        <div>
          <button
            onClick={() => setFiltrosAbiertos((v) => !v)}
            className="flex items-center gap-2 text-sm text-muted-foreground hover:text-foreground transition-colors"
          >
            <Filter className="w-4 h-4" />
            <span style={{ fontWeight: hayFiltrosActivos ? 600 : 400 }}>
              Filtros{hayFiltrosActivos ? ' (activos)' : ''}
            </span>
          </button>

          {filtrosAbiertos && (
            <div className="mt-3 space-y-3 p-4 bg-card border border-border rounded-xl">
              {/* Empleado */}
              <div>
                <label className="block text-xs text-muted-foreground mb-1.5" style={{ fontWeight: 600 }}>
                  EMPLEADO
                </label>
                <select
                  value={filtroEmpleado}
                  onChange={(e) => setFiltroEmpleado(e.target.value)}
                  className="w-full h-10 px-3 rounded-lg bg-input-background border border-border text-sm focus:outline-none focus:border-primary"
                >
                  <option value="">Todos</option>
                  {empleados.map((e) => (
                    <option key={e.id} value={e.id}>{e.nombre_completo}</option>
                  ))}
                </select>
              </div>

              {/* Módulo */}
              <div>
                <label className="block text-xs text-muted-foreground mb-1.5" style={{ fontWeight: 600 }}>
                  MÓDULO
                </label>
                <select
                  value={filtroModulo}
                  onChange={(e) => setFiltroModulo(e.target.value)}
                  className="w-full h-10 px-3 rounded-lg bg-input-background border border-border text-sm focus:outline-none focus:border-primary"
                >
                  <option value="">Todos</option>
                  {modulosUnicos.map((m) => (
                    <option key={m} value={m}>{m}</option>
                  ))}
                </select>
              </div>

              {/* Solo correcciones */}
              <div className="flex items-center justify-between">
                <span className="text-sm text-foreground">Solo con corrección pendiente</span>
                <button
                  onClick={() => setFiltroSolo((v) => v === 'correccion' ? 'all' : 'correccion')}
                  className="relative w-11 h-6 rounded-full transition-colors flex-shrink-0"
                  style={{
                    backgroundColor: filtroSolo === 'correccion' ? 'var(--primary)' : 'var(--switch-background)',
                  }}
                >
                  <span
                    className="absolute top-0.5 w-5 h-5 bg-white rounded-full shadow transition-transform"
                    style={{ transform: filtroSolo === 'correccion' ? 'translateX(22px)' : 'translateX(2px)' }}
                  />
                </button>
              </div>

              {/* Limpiar */}
              {hayFiltrosActivos && (
                <button
                  onClick={() => { setFiltroEmpleado(''); setFiltroModulo(''); setFiltroSolo('all') }}
                  className="text-xs text-muted-foreground underline"
                >
                  Limpiar filtros
                </button>
              )}
            </div>
          )}
        </div>

        {/* Resumen */}
        {!loading && !error && countCorreccion > 0 && (
          <div
            className="flex items-center gap-3 rounded-xl px-4 py-3"
            style={{ backgroundColor: 'var(--agro-warning-fill)', border: '1px solid var(--agro-amber)' }}
          >
            <AlertTriangle className="w-4 h-4 flex-shrink-0" style={{ color: 'var(--agro-warning-text)' }} />
            <p className="text-sm" style={{ color: 'var(--agro-warning-text)', fontWeight: 600 }}>
              {countCorreccion} {countCorreccion === 1 ? 'registro requiere' : 'registros requieren'} corrección
            </p>
          </div>
        )}

        {/* Lista */}
        {loading ? (
          <div className="flex justify-center py-12">
            <Loader2 className="w-8 h-8 text-primary animate-spin" />
          </div>
        ) : error ? (
          <div
            className="flex items-start gap-2 rounded-xl p-3"
            style={{ backgroundColor: 'var(--agro-danger-fill)' }}
          >
            <TriangleAlert className="w-4 h-4 flex-shrink-0 mt-0.5" style={{ color: 'var(--agro-danger-text)' }} />
            <p className="text-xs" style={{ color: 'var(--agro-danger-text)' }}>
              Error al cargar la actividad. Verifica tu conexión.
            </p>
          </div>
        ) : itemsFiltrados.length === 0 ? (
          <div className="bg-card border border-border rounded-xl p-8 text-center">
            <CheckCircle2 className="w-10 h-10 text-muted-foreground mx-auto mb-2" />
            <p className="text-sm text-muted-foreground" style={{ fontWeight: 600 }}>
              Sin registros
            </p>
            <p className="text-xs text-muted-foreground mt-1">
              {hayFiltrosActivos ? 'Ningún registro coincide con los filtros activos.' : 'Tu equipo aún no ha registrado actividad.'}
            </p>
          </div>
        ) : (
          <div className="space-y-3">
            <p className="text-xs text-muted-foreground px-1">
              {itemsFiltrados.length} registro{itemsFiltrados.length !== 1 ? 's' : ''}
            </p>
            {itemsFiltrados.map((item) => (
              <CardActividad key={`${item.tabla}-${item.id}`} item={item} onMarcar={abrirSheet} />
            ))}
          </div>
        )}

      </div>

      {/* Bottom Sheet — marcar/desmarcar corrección */}
      {itemSeleccionado && (
        <>
          <div className="fixed inset-0 bg-black/40 z-30" onClick={cerrarSheet} />
          <div
            className="fixed bottom-0 left-0 right-0 z-40 bg-card flex flex-col"
            style={{
              borderRadius: '0.625rem 0.625rem 0 0',
              maxWidth: 390,
              margin: '0 auto',
              maxHeight: '80%',
            }}
          >
            {/* Handle */}
            <div className="flex justify-center pt-3 pb-1 flex-shrink-0">
              <div className="w-10 h-1 rounded-full bg-border" />
            </div>

            {/* Header */}
            <div className="flex items-center justify-between px-4 py-3 border-b border-border flex-shrink-0">
              <div className="flex-1 min-w-0">
                <h2 className="text-base text-foreground" style={{ fontWeight: 600 }}>
                  {itemSeleccionado.requiere_correccion ? 'Gestionar corrección' : 'Marcar para corrección'}
                </h2>
                <p className="text-xs text-muted-foreground mt-0.5 truncate">
                  {itemSeleccionado.moduloLabel} · {itemSeleccionado.rancho_nombre}
                </p>
              </div>
              <button onClick={cerrarSheet} className="p-1 ml-2">
                <X className="w-5 h-5 text-muted-foreground" />
              </button>
            </div>

            <div className="flex-1 overflow-y-auto p-4 space-y-4">
              {/* Capturado por */}
              <div className="text-sm text-muted-foreground">
                Registrado por: <span style={{ fontWeight: 600, color: 'var(--foreground)' }}>{itemSeleccionado.creado_por_nombre}</span>
                <span className="ml-2">· {formatFecha(itemSeleccionado.fecha)}</span>
              </div>

              {/* Si ya está marcado — info */}
              {itemSeleccionado.requiere_correccion && itemSeleccionado.marcado_en && (
                <div
                  className="text-xs rounded-lg px-3 py-2"
                  style={{ backgroundColor: 'var(--agro-warning-fill)', color: 'var(--agro-warning-text)' }}
                >
                  Marcado el {formatTimestamp(itemSeleccionado.marcado_en)}
                </div>
              )}

              {/* Textarea comentario */}
              <div>
                <label className="block text-xs text-muted-foreground mb-1.5" style={{ fontWeight: 600 }}>
                  {itemSeleccionado.requiere_correccion ? 'ACTUALIZAR COMENTARIO' : 'QUÉ DEBE CORREGIRSE *'}
                </label>
                <textarea
                  value={comentario}
                  onChange={(e) => setComentario(e.target.value)}
                  rows={4}
                  placeholder="Describe qué está mal o qué debe corregirse..."
                  className="w-full px-3 py-2 rounded-lg bg-input-background border border-border text-sm focus:outline-none focus:border-primary focus:ring-1 focus:ring-primary resize-none"
                />
              </div>
            </div>

            {/* Botones */}
            <div className="p-4 border-t border-border flex-shrink-0 space-y-2">
              {itemSeleccionado.requiere_correccion ? (
                <>
                  <button
                    onClick={() => handleMarcar(true)}
                    disabled={marcando}
                    className="w-full h-12 bg-primary text-white rounded-3xl flex items-center justify-center gap-2 disabled:opacity-50 hover:bg-agro-blue transition-colors"
                    style={{ fontWeight: 600 }}
                  >
                    {marcando ? <Loader2 className="w-4 h-4 animate-spin" /> : null}
                    Actualizar comentario
                  </button>
                  <button
                    onClick={() => handleMarcar(false)}
                    disabled={marcando}
                    className="w-full h-12 rounded-3xl flex items-center justify-center gap-2 disabled:opacity-50 transition-colors border"
                    style={{
                      borderColor: 'var(--border)',
                      color: 'var(--muted-foreground)',
                      fontWeight: 600,
                    }}
                  >
                    Desmarcar corrección
                  </button>
                </>
              ) : (
                <button
                  onClick={() => handleMarcar(true)}
                  disabled={marcando}
                  className="w-full h-12 rounded-3xl flex items-center justify-center gap-2 disabled:opacity-50 transition-colors"
                  style={{
                    backgroundColor: 'var(--agro-amber)',
                    color: '#fff',
                    fontWeight: 600,
                  }}
                >
                  {marcando ? <Loader2 className="w-4 h-4 animate-spin" /> : <AlertTriangle className="w-4 h-4" />}
                  Marcar para corrección
                </button>
              )}
            </div>
          </div>
        </>
      )}
    </div>
  )
}
