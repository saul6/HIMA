import { useState, useMemo } from 'react'
import {
  ChevronLeft, Plus, FileDown, X, Loader2, Truck, Minus,
  Files, Bug, TriangleAlert,
} from 'lucide-react'
import { Link } from 'react-router'
import { BottomSheet } from '@/app/components/BottomSheet'
import { toast } from 'sonner'
import { useAuthContext } from '@/context/AuthContext'
import { puedeEditarFechaLibre } from '@/lib/permisos'
import { codigoFormato } from '@/lib/codigoFormato'
import { useModulosContext } from '@/context/ModulosContext'
import { useRanchos } from '@/hooks/useRanchos'
import { useM38Manifiestos } from '@/hooks/useM38Manifiestos'
import { useOrganizacion } from '@/hooks/useOrganizacion'
import { supabase } from '@/lib/supabase'
import { generarManifiestoEmbarquePDF } from '@/lib/pdf/m38/generarManifiestoEmbarquePDF'
import { generarManifiestoEmbarqueConsolidadoPDF } from '@/lib/pdf/m38/generarManifiestoEmbarqueConsolidadoPDF'

const hoyMX = () => new Date().toLocaleDateString('en-CA', { timeZone: 'America/Mexico_City' })

function formatFecha(iso: string): string {
  try {
    return new Date(iso + 'T12:00:00').toLocaleDateString('es-MX', { day: 'numeric', month: 'short', year: 'numeric' })
  } catch { return iso }
}

const tbl = (name: string) => (supabase as any).from(name)

type BuenMalo = 'bueno' | 'malo'

interface LineaForm {
  _key: string
  tarima: string
  producto: string
  presentacion: string
  cajas: string
  temp_superior: string
  temp_medio: string
  temp_inferior: string
}

interface FormState {
  rancho_id: string
  fecha: string
  folio: string
  empresa: string
  linea_transportista: string
  nombre_chofer: string
  placas_tractor: string
  caja_pies: string
  econ_tractor: string
  econ_caja: string
  num_sello: string
  num_chismografo: string
  llegada_hora: string
  llegada_temp: string
  carga_hora: string
  carga_temp: string
  salida_hora: string
  salida_temp: string
  cond_buen_estado: boolean
  cond_limpio: boolean
  cond_presencia_plagas: boolean
  tar_remontado: BuenMalo
  tar_flejado: BuenMalo
  tar_limpieza: BuenMalo
  tar_condicion: BuenMalo
  tar_distribucion: BuenMalo
  observaciones: string
  plaga_descripcion: string
}

function nuevaLinea(): LineaForm {
  return {
    _key: Math.random().toString(36).slice(2),
    tarima: '', producto: '', presentacion: '',
    cajas: '', temp_superior: '', temp_medio: '', temp_inferior: '',
  }
}

const FORM_BASE: Omit<FormState, 'fecha'> = {
  rancho_id: '', folio: '', empresa: '', linea_transportista: '',
  nombre_chofer: '', placas_tractor: '', caja_pies: '',
  econ_tractor: '', econ_caja: '', num_sello: '', num_chismografo: '',
  llegada_hora: '', llegada_temp: '', carga_hora: '', carga_temp: '',
  salida_hora: '', salida_temp: '',
  cond_buen_estado: true, cond_limpio: true, cond_presencia_plagas: false,
  tar_remontado: 'bueno', tar_flejado: 'bueno', tar_limpieza: 'bueno',
  tar_condicion: 'bueno', tar_distribucion: 'bueno',
  observaciones: '', plaga_descripcion: '',
}

function ToggleSiNo({ value, onChange }: { value: boolean; onChange: (v: boolean) => void }) {
  return (
    <div className="flex gap-1.5">
      {([true, false] as const).map(v => (
        <button
          key={String(v)}
          type="button"
          onClick={() => onChange(v)}
          style={{
            flex: 1, height: 30, borderRadius: 8, cursor: 'pointer',
            border: value === v ? 'none' : '1px solid var(--border)',
            backgroundColor: value === v
              ? v ? 'var(--agro-success-fill)' : 'var(--agro-danger-fill)'
              : 'var(--card)',
            color: value === v
              ? v ? 'var(--agro-success-text)' : 'var(--agro-danger-text)'
              : 'var(--muted-foreground)',
            fontSize: 12, fontWeight: value === v ? 700 : 400,
          }}
        >
          {v ? 'Si' : 'No'}
        </button>
      ))}
    </div>
  )
}

