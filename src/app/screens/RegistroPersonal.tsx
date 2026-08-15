import { useState, useMemo } from 'react'
import {
  ChevronLeft, Plus, FileDown, X, Loader2, Users,
  Settings, TriangleAlert, Search, Pencil, ChevronDown, ChevronUp,
} from 'lucide-react'
import { Link } from 'react-router'
import { BottomSheet } from '@/app/components/BottomSheet'
import { toast } from 'sonner'
import { useAuthContext } from '@/context/AuthContext'
import { puedeEditarFechaLibre } from '@/lib/permisos'
import { codigoFormato } from '@/lib/codigoFormato'
import { hoyMX } from '@/lib/fecha'
import { useModulosContext } from '@/context/ModulosContext'
import { useRanchos } from '@/hooks/useRanchos'
import { supabase } from '@/lib/supabase'
import { useM47Trabajadores, useM47Items } from '@/hooks/useM47RegistroPersonal'
import { generarRegistroPersonalPDF } from '@/lib/pdf/m47/generarRegistroPersonalPDF'

const tbl = (name: string) => (supabase as any).from(name)

function formatFecha(iso: string): string {
  try {
    return new Date(iso + 'T12:00:00').toLocaleDateString('es-MX', { day: 'numeric', month: 'short', year: 'numeric' })
  } catch { return iso }
}

// ── Plantilla estándar ────────────────────────────────────────────────────────

const PLANTILLA: { tipo: 'documento' | 'capacitacion'; nombre: string; orden: number }[] = [
  { tipo: 'documento',     nombre: 'Solicitud de empleo',     orden: 1 },
  { tipo: 'documento',     nombre: 'Currículum',              orden: 2 },
  { tipo: 'documento',     nombre: 'Acta de nacimiento',      orden: 3 },
  { tipo: 'documento',     nombre: 'Comprobante de domicilio',orden: 4 },
  { tipo: 'documento',     nombre: 'Copia IFE',               orden: 5 },
  { tipo: 'documento',     nombre: 'Carta de no antecedentes',orden: 6 },
  { tipo: 'documento',     nombre: 'Carta de recomendación',  orden: 7 },
  { tipo: 'documento',     nombre: 'CURP',                    orden: 8 },
  { tipo: 'capacitacion',  nombre: 'BPM',                     orden: 1 },
  { tipo: 'capacitacion',  nombre: 'Productos químicos',      orden: 2 },
  { tipo: 'capacitacion',  nombre: 'Uso de extintores',       orden: 3 },
  { tipo: 'capacitacion',  nombre: 'Plagas',                  orden: 4 },
]

// ── Form types ────────────────────────────────────────────────────────────────

interface FormTrabajador {
  rancho_id: string
  fecha: string
  puesto: string
  nombre: string
  direccion: string
  telefono_casa: string
  celular: string
  fecha_nacimiento: string
  emergencia_nombre: string
  emergencia_parentesco: string
  emergencia_telefono: string
  observaciones: string
}

const FORM_VACIO: FormTrabajador = {
  rancho_id: '', fecha: hoyMX(), puesto: '', nombre: '',
  direccion: '', telefono_casa: '', celular: '', fecha_nacimiento: '',
  emergencia_nombre: '', emergencia_parentesco: '', emergencia_telefono: '',
  observaciones: '',
}

// ── Subcomponents ─────────────────────────────────────────────────────────────

function ToggleSiNo({ value, onChange }: { value: boolean; onChange: (v: boolean) => void }) {
  return (
    <div className="flex gap-1 shrink-0">
      {([true, false] as const).map(v => (
        <button
          key={String(v)}
          type="button"
          onClick={() => onChange(v)}
          style={{
            width: 36, height: 28, borderRadius: 7, cursor: 'pointer',
            border: value === v ? 'none' : '1px solid var(--border)',
            backgroundColor: value === v
              ? v ? 'var(--agro-success-fill)' : 'var(--agro-danger-fill)'
              : 'var(--card)',
            color: value === v
              ? v ? 'var(--agro-success-text)' : 'var(--agro-danger-text)'
              : 'var(--muted-foreground)',
            fontSize: 11, fontWeight: value === v ? 700 : 400,
          }}
        >
          {v ? 'Sí' : 'No'}
        </button>
      ))}
    </div>
  )
}

// ── Screen ────────────────────────────────────────────────────────────────────

