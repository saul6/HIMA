// M21 — Revisión de Estaciones de Monitoreo de Plagas (Cuarto Frío)
// Formato F-FRUS-CAL-19. Por evento. Sector Cuarto Frío.
// Gestión de catálogo de estaciones por instalación + formulario de revisión.

import { useState, useEffect, useCallback } from 'react'
import {
  ChevronLeft, Plus, Loader2, Files, Bug, FileDown, Settings, Power,
  AlertTriangle, X,
} from 'lucide-react'
import { useNavigate, useSearchParams } from 'react-router'
import { BottomSheet } from '@/app/components/BottomSheet'
import { toast } from 'sonner'
import { useAuthContext } from '@/context/AuthContext'
import { puedeEditarFechaLibre } from '@/lib/permisos'
import { codigoFormato } from '@/lib/codigoFormato'
import { useModulosContext } from '@/context/ModulosContext'
import { useRanchos } from '@/hooks/useRanchos'
import {
  useM21EstacionesRancho,
  type M21Estacion,
  type TipoTrampa,
} from '@/hooks/useM21EstacionesRancho'
import { useM21MonitoreoEstaciones, type M21RevisionConResultados } from '@/hooks/useM21MonitoreoEstaciones'
import { useOrganizacion } from '@/hooks/useOrganizacion'
import { supabase } from '@/lib/supabase'
import { generarMonitoreoEstacionesPDF } from '@/lib/pdf/m21/generarMonitoreoEstacionesPDF'
import { generarMonitoreoEstacionesConsolidadoPDF } from '@/lib/pdf/m21/generarMonitoreoEstacionesConsolidadoPDF'
import { Button } from '@/app/components/ui/button'

// ── Constantes ────────────────────────────────────────────────────────────────

const TITULO_MODULO = 'Monitoreo de Plagas'

const TIPO_TRAMPA_LABELS: Record<TipoTrampa, string> = {
  cebo: 'Con Cebo',
  interior: 'Interior',
  mecanica: 'Mecánica',
  luz: 'Trampa de Luz',
}

const TIPOS_ORDEN: TipoTrampa[] = ['cebo', 'interior', 'mecanica', 'luz']

const hoy = () => new Date().toLocaleDateString('en-CA', { timeZone: 'America/Mexico_City' })

// ── Tipos internos ────────────────────────────────────────────────────────────

interface CatCodigo { codigo: string; label: string }

interface EstFormData {
  tipo_consumo: string
  estado_trampa: string
  condiciones: string
  senalizacion: string      // 'Si' | 'No' | ''
  estado_equipo: string
  estado_lampara: string
  plaga_detectada: string[] // códigos
  tieneHallazgo: boolean
  hallazgoDescripcion: string
}

const EST_FORM_INICIAL: EstFormData = {
  tipo_consumo: '',
  estado_trampa: '',
  condiciones: '',
  senalizacion: '',
  estado_equipo: '',
  estado_lampara: '',
  plaga_detectada: [],
  tieneHallazgo: false,
  hallazgoDescripcion: '',
}

interface FormRevision {
  ranchoId: string
  fecha: string
  inspectorNombre: string
  observaciones: string
}

const FORM_INICIAL: FormRevision = {
  ranchoId: '',
  fecha: hoy(),
  inspectorNombre: '',
  observaciones: '',
}

// ── Helpers ───────────────────────────────────────────────────────────────────

function formatFecha(iso: string): string {
  try {
    return new Date(iso + 'T12:00:00').toLocaleDateString('es-MX', {
      day: 'numeric', month: 'short', year: 'numeric',
    })
  } catch { return iso }
}

function labelDesde(codigo: string, cat: CatCodigo[]): string {
  return cat.find(c => c.codigo === codigo)?.label ?? codigo
}

// ── Sub-componente: card de revisión ─────────────────────────────────────────

function RevisionCard({
  rev,
  onPDF,
  cargandoPDF,
  orgNombre,
}: {
  rev: M21RevisionConResultados
  onPDF: (id: string) => void
  cargandoPDF: string | null
  orgNombre: string | null
}) {
  const conHallazgo = rev.resultados.filter(r => r.incidencia_id).length
  const totalEst = rev.resultados.length

  return (
    <div className="bg-card rounded-xl border border-border p-4 flex flex-col gap-2">
      <div className="flex items-start justify-between gap-2">
        <div className="flex flex-col gap-1 flex-1 min-w-0">
          <div className="flex items-center gap-2 flex-wrap">
            {orgNombre && (
              <span className="text-xs text-muted-foreground font-medium">{orgNombre} ·</span>
            )}
            <span className="text-xs font-semibold bg-[var(--agro-success-fill)] text-[var(--agro-success-text)] px-2 py-0.5 rounded-full truncate">
              {rev.rancho_nombre}
            </span>
            <span className="text-xs text-muted-foreground">{formatFecha(rev.fecha)}</span>
          </div>
          {rev.inspector_nombre && (
            <p className="text-sm font-semibold text-foreground leading-snug mt-0.5">
              {rev.inspector_nombre}
            </p>
          )}
          <p className="text-xs text-muted-foreground">
            {totalEst} estación{totalEst !== 1 ? 'es' : ''} revisada{totalEst !== 1 ? 's' : ''}
          </p>
        </div>
        <Button
          variant="ghost"
          size="icon"
          className="shrink-0 text-[var(--primary)] hover:bg-[var(--agro-success-fill)]"
          onClick={() => onPDF(rev.id)}
          disabled={cargandoPDF === rev.id}
          aria-label="Descargar PDF"
        >
          {cargandoPDF === rev.id
            ? <Loader2 className="w-4 h-4 animate-spin" />
            : <FileDown className="w-4 h-4" />}
        </Button>
      </div>

      {conHallazgo > 0 && (
        <div className="flex gap-2">
          <span className="text-xs bg-[var(--agro-danger-fill)] text-[var(--agro-danger-text)] px-2 py-0.5 rounded-full">
            {conHallazgo} hallazgo{conHallazgo !== 1 ? 's' : ''} reportado{conHallazgo !== 1 ? 's' : ''}
          </span>
        </div>
      )}

      {rev.observaciones && (
        <p className="text-xs text-muted-foreground italic line-clamp-2">{rev.observaciones}</p>
      )}
    </div>
  )
}

