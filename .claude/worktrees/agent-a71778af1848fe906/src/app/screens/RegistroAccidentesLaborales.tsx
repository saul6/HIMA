import { useState, useRef, useEffect, useCallback } from 'react'
import {
  ChevronLeft, Plus, Loader2, Files, Camera, Trash2,
  AlertTriangle, FileDown, ShieldAlert,
} from 'lucide-react'
import { useNavigate } from 'react-router'
import { BottomSheet } from '@/app/components/BottomSheet'
import { toast } from 'sonner'
import imageCompression from 'browser-image-compression'
import { useAuthContext } from '@/context/AuthContext'
import { codigoFormato } from '@/lib/codigoFormato'
import { useModulosContext } from '@/context/ModulosContext'
import { useRanchos } from '@/hooks/useRanchos'
import { useM20Accidentes, type M20AccidenteConFotos } from '@/hooks/useM20Accidentes'
import { useOrganizacion } from '@/hooks/useOrganizacion'
import { supabase } from '@/lib/supabase'
import { subirFoto, borrarFotos, getSignedUrls } from '@/lib/storage/incidenciasStorage'
import { validarImagen } from '@/lib/validarImagen'
import { generarAccidenteLaboralPDF } from '@/lib/pdf/m20/generarAccidenteLaboralPDF'
import { generarAccidenteLaboralConsolidadoPDF } from '@/lib/pdf/m20/generarAccidenteLaboralConsolidadoPDF'
import { Button } from '@/app/components/ui/button'

// ── Constantes ────────────────────────────────────────────────────────────────

const TITULO_MODULO = 'Accidentes Laborales'
const MAX_FOTO_BYTES = 5.5 * 1024 * 1024

const ATENCIONES_UI = [
  'Ninguna',
  'Curación',
  'Primeros auxilios',
  'Atención de paramédicos',
  'Atención médica',
  'Hospitalización',
]

const hoy = () => new Date().toLocaleDateString('en-CA', { timeZone: 'America/Mexico_City' })

// ── Tipos internos ────────────────────────────────────────────────────────────

interface FotoLocal {
  uid: string
  file: File
  preview: string
}

interface FormState {
  ranchoId: string
  fecha: string
  trabajadorNombre: string
  descripcionIncidente: string
  atencionRecibida: string[]
  requirioIncapacidad: boolean
  incapacidadMotivo: string
  requirioLimpieza: boolean
  limpiezaDescripcion: string
  productoInvolucrado: boolean
  disposicionProducto: string
}

const FORM_INICIAL: FormState = {
  ranchoId: '',
  fecha: hoy(),
  trabajadorNombre: '',
  descripcionIncidente: '',
  atencionRecibida: [],
  requirioIncapacidad: false,
  incapacidadMotivo: '',
  requirioLimpieza: false,
  limpiezaDescripcion: '',
  productoInvolucrado: false,
  disposicionProducto: '',
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

// ── Sub-componente: galería de fotos guardadas ────────────────────────────────

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
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [paths.join('|')])

  if (paths.length === 0) return null

  return (
    <div className="flex flex-wrap gap-1 mt-2">
      {paths.map((p) =>
        cargando ? (
          <div key={p} className="w-14 h-14 rounded-lg bg-muted flex items-center justify-center">
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
          <div key={p} className="w-14 h-14 rounded-lg bg-muted flex items-center justify-center">
            <AlertTriangle className="w-4 h-4 text-muted-foreground" />
          </div>
        )
      )}
    </div>
  )
}

// ── Sub-componente: card de accidente ─────────────────────────────────────────

