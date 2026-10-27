import { useState, useRef, useEffect } from 'react'
import {
  Plus, X, Loader2, AlertTriangle,
  Camera, Image, Trash2, ImageOff, ClipboardList, FileDown, WifiOff,
} from 'lucide-react'
import { motion, AnimatePresence, useReducedMotion } from 'motion/react'
import { useNavigate } from 'react-router'
import { BottomSheet } from '@/app/components/BottomSheet'
import { ModuloHeader } from '@/app/components/ModuloHeader'
import { FotoEvidencia } from '@/app/components/FotoEvidencia'
import { BotonExportarConsolidado } from '@/app/components/BotonExportarConsolidado'
import { ListaSkeleton } from '@/app/components/ListaSkeleton'
import { toast } from 'sonner'
import { comprimirImagen, optimizarImagen } from '@/lib/fotos/comprimirImagen'
import { useAuthContext } from '@/context/AuthContext'
import { puedeEditarFechaLibre } from '@/lib/permisos'
import { useModulosContext } from '@/context/ModulosContext'
import { useRanchos } from '@/hooks/useRanchos'
import { useM13Incidencias, type M13ReporteConRancho } from '@/hooks/useM13Incidencias'
import { supabase } from '@/lib/supabase'
import { getSignedUrls, borrarFotos, subirFoto } from '@/lib/storage/incidenciasStorage'
import { generarReporteIncidenciasPDF } from '@/lib/pdf/m13/generarReporteIncidenciasPDF'
import { useOrganizacion } from '@/hooks/useOrganizacion'
import { generarReporteIncidenciasConsolidadoPDF } from '@/lib/pdf/m13/generarReporteIncidenciasConsolidadoPDF'
import {
  guardarCabecera, guardarIncidencia, guardarFoto, borrarFoto, borrarIncidencia,
  cargarBorrador, existeBorrador, borrarBorrador, limpiarBorradoresViejos,
  vaciarEscrituras, suscribirEstadoBorrador, pedirAlmacenamientoPersistente,
  type M13IncidenciaReg,
} from '@/lib/idb/m13DraftStore'
import { useLockBorrador } from '@/hooks/useLockBorrador'
import type { AdjuntoOutbox } from '@/lib/offline/tipos'
import { registrarEvento } from '@/lib/diagnostico'
import { useConexion } from '@/hooks/useConexion'
import { usePendientesModulo } from '@/hooks/usePendientesModulo'
import { useGuardarOffline } from '@/hooks/useGuardarOffline'
import { ChipOffline } from '@/app/components/ChipOffline'
import { Fab } from '@/app/components/Fab'
import { useContextoTarea } from '@/hooks/useContextoTarea'
import { BannerTareaOrigen } from '@/app/components/BannerTareaOrigen'
import { useFirmaContext } from '@/context/FirmaContext'
import { FirmaGatePaso } from '@/app/components/FirmaGatePaso'
import { PasoFirmaRegistro } from '@/app/components/PasoFirmaRegistro'
import { useFirmasRegistro } from '@/hooks/useFirmasRegistro'
import { FirmasRegistro } from '@/app/components/FirmasRegistro'
import { Portal } from '@/app/components/Portal'
import { TextareaContador } from '@/app/components/TextareaContador'
import { limiteTexto, MAX_FOTOS } from '@/lib/limitesTexto'
import { useConfirmar } from '@/app/components/ui-mady/ConfirmarSheet'
import { EstadoVacio } from '@/app/components/ui-mady/EstadoVacio'
import { Etiqueta } from '@/app/components/ui-mady/Etiqueta'
import { fechaCorta } from '@/lib/formato'
import { DUR, EASE_OUT } from '@/lib/motion'

// ── Constantes ────────────────────────────────────────────────────────────────

const TITULO_MODULO = 'Reporte de Incidencias'
const CLAVE_MODULO = 'M.A.D.Y · Por evento'
const MAX_FOTOS_INCIDENCIA = MAX_FOTOS.m13PorIncidencia   // Tope duro por incidencia (el formulario bloquea al llegar)
const MAX_FOTO_BYTES = 5.5 * 1024 * 1024
const MAX_REINTENTOS_FOTO = 3

const hoy = () => new Date().toLocaleDateString('en-CA', { timeZone: 'America/Mexico_City' })

// ── Tipos internos ────────────────────────────────────────────────────────────

interface FotoLocal {
  uid: string
  file: File
  preview: string
  /** 'original' = aún sin optimizar (no se puede guardar el reporte así). */
  estado: 'original' | 'lista'
  intentos: number
  /** Solo en memoria: se está optimizando ahora mismo. */
  procesando?: boolean
  /** Ya está en el servidor (fila y archivo). */
  subida?: boolean
  /** El borrador la mencionaba pero el archivo no está: hay que volver a agregarla. */
  faltante?: boolean
}

interface IncidenciaLocal {
  uid: string
  descripcion: string
  fotos: FotoLocal[]
  /** La fila de la incidencia ya está en el servidor. */
  insertada?: boolean
}

interface ProgresoSubida {
  total: number
  procesadas: number
  fallidas: number
  fase?: 'reporte' | 'fotos'
}

const TIEMPO_PASO1_MS = 20_000
const FOTOS_PARA_AVISO = 20
const DEBOUNCE_BORRADOR_MS = 300

/** Hay fotos optimizándose ahora mismo (lo leen la pantalla y sus tarjetas). */
const estadoProc = { activo: false }

/** Error de "ya existe" al reintentar un INSERT/subida que sí llegó al servidor. */
function yaExiste(e: unknown): boolean {
  const x = e as { code?: string; message?: string; statusCode?: string | number } | null
  const m = String(x?.message ?? '').toLowerCase()
  return x?.code === '23505' || String(x?.statusCode) === '409' || m.includes('already exists') || m.includes('duplicate')
}

function esErrorDeRed(e: unknown): boolean {
  const m = String((e as { message?: string } | null)?.message ?? e).toLowerCase()
  return m.includes('timeout_red') || m.includes('failed to fetch') || m.includes('networkerror') || m.includes('load failed') || m.includes('network request failed')
}

// ── Helpers ───────────────────────────────────────────────────────────────────

function formatFecha(iso: string): string {
  try {
    return fechaCorta(iso)
  } catch { return iso }
}


function nuevaIncidencia(): IncidenciaLocal {
  return { uid: crypto.randomUUID(), descripcion: '', fotos: [] }
}

// ── Sub-componente: galería de fotos de un reporte guardado ──────────────────

function GaleriaFotos({ paths }: { paths: string[] }) {
  const [urls, setUrls] = useState<Record<string, string>>({})
  const [cargando, setCargando] = useState(true)

  useEffect(() => {
    if (paths.length === 0) { setCargando(false); return }
    let activo = true
    getSignedUrls(paths, 60)
      .then((res) => { if (activo) setUrls(res) })
      .catch(() => {})
      .finally(() => { if (activo) setCargando(false) })
    return () => { activo = false }
  }, [paths.join('|')])

  if (paths.length === 0) return null

  return (
    <div className="flex flex-wrap gap-1 mt-2">
      {paths.map((p) => (
        cargando ? (
          <div
            key={p}
            className="w-14 h-14 rounded-lg bg-muted flex items-center justify-center"
          >
            <Loader2 className="w-4 h-4 text-muted-foreground animate-spin" />
          </div>
        ) : urls[p] ? (
          <FotoEvidencia
            key={p}
            src={urls[p]}
            alt="Evidencia"
            className="w-14 h-14 object-cover rounded-lg border border-border"
          />
        ) : (
          <div
            key={p}
            className="w-14 h-14 rounded-lg bg-muted flex items-center justify-center"
          >
            <ImageOff className="w-4 h-4 text-muted-foreground" />
          </div>
        )
      ))}
    </div>
  )
}

// ── Sub-componente: card de incidencia en formulario ─────────────────────────