function ToggleBuenMalo({ value, onChange }: { value: BuenMalo; onChange: (v: BuenMalo) => void }) {
  return (
    <div className="flex gap-1.5">
      {(['bueno', 'malo'] as BuenMalo[]).map(v => (
        <button
          key={v}
          type="button"
          onClick={() => onChange(v)}
          style={{
            flex: 1, height: 30, borderRadius: 8, cursor: 'pointer',
            border: value === v ? 'none' : '1px solid var(--border)',
            backgroundColor: value === v
              ? v === 'bueno' ? 'var(--agro-success-fill)' : 'var(--agro-danger-fill)'
              : 'var(--card)',
            color: value === v
              ? v === 'bueno' ? 'var(--agro-success-text)' : 'var(--agro-danger-text)'
              : 'var(--muted-foreground)',
            fontSize: 12, fontWeight: value === v ? 700 : 400,
          }}
        >
          {v === 'bueno' ? 'Bueno' : 'Malo'}
        </button>
      ))}
    </div>
  )
}

export function ManifiestoEmbarque() {
  const { profile, user, codigoClave } = useAuthContext()
  const esSuperAdmin = profile?.rol === 'super_admin'
  const puedeEditarFecha = esSuperAdmin || puedeEditarFechaLibre(user?.email)
  const { terminosSitio } = useModulosContext()
  const orgId = profile?.org_id ?? null
  const { ranchos } = useRanchos()
  const { manifiestos, loading, error, refetch } = useM38Manifiestos()
  const orgNombre = useOrganizacion(orgId)

  const [sheetOpen, setSheetOpen] = useState(false)
  const [consolidadoOpen, setConsolidadoOpen] = useState(false)
  const [form, setForm] = useState<FormState>({ ...FORM_BASE, fecha: hoyMX() })
  const [lineas, setLineas] = useState<LineaForm[]>([nuevaLinea()])
  const [guardando, setGuardando] = useState(false)
  const [pdfLoading, setPdfLoading] = useState<string | null>(null)
  const [consolidadoForm, setConsolidadoForm] = useState({ rancho_id: '', desde: hoyMX(), hasta: hoyMX() })
  const [exportando, setExportando] = useState(false)

  function abrirNuevo() {
    setForm({ ...FORM_BASE, fecha: hoyMX() })
    setLineas([nuevaLinea()])
    setSheetOpen(true)
  }

  function setF<K extends keyof FormState>(k: K, v: FormState[K]) {
    setForm(f => ({ ...f, [k]: v }))
  }

  function actualizarLinea(key: string, field: keyof Omit<LineaForm, '_key'>, value: string) {
    setLineas(prev => prev.map(l => l._key === key ? { ...l, [field]: value } : l))
  }

  const totalesPorProducto = useMemo(() => {
    const acc: Record<string, number> = {}
    for (const l of lineas) {
      const prod = l.producto.trim()
      if (prod) acc[prod] = (acc[prod] ?? 0) + (parseFloat(l.cajas) || 0)
    }
    return acc
  }, [lineas])

  async function guardar() {
    if (!orgId) return
    if (!form.rancho_id) { toast.error(`Selecciona una ${terminosSitio.singular}`); return }
    if (form.cond_presencia_plagas && !form.plaga_descripcion.trim()) {
      toast.error('Describe el hallazgo de plaga para registrar la incidencia')
      return
    }
    setGuardando(true)
    try {
      let incidenciaId: string | null = null
      if (form.cond_presencia_plagas && form.plaga_descripcion.trim()) {
        const { data: rep, error: eRep } = await tbl('m13_reportes').insert({
          rancho_id: form.rancho_id,
          org_id: orgId,
          fecha: form.fecha,
          auditor_nombre: profile?.nombre_completo ?? '',
        }).select('id').single()
        if (eRep) throw eRep

        const { data: inc, error: eInc } = await tbl('m13_incidencias').insert({
          reporte_id: (rep as any).id,
          org_id: orgId,
          descripcion: form.plaga_descripcion.trim(),
          orden: 1,
        }).select('id').single()
        if (eInc) throw eInc
        incidenciaId = (inc as any).id
      }

      const { data: man, error: eMan } = await tbl('m38_manifiestos').insert({
        org_id: orgId,
        rancho_id: form.rancho_id,
        fecha: form.fecha,
        folio: form.folio.trim() || null,
        empresa: form.empresa.trim() || null,
        linea_transportista: form.linea_transportista.trim() || null,
        nombre_chofer: form.nombre_chofer.trim() || null,
        placas_tractor: form.placas_tractor.trim() || null,
        caja_pies: form.caja_pies.trim() || null,
        econ_tractor: form.econ_tractor.trim() || null,
        econ_caja: form.econ_caja.trim() || null,
        num_sello: form.num_sello.trim() || null,
        num_chismografo: form.num_chismografo.trim() || null,
        llegada_hora: form.llegada_hora || null,
        llegada_temp: form.llegada_temp !== '' ? parseFloat(form.llegada_temp) : null,
        carga_hora: form.carga_hora || null,
        carga_temp: form.carga_temp !== '' ? parseFloat(form.carga_temp) : null,
        salida_hora: form.salida_hora || null,
        salida_temp: form.salida_temp !== '' ? parseFloat(form.salida_temp) : null,
        cond_buen_estado: form.cond_buen_estado,
        cond_limpio: form.cond_limpio,
        cond_presencia_plagas: form.cond_presencia_plagas,
        tar_remontado: form.tar_remontado,
        tar_flejado: form.tar_flejado,
        tar_limpieza: form.tar_limpieza,
        tar_condicion: form.tar_condicion,
        tar_distribucion: form.tar_distribucion,
        observaciones: form.observaciones.trim() || null,
        incidencia_id: incidenciaId,
      }).select('id').single()
      if (eMan) throw eMan

      const manifiestoId = (man as any).id as string

      const lineasFiltradas = lineas.filter(l => l.tarima.trim() || l.producto.trim())
      if (lineasFiltradas.length > 0) {
        const rows = lineasFiltradas.map((l, i) => ({
          manifiesto_id: manifiestoId,
          org_id: orgId,
          orden: i + 1,
          tarima: l.tarima.trim() || null,
          producto: l.producto.trim() || null,
          presentacion: l.presentacion.trim() || null,
          cajas: l.cajas !== '' ? parseInt(l.cajas, 10) : null,
          temp_superior: l.temp_superior !== '' ? parseFloat(l.temp_superior) : null,
          temp_medio: l.temp_medio !== '' ? parseFloat(l.temp_medio) : null,
          temp_inferior: l.temp_inferior !== '' ? parseFloat(l.temp_inferior) : null,
        }))
        const { error: eLineas } = await tbl('m38_lineas').insert(rows)
        if (eLineas) throw eLineas
      }

      setSheetOpen(false)
      await refetch()
      toast.success('Manifiesto registrado')

      try {
        await generarManifiestoEmbarquePDF(manifiestoId, orgId, codigoClave)
      } catch {
        toast.error('PDF no generado')
      }
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

  async function descargarPDF(id: string) {
    if (!orgId) return
    setPdfLoading(id)
    try {
      await generarManifiestoEmbarquePDF(id, orgId, codigoClave)
    } catch {
      toast.error('Error al generar PDF')
    } finally {
      setPdfLoading(null)
    }
  }

  async function exportarConsolidado() {
    if (!orgId) return
    setExportando(true)
    try {
      const rancho = ranchos.find(r => r.id === consolidadoForm.rancho_id)
      const instName = rancho?.nombre ?? terminosSitio.plural
      await generarManifiestoEmbarqueConsolidadoPDF(
        orgId,
        consolidadoForm.rancho_id || null,
        consolidadoForm.desde,
        consolidadoForm.hasta,
        instName,
        orgNombre ?? '—',
        codigoClave,
      )
      setConsolidadoOpen(false)
    } catch (e: any) {
      toast.error(e?.message ?? 'Error al exportar')
    } finally {
      setExportando(false)
    }
  }

  const fieldCls = 'w-full h-10 rounded-[0.625rem] border border-border bg-input-background px-3 text-sm'

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
            <Truck className="w-4 h-4" style={{ color: 'var(--agro-success-text)' }} />
          </div>
          <div className="flex-1 min-w-0">
            <h1 className="text-sm text-foreground truncate" style={{ fontWeight: 600 }}>
              Manifiesto de Embarque
            </h1>
            <p className="text-xs text-muted-foreground">{codigoFormato('F-FRUS-PRO-01', codigoClave)} · Por evento</p>
          </div>
          <button
            onClick={() => setConsolidadoOpen(true)}
            className="flex items-center gap-1.5 h-8 px-3 rounded-lg border border-border text-xs text-foreground flex-shrink-0"
            style={{ fontWeight: 600 }}
          >
            <Files className="w-3.5 h-3.5" />
            Consolidado
          </button>
        </div>
      </header>

      {/* Lista */}
      <div className="p-4 space-y-3">
        {error && (
          <div className="flex items-start gap-2 rounded-xl p-3"
            style={{ backgroundColor: 'var(--agro-danger-fill)', border: '1px solid var(--agro-red)' }}>
            <TriangleAlert className="w-4 h-4 flex-shrink-0 mt-0.5" style={{ color: 'var(--agro-danger-text)' }} />
            <p className="text-xs" style={{ color: 'var(--agro-danger-text)' }}>Error al cargar manifiestos.</p>
          </div>
        )}

        {loading ? (
          <div className="flex justify-center py-12">
            <Loader2 className="w-6 h-6 text-primary animate-spin" />
          </div>
        ) : manifiestos.length === 0 ? (
          <div className="bg-card border border-border rounded-xl p-6 text-center">
            <Truck className="w-8 h-8 text-muted-foreground mx-auto mb-3" />
            <p className="text-sm text-foreground" style={{ fontWeight: 600 }}>Sin manifiestos aún</p>
            <p className="text-xs text-muted-foreground mt-1">Crea el primer manifiesto con el botón +</p>
          </div>
        ) : (
          manifiestos.map(m => (
            <div key={m.id} className="bg-card border border-border rounded-xl p-4">
              <div className="flex items-start justify-between gap-2">
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-1.5 flex-wrap mb-0.5">
                    <span className="text-sm text-foreground" style={{ fontWeight: 600 }}>
                      {m.rancho_nombre}
                    </span>
                    {m.folio && (
                      <span className="text-xs px-1.5 py-0.5 rounded"
                        style={{ backgroundColor: 'var(--muted)', color: 'var(--muted-foreground)', fontWeight: 600 }}>
                        #{m.folio}
                      </span>
                    )}
                  </div>
                  <p className="text-xs text-muted-foreground">{formatFecha(m.fecha)}</p>
                  {m.empresa && (
                    <p className="text-xs mt-0.5" style={{ fontWeight: 600 }}>{m.empresa}</p>
                  )}
                  {m.nombre_chofer && (
                    <p className="text-xs text-muted-foreground mt-0.5">Chofer: {m.nombre_chofer}</p>
                  )}
                  {m.incidencia_id && (
                    <div className="flex items-center gap-1 mt-1">
                      <Bug className="w-3 h-3 flex-shrink-0" style={{ color: 'var(--agro-danger-text)' }} />
                      <span className="text-xs" style={{ color: 'var(--agro-danger-text)', fontWeight: 600 }}>
                        Plaga registrada → M13
                      </span>
                    </div>
                  )}
                </div>
                <button
                  onClick={() => descargarPDF(m.id)}
                  disabled={pdfLoading === m.id}
                  className="p-2 rounded-lg border border-border flex-shrink-0 disabled:opacity-50"
                >
                  {pdfLoading === m.id
                    ? <Loader2 className="w-4 h-4 animate-spin" />
                    : <FileDown className="w-4 h-4" style={{ color: 'var(--primary)' }} />
                  }
                </button>
              </div>
            </div>
          ))
        )}
      </div>

      {/* FAB */}
      <div className="fixed bottom-safe-fab left-1/2 -translate-x-1/2 w-full max-w-[390px] flex justify-end px-4 pointer-events-none z-10 md:bottom-6">
        <button
          onClick={abrirNuevo}
          className="pointer-events-auto w-14 h-14 rounded-full text-white flex items-center justify-center"
          style={{ backgroundColor: 'var(--primary)', boxShadow: '0 2px 12px rgba(43,122,181,0.35)' }}
          aria-label="Nuevo manifiesto"
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
          <h2 className="text-base text-foreground" style={{ fontWeight: 600 }}>Nuevo manifiesto</h2>
          <button type="button" onClick={() => { if (!guardando) setSheetOpen(false) }}>
            <X className="w-5 h-5 text-muted-foreground" />
          </button>
        </div>

        <div className="overflow-y-auto px-4 pb-6 space-y-6" style={{ flex: 1 }}>

          {/* ── Sección: datos del embarque ── */}
          <section className="space-y-3">
            <p className="text-xs text-muted-foreground uppercase tracking-wide" style={{ fontWeight: 700 }}>
              Datos del embarque
            </p>

            <div className="space-y-1">
              <label className="text-xs text-muted-foreground" style={{ fontWeight: 600 }}>
                {terminosSitio.singular} *
              </label>
              <select
                className={fieldCls}
                value={form.rancho_id}
                onChange={e => setF('rancho_id', e.target.value)}
              >
                <option value="">Selecciona...</option>
                {ranchos.map(r => <option key={r.id} value={r.id}>{r.nombre}</option>)}
              </select>
            </div>

            <div className="flex gap-3">
              <div className="flex-1 space-y-1">
                <label className="text-xs text-muted-foreground" style={{ fontWeight: 600 }}>Fecha *</label>
                <input
                  type="date"
                  className={fieldCls}
                  value={form.fecha}
                  min={puedeEditarFecha ? undefined : hoyMX()}
                  max={puedeEditarFecha ? undefined : hoyMX()}
                  onChange={e => { if (puedeEditarFecha) setF('fecha', e.target.value) }}
                />
              </div>
              <div className="flex-1 space-y-1">
                <label className="text-xs text-muted-foreground" style={{ fontWeight: 600 }}>Folio</label>
                <input
                  type="text"
                  className={fieldCls}
                  placeholder="Ej: 001"
                  value={form.folio}
                  onChange={e => setF('folio', e.target.value)}
                />
              </div>
            </div>

            <div className="space-y-1">
              <label className="text-xs text-muted-foreground" style={{ fontWeight: 600 }}>Empresa / Cliente</label>
              <input type="text" className={fieldCls} placeholder="Nombre del cliente"
                value={form.empresa} onChange={e => setF('empresa', e.target.value)} />
            </div>

            <div className="space-y-1">
              <label className="text-xs text-muted-foreground" style={{ fontWeight: 600 }}>Línea transportista</label>
              <input type="text" className={fieldCls} placeholder="Nombre de la línea"
                value={form.linea_transportista} onChange={e => setF('linea_transportista', e.target.value)} />
            </div>

            <div className="space-y-1">
              <label className="text-xs text-muted-foreground" style={{ fontWeight: 600 }}>Nombre del chofer</label>
              <input type="text" className={fieldCls} placeholder="Nombre completo"
                value={form.nombre_chofer} onChange={e => setF('nombre_chofer', e.target.value)} />
            </div>

            <div className="grid grid-cols-2 gap-3">
              {([
                { label: 'Placas del tractor', key: 'placas_tractor' as const, ph: 'Ej: ABC-123' },
                { label: 'Caja (pies)',         key: 'caja_pies'      as const, ph: 'Ej: 53'    },
                { label: 'Económico tractor',   key: 'econ_tractor'   as const, ph: 'No. eco.'  },
                { label: 'Económico caja',      key: 'econ_caja'      as const, ph: 'No. eco.'  },
                { label: 'No. sello',           key: 'num_sello'      as const, ph: 'No. sello' },
                { label: 'No. chismógrafo',     key: 'num_chismografo' as const, ph: 'No. chismo.' },
              ] as const).map(({ label, key, ph }) => (
                <div key={key} className="space-y-1">
                  <label className="text-xs text-muted-foreground" style={{ fontWeight: 600 }}>{label}</label>
                  <input type="text" className={fieldCls} placeholder={ph}
                    value={form[key]} onChange={e => setF(key, e.target.value)} />
                </div>
              ))}
            </div>
          </section>

          {/* ── Sección: temperatura del camión ── */}
          <section className="space-y-2">
            <p className="text-xs text-muted-foreground uppercase tracking-wide" style={{ fontWeight: 700 }}>
              Temperatura del camión
            </p>
            <div className="bg-card border border-border rounded-xl overflow-hidden">
              <div className="grid grid-cols-3 border-b border-border"
                style={{ backgroundColor: 'var(--muted)' }}>
                <div className="px-3 py-2 text-xs text-muted-foreground" style={{ fontWeight: 600 }} />
                <div className="px-3 py-2 text-xs text-muted-foreground text-center" style={{ fontWeight: 600 }}>Hora</div>
                <div className="px-3 py-2 text-xs text-muted-foreground text-center" style={{ fontWeight: 600 }}>Temp (°C)</div>
              </div>
              {([
                { label: 'Llegada', horaKey: 'llegada_hora' as const, tempKey: 'llegada_temp' as const },
                { label: 'Carga',   horaKey: 'carga_hora'   as const, tempKey: 'carga_temp'   as const },
                { label: 'Salida',  horaKey: 'salida_hora'  as const, tempKey: 'salida_temp'  as const },
              ] as const).map((row, i) => (
                <div key={i} className="grid grid-cols-3 divide-x divide-border border-t border-border">
                  <div className="px-3 py-2 flex items-center text-xs text-foreground" style={{ fontWeight: 600 }}>
                    {row.label}
                  </div>
                  <div className="p-1.5">
                    <input
                      type="time"
                      className="w-full h-8 rounded-lg border border-border bg-input-background px-2 text-sm text-center"
                      value={form[row.horaKey]}
                      onChange={e => setF(row.horaKey, e.target.value)}
                    />
                  </div>
                  <div className="p-1.5">
                    <input
                      type="number"
                      inputMode="decimal"
                      step="0.1"
                      placeholder="—"
                      className="w-full h-8 rounded-lg border border-border bg-input-background px-2 text-sm text-center"
                      value={form[row.tempKey]}
                      onChange={e => setF(row.tempKey, e.target.value)}
                    />
                  </div>
                </div>
              ))}
            </div>
          </section>

          {/* ── Sección: tarimas ── */}
          <section className="space-y-3">
            <div className="flex items-center justify-between">
              <p className="text-xs text-muted-foreground uppercase tracking-wide" style={{ fontWeight: 700 }}>
                Tarimas embarcadas
              </p>
              <button
                type="button"
                onClick={() => setLineas(prev => [...prev, nuevaLinea()])}
                className="flex items-center gap-1 text-xs"
                style={{ color: 'var(--primary)', fontWeight: 600 }}
              >
                <Plus className="w-3.5 h-3.5" />
                Agregar
              </button>
            </div>

            <div className="space-y-3">
              {lineas.map((l, idx) => (
                <div key={l._key} className="bg-card border border-border rounded-xl p-3 space-y-2">
                  <div className="flex items-center justify-between">
                    <span className="text-xs text-muted-foreground" style={{ fontWeight: 600 }}>
                      Línea {idx + 1}
                    </span>
                    {lineas.length > 1 && (
                      <button
                        type="button"
                        onClick={() => setLineas(prev => prev.filter(x => x._key !== l._key))}
                        className="p-0.5"
                      >
                        <Minus className="w-3.5 h-3.5 text-muted-foreground" />
                      </button>
                    )}
                  </div>
                  <div className="grid grid-cols-2 gap-2">
                    <div className="space-y-1">
                      <label className="text-xs text-muted-foreground">Tarima</label>
                      <input type="text"
                        className="w-full h-9 rounded-lg border border-border bg-input-background px-2.5 text-sm"
                        placeholder="Ej: T-01"
                        value={l.tarima}
                        onChange={e => actualizarLinea(l._key, 'tarima', e.target.value)} />
                    </div>
                    <div className="space-y-1">
                      <label className="text-xs text-muted-foreground">Cajas</label>
                      <input type="number" inputMode="numeric" min="0"
                        className="w-full h-9 rounded-lg border border-border bg-input-background px-2.5 text-sm"
                        placeholder="0"
                        value={l.cajas}
                        onChange={e => actualizarLinea(l._key, 'cajas', e.target.value)} />
                    </div>
                  </div>
                  <div className="space-y-1">
                    <label className="text-xs text-muted-foreground">Producto</label>
                    <input type="text"
                      className="w-full h-9 rounded-lg border border-border bg-input-background px-2.5 text-sm"
                      placeholder="Nombre del producto"
                      value={l.producto}
                      onChange={e => actualizarLinea(l._key, 'producto', e.target.value)} />
                  </div>
                  <div className="space-y-1">
                    <label className="text-xs text-muted-foreground">Presentación</label>
                    <input type="text"
                      className="w-full h-9 rounded-lg border border-border bg-input-background px-2.5 text-sm"
                      placeholder="Ej: Caja 8 lbs"
                      value={l.presentacion}
                      onChange={e => actualizarLinea(l._key, 'presentacion', e.target.value)} />
                  </div>
                  <div className="grid grid-cols-3 gap-2">
                    {([
                      { label: 'T. Superior', key: 'temp_superior' as const },
                      { label: 'T. Medio',    key: 'temp_medio'    as const },
                      { label: 'T. Inferior', key: 'temp_inferior' as const },
                    ] as const).map(({ label, key }) => (
                      <div key={key} className="space-y-1">
                        <label className="text-xs text-muted-foreground">{label}</label>
                        <input type="number" inputMode="decimal" step="0.1" placeholder="°C"
                          className="w-full h-9 rounded-lg border border-border bg-input-background px-2 text-sm text-center"
                          value={l[key]}
                          onChange={e => actualizarLinea(l._key, key, e.target.value)} />
                      </div>
                    ))}
                  </div>
                </div>
              ))}
            </div>

            {/* Totales auto-calculados */}
            {Object.keys(totalesPorProducto).length > 0 && (
              <div className="rounded-xl p-3 space-y-1.5"
                style={{ backgroundColor: 'var(--agro-success-fill)' }}>
                <p className="text-xs" style={{ fontWeight: 700, color: 'var(--agro-success-text)' }}>
                  Total por producto
                </p>
                {Object.entries(totalesPorProducto).map(([prod, cajas]) => (
                  <div key={prod} className="flex items-center justify-between">
                    <span className="text-xs" style={{ color: 'var(--agro-success-text)' }}>{prod}</span>
                    <span className="text-xs" style={{ color: 'var(--agro-success-text)', fontWeight: 700 }}>
                      {cajas} cajas
                    </span>
                  </div>
                ))}
              </div>
            )}
          </section>

          {/* ── Sección: condiciones del transporte ── */}
          <section className="space-y-3">
            <p className="text-xs text-muted-foreground uppercase tracking-wide" style={{ fontWeight: 700 }}>
              Condiciones del transporte
            </p>
            <div className="bg-card border border-border rounded-xl divide-y divide-border">
              {([
                { label: 'En buen estado',             key: 'cond_buen_estado'      as const },
                { label: 'Limpio y libre de malos olores', key: 'cond_limpio'       as const },
                { label: 'Presencia de plagas',        key: 'cond_presencia_plagas' as const },
              ] as const).map(({ label, key }) => (
                <div key={key} className="px-3 py-2.5 space-y-1.5">
                  <p className="text-xs text-foreground" style={{ fontWeight: 600 }}>{label}</p>
                  <ToggleSiNo value={form[key]} onChange={v => setF(key, v)} />
                </div>
              ))}
            </div>

            {form.cond_presencia_plagas && (
              <div className="space-y-2">
                <div className="flex items-start gap-2 rounded-xl p-3"
                  style={{ backgroundColor: 'var(--agro-danger-fill)', border: '1px solid var(--agro-red)' }}>
                  <Bug className="w-4 h-4 flex-shrink-0 mt-0.5" style={{ color: 'var(--agro-danger-text)' }} />
                  <p className="text-xs" style={{ color: 'var(--agro-danger-text)' }}>
                    Se creará una incidencia en M13 - Reporte de Incidencias vinculada a este hallazgo.
                  </p>
                </div>
                <div className="space-y-1">
                  <label className="text-xs text-muted-foreground" style={{ fontWeight: 600 }}>
                    Descripción del hallazgo de plaga *
                  </label>
                  <textarea
                    value={form.plaga_descripcion}
                    onChange={e => setF('plaga_descripcion', e.target.value)}
                    rows={2}
                    placeholder="Describe qué tipo de plaga se encontró y dónde..."
                    className="w-full rounded-lg border border-border bg-input-background px-3 py-2 text-sm resize-none"
                  />
                </div>
              </div>
            )}
          </section>

          {/* ── Sección: condiciones de las tarimas ── */}
          <section className="space-y-3">
            <p className="text-xs text-muted-foreground uppercase tracking-wide" style={{ fontWeight: 700 }}>
              Condiciones de las tarimas
            </p>
            <div className="bg-card border border-border rounded-xl divide-y divide-border">
              {([
                { label: 'Remontado',                 key: 'tar_remontado'    as const },
                { label: 'Flejado',                   key: 'tar_flejado'      as const },
                { label: 'Limpieza',                  key: 'tar_limpieza'     as const },
                { label: 'Condición de la tarima',    key: 'tar_condicion'    as const },
                { label: 'Distribución del embarque', key: 'tar_distribucion' as const },
              ] as const).map(({ label, key }) => (
                <div key={key} className="px-3 py-2.5 space-y-1.5">
                  <p className="text-xs text-foreground" style={{ fontWeight: 600 }}>{label}</p>
                  <ToggleBuenMalo value={form[key]} onChange={v => setF(key, v)} />
                </div>
              ))}
            </div>
          </section>

          {/* ── Sección: observaciones ── */}
          <section className="space-y-2">
            <p className="text-xs text-muted-foreground uppercase tracking-wide" style={{ fontWeight: 700 }}>
              Observaciones
            </p>
            <textarea
              value={form.observaciones}
              onChange={e => setF('observaciones', e.target.value)}
              rows={2}
              placeholder="Observaciones generales del embarque..."
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
            {guardando ? 'Guardando…' : 'Guardar y generar PDF'}
          </button>
        </div>
      </BottomSheet>

      {/* ═══ SHEET: CONSOLIDADO ═════════════════════════════════════════════════ */}
      <BottomSheet open={consolidadoOpen} onClose={() => setConsolidadoOpen(false)} height="85%">
        <div className="flex justify-center pt-3 pb-1">
          <div className="w-9 h-1 rounded-full bg-border" />
        </div>
        <div className="flex items-center justify-between px-4 pb-3">
          <h2 className="text-base text-foreground" style={{ fontWeight: 600 }}>Exportar consolidado</h2>
          <button type="button" onClick={() => setConsolidadoOpen(false)}>
            <X className="w-5 h-5 text-muted-foreground" />
          </button>
        </div>
        <div className="overflow-y-auto px-4 pb-8 space-y-4" style={{ flex: 1 }}>
          <div className="space-y-1">
            <label className="text-xs text-muted-foreground" style={{ fontWeight: 600 }}>
              {terminosSitio.singular}{' '}
              <span style={{ fontWeight: 400 }}>(opcional)</span>
            </label>
            <select
              className={fieldCls}
              value={consolidadoForm.rancho_id}
              onChange={e => setConsolidadoForm(f => ({ ...f, rancho_id: e.target.value }))}
            >
              <option value="">{terminosSitio.plural}</option>
              {ranchos.map(r => <option key={r.id} value={r.id}>{r.nombre}</option>)}
            </select>
          </div>
          <div className="flex gap-3">
            <div className="flex-1 space-y-1">
              <label className="text-xs text-muted-foreground" style={{ fontWeight: 600 }}>Desde</label>
              <input type="date" className={fieldCls}
                value={consolidadoForm.desde}
                onChange={e => setConsolidadoForm(f => ({ ...f, desde: e.target.value }))} />
            </div>
            <div className="flex-1 space-y-1">
              <label className="text-xs text-muted-foreground" style={{ fontWeight: 600 }}>Hasta</label>
              <input type="date" className={fieldCls}
                value={consolidadoForm.hasta}
                onChange={e => setConsolidadoForm(f => ({ ...f, hasta: e.target.value }))} />
            </div>
          </div>
        </div>
        <div className="px-4 pb-6 pt-3 border-t border-border">
          <button
            type="button"
            onClick={exportarConsolidado}
            disabled={exportando}
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
