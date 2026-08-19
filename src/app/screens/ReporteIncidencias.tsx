import { useState, useRef, useEffect } from 'react'
import {
  ChevronLeft, Plus, X, Loader2, Files, AlertTriangle,
  Camera, Trash2, ImageOff, ClipboardList, FileDown,
} from 'lucide-react'
import { useNavigate } from 'react-router'
import { BottomSheet } from '@/app/components/BottomSheet'
import { toast } from 'sonner'
import imageCompression from 'browser-image-compression'
import { useAuthContext } from '@/context/AuthContext'
import { puedeEditarFechaLibre } from '@/lib/permisos'
import { useModulosContext } from '@/context/ModulosContext'
import { useRanchos } from '@/hooks/useRanchos'
import { useM13Incidencias, type M13ReporteConRancho } from '@/hooks/useM13Incidencias'
import { supabase } from '@/lib/supabase'
import { getSignedUrls, borrarFotos, subirFoto } from '@/lib/storage/incidenciasStorage'
import { validarImagen } from '@/lib/validarImagen'
import { generarReporteIncidenciasPDF } from '@/lib/pdf/m13/generarReporteIncidenciasPDF'
import { useOrganizacion } from '@/hooks/useOrganizacion'
import { generarReporteIncidenciasConsolidadoPDF } from '@/lib/pdf/m13/generarReporteIncidenciasConsolidadoPDF'

// ── Constantes ────────────────────────────────────────────────────────────────

const TITULO_MODULO = 'Reporte de Incidencias'
const CLAVE_MODULO = 'M.A.D.Y · Por evento'
const MAX_FOTOS_AVISO = 6
const MAX_FOTOS_REPORTE = 150   // Hard cap: total de fotos por reporte (todas las incidencias)
const MAX_FOTO_BYTES = 5.5 * 1024 * 1024
const MAX_REINTENTOS_FOTO = 3

const hoy = () => new Date().toLocaleDateString('en-CA', { timeZone: 'America/Mexico_City' })

// ── Tipos internos ────────────────────────────────────────────────────────────

interface FotoLocal {
  uid: string
  file: File
  preview: string
}

interface IncidenciaLocal {
  uid: string
  descripcion: string
  fotos: FotoLocal[]
}

interface ProgresoSubida {
  total: number
  procesadas: number
  fallidas: number
}

// ── Helpers ───────────────────────────────────────────────────────────────────

function formatFecha(iso: string): string {
  try {
    return new Date(iso + 'T12:00:00').toLocaleDateString('es-MX', {
      day: 'numeric', month: 'short', year: 'numeric',
    })
  } catch { return iso }
}

