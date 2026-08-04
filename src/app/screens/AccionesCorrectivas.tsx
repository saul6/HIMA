import { useState, useRef, useEffect } from 'react'
import {
  ChevronLeft, Loader2, FileDown, Camera, Trash2,
  AlertTriangle, ClipboardCheck,
} from 'lucide-react'
import { useNavigate } from 'react-router'
import { BottomSheet } from '@/app/components/BottomSheet'
import { toast } from 'sonner'
import imageCompression from 'browser-image-compression'
import { useAuthContext } from '@/context/AuthContext'
import { useModulosContext } from '@/context/ModulosContext'
import { useOrganizacion } from '@/hooks/useOrganizacion'
import {
  useAccionesCorrectivas,
  type NcBandejaItem,
} from '@/hooks/useAccionesCorrectivas'
import {
  subirFotoAccion,
  borrarFotosAccion,
  getSignedUrlsAccion,
} from '@/lib/storage/accionesCorrectivasStorage'
import {
  generarAccionCorrectivaIndividualPDF,
  generarAccionesCorrectivasPDF,
} from '@/lib/pdf/m26/generarAccionesCorrectivasPDF'
import type { AccionCorrectivaFoto } from '@/types/database.types'

// ── Helpers ───────────────────────────────────────────────────────────────────

const hoy = () => new Date().toLocaleDateString('en-CA', { timeZone: 'America/Mexico_City' })