// ── Sub-componente: fila de estación en el catálogo ──────────────────────────

function EstacionCatalogoRow({
  est,
  onToggle,
  toggling,
}: {
  est: M21Estacion
  onToggle: (id: string, activo: boolean) => void
  toggling: string | null
}) {
  return (
    <div className={`flex items-center gap-3 px-3 py-2.5 rounded-lg border ${
      est.activo ? 'border-border bg-card' : 'border-border/50 bg-muted/30 opacity-60'
    }`}>
      <div className="flex-1 min-w-0">
        <span className="text-xs font-semibold text-muted-foreground uppercase">
          {TIPO_TRAMPA_LABELS[est.tipo_trampa]}
        </span>
        <p className="text-sm text-foreground font-medium">N.° {est.numero}</p>
      </div>
      <button
        type="button"
        onClick={() => onToggle(est.id, !est.activo)}
        disabled={toggling === est.id}
        className={`p-1.5 rounded-lg transition-colors ${
          est.activo
            ? 'text-[var(--primary)] hover:bg-[var(--agro-success-fill)]'
            : 'text-muted-foreground hover:bg-muted'
        }`}
        aria-label={est.activo ? 'Desactivar' : 'Activar'}
      >
        {toggling === est.id
          ? <Loader2 className="w-4 h-4 animate-spin" />
          : <Power className="w-4 h-4" />}
      </button>
    </div>
  )
}

// ── Sub-componente: fila de estación en el formulario de revisión ─────────────