async function comprimirFoto(file: File): Promise<File> {
  return imageCompression(file, {
    maxSizeMB: 0.5,
    maxWidthOrHeight: 1600,
    useWebWorker: true,
    fileType: 'image/jpeg',
    initialQuality: 0.7,
  })
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
          <img
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
  totalFotosReporte,
}: {
  inc: IncidenciaLocal
  index: number
  onChange: (upd: Partial<IncidenciaLocal>) => void
  onQuitar: () => void
  totalFotosReporte: number
}) {
  const inputRef = useRef<HTMLInputElement>(null)
  const atLimit = totalFotosReporte >= MAX_FOTOS_REPORTE

  useEffect(() => {
    return () => { inc.fotos.forEach((f) => URL.revokeObjectURL(f.preview)) }
  }, [])

  function handleFiles(files: FileList | null) {
    if (!files) return

    const slotsRestantes = MAX_FOTOS_REPORTE - totalFotosReporte
    if (slotsRestantes <= 0) {
      toast.warning(
        'Alcanzaste el máximo de 150 fotos por reporte. Para subir más, crea otro reporte.',
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
        'Alcanzaste el máximo de 150 fotos por reporte. Para subir más, crea otro reporte.',
        { duration: 6000 }
      )
    }

    const nuevas: FotoLocal[] = aAgregar.map((file) => ({
      uid: crypto.randomUUID(),
      file,
      preview: URL.createObjectURL(file),
    }))
    if (nuevas.length === 0) return

    const totalEnEstaInc = inc.fotos.length + nuevas.length
    if (totalEnEstaInc > MAX_FOTOS_AVISO && !atLimit) {
      toast.warning('Límite recomendado: máximo 6 fotos por incidencia', { duration: 4000 })
    }
    onChange({ fotos: [...inc.fotos, ...nuevas] })
  }

  function quitarFoto(uid: string) {
    const foto = inc.fotos.find((f) => f.uid === uid)
    if (foto) URL.revokeObjectURL(foto.preview)
    onChange({ fotos: inc.fotos.filter((f) => f.uid !== uid) })
  }

  return (
    <div className="border border-border rounded-xl p-4 space-y-3 bg-card">
      <div className="flex items-center justify-between">
        <span className="text-xs text-muted-foreground" style={{ fontWeight: 600 }}>
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
      <textarea
        value={inc.descripcion}
        onChange={(e) => onChange({ descripcion: e.target.value })}
        placeholder="Describe la incidencia observada..."
        rows={3}
        className="w-full px-3 py-2 rounded-lg bg-input-background border border-border text-sm text-foreground focus:outline-none focus:border-primary focus:ring-1 focus:ring-primary resize-none"
      />

      {/* Avisos */}
      {inc.fotos.length === 0 && (
        <p className="text-xs" style={{ color: 'var(--agro-danger-text)' }}>
          Se requiere al menos 1 foto como evidencia
        </p>
      )}
      {inc.fotos.length >= MAX_FOTOS_AVISO && !atLimit && (
        <div
          className="flex items-center gap-2 rounded-lg px-3 py-2 text-xs"
          style={{ backgroundColor: 'var(--agro-warning-fill)', color: 'var(--agro-warning-text)' }}
        >
          <AlertTriangle className="w-3 h-3 flex-shrink-0" />
          Límite recomendado alcanzado (6 fotos). Puedes agregar más, pero puede afectar el rendimiento.
        </div>
      )}
      {atLimit && (
        <div
          className="flex items-center gap-2 rounded-lg px-3 py-2 text-xs"
          style={{ backgroundColor: 'var(--agro-danger-fill)', color: 'var(--agro-danger-text)' }}
        >
          <AlertTriangle className="w-3 h-3 flex-shrink-0" />
          Máximo de 150 fotos por reporte alcanzado. Para subir más, crea otro reporte.
        </div>
      )}

      {/* Previews */}
      {inc.fotos.length > 0 && (
        <div className="flex flex-wrap gap-2">
          {inc.fotos.map((f) => (
            <div key={f.uid} className="relative">
              <img
                src={f.preview}
                alt="Preview"
                className="w-16 h-16 object-cover rounded-lg border border-border"
              />
              <button
                type="button"
                onClick={() => quitarFoto(f.uid)}
                className="absolute -top-1.5 -right-1.5 w-5 h-5 bg-agro-red text-white rounded-full flex items-center justify-center"
              >
                <X className="w-3 h-3" />
              </button>
            </div>
          ))}
        </div>
      )}

      {/* Input cámara/galería */}
      <input
        ref={inputRef}
        type="file"
        accept="image/*"
        capture="environment"
        multiple
        className="hidden"
        onChange={(e) => handleFiles(e.target.files)}
        onClick={(e) => { (e.target as HTMLInputElement).value = '' }}
      />
      <button
        type="button"
        onClick={() => { if (!atLimit) inputRef.current?.click() }}
        disabled={atLimit}
        className="w-full h-10 flex items-center justify-center gap-2 rounded-lg border border-dashed border-border text-sm text-muted-foreground hover:border-primary hover:text-primary transition-colors disabled:opacity-40 disabled:cursor-not-allowed disabled:hover:border-border disabled:hover:text-muted-foreground"
      >
        <Camera className="w-4 h-4" />
        {atLimit ? 'Límite de fotos alcanzado' : 'Agregar foto / tomar foto'}
      </button>
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
  const { reportes, loading, refetch } = useM13Incidencias()
  const orgNombre = useOrganizacion(profile?.org_id)

  // Sheet formulario
  const [sheetAbierto, setSheetAbierto] = useState(false)
  const [ranchoId, setRanchoId] = useState('')
  const [fecha, setFecha] = useState(hoy())
  const [auditorNombre, setAuditorNombre] = useState('')
  const [incidencias, setIncidencias] = useState<IncidenciaLocal[]>([nuevaIncidencia()])
  const [errRancho, setErrRancho] = useState(false)
  const [guardando, setGuardando] = useState(false)
  const [progreso, setProgreso] = useState<ProgresoSubida | null>(null)

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

  const ranchoOptions = ranchos.map((r) => ({ value: r.id, label: r.nombre }))

  function abrirSheet() {
    setRanchoId('')
    setFecha(hoy())
    setAuditorNombre('')
    setIncidencias([nuevaIncidencia()])
    setErrRancho(false)
    setProgreso(null)
    setSheetAbierto(true)
  }

  function actualizarIncidencia(uid: string, upd: Partial<IncidenciaLocal>) {
    setIncidencias((prev) =>
      prev.map((inc) => (inc.uid === uid ? { ...inc, ...upd } : inc))
    )
  }

  function quitarIncidencia(uid: string) {
    setIncidencias((prev) => {
      const quitada = prev.find((i) => i.uid === uid)
      if (quitada) quitada.fotos.forEach((f) => URL.revokeObjectURL(f.preview))
      return prev.filter((i) => i.uid !== uid)
    })
  }

  function agregarIncidencia() {
    setIncidencias((prev) => [...prev, nuevaIncidencia()])
  }

  // ── Validación ──────────────────────────────────────────────────────────────

  function validarFormulario(): boolean {
    if (!ranchoId) { setErrRancho(true); return false }
    if (!profile?.org_id) { toast.error('Sin organización activa'); return false }
    if (incidencias.length === 0) {
      toast.error('Agrega al menos una incidencia')
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

  async function handleGuardar() {
    if (!validarFormulario()) return
    const orgId = profile!.org_id!

    for (const inc of incidencias) {
      for (const fotoLocal of inc.fotos) {
        const errImg = validarImagen(fotoLocal.file)
        if (errImg) { toast.error(errImg); return }
      }
    }

    setGuardando(true)
    const totalFotosASubir = incidencias.reduce((sum, inc) => sum + inc.fotos.length, 0)
    setProgreso({ total: totalFotosASubir, procesadas: 0, fallidas: 0 })

    const pathsSubidos: string[] = []
    let reporteId: string | null = null
    // IDs de incidencias guardadas y fotos subidas por incidencia (para PDF automático)
    const incidenciaIds: string[] = []
    const fotosSubidasPorIncidencia: Array<Array<{ id: string; storage_path: string; orden: number }>> = []

    try {
      // PASO 1: INSERT reporte padre
      const { data: reporteData, error: errReporte } = await supabase
        .from('m13_reportes')
        .insert({
          org_id: orgId,
          rancho_id: ranchoId,
          fecha,
          auditor_nombre: auditorNombre.trim() || null,
          realizado_por_id: profile!.id,
        })
        .select('id')
        .single()
      if (errReporte) throw errReporte
      reporteId = reporteData.id

      // PASO 2: INSERT todas las incidencias (texto, sin fotos — comentarios quedan guardados)
      for (let i = 0; i < incidencias.length; i++) {
        const inc = incidencias[i]
        const { data: incData, error: errInc } = await supabase
          .from('m13_incidencias')
          .insert({
            reporte_id: reporteId,
            org_id: orgId,
            orden: i + 1,
            descripcion: inc.descripcion.trim(),
          })
          .select('id')
          .single()
        if (errInc) throw errInc
        incidenciaIds.push(incData.id)
        fotosSubidasPorIncidencia.push([])
      }

      // PASO 3: Subir fotos secuencialmente con reintento (hasta MAX_REINTENTOS_FOTO por foto)
      let procesadas = 0
      let fallidas = 0
      let sesionExpirada = false

      for (let i = 0; i < incidencias.length && !sesionExpirada; i++) {
        const inc = incidencias[i]
        const incidenciaId = incidenciaIds[i]

        for (let j = 0; j < inc.fotos.length; j++) {
          const fotoLocal = inc.fotos[j]
          const path = `${orgId}/${reporteId}/${incidenciaId}/${crypto.randomUUID()}.jpg`
          let subida = false

          for (let intento = 0; intento < MAX_REINTENTOS_FOTO; intento++) {
            try {
              const comprimida = await comprimirFoto(fotoLocal.file)
              if (comprimida.size > MAX_FOTO_BYTES) {
                throw new Error(
                  `La foto ${j + 1} de la incidencia ${i + 1} sigue siendo demasiado grande (${(comprimida.size / 1024 / 1024).toFixed(1)} MB). Usa una foto con menor resolución.`
                )
              }
              await subirFoto(path, comprimida)
              const { data: fotoData, error: errFoto } = await supabase
                .from('m13_incidencia_fotos')
                .insert({
                  incidencia_id: incidenciaId,
                  org_id: orgId,
                  storage_path: path,
                  orden: j + 1,
                })
                .select('id')
                .single()
              if (errFoto) throw errFoto
              pathsSubidos.push(path)
              fotosSubidasPorIncidencia[i].push({ id: fotoData.id, storage_path: path, orden: j + 1 })
              subida = true
              break
            } catch (e) {
              const msg = e instanceof Error ? e.message : ''
              // Detectar sesión expirada (401/JWT) — abortar subida sin rollback
              if (msg.includes('401') || msg.includes('JWT') || msg.toLowerCase().includes('token')) {
                sesionExpirada = true
                break
              }
              // Si quedan reintentos, continuar; si no, marcar como fallida
              if (intento === MAX_REINTENTOS_FOTO - 1) {
                // Foto falló definitivamente
              }
            }
          }

          if (!subida) fallidas++
          procesadas++
          setProgreso({ total: totalFotosASubir, procesadas, fallidas })
        }
      }

      // Sesión expirada durante la subida — el reporte y comentarios ya están guardados
      if (sesionExpirada) {
        toast.error(
          'Tu sesión expiró durante la subida. El reporte y sus comentarios quedaron guardados. Vuelve a iniciar sesión para reintentar las fotos.',
          { duration: 10000 }
        )
        setSheetAbierto(false)
        await refetch()
        return
      }

      // PASO 4: Resultado
      if (fallidas === 0) {
        toast.success('Reporte guardado correctamente')
      } else {
        toast.warning(
          `Reporte guardado. ${fallidas} foto(s) no se pudieron subir — el reporte y sus comentarios están guardados.`,
          { duration: 8000 }
        )
      }

      setSheetAbierto(false)
      await refetch()

      // PASO 5: Descarga automática del PDF con lo guardado
      try {
        const ranchoInfo = ranchos.find((r) => r.id === ranchoId)
        const reporteParaPDF: M13ReporteConRancho = {
          id: reporteId!,
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
          incidencias: incidenciaIds.map((incId, i) => ({
            id: incId,
            orden: i + 1,
            descripcion: incidencias[i].descripcion.trim(),
            fotos: fotosSubidasPorIncidencia[i],
          })),
        }
        await generarReporteIncidenciasPDF(reporteParaPDF)
      } catch {
        // La descarga automática falla silenciosamente — el usuario puede descargar manualmente
      }

    } catch (err: unknown) {
      const mensaje = err instanceof Error ? err.message : 'No se pudo guardar el reporte'
      if (mensaje.includes('FECHA_SOLO_HOY')) {
        toast.warning('Solo puedes registrar con la fecha de hoy')
      } else {
        toast.error(mensaje, { duration: 7000 })
      }

      // Rollback: borrar Storage + reporte (cascade limpia incidencias y fotos)
      try {
        if (pathsSubidos.length > 0) await borrarFotos(pathsSubidos)
        if (reporteId) {
          await supabase.from('m13_reportes').delete().eq('id', reporteId)
        }
      } catch {
        // Rollback silencioso — el usuario ya recibió el error principal
      }
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
      <header className="bg-card border-b border-border px-4 py-4 sticky top-0 z-20">
        <div className="flex items-center gap-3">
          <button
            onClick={() => navigate('/')}
            className="p-1 text-muted-foreground flex-shrink-0"
          >
            <ChevronLeft className="w-5 h-5" />
          </button>
          <div className="flex-1 min-w-0">
            <h1 className="text-foreground truncate" style={{ fontWeight: 600 }}>
              {TITULO_MODULO}
            </h1>
            <p className="text-xs text-muted-foreground">{CLAVE_MODULO}</p>
          </div>
          <div className="w-9 h-9 bg-primary/10 rounded-lg flex items-center justify-center flex-shrink-0">
            <ClipboardList className="w-5 h-5 text-primary" />
          </div>
        </div>
      </header>

      {/* Acción consolidado */}
      <div className="px-4 pt-3">
        <button
          onClick={() => {
            setConsRanchoId('')
            setConsDesde('')
            setConsHasta(hoy())
            setErrConsFechas(false)
            setSheetConsolidadoAbierto(true)
          }}
          className="w-full h-10 flex items-center justify-center gap-2 rounded-xl border border-primary text-primary text-sm hover:bg-primary/5 transition-colors"
          style={{ fontWeight: 600 }}
        >
          <Files className="w-4 h-4" />
          Exportar consolidado
        </button>
      </div>

      {/* Lista de reportes */}
      <div className="p-4 space-y-3">
        {loading ? (
          <div className="flex justify-center py-12">
            <Loader2 className="w-8 h-8 text-primary animate-spin" />
          </div>
        ) : reportes.length === 0 ? (
          <div className="bg-card border border-border rounded-xl p-6 text-center">
            <ClipboardList className="w-10 h-10 text-muted-foreground mx-auto mb-2" />
            <p className="text-sm text-muted-foreground">Sin reportes aún</p>
            <p className="text-xs text-muted-foreground mt-1">
              Toca + para registrar el primer reporte de incidencias
            </p>
          </div>
        ) : (
          reportes.map((r) => {
            const totalFotosReporte = r.incidencias.reduce((acc, inc) => acc + inc.fotos.length, 0)
            const abierto = expandido === r.id
            return (
              <div
                key={r.id}
                className="bg-card rounded-xl border overflow-hidden"
                style={{
                  borderColor: r.requiere_correccion ? 'var(--agro-amber)' : 'var(--border)',
                  backgroundColor: r.requiere_correccion ? 'var(--agro-warning-fill)' : undefined,
                }}
              >
                {/* Comentario de corrección */}
                {r.requiere_correccion && r.comentario_correccion && (
                  <div
                    className="flex items-start gap-2 px-4 pt-3 text-xs"
                    style={{ color: 'var(--agro-warning-text)' }}
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
                        <span className="text-sm text-foreground truncate" style={{ fontWeight: 600 }}>
                          {r.rancho_nombre}
                        </span>
                        <span
                          className="text-[11px] px-2 py-0.5 rounded flex-shrink-0 bg-muted text-muted-foreground"
                          style={{ fontWeight: 600 }}
                        >
                          {r.incidencias.length} incidencia{r.incidencias.length !== 1 ? 's' : ''}
                        </span>
                        <span className="text-[11px] px-2 py-0.5 rounded flex-shrink-0 bg-muted text-muted-foreground">
                          {totalFotosReporte} foto{totalFotosReporte !== 1 ? 's' : ''}
                        </span>
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
                        className="p-2 text-muted-foreground hover:text-agro-red transition-colors"
                        title="Eliminar reporte"
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
                          <p className="text-xs text-muted-foreground mb-1" style={{ fontWeight: 600 }}>
                            Incidencia {idx + 1}
                          </p>
                          <p className="text-sm text-foreground">{inc.descripcion}</p>
                          <GaleriaFotos paths={inc.fotos.map((f) => f.storage_path)} />
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              </div>
            )
          })
        )}
      </div>

      {/* FAB */}
      <div className="fixed bottom-safe-fab left-1/2 -translate-x-1/2 w-full max-w-[390px] flex justify-end px-4 pointer-events-none z-10">
        <button
          onClick={abrirSheet}
          className="w-14 h-14 rounded-full bg-primary text-white flex items-center justify-center pointer-events-auto hover:bg-agro-blue transition-colors"
          aria-label="Nuevo reporte"
        >
          <Plus className="w-6 h-6" />
        </button>
      </div>

      {/* Bottom Sheet — consolidado */}
      <BottomSheet open={sheetConsolidadoAbierto} onClose={() => !generandoConsolidado && setSheetConsolidadoAbierto(false)}>
            <div className="flex justify-center pt-3 pb-1 flex-shrink-0">
              <div className="w-10 h-1 rounded-full bg-border" />
            </div>
            <div className="flex items-center justify-between px-4 py-3 border-b border-border flex-shrink-0">
              <h2 className="text-base text-foreground" style={{ fontWeight: 600 }}>
                Exportar consolidado
              </h2>
              <button
                onClick={() => !generandoConsolidado && setSheetConsolidadoAbierto(false)}
                className="p-1"
              >
                <X className="w-5 h-5 text-muted-foreground" />
              </button>
            </div>

            <div className="overflow-y-auto p-4 space-y-4">
              {/* Rancho (opcional) */}
              <div>
                <label className="block text-xs text-muted-foreground mb-1.5" style={{ fontWeight: 600 }}>
                  {terminosSitio.singular.toUpperCase()} (opcional — vacío = todos)
                </label>
                <select
                  value={consRanchoId}
                  onChange={(e) => setConsRanchoId(e.target.value)}
                  className={`w-full h-11 px-3 rounded-lg bg-input-background border border-border text-sm focus:outline-none focus:border-primary focus:ring-1 focus:ring-primary ${
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
                <label className="block text-xs text-muted-foreground mb-1.5" style={{ fontWeight: 600 }}>
                  DESDE *
                </label>
                <input
                  type="date"
                  value={consDesde}
                  onChange={(e) => { setConsDesde(e.target.value); setErrConsFechas(false) }}
                  className={`w-full h-11 px-3 rounded-lg bg-input-background border text-sm text-foreground focus:outline-none focus:border-primary focus:ring-1 focus:ring-primary ${
                    errConsFechas && !consDesde ? 'border-agro-red' : 'border-border'
                  }`}
                />
              </div>

              {/* Hasta */}
              <div>
                <label className="block text-xs text-muted-foreground mb-1.5" style={{ fontWeight: 600 }}>
                  HASTA *
                </label>
                <input
                  type="date"
                  value={consHasta}
                  onChange={(e) => { setConsHasta(e.target.value); setErrConsFechas(false) }}
                  className={`w-full h-11 px-3 rounded-lg bg-input-background border text-sm text-foreground focus:outline-none focus:border-primary focus:ring-1 focus:ring-primary ${
                    errConsFechas && !consHasta ? 'border-agro-red' : 'border-border'
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
                className="w-full h-14 bg-primary text-white rounded-3xl flex items-center justify-center gap-2 disabled:opacity-50 hover:bg-agro-blue transition-colors"
                style={{ fontWeight: 600 }}
              >
                {generandoConsolidado && <Loader2 className="w-4 h-4 animate-spin" />}
                {generandoConsolidado ? 'Generando...' : 'Generar PDF consolidado'}
              </button>
            </div>
      </BottomSheet>

      {/* Bottom Sheet — formulario */}
      <BottomSheet open={sheetAbierto} onClose={() => !guardando && setSheetAbierto(false)} height="85%">
            {/* Handle */}
            <div className="flex justify-center pt-3 pb-1 flex-shrink-0">
              <div className="w-10 h-1 rounded-full bg-border" />
            </div>

            {/* Header sheet */}
            <div className="flex items-center justify-between px-4 py-3 border-b border-border flex-shrink-0">
              <h2 className="text-base text-foreground" style={{ fontWeight: 600 }}>
                Nuevo reporte
              </h2>
              <button
                onClick={() => !guardando && setSheetAbierto(false)}
                className="p-1"
              >
                <X className="w-5 h-5 text-muted-foreground" />
              </button>
            </div>

            {/* Campos scrollables */}
            <div className="flex-1 overflow-y-auto p-4 space-y-4">

              {/* Sitio */}
              <div>
                <label className="block text-xs text-muted-foreground mb-1.5" style={{ fontWeight: 600 }}>
                  {terminosSitio.singular.toUpperCase()} *
                </label>
                <select
                  value={ranchoId}
                  onChange={(e) => { setRanchoId(e.target.value); setErrRancho(false) }}
                  className={`w-full h-11 px-3 rounded-lg bg-input-background border text-sm focus:outline-none focus:border-primary focus:ring-1 focus:ring-primary ${
                    errRancho ? 'border-agro-red' : 'border-border'
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
                <label className="block text-xs text-muted-foreground mb-1.5" style={{ fontWeight: 600 }}>
                  FECHA DEL RECORRIDO *
                </label>
                <input
                  type="date"
                  value={fecha}
                  min={puedeEditarFecha ? undefined : hoy()}
                  max={puedeEditarFecha ? undefined : hoy()}
                  onChange={(e) => { if (puedeEditarFecha) setFecha(e.target.value) }}
                  className="w-full h-11 px-3 rounded-lg bg-input-background border border-border text-sm text-foreground focus:outline-none focus:border-primary focus:ring-1 focus:ring-primary"
                />
              </div>

              {/* Auditor */}
              <div>
                <label className="block text-xs text-muted-foreground mb-1.5" style={{ fontWeight: 600 }}>
                  AUDITOR / QUIEN REALIZÓ EL RECORRIDO
                </label>
                <input
                  type="text"
                  value={auditorNombre}
                  onChange={(e) => setAuditorNombre(e.target.value)}
                  placeholder={profile?.nombre_completo ?? 'Nombre del auditor'}
                  className="w-full h-11 px-3 rounded-lg bg-input-background border border-border text-sm text-foreground focus:outline-none focus:border-primary focus:ring-1 focus:ring-primary"
                />
              </div>

              {/* Incidencias */}
              <div>
                {/* Header con contador de fotos */}
                <div className="flex items-center justify-between mb-2">
                  <label className="text-xs text-muted-foreground" style={{ fontWeight: 600 }}>
                    INCIDENCIAS *
                  </label>
                  <span
                    className="text-xs"
                    style={{
                      fontWeight: 600,
                      color: totalFotos >= MAX_FOTOS_REPORTE
                        ? 'var(--agro-danger-text)'
                        : totalFotos >= MAX_FOTOS_REPORTE * 0.8
                          ? 'var(--agro-warning-text)'
                          : 'var(--muted-foreground)',
                    }}
                  >
                    {totalFotos} / {MAX_FOTOS_REPORTE} fotos
                  </span>
                </div>

                {/* Banner de límite alcanzado */}
                {totalFotos >= MAX_FOTOS_REPORTE && (
                  <div
                    className="flex items-start gap-2 rounded-lg px-3 py-2 mb-3 text-xs"
                    style={{ backgroundColor: 'var(--agro-danger-fill)', color: 'var(--agro-danger-text)' }}
                  >
                    <AlertTriangle className="w-3 h-3 flex-shrink-0 mt-0.5" />
                    <span>
                      Alcanzaste el máximo de {MAX_FOTOS_REPORTE} fotos por reporte.
                      Para subir más evidencia, crea otro reporte.
                    </span>
                  </div>
                )}

                <div className="space-y-3">
                  {incidencias.map((inc, idx) => (
                    <IncidenciaForm
                      key={inc.uid}
                      inc={inc}
                      index={idx}
                      onChange={(upd) => actualizarIncidencia(inc.uid, upd)}
                      onQuitar={() => quitarIncidencia(inc.uid)}
                      totalFotosReporte={totalFotos}
                    />
                  ))}
                </div>

                <button
                  type="button"
                  onClick={agregarIncidencia}
                  className="mt-3 w-full h-10 flex items-center justify-center gap-2 rounded-xl border border-dashed border-primary text-primary text-sm hover:bg-primary/5 transition-colors"
                  style={{ fontWeight: 600 }}
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
                      {progreso.procesadas < progreso.total
                        ? `Subiendo fotos...`
                        : 'Finalizando...'}
                    </span>
                    <span style={{ fontWeight: 600 }}>
                      {progreso.procesadas} / {progreso.total}
                      {progreso.fallidas > 0 && (
                        <span style={{ color: 'var(--agro-warning-text)' }}>
                          {' '}({progreso.fallidas} error{progreso.fallidas !== 1 ? 'es' : ''})
                        </span>
                      )}
                    </span>
                  </div>
                  <div className="h-1.5 bg-muted rounded-full overflow-hidden">
                    <div
                      className="h-full bg-primary transition-all duration-300"
                      style={{ width: `${Math.round((progreso.procesadas / progreso.total) * 100)}%` }}
                    />
                  </div>
                </div>
              )}
              <div className="p-4">
                <button
                  onClick={handleGuardar}
                  disabled={guardando}
                  className="w-full h-14 bg-primary text-white rounded-3xl flex items-center justify-center gap-2 disabled:opacity-50 hover:bg-agro-blue transition-colors"
                  style={{ fontWeight: 600 }}
                >
                  {guardando && <Loader2 className="w-4 h-4 animate-spin" />}
                  {guardando
                    ? progreso
                      ? `Subiendo ${progreso.procesadas} / ${progreso.total} fotos...`
                      : 'Guardando...'
                    : 'Guardar reporte'}
                </button>
              </div>
            </div>
      </BottomSheet>
    </div>
  )
}