function AccidenteCard({
  acc,
  onPDF,
  cargandoPDF,
  orgNombre,
}: {
  acc: M20AccidenteConFotos
  onPDF: (id: string) => void
  cargandoPDF: string | null
  orgNombre: string | null
}) {
  const fotoPaths = acc.fotos.map((f) => f.storage_path)

  return (
    <div className="bg-card rounded-xl border border-border p-4 flex flex-col gap-2">
      <div className="flex items-start justify-between gap-2">
        <div className="flex flex-col gap-1 flex-1 min-w-0">
          <div className="flex items-center gap-2 flex-wrap">
            {orgNombre && (
              <span className="text-xs text-muted-foreground font-medium">{orgNombre} ·</span>
            )}
            <span className="text-xs font-semibold bg-[var(--agro-success-fill)] text-[var(--agro-success-text)] px-2 py-0.5 rounded-full truncate">
              {acc.rancho_nombre}
            </span>
            <span className="text-xs text-muted-foreground">{formatFecha(acc.fecha)}</span>
          </div>
          <p className="text-sm font-semibold text-foreground leading-snug mt-0.5">
            {acc.trabajador_nombre}
          </p>
          {acc.descripcion_incidente && (
            <p className="text-xs text-muted-foreground line-clamp-2 leading-snug">
              {acc.descripcion_incidente}
            </p>
          )}
          {acc.atencion_recibida.length > 0 && (
            <div className="flex flex-wrap gap-1 mt-1">
              {acc.atencion_recibida.map((a) => (
                <span
                  key={a}
                  className="text-xs bg-[var(--agro-warning-fill)] text-[var(--agro-warning-text)] px-2 py-0.5 rounded-full"
                >
                  {a}
                </span>
              ))}
            </div>
          )}
          {fotoPaths.length > 0 && <GaleriaFotos paths={fotoPaths} />}
        </div>

        <Button
          variant="ghost"
          size="icon"
          className="shrink-0 text-[var(--primary)] hover:bg-[var(--agro-success-fill)]"
          onClick={() => onPDF(acc.id)}
          disabled={cargandoPDF === acc.id}
          aria-label="Descargar PDF"
        >
          {cargandoPDF === acc.id
            ? <Loader2 className="w-4 h-4 animate-spin" />
            : <FileDown className="w-4 h-4" />}
        </Button>
      </div>

      {/* Indicadores booleanos */}
      <div className="flex gap-2 flex-wrap text-xs">
        {acc.requirio_incapacidad && (
          <span className="bg-[var(--agro-danger-fill)] text-[var(--agro-danger-text)] px-2 py-0.5 rounded-full">
            Incapacidad
          </span>
        )}
        {acc.requirio_limpieza && (
          <span className="bg-[var(--agro-warning-fill)] text-[var(--agro-warning-text)] px-2 py-0.5 rounded-full">
            Limpieza requerida
          </span>
        )}
        {acc.producto_involucrado && (
          <span className="bg-[var(--agro-warning-fill)] text-[var(--agro-warning-text)] px-2 py-0.5 rounded-full">
            Producto involucrado
          </span>
        )}
      </div>
    </div>
  )
}

// ── Toggle Si/No ──────────────────────────────────────────────────────────────

function SiNoToggle({
  value,
  onChange,
}: {
  value: boolean
  onChange: (v: boolean) => void
}) {
  return (
    <div className="flex rounded-lg overflow-hidden border border-border w-fit">
      <button
        type="button"
        onClick={() => onChange(true)}
        className={`px-5 py-2 text-sm font-semibold transition-colors ${
          value
            ? 'bg-[var(--primary)] text-white'
            : 'bg-card text-muted-foreground hover:bg-muted'
        }`}
      >
        Sí
      </button>
      <button
        type="button"
        onClick={() => onChange(false)}
        className={`px-5 py-2 text-sm font-semibold transition-colors border-l border-border ${
          !value
            ? 'bg-[var(--agro-red)] text-white'
            : 'bg-card text-muted-foreground hover:bg-muted'
        }`}
      >
        No
      </button>
    </div>
  )
}

// ── Pantalla principal ────────────────────────────────────────────────────────