function EstacionRevisionRow({
  est,
  data,
  onUpdate,
  catalogoEstado,
  catalogoCondiciones,
  catalogoPlagas,
  destacar,
}: {
  est: M21Estacion
  data: EstFormData
  onUpdate: (id: string, patch: Partial<EstFormData>) => void
  catalogoEstado: CatCodigo[]
  catalogoCondiciones: CatCodigo[]
  catalogoPlagas: CatCodigo[]
  destacar?: boolean
}) {
  const esLuz = est.tipo_trampa === 'luz'
  const tieneHallazgoAuto = esLuz && data.plaga_detectada.length > 0

  function togglePlaga(codigo: string) {
    const actual = data.plaga_detectada
    const nueva = actual.includes(codigo)
      ? actual.filter(c => c !== codigo)
      : [...actual, codigo]
    onUpdate(est.id, { plaga_detectada: nueva })
  }

  return (
    <div
      id={`est-rev-${est.id}`}
      className={`rounded-xl border bg-card overflow-hidden ${destacar ? 'border-[var(--primary)] ring-2 ring-[var(--primary)]/30' : 'border-border'}`}
    >
      {/* Header de estación */}
      <div className="flex items-center gap-2 px-3 py-2 bg-muted/40 border-b border-border">
        <span className="text-xs font-bold text-[var(--primary)]">N.° {est.numero}</span>
        <span className="text-xs text-muted-foreground">{TIPO_TRAMPA_LABELS[est.tipo_trampa]}</span>
        {data.tieneHallazgo && (
          <span className="ml-auto text-xs bg-[var(--agro-danger-fill)] text-[var(--agro-danger-text)] px-2 py-0.5 rounded-full">
            Hallazgo
          </span>
        )}
      </div>

      <div className="p-3 flex flex-col gap-3">
        {!esLuz ? (
          <>
            {/* Tipo de consumo */}
            <div className="flex flex-col gap-1">
              <label className="text-xs font-semibold text-muted-foreground">Tipo de consumo</label>
              <input
                type="text"
                placeholder="Ej. Parcial, Total, Sin consumo"
                className="w-full h-9 rounded-lg border border-border bg-[var(--input-background)] px-3 text-sm text-foreground"
                value={data.tipo_consumo}
                onChange={e => onUpdate(est.id, { tipo_consumo: e.target.value })}
              />
            </div>
            {/* Estado de la trampa */}
            <div className="flex flex-col gap-1">
              <label className="text-xs font-semibold text-muted-foreground">Estado de la trampa</label>
              <select
                className="w-full h-9 rounded-lg border border-border bg-[var(--input-background)] px-3 text-sm text-foreground"
                value={data.estado_trampa}
                onChange={e => {
                  const val = e.target.value
                  onUpdate(est.id, { estado_trampa: val })
                }}
              >
                <option value="">Selecciona estado</option>
                {catalogoEstado.map(c => (
                  <option key={c.codigo} value={c.codigo}>{c.codigo} — {c.label}</option>
                ))}
              </select>
            </div>
            {/* Condiciones */}
            <div className="flex flex-col gap-1">
              <label className="text-xs font-semibold text-muted-foreground">Condiciones</label>
              <select
                className="w-full h-9 rounded-lg border border-border bg-[var(--input-background)] px-3 text-sm text-foreground"
                value={data.condiciones}
                onChange={e => onUpdate(est.id, { condiciones: e.target.value })}
              >
                <option value="">Selecciona condición</option>
                {catalogoCondiciones.map(c => (
                  <option key={c.codigo} value={c.codigo}>{c.codigo} — {c.label}</option>
                ))}
              </select>
            </div>
            {/* Señalización */}
            <div className="flex items-center justify-between">
              <label className="text-xs font-semibold text-muted-foreground">Señalización</label>
              <div className="flex rounded-lg overflow-hidden border border-border">
                {(['Si', 'No'] as const).map(op => (
                  <button
                    key={op}
                    type="button"
                    onClick={() => onUpdate(est.id, { senalizacion: data.senalizacion === op ? '' : op })}
                    className={`px-4 py-1.5 text-sm font-semibold transition-colors ${
                      data.senalizacion === op
                        ? op === 'Si'
                          ? 'bg-[var(--primary)] text-white'
                          : 'bg-[var(--agro-red)] text-white'
                        : 'bg-card text-muted-foreground hover:bg-muted'
                    } ${op === 'No' ? 'border-l border-border' : ''}`}
                  >
                    {op}
                  </button>
                ))}
              </div>
            </div>
            {/* Hallazgo toggle */}
            <button
              type="button"
              onClick={() => onUpdate(est.id, { tieneHallazgo: !data.tieneHallazgo })}
              className={`flex items-center gap-2 px-3 py-2 rounded-lg border text-xs transition-colors ${
                data.tieneHallazgo
                  ? 'border-[var(--agro-red)] bg-[var(--agro-danger-fill)] text-[var(--agro-danger-text)]'
                  : 'border-border bg-[var(--input-background)] text-muted-foreground'
              }`}
            >
              <AlertTriangle className="w-3.5 h-3.5" />
              {data.tieneHallazgo ? 'Hallazgo activo — reportar a M13' : 'Marcar como hallazgo'}
            </button>
          </>
        ) : (
          <>
            {/* Estado del equipo */}
            <div className="flex flex-col gap-1">
              <label className="text-xs font-semibold text-muted-foreground">Estado del equipo</label>
              <input
                type="text"
                placeholder="Ej. Funcional, Dañado"
                className="w-full h-9 rounded-lg border border-border bg-[var(--input-background)] px-3 text-sm text-foreground"
                value={data.estado_equipo}
                onChange={e => onUpdate(est.id, { estado_equipo: e.target.value })}
              />
            </div>
            {/* Estado de la lámpara */}
            <div className="flex flex-col gap-1">
              <label className="text-xs font-semibold text-muted-foreground">Estado de la lámpara</label>
              <input
                type="text"
                placeholder="Ej. Encendida, Fundida"
                className="w-full h-9 rounded-lg border border-border bg-[var(--input-background)] px-3 text-sm text-foreground"
                value={data.estado_lampara}
                onChange={e => onUpdate(est.id, { estado_lampara: e.target.value })}
              />
            </div>
            {/* Plaga detectada */}
            <div className="flex flex-col gap-1.5">
              <label className="text-xs font-semibold text-muted-foreground">Plaga detectada</label>
              <div className="flex flex-wrap gap-2">
                {catalogoPlagas.map(c => {
                  const sel = data.plaga_detectada.includes(c.codigo)
                  return (
                    <button
                      key={c.codigo}
                      type="button"
                      onClick={() => togglePlaga(c.codigo)}
                      className={`px-3 py-1 text-xs rounded-full border transition-colors ${
                        sel
                          ? 'border-[var(--agro-red)] bg-[var(--agro-danger-fill)] text-[var(--agro-danger-text)] font-semibold'
                          : 'border-border bg-[var(--input-background)] text-foreground'
                      }`}
                    >
                      {c.codigo} {sel && <X className="w-2.5 h-2.5 inline ml-0.5" />}
                    </button>
                  )
                })}
              </div>
              {data.plaga_detectada.length > 0 && (
                <p className="text-xs text-muted-foreground">
                  {data.plaga_detectada.map(c => labelDesde(c, catalogoPlagas)).join(', ')}
                </p>
              )}
            </div>
          </>
        )}

        {/* Descripción de hallazgo */}
        {(data.tieneHallazgo || tieneHallazgoAuto) && (
          <div className="flex flex-col gap-1">
            <label className="text-xs font-semibold text-[var(--agro-danger-text)]">
              Descripción del hallazgo (para Reporte M13)
            </label>
            <textarea
              rows={2}
              placeholder="Describe el hallazgo para vincularlo a M13..."
              className="w-full rounded-lg border border-[var(--agro-red)]/30 bg-[var(--agro-danger-fill)] px-3 py-2 text-sm text-foreground resize-none"
              value={data.hallazgoDescripcion}
              onChange={e => onUpdate(est.id, {
                hallazgoDescripcion: e.target.value,
                tieneHallazgo: true,
              })}
            />
          </div>
        )}
      </div>
    </div>
  )
}

