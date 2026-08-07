import { useState, useMemo } from 'react'
import {
  ChevronLeft, Plus, FileDown, X, Loader2, ArrowLeftRight,
  Files, TriangleAlert, Minus,
} from 'lucide-react'
import { Link } from 'react-router'
import { BottomSheet } from '@/app/components/BottomSheet'
import { toast } from 'sonner'
import { useAuthContext } from '@/context/AuthContext'
import { useModulosContext } from '@/context/ModulosContext'
import { useRanchos } from '@/hooks/useRanchos'
import { useM40RegistrosPrefrio } from '@/hooks/useM40RegistrosPrefrio'
import { useOrganizacion } from '@/hooks/useOrganizacion'
import { supabase } from '@/lib/supabase'
import { generarEntradasSalidasPreFrioPDF } from '@/lib/pdf/m40/generarEntradasSalidasPreFrioPDF'
import { generarEntradasSalidasPreFrioConsolidadoPDF } from '@/lib/pdf/m40/generarEntradasSalidasPreFrioConsolidadoPDF'

const hoyMX = () => new Date().toLocaleDateString('en-CA', { timeZone: 'America/Mexico_City' })

function formatFecha(iso: string): string {
  try {
    return new Date(iso + 'T12:00:00').toLocaleDateString('es-MX', { day: 'numeric', month: 'short', year: 'numeric' })
  } catch { return iso }
}

function calcTiempoTotal(entrada: string, salida: string): string {
  if (!entrada || !salida) return ''
  const [eh, em] = entrada.split(':').map(Number)
  const [sh, sm] = salida.split(':').map(Number)
  let diffMin = (sh * 60 + sm) - (eh * 60 + em)
  if (diffMin < 0) diffMin += 24 * 60
  const h = Math.floor(diffMin / 60)
  const m = diffMin % 60
  return `${String(h).padStart(2, '0')}:${String(m).padStart(2, '0')}`
}

const tbl = (name: string) => (supabase as any).from(name)

interface LineaForm {
  _key: string
  cuarto_prefrio: string
  fruta: string
  presentacion: string
  num_tarimas: string
  restos: string
  entrada_hora: string
  entrada_temp: string
  salida_hora: string
  salida_temp: string
}

interface FormState {
  rancho_id: string
  fecha: string
  empresa: string
  observaciones: string
}

function nuevaLinea(): LineaForm {
  return {
    _key: Math.random().toString(36).slice(2),
    cuarto_prefrio: '', fruta: '', presentacion: '',
    num_tarimas: '', restos: '',
    entrada_hora: '', entrada_temp: '',
    salida_hora: '', salida_temp: '',
  }
}

const FORM_BASE: Omit<FormState, 'fecha'> = {
  rancho_id: '', empresa: '', observaciones: '',
}

