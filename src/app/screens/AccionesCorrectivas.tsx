import { useState, useRef, useEffect } from 'react'
import { motion } from 'motion/react'
import {
  FileDown, Camera, Image, Trash2,
  AlertTriangle, ClipboardCheck, CheckCircle,
} from 'lucide-react'
import { useNavigate } from 'react-router'
import { useContextoTarea } from '@/hooks/useContextoTarea'
import { useRanchos } from '@/hooks/useRanchos'
import { BannerTareaOrigen } from '@/app/components/BannerTareaOrigen'
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
import { Boton } from '@/app/components/ui-mady/Boton'
import { Skeleton } from '@/app/components/ui/skeleton'
import { EstadoVacio } from '@/app/components/ui-mady/EstadoVacio'
import { ListaTarjetas } from '@/app/components/ui-mady/ListaTarjetas'
import { TarjetaRegistro } from '@/app/components/ui-mady/TarjetaRegistro'
import { Etiqueta } from '@/app/components/ui-mady/Etiqueta'
import { Campo } from '@/app/components/ui-mady/Campo'
import { PieFormulario } from '@/app/components/ui-mady/PieFormulario'
import { SelectorSegmentado } from '@/app/components/ui-mady/SelectorSegmentado'
import { useEntradaPantalla } from '@/lib/motion'
import { fechaCorta } from '@/lib/formato'
import { limiteTexto } from '@/lib/limitesTexto'

// ── Helpers ───────────────────────────────────────────────────────────────────

