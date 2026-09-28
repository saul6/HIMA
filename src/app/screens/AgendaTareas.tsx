import { useState, useEffect, useRef, useCallback } from 'react'
import {
  ChevronLeft, Plus, Loader2, AlertTriangle,
  Calendar, MapPin, FileText, ChevronDown, ChevronUp, ExternalLink,
  Clock, Camera, Trash2, CheckCircle2, RotateCcw, XCircle, Image,
} from 'lucide-react'
import { useNavigate, useSearchParams } from 'react-router'
import { toast } from 'sonner'
import { BottomSheet } from '@/app/components/BottomSheet'
import { useAuthContext } from '@/context/AuthContext'
import { useModulosContext } from '@/context/ModulosContext'
import { useRanchos } from '@/hooks/useRanchos'
import { useAgendaTareas } from '@/hooks/useAgendaTareas'
import type { TareaListada, TareaDetalle, PrioridadTarea, EstadoTarea } from '@/hooks/useAgendaTareas'
import { comprimirImagen } from '@/lib/fotos/comprimirImagen'
import { subirEvidencia, getSignedUrlsEvidencia } from '@/lib/storage/agendaStorage'

// ── Helpers ───────────────────────────────────────────────────────────────────

function formatFechaLimite(fecha: string | null): string {
  if (!fecha) return '—'
  const [y, m, d] = fecha.split('-').map(Number)
  return new Date(y, m - 1, d).toLocaleDateString('es-MX', {
    day: 'numeric', month: 'short', year: 'numeric',
  })
}

function formatFechaCorta(iso: string): string {
  try {
    return new Date(iso).toLocaleDateString('es-MX', { day: 'numeric', month: 'short' })
  } catch {
    return iso
  }
}

const PRIORIDAD_LABELS: Record<PrioridadTarea, string> = {
  alta: 'Alta',
  media: 'Media',
  baja: 'Baja',
}

const EVENTO_LABELS: Record<string, string> = {
  CREADA: 'Tarea creada',
  EDITADA: 'Editada',
  REASIGNADA: 'Reasignada',
  INICIADA: 'Iniciada',
  REPORTADA: 'Reportada',
  APROBADA: 'Aprobada',
  REGRESADA: 'Regresada',
  CANCELADA: 'Cancelada',
}

function ChipPrioridad({ prioridad }: { prioridad: PrioridadTarea }) {
  const styles: Record<PrioridadTarea, { bg: string; text: string }> = {
    alta:  { bg: 'var(--agro-danger-fill)',  text: 'var(--agro-danger-text)'  },
    media: { bg: 'var(--agro-warning-fill)', text: 'var(--agro-warning-text)' },
    baja:  { bg: 'var(--muted)',             text: 'var(--muted-foreground)'  },
  }
  const s = styles[prioridad]
  return (
    <span
      className="inline-flex items-center px-2 py-0.5 rounded-full text-[10px] font-semibold leading-none"
      style={{ backgroundColor: s.bg, color: s.text }}
    >
      {PRIORIDAD_LABELS[prioridad]}
    </span>
  )
}

function ChipEstado({ estado, vencida }: { estado: EstadoTarea; vencida: boolean }) {
  if (vencida && (estado === 'pendiente' || estado === 'en_progreso')) {
    return (
      <span
        className="inline-flex items-center px-2 py-0.5 rounded-full text-[10px] font-semibold leading-none"
        style={{ backgroundColor: 'var(--agro-danger-fill)', color: 'var(--agro-danger-text)' }}
      >
        Vencida
      </span>
    )
  }
  const map: Record<EstadoTarea, { bg: string; text: string; label: string }> = {
    pendiente:     { bg: 'var(--agro-warning-fill)', text: 'var(--agro-warning-text)', label: 'Pendiente'    },
    en_progreso:   { bg: 'var(--agro-success-fill)', text: 'var(--agro-success-text)', label: 'En progreso'  },
    por_verificar: { bg: 'var(--agro-warning-fill)', text: 'var(--agro-warning-text)', label: 'Por verificar'},
    cerrada:       { bg: 'var(--agro-success-fill)', text: 'var(--agro-success-text)', label: 'Cerrada'      },
    cancelada:     { bg: 'var(--muted)',             text: 'var(--muted-foreground)',  label: 'Cancelada'    },
  }
  const s = map[estado]
  return (
    <span
      className="inline-flex items-center px-2 py-0.5 rounded-full text-[10px] font-semibold leading-none"
      style={{ backgroundColor: s.bg, color: s.text }}
    >
      {s.label}
    </span>
  )
}

// ── TareaCard ─────────────────────────────────────────────────────────────────

function TareaCard({
  tarea,
  esAdmin,
  onClick,
}: {
  tarea: TareaListada
  esAdmin: boolean
  onClick: () => void
}) {
  return (
    <button
      onClick={onClick}
      className="w-full text-left rounded-xl border border-border bg-card p-4 flex flex-col gap-2 transition-colors hover:border-primary/30 active:scale-[0.99]"
    >
      {tarea.regresada && (
        <div
          className="flex items-start gap-2 rounded-lg px-3 py-2 text-xs"
          style={{ backgroundColor: 'var(--agro-warning-fill)', color: 'var(--agro-warning-text)' }}
        >
          <RotateCcw className="w-3.5 h-3.5 flex-shrink-0 mt-0.5" />
          <span>Regresada: {tarea.motivo_regreso ?? '—'}</span>
        </div>
      )}
      <div className="flex items-start justify-between gap-2">
        <p className="text-sm font-semibold leading-tight" style={{ color: 'var(--foreground)' }}>
          {tarea.titulo}
        </p>
        <ChipPrioridad prioridad={tarea.prioridad} />
      </div>

      <div className="flex flex-wrap items-center gap-2">
        <ChipEstado estado={tarea.estado} vencida={tarea.vencida} />
        {tarea.fecha_limite && (
          <span
            className="inline-flex items-center gap-1 text-xs"
            style={{ color: tarea.vencida ? 'var(--agro-danger-text)' : 'var(--muted-foreground)' }}
          >
            <Calendar className="w-3 h-3" />
            {formatFechaLimite(tarea.fecha_limite)}
          </span>
        )}
      </div>

      <div className="flex flex-wrap items-center gap-3 text-xs" style={{ color: 'var(--muted-foreground)' }}>
        {esAdmin && (
          <span className="inline-flex items-center gap-1">
            <span>Para:</span>
            <span style={{ color: 'var(--foreground)' }}>{tarea.asignado_nombre}</span>
          </span>
        )}
        {tarea.rancho_nombre && (
          <span className="inline-flex items-center gap-1">
            <MapPin className="w-3 h-3" />
            {tarea.rancho_nombre}
          </span>
        )}
        {tarea.modulo_nombre && (
          <span className="inline-flex items-center gap-1">
            <FileText className="w-3 h-3" />
            {tarea.modulo_nombre}
          </span>
        )}
      </div>
    </button>
  )
}