export function RegistroAccidentesLaborales() {
  const navigate = useNavigate()
  const { profile, codigoClave } = useAuthContext()
  const esSuperAdmin = profile?.rol === 'super_admin'
  const { terminosSitio } = useModulosContext()
  const { ranchos } = useRanchos()
  const { accidentes, loading, error, refetch } = useM20Accidentes()
  const orgNombre = useOrganizacion(profile?.org_id)

  // Sheets
  const [sheetNuevo, setSheetNuevo] = useState(false)
  const [sheetConsolidado, setSheetConsolidado] = useState(false)

  // Form
  const [form, setForm] = useState<FormState>(FORM_INICIAL)
  const [fotosLocal, setFotosLocal] = useState<FotoLocal[]>([])
  const [guardando, setGuardando] = useState(false)
  const fotoInputRef = useRef<HTMLInputElement>(null)

  // PDF individual
  const [cargandoPDF, setCargandoPDF] = useState<string | null>(null)

  // Consolidado
  const [consolidadoRanchoId, setConsolidadoRanchoId] = useState('')
  const [consolidadoDesde, setConsolidadoDesde] = useState('')
  const [consolidadoHasta, setConsolidadoHasta] = useState('')
  const [cargandoConsolidado, setCargandoConsolidado] = useState(false)

  const set = useCallback(<K extends keyof FormState>(k: K, v: FormState[K]) => {
    setForm((f) => ({ ...f, [k]: v }))
  }, [])

  // ── Manejo de fotos ─────────────────────────────────────────────────────────

  async function handleFotoInput(e: React.ChangeEvent<HTMLInputElement>) {
    const files = Array.from(e.target.files ?? [])
    e.target.value = ''
    for (const raw of files) {
      if (raw.size > MAX_FOTO_BYTES) {
        toast.error(`La foto ${raw.name} supera 5.5 MB`)
        continue
      }
      try {
        const compressed = await comprimirFoto(raw)
        const preview = URL.createObjectURL(compressed)
        setFotosLocal((prev) => [...prev, { uid: crypto.randomUUID(), file: compressed, preview }])
      } catch {
        toast.error('Error al procesar la foto')
      }
    }
  }

  function eliminarFotoLocal(uid: string) {
    setFotosLocal((prev) => {
      const found = prev.find((f) => f.uid === uid)
      if (found) URL.revokeObjectURL(found.preview)
      return prev.filter((f) => f.uid !== uid)
    })
  }

  // ── Manejo de atenciones ────────────────────────────────────────────────────

  function toggleAtencion(opcion: string) {
    setForm((f) => {
      const actual = f.atencionRecibida
      if (opcion === 'Ninguna') {
        return { ...f, atencionRecibida: actual.includes('Ninguna') ? [] : ['Ninguna'] }
      }
      const sinNinguna = actual.filter((a) => a !== 'Ninguna')
      const existe = sinNinguna.includes(opcion)
      return {
        ...f,
        atencionRecibida: existe
          ? sinNinguna.filter((a) => a !== opcion)
          : [...sinNinguna, opcion],
      }
    })
  }

  // ── Guardar ─────────────────────────────────────────────────────────────────

  async function handleGuardar() {
    if (!form.ranchoId) { toast.error(`Selecciona una ${terminosSitio.singular}`); return }
    if (!form.fecha) { toast.error('Selecciona la fecha del accidente'); return }
    if (!form.trabajadorNombre.trim()) { toast.error('Ingresa el nombre del trabajador'); return }
    if (!profile?.org_id) return

    for (const foto of fotosLocal) {
      const errImg = validarImagen(foto.file)
      if (errImg) { toast.error(errImg); return }
    }

    setGuardando(true)
    const pathsSubidos: string[] = []
    let accidenteId: string | null = null

    try {
      // 1. INSERT accidente
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const { data: ins, error: insErr } = await (supabase as any)
        .from('m20_accidentes')
        .insert({
          org_id: profile.org_id,
          rancho_id: form.ranchoId,
          fecha: form.fecha,
          trabajador_nombre: form.trabajadorNombre.trim(),
          descripcion_incidente: form.descripcionIncidente.trim() || null,
          atencion_recibida: form.atencionRecibida,
          requirio_incapacidad: form.requirioIncapacidad,
          incapacidad_motivo: form.requirioIncapacidad && form.incapacidadMotivo.trim()
            ? form.incapacidadMotivo.trim()
            : null,
          requirio_limpieza: form.requirioLimpieza,
          limpieza_descripcion: form.requirioLimpieza && form.limpiezaDescripcion.trim()
            ? form.limpiezaDescripcion.trim()
            : null,
          producto_involucrado: form.productoInvolucrado,
          disposicion_producto: form.productoInvolucrado && form.disposicionProducto.trim()
            ? form.disposicionProducto.trim()
            : null,
        })
        .select('id')
        .single()
      if (insErr) throw insErr
      accidenteId = (ins as any).id as string

      // 2. Subir fotos
      for (let i = 0; i < fotosLocal.length; i++) {
        const foto = fotosLocal[i]
        const ext = 'jpg'
        const path = `${profile.org_id}/m20/${accidenteId}/${crypto.randomUUID()}.${ext}`
        await subirFoto(path, foto.file)
        pathsSubidos.push(path)

        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        await (supabase as any)
          .from('m20_accidente_fotos')
          .insert({ accidente_id: accidenteId, org_id: profile.org_id, storage_path: path, orden: i })
      }

      // 3. Refetch + PDF + cierre
      await refetch()
      toast.success('Accidente registrado')
      setSheetNuevo(false)
      setForm(FORM_INICIAL)
      setFotosLocal([])

      try {
        await generarAccidenteLaboralPDF(accidenteId, profile.org_id)
      } catch {
        toast.warning('Registro guardado. No se pudo generar el PDF automáticamente.')
      }
    } catch (e: unknown) {
      // Rollback
      if (pathsSubidos.length > 0) {
        borrarFotos(pathsSubidos).catch(() => {})
      }
      if (accidenteId) {
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        ;(supabase as any).from('m20_accidentes').delete().eq('id', accidenteId).then(() => {})
      }
      const msg = e instanceof Error ? e.message : 'Error al guardar el registro'
      if (msg.includes('FECHA_SOLO_HOY')) {
        toast.warning('Solo puedes registrar con la fecha de hoy')
      } else {
        toast.error(msg)
      }
    } finally {
      setGuardando(false)
    }
  }

  // ── PDF individual ──────────────────────────────────────────────────────────

  async function handlePDF(id: string) {
    if (!profile?.org_id) return
    setCargandoPDF(id)
    try {
      await generarAccidenteLaboralPDF(id, profile.org_id)
    } catch {
      toast.error('No se pudo generar el PDF')
    } finally {
      setCargandoPDF(null)
    }
  }

  // ── Consolidado ─────────────────────────────────────────────────────────────

  async function handleConsolidado() {
    if (!consolidadoRanchoId) { toast.error(`Selecciona una ${terminosSitio.singular}`); return }
    if (!consolidadoDesde || !consolidadoHasta) { toast.error('Selecciona el rango de fechas'); return }
    if (!profile?.org_id) return
    const rancho = ranchos.find((r) => r.id === consolidadoRanchoId)
    setCargandoConsolidado(true)
    try {
      await generarAccidenteLaboralConsolidadoPDF(
        consolidadoRanchoId,
        rancho?.nombre ?? '—',
        profile.org_id,
        consolidadoDesde,
        consolidadoHasta,
      )
      setSheetConsolidado(false)
    } catch (e: unknown) {
      toast.error(e instanceof Error ? e.message : 'Error al generar el PDF')
    } finally {
      setCargandoConsolidado(false)
    }
  }

  // ── Render ──────────────────────────────────────────────────────────────────

  return (
    <div className="flex flex-col h-full bg-background">

      {/* Header */}
      <div className="flex items-center gap-3 px-4 pt-safe-top pt-4 pb-3 bg-card border-b border-border">
        <button
          type="button"
          onClick={() => navigate(-1)}
          className="p-1 -ml-1 text-muted-foreground hover:text-foreground transition-colors"
          aria-label="Volver"
        >
          <ChevronLeft className="w-5 h-5" />
        </button>
        <div className="flex-1 min-w-0">
          <h1 className="text-base font-semibold text-foreground truncate">{TITULO_MODULO}</h1>
          <p className="text-xs text-muted-foreground">{codigoFormato('F-FRUS-CAL-15', codigoClave)} · Cuarto Frío</p>
        </div>
        <Button
          variant="ghost"
          size="sm"
          className="text-[var(--primary)] shrink-0"
          onClick={() => {
            setConsolidadoRanchoId(ranchos[0]?.id ?? '')
            setConsolidadoDesde('')
            setConsolidadoHasta('')
            setSheetConsolidado(true)
          }}
        >
          <Files className="w-4 h-4 mr-1" />
          Exportar
        </Button>
      </div>

      {/* Lista */}
      <div className="flex-1 overflow-y-auto">
        <div className="p-4 pb-28 flex flex-col gap-3">
          {loading && (
            <div className="flex justify-center py-16">
              <Loader2 className="w-6 h-6 animate-spin text-[var(--primary)]" />
            </div>
          )}
          {!loading && error && (
            <p className="text-center text-sm text-[var(--agro-danger-text)] py-8">{error}</p>
          )}
          {!loading && !error && accidentes.length === 0 && (
            <div className="flex flex-col items-center gap-2 py-16 text-muted-foreground">
              <ShieldAlert className="w-10 h-10 opacity-30" />
              <p className="text-sm">No hay registros de accidentes</p>
            </div>
          )}
          {!loading && accidentes.map((acc) => (
            <AccidenteCard
              key={acc.id}
              acc={acc}
              onPDF={handlePDF}
              cargandoPDF={cargandoPDF}
              orgNombre={orgNombre}
            />
          ))}
        </div>
      </div>

      {/* FAB */}
      <div className="fixed bottom-safe-fab left-1/2 -translate-x-1/2 w-full max-w-[390px] flex justify-end px-4 pointer-events-none z-10">
        <button
          type="button"
          onClick={() => { setForm(FORM_INICIAL); setFotosLocal([]); setSheetNuevo(true) }}
          className="pointer-events-auto w-14 h-14 rounded-full bg-[var(--primary)] text-white shadow-lg flex items-center justify-center active:scale-95 transition-transform"
          aria-label="Nuevo registro"
        >
          <Plus className="w-7 h-7" />
        </button>
      </div>

      {/* Sheet: Nuevo registro ─────────────────────────────────────────────── */}
      <BottomSheet open={sheetNuevo} onClose={() => setSheetNuevo(false)} height="85%">
          {/* Handle bar */}
          <div className="flex justify-center pt-3 pb-1 shrink-0">
            <div className="w-10 h-1 rounded-full bg-muted" />
          </div>
          <div className="px-4 pb-2 shrink-0">
            <h2 className="text-base font-semibold text-foreground">Registrar accidente</h2>
            <p className="text-xs text-muted-foreground">{codigoFormato('F-FRUS-CAL-15', codigoClave)} · Cuarto Frío</p>
          </div>

          {/* Scroll content */}
          <div className="flex-1 overflow-y-auto px-4 pb-6 flex flex-col gap-5">

            {/* Instalación */}
            <div className="flex flex-col gap-1.5">
              <label className="text-xs font-semibold text-muted-foreground uppercase tracking-wide">
                {terminosSitio.singular}
              </label>
              <select
                className="w-full h-11 rounded-lg border border-border bg-[var(--input-background)] px-3 text-sm text-foreground"
                value={form.ranchoId}
                onChange={(e) => set('ranchoId', e.target.value)}
              >
                <option value="">Selecciona una {terminosSitio.singular.toLowerCase()}</option>
                {ranchos.map((r) => (
                  <option key={r.id} value={r.id}>{r.nombre}</option>
                ))}
              </select>
            </div>

            {/* Fecha */}
            <div className="flex flex-col gap-1.5">
              <label className="text-xs font-semibold text-muted-foreground uppercase tracking-wide">
                Fecha del accidente
              </label>
              <input
                type="date"
                className="w-full h-11 rounded-lg border border-border bg-[var(--input-background)] px-3 text-sm text-foreground"
                value={form.fecha}
                min={esSuperAdmin ? undefined : hoy()}
                max={hoy()}
                onChange={(e) => { if (esSuperAdmin) set('fecha', e.target.value) }}
              />
            </div>

            {/* Trabajador */}
            <div className="flex flex-col gap-1.5">
              <label className="text-xs font-semibold text-muted-foreground uppercase tracking-wide">
                Nombre del trabajador
              </label>
              <input
                type="text"
                placeholder="Nombre completo"
                className="w-full h-11 rounded-lg border border-border bg-[var(--input-background)] px-3 text-sm text-foreground"
                value={form.trabajadorNombre}
                onChange={(e) => set('trabajadorNombre', e.target.value)}
              />
            </div>

            {/* Descripción */}
            <div className="flex flex-col gap-1.5">
              <label className="text-xs font-semibold text-muted-foreground uppercase tracking-wide">
                Descripción del incidente
              </label>
              <textarea
                rows={3}
                placeholder="Describe qué ocurrió, cómo y dónde..."
                className="w-full rounded-lg border border-border bg-[var(--input-background)] px-3 py-2.5 text-sm text-foreground resize-none"
                value={form.descripcionIncidente}
                onChange={(e) => set('descripcionIncidente', e.target.value)}
              />
            </div>

            {/* Atención recibida */}
            <div className="flex flex-col gap-2">
              <label className="text-xs font-semibold text-muted-foreground uppercase tracking-wide">
                Atención recibida
              </label>
              <div className="flex flex-col gap-2">
                {ATENCIONES_UI.map((op) => {
                  const sel = form.atencionRecibida.includes(op)
                  return (
                    <button
                      key={op}
                      type="button"
                      onClick={() => toggleAtencion(op)}
                      className={`flex items-center gap-3 px-4 py-3 rounded-lg border text-sm text-left transition-colors ${
                        sel
                          ? 'border-[var(--primary)] bg-[var(--agro-success-fill)] text-[var(--agro-success-text)] font-semibold'
                          : 'border-border bg-[var(--input-background)] text-foreground'
                      }`}
                    >
                      <span
                        className={`w-4 h-4 rounded border-2 shrink-0 flex items-center justify-center text-xs font-bold ${
                          sel
                            ? 'border-[var(--primary)] bg-[var(--primary)] text-white'
                            : 'border-border'
                        }`}
                      >
                        {sel && '✓'}
                      </span>
                      {op}
                    </button>
                  )
                })}
              </div>
            </div>

            {/* Incapacidad */}
            <div className="flex flex-col gap-2 p-4 rounded-xl bg-muted/40 border border-border">
              <div className="flex items-center justify-between">
                <span className="text-sm font-semibold text-foreground">¿Requirió incapacidad?</span>
                <SiNoToggle
                  value={form.requirioIncapacidad}
                  onChange={(v) => set('requirioIncapacidad', v)}
                />
              </div>
              {form.requirioIncapacidad && (
                <input
                  type="text"
                  placeholder="Motivo / días de incapacidad"
                  className="w-full h-10 rounded-lg border border-border bg-card px-3 text-sm text-foreground mt-1"
                  value={form.incapacidadMotivo}
                  onChange={(e) => set('incapacidadMotivo', e.target.value)}
                />
              )}
            </div>

            {/* Limpieza */}
            <div className="flex flex-col gap-2 p-4 rounded-xl bg-muted/40 border border-border">
              <div className="flex items-center justify-between">
                <span className="text-sm font-semibold text-foreground">¿Requirió limpieza del área?</span>
                <SiNoToggle
                  value={form.requirioLimpieza}
                  onChange={(v) => set('requirioLimpieza', v)}
                />
              </div>
              {form.requirioLimpieza && (
                <input
                  type="text"
                  placeholder="Describe la limpieza realizada"
                  className="w-full h-10 rounded-lg border border-border bg-card px-3 text-sm text-foreground mt-1"
                  value={form.limpiezaDescripcion}
                  onChange={(e) => set('limpiezaDescripcion', e.target.value)}
                />
              )}
            </div>

            {/* Producto involucrado */}
            <div className="flex flex-col gap-2 p-4 rounded-xl bg-muted/40 border border-border">
              <div className="flex items-center justify-between">
                <span className="text-sm font-semibold text-foreground">¿Hubo producto involucrado?</span>
                <SiNoToggle
                  value={form.productoInvolucrado}
                  onChange={(v) => set('productoInvolucrado', v)}
                />
              </div>
              {form.productoInvolucrado && (
                <input
                  type="text"
                  placeholder="Disposición del producto afectado"
                  className="w-full h-10 rounded-lg border border-border bg-card px-3 text-sm text-foreground mt-1"
                  value={form.disposicionProducto}
                  onChange={(e) => set('disposicionProducto', e.target.value)}
                />
              )}
            </div>

            {/* Fotos */}
            <div className="flex flex-col gap-2">
              <label className="text-xs font-semibold text-muted-foreground uppercase tracking-wide">
                Evidencia fotográfica (opcional)
              </label>

              {fotosLocal.length > 0 && (
                <div className="flex flex-wrap gap-2">
                  {fotosLocal.map((f) => (
                    <div key={f.uid} className="relative w-20 h-20">
                      <img
                        src={f.preview}
                        alt="Evidencia"
                        className="w-full h-full object-cover rounded-lg border border-border"
                      />
                      <button
                        type="button"
                        onClick={() => eliminarFotoLocal(f.uid)}
                        className="absolute -top-1.5 -right-1.5 w-5 h-5 rounded-full bg-[var(--agro-red)] text-white flex items-center justify-center"
                        aria-label="Eliminar foto"
                      >
                        <Trash2 className="w-3 h-3" />
                      </button>
                    </div>
                  ))}
                </div>
              )}

              <button
                type="button"
                onClick={() => fotoInputRef.current?.click()}
                className="flex items-center gap-2 px-4 py-3 rounded-lg border border-dashed border-border bg-[var(--input-background)] text-sm text-muted-foreground hover:bg-muted transition-colors w-full"
              >
                <Camera className="w-4 h-4" />
                Agregar fotos
              </button>
              <input
                ref={fotoInputRef}
                type="file"
                accept="image/*"
                multiple
                className="hidden"
                onChange={handleFotoInput}
              />
            </div>

          </div>

          {/* Botón guardar */}
          <div className="px-4 pb-safe-bottom pb-6 pt-3 border-t border-border shrink-0">
            <Button
              className="w-full h-12 text-base bg-[var(--primary)] hover:bg-[var(--agro-blue)] text-white"
              onClick={handleGuardar}
              disabled={guardando}
            >
              {guardando ? (
                <><Loader2 className="w-4 h-4 mr-2 animate-spin" /> Guardando...</>
              ) : (
                'Guardar y generar PDF'
              )}
            </Button>
          </div>
      </BottomSheet>

      {/* Sheet: Exportar consolidado ─────────────────────────────────────────── */}
      <BottomSheet open={sheetConsolidado} onClose={() => setSheetConsolidado(false)}>
          <div className="flex justify-center pt-3 pb-1">
            <div className="w-10 h-1 rounded-full bg-muted" />
          </div>
          <div className="px-4 pb-2">
            <h2 className="text-base font-semibold text-foreground">Exportar consolidado</h2>
            <p className="text-xs text-muted-foreground">Todos los accidentes en el rango</p>
          </div>

          <div className="px-4 pb-6 flex flex-col gap-4">
            <div className="flex flex-col gap-1.5">
              <label className="text-xs font-semibold text-muted-foreground uppercase tracking-wide">
                {terminosSitio.singular}
              </label>
              <select
                className="w-full h-11 rounded-lg border border-border bg-[var(--input-background)] px-3 text-sm"
                value={consolidadoRanchoId}
                onChange={(e) => setConsolidadoRanchoId(e.target.value)}
              >
                <option value="">Selecciona</option>
                {ranchos.map((r) => (
                  <option key={r.id} value={r.id}>{r.nombre}</option>
                ))}
              </select>
            </div>
            <div className="flex gap-3">
              <div className="flex flex-col gap-1.5 flex-1">
                <label className="text-xs font-semibold text-muted-foreground uppercase tracking-wide">
                  Desde
                </label>
                <input
                  type="date"
                  className="w-full h-11 rounded-lg border border-border bg-[var(--input-background)] px-3 text-sm"
                  value={consolidadoDesde}
                  onChange={(e) => setConsolidadoDesde(e.target.value)}
                />
              </div>
              <div className="flex flex-col gap-1.5 flex-1">
                <label className="text-xs font-semibold text-muted-foreground uppercase tracking-wide">
                  Hasta
                </label>
                <input
                  type="date"
                  className="w-full h-11 rounded-lg border border-border bg-[var(--input-background)] px-3 text-sm"
                  value={consolidadoHasta}
                  onChange={(e) => setConsolidadoHasta(e.target.value)}
                />
              </div>
            </div>
            <Button
              className="w-full h-12 text-base bg-[var(--primary)] hover:bg-[var(--agro-blue)] text-white"
              onClick={handleConsolidado}
              disabled={cargandoConsolidado}
            >
              {cargandoConsolidado
                ? <><Loader2 className="w-4 h-4 mr-2 animate-spin" /> Generando...</>
                : <><Files className="w-4 h-4 mr-2" /> Descargar PDF</>}
            </Button>
          </div>
      </BottomSheet>

    </div>
  )
}