export function RegistroPersonal() {
  const { profile, user, codigoClave } = useAuthContext()
  const esSuperAdmin = profile?.rol === 'super_admin'
  const puedeEditarFecha = esSuperAdmin || puedeEditarFechaLibre(user?.email)
  const { terminosSitio } = useModulosContext()
  const orgId = profile?.org_id ?? null
  const { ranchos } = useRanchos()
  const { trabajadores, loading, error, refetch } = useM47Trabajadores()

  // ── Filtros lista ──
  const [filtroRanchoId, setFiltroRanchoId] = useState('')
  const [busqueda, setBusqueda] = useState('')

  // ── Sheet formulario ──
  const [sheetOpen, setSheetOpen] = useState(false)
  const [editingId, setEditingId] = useState<string | null>(null)
  const [form, setForm] = useState<FormTrabajador>(FORM_VACIO)
  const [checklistValues, setChecklistValues] = useState<Record<string, boolean>>({})
  const [guardando, setGuardando] = useState(false)

  // ── Sheet configurar ──
  const [configurarOpen, setConfigurarOpen] = useState(false)
  const [confRanchoId, setConfRanchoId] = useState('')
  const [sembrando, setSembrando] = useState(false)
  const [nuevoItemTipo, setNuevoItemTipo] = useState<'documento' | 'capacitacion'>('documento')
  const [nuevoItemNombre, setNuevoItemNombre] = useState('')
  const [agregandoItem, setAgregandoItem] = useState(false)

  // ── Sheet PDF ──
  const [pdfSheetOpen, setPdfSheetOpen] = useState(false)
  const [pdfRanchoId, setPdfRanchoId] = useState('')
  const [exportando, setExportando] = useState(false)

  // Items for the worker form (reactive to form.rancho_id)
  const { items: formItems, loading: formItemsLoading } = useM47Items(form.rancho_id || null, orgId)
  // Items for the config sheet
  const { items: confItems, loading: confItemsLoading, refetch: refetchConfItems } = useM47Items(confRanchoId || null, orgId)

  // ── Derived ──
  const listaTrabajadores = useMemo(() => {
    let lista = trabajadores
    if (filtroRanchoId) lista = lista.filter(t => t.rancho_id === filtroRanchoId)
    if (busqueda.trim()) {
      const q = busqueda.toLowerCase()
      lista = lista.filter(t => t.nombre.toLowerCase().includes(q))
    }
    return lista
  }, [trabajadores, filtroRanchoId, busqueda])

  const confDocs = useMemo(() => confItems.filter(i => i.tipo === 'documento'), [confItems])
  const confCaps = useMemo(() => confItems.filter(i => i.tipo === 'capacitacion'), [confItems])
  const formDocs = useMemo(() => formItems.filter(i => i.activo && i.tipo === 'documento'), [formItems])
  const formCaps = useMemo(() => formItems.filter(i => i.activo && i.tipo === 'capacitacion'), [formItems])

  const fieldCls = 'w-full h-10 rounded-[0.625rem] border border-border bg-input-background px-3 text-sm'

  // ── Handlers ──

  function setF<K extends keyof FormTrabajador>(k: K, v: FormTrabajador[K]) {
    setForm(f => ({ ...f, [k]: v }))
  }

  function abrirNuevo() {
    setEditingId(null)
    setForm({ ...FORM_VACIO, fecha: hoyMX() })
    setChecklistValues({})
    setSheetOpen(true)
  }

  function abrirEditar(t: (typeof trabajadores)[0]) {
    setEditingId(t.id)
    setForm({
      rancho_id: t.rancho_id,
      fecha: t.fecha,
      puesto: t.puesto ?? '',
      nombre: t.nombre,
      direccion: t.direccion ?? '',
      telefono_casa: t.telefono_casa ?? '',
      celular: t.celular ?? '',
      fecha_nacimiento: t.fecha_nacimiento ?? '',
      emergencia_nombre: t.emergencia_nombre ?? '',
      emergencia_parentesco: t.emergencia_parentesco ?? '',
      emergencia_telefono: t.emergencia_telefono ?? '',
      observaciones: t.observaciones ?? '',
    })
    const cl: Record<string, boolean> = {}
    for (const c of t.checklist) cl[c.item_id] = c.valor
    setChecklistValues(cl)
    setSheetOpen(true)
  }

  async function guardar() {
    if (!orgId) return
    if (!form.rancho_id) { toast.error(`Selecciona una ${terminosSitio.singular}`); return }
    if (!form.nombre.trim()) { toast.error('El nombre es obligatorio'); return }
    setGuardando(true)
    try {
      let trabajadorId: string

      if (editingId) {
        const { error: eUpd } = await tbl('m47_trabajadores')
          .update({
            puesto: form.puesto.trim() || null,
            nombre: form.nombre.trim(),
            direccion: form.direccion.trim() || null,
            telefono_casa: form.telefono_casa.trim() || null,
            celular: form.celular.trim() || null,
            fecha_nacimiento: form.fecha_nacimiento || null,
            emergencia_nombre: form.emergencia_nombre.trim() || null,
            emergencia_parentesco: form.emergencia_parentesco.trim() || null,
            emergencia_telefono: form.emergencia_telefono.trim() || null,
            observaciones: form.observaciones.trim() || null,
          })
          .eq('id', editingId)
          .eq('org_id', orgId)
        if (eUpd) throw eUpd
        trabajadorId = editingId
      } else {
        const { data: ins, error: eIns } = await tbl('m47_trabajadores')
          .insert({
            org_id: orgId,
            rancho_id: form.rancho_id,
            fecha: form.fecha,
            puesto: form.puesto.trim() || null,
            nombre: form.nombre.trim(),
            direccion: form.direccion.trim() || null,
            telefono_casa: form.telefono_casa.trim() || null,
            celular: form.celular.trim() || null,
            fecha_nacimiento: form.fecha_nacimiento || null,
            emergencia_nombre: form.emergencia_nombre.trim() || null,
            emergencia_parentesco: form.emergencia_parentesco.trim() || null,
            emergencia_telefono: form.emergencia_telefono.trim() || null,
            observaciones: form.observaciones.trim() || null,
          })
          .select('id')
          .single()
        if (eIns) throw eIns
        trabajadorId = (ins as any).id as string
      }

      // Upsert checklist for all active items
      const activeItems = formItems.filter(i => i.activo)
      if (activeItems.length > 0) {
        const rows = activeItems.map(item => ({
          trabajador_id: trabajadorId,
          item_id: item.id,
          org_id: orgId,
          rancho_id: form.rancho_id,
          valor: checklistValues[item.id] ?? false,
        }))
        const { error: eCl } = await tbl('m47_checklist').upsert(rows, { onConflict: 'trabajador_id,item_id' })
        if (eCl) throw eCl
      }

      setSheetOpen(false)
      await refetch()
      toast.success(editingId ? 'Trabajador actualizado' : 'Trabajador registrado')
    } catch (e: any) {
      const msg: string = e?.message ?? 'Error al guardar'
      if (msg.includes('FECHA_SOLO_HOY')) {
        toast.warning('Solo puedes registrar con la fecha de hoy')
      } else {
        toast.error(msg)
      }
    } finally {
      setGuardando(false)
    }
  }

  async function sembrarPlantilla() {
    if (!confRanchoId || !orgId) return
    setSembrando(true)
    try {
      const rows = PLANTILLA.map(p => ({
        org_id: orgId,
        rancho_id: confRanchoId,
        tipo: p.tipo,
        nombre: p.nombre,
        activo: true,
        orden: p.orden,
      }))
      const { error } = await tbl('m47_items')
        .upsert(rows, { onConflict: 'rancho_id,tipo,nombre', ignoreDuplicates: true })
      if (error) throw error
      await refetchConfItems()
      toast.success('Plantilla sembrada')
    } catch (e: any) {
      toast.error(e?.message ?? 'Error al sembrar plantilla')
    } finally {
      setSembrando(false)
    }
  }

  async function toggleItemActivo(itemId: string, activo: boolean) {
    if (!orgId) return
    const { error } = await tbl('m47_items')
      .update({ activo: !activo })
      .eq('id', itemId)
      .eq('org_id', orgId)
    if (error) { toast.error(error.message); return }
    await refetchConfItems()
  }

  async function agregarItem() {
    if (!confRanchoId || !orgId) return
    if (!nuevoItemNombre.trim()) { toast.error('Ingresa un nombre'); return }
    setAgregandoItem(true)
    try {
      // orden = max+1 for this type
      const maxOrden = confItems
        .filter(i => i.tipo === nuevoItemTipo)
        .reduce((mx, i) => Math.max(mx, i.orden), 0)
      const { error } = await tbl('m47_items').insert({
        org_id: orgId,
        rancho_id: confRanchoId,
        tipo: nuevoItemTipo,
        nombre: nuevoItemNombre.trim(),
        activo: true,
        orden: maxOrden + 1,
      })
      if (error) throw error
      setNuevoItemNombre('')
      await refetchConfItems()
      toast.success('Ítem agregado')
    } catch (e: any) {
      toast.error(e?.message ?? 'Error al agregar ítem')
    } finally {
      setAgregandoItem(false)
    }
  }

  async function exportarPDF() {
    if (!orgId) return
    if (!pdfRanchoId) { toast.error(`Selecciona una ${terminosSitio.singular}`); return }
    setExportando(true)
    try {
      await generarRegistroPersonalPDF(pdfRanchoId, orgId, codigoClave)
      setPdfSheetOpen(false)
    } catch (e: any) {
      toast.error(e?.message ?? 'Error al generar PDF')
    } finally {
      setExportando(false)
    }
  }

  // ── Render ────────────────────────────────────────────────────────────────

  return (
    <div className="flex flex-col min-h-full bg-background pb-safe-nav">

      {/* Header */}
      <header className="bg-card border-b border-border px-4 py-3 sticky top-0 z-30">
        <div className="flex items-center gap-3">
          <Link to="/" className="p-1 -ml-1">
            <ChevronLeft className="w-5 h-5 text-foreground" />
          </Link>
          <div className="w-8 h-8 rounded-lg flex items-center justify-center flex-shrink-0"
            style={{ backgroundColor: 'var(--agro-success-fill)' }}>
            <Users className="w-4 h-4" style={{ color: 'var(--agro-success-text)' }} />
          </div>
          <div className="flex-1 min-w-0">
            <h1 className="text-sm text-foreground truncate" style={{ fontWeight: 600 }}>
              Registro de Personal
            </h1>
            <p className="text-xs text-muted-foreground">{codigoFormato('F-FRUS-ADM-04', codigoClave)} · Padrón</p>
          </div>
          <button
            onClick={() => setPdfSheetOpen(true)}
            className="p-2 rounded-lg border border-border"
            aria-label="Descargar PDF"
          >
            <FileDown className="w-4 h-4" style={{ color: 'var(--primary)' }} />
          </button>
          <button
            onClick={() => { setConfRanchoId(''); setConfigurarOpen(true) }}
            className="p-2 rounded-lg border border-border"
            aria-label="Configurar catálogo"
          >
            <Settings className="w-4 h-4 text-muted-foreground" />
          </button>
        </div>
      </header>

      {/* Filtros */}
      <div className="px-4 pt-3 pb-2 space-y-2">
        <select
          className={fieldCls}
          value={filtroRanchoId}
          onChange={e => setFiltroRanchoId(e.target.value)}
        >
          <option value="">{terminosSitio.plural}</option>
          {ranchos.map(r => <option key={r.id} value={r.id}>{r.nombre}</option>)}
        </select>
        <div className="relative">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-muted-foreground" />
          <input
            type="search"
            placeholder="Buscar por nombre…"
            value={busqueda}
            onChange={e => setBusqueda(e.target.value)}
            className="w-full h-10 rounded-[0.625rem] border border-border bg-input-background pl-9 pr-3 text-sm"
          />
        </div>
      </div>

      {/* Lista */}
      <div className="px-4 pb-6 space-y-3">
        {error && (
          <div className="flex items-start gap-2 rounded-xl p-3"
            style={{ backgroundColor: 'var(--agro-danger-fill)', border: '1px solid var(--agro-red)' }}>
            <TriangleAlert className="w-4 h-4 flex-shrink-0 mt-0.5" style={{ color: 'var(--agro-danger-text)' }} />
            <p className="text-xs" style={{ color: 'var(--agro-danger-text)' }}>Error al cargar trabajadores.</p>
          </div>
        )}

        {loading ? (
          <div className="flex justify-center py-12">
            <Loader2 className="w-6 h-6 text-primary animate-spin" />
          </div>
        ) : listaTrabajadores.length === 0 ? (
          <div className="bg-card border border-border rounded-xl p-6 text-center">
            <Users className="w-8 h-8 text-muted-foreground mx-auto mb-3" />
            <p className="text-sm text-foreground" style={{ fontWeight: 600 }}>
              {busqueda ? 'Sin resultados' : 'Sin trabajadores aún'}
            </p>
            <p className="text-xs text-muted-foreground mt-1">
              {busqueda ? 'Prueba otra búsqueda.' : 'Registra el primero con el botón +'}
            </p>
          </div>
        ) : (
          listaTrabajadores.map(t => {
            const docsOk = t.checklist.filter(c => c.valor).length
            const docsTotal = t.checklist.length
            return (
              <div key={t.id} className="bg-card border border-border rounded-xl p-4">
                <div className="flex items-start justify-between gap-2">
                  <div className="flex-1 min-w-0">
                    <p className="text-sm text-foreground truncate" style={{ fontWeight: 600 }}>
                      {t.nombre}
                    </p>
                    {t.puesto && (
                      <p className="text-xs text-muted-foreground truncate">{t.puesto}</p>
                    )}
                    <p className="text-xs text-muted-foreground mt-0.5">
                      {t.rancho_nombre} · {formatFecha(t.fecha)}
                    </p>
                    <div className="flex items-center gap-2 mt-1.5 flex-wrap">
                      {t.celular && (
                        <span className="text-xs text-muted-foreground">{t.celular}</span>
                      )}
                      {docsTotal > 0 && (
                        <span className="text-xs px-2 py-0.5 rounded-full"
                          style={{
                            backgroundColor: docsOk === docsTotal ? 'var(--agro-success-fill)' : 'var(--agro-warning-fill)',
                            color: docsOk === docsTotal ? 'var(--agro-success-text)' : 'var(--agro-warning-text)',
                            fontWeight: 600,
                          }}>
                          {docsOk}/{docsTotal} documentos
                        </span>
                      )}
                    </div>
                  </div>
                  <button
                    onClick={() => abrirEditar(t)}
                    className="p-2 rounded-lg border border-border flex-shrink-0"
                  >
                    <Pencil className="w-4 h-4 text-muted-foreground" />
                  </button>
                </div>
              </div>
            )
          })
        )}
      </div>

      {/* FAB */}
      <div className="fixed bottom-safe-fab left-1/2 -translate-x-1/2 w-full max-w-[390px] flex justify-end px-4 pointer-events-none z-10 md:bottom-6">
        <button
          onClick={abrirNuevo}
          className="pointer-events-auto w-14 h-14 rounded-full text-white flex items-center justify-center"
          style={{ backgroundColor: 'var(--primary)', boxShadow: '0 2px 12px rgba(43,122,181,0.35)' }}
          aria-label="Nuevo trabajador"
        >
          <Plus className="w-6 h-6" />
        </button>
      </div>

      {/* ═══ SHEET: FORMULARIO ══════════════════════════════════════════════════ */}
      <BottomSheet open={sheetOpen} onClose={() => { if (!guardando) setSheetOpen(false) }} height="85%">
        <div className="flex justify-center pt-3 pb-1">
          <div className="w-9 h-1 rounded-full bg-border" />
        </div>
        <div className="flex items-center justify-between px-4 pb-3">
          <h2 className="text-base text-foreground" style={{ fontWeight: 600 }}>
            {editingId ? 'Editar trabajador' : 'Nuevo trabajador'}
          </h2>
          <button type="button" onClick={() => { if (!guardando) setSheetOpen(false) }}>
            <X className="w-5 h-5 text-muted-foreground" />
          </button>
        </div>

        <div className="overflow-y-auto px-4 pb-6 space-y-6" style={{ flex: 1 }}>

          {/* ── Datos de alta ── */}
          <section className="space-y-3">
            <p className="text-xs text-muted-foreground uppercase tracking-wide" style={{ fontWeight: 700 }}>
              Datos de alta
            </p>

            {!editingId && (
              <div className="space-y-1">
                <label className="text-xs text-muted-foreground" style={{ fontWeight: 600 }}>
                  {terminosSitio.singular} *
                </label>
                <select
                  className={fieldCls}
                  value={form.rancho_id}
                  onChange={e => {
                    setF('rancho_id', e.target.value)
                    setChecklistValues({})
                  }}
                >
                  <option value="">Selecciona…</option>
                  {ranchos.map(r => <option key={r.id} value={r.id}>{r.nombre}</option>)}
                </select>
              </div>
            )}

            {editingId && (
              <div className="space-y-1">
                <label className="text-xs text-muted-foreground" style={{ fontWeight: 600 }}>
                  {terminosSitio.singular}
                </label>
                <p className="text-sm text-muted-foreground px-3 py-2 rounded-[0.625rem] border border-border bg-input-background">
                  {ranchos.find(r => r.id === form.rancho_id)?.nombre ?? '—'}
                </p>
              </div>
            )}

            <div className="flex gap-3">
              <div className="flex-1 space-y-1">
                <label className="text-xs text-muted-foreground" style={{ fontWeight: 600 }}>
                  Fecha de alta
                </label>
                <input
                  type="date"
                  className={fieldCls}
                  value={form.fecha}
                  readOnly={!!editingId}
                  min={!editingId && !puedeEditarFecha ? hoyMX() : undefined}
                  max={!editingId && !puedeEditarFecha ? hoyMX() : undefined}
                  onChange={e => { if (!editingId && puedeEditarFecha) setF('fecha', e.target.value) }}
                />
              </div>
              <div className="flex-1 space-y-1">
                <label className="text-xs text-muted-foreground" style={{ fontWeight: 600 }}>Puesto</label>
                <input
                  type="text"
                  className={fieldCls}
                  placeholder="Ej: Operario"
                  value={form.puesto}
                  onChange={e => setF('puesto', e.target.value)}
                />
              </div>
            </div>
          </section>

          {/* ── Datos personales ── */}
          <section className="space-y-3">
            <p className="text-xs text-muted-foreground uppercase tracking-wide" style={{ fontWeight: 700 }}>
              Datos personales
            </p>

            <div className="space-y-1">
              <label className="text-xs text-muted-foreground" style={{ fontWeight: 600 }}>Nombre completo *</label>
              <input
                type="text"
                className={fieldCls}
                placeholder="Nombre y apellidos"
                value={form.nombre}
                onChange={e => setF('nombre', e.target.value)}
              />
            </div>

            <div className="space-y-1">
              <label className="text-xs text-muted-foreground" style={{ fontWeight: 600 }}>Dirección</label>
              <input
                type="text"
                className={fieldCls}
                placeholder="Calle, número, colonia"
                value={form.direccion}
                onChange={e => setF('direccion', e.target.value)}
              />
            </div>

            <div className="grid grid-cols-2 gap-2">
              <div className="space-y-1">
                <label className="text-xs text-muted-foreground" style={{ fontWeight: 600 }}>Tel. casa</label>
                <input
                  type="tel"
                  className={fieldCls}
                  placeholder="Teléfono"
                  value={form.telefono_casa}
                  onChange={e => setF('telefono_casa', e.target.value)}
                />
              </div>
              <div className="space-y-1">
                <label className="text-xs text-muted-foreground" style={{ fontWeight: 600 }}>Celular</label>
                <input
                  type="tel"
                  className={fieldCls}
                  placeholder="Celular"
                  value={form.celular}
                  onChange={e => setF('celular', e.target.value)}
                />
              </div>
            </div>

            <div className="space-y-1">
              <label className="text-xs text-muted-foreground" style={{ fontWeight: 600 }}>Fecha de nacimiento</label>
              <input
                type="date"
                className={fieldCls}
                value={form.fecha_nacimiento}
                onChange={e => setF('fecha_nacimiento', e.target.value)}
              />
            </div>
          </section>

          {/* ── Contacto de emergencia ── */}
          <section className="space-y-3">
            <p className="text-xs text-muted-foreground uppercase tracking-wide" style={{ fontWeight: 700 }}>
              Contacto de emergencia
            </p>
            <div className="space-y-1">
              <label className="text-xs text-muted-foreground" style={{ fontWeight: 600 }}>Nombre</label>
              <input type="text" className={fieldCls} placeholder="Nombre de contacto"
                value={form.emergencia_nombre} onChange={e => setF('emergencia_nombre', e.target.value)} />
            </div>
            <div className="grid grid-cols-2 gap-2">
              <div className="space-y-1">
                <label className="text-xs text-muted-foreground" style={{ fontWeight: 600 }}>Parentesco</label>
                <input type="text" className={fieldCls} placeholder="Ej: Esposo/a"
                  value={form.emergencia_parentesco} onChange={e => setF('emergencia_parentesco', e.target.value)} />
              </div>
              <div className="space-y-1">
                <label className="text-xs text-muted-foreground" style={{ fontWeight: 600 }}>Teléfono</label>
                <input type="tel" className={fieldCls} placeholder="Teléfono"
                  value={form.emergencia_telefono} onChange={e => setF('emergencia_telefono', e.target.value)} />
              </div>
            </div>
          </section>

          {/* ── Documentación ── */}
          {form.rancho_id && (
            <section className="space-y-3">
              <p className="text-xs text-muted-foreground uppercase tracking-wide" style={{ fontWeight: 700 }}>
                Documentación personal
              </p>
              {formItemsLoading ? (
                <div className="flex justify-center py-4">
                  <Loader2 className="w-5 h-5 text-primary animate-spin" />
                </div>
              ) : formDocs.length === 0 ? (
                <p className="text-xs text-muted-foreground">
                  Sin documentos configurados para esta instalación.
                </p>
              ) : (
                <div className="space-y-1">
                  {formDocs.map(item => (
                    <div key={item.id} className="flex items-center justify-between py-2 border-b border-border last:border-0">
                      <span className="text-sm text-foreground">{item.nombre}</span>
                      <ToggleSiNo
                        value={checklistValues[item.id] ?? false}
                        onChange={v => setChecklistValues(prev => ({ ...prev, [item.id]: v }))}
                      />
                    </div>
                  ))}
                </div>
              )}
            </section>
          )}

          {/* ── Capacitaciones ── */}
          {form.rancho_id && !formItemsLoading && formCaps.length > 0 && (
            <section className="space-y-3">
              <p className="text-xs text-muted-foreground uppercase tracking-wide" style={{ fontWeight: 700 }}>
                Capacitaciones
              </p>
              <div className="space-y-1">
                {formCaps.map(item => (
                  <div key={item.id} className="flex items-center justify-between py-2 border-b border-border last:border-0">
                    <span className="text-sm text-foreground">{item.nombre}</span>
                    <ToggleSiNo
                      value={checklistValues[item.id] ?? false}
                      onChange={v => setChecklistValues(prev => ({ ...prev, [item.id]: v }))}
                    />
                  </div>
                ))}
              </div>
            </section>
          )}

          {/* ── Observaciones ── */}
          <section className="space-y-2">
            <p className="text-xs text-muted-foreground uppercase tracking-wide" style={{ fontWeight: 700 }}>
              Observaciones
            </p>
            <textarea
              value={form.observaciones}
              onChange={e => setF('observaciones', e.target.value)}
              rows={2}
              placeholder="Observaciones adicionales…"
              className="w-full rounded-lg border border-border bg-input-background px-3 py-2 text-sm resize-none"
            />
          </section>
        </div>

        <div className="px-4 pb-6 pt-3 border-t border-border">
          <button
            type="button"
            onClick={guardar}
            disabled={guardando}
            className="w-full h-11 rounded-[0.625rem] text-sm text-white disabled:opacity-50 flex items-center justify-center gap-2"
            style={{ backgroundColor: 'var(--primary)', fontWeight: 600 }}
          >
            {guardando && <Loader2 className="w-4 h-4 animate-spin" />}
            {guardando ? 'Guardando…' : editingId ? 'Guardar cambios' : 'Registrar trabajador'}
          </button>
        </div>
      </BottomSheet>

      {/* ═══ SHEET: CONFIGURAR ══════════════════════════════════════════════════ */}
      <BottomSheet open={configurarOpen} onClose={() => setConfigurarOpen(false)} height="85%">
        <div className="flex justify-center pt-3 pb-1">
          <div className="w-9 h-1 rounded-full bg-border" />
        </div>
        <div className="flex items-center justify-between px-4 pb-3">
          <h2 className="text-base text-foreground" style={{ fontWeight: 600 }}>Configurar catálogo</h2>
          <button type="button" onClick={() => setConfigurarOpen(false)}>
            <X className="w-5 h-5 text-muted-foreground" />
          </button>
        </div>

        <div className="overflow-y-auto px-4 pb-8 space-y-5" style={{ flex: 1 }}>
          <div className="space-y-1">
            <label className="text-xs text-muted-foreground" style={{ fontWeight: 600 }}>
              {terminosSitio.singular} *
            </label>
            <select
              className={fieldCls}
              value={confRanchoId}
              onChange={e => setConfRanchoId(e.target.value)}
            >
              <option value="">Selecciona…</option>
              {ranchos.map(r => <option key={r.id} value={r.id}>{r.nombre}</option>)}
            </select>
          </div>

          {confRanchoId && (
            <>
              {/* Sembrar plantilla */}
              <button
                type="button"
                onClick={sembrarPlantilla}
                disabled={sembrando}
                className="w-full h-10 rounded-[0.625rem] border border-border text-sm flex items-center justify-center gap-2 disabled:opacity-50"
                style={{ fontWeight: 600, color: 'var(--primary)' }}
              >
                {sembrando && <Loader2 className="w-4 h-4 animate-spin" />}
                {sembrando ? 'Sembrando…' : 'Sembrar plantilla estándar (12 ítems)'}
              </button>

              {confItemsLoading ? (
                <div className="flex justify-center py-6">
                  <Loader2 className="w-5 h-5 text-primary animate-spin" />
                </div>
              ) : (
                <>
                  {/* Documentos */}
                  <div className="space-y-2">
                    <p className="text-xs" style={{ fontWeight: 700, color: 'var(--muted-foreground)' }}>
                      DOCUMENTOS ({confDocs.length})
                    </p>
                    {confDocs.length === 0 ? (
                      <p className="text-xs text-muted-foreground">Sin documentos. Siembra la plantilla o agrega uno.</p>
                    ) : (
                      <div className="space-y-1">
                        {confDocs.map(item => (
                          <div key={item.id} className="flex items-center justify-between py-2 border-b border-border last:border-0">
                            <span className="text-sm" style={{ color: item.activo ? 'var(--foreground)' : 'var(--muted-foreground)' }}>
                              {item.nombre}
                            </span>
                            <button
                              type="button"
                              onClick={() => toggleItemActivo(item.id, item.activo)}
                              className="text-xs px-2 py-1 rounded-lg border border-border"
                              style={{
                                backgroundColor: item.activo ? 'var(--agro-success-fill)' : 'var(--muted)',
                                color: item.activo ? 'var(--agro-success-text)' : 'var(--muted-foreground)',
                                fontWeight: 600,
                              }}
                            >
                              {item.activo ? 'Activo' : 'Inactivo'}
                            </button>
                          </div>
                        ))}
                      </div>
                    )}
                  </div>

                  {/* Capacitaciones */}
                  <div className="space-y-2">
                    <p className="text-xs" style={{ fontWeight: 700, color: 'var(--muted-foreground)' }}>
                      CAPACITACIONES ({confCaps.length})
                    </p>
                    {confCaps.length === 0 ? (
                      <p className="text-xs text-muted-foreground">Sin capacitaciones. Siembra la plantilla o agrega una.</p>
                    ) : (
                      <div className="space-y-1">
                        {confCaps.map(item => (
                          <div key={item.id} className="flex items-center justify-between py-2 border-b border-border last:border-0">
                            <span className="text-sm" style={{ color: item.activo ? 'var(--foreground)' : 'var(--muted-foreground)' }}>
                              {item.nombre}
                            </span>
                            <button
                              type="button"
                              onClick={() => toggleItemActivo(item.id, item.activo)}
                              className="text-xs px-2 py-1 rounded-lg border border-border"
                              style={{
                                backgroundColor: item.activo ? 'var(--agro-success-fill)' : 'var(--muted)',
                                color: item.activo ? 'var(--agro-success-text)' : 'var(--muted-foreground)',
                                fontWeight: 600,
                              }}
                            >
                              {item.activo ? 'Activo' : 'Inactivo'}
                            </button>
                          </div>
                        ))}
                      </div>
                    )}
                  </div>

                  {/* Agregar nuevo ítem */}
                  <div className="space-y-2 pt-2 border-t border-border">
                    <p className="text-xs" style={{ fontWeight: 700, color: 'var(--muted-foreground)' }}>
                      AGREGAR ÍTEM
                    </p>
                    <div className="flex gap-2">
                      {(['documento', 'capacitacion'] as const).map(t => (
                        <button
                          key={t}
                          type="button"
                          onClick={() => setNuevoItemTipo(t)}
                          className="flex-1 h-9 rounded-lg text-xs border"
                          style={{
                            border: nuevoItemTipo === t ? 'none' : '1px solid var(--border)',
                            backgroundColor: nuevoItemTipo === t ? 'var(--agro-success-fill)' : 'var(--card)',
                            color: nuevoItemTipo === t ? 'var(--agro-success-text)' : 'var(--muted-foreground)',
                            fontWeight: nuevoItemTipo === t ? 700 : 400,
                          }}
                        >
                          {t === 'documento' ? 'Documento' : 'Capacitación'}
                        </button>
                      ))}
                    </div>
                    <div className="flex gap-2">
                      <input
                        type="text"
                        className="flex-1 h-10 rounded-[0.625rem] border border-border bg-input-background px-3 text-sm"
                        placeholder="Nombre del ítem"
                        value={nuevoItemNombre}
                        onChange={e => setNuevoItemNombre(e.target.value)}
                        onKeyDown={e => { if (e.key === 'Enter') agregarItem() }}
                      />
                      <button
                        type="button"
                        onClick={agregarItem}
                        disabled={agregandoItem || !nuevoItemNombre.trim()}
                        className="h-10 px-4 rounded-[0.625rem] text-sm text-white disabled:opacity-40 flex items-center gap-1"
                        style={{ backgroundColor: 'var(--primary)', fontWeight: 600 }}
                      >
                        {agregandoItem ? <Loader2 className="w-4 h-4 animate-spin" /> : <Plus className="w-4 h-4" />}
                      </button>
                    </div>
                  </div>
                </>
              )}
            </>
          )}
        </div>
      </BottomSheet>

      {/* ═══ SHEET: PDF ═════════════════════════════════════════════════════════ */}
      <BottomSheet open={pdfSheetOpen} onClose={() => setPdfSheetOpen(false)} height="85%">
        <div className="flex justify-center pt-3 pb-1">
          <div className="w-9 h-1 rounded-full bg-border" />
        </div>
        <div className="flex items-center justify-between px-4 pb-3">
          <h2 className="text-base text-foreground" style={{ fontWeight: 600 }}>Descargar PDF</h2>
          <button type="button" onClick={() => setPdfSheetOpen(false)}>
            <X className="w-5 h-5 text-muted-foreground" />
          </button>
        </div>
        <div className="overflow-y-auto px-4 pb-8 space-y-4" style={{ flex: 1 }}>
          <p className="text-xs text-muted-foreground">
            El PDF incluye todos los trabajadores activos de la instalación seleccionada con su documentación y capacitaciones.
          </p>
          <div className="space-y-1">
            <label className="text-xs text-muted-foreground" style={{ fontWeight: 600 }}>
              {terminosSitio.singular} *
            </label>
            <select
              className={fieldCls}
              value={pdfRanchoId}
              onChange={e => setPdfRanchoId(e.target.value)}
            >
              <option value="">Selecciona…</option>
              {ranchos.map(r => <option key={r.id} value={r.id}>{r.nombre}</option>)}
            </select>
          </div>
        </div>
        <div className="px-4 pb-6 pt-3 border-t border-border">
          <button
            type="button"
            onClick={exportarPDF}
            disabled={exportando || !pdfRanchoId}
            className="w-full h-11 rounded-[0.625rem] text-sm text-white disabled:opacity-50 flex items-center justify-center gap-2"
            style={{ backgroundColor: 'var(--primary)', fontWeight: 600 }}
          >
            {exportando ? <Loader2 className="w-4 h-4 animate-spin" /> : <FileDown className="w-4 h-4" />}
            {exportando ? 'Generando…' : 'Descargar PDF'}
          </button>
        </div>
      </BottomSheet>
    </div>
  )
}