function formatFecha(iso: string | null | undefined): string {
  if (!iso) return '—'
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

// ── Tipos internos ────────────────────────────────────────────────────────────

type FiltroEstado = 'todas' | 'pendientes' | 'cerradas'

interface FotoLocal {
  uid: string
  file: File
  preview: string
  tipo: 'no_conformidad' | 'evidencia_correccion'
  leyenda: string
}

// ── Chip de estado ────────────────────────────────────────────────────────────

function ChipEstado({ estado }: { estado: 'sin_capturar' | 'abierta' | 'cerrada' }) {
  if (estado === 'cerrada') {
    return (
      <span
        className="inline-flex items-center px-2 py-0.5 rounded-full text-xs"
        style={{ backgroundColor: 'var(--agro-success-fill)', color: 'var(--agro-success-text)', fontWeight: 600 }}
      >
        Cerrada
      </span>
    )
  }
  if (estado === 'abierta') {
    return (
      <span
        className="inline-flex items-center px-2 py-0.5 rounded-full text-xs"
        style={{ backgroundColor: 'var(--agro-warning-fill)', color: 'var(--agro-warning-text)', fontWeight: 600 }}
      >
        Abierta
      </span>
    )
  }
  return (
    <span
      className="inline-flex items-center px-2 py-0.5 rounded-full text-xs bg-muted"
      style={{ color: 'var(--muted-foreground)', fontWeight: 600 }}
    >
      Sin capturar
    </span>
  )
}

// ── Galería de fotos guardadas ────────────────────────────────────────────────

function GaleriaGuardadas({
  fotos,
  onDelete,
}: {
  fotos: AccionCorrectivaFoto[]
  onDelete: (id: string, path: string) => void
}) {
  const [urls, setUrls] = useState<Record<string, string>>({})
  const [cargando, setCargando] = useState(true)

  useEffect(() => {
    if (fotos.length === 0) { setCargando(false); return }
    let activo = true
    getSignedUrlsAccion(fotos.map((f) => f.storage_path), 120)
      .then((res) => { if (activo) setUrls(res) })
      .catch(() => {})
      .finally(() => { if (activo) setCargando(false) })
    return () => { activo = false }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [fotos.map((f) => f.id).join('|')])

  if (fotos.length === 0) return null

  return (
    <div className="space-y-2">
      {fotos.map((f) => (
        <div key={f.id} className="flex items-center gap-3 p-2 rounded-xl border border-border">
          {cargando ? (
            <div className="w-14 h-14 rounded-lg bg-muted flex items-center justify-center flex-shrink-0">
              <Loader2 className="w-4 h-4 text-muted-foreground animate-spin" />
            </div>
          ) : urls[f.storage_path] ? (
            <img
              src={urls[f.storage_path]}
              alt="Evidencia"
              className="w-14 h-14 object-cover rounded-lg flex-shrink-0 border border-border"
            />
          ) : (
            <div className="w-14 h-14 rounded-lg bg-muted flex items-center justify-center flex-shrink-0">
              <AlertTriangle className="w-4 h-4 text-muted-foreground" />
            </div>
          )}
          <div className="flex-1 min-w-0">
            <p className="text-xs text-muted-foreground" style={{ fontWeight: 600 }}>
              {f.tipo === 'no_conformidad' ? 'No conformidad' : 'Evidencia de corrección'}
            </p>
            {f.leyenda && <p className="text-xs text-foreground truncate">{f.leyenda}</p>}
          </div>
          <button
            onClick={() => onDelete(f.id, f.storage_path)}
            className="p-1.5 text-muted-foreground flex-shrink-0"
          >
            <Trash2 className="w-4 h-4" />
          </button>
        </div>
      ))}
    </div>
  )
}

// ── Componente principal ──────────────────────────────────────────────────────

export function AccionesCorrectivas() {
  const navigate = useNavigate()
  const { profile } = useAuthContext()
  const { terminosSitio } = useModulosContext()
  const orgNombre = useOrganizacion(profile?.org_id)
  const { items, loading, error, refetch, upsertAccion, agregarFoto, eliminarFotoDb } =
    useAccionesCorrectivas()

  // Filtro
  const [filtro, setFiltro] = useState<FiltroEstado>('pendientes')

  // Sheet
  const [sheetAbierto, setSheetAbierto] = useState(false)
  const [selectedItem, setSelectedItem] = useState<NcBandejaItem | null>(null)

  // Campos del formulario
  const [fFechaDeteccion, setFFechaDeteccion] = useState('')
  const [fNoConformidad, setFNoConformidad] = useState('')
  const [fCausa, setFCausa] = useState('')
  const [fAccionCorrectiva, setFAccionCorrectiva] = useState('')
  const [fAccionPreventiva, setFAccionPreventiva] = useState('')
  const [fFechaCumplimiento, setFFechaCumplimiento] = useState('')
  const [fRealizo, setFRealizo] = useState('')
  const [fverifico, setFverifico] = useState('')

  // Ishikawa (opcional)
  const ISH_KEYS: Array<[string, string]> = [
    ['medio_ambiente', 'Medio ambiente'],
    ['metodo', 'Método'],
    ['mano_de_obra', 'Mano de obra'],
    ['materiales', 'Materiales'],
    ['herramientas', 'Herramientas'],
    ['medicion', 'Medición'],
  ]
  const ISH_EMPTY = Object.fromEntries(ISH_KEYS.map(([k]) => [k, '']))
  const [ishikawa, setIshikawa] = useState<Record<string, string>>(ISH_EMPTY)

  // Fotos
  const [fotosGuardadas, setFotosGuardadas] = useState<AccionCorrectivaFoto[]>([])
  const [fotosPendientes, setFotosPendientes] = useState<FotoLocal[]>([])
  const fotoInputRef = useRef<HTMLInputElement>(null)
  const [tipoFotoNueva, setTipoFotoNueva] = useState<'no_conformidad' | 'evidencia_correccion'>(
    'evidencia_correccion'
  )
  const [leyendaFotoNueva, setLeyendaFotoNueva] = useState('')

  // Estado de operaciones
  const [guardando, setGuardando] = useState(false)
  const [generandoPDF, setGenerandoPDF] = useState(false)

  // Filtrado
  const itemsFiltrados = items.filter((item) => {
    if (filtro === 'pendientes') return item.estado === 'sin_capturar' || item.estado === 'abierta'
    if (filtro === 'cerradas') return item.estado === 'cerrada'
    return true
  })

  const conteos = {
    pendientes: items.filter((i) => i.estado === 'sin_capturar' || i.estado === 'abierta').length,
    cerradas: items.filter((i) => i.estado === 'cerrada').length,
  }

  function abrirSheet(item: NcBandejaItem) {
    setSelectedItem(item)
    const a = item.accion
    setFFechaDeteccion(a?.fecha_deteccion ?? item.fecha_auditoria)
    setFNoConformidad(a?.no_conformidad ?? item.comentario_respuesta ?? item.texto_pregunta ?? '')
    setFCausa(a?.causa ?? '')
    setFAccionCorrectiva(a?.accion_correctiva ?? '')
    setFAccionPreventiva(a?.accion_preventiva ?? '')
    setFFechaCumplimiento(a?.fecha_cumplimiento ?? '')
    setFRealizo(a?.realizo ?? '')
    setFverifico(a?.verifico ?? '')
    setFotosGuardadas(a?.fotos ?? [])
    setFotosPendientes([])
    setTipoFotoNueva('evidencia_correccion')
    setLeyendaFotoNueva('')
    const rawIsh = (a?.ishikawa ?? {}) as Record<string, string>
    setIshikawa(Object.fromEntries(ISH_KEYS.map(([k]) => [k, rawIsh[k] ?? ''])))
    setSheetAbierto(true)
  }

  function cerrarSheet() {
    setSheetAbierto(false)
    setSelectedItem(null)
    setFotosPendientes([])
    setIshikawa(ISH_EMPTY)
  }

  async function handleGuardar() {
    if (!selectedItem || !profile?.org_id) return
    setGuardando(true)
    try {
      const ishikawaPayload: Record<string, string> = {}
      for (const [k, v] of Object.entries(ishikawa)) {
        if (v.trim()) ishikawaPayload[k] = v.trim()
      }

      const accionId = await upsertAccion({
        respuesta_id: selectedItem.respuesta_id,
        modulo: selectedItem.modulo,
        codigo_pregunta: selectedItem.codigo_pregunta,
        no_conformidad: fNoConformidad.trim() || null,
        fecha_deteccion: fFechaDeteccion || null,
        causa: fCausa.trim() || null,
        accion_correctiva: fAccionCorrectiva.trim() || null,
        accion_preventiva: fAccionPreventiva.trim() || null,
        fecha_cumplimiento: fFechaCumplimiento || null,
        realizo: fRealizo.trim() || null,
        verifico: fverifico.trim() || null,
        visita_id: selectedItem.visita_id ?? null,
        ishikawa: Object.keys(ishikawaPayload).length > 0 ? ishikawaPayload : null,
      })

      for (const fp of fotosPendientes) {
        const ext = fp.file.name.split('.').pop() ?? 'jpg'
        const path = `${profile.org_id}/${accionId}/${crypto.randomUUID()}.${ext}`
        await subirFotoAccion(path, fp.file)
        await agregarFoto(accionId, path, fp.tipo, fp.leyenda.trim() || null)
      }

      await refetch()
      cerrarSheet()
      toast.success('Acción correctiva guardada')
    } catch (e: unknown) {
      toast.error(e instanceof Error ? e.message : 'Error al guardar')
    } finally {
      setGuardando(false)
    }
  }

  async function handleDeleteFoto(fotoId: string, path: string) {
    try {
      await borrarFotosAccion([path])
      await eliminarFotoDb(fotoId)
      setFotosGuardadas((prev) => prev.filter((f) => f.id !== fotoId))
    } catch {
      toast.error('Error al eliminar foto')
    }
  }

  async function handlePickFoto(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0]
    if (!file) return
    try {
      const compressed = await comprimirFoto(file)
      const preview = URL.createObjectURL(compressed)
      setFotosPendientes((prev) => [
        ...prev,
        {
          uid: crypto.randomUUID(),
          file: compressed,
          preview,
          tipo: tipoFotoNueva,
          leyenda: leyendaFotoNueva,
        },
      ])
      setLeyendaFotoNueva('')
    } catch {
      toast.error('Error al procesar la imagen')
    }
    e.target.value = ''
  }

  async function handleExportarPDF() {
    const conAccion = itemsFiltrados.filter((i) => i.accion?.id)
    if (conAccion.length === 0) {
      toast.warning('No hay acciones correctivas para exportar')
      return
    }
    setGenerandoPDF(true)
    try {
      await generarAccionesCorrectivasPDF(
        conAccion.map((i) => i.accion!.id),
        profile?.org_id ?? '',
        orgNombre ?? '—',
        terminosSitio.plural,
        hoy(),
      )
    } catch {
      toast.error('Error al generar PDF')
    } finally {
      setGenerandoPDF(false)
    }
  }

  async function handlePDFIndividual(item: NcBandejaItem) {
    if (!item.accion?.id || !profile?.org_id) return
    try {
      await generarAccionCorrectivaIndividualPDF(
        item.accion.id,
        profile.org_id,
        item.fecha_auditoria,
      )
    } catch {
      toast.error('Error al generar PDF')
    }
  }

  return (
    <div className="min-h-full pb-[calc(72px+34px)]">
      {/* Header */}
      <div className="sticky top-0 z-10 bg-background border-b border-border">
        <div className="flex items-center gap-3 px-4 py-3">
          <button onClick={() => navigate(-1)} className="p-1 -ml-1 text-muted-foreground">
            <ChevronLeft className="w-5 h-5" />
          </button>
          <h1 className="flex-1 text-base text-foreground" style={{ fontWeight: 600 }}>
            Acciones Correctivas
          </h1>
          <button
            onClick={handleExportarPDF}
            disabled={generandoPDF}
            className="flex items-center gap-1.5 h-9 px-3 rounded-xl text-sm disabled:opacity-50"
            style={{ backgroundColor: 'var(--primary)', color: '#fff', fontWeight: 600 }}
          >
            {generandoPDF ? (
              <Loader2 className="w-4 h-4 animate-spin" />
            ) : (
              <FileDown className="w-4 h-4" />
            )}
            PDF
          </button>
        </div>
      </div>

      {/* Filter chips */}
      <div className="px-4 pt-4 pb-2 flex gap-2 flex-wrap">
        {(
          [
            ['todas', 'Todas', items.length],
            ['pendientes', 'Pendientes', conteos.pendientes],
            ['cerradas', 'Cerradas', conteos.cerradas],
          ] as [FiltroEstado, string, number][]
        ).map(([key, label, count]) => (
          <button
            key={key}
            onClick={() => setFiltro(key)}
            className="flex items-center gap-1.5 h-8 px-3 rounded-full text-sm transition-colors"
            style={{
              backgroundColor: filtro === key ? 'var(--primary)' : 'var(--muted)',
              color: filtro === key ? '#fff' : 'var(--muted-foreground)',
              fontWeight: 600,
            }}
          >
            {label}
            <span className="text-xs opacity-75">({count})</span>
          </button>
        ))}
      </div>

      {/* Content */}
      <div className="px-4 pb-4">
        {loading && (
          <div className="flex justify-center py-12">
            <Loader2 className="w-6 h-6 text-primary animate-spin" />
          </div>
        )}
        {!loading && error && (
          <div className="rounded-xl p-4" style={{ backgroundColor: 'var(--agro-danger-fill)' }}>
            <p className="text-sm" style={{ color: 'var(--agro-danger-text)' }}>{error}</p>
          </div>
        )}
        {!loading && !error && itemsFiltrados.length === 0 && (
          <div className="flex flex-col items-center py-16 gap-3">
            <ClipboardCheck className="w-12 h-12 text-muted-foreground" />
            <p className="text-sm text-muted-foreground text-center">
              {filtro === 'cerradas'
                ? 'Sin no-conformidades cerradas.'
                : 'Sin no-conformidades pendientes. ¡Todo al día!'}
            </p>
          </div>
        )}
        {!loading && !error && itemsFiltrados.length > 0 && (
          <div className="space-y-3 mt-2">
            {itemsFiltrados.map((item) => {
              const isPendiente =
                item.estado === 'abierta' || item.estado === 'sin_capturar'
              return (
                <div
                  key={item.respuesta_id}
                  className="rounded-xl border border-border p-4 bg-card"
                  style={
                    isPendiente
                      ? {
                          borderColor: 'var(--agro-amber)',
                          backgroundColor: 'var(--agro-warning-fill)',
                        }
                      : {}
                  }
                >
                  <button
                    className="w-full text-left"
                    onClick={() => abrirSheet(item)}
                  >
                    <div className="flex items-start justify-between gap-2 mb-2">
                      <ChipEstado estado={item.estado} />
                      <span
                        className="text-xs rounded px-1.5 py-0.5 bg-muted text-muted-foreground flex-shrink-0"
                        style={{ fontWeight: 600 }}
                      >
                        {item.modulo_label}
                      </span>
                    </div>
                    <p className="text-xs text-muted-foreground mb-1" style={{ fontWeight: 600 }}>
                      {item.codigo_pregunta}
                    </p>
                    <p className="text-sm text-foreground leading-snug line-clamp-2 mb-2">
                      {item.texto_pregunta}
                    </p>
                    <p className="text-xs text-muted-foreground">
                      {item.rancho_nombre} · {formatFecha(item.fecha_auditoria)}
                    </p>
                  </button>
                  {item.accion && (
                    <div className="mt-2 pt-2 border-t border-border flex items-center justify-end">
                      <button
                        onClick={(e) => {
                          e.stopPropagation()
                          handlePDFIndividual(item)
                        }}
                        className="flex items-center gap-1 text-xs"
                        style={{ color: 'var(--primary)' }}
                      >
                        <FileDown className="w-3.5 h-3.5" /> PDF
                      </button>
                    </div>
                  )}
                </div>
              )
            })}
          </div>
        )}
      </div>

      {/* Bottom Sheet — Detalle / Captura */}
      <BottomSheet open={sheetAbierto} onClose={cerrarSheet} height="95%">
        <div className="flex justify-center pt-3 pb-1 flex-shrink-0">
          <div className="w-9 h-1 rounded-full bg-border" />
        </div>
        <div className="flex items-start justify-between px-4 py-3 border-b border-border flex-shrink-0">
          <div className="flex-1 min-w-0 pr-2">
            <p className="text-xs text-muted-foreground mb-0.5" style={{ fontWeight: 600 }}>
              {selectedItem?.modulo_label} · {selectedItem?.codigo_pregunta}
            </p>
            <h2 className="text-sm text-foreground leading-snug line-clamp-2" style={{ fontWeight: 600 }}>
              {selectedItem?.texto_pregunta}
            </h2>
          </div>
        </div>
        <div className="flex-1 overflow-y-auto px-4 py-4 space-y-4">
          {/* Contexto (no editable) */}
          <div className="rounded-xl p-3 bg-muted space-y-1">
            <p className="text-xs text-muted-foreground">
              <span style={{ fontWeight: 600 }}>{terminosSitio.singular}:</span>{' '}
              {selectedItem?.rancho_nombre}
            </p>
            <p className="text-xs text-muted-foreground">
              <span style={{ fontWeight: 600 }}>Fecha de auditoría:</span>{' '}
              {formatFecha(selectedItem?.fecha_auditoria)}
            </p>
            {selectedItem?.comentario_respuesta && (
              <p className="text-xs text-muted-foreground">
                <span style={{ fontWeight: 600 }}>Comentario auditor:</span>{' '}
                {selectedItem.comentario_respuesta}
              </p>
            )}
          </div>

          {/* Fecha detección */}
          <div className="space-y-1">
            <label className="text-xs text-muted-foreground" style={{ fontWeight: 600 }}>
              FECHA DE DETECCIÓN
            </label>
            <input
              type="date"
              value={fFechaDeteccion}
              onChange={(e) => setFFechaDeteccion(e.target.value)}
              className="w-full h-11 px-3 rounded-xl border border-border bg-input-background text-sm"
            />
          </div>

          {/* No conformidad */}
          <div className="space-y-1">
            <label className="text-xs text-muted-foreground" style={{ fontWeight: 600 }}>
              NO CONFORMIDAD (incumplimiento observado)
            </label>
            <textarea
              value={fNoConformidad}
              onChange={(e) => setFNoConformidad(e.target.value)}
              rows={3}
              placeholder="Describe el incumplimiento observado…"
              className="w-full px-3 py-2.5 rounded-xl border border-border bg-input-background text-sm resize-none"
            />
          </div>

          {/* Causa */}
          <div className="space-y-1">
            <label className="text-xs text-muted-foreground" style={{ fontWeight: 600 }}>
              CAUSA (¿por qué ocurrió?)
            </label>
            <textarea
              value={fCausa}
              onChange={(e) => setFCausa(e.target.value)}
              rows={2}
              placeholder="Causa raíz del incumplimiento…"
              className="w-full px-3 py-2.5 rounded-xl border border-border bg-input-background text-sm resize-none"
            />
          </div>

          {/* Acción correctiva */}
          <div className="space-y-1">
            <label className="text-xs text-muted-foreground" style={{ fontWeight: 600 }}>
              ACCIÓN CORRECTIVA (¿cómo se corrigió?)
            </label>
            <textarea
              value={fAccionCorrectiva}
              onChange={(e) => setFAccionCorrectiva(e.target.value)}
              rows={3}
              placeholder="Descripción de la corrección aplicada…"
              className="w-full px-3 py-2.5 rounded-xl border border-border bg-input-background text-sm resize-none"
            />
          </div>

          {/* Acción preventiva */}
          <div className="space-y-1">
            <label className="text-xs text-muted-foreground" style={{ fontWeight: 600 }}>
              ACCIÓN PREVENTIVA (¿cómo evitar que se repita?)
            </label>
            <textarea
              value={fAccionPreventiva}
              onChange={(e) => setFAccionPreventiva(e.target.value)}
              rows={2}
              placeholder="Medidas para prevenir recurrencia…"
              className="w-full px-3 py-2.5 rounded-xl border border-border bg-input-background text-sm resize-none"
            />
          </div>

          {/* Ishikawa — opcional */}
          <div className="space-y-3">
            <p className="text-xs text-muted-foreground" style={{ fontWeight: 600 }}>
              ANÁLISIS DE CAUSA — ISHIKAWA (opcional)
            </p>
            <div className="grid grid-cols-2 gap-3">
              {ISH_KEYS.map(([key, label]) => (
                <div key={key} className="space-y-1">
                  <label className="text-xs text-muted-foreground">{label}</label>
                  <input
                    type="text"
                    value={ishikawa[key]}
                    onChange={(e) => setIshikawa((prev) => ({ ...prev, [key]: e.target.value }))}
                    placeholder={`Causa: ${label}...`}
                    className="w-full h-9 px-3 rounded-lg border border-border bg-input-background text-sm"
                  />
                </div>
              ))}
            </div>
          </div>

          {/* Fecha cumplimiento */}
          <div className="space-y-1">
            <label className="text-xs text-muted-foreground" style={{ fontWeight: 600 }}>
              FECHA DE CUMPLIMIENTO
            </label>
            <input
              type="date"
              value={fFechaCumplimiento}
              onChange={(e) => setFFechaCumplimiento(e.target.value)}
              className="w-full h-11 px-3 rounded-xl border border-border bg-input-background text-sm"
            />
          </div>

          {/* Realizó / Verificó */}
          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-1">
              <label className="text-xs text-muted-foreground" style={{ fontWeight: 600 }}>
                REALIZÓ
              </label>
              <input
                type="text"
                value={fRealizo}
                onChange={(e) => setFRealizo(e.target.value)}
                placeholder="Nombre"
                className="w-full h-11 px-3 rounded-xl border border-border bg-input-background text-sm"
              />
            </div>
            <div className="space-y-1">
              <label className="text-xs text-muted-foreground" style={{ fontWeight: 600 }}>
                VERIFICÓ
              </label>
              <input
                type="text"
                value={fverifico}
                onChange={(e) => setFverifico(e.target.value)}
                placeholder="Nombre"
                className="w-full h-11 px-3 rounded-xl border border-border bg-input-background text-sm"
              />
            </div>
          </div>

          {/* Evidencia fotográfica */}
          <div className="space-y-3">
            <p className="text-xs text-muted-foreground" style={{ fontWeight: 600 }}>
              EVIDENCIA FOTOGRÁFICA (opcional)
            </p>

            <GaleriaGuardadas fotos={fotosGuardadas} onDelete={handleDeleteFoto} />

            {fotosPendientes.length > 0 && (
              <div className="space-y-2">
                {fotosPendientes.map((fp) => (
                  <div
                    key={fp.uid}
                    className="flex items-center gap-3 p-2 rounded-xl border border-border bg-muted"
                  >
                    <img
                      src={fp.preview}
                      alt=""
                      className="w-14 h-14 object-cover rounded-lg flex-shrink-0"
                    />
                    <div className="flex-1 min-w-0">
                      <p className="text-xs text-muted-foreground" style={{ fontWeight: 600 }}>
                        {fp.tipo === 'no_conformidad' ? 'No conformidad' : 'Evidencia de corrección'}
                      </p>
                      {fp.leyenda && <p className="text-xs truncate">{fp.leyenda}</p>}
                      <p className="text-xs" style={{ color: 'var(--primary)' }}>
                        Pendiente de guardar
                      </p>
                    </div>
                    <button
                      onClick={() =>
                        setFotosPendientes((prev) => prev.filter((f) => f.uid !== fp.uid))
                      }
                      className="p-1.5"
                    >
                      <Trash2 className="w-4 h-4 text-muted-foreground" />
                    </button>
                  </div>
                ))}
              </div>
            )}

            {/* Controles agregar foto */}
            <div className="rounded-xl border border-border p-3 space-y-3">
              <div className="space-y-1">
                <label className="text-xs text-muted-foreground" style={{ fontWeight: 600 }}>
                  TIPO DE FOTO
                </label>
                <div className="flex gap-2">
                  {(
                    [
                      ['no_conformidad', 'No conformidad'],
                      ['evidencia_correccion', 'Evidencia corrección'],
                    ] as ['no_conformidad' | 'evidencia_correccion', string][]
                  ).map(([val, lbl]) => (
                    <button
                      key={val}
                      onClick={() => setTipoFotoNueva(val)}
                      className="flex-1 h-9 rounded-lg text-xs"
                      style={{
                        backgroundColor:
                          tipoFotoNueva === val ? 'var(--primary)' : 'var(--muted)',
                        color: tipoFotoNueva === val ? '#fff' : 'var(--muted-foreground)',
                        fontWeight: 600,
                      }}
                    >
                      {lbl}
                    </button>
                  ))}
                </div>
              </div>
              <div className="space-y-1">
                <label className="text-xs text-muted-foreground" style={{ fontWeight: 600 }}>
                  LEYENDA (opcional)
                </label>
                <input
                  type="text"
                  value={leyendaFotoNueva}
                  onChange={(e) => setLeyendaFotoNueva(e.target.value)}
                  placeholder="Descripción de la foto…"
                  className="w-full h-9 px-3 rounded-lg border border-border bg-input-background text-sm"
                />
              </div>
              <button
                onClick={() => fotoInputRef.current?.click()}
                className="w-full h-10 rounded-xl border-2 border-dashed flex items-center justify-center gap-2 text-sm text-muted-foreground"
              >
                <Camera className="w-4 h-4" /> Agregar foto
              </button>
              <input
                ref={fotoInputRef}
                type="file"
                accept="image/*"
                capture="environment"
                className="hidden"
                onChange={handlePickFoto}
              />
            </div>
          </div>
        </div>

        {/* Footer */}
        <div className="px-4 pb-4 pt-3 border-t border-border flex-shrink-0">
          <button
            onClick={handleGuardar}
            disabled={guardando}
            className="w-full h-12 rounded-3xl text-sm text-white disabled:opacity-60 flex items-center justify-center gap-2"
            style={{ backgroundColor: 'var(--primary)', fontWeight: 600 }}
          >
            {guardando && <Loader2 className="w-4 h-4 animate-spin" />}
            Guardar
          </button>
        </div>
      </BottomSheet>
    </div>
  )
}