// ── Pantalla principal ────────────────────────────────────────────────────────

export function MonitoreoEstacionesPlagas() {
  const navigate = useNavigate()
  const [searchParams, setSearchParams] = useSearchParams()
  const { profile, user, codigoClave } = useAuthContext()
  const esSuperAdmin = profile?.rol === 'super_admin'
  const puedeEditarFecha = esSuperAdmin || puedeEditarFechaLibre(user?.email)
  const { terminosSitio } = useModulosContext()
  const { ranchos } = useRanchos()
  const { revisiones, loading, error, refetch } = useM21MonitoreoEstaciones()
  const orgNombre = useOrganizacion(profile?.org_id)

  // ── Catálogos ───────────────────────────────────────────────────────────────
  const [catalogoEstado, setCatalogoEstado] = useState<CatCodigo[]>([])
  const [catalogoCondiciones, setCatalogoCondiciones] = useState<CatCodigo[]>([])
  const [catalogoPlagas, setCatalogoPlagas] = useState<CatCodigo[]>([])

  useEffect(() => {
    if (!profile?.org_id) return
    ;(async () => {
      const [e, c, p] = await Promise.all([
        (supabase as any).from('m21_estado_trampa').select('codigo, label').order('codigo'),
        (supabase as any).from('m21_condiciones').select('codigo, label').order('codigo'),
        (supabase as any).from('m21_plagas').select('codigo, label').order('codigo'),
      ])
      if (!e.error) setCatalogoEstado(e.data ?? [])
      if (!c.error) setCatalogoCondiciones(c.data ?? [])
      if (!p.error) setCatalogoPlagas(p.data ?? [])
    })()
  }, [profile?.org_id])

  // ── Sheet: Gestionar Estaciones ─────────────────────────────────────────────
  const [sheetEstaciones, setSheetEstaciones] = useState(false)
  const [estRanchoId, setEstRanchoId] = useState('')
  const { estaciones, refetch: refetchEstaciones, loading: loadingEst } = useM21EstacionesRancho(estRanchoId || null)
  const [toggling, setToggling] = useState<string | null>(null)

  // Agregar estación
  const [addTipo, setAddTipo] = useState<TipoTrampa>('cebo')
  const [addNumero, setAddNumero] = useState('')
  const [addingEst, setAddingEst] = useState(false)

  async function handleToggleActivo(id: string, nuevoActivo: boolean) {
    if (!profile?.org_id) return
    setToggling(id)
    try {
      const { error: err } = await (supabase as any)
        .from('m21_estaciones')
        .update({ activo: nuevoActivo })
        .eq('id', id)
        .eq('org_id', profile.org_id)
      if (err) throw err
      await refetchEstaciones()
    } catch {
      toast.error('No se pudo actualizar la estación')
    } finally {
      setToggling(null)
    }
  }

  async function handleAgregarEstacion() {
    if (!estRanchoId) { toast.error(`Selecciona una ${terminosSitio.singular}`); return }
    if (!addNumero.trim()) { toast.error('Ingresa el número de la estación'); return }
    if (!profile?.org_id) return
    setAddingEst(true)
    try {
      const orden = estaciones.filter(e => e.tipo_trampa === addTipo).length
      const { error: err } = await (supabase as any)
        .from('m21_estaciones')
        .insert({
          org_id: profile.org_id,
          rancho_id: estRanchoId,
          tipo_trampa: addTipo,
          numero: addNumero.trim(),
          activo: true,
          orden,
        })
      if (err) {
        if (err.message?.includes('unique') || err.code === '23505') {
          toast.error('Ya existe una estación con ese tipo y número')
        } else {
          throw err
        }
        return
      }
      setAddNumero('')
      await refetchEstaciones()
      toast.success('Estación agregada')
    } catch (e: unknown) {
      toast.error(e instanceof Error ? e.message : 'Error al agregar estación')
    } finally {
      setAddingEst(false)
    }
  }

  // ── Sheet: Nueva Revisión ───────────────────────────────────────────────────
  const [sheetNuevo, setSheetNuevo] = useState(false)
  const [form, setForm] = useState<FormRevision>({
    ...FORM_INICIAL,
    inspectorNombre: profile?.nombre_completo ?? '',
  })
  const [guardando, setGuardando] = useState(false)

  // Estaciones activas para el rancho seleccionado en el formulario de revisión
  const { estaciones: estacionesFormRancho, loading: loadingEstForm } = useM21EstacionesRancho(
    sheetNuevo ? (form.ranchoId || null) : null
  )
  const estacionesActivas = estacionesFormRancho.filter(e => e.activo)

  // Estado de cada estación en el formulario
  const [estForm, setEstForm] = useState<Record<string, EstFormData>>({})

  // ── NFC: preselección de estación ──────────────────────────────────────────
  const [nfcEstacionId, setNfcEstacionId] = useState<string | null>(null)

  // Efecto de entrada por NFC — se ejecuta una sola vez al montar si vienen params
  useEffect(() => {
    const estId = searchParams.get('estacion')
    const rId = searchParams.get('rancho')
    if (!estId || !rId) return
    setForm(prev => ({ ...prev, ranchoId: rId }))
    setEstForm({})
    setNfcEstacionId(estId)
    setSheetNuevo(true)
    setSearchParams({}, { replace: true })
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  // Scroll a la estación destacada una vez que el formulario termina de cargar
  useEffect(() => {
    if (!sheetNuevo || loadingEstForm || !nfcEstacionId) return
    const t = setTimeout(() => {
      document.getElementById(`est-rev-${nfcEstacionId}`)?.scrollIntoView({
        behavior: 'smooth',
        block: 'center',
      })
    }, 350)
    return () => clearTimeout(t)
  }, [sheetNuevo, loadingEstForm, nfcEstacionId])

  // Reiniciar estados de estaciones cuando cambia el rancho o se abre el sheet
  useEffect(() => {
    if (!sheetNuevo) return
    const nuevo: Record<string, EstFormData> = {}
    for (const e of estacionesActivas) {
      nuevo[e.id] = estForm[e.id] ?? { ...EST_FORM_INICIAL }
    }
    setEstForm(nuevo)
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [estacionesActivas.map(e => e.id).join('|'), sheetNuevo])

  function setFormField<K extends keyof FormRevision>(k: K, v: FormRevision[K]) {
    setForm(f => ({ ...f, [k]: v }))
  }

  function updateEstacion(id: string, patch: Partial<EstFormData>) {
    setEstForm(prev => ({ ...prev, [id]: { ...(prev[id] ?? EST_FORM_INICIAL), ...patch } }))
  }

  // Agrupar estaciones activas por tipo para renderizar
  const gruposForm = TIPOS_ORDEN
    .map(tipo => ({
      tipo,
      label: TIPO_TRAMPA_LABELS[tipo],
      estaciones: estacionesActivas.filter(e => e.tipo_trampa === tipo),
    }))
    .filter(g => g.estaciones.length > 0)

  async function handleGuardar() {
    if (!form.ranchoId) { toast.error(`Selecciona una ${terminosSitio.singular}`); return }
    if (!form.fecha) { toast.error('Selecciona la fecha'); return }
    if (!form.inspectorNombre.trim()) { toast.error('Ingresa el nombre del inspector'); return }
    if (estacionesActivas.length === 0) {
      toast.error('No hay estaciones activas para esta instalación. Configúralas primero.')
      return
    }
    if (!profile?.org_id) return

    setGuardando(true)
    let revisionId: string | null = null

    try {
      // 1. INSERT m21_revision
      const { data: rev, error: revErr } = await (supabase as any)
        .from('m21_revision')
        .insert({
          org_id: profile.org_id,
          rancho_id: form.ranchoId,
          fecha: form.fecha,
          inspector_nombre: form.inspectorNombre.trim(),
          observaciones: form.observaciones.trim() || null,
        })
        .select('id')
        .single()
      if (revErr) throw revErr
      revisionId = (rev as any).id as string

      // 2. Hallazgos → crear m13_reportes + m13_incidencias
      const hallazgos = estacionesActivas.filter(e => {
        const d = estForm[e.id]
        if (!d) return false
        const esLuz = e.tipo_trampa === 'luz'
        return (d.tieneHallazgo || (esLuz && d.plaga_detectada.length > 0)) && d.hallazgoDescripcion.trim()
      })

      const incidenciaMap: Record<string, string> = {} // estacion_id → incidencia_id

      if (hallazgos.length > 0) {
        const { data: reporte, error: rErr } = await (supabase as any)
          .from('m13_reportes')
          .insert({
            org_id: profile.org_id,
            rancho_id: form.ranchoId,
            fecha: form.fecha,
            auditor_nombre: form.inspectorNombre.trim(),
          })
          .select('id')
          .single()
        if (rErr) throw rErr
        const reporteId = (reporte as any).id as string

        for (let i = 0; i < hallazgos.length; i++) {
          const est = hallazgos[i]
          const d = estForm[est.id]
          const { data: inc, error: iErr } = await (supabase as any)
            .from('m13_incidencias')
            .insert({
              org_id: profile.org_id,
              reporte_id: reporteId,
              orden: i + 1,
              descripcion: d.hallazgoDescripcion.trim(),
            })
            .select('id')
            .single()
          if (iErr) throw iErr
          incidenciaMap[est.id] = (inc as any).id as string
        }
      }

      // 3. INSERT m21_resultado por cada estación activa
      const resultados = estacionesActivas.map(e => {
        const d = estForm[e.id] ?? EST_FORM_INICIAL
        const esLuz = e.tipo_trampa === 'luz'
        return {
          revision_id: revisionId,
          estacion_id: e.id,
          org_id: profile.org_id,
          tipo_consumo: !esLuz && d.tipo_consumo.trim() ? d.tipo_consumo.trim() : null,
          estado_trampa: !esLuz && d.estado_trampa ? d.estado_trampa : null,
          condiciones: !esLuz && d.condiciones ? d.condiciones : null,
          senalizacion: !esLuz && d.senalizacion ? d.senalizacion : null,
          estado_equipo: esLuz && d.estado_equipo.trim() ? d.estado_equipo.trim() : null,
          estado_lampara: esLuz && d.estado_lampara.trim() ? d.estado_lampara.trim() : null,
          plaga_detectada: esLuz ? d.plaga_detectada : [],
          incidencia_id: incidenciaMap[e.id] ?? null,
        }
      })

      const { error: resErr } = await (supabase as any)
        .from('m21_resultado')
        .insert(resultados)
      if (resErr) throw resErr

      // 4. Refetch + cierre
      await refetch()
      toast.success('Revisión registrada')
      setSheetNuevo(false)
      setNfcEstacionId(null)
      setForm({ ...FORM_INICIAL, inspectorNombre: profile.nombre_completo ?? '' })
      setEstForm({})

      // 5. Generar PDF automáticamente
      try {
        await generarMonitoreoEstacionesPDF(revisionId, profile.org_id)
      } catch {
        toast.warning('Registro guardado. No se pudo generar el PDF automáticamente.')
      }
    } catch (e: unknown) {
      // Rollback revisión si existe
      if (revisionId) {
        ;(supabase as any).from('m21_revision').delete().eq('id', revisionId).then(() => {})
      }
      const msg = e instanceof Error ? e.message : 'Error al guardar la revisión'
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
  const [cargandoPDF, setCargandoPDF] = useState<string | null>(null)

  async function handlePDF(id: string) {
    if (!profile?.org_id) return
    setCargandoPDF(id)
    try {
      await generarMonitoreoEstacionesPDF(id, profile.org_id)
    } catch {
      toast.error('No se pudo generar el PDF')
    } finally {
      setCargandoPDF(null)
    }
  }

  // ── Sheet: Exportar consolidado ─────────────────────────────────────────────
  const [sheetConsolidado, setSheetConsolidado] = useState(false)
  const [consRanchoId, setConsRanchoId] = useState('')
  const [consDesde, setConsDesde] = useState('')
  const [consHasta, setConsHasta] = useState('')
  const [cargandoCons, setCargandoCons] = useState(false)

  async function handleConsolidado() {
    if (!consRanchoId) { toast.error(`Selecciona una ${terminosSitio.singular}`); return }
    if (!consDesde || !consHasta) { toast.error('Selecciona el rango de fechas'); return }
    if (!profile?.org_id) return
    const rancho = ranchos.find(r => r.id === consRanchoId)
    setCargandoCons(true)
    try {
      await generarMonitoreoEstacionesConsolidadoPDF(
        consRanchoId,
        rancho?.nombre ?? '—',
        profile.org_id,
        consDesde,
        consHasta,
      )
      setSheetConsolidado(false)
    } catch (e: unknown) {
      toast.error(e instanceof Error ? e.message : 'Error al generar el PDF')
    } finally {
      setCargandoCons(false)
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
          <p className="text-xs text-muted-foreground">{codigoFormato('F-FRUS-CAL-19', codigoClave)} · Cuarto Frío</p>
        </div>
        <Button
          variant="ghost"
          size="icon"
          className="shrink-0 text-muted-foreground"
          onClick={() => {
            setEstRanchoId(ranchos[0]?.id ?? '')
            setSheetEstaciones(true)
          }}
          aria-label="Gestionar estaciones"
        >
          <Settings className="w-4 h-4" />
        </Button>
        <Button
          variant="ghost"
          size="sm"
          className="text-[var(--primary)] shrink-0"
          onClick={() => {
            setConsRanchoId(ranchos[0]?.id ?? '')
            setConsDesde('')
            setConsHasta('')
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
          {!loading && !error && revisiones.length === 0 && (
            <div className="flex flex-col items-center gap-2 py-16 text-muted-foreground">
              <Bug className="w-10 h-10 opacity-30" />
              <p className="text-sm">Sin revisiones registradas</p>
              <p className="text-xs">Primero configura las estaciones con el ícono de ajustes</p>
            </div>
          )}
          {!loading && revisiones.map(rev => (
            <RevisionCard
              key={rev.id}
              rev={rev}
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
          onClick={() => {
            setForm({ ...FORM_INICIAL, inspectorNombre: profile?.nombre_completo ?? '' })
            setEstForm({})
            setSheetNuevo(true)
          }}
          className="pointer-events-auto w-14 h-14 rounded-full bg-[var(--primary)] text-white shadow-lg flex items-center justify-center active:scale-95 transition-transform"
          aria-label="Nueva revisión"
        >
          <Plus className="w-7 h-7" />
        </button>
      </div>

      {/* ── Sheet: Gestionar Estaciones ──────────────────────────────────────── */}
      <BottomSheet open={sheetEstaciones} onClose={() => setSheetEstaciones(false)} height="85%">
          <div className="flex justify-center pt-3 pb-1 shrink-0">
            <div className="w-10 h-1 rounded-full bg-muted" />
          </div>
          <div className="px-4 pb-2 shrink-0">
            <h2 className="text-base font-semibold text-foreground">Gestionar Estaciones</h2>
            <p className="text-xs text-muted-foreground">Catálogo de trampas por {terminosSitio.singular.toLowerCase()}</p>
          </div>

          <div className="flex-1 overflow-y-auto px-4 pb-6 flex flex-col gap-4">
            {/* Selector de instalación */}
            <div className="flex flex-col gap-1.5">
              <label className="text-xs font-semibold text-muted-foreground uppercase tracking-wide">
                {terminosSitio.singular}
              </label>
              <select
                className="w-full h-11 rounded-lg border border-border bg-[var(--input-background)] px-3 text-sm text-foreground"
                value={estRanchoId}
                onChange={e => setEstRanchoId(e.target.value)}
              >
                <option value="">Selecciona</option>
                {ranchos.map(r => (
                  <option key={r.id} value={r.id}>{r.nombre}</option>
                ))}
              </select>
            </div>

            {/* Lista de estaciones */}
            {estRanchoId && (
              <>
                {loadingEst && (
                  <div className="flex justify-center py-6">
                    <Loader2 className="w-5 h-5 animate-spin text-[var(--primary)]" />
                  </div>
                )}
                {!loadingEst && estaciones.length === 0 && (
                  <p className="text-sm text-muted-foreground text-center py-4">
                    Sin estaciones. Agrega la primera abajo.
                  </p>
                )}
                {!loadingEst && TIPOS_ORDEN.filter(t => estaciones.some(e => e.tipo_trampa === t)).map(tipo => (
                  <div key={tipo} className="flex flex-col gap-2">
                    <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wide">
                      {TIPO_TRAMPA_LABELS[tipo]}
                    </p>
                    {estaciones.filter(e => e.tipo_trampa === tipo).map(est => (
                      <EstacionCatalogoRow
                        key={est.id}
                        est={est}
                        onToggle={handleToggleActivo}
                        toggling={toggling}
                      />
                    ))}
                  </div>
                ))}

                {/* Formulario de agregar */}
                <div className="rounded-xl border border-border p-4 flex flex-col gap-3 bg-muted/20">
                  <p className="text-xs font-semibold text-foreground">Agregar estación</p>
                  <div className="flex flex-col gap-1.5">
                    <label className="text-xs text-muted-foreground">Tipo de trampa</label>
                    <select
                      className="w-full h-10 rounded-lg border border-border bg-[var(--input-background)] px-3 text-sm text-foreground"
                      value={addTipo}
                      onChange={e => setAddTipo(e.target.value as TipoTrampa)}
                    >
                      {TIPOS_ORDEN.map(t => (
                        <option key={t} value={t}>{TIPO_TRAMPA_LABELS[t]}</option>
                      ))}
                    </select>
                  </div>
                  <div className="flex gap-2">
                    <input
                      type="text"
                      placeholder="N.° (ej. 1, 100, 200, 1F)"
                      className="flex-1 h-10 rounded-lg border border-border bg-[var(--input-background)] px-3 text-sm text-foreground"
                      value={addNumero}
                      onChange={e => setAddNumero(e.target.value)}
                    />
                    <Button
                      variant="outline"
                      size="sm"
                      className="h-10 px-4 border-[var(--primary)] text-[var(--primary)]"
                      onClick={handleAgregarEstacion}
                      disabled={addingEst}
                    >
                      {addingEst ? <Loader2 className="w-4 h-4 animate-spin" /> : <Plus className="w-4 h-4" />}
                    </Button>
                  </div>
                </div>
              </>
            )}
          </div>
      </BottomSheet>

      {/* ── Sheet: Nueva Revisión ─────────────────────────────────────────────── */}
      <BottomSheet open={sheetNuevo} onClose={() => { setSheetNuevo(false); setNfcEstacionId(null) }} height="90%">
          <div className="flex justify-center pt-3 pb-1 shrink-0">
            <div className="w-10 h-1 rounded-full bg-muted" />
          </div>
          <div className="px-4 pb-2 shrink-0">
            <h2 className="text-base font-semibold text-foreground">Nueva revisión</h2>
            <p className="text-xs text-muted-foreground">{codigoFormato('F-FRUS-CAL-19', codigoClave)} · Cuarto Frío</p>
          </div>

          <div className="flex-1 overflow-y-auto px-4 pb-6 flex flex-col gap-5">

            {/* Instalación */}
            <div className="flex flex-col gap-1.5">
              <label className="text-xs font-semibold text-muted-foreground uppercase tracking-wide">
                {terminosSitio.singular}
              </label>
              <select
                className="w-full h-11 rounded-lg border border-border bg-[var(--input-background)] px-3 text-sm text-foreground"
                value={form.ranchoId}
                onChange={e => setFormField('ranchoId', e.target.value)}
              >
                <option value="">Selecciona una {terminosSitio.singular.toLowerCase()}</option>
                {ranchos.map(r => (
                  <option key={r.id} value={r.id}>{r.nombre}</option>
                ))}
              </select>
            </div>

            {/* Fecha */}
            <div className="flex flex-col gap-1.5">
              <label className="text-xs font-semibold text-muted-foreground uppercase tracking-wide">
                Fecha de revisión
              </label>
              <input
                type="date"
                className="w-full h-11 rounded-lg border border-border bg-[var(--input-background)] px-3 text-sm text-foreground"
                value={form.fecha}
                min={puedeEditarFecha ? undefined : hoy()}
                max={hoy()}
                onChange={e => { if (puedeEditarFecha) setFormField('fecha', e.target.value) }}
              />
            </div>

            {/* Inspector */}
            <div className="flex flex-col gap-1.5">
              <label className="text-xs font-semibold text-muted-foreground uppercase tracking-wide">
                Inspector
              </label>
              <input
                type="text"
                placeholder="Nombre del inspector"
                className="w-full h-11 rounded-lg border border-border bg-[var(--input-background)] px-3 text-sm text-foreground"
                value={form.inspectorNombre}
                onChange={e => setFormField('inspectorNombre', e.target.value)}
              />
            </div>

            {/* Estaciones por tipo */}
            {form.ranchoId && (
              <>
                {loadingEstForm && (
                  <div className="flex justify-center py-6">
                    <Loader2 className="w-5 h-5 animate-spin text-[var(--primary)]" />
                  </div>
                )}
                {!loadingEstForm && estacionesActivas.length === 0 && (
                  <div className="rounded-xl border border-[var(--agro-warning-fill)] bg-[var(--agro-warning-fill)] p-4">
                    <p className="text-sm text-[var(--agro-warning-text)] font-semibold">Sin estaciones configuradas</p>
                    <p className="text-xs text-[var(--agro-warning-text)] mt-1">
                      Cierra este formulario y usa el ícono de ajustes para agregar estaciones a esta instalación.
                    </p>
                  </div>
                )}
                {!loadingEstForm && gruposForm.map(grupo => (
                  <div key={grupo.tipo} className="flex flex-col gap-3">
                    <div className="flex items-center gap-2">
                      <div className="h-px flex-1 bg-border" />
                      <span className="text-xs font-semibold text-muted-foreground uppercase tracking-wider px-2">
                        {grupo.label}
                      </span>
                      <div className="h-px flex-1 bg-border" />
                    </div>
                    {grupo.estaciones.map(est => (
                      <EstacionRevisionRow
                        key={est.id}
                        est={est}
                        data={estForm[est.id] ?? EST_FORM_INICIAL}
                        onUpdate={updateEstacion}
                        catalogoEstado={catalogoEstado}
                        catalogoCondiciones={catalogoCondiciones}
                        catalogoPlagas={catalogoPlagas}
                        destacar={est.id === nfcEstacionId}
                      />
                    ))}
                  </div>
                ))}
              </>
            )}

            {/* Observaciones */}
            <div className="flex flex-col gap-1.5">
              <label className="text-xs font-semibold text-muted-foreground uppercase tracking-wide">
                Observaciones generales
              </label>
              <textarea
                rows={3}
                placeholder="Observaciones de la revisión (opcional)..."
                className="w-full rounded-lg border border-border bg-[var(--input-background)] px-3 py-2.5 text-sm text-foreground resize-none"
                value={form.observaciones}
                onChange={e => setFormField('observaciones', e.target.value)}
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

      {/* ── Sheet: Exportar consolidado ───────────────────────────────────────── */}
      <BottomSheet open={sheetConsolidado} onClose={() => setSheetConsolidado(false)}>
          <div className="flex justify-center pt-3 pb-1">
            <div className="w-10 h-1 rounded-full bg-muted" />
          </div>
          <div className="px-4 pb-2">
            <h2 className="text-base font-semibold text-foreground">Exportar consolidado</h2>
            <p className="text-xs text-muted-foreground">Todas las revisiones en el rango</p>
          </div>
          <div className="px-4 pb-6 flex flex-col gap-4">
            <div className="flex flex-col gap-1.5">
              <label className="text-xs font-semibold text-muted-foreground uppercase tracking-wide">
                {terminosSitio.singular}
              </label>
              <select
                className="w-full h-11 rounded-lg border border-border bg-[var(--input-background)] px-3 text-sm"
                value={consRanchoId}
                onChange={e => setConsRanchoId(e.target.value)}
              >
                <option value="">Selecciona</option>
                {ranchos.map(r => (
                  <option key={r.id} value={r.id}>{r.nombre}</option>
                ))}
              </select>
            </div>
            <div className="flex gap-3">
              <div className="flex flex-col gap-1.5 flex-1">
                <label className="text-xs font-semibold text-muted-foreground uppercase tracking-wide">Desde</label>
                <input
                  type="date"
                  className="w-full h-11 rounded-lg border border-border bg-[var(--input-background)] px-3 text-sm"
                  value={consDesde}
                  onChange={e => setConsDesde(e.target.value)}
                />
              </div>
              <div className="flex flex-col gap-1.5 flex-1">
                <label className="text-xs font-semibold text-muted-foreground uppercase tracking-wide">Hasta</label>
                <input
                  type="date"
                  className="w-full h-11 rounded-lg border border-border bg-[var(--input-background)] px-3 text-sm"
                  value={consHasta}
                  onChange={e => setConsHasta(e.target.value)}
                />
              </div>
            </div>
            <Button
              className="w-full h-12 text-base bg-[var(--primary)] hover:bg-[var(--agro-blue)] text-white"
              onClick={handleConsolidado}
              disabled={cargandoCons}
            >
              {cargandoCons
                ? <><Loader2 className="w-4 h-4 mr-2 animate-spin" /> Generando...</>
                : <><Files className="w-4 h-4 mr-2" /> Descargar PDF</>}
            </Button>
          </div>
      </BottomSheet>

    </div>
  )
}
