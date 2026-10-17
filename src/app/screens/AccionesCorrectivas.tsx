import { useState, useRef, useEffect } from 'react'
import {
  Loader2, FileDown, Camera, Image, Trash2,
  AlertTriangle, ClipboardCheck, CheckCircle,
} from 'lucide-react'
import { useNavigate } from 'react-router'
import { ModuloHeader } from '@/app/components/ModuloHeader'
import { BottomSheet } from '@/app/components/BottomSheet'
import { FotoEvidencia } from '@/app/components/FotoEvidencia'
import { ListaSkeleton } from '@/app/components/ListaSkeleton'
import { FiltroPildoras } from '@/app/components/FiltroPildoras'
import { toast } from 'sonner'
import { comprimirImagen } from '@/lib/fotos/comprimirImagen'
import { useConexion } from '@/hooks/useConexion'
import { useGuardarOffline } from '@/hooks/useGuardarOffline'
import { opInsert } from '@/lib/offline/construirOperaciones'
import type { AdjuntoOutbox } from '@/lib/offline/tipos'
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
import { validarImagen } from '@/lib/validarImagen'
import {
  generarAccionCorrectivaIndividualPDF,
  generarAccionesCorrectivasPDF,
} from '@/lib/pdf/m26/generarAccionesCorrectivasPDF'
import { hoyMX } from '@/lib/fecha'
import { useAsignacionHallazgos } from '@/hooks/useAsignacionHallazgos'
import { AsignarHallazgoSheet } from '@/app/components/hallazgos/AsignarHallazgoSheet'
import { esModuloAsignable, formatFechaLimite } from '@/lib/hallazgos/asignacion'
import type { AccionCorrectivaFoto } from '@/types/database.types'

// ── Helpers ───────────────────────────────────────────────────────────────────