// ── FotoPreview ───────────────────────────────────────────────────────────────

interface FotoLocal {
  uid: string
  file: File
  preview: string
}

function FotoMiniaturas({
  fotos,
  onRemove,
}: {
  fotos: FotoLocal[]
  onRemove: (uid: string) => void
}) {
  if (fotos.length === 0) return null
  return (
    <div className="flex flex-wrap gap-2">
      {fotos.map(f => (
        <div key={f.uid} className="relative w-16 h-16 rounded-lg overflow-hidden border border-border">
          <img src={f.preview} alt="" className="w-full h-full object-cover" />
          <button
            type="button"
            onClick={() => onRemove(f.uid)}
            className="absolute top-0.5 right-0.5 w-5 h-5 rounded-full flex items-center justify-center"
            style={{ backgroundColor: 'var(--agro-red)', color: 'var(--primary-foreground)' }}
            aria-label="Quitar foto"
          >
            <Trash2 className="w-3 h-3" />
          </button>
        </div>
      ))}
    </div>
  )
}

// ── DetalleSheet ──────────────────────────────────────────────────────────────

function DetalleSheet({
  tareaId,
  esAdmin,
  orgId,
  onClose,
  onRefresh,
  hook,
  ranchosSelect,
  modulosSelect,
}: {
  tareaId: string
  esAdmin: boolean
  orgId: string
  onClose: () => void
  onRefresh: () => void
  hook: ReturnType<typeof useAgendaTareas>
  ranchosSelect: { id: string; nombre: string }[]
  modulosSelect: { codigo: string; nombre: string }[]
}) {
  const navigate = useNavigate()
  const [det, setDet] = useState<TareaDetalle | null>(null)
  const [cargando, setCargando] = useState(true)
  const [signedUrls, setSignedUrls] = useState<Record<string, string>>({})

  // Acción activa: 'iniciar'|'reportar'|'aprobar'|'regresar'|'cancelar'|'editar'|null
  const [accion, setAccion] = useState<string | null>(null)
  const [guardando, setGuardando] = useState(false)

  // Formulario de reportar
  const [reportarNota, setReportarNota] = useState('')
  const [fotosLocales, setFotosLocales] = useState<FotoLocal[]>([])
  const fotoInputRef = useRef<HTMLInputElement>(null)

  // Formularios simples
  const [aprobarNota, setAprobarNota] = useState('')
  const [regresarMotivo, setRegresarMotivo] = useState('')
  const [cancelarMotivo, setCancelarMotivo] = useState('')
  const [cancelarConfirm, setCancelarConfirm] = useState(false)

  // Formulario editar (mismos campos que crear)
  const [editForm, setEditForm] = useState({
    titulo: '', descripcion: '', prioridad: '' as PrioridadTarea | '',
    fecha_limite: '', asignado_a: '',
  })

  const cargarDetalle = useCallback(async () => {
    setCargando(true)
    const d = await hook.detalle(tareaId)
    setDet(d)
    if (d) {
      const paths = d.evidencias.map(e => e.storage_path)
      if (paths.length > 0) {
        try {
          const urls = await getSignedUrlsEvidencia(paths, 3600)
          setSignedUrls(urls)
        } catch (e) {
          console.error('[DetalleSheet] signed urls', e)
        }
      }
      setEditForm({
        titulo: d.tarea.titulo,
        descripcion: d.tarea.descripcion ?? '',
        prioridad: d.tarea.prioridad,
        fecha_limite: d.tarea.fecha_limite ?? '',
        asignado_a: d.tarea.asignado_a,
      })
    }
    setCargando(false)
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [tareaId])

  useEffect(() => {
    cargarDetalle()
  }, [cargarDetalle])

  async function agregarFoto(e: React.ChangeEvent<HTMLInputElement>) {
    const files = Array.from(e.target.files ?? [])
    e.target.value = ''
    for (const raw of files) {
      if (!raw.type.startsWith('image/')) { toast.warning('Solo se permiten imágenes'); continue }
      if (raw.size > 10 * 1024 * 1024) { toast.warning('La imagen supera 10 MB'); continue }
      const compressed = await comprimirImagen(raw, 9.5)
      const uid = crypto.randomUUID()
      const preview = URL.createObjectURL(compressed)
      setFotosLocales(prev => [...prev, { uid, file: compressed, preview }])
    }
  }

  function quitarFoto(uid: string) {
    setFotosLocales(prev => {
      const f = prev.find(x => x.uid === uid)
      if (f) URL.revokeObjectURL(f.preview)
      return prev.filter(x => x.uid !== uid)
    })
  }

  async function handleIniciar() {
    setGuardando(true)
    const res = await hook.iniciar(tareaId)
    setGuardando(false)
    if (!res.ok) { toast.error(res.mensaje ?? 'Error al iniciar'); return }
    toast.success('Tarea iniciada')
    setAccion(null)
    onRefresh()
    cargarDetalle()
  }

  async function handleReportar() {
    if (!reportarNota.trim() && fotosLocales.length === 0) {
      toast.warning('Agrega una nota o al menos una foto')
      return
    }
    setGuardando(true)
    const paths: string[] = []
    for (const f of fotosLocales) {
      const path = `${orgId}/${tareaId}/${crypto.randomUUID()}.jpg`
      try {
        await subirEvidencia(path, f.file)
        paths.push(path)
      } catch (e) {
        console.error('[DetalleSheet] subirEvidencia', e)
        toast.error('Error al subir una foto. Intenta de nuevo.')
        setGuardando(false)
        return
      }
    }
    const res = await hook.reportar(tareaId, reportarNota.trim() || null, paths)
    setGuardando(false)
    if (!res.ok) { toast.error(res.mensaje ?? 'Error al reportar'); return }
    toast.success('Tarea reportada como realizada')
    setAccion(null)
    setReportarNota('')
    setFotosLocales([])
    onRefresh()
    cargarDetalle()
  }

  async function handleAprobar() {
    setGuardando(true)
    const res = await hook.aprobar(tareaId, aprobarNota.trim() || undefined)
    setGuardando(false)
    if (!res.ok) { toast.error(res.mensaje ?? 'Error al aprobar'); return }
    toast.success('Tarea aprobada y cerrada')
    setAccion(null)
    setAprobarNota('')
    onRefresh()
    cargarDetalle()
  }

  async function handleRegresar() {
    if (!regresarMotivo.trim()) { toast.warning('El motivo es obligatorio'); return }
    setGuardando(true)
    const res = await hook.regresar(tareaId, regresarMotivo.trim())
    setGuardando(false)
    if (!res.ok) { toast.error(res.mensaje ?? 'Error al regresar'); return }
    toast.success('Tarea regresada al colaborador')
    setAccion(null)
    setRegresarMotivo('')
    onRefresh()
    cargarDetalle()
  }

  async function handleCancelar() {
    if (!cancelarMotivo.trim()) { toast.warning('El motivo es obligatorio'); return }
    setGuardando(true)
    const res = await hook.cancelar(tareaId, cancelarMotivo.trim())
    setGuardando(false)
    if (!res.ok) { toast.error(res.mensaje ?? 'Error al cancelar'); return }
    toast.success('Tarea cancelada')
    setAccion(null)
    setCancelarMotivo('')
    setCancelarConfirm(false)
    onRefresh()
    onClose()
  }

  async function handleEditar() {
    if (!editForm.titulo.trim()) { toast.warning('El título es obligatorio'); return }
    const cambios: Record<string, unknown> = {}
    const t = det!.tarea
    if (editForm.titulo.trim() !== t.titulo) cambios.titulo = editForm.titulo.trim()
    if (editForm.descripcion !== (t.descripcion ?? '')) cambios.descripcion = editForm.descripcion || null
    if (editForm.prioridad && editForm.prioridad !== t.prioridad) cambios.prioridad = editForm.prioridad
    if (editForm.fecha_limite !== (t.fecha_limite ?? '')) cambios.fecha_limite = editForm.fecha_limite || null
    if (editForm.asignado_a !== t.asignado_a) cambios.asignado_a = editForm.asignado_a
    if (Object.keys(cambios).length === 0) { setAccion(null); return }
    setGuardando(true)
    const res = await hook.editar(tareaId, cambios)
    setGuardando(false)
    if (!res.ok) { toast.error(res.mensaje ?? 'Error al editar'); return }
    toast.success('Tarea actualizada')
    setAccion(null)
    onRefresh()
    cargarDetalle()
  }

  const inputSt: React.CSSProperties = {
    backgroundColor: 'var(--input-background)',
    border: '1px solid var(--border)',
    color: 'var(--foreground)',
    borderRadius: '0.5rem',
    padding: '0.5rem 0.75rem',
    fontSize: '0.875rem',
    width: '100%',
    outline: 'none',
  }

  if (cargando) {
    return (
      <div className="flex items-center justify-center py-16">
        <Loader2 className="w-6 h-6 animate-spin" style={{ color: 'var(--primary)' }} />
      </div>
    )
  }

  if (!det) {
    return (
      <div className="px-4 py-8 text-center">
        <p className="text-sm" style={{ color: 'var(--muted-foreground)' }}>No se pudo cargar el detalle.</p>
      </div>
    )
  }

  const { tarea, eventos, evidencias } = det
  const soloLectura = tarea.estado === 'cerrada' || tarea.estado === 'cancelada'

  return (
    <div className="flex flex-col h-full overflow-y-auto">
      {/* Header */}
      <div className="px-4 pt-2 pb-3 border-b border-border flex-shrink-0">
        <div className="flex items-start justify-between gap-2 mb-2">
          <p className="text-base font-semibold leading-tight" style={{ color: 'var(--foreground)' }}>
            {tarea.titulo}
          </p>
          <ChipPrioridad prioridad={tarea.prioridad} />
        </div>
        <div className="flex flex-wrap gap-2 items-center">
          <ChipEstado estado={tarea.estado} vencida={tarea.vencida} />
          {tarea.regresada && (
            <span
              className="inline-flex items-center gap-1 text-xs font-semibold px-2 py-0.5 rounded-full"
              style={{ backgroundColor: 'var(--agro-warning-fill)', color: 'var(--agro-warning-text)' }}
            >
              <RotateCcw className="w-3 h-3" /> Regresada
            </span>
          )}
        </div>
      </div>

      <div className="flex-1 overflow-y-auto px-4 py-4 space-y-4">

        {/* Motivo de regreso */}
        {tarea.regresada && tarea.motivo_regreso && (
          <div
            className="rounded-lg p-3 text-sm"
            style={{ backgroundColor: 'var(--agro-warning-fill)', color: 'var(--agro-warning-text)' }}
          >
            <p className="font-semibold mb-0.5">Motivo de regreso</p>
            <p>{tarea.motivo_regreso}</p>
          </div>
        )}

        {/* Descripción */}
        {tarea.descripcion && (
          <div>
            <p className="text-xs font-semibold mb-1" style={{ color: 'var(--muted-foreground)' }}>Descripción</p>
            <p className="text-sm" style={{ color: 'var(--foreground)' }}>{tarea.descripcion}</p>
          </div>
        )}

        {/* Meta */}
        <div className="grid grid-cols-2 gap-3 text-xs">
          <div>
            <p style={{ color: 'var(--muted-foreground)' }}>Asignada a</p>
            <p className="font-semibold mt-0.5" style={{ color: 'var(--foreground)' }}>{tarea.asignado_nombre}</p>
          </div>
          <div>
            <p style={{ color: 'var(--muted-foreground)' }}>Creada por</p>
            <p className="font-semibold mt-0.5" style={{ color: 'var(--foreground)' }}>{tarea.creador_nombre}</p>
          </div>
          {tarea.fecha_limite && (
            <div>
              <p style={{ color: 'var(--muted-foreground)' }}>Fecha límite</p>
              <p
                className="font-semibold mt-0.5"
                style={{ color: tarea.vencida ? 'var(--agro-danger-text)' : 'var(--foreground)' }}
              >
                {formatFechaLimite(tarea.fecha_limite)}
                {tarea.vencida && ' · Vencida'}
              </p>
            </div>
          )}
          {tarea.rancho_nombre && (
            <div>
              <p style={{ color: 'var(--muted-foreground)' }}>Sitio</p>
              <p className="font-semibold mt-0.5" style={{ color: 'var(--foreground)' }}>{tarea.rancho_nombre}</p>
            </div>
          )}
        </div>

        {/* Botón ir al formato */}
        {tarea.modulo_ruta && (
          <button
            onClick={() => { onClose(); navigate(tarea.modulo_ruta!) }}
            className="w-full h-9 rounded-lg text-sm flex items-center justify-center gap-2 border border-border transition-colors hover:bg-muted"
            style={{ color: 'var(--primary)', fontWeight: 600 }}
          >
            <ExternalLink className="w-4 h-4" />
            Ir a {tarea.modulo_nombre ?? 'el formato'}
          </button>
        )}

        {/* Evidencias */}
        {evidencias.length > 0 && (
          <div>
            <p className="text-xs font-semibold mb-2" style={{ color: 'var(--muted-foreground)' }}>
              Evidencias ({evidencias.length})
            </p>
            <div className="flex flex-wrap gap-2">
              {evidencias.map(ev => {
                const url = signedUrls[ev.storage_path]
                return (
                  <div key={ev.storage_path} className="w-16 h-16 rounded-lg border border-border overflow-hidden bg-muted flex items-center justify-center">
                    {url ? (
                      <a href={url} target="_blank" rel="noopener noreferrer">
                        <img src={url} alt="" className="w-full h-full object-cover" />
                      </a>
                    ) : (
                      <Image className="w-5 h-5" style={{ color: 'var(--muted-foreground)' }} />
                    )}
                  </div>
                )
              })}
            </div>
          </div>
        )}

        {/* ── Acciones según rol y estado ── */}
        {!soloLectura && (
          <div className="space-y-3">

            {/* Colaborador + pendiente → Iniciar y/o Reportar */}
            {!esAdmin && tarea.estado === 'pendiente' && accion !== 'reportar' && (
              <div className="flex gap-2">
                <button
                  onClick={() => !guardando && handleIniciar()}
                  disabled={guardando}
                  className="flex-1 h-10 rounded-lg text-sm font-semibold flex items-center justify-center gap-2 border border-border transition-colors hover:bg-muted disabled:opacity-50"
                  style={{ color: 'var(--foreground)' }}
                >
                  {guardando ? <Loader2 className="w-4 h-4 animate-spin" /> : <Clock className="w-4 h-4" />}
                  Iniciar
                </button>
                <button
                  onClick={() => setAccion('reportar')}
                  className="flex-1 h-10 rounded-lg text-sm font-semibold flex items-center justify-center gap-2 transition-colors"
                  style={{ backgroundColor: 'var(--primary)', color: 'var(--primary-foreground)' }}
                >
                  <CheckCircle2 className="w-4 h-4" />
                  Reportar
                </button>
              </div>
            )}

            {/* Colaborador + en_progreso → Reportar */}
            {!esAdmin && tarea.estado === 'en_progreso' && accion !== 'reportar' && (
              <button
                onClick={() => setAccion('reportar')}
                className="w-full h-10 rounded-lg text-sm font-semibold flex items-center justify-center gap-2 transition-colors"
                style={{ backgroundColor: 'var(--primary)', color: 'var(--primary-foreground)' }}
              >
                <CheckCircle2 className="w-4 h-4" />
                Reportar como realizada
              </button>
            )}

            {/* Formulario reportar */}
            {!esAdmin && accion === 'reportar' && (
              <div className="space-y-3 rounded-xl border border-border p-4">
                <p className="text-sm font-semibold" style={{ color: 'var(--foreground)' }}>
                  Reportar como realizada
                </p>
                <div>
                  <label className="text-xs" style={{ color: 'var(--muted-foreground)' }}>
                    Nota <span style={{ color: 'var(--muted-foreground)' }}>(opcional si hay foto)</span>
                  </label>
                  <textarea
                    value={reportarNota}
                    onChange={e => setReportarNota(e.target.value)}
                    rows={3}
                    placeholder="Describe lo que realizaste..."
                    style={{ ...inputSt, marginTop: '0.25rem', resize: 'none' }}
                  />
                </div>
                <FotoMiniaturas fotos={fotosLocales} onRemove={quitarFoto} />
                <div className="flex gap-2">
                  <button
                    type="button"
                    onClick={() => fotoInputRef.current?.click()}
                    className="flex-1 h-9 rounded-lg text-xs font-semibold flex items-center justify-center gap-1.5 border border-border transition-colors hover:bg-muted"
                    style={{ color: 'var(--foreground)' }}
                  >
                    <Camera className="w-4 h-4" />
                    Agregar foto
                  </button>
                  <input
                    ref={fotoInputRef}
                    type="file"
                    accept="image/*"
                    capture="environment"
                    multiple
                    className="hidden"
                    onChange={agregarFoto}
                  />
                </div>
                <div className="flex gap-2">
                  <button
                    onClick={() => { setAccion(null); setReportarNota(''); setFotosLocales([]) }}
                    className="flex-1 h-10 rounded-lg text-sm border border-border transition-colors hover:bg-muted"
                    style={{ color: 'var(--foreground)' }}
                  >
                    Cancelar
                  </button>
                  <button
                    onClick={handleReportar}
                    disabled={guardando || (!reportarNota.trim() && fotosLocales.length === 0)}
                    className="flex-1 h-10 rounded-lg text-sm font-semibold transition-colors disabled:opacity-40"
                    style={{ backgroundColor: 'var(--primary)', color: 'var(--primary-foreground)' }}
                  >
                    {guardando ? <Loader2 className="w-4 h-4 animate-spin mx-auto" /> : 'Confirmar'}
                  </button>
                </div>
              </div>
            )}

            {/* Admin + por_verificar → Aprobar y Regresar */}
            {esAdmin && tarea.estado === 'por_verificar' && accion === null && (
              <div className="flex gap-2">
                <button
                  onClick={() => setAccion('regresar')}
                  className="flex-1 h-10 rounded-lg text-sm font-semibold flex items-center justify-center gap-1.5 border border-border transition-colors hover:bg-muted"
                  style={{ color: 'var(--agro-warning-text)' }}
                >
                  <RotateCcw className="w-4 h-4" />
                  Regresar
                </button>
                <button
                  onClick={() => setAccion('aprobar')}
                  className="flex-1 h-10 rounded-lg text-sm font-semibold flex items-center justify-center gap-1.5 transition-colors"
                  style={{ backgroundColor: 'var(--primary)', color: 'var(--primary-foreground)' }}
                >
                  <CheckCircle2 className="w-4 h-4" />
                  Aprobar
                </button>
              </div>
            )}

            {esAdmin && accion === 'aprobar' && (
              <div className="space-y-3 rounded-xl border border-border p-4">
                <p className="text-sm font-semibold" style={{ color: 'var(--foreground)' }}>Aprobar tarea</p>
                <div>
                  <label className="text-xs" style={{ color: 'var(--muted-foreground)' }}>Nota (opcional)</label>
                  <textarea
                    value={aprobarNota}
                    onChange={e => setAprobarNota(e.target.value)}
                    rows={2}
                    placeholder="Comentario de cierre..."
                    style={{ ...inputSt, marginTop: '0.25rem', resize: 'none' }}
                  />
                </div>
                <div className="flex gap-2">
                  <button onClick={() => { setAccion(null); setAprobarNota('') }} className="flex-1 h-10 rounded-lg text-sm border border-border hover:bg-muted" style={{ color: 'var(--foreground)' }}>
                    Cancelar
                  </button>
                  <button
                    onClick={handleAprobar}
                    disabled={guardando}
                    className="flex-1 h-10 rounded-lg text-sm font-semibold disabled:opacity-40"
                    style={{ backgroundColor: 'var(--primary)', color: 'var(--primary-foreground)' }}
                  >
                    {guardando ? <Loader2 className="w-4 h-4 animate-spin mx-auto" /> : 'Confirmar'}
                  </button>
                </div>
              </div>
            )}

            {esAdmin && accion === 'regresar' && (
              <div className="space-y-3 rounded-xl border border-border p-4">
                <p className="text-sm font-semibold" style={{ color: 'var(--foreground)' }}>Regresar tarea</p>
                <div>
                  <label className="text-xs" style={{ color: 'var(--muted-foreground)' }}>Motivo <span style={{ color: 'var(--agro-danger-text)' }}>*</span></label>
                  <textarea
                    value={regresarMotivo}
                    onChange={e => setRegresarMotivo(e.target.value)}
                    rows={2}
                    placeholder="¿Qué falta para aprobar?"
                    style={{ ...inputSt, marginTop: '0.25rem', resize: 'none' }}
                  />
                </div>
                <div className="flex gap-2">
                  <button onClick={() => { setAccion(null); setRegresarMotivo('') }} className="flex-1 h-10 rounded-lg text-sm border border-border hover:bg-muted" style={{ color: 'var(--foreground)' }}>
                    Cancelar
                  </button>
                  <button
                    onClick={handleRegresar}
                    disabled={guardando || !regresarMotivo.trim()}
                    className="flex-1 h-10 rounded-lg text-sm font-semibold disabled:opacity-40"
                    style={{ backgroundColor: 'var(--agro-warning-fill)', color: 'var(--agro-warning-text)' }}
                  >
                    {guardando ? <Loader2 className="w-4 h-4 animate-spin mx-auto" /> : 'Regresar'}
                  </button>
                </div>
              </div>
            )}

            {/* Admin + abierta → Editar y Cancelar */}
            {esAdmin && (tarea.estado === 'pendiente' || tarea.estado === 'en_progreso') && accion === null && (
              <div className="flex gap-2">
                <button
                  onClick={() => setAccion('editar')}
                  className="flex-1 h-10 rounded-lg text-sm font-semibold border border-border transition-colors hover:bg-muted"
                  style={{ color: 'var(--foreground)' }}
                >
                  Editar
                </button>
                <button
                  onClick={() => { setAccion('cancelar'); setCancelarConfirm(false) }}
                  className="flex-1 h-10 rounded-lg text-sm font-semibold border transition-colors hover:bg-muted"
                  style={{ borderColor: 'var(--agro-red)', color: 'var(--agro-danger-text)' }}
                >
                  <XCircle className="w-4 h-4 inline mr-1" />
                  Cancelar tarea
                </button>
              </div>
            )}

            {esAdmin && accion === 'editar' && (
              <EditarForm
                form={editForm}
                onChange={setEditForm}
                colaboradores={hook.colaboradores}
                ranchos={ranchosSelect}
                modulos={modulosSelect}
                onCancel={() => setAccion(null)}
                onSave={handleEditar}
                guardando={guardando}
              />
            )}

            {esAdmin && accion === 'cancelar' && (
              <div className="space-y-3 rounded-xl border p-4" style={{ borderColor: 'var(--agro-red)' }}>
                <p className="text-sm font-semibold" style={{ color: 'var(--agro-danger-text)' }}>Cancelar tarea</p>
                {!cancelarConfirm ? (
                  <>
                    <p className="text-xs" style={{ color: 'var(--muted-foreground)' }}>
                      Esta acción no se puede deshacer. ¿Estás seguro?
                    </p>
                    <div className="flex gap-2">
                      <button onClick={() => setAccion(null)} className="flex-1 h-10 rounded-lg text-sm border border-border hover:bg-muted" style={{ color: 'var(--foreground)' }}>
                        No, volver
                      </button>
                      <button
                        onClick={() => setCancelarConfirm(true)}
                        className="flex-1 h-10 rounded-lg text-sm font-semibold"
                        style={{ backgroundColor: 'var(--agro-danger-fill)', color: 'var(--agro-danger-text)' }}
                      >
                        Sí, cancelar
                      </button>
                    </div>
                  </>
                ) : (
                  <>
                    <div>
                      <label className="text-xs" style={{ color: 'var(--muted-foreground)' }}>Motivo <span style={{ color: 'var(--agro-danger-text)' }}>*</span></label>
                      <textarea
                        value={cancelarMotivo}
                        onChange={e => setCancelarMotivo(e.target.value)}
                        rows={2}
                        placeholder="¿Por qué se cancela?"
                        style={{ ...inputSt, marginTop: '0.25rem', resize: 'none' }}
                      />
                    </div>
                    <div className="flex gap-2">
                      <button onClick={() => { setAccion(null); setCancelarMotivo(''); setCancelarConfirm(false) }} className="flex-1 h-10 rounded-lg text-sm border border-border hover:bg-muted" style={{ color: 'var(--foreground)' }}>
                        Cancelar
                      </button>
                      <button
                        onClick={handleCancelar}
                        disabled={guardando || !cancelarMotivo.trim()}
                        className="flex-1 h-10 rounded-lg text-sm font-semibold disabled:opacity-40"
                        style={{ backgroundColor: 'var(--agro-red)', color: 'var(--primary-foreground)' }}
                      >
                        {guardando ? <Loader2 className="w-4 h-4 animate-spin mx-auto" /> : 'Confirmar cancelación'}
                      </button>
                    </div>
                  </>
                )}
              </div>
            )}
          </div>
        )}

        {/* Historial de eventos */}
        {eventos.length > 0 && (
          <div>
            <p className="text-xs font-semibold mb-2" style={{ color: 'var(--muted-foreground)' }}>Historial</p>
            <div className="space-y-2">
              {eventos.map((ev, i) => (
                <div key={i} className="flex gap-3">
                  <div className="flex flex-col items-center">
                    <div className="w-2 h-2 rounded-full mt-1.5 flex-shrink-0" style={{ backgroundColor: 'var(--border)' }} />
                    {i < eventos.length - 1 && <div className="w-px flex-1 mt-1" style={{ backgroundColor: 'var(--border)' }} />}
                  </div>
                  <div className="pb-3 flex-1">
                    <p className="text-xs font-semibold" style={{ color: 'var(--foreground)' }}>
                      {EVENTO_LABELS[ev.tipo] ?? ev.tipo}
                      <span className="font-normal ml-1.5" style={{ color: 'var(--muted-foreground)' }}>
                        por {ev.actor}
                      </span>
                    </p>
                    {ev.nota && (
                      <p className="text-xs mt-0.5" style={{ color: 'var(--muted-foreground)' }}>{ev.nota}</p>
                    )}
                    <p className="text-[10px] mt-0.5" style={{ color: 'var(--muted-foreground)' }}>
                      {formatFechaCorta(ev.fecha)}
                    </p>
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}
      </div>
    </div>
  )
}

// ── EditarForm / NuevaTareaForm ───────────────────────────────────────────────

interface TareaFormState {
  titulo: string
  descripcion: string
  prioridad: PrioridadTarea | ''
  fecha_limite: string
  asignado_a: string
  rancho_id?: string
  modulo_codigo?: string
}

function EditarForm({
  form,
  onChange,
  colaboradores,
  ranchos,
  modulos,
  onCancel,
  onSave,
  guardando,
}: {
  form: TareaFormState
  onChange: (f: TareaFormState) => void
  colaboradores: { id: string; nombre: string }[]
  ranchos: { id: string; nombre: string }[]
  modulos: { codigo: string; nombre: string }[]
  onCancel: () => void
  onSave: () => void
  guardando: boolean
}) {
  const inputSt: React.CSSProperties = {
    backgroundColor: 'var(--input-background)',
    border: '1px solid var(--border)',
    color: 'var(--foreground)',
    borderRadius: '0.5rem',
    padding: '0.5rem 0.75rem',
    fontSize: '0.875rem',
    width: '100%',
    outline: 'none',
  }
  return (
    <div className="space-y-3 rounded-xl border border-border p-4">
      <p className="text-sm font-semibold" style={{ color: 'var(--foreground)' }}>Editar tarea</p>

      <div>
        <label className="text-xs" style={{ color: 'var(--muted-foreground)' }}>Título *</label>
        <input
          type="text"
          value={form.titulo}
          onChange={e => onChange({ ...form, titulo: e.target.value })}
          style={{ ...inputSt, marginTop: '0.25rem' }}
          placeholder="Título de la tarea"
        />
      </div>
      <div>
        <label className="text-xs" style={{ color: 'var(--muted-foreground)' }}>Descripción</label>
        <textarea
          value={form.descripcion}
          onChange={e => onChange({ ...form, descripcion: e.target.value })}
          rows={2}
          style={{ ...inputSt, marginTop: '0.25rem', resize: 'none' }}
          placeholder="Detalles adicionales"
        />
      </div>
      <div>
        <label className="text-xs" style={{ color: 'var(--muted-foreground)' }}>Prioridad</label>
        <select
          value={form.prioridad}
          onChange={e => onChange({ ...form, prioridad: e.target.value as PrioridadTarea })}
          style={{ ...inputSt, marginTop: '0.25rem' }}
        >
          <option value="">Seleccionar...</option>
          <option value="alta">Alta</option>
          <option value="media">Media</option>
          <option value="baja">Baja</option>
        </select>
      </div>
      {colaboradores.length > 0 && (
        <div>
          <label className="text-xs" style={{ color: 'var(--muted-foreground)' }}>Asignada a *</label>
          <select
            value={form.asignado_a}
            onChange={e => onChange({ ...form, asignado_a: e.target.value })}
            style={{ ...inputSt, marginTop: '0.25rem' }}
          >
            <option value="">Seleccionar...</option>
            {colaboradores.map(c => (
              <option key={c.id} value={c.id}>{c.nombre}</option>
            ))}
          </select>
        </div>
      )}
      <div>
        <label className="text-xs" style={{ color: 'var(--muted-foreground)' }}>Fecha límite</label>
        <input
          type="date"
          value={form.fecha_limite}
          onChange={e => onChange({ ...form, fecha_limite: e.target.value })}
          style={{ ...inputSt, marginTop: '0.25rem' }}
        />
      </div>
      {ranchos.length > 0 && (
        <div>
          <label className="text-xs" style={{ color: 'var(--muted-foreground)' }}>Sitio</label>
          <select
            value={form.rancho_id ?? ''}
            onChange={e => onChange({ ...form, rancho_id: e.target.value || undefined })}
            style={{ ...inputSt, marginTop: '0.25rem' }}
          >
            <option value="">Sin sitio</option>
            {ranchos.map(r => (
              <option key={r.id} value={r.id}>{r.nombre}</option>
            ))}
          </select>
        </div>
      )}
      {modulos.length > 0 && (
        <div>
          <label className="text-xs" style={{ color: 'var(--muted-foreground)' }}>Formato / módulo</label>
          <select
            value={form.modulo_codigo ?? ''}
            onChange={e => onChange({ ...form, modulo_codigo: e.target.value || undefined })}
            style={{ ...inputSt, marginTop: '0.25rem' }}
          >
            <option value="">Sin formato</option>
            {modulos.map(m => (
              <option key={m.codigo} value={m.codigo}>{m.nombre}</option>
            ))}
          </select>
        </div>
      )}
      <div className="flex gap-2 pt-1">
        <button
          onClick={onCancel}
          className="flex-1 h-10 rounded-lg text-sm border border-border hover:bg-muted transition-colors"
          style={{ color: 'var(--foreground)' }}
        >
          Cancelar
        </button>
        <button
          onClick={onSave}
          disabled={guardando || !form.titulo.trim()}
          className="flex-1 h-10 rounded-lg text-sm font-semibold disabled:opacity-40 transition-colors"
          style={{ backgroundColor: 'var(--primary)', color: 'var(--primary-foreground)' }}
        >
          {guardando ? <Loader2 className="w-4 h-4 animate-spin mx-auto" /> : 'Guardar'}
        </button>
      </div>
    </div>
  )
}

// ── Pantalla principal ────────────────────────────────────────────────────────

export function AgendaTareas() {
  const navigate = useNavigate()
  const [searchParams, setSearchParams] = useSearchParams()
  const { profile } = useAuthContext()
  const { modulos, terminosSitio } = useModulosContext()
  const { ranchos } = useRanchos()
  const hook = useAgendaTareas()

  const esAdmin = profile?.rol === 'admin_org' || profile?.rol === 'super_admin'

  // Estado de UI
  const [tabAdmin, setTabAdmin] = useState<'verificar' | 'abiertas' | 'cerradas' | 'canceladas'>('verificar')
  const [filtroColaborador, setFiltroColaborador] = useState('')
  const [cerradasAbiertas, setCerradasAbiertas] = useState(false)
  const [canceladasAbiertas, setCanceladasAbiertas] = useState(false)
  const [terminadasAbiertas, setTerminadasAbiertas] = useState(false)

  // Sheet nueva tarea
  const [sheetNueva, setSheetNueva] = useState(false)
  const [nuevaForm, setNuevaForm] = useState<TareaFormState>({
    titulo: '', descripcion: '', prioridad: 'media', fecha_limite: '',
    asignado_a: '', rancho_id: '', modulo_codigo: '',
  })
  const [guardandoNueva, setGuardandoNueva] = useState(false)

  // Sheet detalle
  const tareaParam = searchParams.get('tarea')
  const [tareaSeleccionada, setTareaSeleccionada] = useState<string | null>(tareaParam)

  useEffect(() => {
    if (tareaParam) setTareaSeleccionada(tareaParam)
  }, [tareaParam])

  function abrirDetalle(id: string) {
    setTareaSeleccionada(id)
    setSearchParams({ tarea: id }, { replace: true })
  }

  function cerrarDetalle() {
    setTareaSeleccionada(null)
    setSearchParams({}, { replace: true })
  }

  // Módulos disponibles para el select (excluir M79 agenda)
  const modulosSelect = modulos
    .filter(m => m.mostrar_en_menu && m.clave !== 'agenda_tareas')
    .map(m => ({ codigo: m.codigo, nombre: m.nombre }))

  const ranchosSelect = ranchos.map(r => ({ id: r.id, nombre: r.nombre }))

  useEffect(() => {
    hook.cargarResumen()
    if (esAdmin) hook.cargarColaboradores()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [esAdmin])

  useEffect(() => {
    const filtros = esAdmin && filtroColaborador ? { asignado: filtroColaborador } : undefined
    hook.listar(filtros)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [esAdmin, filtroColaborador])

  function refrescar() {
    const filtros = esAdmin && filtroColaborador ? { asignado: filtroColaborador } : undefined
    hook.listar(filtros)
    hook.cargarResumen()
  }

  async function handleCrearTarea() {
    if (!nuevaForm.titulo.trim()) { toast.warning('El título es obligatorio'); return }
    if (!nuevaForm.asignado_a) { toast.warning('Selecciona a quién asignar la tarea'); return }
    setGuardandoNueva(true)
    const res = await hook.crear({
      titulo: nuevaForm.titulo.trim(),
      asignado_a: nuevaForm.asignado_a,
      descripcion: nuevaForm.descripcion || undefined,
      prioridad: (nuevaForm.prioridad as PrioridadTarea) || 'media',
      fecha_limite: nuevaForm.fecha_limite || undefined,
      rancho_id: nuevaForm.rancho_id || undefined,
      modulo_codigo: nuevaForm.modulo_codigo || undefined,
    })
    setGuardandoNueva(false)
    if (!res.ok) { toast.error(res.mensaje ?? 'Error al crear la tarea'); return }
    toast.success('Tarea creada')
    setSheetNueva(false)
    setNuevaForm({ titulo: '', descripcion: '', prioridad: 'media', fecha_limite: '', asignado_a: '', rancho_id: '', modulo_codigo: '' })
    refrescar()
  }

  // ── Distribución de tareas ──
  const { resumen } = hook

  const misPendientes = hook.tareas.filter(t => t.estado === 'pendiente' || t.estado === 'en_progreso')
  const misRevisión   = hook.tareas.filter(t => t.estado === 'por_verificar')
  const misTerminadas = hook.tareas.filter(t => t.estado === 'cerrada')

  const adminVerificar  = hook.tareas.filter(t => t.estado === 'por_verificar')
  const adminAbiertas   = hook.tareas.filter(t => t.estado === 'pendiente' || t.estado === 'en_progreso')
  const adminCerradas   = hook.tareas.filter(t => t.estado === 'cerrada')
  const adminCanceladas = hook.tareas.filter(t => t.estado === 'cancelada')

  const tareasTab = tabAdmin === 'verificar' ? adminVerificar
    : tabAdmin === 'abiertas' ? adminAbiertas
    : tabAdmin === 'cerradas' ? adminCerradas
    : adminCanceladas

  const terminoSingular = terminosSitio?.singular ?? 'Rancho'

  // ── Render ──
  return (
    <div className="min-h-full pb-safe-nav">
      {/* Header */}
      <header className="bg-card border-b border-border px-4 py-4">
        <div className="flex items-center gap-3">
          <button
            onClick={() => navigate('/')}
            className="p-1 md:hidden"
            aria-label="Volver"
          >
            <ChevronLeft className="w-6 h-6 text-foreground" />
          </button>
          <h1 className="text-foreground" style={{ fontWeight: 600 }}>Agenda</h1>
        </div>
      </header>

      <div className="p-4 space-y-4 max-w-[390px] mx-auto md:max-w-2xl">

        {hook.loading && !hook.tareas.length ? (
          <div className="flex items-center justify-center py-16">
            <Loader2 className="w-6 h-6 animate-spin" style={{ color: 'var(--primary)' }} />
          </div>
        ) : esAdmin ? (
          /* ── VISTA ADMIN ── */
          <>
            {/* Resumen */}
            {resumen && (
              <div className="grid grid-cols-3 gap-2">
                <div
                  className="rounded-xl p-3 border flex flex-col items-center text-center"
                  style={{
                    borderColor: resumen.por_verificar ? 'var(--agro-amber)' : 'var(--border)',
                    backgroundColor: resumen.por_verificar ? 'var(--agro-warning-fill)' : 'var(--card)',
                  }}
                >
                  <span className="text-xl font-bold" style={{ color: resumen.por_verificar ? 'var(--agro-warning-text)' : 'var(--foreground)' }}>
                    {resumen.por_verificar ?? 0}
                  </span>
                  <span className="text-[10px] mt-0.5 leading-tight" style={{ color: resumen.por_verificar ? 'var(--agro-warning-text)' : 'var(--muted-foreground)' }}>
                    Por verificar
                  </span>
                </div>
                <div className="rounded-xl p-3 border border-border flex flex-col items-center text-center" style={{ backgroundColor: 'var(--card)' }}>
                  <span className="text-xl font-bold" style={{ color: 'var(--foreground)' }}>{resumen.abiertas_org ?? 0}</span>
                  <span className="text-[10px] mt-0.5 leading-tight" style={{ color: 'var(--muted-foreground)' }}>Abiertas</span>
                </div>
                <div
                  className="rounded-xl p-3 border flex flex-col items-center text-center"
                  style={{
                    borderColor: resumen.vencidas_org ? 'var(--agro-red)' : 'var(--border)',
                    backgroundColor: resumen.vencidas_org ? 'var(--agro-danger-fill)' : 'var(--card)',
                  }}
                >
                  <span className="text-xl font-bold" style={{ color: resumen.vencidas_org ? 'var(--agro-danger-text)' : 'var(--foreground)' }}>
                    {resumen.vencidas_org ?? 0}
                  </span>
                  <span className="text-[10px] mt-0.5 leading-tight" style={{ color: resumen.vencidas_org ? 'var(--agro-danger-text)' : 'var(--muted-foreground)' }}>
                    Vencidas
                  </span>
                </div>
              </div>
            )}

            {/* Filtro por colaborador */}
            {hook.colaboradores.length > 0 && (
              <select
                value={filtroColaborador}
                onChange={e => setFiltroColaborador(e.target.value)}
                className="w-full h-9 rounded-lg text-sm outline-none"
                style={{
                  backgroundColor: 'var(--input-background)',
                  border: '1px solid var(--border)',
                  color: 'var(--foreground)',
                  padding: '0 0.75rem',
                }}
              >
                <option value="">Todos los colaboradores</option>
                {hook.colaboradores.map(c => (
                  <option key={c.id} value={c.id}>{c.nombre}</option>
                ))}
              </select>
            )}

            {/* Pestañas */}
            <div className="flex gap-1 rounded-xl p-1 overflow-x-auto" style={{ backgroundColor: 'var(--muted)' }}>
              {([
                { key: 'verificar', label: `Verificar${adminVerificar.length > 0 ? ` (${adminVerificar.length})` : ''}` },
                { key: 'abiertas', label: 'Abiertas' },
                { key: 'cerradas', label: 'Cerradas' },
                { key: 'canceladas', label: 'Canceladas' },
              ] as const).map(t => (
                <button
                  key={t.key}
                  onClick={() => setTabAdmin(t.key)}
                  className="flex-1 min-w-0 text-xs font-semibold whitespace-nowrap rounded-lg py-1.5 px-2 transition-colors"
                  style={{
                    backgroundColor: tabAdmin === t.key ? 'var(--card)' : 'transparent',
                    color: tabAdmin === t.key ? 'var(--foreground)' : 'var(--muted-foreground)',
                  }}
                >
                  {t.label}
                </button>
              ))}
            </div>

            {/* Lista de tareas */}
            <div className="space-y-2">
              {tareasTab.length === 0 ? (
                <p className="text-sm text-center py-8" style={{ color: 'var(--muted-foreground)' }}>
                  Sin tareas
                </p>
              ) : (
                tareasTab.map(t => (
                  <TareaCard key={t.id} tarea={t} esAdmin={esAdmin} onClick={() => abrirDetalle(t.id)} />
                ))
              )}
            </div>
          </>
        ) : (
          /* ── VISTA COLABORADOR ── */
          <>
            {/* Chips resumen */}
            {resumen && (
              <div className="flex gap-2 flex-wrap">
                {resumen.mis_pendientes > 0 && (
                  <span className="inline-flex items-center gap-1 px-3 py-1.5 rounded-full text-xs font-semibold" style={{ backgroundColor: 'var(--agro-warning-fill)', color: 'var(--agro-warning-text)' }}>
                    {resumen.mis_pendientes} pendiente{resumen.mis_pendientes !== 1 ? 's' : ''}
                  </span>
                )}
                {resumen.mis_vencidas > 0 && (
                  <span className="inline-flex items-center gap-1 px-3 py-1.5 rounded-full text-xs font-semibold" style={{ backgroundColor: 'var(--agro-danger-fill)', color: 'var(--agro-danger-text)' }}>
                    <AlertTriangle className="w-3 h-3" />
                    {resumen.mis_vencidas} vencida{resumen.mis_vencidas !== 1 ? 's' : ''}
                  </span>
                )}
                {resumen.mis_regresadas > 0 && (
                  <span className="inline-flex items-center gap-1 px-3 py-1.5 rounded-full text-xs font-semibold" style={{ backgroundColor: 'var(--agro-warning-fill)', color: 'var(--agro-warning-text)' }}>
                    <RotateCcw className="w-3 h-3" />
                    {resumen.mis_regresadas} regresada{resumen.mis_regresadas !== 1 ? 's' : ''}
                  </span>
                )}
              </div>
            )}

            {/* Por hacer */}
            {misPendientes.length > 0 && (
              <div className="space-y-2">
                <p className="text-xs font-semibold px-1" style={{ color: 'var(--muted-foreground)' }}>Por hacer</p>
                {misPendientes.map(t => (
                  <TareaCard key={t.id} tarea={t} esAdmin={false} onClick={() => abrirDetalle(t.id)} />
                ))}
              </div>
            )}

            {/* En revisión */}
            {misRevisión.length > 0 && (
              <div className="space-y-2">
                <p className="text-xs font-semibold px-1" style={{ color: 'var(--muted-foreground)' }}>En revisión</p>
                {misRevisión.map(t => (
                  <TareaCard key={t.id} tarea={t} esAdmin={false} onClick={() => abrirDetalle(t.id)} />
                ))}
              </div>
            )}

            {/* Terminadas (plegado) */}
            {misTerminadas.length > 0 && (
              <div>
                <button
                  onClick={() => setTerminadasAbiertas(o => !o)}
                  className="flex items-center gap-2 px-1 py-1 text-xs font-semibold w-full"
                  style={{ color: 'var(--muted-foreground)' }}
                >
                  {terminadasAbiertas ? <ChevronUp className="w-4 h-4" /> : <ChevronDown className="w-4 h-4" />}
                  Terminadas ({misTerminadas.length})
                </button>
                {terminadasAbiertas && (
                  <div className="space-y-2 mt-2">
                    {misTerminadas.map(t => (
                      <TareaCard key={t.id} tarea={t} esAdmin={false} onClick={() => abrirDetalle(t.id)} />
                    ))}
                  </div>
                )}
              </div>
            )}

            {misPendientes.length === 0 && misRevisión.length === 0 && misTerminadas.length === 0 && (
              <p className="text-sm text-center py-10" style={{ color: 'var(--muted-foreground)' }}>
                No tienes tareas asignadas
              </p>
            )}
          </>
        )}
      </div>

      {/* FAB (solo admin) */}
      {esAdmin && (
        <button
          onClick={() => { setSheetNueva(true); hook.cargarColaboradores() }}
          className="fixed bottom-safe-fab right-4 w-14 h-14 rounded-full flex items-center justify-center z-40 transition-transform active:scale-95"
          style={{ backgroundColor: 'var(--primary)', color: 'var(--primary-foreground)' }}
          aria-label="Nueva tarea"
        >
          <Plus className="w-6 h-6" />
        </button>
      )}

      {/* Sheet nueva tarea */}
      <BottomSheet open={sheetNueva} onClose={() => setSheetNueva(false)} height="85%">
        <div className="flex justify-center pt-3 pb-1 flex-shrink-0">
          <div className="w-10 h-1 rounded-full" style={{ backgroundColor: 'var(--border)' }} />
        </div>
        <div className="px-4 py-3 border-b border-border flex-shrink-0">
          <p className="text-base font-semibold" style={{ color: 'var(--foreground)' }}>Nueva tarea</p>
        </div>
        <div className="flex-1 overflow-y-auto px-4 py-4 space-y-3">
          <EditarForm
            form={nuevaForm}
            onChange={setNuevaForm}
            colaboradores={hook.colaboradores}
            ranchos={ranchosSelect}
            modulos={modulosSelect}
            onCancel={() => setSheetNueva(false)}
            onSave={handleCrearTarea}
            guardando={guardandoNueva}
          />
        </div>
      </BottomSheet>

      {/* Sheet detalle */}
      <BottomSheet open={!!tareaSeleccionada} onClose={cerrarDetalle} height="85%">
        <div className="flex justify-center pt-3 pb-1 flex-shrink-0">
          <div className="w-10 h-1 rounded-full" style={{ backgroundColor: 'var(--border)' }} />
        </div>
        {tareaSeleccionada && profile?.org_id && (
          <DetalleSheet
            tareaId={tareaSeleccionada}
            esAdmin={esAdmin}
            orgId={profile.org_id}
            onClose={cerrarDetalle}
            onRefresh={refrescar}
            hook={hook}
            ranchosSelect={ranchosSelect}
            modulosSelect={modulosSelect}
          />
        )}
      </BottomSheet>

    </div>
  )
}
