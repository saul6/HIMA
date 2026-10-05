import { useState, useEffect, useRef, useCallback } from 'react'
import type { CSSProperties } from 'react'
import { motion, AnimatePresence, useReducedMotion } from 'motion/react'
import {
  ChevronLeft, Plus, Loader2, AlertTriangle,
  Calendar, MapPin, FileText, ChevronDown, ChevronUp, ExternalLink,
  Clock, Camera, Trash2, CheckCircle2, RotateCcw, XCircle, Image, Lock, PenLine, Copy,
} from 'lucide-react'
import { useNavigate, useSearchParams } from 'react-router'
import { toast } from 'sonner'
import { BottomSheet } from '@/app/components/BottomSheet'
import { FotoEvidencia } from '@/app/components/FotoEvidencia'
import { FirmaPad } from '@/app/components/FirmaPad'
import type { FirmaPadRef } from '@/app/components/FirmaPad'
import { FirmaSvg } from '@/app/components/FirmaSvg'
import { useAuthContext } from '@/context/AuthContext'
import { useModulosContext } from '@/context/ModulosContext'
import { useRanchos } from '@/hooks/useRanchos'
import { useAgendaTareas } from '@/hooks/useAgendaTareas'
import type { TareaListada, TareaDetalle, PrioridadTarea, EstadoTarea, AcuseDetalle } from '@/hooks/useAgendaTareas'
import { comprimirImagen } from '@/lib/fotos/comprimirImagen'
import { subirEvidencia, getSignedUrlsEvidencia } from '@/lib/storage/agendaStorage'
import { Portal } from '@/app/components/Portal'

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