function IncidenciaForm({
  inc,
  index,
  onChange,
  onQuitar,
  onAgregarFotos,
  onQuitarFoto,
  onProcesarFotos,
  onGuardarYa,
  onBlurTexto,
}: {
  inc: IncidenciaLocal
  index: number
  onChange: (upd: Partial<IncidenciaLocal>) => void
  onQuitar: () => void
  onAgregarFotos: (incUid: string, fotos: FotoLocal[]) => void
  onQuitarFoto: (incUid: string, fotoUid: string) => void
  onProcesarFotos: (incUid: string, fotoUids: string[]) => Promise<void>
  onGuardarYa: () => Promise<void>
  onBlurTexto: () => void
}) {
  const inputCamaraRef = useRef<HTMLInputElement>(null)
  const inputGaleriaRef = useRef<HTMLInputElement>(null)
  const atLimit = inc.fotos.length >= MAX_FOTOS_INCIDENCIA
  const reducedMotion = useReducedMotion()

  useEffect(() => {
    return () => { inc.fotos.forEach((f) => URL.revokeObjectURL(f.preview)) }
  }, [])

  async function handleFiles(files: FileList | null) {
    if (!files) { try { sessionStorage.removeItem('m13:camara') } catch { /* ignore */ } return }

    const slotsRestantes = MAX_FOTOS_INCIDENCIA - inc.fotos.length
    if (slotsRestantes <= 0) {
      try { sessionStorage.removeItem('m13:camara') } catch { /* ignore */ }
      toast.warning(
        `Máximo ${MAX_FOTOS_INCIDENCIA} fotos por incidencia. Agrega otra incidencia para subir más evidencia.`,
        { duration: 6000 }
      )
      return
    }

    const candidatas = Array.from(files).filter((f) => {
      if (!f.type.startsWith('image/')) { toast.error(`${f.name} no es una imagen`); return false }
      return true
    })

    // Cap al límite disponible
    const aAgregar = candidatas.slice(0, slotsRestantes)
    if (aAgregar.length < candidatas.length) {
      toast.warning(
        `Máximo ${MAX_FOTOS_INCIDENCIA} fotos por incidencia: se agregaron ${aAgregar.length} de ${candidatas.length}.`,
        { duration: 6000 }
      )
    }

    if (aAgregar.length === 0) {
      try { sessionStorage.removeItem('m13:camara') } catch { /* ignore */ }
      return
    }

    // 1) La foto original entra al borrador ANTES de procesarla: si la página
    //    muere optimizando, la foto sigue ahí.
    try { sessionStorage.setItem('m13:camara', '1') } catch { /* ignore */ }
    const nuevas: FotoLocal[] = aAgregar.map((f) => ({
      uid: crypto.randomUUID(),
      file: f,
      preview: URL.createObjectURL(f),
      estado: 'original',
      intentos: 0,
    }))
    onAgregarFotos(inc.uid, nuevas)
    await onGuardarYa()

    // 2) Optimizar una por una.
    await onProcesarFotos(inc.uid, nuevas.map((n) => n.uid))
  }

  function guardarAntesDeAbrir() {
    // Lo escrito hasta ahora no puede depender del debounce de 500 ms.
    void onGuardarYa()
  }

  return (
    <div className="border border-border rounded-xl p-4 space-y-3 bg-card">
      <div className="flex items-center justify-between">
        <span className="text-xs text-muted-foreground font-semibold">
          INCIDENCIA {index + 1}
        </span>
        <button
          type="button"
          onClick={onQuitar}
          className="p-1 text-muted-foreground hover:text-agro-red transition-colors"
          title="Quitar incidencia"
        >
          <Trash2 className="w-4 h-4" />
        </button>
      </div>

      {/* Descripción */}
      <TextareaContador limite={limiteTexto('m13_incidencias', 'descripcion')}
        value={inc.descripcion}
        onChange={(e) => onChange({ descripcion: e.target.value })}
        onBlur={onBlurTexto}
        placeholder="Describe la incidencia observada..."
        rows={3}
        className="w-full px-3 py-2 rounded-lg bg-input-background border border-border-control text-sm text-foreground focus:outline-none focus:border-primary focus:ring-1 focus:ring-primary resize-none"
      />

      {/* Avisos */}
      {inc.fotos.length === 0 && (
        <p className="text-xs" style={{ color: 'var(--agro-danger-text)' }}>
          Se requiere al menos 1 foto como evidencia
        </p>
      )}
      {atLimit && (
        <div
          className="flex items-center gap-2 rounded-lg px-3 py-2 text-xs"
          style={{ backgroundColor: 'var(--agro-danger-fill)', color: 'var(--agro-danger-text)' }}
        >
          <AlertTriangle className="w-3 h-3 flex-shrink-0" />
          Máximo de {MAX_FOTOS_INCIDENCIA} fotos por incidencia alcanzado. Agrega otra incidencia para subir más.
        </div>
      )}

      {/* Fotos que el borrador mencionaba pero no se encontraron */}
      {inc.fotos.some((f) => f.faltante) && (
        <div
          className="rounded-lg px-3 py-2 space-y-2 text-xs"
          style={{ backgroundColor: 'var(--agro-danger-fill)', color: 'var(--agro-danger-text)' }}
        >
          {inc.fotos.filter((f) => f.faltante).map((f) => (
            <div key={f.uid} className="flex items-center gap-2">
              <AlertTriangle className="w-3 h-3 flex-shrink-0" />
              <span className="flex-1 min-w-0">Falta una foto: vuelve a agregarla</span>
              <button type="button" onClick={() => onQuitarFoto(inc.uid, f.uid)} className="font-semibold underline">
                Quitar
              </button>
            </div>
          ))}
        </div>
      )}

      {/* Fotos que no se pudieron optimizar */}
      {inc.fotos.some((f) => f.estado === 'original' && !f.procesando && f.intentos >= 1) && (
        <div
          className="rounded-lg px-3 py-2 space-y-2 text-xs"
          style={{ backgroundColor: 'var(--agro-danger-fill)', color: 'var(--agro-danger-text)' }}
        >
          {inc.fotos.filter((f) => f.estado === 'original' && !f.procesando && f.intentos >= 1).map((f) => (
            <div key={f.uid} className="flex items-center gap-2">
              <AlertTriangle className="w-3 h-3 flex-shrink-0" />
              <span className="flex-1 min-w-0">Foto muy grande para este teléfono</span>
              <button
                type="button"
                onClick={() => { void onProcesarFotos(inc.uid, [f.uid]) }}
                className="font-semibold underline"
              >
                Intentar de nuevo
              </button>
              <button
                type="button"
                onClick={() => onQuitarFoto(inc.uid, f.uid)}
                className="font-semibold underline"
              >
                Quitar
              </button>
            </div>
          ))}
          <p>Baja la resolución de la cámara (por ejemplo 12 MP) y vuelve a tomarla.</p>
        </div>
      )}

      {/* Previews */}
      {inc.fotos.some((f) => !f.faltante) && (
        <div className="flex flex-wrap gap-2">
          <AnimatePresence initial={false}>
            {inc.fotos.filter((f) => !f.faltante).map((f) => (
              <motion.div
                key={f.uid}
                layout={!reducedMotion}
                initial={reducedMotion ? false : { opacity: 0, scale: 0.9 }}
                animate={{ opacity: 1, scale: 1 }}
                exit={reducedMotion ? undefined : { opacity: 0, scale: 0.9 }}
                transition={{ duration: DUR.base, ease: EASE_OUT }}
                className="relative"
              >
                <FotoEvidencia
                  src={f.preview}
                  alt="Preview"
                  className="w-16 h-16 object-cover rounded-lg border border-border"
                />
                {f.procesando && (
                  <div className="absolute inset-0 rounded-lg bg-background/70 flex items-center justify-center">
                    <Loader2 className="w-4 h-4 text-muted-foreground animate-spin" />
                  </div>
                )}
                <button aria-label="Quitar"
                  type="button"
                  onClick={() => onQuitarFoto(inc.uid, f.uid)}
                  className="absolute -top-1.5 -right-1.5 w-5 h-5 bg-agro-red text-white rounded-full flex items-center justify-center"
                >
                  <X className="w-3 h-3" />
                </button>
              </motion.div>
            ))}
          </AnimatePresence>
        </div>
      )}

      {/* Inputs ocultos: cámara y galería */}
      <input
        ref={inputCamaraRef}
        type="file"
        accept="image/*"
        capture="environment"
        multiple
        className="hidden"
        onChange={(e) => handleFiles(e.target.files)}
        onClick={(e) => { (e.target as HTMLInputElement).value = '' }}
      />
      <input
        ref={inputGaleriaRef}
        type="file"
        accept="image/*"
        multiple
        className="hidden"
        onChange={(e) => handleFiles(e.target.files)}
        onClick={(e) => { (e.target as HTMLInputElement).value = '' }}
      />
      {atLimit ? (
        <p className="w-full h-10 flex items-center justify-center text-sm text-muted-foreground opacity-40">
          Límite de fotos alcanzado
        </p>
      ) : (
        <div className="flex gap-2">
          <button
            type="button"
            onClick={() => {
              try { sessionStorage.setItem('m13:camara', '1') } catch { /* ignore */ }
              guardarAntesDeAbrir()
              // Si el usuario cancela la cámara no llega ningún evento: al volver a
              // la pestaña, si no llegó nada, se limpia la marca.
              const alVolver = () => {
                if (document.visibilityState !== 'visible') return
                document.removeEventListener('visibilitychange', alVolver)
                setTimeout(() => {
                  if (!estadoProc.activo) { try { sessionStorage.removeItem('m13:camara') } catch { /* ignore */ } }
                }, 3000)
              }
              document.addEventListener('visibilitychange', alVolver)
              inputCamaraRef.current?.click()
            }}
            className="flex-1 h-10 flex items-center justify-center gap-1.5 rounded-lg border border-dashed border-border text-sm text-muted-foreground hover:border-primary hover:text-primary transition-colors"
          >
            <Camera className="w-4 h-4" />
            Tomar foto
          </button>
          <button
            type="button"
            onClick={() => { guardarAntesDeAbrir(); inputGaleriaRef.current?.click() }}
            className="flex-1 h-10 flex items-center justify-center gap-1.5 rounded-lg border border-dashed border-border text-sm text-muted-foreground hover:border-primary hover:text-primary transition-colors"
          >
            <Image className="w-4 h-4" />
            Galería
          </button>
        </div>
      )}
      {!atLimit && (
        <p className="text-xs text-muted-foreground">
          Si la app se cierra al tomar la foto, tómala con la cámara del teléfono y súbela con Galería.
        </p>
      )}
    </div>
  )
}

// ── Pantalla principal ────────────────────────────────────────────────────────