function formatFecha(iso: string | null | undefined): string {
  if (!iso) return '—'
  try {
    return fechaCorta(iso)
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
  if (estado === 'cerrada') return <Etiqueta tono="menta">Cerrada</Etiqueta>
  if (estado === 'abierta') return <Etiqueta tono="sky">Abierta</Etiqueta>
  return <Etiqueta tono="neutral">Sin capturar</Etiqueta>
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
            <Skeleton className="w-14 h-14 rounded-lg flex-shrink-0" />
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
            <p className="text-xs text-muted-foreground font-semibold">
              {f.tipo === 'no_conformidad' ? 'No conformidad' : 'Evidencia de corrección'}
            </p>
            {f.leyenda && <p className="text-xs text-foreground truncate">{f.leyenda}</p>}
          </div>
          <button aria-label="Quitar"
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
  // El Encargado gestiona y cierra acciones correctivas como el administrador (asignar hallazgos sigue siendo solo del administrador)
  const puedeGestionar = esAdmin || profile?.rol === 'asesor_tecnico'
  const { terminosSitio } = useModulosContext()
  const orgNombre = useOrganizacion(profile?.org_id)
  const { items, loading, error, refetch, guardarCapa, cerrarCapa, agregarFoto, eliminarFotoDb } =
    useAccionesCorrectivas()

  const { ranchos } = useRanchos()
  const { tareaId, limpiar } = useContextoTarea(ranchos)
  const [tareaOrigen, setTareaOrigen] = useState<string | null>(null)
  const [resaltadoId, setResaltadoId] = useState<string | null>(null)

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
  const ent = useEntradaPantalla(!loading)

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
    if (!a || puedeGestionar) return true
    return a.ownerUserId === profile?.id || a.creadoPor === profile?.id
  }
  const soloLectura = !!selectedItem && !puedeEditarCapa(selectedItem)
  // La BD solo deja editar el hallazgo a quien lo registró o al administrador
  const puedeEditarHallazgo =
    puedeGestionar || !selectedItem?.accion || selectedItem.accion.hallazgoCreadoPor === profile?.id

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

  // "Ir a la tarea" desde la Agenda: abre la acción correctiva ligada a la tarea
  useEffect(() => {
    if (!tareaId || loading) return
    setTareaOrigen(tareaId)
    const item = items.find((i) => i.accion?.tareaId === tareaId)
    if (!item) {
      toast.info('No encontramos la acción correctiva de esta tarea')
      limpiar()
      return
    }
    setFiltro('todas')
    setResaltadoId(item.respuesta_id)
    abrirSheet(item)
    limpiar()
    requestAnimationFrame(() => {
      document.getElementById(`capa-${item.respuesta_id}`)?.scrollIntoView({ block: 'center', behavior: 'smooth' })
    })
    setTimeout(() => setResaltadoId(null), 2500)
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [tareaId, loading, items])

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
        actualizarHallazgo: puedeEditarHallazgo,
      })

      for (const fp of fotosPendientes) {
        const errImg = validarImagen(fp.file)
        if (errImg) throw new Error(errImg)
        const path = `${profile.org_id}/${capaId}/${crypto.randomUUID()}.jpg`
        await subirFotoAccion(path, fp.file)
        await agregarFoto(capaId, path, fp.tipo, fp.leyenda.trim() || null)
      }

      if (cerrar && puedeGestionar) {
        await cerrarCapa(hallazgoId, capaId)
      }

      await refetch()
      cerrarSheet()
      toast.success(cerrar ? 'No conformidad cerrada' : 'Acción correctiva guardada')
    } catch (e: unknown) {
      // Los errores de Supabase son objetos con message (no Error): así llegan los mensajes de la BD
      const msg = (e as { message?: string } | null)?.message
      if (msg?.includes('FECHA_CUMPLIMIENTO_FUTURA')) {
        toast.warning('La fecha de cumplimiento no puede ser posterior a hoy')
      } else {
        toast.error(msg || 'Error al guardar')
      }
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
      const compressed = await comprimirImagen(file, 9, 'M26')
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
          <Boton tamano="sm" onClick={handleExportarPDF} cargando={generandoPDF}>
            <FileDown className="w-4 h-4" />
            PDF
          </Boton>
        }
      />

      <BannerTareaOrigen tareaId={tareaOrigen} />

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
          inactiveClassName="bg-muted border-transparent text-muted-foreground transition-colors duration-[var(--motion-fast)] ease-[var(--ease-out)] hover:bg-card"
        />
      </div>

      {/* Content */}
      <div className="px-4 pb-4">
        {loading && (
          <div className="mt-2">
            <ListaSkeleton rejilla onReintentar={refetch} />
          </div>
        )}
        {!loading && error && (
          <div className="rounded-xl p-4" style={{ backgroundColor: 'var(--agro-danger-fill)' }}>
            <p className="text-sm" style={{ color: 'var(--agro-danger-text)' }}>{error}</p>
          </div>
        )}
        {!loading && !error && itemsFiltrados.length === 0 && (
          <EstadoVacio
            icono={ClipboardCheck}
            titulo={filtro === 'cerradas'
              ? 'Sin no-conformidades cerradas.'
              : 'Sin no-conformidades pendientes. ¡Todo al día!'}
          />
        )}
        {!loading && !error && itemsFiltrados.length > 0 && (
          <div className="mt-2">
          <ListaTarjetas>
            {itemsFiltrados.map((item, index) => {
              const isPendiente =
                item.estado === 'abierta' || item.estado === 'sin_capturar'
              const est = asig.estados[item.respuesta_id]
              const fecha = est?.fecha_limite
              return (
                <motion.div key={item.respuesta_id} id={`capa-${item.respuesta_id}`} {...ent(index)}>
                  <TarjetaRegistro
                    sinFirmas
                    className={
                      resaltadoId === item.respuesta_id
                        ? 'border-primary bg-[var(--agro-info-fill)]'
                        : isPendiente
                        ? 'border-[var(--agro-menta)] bg-[var(--agro-info-fill)]'
                        : undefined
                    }
                    meta={[item.codigo_pregunta, `${item.rancho_nombre} · ${formatFecha(item.fecha_auditoria)}`]}
                    titulo={item.texto_pregunta}
                    tituloTexto={item.texto_pregunta}
                    alHacerClic={() => abrirSheet(item)}
                    chips={(
                      <>
                        <ChipEstado estado={item.estado} />
                        <Etiqueta tono="neutral">{item.modulo_label}</Etiqueta>
                        {item.accion?.fecha_cumplimiento && (
                          <Etiqueta tono="neutral" className="font-normal">
                            Cumplida: {formatFecha(item.accion.fecha_cumplimiento)}
                          </Etiqueta>
                        )}
                        {item.accion?.fotosSinSubir ? (
                          <Etiqueta tono="sky">
                            {item.accion.fotosSinSubir} foto{item.accion.fotosSinSubir !== 1 ? 's' : ''} sin subir
                          </Etiqueta>
                        ) : null}
                      </>
                    )}
                    acciones={item.accion ? (
                      <Boton variante="secundario" tamano="sm" onClick={() => handlePDFIndividual(item)}>
                        <FileDown className="w-3.5 h-3.5" /> PDF
                      </Boton>
                    ) : undefined}
                  >
                    {esModuloAsignable(item.modulo) && (
                      <div className="mt-2 pt-2 border-t border-border flex items-center justify-between gap-2">
                        <p className="text-xs text-muted-foreground min-w-0">
                          <span className="font-semibold">Responsable · Fecha límite:</span>{' '}
                          {est?.owner_user_id
                            ? `${est.owner_nombre ?? 'Colaborador'}${fecha ? ` · ${formatFechaLimite(fecha)}` : ''}`
                            : 'Sin asignar'}
                        </p>
                        {asig.puedeAsignar && item.estado !== 'cerrada' && (
                          <Boton variante="secundario" tamano="sm" onClick={() => abrirAsignar(item)}>
                            {est?.owner_user_id ? 'Editar asignación' : 'Asignar'}
                          </Boton>
                        )}
                      </div>
                    )}
                  </TarjetaRegistro>
                </motion.div>
              )
            })}
          </ListaTarjetas>
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
      <BottomSheet
        open={sheetAbierto}
        onClose={cerrarSheet}
        height="95%"
        title={selectedItem ? `${selectedItem.modulo_label} · ${selectedItem.codigo_pregunta}` : ''}
      >
        <fieldset disabled={soloLectura} className="flex-1 overflow-y-auto px-4 py-4 space-y-4 min-w-0 border-0 m-0">
          {soloLectura && (
            <div className="rounded-xl p-3 bg-muted">
              <p className="text-xs text-muted-foreground font-semibold">
                Solo lectura: esta acción correctiva la edita su responsable asignado o el administrador.
              </p>
            </div>
          )}
          {!online && (
            <div className="rounded-xl p-3" style={{ backgroundColor: 'var(--agro-info-fill)' }}>
              <p className="text-xs font-semibold" style={{ color: 'var(--agro-info-text)' }}>
                {selectedItem?.accion?.id
                  ? 'Sin conexión: solo se guardan las fotos de evidencia. Cambiar el texto, el estado o cerrar la NC requiere internet.'
                  : 'Necesitas conexión para capturar esta acción correctiva.'}
              </p>
            </div>
          )}
          <p className="text-sm text-foreground leading-snug font-semibold">
            {selectedItem?.texto_pregunta}
          </p>

          {/* Contexto (no editable) */}
          <div className="rounded-xl p-3 bg-muted space-y-1">
            <p className="text-xs text-muted-foreground">
              <span className="font-semibold">{terminosSitio.singular}:</span>{' '}
              {selectedItem?.rancho_nombre}
            </p>
            <p className="text-xs text-muted-foreground">
              <span className="font-semibold">Fecha de auditoría:</span>{' '}
              {formatFecha(selectedItem?.fecha_auditoria)}
            </p>
            {selectedItem?.comentario_respuesta && (
              <p className="text-xs text-muted-foreground">
                <span className="font-semibold">Comentario auditor:</span>{' '}
                {selectedItem.comentario_respuesta}
              </p>
            )}
          </div>

          {/* Fecha detección */}
          <Campo etiqueta="FECHA DE DETECCIÓN" className="gap-1">
            {({ id }) => (
              <>
              {puedeEditarHallazgo ? (
              <input
                id={id}
                type="date"
                value={fFechaDeteccion}
                onChange={(e) => setFFechaDeteccion(e.target.value)}
                className="w-full h-11 px-3 rounded-xl border border-border-control bg-input-background text-sm"
              />
            ) : (
              <>
                <p className="w-full h-11 px-3 rounded-xl border border-border bg-muted text-sm flex items-center">
                  {formatFecha(fFechaDeteccion)}
                </p>
                <p className="text-small text-muted-foreground">
                  Solo quien registró el hallazgo o el administrador puede cambiar este dato
                </p>
              </>
            )}
              </>
            )}
          </Campo>

          {/* No conformidad */}
          <Campo etiqueta="NO CONFORMIDAD (incumplimiento observado)" className="gap-1">
            {({ id }) => (
              <>
              {puedeEditarHallazgo ? (
              <textarea
                id={id}
                value={fNoConformidad}
                onChange={(e) => setFNoConformidad(e.target.value)}
                rows={3}
                placeholder="Describe el incumplimiento observado…"
                className="w-full px-3 py-2.5 rounded-xl border border-border-control bg-input-background text-sm resize-none"
              />
            ) : (
              <>
                <p className="w-full px-3 py-2.5 rounded-xl border border-border bg-muted text-sm whitespace-pre-wrap">
                  {fNoConformidad || '—'}
                </p>
                <p className="text-small text-muted-foreground">
                  Solo quien registró el hallazgo o el administrador puede cambiar este dato
                </p>
              </>
            )}
              </>
            )}
          </Campo>

          {/* Causa */}
          <Campo etiqueta="CAUSA (¿por qué ocurrió?)" className="gap-1">
            {({ id }) => (
              <textarea id={id}
              value={fCausa}
              onChange={(e) => setFCausa(e.target.value)}
              rows={2}
              placeholder="Causa raíz del incumplimiento…"
              className="w-full px-3 py-2.5 rounded-xl border border-border-control bg-input-background text-sm resize-none"
            />
            )}
          </Campo>

          {/* Acción correctiva */}
          <Campo etiqueta="ACCIÓN CORRECTIVA (¿cómo se corrigió?)" className="gap-1">
            {({ id }) => (
              <textarea id={id}
              value={fAccionCorrectiva}
              onChange={(e) => setFAccionCorrectiva(e.target.value)}
              rows={3}
              placeholder="Descripción de la corrección aplicada…"
              className="w-full px-3 py-2.5 rounded-xl border border-border-control bg-input-background text-sm resize-none"
            />
            )}
          </Campo>

          {/* Acción preventiva */}
          <Campo etiqueta="ACCIÓN PREVENTIVA (¿cómo evitar que se repita?)" className="gap-1">
            {({ id }) => (
              <textarea id={id}
              value={fAccionPreventiva}
              onChange={(e) => setFAccionPreventiva(e.target.value)}
              rows={2}
              placeholder="Medidas para prevenir recurrencia…"
              className="w-full px-3 py-2.5 rounded-xl border border-border-control bg-input-background text-sm resize-none"
            />
            )}
          </Campo>

          {/* Fecha límite (solo lectura: la fija el admin al asignar) */}
          <div className="space-y-1">
            <label className="text-xs text-muted-foreground font-semibold">
              FECHA LÍMITE
            </label>
            <p className="w-full h-11 px-3 rounded-xl border border-border bg-muted text-sm flex items-center">
              {selectedItem?.accion?.fecha_limite ? formatFecha(selectedItem.accion.fecha_limite) : 'Sin asignar'}
            </p>
            <p className="text-small text-muted-foreground">
              Se cambia desde{' '}
              {selectedItem && esAdmin && selectedItem.estado !== 'cerrada' && esModuloAsignable(selectedItem.modulo) ? (
                <button
                  type="button"
                  onClick={() => { const it = selectedItem; cerrarSheet(); abrirAsignar(it) }}
                  className="text-primary underline font-semibold"
                >
                  Editar asignación
                </button>
              ) : (
                <span className="font-semibold">Editar asignación</span>
              )}
            </p>
          </div>

          {/* Fecha de cumplimiento (la captura el responsable) */}
          <Campo etiqueta="FECHA DE CUMPLIMIENTO" ayuda="Día en que se completó la acción" className="gap-1">
            {({ id }) => (
              <input id={id}
              type="date"
              value={fFechaCumplimiento}
              max={hoyMX()}
              disabled={soloLectura}
              onChange={(e) => setFFechaCumplimiento(e.target.value)}
              className="w-full h-11 px-3 rounded-xl border border-border-control bg-input-background text-sm"
            />
            )}
          </Campo>

          {/* Realizó / Verificó */}
          <div className="grid grid-cols-2 gap-3">
            <Campo etiqueta="REALIZÓ" className="gap-1">
                {({ id }) => (
                  <input id={id}
                type="text"
                value={fRealizo}
                onChange={(e) => setFRealizo(e.target.value)}
                placeholder="Nombre"
                className="w-full h-11 px-3 rounded-xl border border-border-control bg-input-background text-sm"
              />
                )}
              </Campo>
            <Campo etiqueta="VERIFICÓ" className="gap-1">
                {({ id }) => (
                  <input id={id}
                type="text"
                value={fverifico}
                onChange={(e) => setFverifico(e.target.value)}
                placeholder="Nombre"
                className="w-full h-11 px-3 rounded-xl border border-border-control bg-input-background text-sm"
              />
                )}
              </Campo>
          </div>

          {/* Evidencia fotográfica */}
          <div className="space-y-3">
            <p className="text-xs text-muted-foreground font-semibold">
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
                      <p className="text-xs text-muted-foreground font-semibold">
                        {fp.tipo === 'no_conformidad' ? 'No conformidad' : 'Evidencia de corrección'}
                      </p>
                      {fp.leyenda && <p className="text-xs truncate">{fp.leyenda}</p>}
                      <p className="text-xs" style={{ color: 'var(--primary)' }}>
                        Pendiente de guardar
                      </p>
                    </div>
                    <button aria-label="Quitar"
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
                <label className="text-xs text-muted-foreground font-semibold">
                  TIPO DE FOTO
                </label>
                <SelectorSegmentado<'no_conformidad' | 'evidencia_correccion'>
                  ariaLabel="Tipo de foto"
                  value={tipoFotoNueva}
                  onChange={setTipoFotoNueva}
                  options={[
                    { value: 'no_conformidad', label: 'No conformidad' },
                    { value: 'evidencia_correccion', label: 'Evidencia corrección' },
                  ]}
                />
              </div>
              <div className="space-y-1">
                <label className="text-xs text-muted-foreground font-semibold">
                  LEYENDA (opcional)
                </label>
                <input maxLength={limiteTexto('accion_correctiva_fotos', 'leyenda')}
                  type="text"
                  value={leyendaFotoNueva}
                  onChange={(e) => setLeyendaFotoNueva(e.target.value)}
                  placeholder="Descripción de la foto…"
                  className="w-full h-9 px-3 rounded-lg border border-border-control bg-input-background text-sm"
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
          <PieFormulario
            textoPrincipal={online ? 'Guardar' : 'Guardar fotos sin conexión'}
            onPrincipal={() => handleGuardar(false)}
            onCancelar={cerrarSheet}
            cargando={guardando}
            aviso={puedeGestionar && online && selectedItem?.accion?.hallazgoId && selectedItem.accion.estado !== 'cerrada' ? (
              <Boton
                variante="secundario"
                className="w-full"
                onClick={() => handleGuardar(true)}
                cargando={guardando}
              >
                <CheckCircle className="w-4 h-4" />
                Guardar y cerrar NC
              </Boton>
            ) : undefined}
          />
        )}
      </BottomSheet>
    </div>
  )
}