export function EntradasSalidasPreFrio() {
  const { profile } = useAuthContext()
  const esSuperAdmin = profile?.rol === 'super_admin'
  const { terminosSitio } = useModulosContext()
  const orgId = profile?.org_id ?? null
  const { ranchos } = useRanchos()
  const { registros, loading, error, refetch } = useM40RegistrosPrefrio()
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

  function actualizarLinea<K extends keyof Omit<LineaForm, '_key'>>(key: string, field: K, value: LineaForm[K]) {
    setLineas(prev => prev.map(l => l._key === key ? { ...l, [field]: value } : l))
  }

  // Tiempo total computed per line for display
  const tiemposTotales = useMemo(() =>
    Object.fromEntries(lineas.map(l => [l._key, calcTiempoTotal(l.entrada_hora, l.salida_hora)])),
    [lineas]
  )

  async function guardar() {
    if (!orgId) return
    if (!form.rancho_id) { toast.error(`Selecciona una ${terminosSitio.singular}`); return }
    setGuardando(true)
    try {
      const { data: reg, error: eReg } = await tbl('m40_registros').insert({
        org_id: orgId,
        rancho_id: form.rancho_id,
        fecha: form.fecha,
        empresa: form.empresa.trim() || null,
        observaciones: form.observaciones.trim() || null,
      }).select('id').single()
      if (eReg) throw eReg

      const registroId = (reg as any).id as string

      const lineasFiltradas = lineas.filter(l =>
        l.cuarto_prefrio.trim() || l.fruta.trim() || l.num_tarimas
      )
      if (lineasFiltradas.length > 0) {
        const rows = lineasFiltradas.map((l, i) => ({
          registro_id: registroId,
          org_id: orgId,
          orden: i + 1,
          cuarto_prefrio: l.cuarto_prefrio.trim() || null,
          fruta: l.fruta.trim() || null,
          presentacion: l.presentacion.trim() || null,
          num_tarimas: l.num_tarimas !== '' ? parseInt(l.num_tarimas, 10) : null,
          restos: l.restos.trim() || null,
          entrada_hora: l.entrada_hora || null,
          entrada_temp: l.entrada_temp !== '' ? parseFloat(l.entrada_temp) : null,
          salida_hora: l.salida_hora || null,
          salida_temp: l.salida_temp !== '' ? parseFloat(l.salida_temp) : null,
          tiempo_total: calcTiempoTotal(l.entrada_hora, l.salida_hora) || null,
        }))
        const { error: eLineas } = await tbl('m40_lineas').insert(rows)
        if (eLineas) throw eLineas
      }

      setSheetOpen(false)
      await refetch()
      toast.success('Registro guardado')

      try {
        await generarEntradasSalidasPreFrioPDF(registroId, orgId)
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
      await generarEntradasSalidasPreFrioPDF(id, orgId)
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
      await generarEntradasSalidasPreFrioConsolidadoPDF(
        orgId,
        consolidadoForm.rancho_id || null,
        consolidadoForm.desde,
        consolidadoForm.hasta,
        instName,
        orgNombre ?? '—',
      )
      setConsolidadoOpen(false)
    } catch (e: any) {
      toast.error(e?.message ?? 'Error al exportar')
    } finally {
      setExportando(false)
    }
  }

  const fieldCls = 'w-full h-10 rounded-[0.625rem] border border-border bg-input-background px-3 text-sm'
  const inputSm = 'w-full h-9 rounded-lg border border-border bg-input-background px-2.5 text-sm'

  return (
    <div className="flex flex-col min-h-full bg-background pb-[calc(72px+34px)]">

      {/* Header */}
      <header className="bg-card border-b border-border px-4 py-3 sticky top-0 z-30">
        <div className="flex items-center gap-3">
          <Link to="/" className="p-1 -ml-1">
            <ChevronLeft className="w-5 h-5 text-foreground" />
          </Link>
          <div className="w-8 h-8 rounded-lg flex items-center justify-center flex-shrink-0"
            style={{ backgroundColor: 'var(--agro-success-fill)' }}>
            <ArrowLeftRight className="w-4 h-4" style={{ color: 'var(--agro-success-text)' }} />
          </div>
          <div className="flex-1 min-w-0">
            <h1 className="text-sm text-foreground truncate" style={{ fontWeight: 600 }}>
              Entradas y Salidas en Pre-enfriamiento
            </h1>
            <p className="text-xs text-muted-foreground">F-FRUS-PRO-04 · Por evento</p>
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
            <p className="text-xs" style={{ color: 'var(--agro-danger-text)' }}>Error al cargar registros.</p>
          </div>
        )}

        {loading ? (
          <div className="flex justify-center py-12">
            <Loader2 className="w-6 h-6 text-primary animate-spin" />
          </div>
        ) : registros.length === 0 ? (
          <div className="bg-card border border-border rounded-xl p-6 text-center">
            <ArrowLeftRight className="w-8 h-8 text-muted-foreground mx-auto mb-3" />
            <p className="text-sm text-foreground" style={{ fontWeight: 600 }}>Sin registros aún</p>
            <p className="text-xs text-muted-foreground mt-1">Crea el primer registro con el botón +</p>
          </div>
        ) : (
          registros.map(r => (
            <div key={r.id} className="bg-card border border-border rounded-xl p-4">
              <div className="flex items-start justify-between gap-2">
                <div className="flex-1 min-w-0">
                  <p className="text-sm text-foreground truncate" style={{ fontWeight: 600 }}>
                    {r.rancho_nombre}
                  </p>
                  <p className="text-xs text-muted-foreground">{formatFecha(r.fecha)}</p>
                  {r.empresa && (
                    <p className="text-xs mt-0.5" style={{ fontWeight: 600 }}>{r.empresa}</p>
                  )}
                </div>
                <button
                  onClick={() => descargarPDF(r.id)}
                  disabled={pdfLoading === r.id}
                  className="p-2 rounded-lg border border-border flex-shrink-0 disabled:opacity-50"
                >
                  {pdfLoading === r.id
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
      <div className="fixed bottom-[calc(72px+34px+16px)] left-1/2 -translate-x-1/2 w-full max-w-[390px] flex justify-end px-4 pointer-events-none z-10 md:bottom-6">
        <button
          onClick={abrirNuevo}
          className="pointer-events-auto w-14 h-14 rounded-full text-white flex items-center justify-center"
          style={{ backgroundColor: 'var(--primary)', boxShadow: '0 2px 12px rgba(43,122,181,0.35)' }}
          aria-label="Nuevo registro"
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
          <h2 className="text-base text-foreground" style={{ fontWeight: 600 }}>Nuevo registro</h2>
          <button type="button" onClick={() => { if (!guardando) setSheetOpen(false) }}>
            <X className="w-5 h-5 text-muted-foreground" />
          </button>
        </div>

        <div className="overflow-y-auto px-4 pb-6 space-y-6" style={{ flex: 1 }}>

          {/* ── Encabezado ── */}
          <section className="space-y-3">
            <p className="text-xs text-muted-foreground uppercase tracking-wide" style={{ fontWeight: 700 }}>
              Datos del registro
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
                  min={esSuperAdmin ? undefined : hoyMX()}
                  max={esSuperAdmin ? undefined : hoyMX()}
                  onChange={e => { if (esSuperAdmin) setF('fecha', e.target.value) }}
                />
              </div>
              <div className="flex-1 space-y-1">
                <label className="text-xs text-muted-foreground" style={{ fontWeight: 600 }}>Empresa</label>
                <input
                  type="text"
                  className={fieldCls}
                  placeholder="Nombre de la empresa"
                  value={form.empresa}
                  onChange={e => setF('empresa', e.target.value)}
                />
              </div>
            </div>
          </section>

          {/* ── Líneas ── */}
          <section className="space-y-3">
            <div className="flex items-center justify-between">
              <p className="text-xs text-muted-foreground uppercase tracking-wide" style={{ fontWeight: 700 }}>
                Líneas de entrada/salida
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
                <div key={l._key} className="bg-card border border-border rounded-xl p-3 space-y-2.5">
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

                  {/* Cuarto Pre-frío */}
                  <div className="space-y-1">
                    <label className="text-xs text-muted-foreground">Cuarto de pre-frío</label>
                    <input type="text" className={inputSm}
                      placeholder="Ej: Cuarto 1"
                      value={l.cuarto_prefrio}
                      onChange={e => actualizarLinea(l._key, 'cuarto_prefrio', e.target.value)} />
                  </div>

                  {/* Fruta + Presentación */}
                  <div className="grid grid-cols-2 gap-2">
                    <div className="space-y-1">
                      <label className="text-xs text-muted-foreground">Fruta</label>
                      <input type="text" className={inputSm}
                        placeholder="Ej: Zarzamora"
                        value={l.fruta}
                        onChange={e => actualizarLinea(l._key, 'fruta', e.target.value)} />
                    </div>
                    <div className="space-y-1">
                      <label className="text-xs text-muted-foreground">Presentación</label>
                      <input type="text" className={inputSm}
                        placeholder="Ej: 6 oz"
                        value={l.presentacion}
                        onChange={e => actualizarLinea(l._key, 'presentacion', e.target.value)} />
                    </div>
                  </div>

                  {/* Tarimas + Restos */}
                  <div className="grid grid-cols-2 gap-2">
                    <div className="space-y-1">
                      <label className="text-xs text-muted-foreground">N° tarimas</label>
                      <input type="number" inputMode="numeric" min="0"
                        className={inputSm} placeholder="0"
                        value={l.num_tarimas}
                        onChange={e => actualizarLinea(l._key, 'num_tarimas', e.target.value)} />
                    </div>
                    <div className="space-y-1">
                      <label className="text-xs text-muted-foreground">Restos</label>
                      <input type="text" className={inputSm}
                        placeholder="Descripción"
                        value={l.restos}
                        onChange={e => actualizarLinea(l._key, 'restos', e.target.value)} />
                    </div>
                  </div>

                  {/* Entrada */}
                  <div className="rounded-lg border border-border overflow-hidden">
                    <div className="px-3 py-1.5"
                      style={{ backgroundColor: 'var(--muted)' }}>
                      <p className="text-xs text-muted-foreground" style={{ fontWeight: 600 }}>Entrada</p>
                    </div>
                    <div className="grid grid-cols-2 gap-2 p-2">
                      <div className="space-y-1">
                        <label className="text-xs text-muted-foreground">Hora</label>
                        <input type="time" className={inputSm}
                          value={l.entrada_hora}
                          onChange={e => actualizarLinea(l._key, 'entrada_hora', e.target.value)} />
                      </div>
                      <div className="space-y-1">
                        <label className="text-xs text-muted-foreground">Temp (°C)</label>
                        <input type="number" inputMode="decimal" step="0.1"
                          className={inputSm} placeholder="—"
                          value={l.entrada_temp}
                          onChange={e => actualizarLinea(l._key, 'entrada_temp', e.target.value)} />
                      </div>
                    </div>
                  </div>

                  {/* Salida */}
                  <div className="rounded-lg border border-border overflow-hidden">
                    <div className="px-3 py-1.5"
                      style={{ backgroundColor: 'var(--muted)' }}>
                      <p className="text-xs text-muted-foreground" style={{ fontWeight: 600 }}>Salida</p>
                    </div>
                    <div className="grid grid-cols-2 gap-2 p-2">
                      <div className="space-y-1">
                        <label className="text-xs text-muted-foreground">Hora</label>
                        <input type="time" className={inputSm}
                          value={l.salida_hora}
                          onChange={e => actualizarLinea(l._key, 'salida_hora', e.target.value)} />
                      </div>
                      <div className="space-y-1">
                        <label className="text-xs text-muted-foreground">Temp (°C)</label>
                        <input type="number" inputMode="decimal" step="0.1"
                          className={inputSm} placeholder="—"
                          value={l.salida_temp}
                          onChange={e => actualizarLinea(l._key, 'salida_temp', e.target.value)} />
                      </div>
                    </div>
                  </div>

                  {/* Tiempo total calculado */}
                  {tiemposTotales[l._key] && (
                    <div className="flex items-center gap-2 px-2 py-1.5 rounded-lg"
                      style={{ backgroundColor: 'var(--agro-success-fill)' }}>
                      <span className="text-xs" style={{ color: 'var(--agro-success-text)' }}>
                        Tiempo total:
                      </span>
                      <span className="text-xs" style={{ color: 'var(--agro-success-text)', fontWeight: 700 }}>
                        {tiemposTotales[l._key]} h
                      </span>
                    </div>
                  )}
                </div>
              ))}
            </div>
          </section>

          {/* ── Observaciones ── */}
          <section className="space-y-2">
            <p className="text-xs text-muted-foreground uppercase tracking-wide" style={{ fontWeight: 700 }}>
              Observaciones
            </p>
            <textarea
              value={form.observaciones}
              onChange={e => setF('observaciones', e.target.value)}
              rows={2}
              placeholder="Observaciones generales del registro..."
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