export function ReporteIncidencias() {
  const navigate = useNavigate()
  const { profile, user } = useAuthContext()
  const esSuperAdmin = profile?.rol === 'super_admin'
  const puedeEditarFecha = esSuperAdmin || puedeEditarFechaLibre(user?.email)
  const { terminosSitio } = useModulosContext()
  const { ranchos } = useRanchos()
  const { ranchoInicial, tareaId } = useContextoTarea(ranchos)
  const [registroGuardado, setRegistroGuardado] = useState(false)
  const { reportes, loading, refetch } = useM13Incidencias()
  const orgNombre = useOrganizacion(profile?.org_id)

  const todosIds = reportes.map(r => r.id)
  const { firmas, loading: loadingFirmas, refetch: refetchFirmas } = useFirmasRegistro('M13', todosIds)
  const { obligatoria, tengoFirma } = useFirmaContext()
  const { online } = useConexion()
  const { lotes: lotesOffline } = usePendientesModulo('M13')
  const { guardar: guardarOffline } = useGuardarOffline('M13')

  const [sheetPaso, setSheetPaso] = useState<'firma_gate' | 'form' | 'firma_decision'>('form')
  const [pendienteFirmaId, setPendienteFirmaId] = useState<string | null>(null)
  const [pendienteReporteParaPDF, setPendienteReporteParaPDF] = useState<M13ReporteConRancho | null>(null)

  // Sheet formulario
  const [sheetAbierto, setSheetAbierto] = useState(false)
  const [ranchoId, setRanchoId] = useState('')

  useEffect(() => {
    if (ranchoInicial) setRanchoId(ranchoInicial)
  }, [ranchoInicial])
  const [fecha, setFecha] = useState(hoy())
  const [auditorNombre, setAuditorNombre] = useState('')
  const [incidencias, setIncidencias] = useState<IncidenciaLocal[]>([nuevaIncidencia()])
  const [errRancho, setErrRancho] = useState(false)
  const [guardando, setGuardando] = useState(false)
  const [progreso, setProgreso] = useState<ProgresoSubida | null>(null)
  const { confirmar, confirmarElemento } = useConfirmar()

  // Sheet consolidado
  const [sheetConsolidadoAbierto, setSheetConsolidadoAbierto] = useState(false)
  const [consRanchoId, setConsRanchoId] = useState('')
  const [consDesde, setConsDesde] = useState('')
  const [consHasta, setConsHasta] = useState(hoy())
  const [generandoConsolidado, setGenerandoConsolidado] = useState(false)
  const [errConsFechas, setErrConsFechas] = useState(false)

  // PDF individual — id del reporte que se está generando
  const [generandoPDF, setGenerandoPDF] = useState<string | null>(null)

  // Reporte expandido (para ver fotos)
  const [expandido, setExpandido] = useState<string | null>(null)

  // Total de fotos en el formulario actual (computed, para el cap global)
  const totalFotos = incidencias.reduce((sum, inc) => sum + inc.fotos.length, 0)
  const fotosPendientes = incidencias.reduce((sum, inc) => sum + inc.fotos.filter((f) => !f.subida).length, 0)
  const hayFotosSinOptimizar = incidencias.some((inc) => inc.fotos.some((f) => f.estado === 'original'))

  const ranchoOptions = ranchos.map((r) => ({ value: r.id, label: r.nombre }))

  // Borrador local (IndexedDB) — clave única por usuario y organización.
  // Cada incidencia y cada foto se guardan por separado en cuanto cambian.
  const draftKey = profile?.org_id && user?.id
    ? `draft:m13:${profile.org_id}:${user.id}`
    : null
  const [hayBorrador, setHayBorrador] = useState(false)
  const [confirmDraftVisible, setConfirmDraftVisible] = useState(false)
  const [falloGuardado, setFalloGuardado] = useState(false)
  // El reporte ya existe en el servidor (un intento anterior lo creó): se retoma, no se duplica.
  const [reporteInsertado, setReporteInsertado] = useState(false)
  const reporteIdRef = useRef<string | null>(null)
  const reporteInsertadoRef = useRef(false)
  // Tras confirmar el reporte el borrador ya no se escribe (evita resucitarlo).
  const sinEscrituraRef = useRef(false)
  const timersRef = useRef(new Map<string, ReturnType<typeof setTimeout>>())

  // Siempre refleja el último estado del formulario (incluye cambios aún no renderizados)
  const estadoRef = useRef({ ranchoId, fecha, auditorNombre, incidencias })
  estadoRef.current = { ranchoId, fecha, auditorNombre, incidencias }
  const colaFotosRef = useRef<Promise<void>>(Promise.resolve())
  const [abrirBorradorPendiente, setAbrirBorradorPendiente] = useState(false)

  // Una sola pestaña escribe el mismo borrador
  const lock = useLockBorrador(draftKey, sheetAbierto, () => { void aplicarBorrador() })
  const puedeEscribir = () => !!draftKey && !sinEscrituraRef.current && lock.esDuenoRef.current

  function escribirCabeceraYa(): Promise<void> {
    if (!puedeEscribir()) return Promise.resolve()
    const e = estadoRef.current
    setHayBorrador(true)
    return guardarCabecera(draftKey!, {
      ranchoId: e.ranchoId,
      fecha: e.fecha,
      auditorNombre: e.auditorNombre,
      ordenIncidencias: e.incidencias.map((i) => i.uid),
    })
  }

  function regDeIncidencia(inc: IncidenciaLocal): M13IncidenciaReg {
    return {
      uid: inc.uid,
      draftKey: draftKey!,
      descripcion: inc.descripcion,
      actualizadaEn: Date.now(),
      insertada: inc.insertada,
      fotos: inc.fotos.map((f) => ({ uid: f.uid, estado: f.estado, intentos: f.intentos, subida: f.subida })),
    }
  }

  function escribirIncidenciaYa(uid: string): Promise<void> {
    if (!puedeEscribir()) return Promise.resolve()
    const inc = estadoRef.current.incidencias.find((i) => i.uid === uid)
    if (!inc) return Promise.resolve()
    setHayBorrador(true)
    return guardarIncidencia(regDeIncidencia(inc))
  }

  function escribirFotoYa(incUid: string, f: FotoLocal): Promise<void> {
    if (!puedeEscribir() || f.faltante) return Promise.resolve()
    return guardarFoto({
      uid: f.uid,
      draftKey: draftKey!,
      incidenciaUid: incUid,
      blob: f.file,
      nombre: f.file.name,
      tipo: f.file.type || 'image/jpeg',
      guardadaEn: Date.now(),
    })
  }

  // Escritura con debounce corto: 'cab' = cabecera; cualquier otra clave = uid de incidencia
  function programar(clave: string) {
    if (!puedeEscribir()) return
    const t = timersRef.current.get(clave)
    if (t) clearTimeout(t)
    timersRef.current.set(clave, setTimeout(() => {
      timersRef.current.delete(clave)
      void (clave === 'cab' ? escribirCabeceraYa() : escribirIncidenciaYa(clave))
    }, DEBOUNCE_BORRADOR_MS))
  }

  function cancelarPendientes() {
    timersRef.current.forEach((t) => clearTimeout(t))
    timersRef.current.clear()
  }

  // Pasa lo pendiente a escritura inmediata y espera a que termine
  async function flushTodo(): Promise<void> {
    const claves = [...timersRef.current.keys()]
    cancelarPendientes()
    await Promise.all(claves.map((c) => (c === 'cab' ? escribirCabeceraYa() : escribirIncidenciaYa(c))))
    await vaciarEscrituras()
  }

  // Escribe TODO el formulario (cabecera + cada incidencia) y espera: se usa al tocar Guardar
  async function guardarCompleto(): Promise<void> {
    cancelarPendientes()
    await escribirCabeceraYa()
    await Promise.all(estadoRef.current.incidencias.map((i) => escribirIncidenciaYa(i.uid)))
    await vaciarEscrituras()
  }

  const flushRef = useRef(flushTodo)
  flushRef.current = flushTodo
  lock.antesDeSoltar(() => flushRef.current())

  async function guardarYa(): Promise<void> { await flushTodo() }

  // Cambia incidencias de forma síncrona sobre el último estado (sin cierres viejos)
  function mutarIncidencias(fn: (prev: IncidenciaLocal[]) => IncidenciaLocal[]) {
    const next = fn(estadoRef.current.incidencias)
    estadoRef.current = { ...estadoRef.current, incidencias: next }
    setIncidencias(next)
  }

  function cambiarRancho(v: string) {
    estadoRef.current = { ...estadoRef.current, ranchoId: v }
    setRanchoId(v)
    programar('cab')
  }
  function cambiarFecha(v: string) {
    estadoRef.current = { ...estadoRef.current, fecha: v }
    setFecha(v)
    programar('cab')
  }
  function cambiarAuditor(v: string) {
    estadoRef.current = { ...estadoRef.current, auditorNombre: v }
    setAuditorNombre(v)
    programar('cab')
  }

  function actualizarFoto(incUid: string, fotoUid: string, patch: Partial<FotoLocal>) {
    mutarIncidencias((prev) => prev.map((inc) => inc.uid !== incUid ? inc : {
      ...inc,
      fotos: inc.fotos.map((f) => f.uid === fotoUid ? { ...f, ...patch } : f),
    }))
  }

  function agregarFotos(incUid: string, fotos: FotoLocal[]) {
    mutarIncidencias((prev) => prev.map((inc) => inc.uid === incUid ? { ...inc, fotos: [...inc.fotos, ...fotos] } : inc))
    // La foto original se escribe una sola vez, antes de procesarla
    fotos.forEach((f) => { void escribirFotoYa(incUid, f) })
    void escribirCabeceraYa()
    void escribirIncidenciaYa(incUid)
  }

  function quitarFotoDe(incUid: string, fotoUid: string) {
    const foto = estadoRef.current.incidencias.find((i) => i.uid === incUid)?.fotos.find((f) => f.uid === fotoUid)
    if (foto) URL.revokeObjectURL(foto.preview)
    mutarIncidencias((prev) => prev.map((inc) => inc.uid === incUid
      ? { ...inc, fotos: inc.fotos.filter((f) => f.uid !== fotoUid) }
      : inc))
    if (puedeEscribir()) void borrarFoto(fotoUid)
    void escribirIncidenciaYa(incUid)
  }

  async function procesarUnaFoto(incUid: string, fotoUid: string) {
    const buscar = () => estadoRef.current.incidencias.find((i) => i.uid === incUid)?.fotos.find((f) => f.uid === fotoUid)
    const foto = buscar()
    if (!foto || foto.estado === 'lista' || foto.faltante) return
    registrarEvento('M13', 'foto_recibida', { mb: Math.round((foto.file.size / 1048576) * 10) / 10, intento: foto.intentos + 1 }, profile?.org_id)
    // Contar el intento y guardarlo ANTES de optimizar: si la página muere, queda marcado.
    actualizarFoto(incUid, fotoUid, { intentos: foto.intentos + 1, procesando: true })
    void escribirIncidenciaYa(incUid)
    await vaciarEscrituras()
    const res = await optimizarImagen(foto.file, 5.5)
    const actual = buscar()
    if (!actual) return   // la quitaron mientras se optimizaba
    if (res.optimizada) {
      URL.revokeObjectURL(actual.preview)
      actualizarFoto(incUid, fotoUid, {
        file: res.file,
        preview: URL.createObjectURL(res.file),
        estado: 'lista',
        procesando: false,
      })
      // Se reemplaza solo esta foto
      const optimizada = buscar()
      if (optimizada) void escribirFotoYa(incUid, optimizada)
      registrarEvento('M13', 'foto_optimizada', { ...res.info }, profile?.org_id)
    } else if (actual.file.size <= 5.5 * 1048576) {
      // No se pudo optimizar pero ya cumple el límite del módulo: se acepta tal cual.
      actualizarFoto(incUid, fotoUid, { estado: 'lista', procesando: false })
      registrarEvento('M13', 'foto_sin_optimizar_aceptada', { ...res.info }, profile?.org_id)
    } else {
      actualizarFoto(incUid, fotoUid, { procesando: false })
      registrarEvento('M13', 'foto_fallo', { ...res.info, mensaje: 'no se pudo optimizar' }, profile?.org_id)
      toast.warning('No se pudo optimizar la foto. Baja la resolución de la cámara (por ejemplo 12 MP) y vuelve a tomarla.', { duration: 8000 })
    }
    void escribirIncidenciaYa(incUid)
    await vaciarEscrituras()
  }

  // Optimiza fotos de una en una (cola global: nunca dos a la vez)
  function procesarFotos(incUid: string, fotoUids: string[]): Promise<void> {
    const tarea = colaFotosRef.current.then(async () => {
      estadoProc.activo = true
      const total = fotoUids.length
      const toastId = toast.loading(`Optimizando foto 1 de ${total}…`)
      try {
        for (let i = 0; i < total; i++) {
          toast.loading(`Optimizando foto ${i + 1} de ${total}…`, { id: toastId })
          try {
            await procesarUnaFoto(incUid, fotoUids[i])
          } catch (e) {
            registrarEvento('M13', 'foto_fallo', { mensaje: String((e as { message?: string } | null)?.message ?? e).slice(0, 200) }, profile?.org_id)
            actualizarFoto(incUid, fotoUids[i], { procesando: false })
          }
        }
      } finally {
        toast.dismiss(toastId)
        estadoProc.activo = false
        // Marca de cámara: se limpia cuando todas quedaron listas o fallaron sin cerrar la página
        try { sessionStorage.removeItem('m13:camara') } catch { /* ignore */ }
      }
    })
    colaFotosRef.current = tarea.catch(() => {})
    return tarea
  }

  // Única señal visible: si el guardado en el teléfono falla tras los reintentos
  useEffect(() => suscribirEstadoBorrador((ok, fallo) => {
    if (ok) { setFalloGuardado(false); return }
    setFalloGuardado(true)
    const e = estadoRef.current
    registrarEvento('M13', 'borrador_fallo', {
      etapa: fallo?.etapa,
      incidencias: e.incidencias.length,
      fotos: e.incidencias.reduce((n, i) => n + i.fotos.length, 0),
      nombre_error: fallo?.nombreError,
      mensaje: fallo?.mensaje,
    }, profile?.org_id)
  }), [profile?.org_id])

  // Lo pendiente se escribe de inmediato si la pestaña se oculta o se cierra
  useEffect(() => {
    const alOcultar = () => { if (document.visibilityState === 'hidden') void flushRef.current() }
    const alCerrar = () => { void flushRef.current() }
    document.addEventListener('visibilitychange', alOcultar)
    window.addEventListener('pagehide', alCerrar)
    return () => {
      document.removeEventListener('visibilitychange', alOcultar)
      window.removeEventListener('pagehide', alCerrar)
    }
  }, [])

  // Inicialización: almacenamiento persistente, limpieza y check de borrador existente
  useEffect(() => {
    if (!draftKey) return
    pedirAlmacenamientoPersistente()
    limpiarBorradoresViejos().catch(() => {})
    cargarBorrador(draftKey, false)
      .then((draft) => {
        if (!draft) return
        setHayBorrador(true)
        reporteIdRef.current = draft.cabecera.reporteServidorId ?? null
        reporteInsertadoRef.current = !!draft.cabecera.reporteInsertado
        setReporteInsertado(reporteInsertadoRef.current)
        // ¿La página murió con la cámara abierta o procesando una foto?
        let reinicio = false
        try {
          reinicio = sessionStorage.getItem('m13:camara') === '1'
          sessionStorage.removeItem('m13:camara')
        } catch { /* ignore */ }
        const fotoProblema = draft.incidencias
          .flatMap((i) => i.fotos)
          .find((f) => f.ref.estado === 'original' && (f.ref.intentos ?? 0) >= 1)
        if (fotoProblema) {
          registrarEvento('M13', 'reinicio_procesando_foto', { intentos: fotoProblema.ref.intentos ?? 0 }, profile?.org_id)
        }
        if (reinicio || fotoProblema) {
          toast.info('La app se reinició al procesar la foto. Recuperamos tu borrador.', { duration: 8000 })
          setAbrirBorradorPendiente(true)
        }
      })
      .catch(() => {})
  }, [draftKey])

  // Abre el borrador directamente tras un reinicio (sin esperar a que toque "+")
  useEffect(() => {
    if (!abrirBorradorPendiente || !draftKey) return
    setAbrirBorradorPendiente(false)
    void handleContinuarBorrador()
  }, [abrirBorradorPendiente, draftKey])

  function abrirSheetFresco() {
    cancelarPendientes()
    sinEscrituraRef.current = false
    reporteIdRef.current = null
    reporteInsertadoRef.current = false
    setReporteInsertado(false)
    setRanchoId(ranchoInicial ?? '')
    setFecha(hoy())
    setAuditorNombre('')
    const inicial = [nuevaIncidencia()]
    estadoRef.current = { ranchoId: ranchoInicial ?? '', fecha: hoy(), auditorNombre: '', incidencias: inicial }
    setIncidencias(inicial)
    setErrRancho(false)
    setProgreso(null)
    setPendienteFirmaId(null)
    setPendienteReporteParaPDF(null)
    setSheetPaso(obligatoria && !tengoFirma ? 'firma_gate' : 'form')
    setSheetAbierto(true)
  }

  function handleCerrarSheet() {
    if (guardando) return
    void flushTodo()
    setSheetAbierto(false)
    setSheetPaso('form')
    setPendienteFirmaId(null)
    setPendienteReporteParaPDF(null)
  }

  function abrirSheet() {
    if (hayBorrador) { setConfirmDraftVisible(true); return }
    abrirSheetFresco()
  }

  // Arma el formulario desde cabecera + incidencias + fotos del teléfono
  async function aplicarBorrador() {
    if (!draftKey) return null
    const draft = await cargarBorrador(draftKey)
    if (!draft) return null
    const incs: IncidenciaLocal[] = draft.incidencias.map(({ reg, fotos }) => ({
      uid: reg.uid,
      descripcion: reg.descripcion,
      insertada: reg.insertada,
      fotos: fotos.map(({ ref, reg: fr }): FotoLocal => fr
        ? {
            uid: ref.uid,
            file: new File([fr.blob], fr.nombre, { type: fr.tipo }),
            preview: URL.createObjectURL(fr.blob),
            estado: ref.estado ?? 'lista',
            intentos: ref.intentos ?? 0,
            subida: ref.subida,
          }
        : {
            uid: ref.uid,
            file: new File([], 'faltante.jpg', { type: 'image/jpeg' }),
            preview: '',
            estado: 'lista',
            intentos: 0,
            subida: ref.subida,
            faltante: !ref.subida,
          }),
    }))
    const lista = incs.length > 0 ? incs : [nuevaIncidencia()]
    const c = draft.cabecera
    estadoRef.current = { ranchoId: c.ranchoId, fecha: c.fecha || hoy(), auditorNombre: c.auditorNombre, incidencias: lista }
    setRanchoId(c.ranchoId)
    setFecha(c.fecha || hoy())
    setAuditorNombre(c.auditorNombre)
    setIncidencias(lista)
    reporteIdRef.current = c.reporteServidorId ?? null
    reporteInsertadoRef.current = !!c.reporteInsertado
    setReporteInsertado(reporteInsertadoRef.current)
    return draft
  }

  async function handleContinuarBorrador() {
    setConfirmDraftVisible(false)
    if (!draftKey) { abrirSheetFresco(); return }
    try {
      cancelarPendientes()
      sinEscrituraRef.current = false
      const draft = await aplicarBorrador()
      if (!draft) { abrirSheetFresco(); return }
      setErrRancho(false)
      setProgreso(null)
      setPendienteFirmaId(null)
      setPendienteReporteParaPDF(null)
      setSheetPaso(obligatoria && !tengoFirma ? 'firma_gate' : 'form')
      setSheetAbierto(true)
      // Originales que nunca se intentaron: se procesan solas. Las de intentos >= 1
      // no (volverían a cerrar la página): esperan a que el usuario decida.
      for (const { reg, fotos } of draft.incidencias) {
        const pendientes = fotos.filter((f) => f.reg && f.ref.estado === 'original' && (f.ref.intentos ?? 0) === 0).map((f) => f.ref.uid)
        if (pendientes.length > 0) void procesarFotos(reg.uid, pendientes)
      }
    } catch {
      abrirSheetFresco()
    }
  }

  // Único borrado manual. Pide confirmación; si el reporte llegó a crearse en el
  // servidor a medias, también se quita para no dejar un reporte incompleto.
  async function handleDescartarBorrador() {
    setConfirmDraftVisible(false)
    const ok = await confirmar({
      titulo: '¿Descartar el borrador?',
      descripcion: 'Se perderán las incidencias y fotos guardadas en este teléfono. No se puede deshacer.',
      textoConfirmar: 'Descartar',
      tono: 'peligro',
    })
    if (!ok) { setConfirmDraftVisible(true); return }
    cancelarPendientes()
    sinEscrituraRef.current = true
    if (draftKey) {
      try {
        const id = reporteInsertadoRef.current ? reporteIdRef.current : null
        if (id && online && profile?.org_id) {
          const draft = await cargarBorrador(draftKey, false)
          const paths = (draft?.incidencias ?? []).flatMap((i) =>
            i.fotos.filter((f) => f.ref.subida).map((f) => `${profile.org_id}/${id}/${i.reg.uid}/${f.ref.uid}.jpg`))
          if (paths.length > 0) await borrarFotos(paths)
          await supabase.from('m13_reportes').delete().eq('id', id)
        }
      } catch { /* el servidor se limpia después; el borrador local sí se descarta */ }
      await borrarBorrador(draftKey).catch(() => {})
    }
    setHayBorrador(false)
    abrirSheetFresco()
  }

  function actualizarIncidencia(uid: string, upd: Partial<IncidenciaLocal>) {
    mutarIncidencias((prev) => prev.map((inc) => (inc.uid === uid ? { ...inc, ...upd } : inc)))
    programar(uid)
    programar('cab')
  }

  function quitarIncidencia(uid: string) {
    const quitada = estadoRef.current.incidencias.find((i) => i.uid === uid)
    quitada?.fotos.forEach((f) => URL.revokeObjectURL(f.preview))
    const t = timersRef.current.get(uid)
    if (t) { clearTimeout(t); timersRef.current.delete(uid) }
    mutarIncidencias((prev) => prev.filter((i) => i.uid !== uid))
    if (puedeEscribir()) void borrarIncidencia(uid)
    void escribirCabeceraYa()
  }

  function agregarIncidencia() {
    const nueva = nuevaIncidencia()
    mutarIncidencias((prev) => [...prev, nueva])
    void escribirCabeceraYa()
    void escribirIncidenciaYa(nueva.uid)
  }

  // ── Validación ──────────────────────────────────────────────────────────────

  function validarFormulario(): boolean {
    if (!ranchoId) { setErrRancho(true); return false }
    if (!profile?.org_id) { toast.error('Sin organización activa'); return false }
    if (incidencias.length === 0) {
      toast.error('Agrega al menos una incidencia')
      return false
    }
    if (incidencias.some((inc) => inc.fotos.some((f) => f.faltante))) {
      toast.warning('Falta una foto: vuelve a agregarla o quítala')
      return false
    }
    if (incidencias.some((inc) => inc.fotos.some((f) => f.estado === 'original'))) {
      toast.warning('Hay fotos sin optimizar')
      return false
    }
    for (let i = 0; i < incidencias.length; i++) {
      const inc = incidencias[i]
      if (!inc.descripcion.trim()) {
        toast.error(`La incidencia ${i + 1} necesita descripción`)
        return false
      }
      if (inc.fotos.length === 0) {
        toast.error(`La incidencia ${i + 1} necesita al menos 1 foto`)
        return false
      }
    }
    return true
  }

  // ── Guardar ─────────────────────────────────────────────────────────────────

  // El reporte quedó confirmado (servidor u outbox): recién ahora se borra el borrador
  async function borrarBorradorConfirmado() {
    cancelarPendientes()
    sinEscrituraRef.current = true
    if (draftKey) {
      try { await borrarBorrador(draftKey) } catch (e) {
        registrarEvento('M13', 'borrador_fallo', { etapa: 'borrar', nombre_error: String((e as { name?: string })?.name ?? 'Error'), mensaje: String((e as { message?: string })?.message ?? e).slice(0, 200) }, profile?.org_id)
      }
    }
    reporteIdRef.current = null
    reporteInsertadoRef.current = false
    setReporteInsertado(false)
    setHayBorrador(false)
  }

  async function guardarSinConexion(orgId: string, totalFotosASubir: number) {
    setGuardando(true)
    try {
      // Si un intento anterior ya creó el reporte, se completa ese; si no, uno nuevo
      const reporteYaCreado = reporteInsertadoRef.current && reporteIdRef.current
      const localReporteId = reporteYaCreado ? reporteIdRef.current! : crypto.randomUUID()
      const rancho = ranchos.find(r => r.id === ranchoId)
      const adjuntosParaEncolar: Omit<AdjuntoOutbox, 'loteId'>[] = []
      const operaciones = []

      if (!reporteYaCreado) {
        operaciones.push({
          tabla: 'm13_reportes',
          tipo: 'insert' as const,
          fila: {
            id: localReporteId,
            org_id: orgId,
            rancho_id: ranchoId,
            fecha,
            auditor_nombre: auditorNombre.trim() || null,
            realizado_por_id: profile!.id,
          } as Record<string, unknown>,
        })
      }

      let fotosEncoladas = 0
      for (let i = 0; i < incidencias.length; i++) {
        const inc = incidencias[i]
        if (!inc.insertada) {
          operaciones.push({
            tabla: 'm13_incidencias',
            tipo: 'insert' as const,
            fila: {
              id: inc.uid,
              reporte_id: localReporteId,
              org_id: orgId,
              orden: i + 1,
              descripcion: inc.descripcion.trim(),
            } as Record<string, unknown>,
          })
        }
        for (let j = 0; j < inc.fotos.length; j++) {
          const foto = inc.fotos[j]
          if (foto.subida) continue
          const path = `${orgId}/${localReporteId}/${inc.uid}/${foto.uid}.jpg`
          adjuntosParaEncolar.push({ uid: foto.uid, blob: foto.file, path, bucket: 'incidencias' })
          fotosEncoladas++
          operaciones.push({
            tabla: 'm13_incidencia_fotos',
            tipo: 'insert' as const,
            fila: {
              id: foto.uid,
              incidencia_id: inc.uid,
              org_id: orgId,
              storage_path: path,
              orden: j + 1,
            } as Record<string, unknown>,
          })
        }
      }

      const ok = await guardarOffline({
        descripcion: `Reporte de Incidencias · ${rancho?.nombre ?? ''} · ${fecha}`,
        metadatos: { rancho_id: ranchoId, rancho_nombre: rancho?.nombre, fecha, incidencias_count: incidencias.length, fotos_count: fotosEncoladas || totalFotosASubir },
        operaciones,
        adjuntos: adjuntosParaEncolar,
      })
      if (ok) {
        // Lote y adjuntos quedaron escritos en el outbox: ya se puede borrar el borrador
        await borrarBorradorConfirmado()
        if (tareaId) setRegistroGuardado(true)
        handleCerrarSheet()
      }
      return
    } catch (err: unknown) {
      toast.error(err instanceof Error ? err.message : 'No se pudo guardar el reporte offline')
      return
    } finally {
      setGuardando(false)
    }
  }

  async function handleGuardar() {
    if (!validarFormulario()) return
    if (!user?.id) { toast.error('Sin sesión activa'); return }
    const orgId = profile!.org_id!
    const totalFotosASubir = incidencias.reduce((sum, inc) => sum + inc.fotos.filter((f) => !f.subida).length, 0)

    // Primero se fuerza la escritura de todo en el teléfono; recién después se sube o se encola
    setGuardando(true)
    try { await guardarCompleto() } finally { setGuardando(false) }

    if (!online) {
      await guardarSinConexion(orgId, totalFotosASubir)
      return
    }

    if (totalFotosASubir > FOTOS_PARA_AVISO) {
      const subirAhora = await confirmar({
        titulo: 'Reporte con muchas fotos',
        descripcion: `Son ${totalFotosASubir} fotos. Con señal débil puede tardar varios minutos. Puedes guardarlo sin conexión y se subirá solo.`,
        textoConfirmar: 'Subir ahora',
        textoCancelar: 'Guardar sin conexión',
      })
      if (!subirAhora) {
        await guardarSinConexion(orgId, totalFotosASubir)
        return
      }
    }

    setGuardando(true)
    setProgreso({ total: totalFotosASubir, procesadas: 0, fallidas: 0, fase: reporteInsertadoRef.current ? 'fotos' : 'reporte' })
    const inicioMs = Date.now()
    registrarEvento('M13', 'guardar_inicio', { incidencias: incidencias.length, fotos: totalFotosASubir, retoma: reporteInsertadoRef.current }, orgId)

    // Mismo id en cada reintento: si el reporte ya llegó al servidor no se duplica
    const reporteId = reporteIdRef.current ?? crypto.randomUUID()
    // IDs de incidencias guardadas y fotos subidas por incidencia (para PDF automático)
    const fotosSubidasPorIncidencia: Array<Array<{ id: string; storage_path: string; orden: number }>> = incidencias.map(() => [])

    try {
      // PASO 1: INSERT reporte padre (se omite si un intento anterior ya lo creó)
      // Si no responde en 20 s o falla por red, se ofrece guardar sin conexión (el borrador no se toca)
      if (!reporteInsertadoRef.current) {
        reporteIdRef.current = reporteId
        if (draftKey) await guardarCabecera(draftKey, { reporteServidorId: reporteId })
        let reporteResp: Awaited<ReturnType<typeof insertarReporte>> | null = null
        let temporizador: ReturnType<typeof setTimeout> | undefined
        const insertarReporte = () => supabase
          .from('m13_reportes')
          .insert({
            id: reporteId,
            org_id: orgId,
            rancho_id: ranchoId,
            fecha,
            auditor_nombre: auditorNombre.trim() || null,
            realizado_por_id: profile!.id,
          })
          .select('id')
          .single()
        try {
          reporteResp = await Promise.race([
            insertarReporte(),
            new Promise<never>((_, rej) => { temporizador = setTimeout(() => rej(new Error('TIMEOUT_RED: La conexión tardó demasiado')), TIEMPO_PASO1_MS) }),
          ])
        } catch (e) {
          if (!esErrorDeRed(e)) throw e
          registrarEvento('M13', 'guardar_paso1_timeout', { ms: Date.now() - inicioMs, mensaje: String((e as { message?: string })?.message ?? e).slice(0, 120) }, orgId)
          setGuardando(false)
          setProgreso(null)
          const aceptar = await confirmar({
            titulo: 'La conexión no está respondiendo',
            descripcion: '¿Guardar sin conexión? Se subirá solo cuando vuelva la señal.',
            textoConfirmar: 'Guardar sin conexión',
          })
          if (aceptar) await guardarSinConexion(orgId, totalFotosASubir)
          return
        } finally {
          clearTimeout(temporizador)
        }
        const { error: errReporte } = reporteResp!
        if (errReporte && !yaExiste(errReporte)) throw errReporte
        reporteInsertadoRef.current = true
        setReporteInsertado(true)
        if (draftKey) await guardarCabecera(draftKey, { reporteServidorId: reporteId, reporteInsertado: true })
      }
      setProgreso({ total: totalFotosASubir, procesadas: 0, fallidas: 0, fase: 'fotos' })

      // PASO 2: INSERT (o actualiza) todas las incidencias — texto sin fotos, los comentarios quedan guardados
      for (let i = 0; i < incidencias.length; i++) {
        const inc = incidencias[i]
        if (inc.insertada) {
          const { error: errUpd } = await supabase
            .from('m13_incidencias')
            .update({ orden: i + 1, descripcion: inc.descripcion.trim() })
            .eq('id', inc.uid)
          if (errUpd) throw errUpd
        } else {
          const { error: errInc } = await supabase
            .from('m13_incidencias')
            .insert({
              id: inc.uid,
              reporte_id: reporteId,
              org_id: orgId,
              orden: i + 1,
              descripcion: inc.descripcion.trim(),
            })
          if (errInc && !yaExiste(errInc)) throw errInc
          mutarIncidencias((prev) => prev.map((x) => x.uid === inc.uid ? { ...x, insertada: true } : x))
          void escribirIncidenciaYa(inc.uid)
        }
      }

      // PASO 3: Subir fotos secuencialmente con reintento (hasta MAX_REINTENTOS_FOTO por foto)
      let procesadas = 0
      let fallidas = 0
      const detalleFallos: string[] = []
      let sesionExpirada = false

      for (let i = 0; i < incidencias.length && !sesionExpirada; i++) {
        const inc = incidencias[i]

        for (let j = 0; j < inc.fotos.length; j++) {
          const fotoLocal = inc.fotos[j]
          const path = `${orgId}/${reporteId}/${inc.uid}/${fotoLocal.uid}.jpg`
          if (fotoLocal.subida) {
            fotosSubidasPorIncidencia[i].push({ id: fotoLocal.uid, storage_path: path, orden: j + 1 })
            continue
          }
          let subida = false
          let motivoFallo = 'error desconocido'

          for (let intento = 0; intento < MAX_REINTENTOS_FOTO; intento++) {
            try {
              let archivoASubir: File
              archivoASubir =
                fotoLocal.file.type === 'image/jpeg' && fotoLocal.file.size <= 1.5 * 1024 * 1024
                  ? fotoLocal.file
                  : await comprimirImagen(fotoLocal.file, 5.5)
              if (archivoASubir.size > MAX_FOTO_BYTES) {
                throw new Error(
                  `La foto ${j + 1} de la incidencia ${i + 1} es demasiado grande (${(archivoASubir.size / 1024 / 1024).toFixed(1)} MB). Usa una foto con menor resolución.`
                )
              }
              try {
                await subirFoto(path, archivoASubir)
              } catch (e) {
                if (!yaExiste(e)) throw e   // el archivo ya estaba arriba de un intento anterior
              }
              const { error: errFoto } = await supabase
                .from('m13_incidencia_fotos')
                .insert({
                  id: fotoLocal.uid,
                  incidencia_id: inc.uid,
                  org_id: orgId,
                  storage_path: path,
                  orden: j + 1,
                })
              if (errFoto && !yaExiste(errFoto)) throw errFoto
              fotosSubidasPorIncidencia[i].push({ id: fotoLocal.uid, storage_path: path, orden: j + 1 })
              mutarIncidencias((prev) => prev.map((x) => x.uid !== inc.uid ? x : {
                ...x,
                fotos: x.fotos.map((f) => f.uid === fotoLocal.uid ? { ...f, subida: true } : f),
              }))
              void escribirIncidenciaYa(inc.uid)
              subida = true
              break
            } catch (e) {
              console.error(`M13 foto ${j + 1} intento ${intento + 1}/${MAX_REINTENTOS_FOTO}:`, e)
              const msg = (e as { message?: string } | null)?.message ?? ''
              if (msg) motivoFallo = msg
              // Detectar sesión expirada (401/JWT) — abortar subida
              if (msg.includes('401') || msg.includes('JWT') || msg.toLowerCase().includes('token')) {
                sesionExpirada = true
                break
              }
              // Foto demasiado grande — no tiene sentido reintentar
              if (msg.includes('demasiado grande')) break
            }
          }

          if (!subida) {
            fallidas++
            detalleFallos.push(`Foto ${j + 1} de la incidencia ${i + 1}: ${motivoFallo}`)
          }
          procesadas++
          setProgreso({ total: totalFotosASubir, procesadas, fallidas, fase: 'fotos' })
        }
      }

      await vaciarEscrituras()

      // Sesión expirada durante la subida — el reporte y comentarios ya están guardados; el borrador se queda
      if (sesionExpirada) {
        toast.error(
          'Tu sesión expiró durante la subida. Tu borrador sigue guardado: vuelve a iniciar sesión y toca "Terminar de subir".',
          { duration: 10000 }
        )
        setSheetAbierto(false)
        await refetch()
        return
      }

      registrarEvento('M13', 'guardar_fin', { ms: Date.now() - inicioMs, fallidas }, orgId)

      // PASO 4: Resultado. Con fotos fallidas el reporte NO está confirmado: el borrador se queda
      if (fallidas > 0) {
        toast.warning(
          `${fallidas} foto(s) no se pudieron subir (${detalleFallos.slice(0, 3).join('; ')}${detalleFallos.length > 3 ? '…' : ''}). Tu borrador sigue guardado: toca "Terminar de subir" para reintentar.`,
          { duration: 12000 }
        )
        await refetch()
        return
      }

      toast.success('Reporte guardado correctamente')
      if (tareaId) setRegistroGuardado(true)
      await refetch()
      await refetchFirmas()
      // Servidor confirmó reporte, todas sus incidencias y todas sus fotos: se borra el borrador
      await borrarBorradorConfirmado()

      // PASO 5: Preparar para firma y PDF
      const ranchoInfo = ranchos.find((r) => r.id === ranchoId)
      const reporteParaPDF: M13ReporteConRancho = {
        id: reporteId,
        org_id: orgId,
        rancho_id: ranchoId,
        rancho_nombre: ranchoInfo?.nombre ?? '—',
        rancho_codigo: (ranchoInfo as any)?.codigo ?? '',
        fecha,
        auditor_nombre: auditorNombre.trim() || null,
        realizado_por_id: profile!.id,
        created_at: new Date().toISOString(),
        creado_por: profile!.id,
        creado_por_nombre: profile!.nombre_completo ?? '—',
        requiere_correccion: false,
        comentario_correccion: null,
        marcado_por: null,
        marcado_en: null,
        incidencias: incidencias.map((inc, i) => ({
          id: inc.uid,
          orden: i + 1,
          descripcion: inc.descripcion.trim(),
          fotos: fotosSubidasPorIncidencia[i],
        })),
      }
      setPendienteReporteParaPDF(reporteParaPDF)
      setPendienteFirmaId(reporteId)
      setSheetPaso('firma_decision')

    } catch (err: unknown) {
      const mensaje = (err as { message?: string } | null)?.message || 'No se pudo guardar el reporte'
      if (mensaje.includes('FECHA_SOLO_HOY')) {
        toast.warning('Solo puedes registrar con la fecha de hoy')
      } else {
        toast.error(`${mensaje}. Tu borrador sigue guardado.`, { duration: 7000 })
      }
      // Sin rollback: lo ya subido se conserva y el reintento ("Terminar de subir") retoma desde ahí
    } finally {
      setGuardando(false)
      setProgreso(null)
    }
  }

  // ── PDF individual ──────────────────────────────────────────────────────────

  async function handleDescargarPDF(reporte: M13ReporteConRancho) {
    setGenerandoPDF(reporte.id)
    try {
      await generarReporteIncidenciasPDF(reporte)
    } catch (err: unknown) {
      toast.error(err instanceof Error ? err.message : 'No se pudo generar el PDF')
    } finally {
      setGenerandoPDF(null)
    }
  }

  // ── PDF consolidado ─────────────────────────────────────────────────────────

  async function handleGenerarConsolidado() {
    if (!consDesde || !consHasta) { setErrConsFechas(true); return }
    if (!profile?.org_id) { toast.error('Sin organización activa'); return }
    setGenerandoConsolidado(true)
    try {
      await generarReporteIncidenciasConsolidadoPDF(
        profile.org_id,
        consDesde,
        consHasta,
        consRanchoId || undefined,
      )
      setSheetConsolidadoAbierto(false)
    } catch (err: unknown) {
      toast.error(err instanceof Error ? err.message : 'No se pudo generar el PDF consolidado')
    } finally {
      setGenerandoConsolidado(false)
    }
  }

  // ── Eliminar reporte ────────────────────────────────────────────────────────

  async function handleEliminar(reporte: M13ReporteConRancho) {
    const paths = reporte.incidencias.flatMap((inc) => inc.fotos.map((f) => f.storage_path))
    try {
      if (paths.length > 0) await borrarFotos(paths)
      const { error } = await supabase
        .from('m13_reportes')
        .delete()
        .eq('id', reporte.id)
      if (error) throw error
      toast.success('Reporte eliminado')
      await refetch()
    } catch (err: unknown) {
      toast.error(err instanceof Error ? err.message : 'No se pudo eliminar el reporte')
    }
  }

  // ── Render ──────────────────────────────────────────────────────────────────

  return (
    <div className="min-h-full pb-safe-nav">

      {/* Header */}
      <ModuloHeader tituloFallback={TITULO_MODULO} subtitulo={CLAVE_MODULO} />

      <BannerTareaOrigen tareaId={tareaId} registroGuardado={registroGuardado} />

      {/* Acción consolidado */}
      <div className="px-4 pt-3">
        <BotonExportarConsolidado
          onClick={() => {
            setConsRanchoId('')
            setConsDesde('')
            setConsHasta(hoy())
            setErrConsFechas(false)
            setSheetConsolidadoAbierto(true)
          }}
        />
      </div>

      {/* Lista de reportes */}
      <div className="p-4 space-y-3">
        {/* Reportes pendientes offline */}
        {lotesOffline.map(lote => {
          const meta = lote.metadatos as { rancho_nombre?: string; fecha?: string; incidencias_count?: number; fotos_count?: number } | undefined
          return (
            <div key={lote.id} className="bg-card border border-border rounded-xl p-4 opacity-80">
              <div className="flex items-start justify-between gap-3">
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2 mb-1 flex-wrap">
                    <span className="text-sm text-foreground truncate font-semibold">
                      {meta?.rancho_nombre ?? '—'}
                    </span>
                    {meta?.incidencias_count && (
                      <Etiqueta tono="neutral">
                        {meta.incidencias_count} incidencia{meta.incidencias_count !== 1 ? 's' : ''}
                      </Etiqueta>
                    )}
                    {meta?.fotos_count && (
                      <Etiqueta tono="neutral">
                        {meta.fotos_count} foto{meta.fotos_count !== 1 ? 's' : ''}
                      </Etiqueta>
                    )}
                  </div>
                  <p className="text-xs text-muted-foreground">{meta?.fecha ? formatFecha(meta.fecha) : '—'}</p>
                </div>
                <ChipOffline lote={lote} />
              </div>
              {lote.estado === 'rechazado' && lote.error && (
                <p className="text-xs mt-1" style={{ color: 'var(--agro-danger-text)' }}>{lote.error}</p>
              )}
            </div>
          )
        })}
        {loading ? (
          <ListaSkeleton />
        ) : reportes.length === 0 && lotesOffline.length === 0 ? (
          <EstadoVacio icono={ClipboardList} titulo="Sin reportes aún" ayuda="Toca + para registrar el primer reporte de incidencias" />
        ) : (
          reportes.map((r) => {
            const totalFotosReporte = r.incidencias.reduce((acc, inc) => acc + inc.fotos.length, 0)
            const abierto = expandido === r.id
            return (
              <div
                key={r.id}
                className="bg-card rounded-xl border overflow-hidden"
                style={{
                  borderColor: r.requiere_correccion ? 'var(--agro-menta)' : 'var(--border)',
                  backgroundColor: r.requiere_correccion ? 'var(--agro-info-fill)' : undefined,
                }}
              >
                {/* Comentario de corrección */}
                {r.requiere_correccion && r.comentario_correccion && (
                  <div
                    className="flex items-start gap-2 px-4 pt-3 text-xs"
                    style={{ color: 'var(--agro-info-text)' }}
                  >
                    <AlertTriangle className="w-3 h-3 flex-shrink-0 mt-0.5" />
                    {r.comentario_correccion}
                  </div>
                )}

                <div className="p-4">
                  <div className="flex items-start justify-between gap-3">
                    <div
                      className="flex-1 min-w-0 cursor-pointer"
                      onClick={() => setExpandido(abierto ? null : r.id)}
                    >
                      <div className="flex items-center gap-2 mb-1 flex-wrap">
                        {orgNombre && (
                          <span className="text-xs text-muted-foreground font-medium">{orgNombre} ·</span>
                        )}
                        <span className="text-sm text-foreground truncate font-semibold">
                          {r.rancho_nombre}
                        </span>
                        <span
                          className="text-caption px-2 py-0.5 rounded flex-shrink-0 bg-muted text-muted-foreground font-semibold"
                        >
                          {r.incidencias.length} incidencia{r.incidencias.length !== 1 ? 's' : ''}
                        </span>
                        <Etiqueta tono="neutral">
                          {totalFotosReporte} foto{totalFotosReporte !== 1 ? 's' : ''}
                        </Etiqueta>
                      </div>
                      <p className="text-xs text-muted-foreground">{formatFecha(r.fecha)}</p>
                      {r.auditor_nombre && (
                        <p className="text-xs text-muted-foreground mt-0.5">
                          Auditor: {r.auditor_nombre}
                        </p>
                      )}
                      {r.creado_por_nombre !== '—' && (
                        <p className="text-xs text-muted-foreground mt-0.5">
                          Por: {r.creado_por_nombre}
                        </p>
                      )}
                    </div>

                    <div className="flex items-center gap-1 flex-shrink-0">
                      {/* PDF individual / Descargar PDF */}
                      <button
                        onClick={() => handleDescargarPDF(r)}
                        disabled={generandoPDF === r.id}
                        className="p-2 text-muted-foreground hover:text-primary transition-colors disabled:opacity-50"
                        title="Descargar PDF"
                      >
                        {generandoPDF === r.id
                          ? <Loader2 className="w-4 h-4 animate-spin" />
                          : <FileDown className="w-4 h-4" />
                        }
                      </button>
                      {/* Eliminar */}
                      <button
                        onClick={() => handleEliminar(r)}
                        disabled={!online}
                        title={!online ? 'Necesitas conexión para eliminar' : 'Eliminar reporte'}
                        className="p-2 text-muted-foreground hover:text-agro-red transition-colors disabled:opacity-40"
                      >
                        <Trash2 className="w-4 h-4" />
                      </button>
                    </div>
                  </div>

                  {/* Incidencias expandidas */}
                  {abierto && r.incidencias.length > 0 && (
                    <div className="mt-3 space-y-3 border-t border-border pt-3">
                      {r.incidencias.map((inc, idx) => (
                        <div key={inc.id}>
                          <p className="text-xs text-muted-foreground mb-1 font-semibold">
                            Incidencia {idx + 1}
                          </p>
                          <p className="text-sm text-foreground">{inc.descripcion}</p>
                          <GaleriaFotos paths={inc.fotos.map((f) => f.storage_path)} />
                        </div>
                      ))}
                    </div>
                  )}
                  <FirmasRegistro modulo="M13" registroId={r.id} firma={firmas[r.id]} loadingFirmas={loadingFirmas} fechaRegistro={r.fecha} onFirmado={refetchFirmas} />
                </div>
              </div>
            )
          })
        )}
      </div>

      {/* FAB */}
            <Fab onClick={abrirSheet} aria-label="Nuevo reporte" />

      {/* Bottom Sheet — consolidado */}
      <BottomSheet open={sheetConsolidadoAbierto} onClose={() => !generandoConsolidado && setSheetConsolidadoAbierto(false)}>
            <div className="flex items-center justify-between px-4 pt-4 pb-3 border-b border-border flex-shrink-0">
              <h2 className="text-base text-foreground font-semibold">
                Exportar consolidado
              </h2>
              <button aria-label="Cerrar"
                onClick={() => !generandoConsolidado && setSheetConsolidadoAbierto(false)}
                className="p-1"
              >
                <X className="w-5 h-5 text-muted-foreground" />
              </button>
            </div>

            <div className="overflow-y-auto p-4 space-y-4">
              {/* Rancho (opcional) */}
              <div>
                <label className="block text-xs text-muted-foreground mb-1.5 font-semibold">
                  {terminosSitio.singular.toUpperCase()} (opcional — vacío = todos)
                </label>
                <select
                  value={consRanchoId}
                  onChange={(e) => setConsRanchoId(e.target.value)}
                  className={`w-full h-11 px-3 rounded-lg bg-input-background border border-border-control text-sm focus:outline-none focus:border-primary focus:ring-1 focus:ring-primary ${
                    !consRanchoId ? 'text-muted-foreground' : 'text-foreground'
                  }`}
                >
                  <option value="">{terminosSitio.plural}</option>
                  {ranchoOptions.map((o) => (
                    <option key={o.value} value={o.value}>{o.label}</option>
                  ))}
                </select>
              </div>

              {/* Desde */}
              <div>
                <label className="block text-xs text-muted-foreground mb-1.5 font-semibold">
                  DESDE *
                </label>
                <input
                  type="date"
                  value={consDesde}
                  onChange={(e) => { setConsDesde(e.target.value); setErrConsFechas(false) }}
                  className={`w-full h-11 px-3 rounded-lg bg-input-background border text-sm text-foreground focus:outline-none focus:border-primary focus:ring-1 focus:ring-primary ${
                    errConsFechas && !consDesde ? 'border-agro-red' : 'border-border-control'
                  }`}
                />
              </div>

              {/* Hasta */}
              <div>
                <label className="block text-xs text-muted-foreground mb-1.5 font-semibold">
                  HASTA *
                </label>
                <input
                  type="date"
                  value={consHasta}
                  onChange={(e) => { setConsHasta(e.target.value); setErrConsFechas(false) }}
                  className={`w-full h-11 px-3 rounded-lg bg-input-background border text-sm text-foreground focus:outline-none focus:border-primary focus:ring-1 focus:ring-primary ${
                    errConsFechas && !consHasta ? 'border-agro-red' : 'border-border-control'
                  }`}
                />
                {errConsFechas && (
                  <p className="text-xs text-agro-red mt-1">Indica el rango de fechas</p>
                )}
              </div>

              <p className="text-xs text-muted-foreground">
                La generacion puede tardar unos segundos si hay muchas fotos.
              </p>
            </div>

            <div className="p-4 border-t border-border flex-shrink-0">
              <button
                onClick={handleGenerarConsolidado}
                disabled={generandoConsolidado}
                className="w-full h-14 bg-primary text-white rounded-3xl flex items-center justify-center gap-2 disabled:opacity-50 hover:bg-agro-blue transition-colors font-semibold"
              >
                {generandoConsolidado && <Loader2 className="w-4 h-4 animate-spin" />}
                {generandoConsolidado ? 'Generando...' : 'Generar PDF consolidado'}
              </button>
            </div>
      </BottomSheet>

      {confirmarElemento}

      {/* Diálogo confirmación borrador */}
      {confirmDraftVisible && (
        <Portal>
        <div
          className="fixed inset-0 z-50 flex items-end justify-center p-4"
          style={{ backgroundColor: 'rgba(0,0,0,0.5)' }}
          onClick={() => setConfirmDraftVisible(false)}
        >
          <div
            className="w-full max-w-[390px] bg-card rounded-2xl p-6 space-y-4"
            onClick={(e) => e.stopPropagation()}
          >
            <div>
              <h3 className="text-base text-foreground mb-1 font-semibold">
                Tienes un borrador guardado
              </h3>
              <p className="text-sm text-muted-foreground">
                Hay un reporte sin terminar. ¿Quieres continuar donde lo dejaste o empezar uno nuevo?
              </p>
            </div>
            <div className="flex flex-col gap-2">
              <button
                onClick={handleContinuarBorrador}
                className="w-full h-12 bg-primary text-white rounded-xl text-sm hover:bg-agro-blue transition-colors font-semibold"
              >
                Continuar borrador
              </button>
              <button
                onClick={handleDescartarBorrador}
                className="w-full h-12 border border-border rounded-xl text-sm text-foreground hover:bg-muted transition-colors"
              >
                Descartar y empezar nuevo
              </button>
            </div>
          </div>
        </div>
        </Portal>
      )}

      {/* Bottom Sheet — formulario */}
      <BottomSheet open={sheetAbierto} onClose={handleCerrarSheet} height="85%">

            {/* Header sheet */}
            <div className="flex items-center justify-between px-4 pt-4 pb-3 border-b border-border flex-shrink-0">
              <div className="flex flex-col">
                <h2 className="text-base text-foreground font-semibold">
                  {sheetPaso === 'firma_decision' ? 'Firmar reporte' : sheetPaso === 'firma_gate' ? 'Registra tu firma' : 'Nuevo reporte'}
                </h2>
              </div>
              <button aria-label="Cerrar"
                onClick={handleCerrarSheet}
                className="p-1"
              >
                <X className="w-5 h-5 text-muted-foreground" />
              </button>
            </div>

            {sheetPaso === 'firma_gate' && (
              <FirmaGatePaso onFirmaGuardada={() => setSheetPaso('form')} />
            )}
            {sheetPaso === 'firma_decision' && pendienteFirmaId && (
              <PasoFirmaRegistro
                modulo="M13"
                ids={[pendienteFirmaId]}
                descripcion={`Reporte de Incidencias · ${formatFecha(fecha)} · ${ranchos.find(r => r.id === ranchoId)?.nombre ?? '—'}`}
                obligatoria={obligatoria}
                onFirmadoYPDF={async () => {
                  if (pendienteReporteParaPDF) {
                    try { await generarReporteIncidenciasPDF(pendienteReporteParaPDF) } catch {}
                  }
                  handleCerrarSheet()
                }}
                onDespues={!obligatoria ? handleCerrarSheet : undefined}
              />
            )}

            {sheetPaso === 'form' && (<>
            {!lock.esDueno && (
              <div className="flex items-center gap-3 px-4 py-3 border-b border-border text-sm flex-shrink-0" style={{ backgroundColor: 'var(--agro-info-fill)', color: 'var(--agro-info-text)' }}>
                <span className="flex-1 min-w-0">Este reporte está abierto en otra pestaña</span>
                <button type="button" onClick={lock.usarAqui} className="font-semibold underline flex-shrink-0">Usar aquí</button>
              </div>
            )}
            {falloGuardado && (
              <div className="flex items-center gap-2 px-4 py-2 border-b border-border text-xs flex-shrink-0" role="alert" style={{ backgroundColor: 'var(--agro-danger-fill)', color: 'var(--agro-danger-text)' }}>
                <AlertTriangle className="w-3 h-3 flex-shrink-0" />
                No se pudo guardar en el teléfono. No cierres esta pantalla.
              </div>
            )}
            <fieldset disabled={!lock.esDueno} className="contents">
            {/* Campos scrollables */}
            <div className="flex-1 overflow-y-auto p-4 space-y-4">

              {/* Sitio */}
              <div>
                <label className="block text-xs text-muted-foreground mb-1.5 font-semibold">
                  {terminosSitio.singular.toUpperCase()} *
                </label>
                <select
                  value={ranchoId}
                  onChange={(e) => { cambiarRancho(e.target.value); setErrRancho(false) }}
                  className={`w-full h-11 px-3 rounded-lg bg-input-background border text-sm focus:outline-none focus:border-primary focus:ring-1 focus:ring-primary ${
                    errRancho ? 'border-agro-red' : 'border-border-control'
                  } ${!ranchoId ? 'text-muted-foreground' : 'text-foreground'}`}
                >
                  <option value="" disabled>Seleccionar {terminosSitio.singular.toLowerCase()}</option>
                  {ranchoOptions.map((o) => (
                    <option key={o.value} value={o.value}>{o.label}</option>
                  ))}
                </select>
                {errRancho && <p className="text-xs text-agro-red mt-1">Selecciona {terminosSitio.genero === 'f' ? 'una' : 'un'} {terminosSitio.singular.toLowerCase()}</p>}
              </div>

              {/* Fecha */}
              <div>
                <label className="block text-xs text-muted-foreground mb-1.5 font-semibold">
                  FECHA DEL RECORRIDO *
                </label>
                <input
                  type="date"
                  value={fecha}
                  min={puedeEditarFecha ? undefined : hoy()}
                  max={puedeEditarFecha ? undefined : hoy()}
                  onChange={(e) => { if (puedeEditarFecha) cambiarFecha(e.target.value) }}
                  className="w-full h-11 px-3 rounded-lg bg-input-background border border-border-control text-sm text-foreground focus:outline-none focus:border-primary focus:ring-1 focus:ring-primary"
                />
              </div>

              {/* Auditor */}
              <div>
                <label className="block text-xs text-muted-foreground mb-1.5 font-semibold">
                  AUDITOR / QUIEN REALIZÓ EL RECORRIDO
                </label>
                <input maxLength={limiteTexto('m13_reportes', 'auditor_nombre')}
                  type="text"
                  value={auditorNombre}
                  onChange={(e) => cambiarAuditor(e.target.value)}
                  placeholder={profile?.nombre_completo ?? 'Nombre del auditor'}
                  className="w-full h-11 px-3 rounded-lg bg-input-background border border-border-control text-sm text-foreground focus:outline-none focus:border-primary focus:ring-1 focus:ring-primary"
                />
              </div>

              {/* Incidencias */}
              <div>
                {/* Header con contador de fotos */}
                <div className="flex items-center justify-between mb-2">
                  <label className="text-xs text-muted-foreground font-semibold">
                    INCIDENCIAS *
                  </label>
                  <span className="text-xs text-muted-foreground font-semibold">
                    {totalFotos} foto{totalFotos !== 1 ? 's' : ''} (máx. {MAX_FOTOS_INCIDENCIA} por incidencia)
                  </span>
                </div>

                <div className="space-y-3">
                  {incidencias.map((inc, idx) => (
                    <IncidenciaForm
                      key={inc.uid}
                      inc={inc}
                      index={idx}
                      onChange={(upd) => actualizarIncidencia(inc.uid, upd)}
                      onQuitar={() => quitarIncidencia(inc.uid)}
                      onAgregarFotos={agregarFotos}
                      onQuitarFoto={quitarFotoDe}
                      onProcesarFotos={procesarFotos}
                      onGuardarYa={guardarYa}
                      onBlurTexto={() => { void flushTodo() }}
                    />
                  ))}
                </div>

                <button
                  type="button"
                  onClick={agregarIncidencia}
                  className="mt-3 w-full h-10 flex items-center justify-center gap-2 rounded-xl border border-dashed border-primary text-primary text-sm hover:bg-primary/5 transition-colors font-semibold"
                >
                  <Plus className="w-4 h-4" />
                  Agregar incidencia
                </button>
              </div>

            </div>

            {/* Barra de progreso + Guardar */}
            <div className="border-t border-border flex-shrink-0">
              {guardando && progreso && (
                <div className="px-4 pt-3 pb-1 space-y-1.5">
                  <div className="flex justify-between text-xs text-muted-foreground">
                    <span>
                      {progreso.fase === 'reporte'
                        ? 'Guardando reporte…'
                        : progreso.procesadas < progreso.total
                          ? `Subiendo foto ${progreso.procesadas + 1} de ${progreso.total}`
                          : 'Finalizando...'}
                    </span>
                    <span className="font-semibold">
                      {progreso.procesadas} / {progreso.total}
                      {progreso.fallidas > 0 && (
                        <span style={{ color: 'var(--agro-info-text)' }}>
                          {' '}({progreso.fallidas} error{progreso.fallidas !== 1 ? 'es' : ''})
                        </span>
                      )}
                    </span>
                  </div>
                  <div className="h-1.5 bg-muted rounded-full overflow-hidden">
                    <div
                      className="h-full w-full bg-primary transition-transform duration-300 ease-[var(--ease-out)]"
                      style={{ transform: `translateX(-${100 - Math.round((progreso.procesadas / progreso.total) * 100)}%)` }}
                    />
                  </div>
                </div>
              )}
              <div className="p-4">
                <button
                  onClick={handleGuardar}
                  disabled={guardando}
                  className="w-full h-14 bg-primary text-white rounded-3xl flex items-center justify-center gap-2 disabled:opacity-50 hover:bg-agro-blue transition-colors font-semibold"
                >
                  {guardando && <Loader2 className="w-4 h-4 animate-spin" />}
                  {!guardando && !online && !hayFotosSinOptimizar && <WifiOff className="w-4 h-4" />}
                  {guardando
                    ? progreso
                      ? progreso.fase === 'reporte'
                        ? 'Guardando reporte…'
                        : `Subiendo ${progreso.procesadas} / ${progreso.total} fotos...`
                      : 'Guardando...'
                    : hayFotosSinOptimizar
                      ? 'Hay fotos sin optimizar'
                    : reporteInsertado
                      ? `Terminar de subir (${fotosPendientes} foto${fotosPendientes !== 1 ? 's' : ''} pendiente${fotosPendientes !== 1 ? 's' : ''})`
                    : online
                      ? 'Guardar reporte'
                      : `Guardar sin conexión (${totalFotos} foto${totalFotos !== 1 ? 's' : ''})`
                  }
                </button>
              </div>
            </div>
            </fieldset>
            </>)}
      </BottomSheet>
    </div>
  )
}