function formatFecha(iso: string | null | undefined): string {
  if (!iso) return '—'
  try {
    return new Date(iso + 'T12:00:00').toLocaleDateString('es-MX', {
      day: 'numeric', month: 'short', year: 'numeric',
    })
  } catch { return iso }
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
            <FotoEvidencia
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
  const esAdmin = profile?.rol === 'admin_org' || profile?.rol === 'super_admin'
  const { terminosSitio } = useModulosContext()
  const orgNombre = useOrganizacion(profile?.org_id)
  const { items, loading, error, refetch, guardarCapa, cerrarCapa, agregarFoto, eliminarFotoDb } =
    useAccionesCorrectivas()

  const { online } = useConexion()
  const asig = useAsignacionHallazgos(items)
  const [itemAsignar, setItemAsignar] = useState<NcBandejaItem | null>(null)
  const { guardar: guardarOffline } = useGuardarOffline('M26')
  const [filtro, setFiltro] = useState<FiltroEstado>('pendientes')
  const [sheetAbierto, setSheetAbierto] = useState(false)
  const [selectedItem, setSelectedItem] = useState<NcBandejaItem | null>(null)

  const [fFechaDeteccion, setFFechaDeteccion] = useState('')
  const [fNoConformidad, setFNoConformidad] = useState('')
  const [fCausa, setFCausa] = useState('')
  const [fAccionCorrectiva, setFAccionCorrectiva] = useState('')
  const [fAccionPreventiva, setFAccionPreventiva] = useState('')
  const [fFechaCumplimiento, setFFechaCumplimiento] = useState('')
  const [fRealizo, setFRealizo] = useState('')
  const [fverifico, setFverifico] = useState('')

  const [fotosGuardadas, setFotosGuardadas] = useState<AccionCorrectivaFoto[]>([])
  const [fotosPendientes, setFotosPendientes] = useState<FotoLocal[]>([])
  const fotoCamaraRef = useRef<HTMLInputElement>(null)
  const fotoGaleriaRef = useRef<HTMLInputElement>(null)
  const [tipoFotoNueva, setTipoFotoNueva] = useState<'no_conformidad' | 'evidencia_correccion'>(
    'evidencia_correccion'
  )
  const [leyendaFotoNueva, setLeyendaFotoNueva] = useState('')

  const [guardando, setGuardando] = useState(false)
  const [generandoPDF, setGenerandoPDF] = useState(false)

  const itemsFiltrados = items.filter((item) => {
    if (filtro === 'pendientes') return item.estado === 'sin_capturar' || item.estado === 'abierta'
    if (filtro === 'cerradas') return item.estado === 'cerrada'
    return true
  })

  const conteos = {
    pendientes: items.filter((i) => i.estado === 'sin_capturar' || i.estado === 'abierta').length,
    cerradas: items.filter((i) => i.estado === 'cerrada').length,
  }

  // Quien no es admin edita una CAPA existente solo si es su responsable o quien la creó
  function puedeEditarCapa(item: NcBandejaItem | null): boolean {
    const a = item?.accion
    if (!a || esAdmin) return true
    return a.ownerUserId === profile?.id || a.creadoPor === profile?.id
  }
  const soloLectura = !!selectedItem && !puedeEditarCapa(selectedItem)

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
    setSheetAbierto(true)
  }

  function abrirAsignar(item: NcBandejaItem) {
    if (!online) { toast.warning('Necesitas conexión para asignar un hallazgo'); return }
    setItemAsignar(item)
    asig.cargarColaboradores()
  }

  function cerrarSheet() {
    setSheetAbierto(false)
    setSelectedItem(null)
    setFotosPendientes([])
  }

  async function handleGuardar(cerrar = false) {
    if (!selectedItem || !profile?.org_id) return
    setGuardando(true)
    try {
      if (!online) {
        // Sin red solo se registra evidencia (fotos) de una acción correctiva que ya existe
        const capaIdExistente = selectedItem.accion?.id
        if (!capaIdExistente || cerrar) { toast.warning('Necesitas conexión para esto'); return }
        if (fotosPendientes.length === 0) {
          toast.warning('Sin conexión solo puedes agregar fotos de evidencia')
          return
        }
        const operaciones = []
        const adjuntos: Omit<AdjuntoOutbox, 'loteId'>[] = []
        for (const fp of fotosPendientes) {
          const errImg = validarImagen(fp.file)
          if (errImg) throw new Error(errImg)
          const fotoUid = crypto.randomUUID()
          const path = `${profile.org_id}/${capaIdExistente}/${crypto.randomUUID()}.jpg`
          adjuntos.push({ uid: fotoUid, blob: fp.file, path, bucket: 'acciones-correctivas' })
          operaciones.push(opInsert('accion_correctiva_fotos', {
            id: fotoUid,
            capa_id: capaIdExistente,
            tipo: fp.tipo,
            storage_path: path,
            leyenda: fp.leyenda.trim() || null,
          }))
        }
        const ok = await guardarOffline({
          descripcion: `Acción correctiva · ${selectedItem.codigo_pregunta} · ${fotosPendientes.length} foto${fotosPendientes.length !== 1 ? 's' : ''} de evidencia`,
          metadatos: { rancho_id: selectedItem.rancho_id, rancho_nombre: selectedItem.rancho_nombre, capa_id: capaIdExistente, fotos_count: fotosPendientes.length },
          operaciones,
          adjuntos,
        })
        if (ok) cerrarSheet()
        return
      }

      const { hallazgoId, capaId } = await guardarCapa({
        hallazgoId: selectedItem.accion?.hallazgoId ?? null,
        capaId: selectedItem.accion?.id ?? null,
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
        actualizarHallazgo: esAdmin || !selectedItem.accion || selectedItem.accion.hallazgoCreadoPor === profile?.id,
      })

      for (const fp of fotosPendientes) {
        const errImg = validarImagen(fp.file)
        if (errImg) throw new Error(errImg)
        const path = `${profile.org_id}/${capaId}/${crypto.randomUUID()}.jpg`
        await subirFotoAccion(path, fp.file)
        await agregarFoto(capaId, path, fp.tipo, fp.leyenda.trim() || null)
      }

      if (cerrar && esAdmin) {
        await cerrarCapa(hallazgoId, capaId)
      }

      await refetch()
      cerrarSheet()
      toast.success(cerrar ? 'No conformidad cerrada' : 'Acción correctiva guardada')
    } catch (e: unknown) {
      // Los errores de Supabase son objetos con message (no Error): así llegan los mensajes de la BD
      const msg = (e as { message?: string } | null)?.message
      toast.error(msg || 'Error al guardar')
    } finally {
      setGuardando(false)
    }
  }

  async function handleDeleteFoto(fotoId: string, path: string) {
    if (!online) { toast.warning('Necesitas conexión para esto'); return }
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
    const toastId = toast.loading('Optimizando foto...')
    try {
      const compressed = await comprimirImagen(file, 9)
      toast.dismiss(toastId)
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
      toast.dismiss(toastId)
      toast.error('Error al procesar la imagen')
    }
    e.target.value = ''
  }

  async function handleExportarPDF() {
    if (!online) { toast.warning('Necesitas conexión para generar el PDF'); return }
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
        hoyMX(),
      )
    } catch {
      toast.error('Error al generar PDF')
    } finally {
      setGenerandoPDF(false)
    }
  }

  async function handlePDFIndividual(item: NcBandejaItem) {
    if (!item.accion?.id || !profile?.org_id) return
    if (!online) { toast.warning('Necesitas conexión para generar el PDF'); return }
    try {
      await generarAccionCorrectivaIndividualPDF(
        item.accion.id,
        profile.org_id,
        item.fecha_auditoria,
        item.rancho_nombre,
      )
    } catch {
      toast.error('Error al generar PDF')
    }
  }

  return (
    <div className="min-h-full pb-safe-nav">
      <ModuloHeader
        tituloFallback="Plan de Acciones Correctivas"
        onBack={() => navigate(-1)}
        acciones={
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
        }
      />

      {/* Filter chips */}
      <div className="px-4 pt-4 pb-2 flex gap-2 flex-wrap">
        <FiltroPildoras<FiltroEstado>
          options={[
            { value: 'todas', label: <>Todas <span className="text-xs opacity-75">({items.length})</span></> },
            { value: 'pendientes', label: <>Pendientes <span className="text-xs opacity-75">({conteos.pendientes})</span></> },
            { value: 'cerradas', label: <>Cerradas <span className="text-xs opacity-75">({conteos.cerradas})</span></> },
          ]}
          value={filtro}
          onChange={setFiltro}
          inactiveClassName="bg-muted border-transparent text-muted-foreground hover:bg-card"
        />
      </div>

      {/* Content */}
      <div className="px-4 pb-4">
        {loading && (
          <ListaSkeleton />
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
                  {esModuloAsignable(item.modulo) && (() => {
                    const est = asig.estados[item.respuesta_id]
                    const fecha = est?.fecha_limite
                    return (
                      <div className="mt-2 pt-2 border-t border-border flex items-center justify-between gap-2">
                        <p className="text-xs text-muted-foreground min-w-0">
                          <span style={{ fontWeight: 600 }}>Responsable · Fecha límite:</span>{' '}
                          {est?.owner_user_id
                            ? `${est.owner_nombre ?? 'Colaborador'}${fecha ? ` · ${formatFechaLimite(fecha)}` : ''}`
                            : 'Sin asignar'}
                        </p>
                        {asig.puedeAsignar && item.estado !== 'cerrada' && (
                          <button
                            onClick={() => abrirAsignar(item)}
                            className="h-8 px-3 rounded-lg text-xs text-primary border border-primary hover:bg-primary/5 transition-colors flex-shrink-0"
                            style={{ fontWeight: 600 }}
                          >
                            {est?.owner_user_id ? 'Editar asignación' : 'Asignar'}
                          </button>
                        )}
                      </div>
                    )
                  })()}
                  {item.accion && (
                    <div className="mt-2 pt-2 border-t border-border flex items-center justify-between gap-2">
                      {item.accion.fotosSinSubir ? (
                        <span className="text-xs px-2 py-0.5 rounded-full" style={{ backgroundColor: 'var(--agro-warning-fill)', color: 'var(--agro-warning-text)', fontWeight: 600 }}>
                          {item.accion.fotosSinSubir} foto{item.accion.fotosSinSubir !== 1 ? 's' : ''} sin subir
                        </span>
                      ) : <span />}
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

      <AsignarHallazgoSheet
        item={itemAsignar}
        colaboradores={asig.colaboradores}
        cargandoColab={asig.cargandoColab}
        errorColab={asig.errorColab}
        onRecargarColab={asig.cargarColaboradores}
        onGuardado={async () => { await Promise.all([asig.recargarEstados(), refetch()]) }}
        onClose={() => setItemAsignar(null)}
      />

      {/* Bottom Sheet — Detalle / Captura */}
      <BottomSheet open={sheetAbierto} onClose={cerrarSheet} height="95%">
        <div className="flex items-start justify-between px-4 pt-4 pb-3 border-b border-border flex-shrink-0">
          <div className="flex-1 min-w-0 pr-2">
            <p className="text-xs text-muted-foreground mb-0.5" style={{ fontWeight: 600 }}>
              {selectedItem?.modulo_label} · {selectedItem?.codigo_pregunta}
            </p>
            <h2 className="text-sm text-foreground leading-snug line-clamp-2" style={{ fontWeight: 600 }}>
              {selectedItem?.texto_pregunta}
            </h2>
          </div>
        </div>
        <fieldset disabled={soloLectura} className="flex-1 overflow-y-auto px-4 py-4 space-y-4 min-w-0 border-0 m-0">
          {soloLectura && (
            <div className="rounded-xl p-3 bg-muted">
              <p className="text-xs text-muted-foreground" style={{ fontWeight: 600 }}>
                Solo lectura: esta acción correctiva la edita su responsable asignado o el administrador.
              </p>
            </div>
          )}
          {!online && (
            <div className="rounded-xl p-3" style={{ backgroundColor: 'var(--agro-warning-fill)' }}>
              <p className="text-xs" style={{ color: 'var(--agro-warning-text)', fontWeight: 600 }}>
                {selectedItem?.accion?.id
                  ? 'Sin conexión: solo se guardan las fotos de evidencia. Cambiar el texto, el estado o cerrar la NC requiere internet.'
                  : 'Necesitas conexión para capturar esta acción correctiva.'}
              </p>
            </div>
          )}
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
                    <FotoEvidencia
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
              <input
                ref={fotoCamaraRef}
                type="file"
                accept="image/*"
                capture="environment"
                className="hidden"
                onChange={handlePickFoto}
              />
              <input
                ref={fotoGaleriaRef}
                type="file"
                accept="image/*"
                className="hidden"
                onChange={handlePickFoto}
              />
              <div className="flex gap-2">
                <button
                  type="button"
                  onClick={() => fotoCamaraRef.current?.click()}
                  className="flex-1 h-10 rounded-xl border-2 border-dashed flex items-center justify-center gap-2 text-sm text-muted-foreground hover:border-primary hover:text-primary transition-colors"
                >
                  <Camera className="w-4 h-4" /> Tomar foto
                </button>
                <button
                  type="button"
                  onClick={() => fotoGaleriaRef.current?.click()}
                  className="flex-1 h-10 rounded-xl border-2 border-dashed flex items-center justify-center gap-2 text-sm text-muted-foreground hover:border-primary hover:text-primary transition-colors"
                >
                  <Image className="w-4 h-4" /> Galería
                </button>
              </div>
              <p className="text-xs text-muted-foreground">
                Si la app se cierra al tomar la foto, tómala con la cámara del teléfono y súbela con Galería.
              </p>
            </div>
          </div>
        </fieldset>

        {/* Footer */}
        {!soloLectura && (
        <div className="px-4 pb-4 pt-3 border-t border-border flex-shrink-0 space-y-2">
          {esAdmin && online && selectedItem?.accion?.hallazgoId && selectedItem.accion.estado !== 'cerrada' && (
            <button
              onClick={() => handleGuardar(true)}
              disabled={guardando}
              className="w-full h-11 rounded-3xl text-sm disabled:opacity-60 flex items-center justify-center gap-2 border-2"
              style={{ borderColor: 'var(--agro-success-text)', color: 'var(--agro-success-text)', fontWeight: 600 }}
            >
              {guardando ? <Loader2 className="w-4 h-4 animate-spin" /> : <CheckCircle className="w-4 h-4" />}
              Guardar y cerrar NC
            </button>
          )}
          <button
            onClick={() => handleGuardar(false)}
            disabled={guardando}
            className="w-full h-12 rounded-3xl text-sm text-white disabled:opacity-60 flex items-center justify-center gap-2"
            style={{ backgroundColor: 'var(--primary)', fontWeight: 600 }}
          >
            {guardando && <Loader2 className="w-4 h-4 animate-spin" />}
            {online ? 'Guardar' : 'Guardar fotos sin conexión'}
          </button>
        </div>
        )}
      </BottomSheet>
    </div>
  )
}