// Entrada en cascada — solo en la carga inicial (ver primeraCargaRef). Máx. 8
// ítems escalonados, 35ms entre cada uno.
function cascadeStyle(index: number, enabled: boolean): CSSProperties | undefined {
  if (!enabled) return undefined
  return {
    animation: 'slideUpFade var(--motion-base) var(--ease-out) both',
    animationDelay: `${Math.min(index, 7) * 35}ms`,
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
  ACUSE_FIRMADO: 'Firmó de enterado',
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
  style,
}: {
  tarea: TareaListada
  esAdmin: boolean
  onClick: () => void
  style?: CSSProperties
}) {
  return (
    <button
      onClick={onClick}
      style={style}
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
        {(tarea.acuse_estado === 'pendiente' || tarea.acuse_estado === 'desactualizado') && (
          <span
            className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-semibold leading-none"
            style={{ backgroundColor: 'var(--agro-warning-fill)', color: 'var(--agro-warning-text)' }}
          >
            <PenLine className="w-2.5 h-2.5" />
            Firma pendiente
          </span>
        )}
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
  const reducedMotion = useReducedMotion()
  if (fotos.length === 0) return null
  return (
    <div className="flex flex-wrap gap-2">
      <AnimatePresence initial={false}>
        {fotos.map(f => (
          <motion.div
            key={f.uid}
            layout={!reducedMotion}
            initial={reducedMotion ? false : { opacity: 0, scale: 0.9 }}
            animate={{ opacity: 1, scale: 1 }}
            exit={reducedMotion ? undefined : { opacity: 0, scale: 0.9 }}
            transition={{ duration: 0.22, ease: [0.22, 1, 0.36, 1] }}
            className="relative w-16 h-16 rounded-lg overflow-hidden border border-border"
          >
            <FotoEvidencia src={f.preview} alt="" className="w-full h-full object-cover" />
            <button
              type="button"
              onClick={() => onRemove(f.uid)}
              className="absolute top-0.5 right-0.5 w-5 h-5 rounded-full flex items-center justify-center"
              style={{ backgroundColor: 'var(--agro-red)', color: 'var(--primary-foreground)' }}
              aria-label="Quitar foto"
            >
              <Trash2 className="w-3 h-3" />
            </button>
          </motion.div>
        ))}
      </AnimatePresence>
    </div>
  )
}

// ── DetalleSheet ──────────────────────────────────────────────────────────────

function DetalleSheet({
  tareaId,
  esAdmin,
  esSuperAdmin,
  orgId,
  onClose,
  onRefresh,
  hook,
  ranchosSelect,
  modulosSelect,
  accionInicial,
  terminoSingular,
}: {
  tareaId: string
  esAdmin: boolean
  esSuperAdmin: boolean
  orgId: string
  onClose: () => void
  onRefresh: () => void
  hook: ReturnType<typeof useAgendaTareas>
  ranchosSelect: { id: string; nombre: string }[]
  modulosSelect: { codigo: string; nombre: string }[]
  accionInicial?: string | null
  terminoSingular: string
}) {
  const navigate = useNavigate()
  const { modulos } = useModulosContext()
  const [det, setDet] = useState<TareaDetalle | null>(null)
  const [cargando, setCargando] = useState(true)
  const [detalleError, setDetalleError] = useState<string | null>(null)
  const [signedUrls, setSignedUrls] = useState<Record<string, string>>({})

  // Acción activa: 'iniciar'|'reportar'|'aprobar'|'regresar'|'cancelar'|'editar'|null
  const [accion, setAccion] = useState<string | null>(null)

  // Si se llega desde el módulo con ?accion=reportar, preseleccionar
  useEffect(() => {
    if (accionInicial === 'reportar') setAccion('reportar')
  }, [accionInicial])
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

  // Firma / acuse
  const firmaRef = useRef<FirmaPadRef | null>(null)
  const acuseEventIdRef = useRef<string | null>(null)
  const [firmaPuntos, setFirmaPuntos] = useState(0)
  const [firmando, setFirmando] = useState(false)
  const [acusesDetalle, setAcusesDetalle] = useState<AcuseDetalle[] | null>(null)
  const [acuseExpandido, setAcuseExpandido] = useState(false)
  const [acuseVerLoading, setAcuseVerLoading] = useState(false)
  const [acuseTecnicoId, setAcuseTecnicoId] = useState<string | null>(null)

  // Formulario editar (mismos campos que crear)
  const [editForm, setEditForm] = useState({
    titulo: '', descripcion: '', prioridad: '' as PrioridadTarea | '',
    fecha_limite: '', asignado_a: '',
  })

  const cargarDetalle = useCallback(async () => {
    setCargando(true)
    setDetalleError(null)
    setAcusesDetalle(null)
    setAcuseExpandido(false)
    setAcuseTecnicoId(null)
    const { data: d, errorMsg } = await hook.detalle(tareaId)
    setDet(d)
    if (errorMsg) {
      setDetalleError(
        errorMsg.toLowerCase().includes('no encontrada') || errorMsg.toLowerCase().includes('not found')
          ? 'Tarea no encontrada.'
          : 'No se pudo cargar el detalle.',
      )
    }
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

  async function handleFirmarAcuse() {
    if (!firmaRef.current || !det?.acuse) return
    if (!acuseEventIdRef.current) acuseEventIdRef.current = crypto.randomUUID()
    const { png, trazos } = firmaRef.current.exportar()
    setFirmando(true)
    const res = await hook.firmarAcuse(
      tareaId, png, trazos, det.acuse.contenido_sha256, acuseEventIdRef.current,
    )
    setFirmando(false)
    if (res.ok) {
      acuseEventIdRef.current = null
      toast.success('Firmaste de enterado')
      onRefresh()
      cargarDetalle()
    } else {
      const msg = res.mensaje ?? ''
      if (msg.includes('La tarea cambió')) {
        toast.warning(msg)
        firmaRef.current?.limpiar()
        setFirmaPuntos(0)
        cargarDetalle()
      } else {
        toast.error(msg || 'No se pudo guardar la firma. Intenta de nuevo.')
        console.error('[DetalleSheet] firmarAcuse:', msg)
      }
    }
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
    if (res.requiere_nueva_firma) {
      toast.info('El colaborador deberá firmar el acuse de nuevo')
    }
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
        <p className="text-sm" style={{ color: 'var(--muted-foreground)' }}>
          {detalleError ?? 'No se pudo cargar el detalle.'}
        </p>
      </div>
    )
  }

  const { tarea, eventos, evidencias, reporte_nota, verificacion_nota } = det
  const soloLectura = tarea.estado === 'cerrada' || tarea.estado === 'cancelada'
  const acuse = det.acuse

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

      {/* ── PUERTA DE FIRMA (colaborador, requiere firmar antes de trabajar) ── */}
      {acuse?.requiere_mi_firma ? (
        <div className="flex-1 overflow-y-auto px-4 py-4 space-y-4">
          {acuse.estado === 'desactualizado' && (
            <div
              className="rounded-lg p-3 text-sm"
              style={{ backgroundColor: 'var(--agro-warning-fill)', color: 'var(--agro-warning-text)' }}
            >
              El administrador modificó esta tarea. Revísala y firma de nuevo.
            </div>
          )}

          {/* Contenido completo visible para la firma */}
          {tarea.descripcion && (
            <div>
              <p className="text-xs font-semibold mb-1" style={{ color: 'var(--muted-foreground)' }}>Descripción</p>
              <p className="text-sm" style={{ color: 'var(--foreground)' }}>{tarea.descripcion}</p>
            </div>
          )}

          <div className="grid grid-cols-2 gap-3 text-xs">
            <div>
              <p style={{ color: 'var(--muted-foreground)' }}>Prioridad</p>
              <div className="mt-0.5"><ChipPrioridad prioridad={tarea.prioridad} /></div>
            </div>
            {tarea.fecha_limite && (
              <div>
                <p style={{ color: 'var(--muted-foreground)' }}>Fecha límite</p>
                <p className="font-semibold mt-0.5" style={{ color: tarea.vencida ? 'var(--agro-danger-text)' : 'var(--foreground)' }}>
                  {formatFechaLimite(tarea.fecha_limite)}
                </p>
              </div>
            )}
            {tarea.rancho_nombre && (
              <div>
                <p style={{ color: 'var(--muted-foreground)' }}>{terminoSingular}</p>
                <p className="font-semibold mt-0.5" style={{ color: 'var(--foreground)' }}>{tarea.rancho_nombre}</p>
              </div>
            )}
            {tarea.modulo_nombre && (
              <div>
                <p style={{ color: 'var(--muted-foreground)' }}>Formato</p>
                <p className="font-semibold mt-0.5" style={{ color: 'var(--foreground)' }}>{tarea.modulo_nombre}</p>
              </div>
            )}
            <div className="col-span-2">
              <p style={{ color: 'var(--muted-foreground)' }}>Asignada por</p>
              <p className="font-semibold mt-0.5" style={{ color: 'var(--foreground)' }}>
                {tarea.creador_nombre} · {formatFechaCorta(tarea.created_at)}
              </p>
            </div>
          </div>

          {/* Bloque acuse */}
          <div className="rounded-xl border border-border p-4 space-y-3">
            <div className="flex items-center gap-2">
              <PenLine className="w-4 h-4 flex-shrink-0" style={{ color: 'var(--primary)' }} />
              <p className="text-sm font-semibold" style={{ color: 'var(--foreground)' }}>Acuse de recibo</p>
            </div>
            <p className="text-xs leading-relaxed" style={{ color: 'var(--muted-foreground)' }}>
              {acuse.declaracion_preview}
            </p>
            <FirmaPad
              ref={firmaRef}
              onChange={({ puntos }) => setFirmaPuntos(puntos)}
            />
            <button
              onClick={handleFirmarAcuse}
              disabled={firmando || firmaPuntos < 15}
              className="w-full h-10 rounded-lg text-sm font-semibold flex items-center justify-center gap-2 disabled:opacity-40 transition-colors"
              style={{ backgroundColor: 'var(--primary)', color: 'var(--primary-foreground)' }}
            >
              {firmando
                ? <Loader2 className="w-4 h-4 animate-spin" />
                : <><PenLine className="w-4 h-4" /> Firmar de enterado</>
              }
            </button>
          </div>
        </div>
      ) : (

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
        {tarea.modulo_ruta && (() => {
          const moduloAccesible = modulos.some(
            (m) => m.ruta === tarea.modulo_ruta && m.desbloqueado,
          )
          if (!moduloAccesible) {
            return (
              <div
                className="w-full h-9 rounded-lg text-sm flex items-center justify-center gap-2 border border-border"
                style={{ color: 'var(--muted-foreground)' }}
              >
                <Lock className="w-4 h-4" />
                {tarea.modulo_nombre ?? 'Formato no disponible'}
              </div>
            )
          }
          const params = new URLSearchParams()
          if (tarea.rancho_id) params.set('rancho', tarea.rancho_id)
          params.set('tarea', tareaId)
          const labelRancho = tarea.rancho_nombre ? ` · ${tarea.rancho_nombre}` : ''
          return (
            <button
              onClick={() => { onClose(); navigate(`${tarea.modulo_ruta}?${params}`) }}
              className="w-full h-9 rounded-lg text-sm flex items-center justify-center gap-2 border border-border transition-colors hover:bg-muted"
              style={{ color: 'var(--primary)', fontWeight: 600 }}
            >
              <ExternalLink className="w-4 h-4" />
              Ir a {tarea.modulo_nombre ?? 'el formato'}{labelRancho}
            </button>
          )
        })()}

        {/* Reporte del colaborador */}
        {reporte_nota && (
          <div>
            <p className="text-xs font-semibold mb-1" style={{ color: 'var(--muted-foreground)' }}>
              Reporte del colaborador
            </p>
            <p className="text-sm" style={{ color: 'var(--foreground)' }}>{reporte_nota}</p>
          </div>
        )}

        {/* Nota de verificación */}
        {verificacion_nota && (
          <div>
            <p className="text-xs font-semibold mb-1" style={{ color: 'var(--muted-foreground)' }}>
              Nota de verificación
            </p>
            <p className="text-sm" style={{ color: 'var(--foreground)' }}>{verificacion_nota}</p>
          </div>
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
                        <FotoEvidencia src={url} alt="" className="w-full h-full object-cover" />
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

            {esAdmin && accion === 'editar' && acuse?.estado === 'firmado' && (
              <div
                className="rounded-lg px-3 py-2 text-xs flex items-center gap-2"
                style={{ backgroundColor: 'var(--agro-warning-fill)', color: 'var(--agro-warning-text)' }}
              >
                <PenLine className="w-3.5 h-3.5 flex-shrink-0" />
                El colaborador tendrá que volver a firmar.
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

        {/* ── Sección acuse (visible cuando no es puerta de firma) ── */}
        {acuse && acuse.estado !== 'no_requerido' && (
          <div>
            <p className="text-xs font-semibold mb-2" style={{ color: 'var(--muted-foreground)' }}>Acuse de recibo</p>

            {acuse.estado === 'firmado' && acuse.ultimo && (
              <div className="rounded-lg border border-border p-3 space-y-2">
                <div className="flex items-center gap-2">
                  <PenLine className="w-3.5 h-3.5 flex-shrink-0" style={{ color: 'var(--agro-success-text)' }} />
                  <p className="text-xs font-semibold" style={{ color: 'var(--foreground)' }}>
                    Firmado por {acuse.ultimo.firmante} el{' '}
                    {new Date(acuse.ultimo.firmado_en).toLocaleString('es-MX', {
                      day: 'numeric', month: 'short', year: 'numeric', hour: '2-digit', minute: '2-digit',
                    })}
                  </p>
                </div>
                <p className="text-[10px] font-mono" style={{ color: 'var(--muted-foreground)' }}>
                  Sello: {acuse.ultimo.registro_sha256.slice(0, 12)}…
                </p>
                <button
                  onClick={async () => {
                    if (!acuseExpandido && !acusesDetalle) {
                      setAcuseVerLoading(true)
                      const res = await hook.verAcuses(tareaId)
                      setAcuseVerLoading(false)
                      if (res.data.length) setAcusesDetalle(res.data)
                    }
                    setAcuseExpandido(o => !o)
                  }}
                  className="text-xs flex items-center gap-1 transition-colors hover:opacity-70"
                  style={{ color: 'var(--primary)' }}
                >
                  {acuseVerLoading ? <Loader2 className="w-3 h-3 animate-spin" /> : acuseExpandido ? <ChevronUp className="w-3 h-3" /> : <ChevronDown className="w-3 h-3" />}
                  {acuseExpandido ? 'Ocultar detalle' : 'Ver detalle'}
                </button>
                {acuseExpandido && acusesDetalle && acusesDetalle.map((ac) => (
                  <div
                    key={ac.acuse_id}
                    className="rounded-lg p-3 space-y-2 border border-border"
                    style={{ backgroundColor: ac.vigente ? 'var(--card)' : 'var(--muted)' }}
                  >
                    {!ac.vigente && (
                      <span
                        className="text-[10px] font-semibold px-2 py-0.5 rounded-full"
                        style={{ backgroundColor: 'var(--border)', color: 'var(--muted-foreground)' }}
                      >
                        anterior
                      </span>
                    )}
                    {ac.trazos && ac.trazos.length > 0 ? (
                      <div
                        className="rounded border border-border p-2"
                        style={{ backgroundColor: 'var(--input-background)', color: 'var(--foreground)' }}
                      >
                        <FirmaSvg trazos={ac.trazos} className="h-16 w-auto" />
                      </div>
                    ) : ac.firma_png ? (
                      <img
                        src={ac.firma_png}
                        alt="Firma"
                        className="h-16 w-auto rounded border border-border"
                        style={{ backgroundColor: '#fff' }}
                      />
                    ) : null}
                    <div className="text-[10px] space-y-1" style={{ color: 'var(--muted-foreground)' }}>
                      <p className="italic">"{ac.declaracion}"</p>
                      <div className="flex items-center gap-1 font-mono">
                        <span>Sello: {ac.registro_sha256.slice(0, 12)}…</span>
                        <button
                          type="button"
                          onClick={() => navigator.clipboard.writeText(ac.registro_sha256).then(() => toast.success('Sello copiado'))}
                          aria-label="Copiar sello"
                          className="inline-flex items-center hover:opacity-70 transition-opacity"
                          style={{ color: 'var(--primary)' }}
                        >
                          <Copy className="w-3 h-3" />
                        </button>
                      </div>
                      <p className="font-mono">SHA firma: {ac.firma_sha256.slice(0, 12)}…</p>
                      <p className="font-mono">SHA contenido: {ac.contenido_sha256.slice(0, 12)}…</p>
                      {ac.metadatos_resguardados && (
                        <p className="italic leading-relaxed mt-1">
                          Los datos técnicos de la firma (IP, navegador y sesión) quedan resguardados para aclaraciones.
                        </p>
                      )}
                      {esSuperAdmin && (ac.ip || ac.user_agent) && (
                        <div className="mt-1">
                          <button
                            type="button"
                            onClick={() => setAcuseTecnicoId(prev => prev === ac.acuse_id ? null : ac.acuse_id)}
                            className="flex items-center gap-1 hover:opacity-70 transition-opacity"
                            style={{ color: 'var(--primary)' }}
                          >
                            {acuseTecnicoId === ac.acuse_id ? <ChevronUp className="w-3 h-3" /> : <ChevronDown className="w-3 h-3" />}
                            Datos técnicos (solo M.A.D.Y.)
                          </button>
                          {acuseTecnicoId === ac.acuse_id && (
                            <div className="mt-1 space-y-0.5 pl-1">
                              {ac.ip && <p>IP: {ac.ip}</p>}
                              {ac.user_agent && <p className="break-all">Navegador: {ac.user_agent}</p>}
                            </div>
                          )}
                        </div>
                      )}
                    </div>
                  </div>
                ))}
              </div>
            )}

            {acuse.estado === 'pendiente' && esAdmin && (
              <div
                className="rounded-lg px-3 py-2 text-xs flex items-center gap-2"
                style={{ backgroundColor: 'var(--agro-warning-fill)', color: 'var(--agro-warning-text)' }}
              >
                <PenLine className="w-3.5 h-3.5 flex-shrink-0" />
                Sin acuse: {tarea.asignado_nombre} aún no firma
              </div>
            )}

            {acuse.estado === 'desactualizado' && esAdmin && (
              <div className="space-y-2">
                <div
                  className="rounded-lg px-3 py-2 text-xs flex items-center gap-2"
                  style={{ backgroundColor: 'var(--agro-warning-fill)', color: 'var(--agro-warning-text)' }}
                >
                  <PenLine className="w-3.5 h-3.5 flex-shrink-0" />
                  Firma desactualizada: se editó la tarea
                </div>
                <button
                  onClick={async () => {
                    if (!acuseExpandido && !acusesDetalle) {
                      setAcuseVerLoading(true)
                      const res = await hook.verAcuses(tareaId)
                      setAcuseVerLoading(false)
                      if (res.data.length) setAcusesDetalle(res.data)
                    }
                    setAcuseExpandido(o => !o)
                  }}
                  className="text-xs flex items-center gap-1"
                  style={{ color: 'var(--primary)' }}
                >
                  {acuseVerLoading ? <Loader2 className="w-3 h-3 animate-spin" /> : acuseExpandido ? <ChevronUp className="w-3 h-3" /> : <ChevronDown className="w-3 h-3" />}
                  {acuseExpandido ? 'Ocultar acuses anteriores' : 'Ver acuses anteriores'}
                </button>
                {acuseExpandido && acusesDetalle && acusesDetalle.map((ac) => (
                  <div key={ac.acuse_id} className="rounded-lg p-3 space-y-2 border border-border" style={{ backgroundColor: 'var(--muted)' }}>
                    <span className="text-[10px] font-semibold px-2 py-0.5 rounded-full" style={{ backgroundColor: 'var(--border)', color: 'var(--muted-foreground)' }}>
                      anterior
                    </span>
                    {ac.trazos && ac.trazos.length > 0 ? (
                      <div
                        className="rounded border border-border p-2"
                        style={{ backgroundColor: 'var(--input-background)', color: 'var(--foreground)' }}
                      >
                        <FirmaSvg trazos={ac.trazos} className="h-14 w-auto" />
                      </div>
                    ) : ac.firma_png ? (
                      <img src={ac.firma_png} alt="Firma" className="h-14 w-auto rounded border border-border" style={{ backgroundColor: '#fff' }} />
                    ) : null}
                    <p className="text-[10px]" style={{ color: 'var(--muted-foreground)' }}>
                      {ac.firmante} · {new Date(ac.firmado_en).toLocaleString('es-MX', { day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit' })}
                    </p>
                  </div>
                ))}
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
                    <p className="text-xs font-semibold flex items-center gap-1.5" style={{ color: 'var(--foreground)' }}>
                      {ev.tipo === 'ACUSE_FIRMADO' && <PenLine className="w-3 h-3 flex-shrink-0" style={{ color: 'var(--primary)' }} />}
                      {EVENTO_LABELS[ev.tipo] ?? ev.tipo}
                      <span className="font-normal" style={{ color: 'var(--muted-foreground)' }}>
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
      )} {/* fin else puerta-firma */}
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
  const reducedMotion = useReducedMotion()
  const primeraCargaRef = useRef(true)
  useEffect(() => {
    if (!hook.loading) primeraCargaRef.current = false
  }, [hook.loading])

  const esAdmin = profile?.rol === 'admin_org' || profile?.rol === 'super_admin'
  const esSuperAdmin = profile?.rol === 'super_admin'

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
  const accionParam = searchParams.get('accion')
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
          <div className="space-y-2">
            {[0, 1, 2].map(i => (
              <div key={i} className="rounded-xl border border-border bg-card p-4 flex flex-col gap-2 animate-pulse">
                <div className="h-4 rounded w-2/3" style={{ backgroundColor: 'var(--muted)' }} />
                <div className="h-3 rounded w-1/3" style={{ backgroundColor: 'var(--muted)' }} />
              </div>
            ))}
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

            {/* Chip sin acuse org */}
            {resumen && (resumen.sin_acuse_org ?? 0) > 0 && (
              <div
                className="flex items-center gap-2 rounded-xl px-3 py-2 text-xs font-semibold"
                style={{ backgroundColor: 'var(--agro-warning-fill)', color: 'var(--agro-warning-text)' }}
              >
                <PenLine className="w-3.5 h-3.5 flex-shrink-0" />
                {resumen.sin_acuse_org} {(resumen.sin_acuse_org ?? 0) === 1 ? 'tarea sin acuse' : 'tareas sin acuse'}
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
                <p
                  className="text-sm text-center py-8"
                  style={{
                    color: 'var(--muted-foreground)',
                    ...(reducedMotion ? {} : { animation: 'slideUpFade var(--motion-base) var(--ease-out) both' }),
                  }}
                >
                  Sin tareas
                </p>
              ) : (
                tareasTab.map((t, index) => (
                  <TareaCard
                    key={t.id}
                    tarea={t}
                    esAdmin={esAdmin}
                    onClick={() => abrirDetalle(t.id)}
                    style={cascadeStyle(index, !reducedMotion && primeraCargaRef.current)}
                  />
                ))
              )}
            </div>
          </>
        ) : (
          /* ── VISTA COLABORADOR ── */
          <>
            {/* Aviso firma pendiente (primero y más visible) */}
            {resumen && (resumen.mis_sin_firmar ?? 0) > 0 && (
              <div
                className="rounded-xl p-3 flex items-center gap-3"
                style={{ backgroundColor: 'var(--agro-warning-fill)', color: 'var(--agro-warning-text)' }}
              >
                <PenLine className="w-4 h-4 flex-shrink-0" />
                <p className="text-sm font-semibold">
                  Tienes {resumen.mis_sin_firmar} {(resumen.mis_sin_firmar ?? 0) === 1 ? 'tarea nueva por firmar' : 'tareas nuevas por firmar'}
                </p>
              </div>
            )}

            {/* Chips resumen */}
            {resumen && (
              <div className="flex gap-2 flex-wrap">
                {(resumen.mis_sin_firmar ?? 0) > 0 && (
                  <span className="inline-flex items-center gap-1 px-3 py-1.5 rounded-full text-xs font-semibold" style={{ backgroundColor: 'var(--agro-warning-fill)', color: 'var(--agro-warning-text)' }}>
                    <PenLine className="w-3 h-3" />
                    {resumen.mis_sin_firmar} por firmar
                  </span>
                )}
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
                {misPendientes.map((t, index) => (
                  <TareaCard
                    key={t.id}
                    tarea={t}
                    esAdmin={false}
                    onClick={() => abrirDetalle(t.id)}
                    style={cascadeStyle(index, !reducedMotion && primeraCargaRef.current)}
                  />
                ))}
              </div>
            )}

            {/* En revisión */}
            {misRevisión.length > 0 && (
              <div className="space-y-2">
                <p className="text-xs font-semibold px-1" style={{ color: 'var(--muted-foreground)' }}>En revisión</p>
                {misRevisión.map((t, index) => (
                  <TareaCard
                    key={t.id}
                    tarea={t}
                    esAdmin={false}
                    onClick={() => abrirDetalle(t.id)}
                    style={cascadeStyle(index, !reducedMotion && primeraCargaRef.current)}
                  />
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
              <p
                className="text-sm text-center py-10"
                style={{
                  color: 'var(--muted-foreground)',
                  ...(reducedMotion ? {} : { animation: 'slideUpFade var(--motion-base) var(--ease-out) both' }),
                }}
              >
                No tienes tareas asignadas
              </p>
            )}
          </>
        )}
      </div>

      {/* FAB (solo admin) */}
      {esAdmin && (
        <Portal>
        <button
          onClick={() => { setSheetNueva(true); hook.cargarColaboradores() }}
          className="fixed bottom-safe-fab right-4 w-14 h-14 rounded-full flex items-center justify-center z-40 transition-transform active:scale-95"
          style={{ backgroundColor: 'var(--primary)', color: 'var(--primary-foreground)' }}
          aria-label="Nueva tarea"
        >
          <Plus className="w-6 h-6" />
        </button>
        </Portal>
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
            esSuperAdmin={esSuperAdmin}
            orgId={profile.org_id}
            onClose={cerrarDetalle}
            onRefresh={refrescar}
            hook={hook}
            ranchosSelect={ranchosSelect}
            modulosSelect={modulosSelect}
            accionInicial={accionParam}
            terminoSingular={terminoSingular}
          />
        )}
      </BottomSheet>

    </div>
  )
}
