import { useState, useMemo } from 'react'
import {
  ChevronLeft, Plus, FileDown, X, Loader2, PackageOpen,
  Files, TriangleAlert, Minus,
} from 'lucide-react'
import { Link } from 'react-router'
import { BottomSheet } from '@/app/components/BottomSheet'
import { toast } from 'sonner'
import { useAuthContext } from '@/context/AuthContext'
import { codigoFormato } from '@/lib/codigoFormato'
import { useModulosContext } from '@/context/ModulosContext'
import { useRanchos } from '@/hooks/useRanchos'
import { useM39Recepciones } from '@/hooks/useM39Recepciones'
import { useOrganizacion } from '@/hooks/useOrganizacion'
import { supabase } from '@/lib/supabase'
import { generarRecepcionFrutaPDF } from '@/lib/pdf/m39/generarRecepcionFrutaPDF'
import { generarRecepcionFrutaConsolidadoPDF } from '@/lib/pdf/m39/generarRecepcionFrutaConsolidadoPDF'

const hoyMX = () => new Date().toLocaleDateString('en-CA', { timeZone: 'America/Mexico_City' })

function formatFecha(iso: string): string {
  try {
    return new Date(iso + 'T12:00:00').toLocaleDateString('es-MX', { day: 'numeric', month: 'short', year: 'numeric' })
  } catch { return iso }
}

const tbl = (name: string) => (supabase as any).from(name)

type Tipo = 'organico' | 'convencional'

interface LineaForm {
  _key: string
  hora: string
  // Cuarto frío fields
  codigo_productor: string
  tipo: Tipo
  pase_anden: boolean
  producto: string
  cant_6oz: string
  cant_12oz: string
  cant_18oz: string
  // Almacén fields
  cultivo: string
  cajas: string
  piezas: string
  entrega: string
  limp_be: boolean | null
  limp_l: boolean | null
  limp_lp: boolean | null
  codigo_trazabilidad: string
}

interface FormState {
  rancho_id: string
  fecha: string
  empresa: string
  hoja_no: string
  observaciones: string
}

function nuevaLinea(): LineaForm {
  return {
    _key: Math.random().toString(36).slice(2),
    hora: '', codigo_productor: '', tipo: 'convencional',
    pase_anden: false, producto: '',
    cant_6oz: '', cant_12oz: '', cant_18oz: '',
    cultivo: '', cajas: '', piezas: '', entrega: '',
    limp_be: null, limp_l: null, limp_lp: null,
    codigo_trazabilidad: '',
  }
}

const FORM_BASE: Omit<FormState, 'fecha'> = {
  rancho_id: '', empresa: '', hoja_no: '', observaciones: '',
}

// ── Toggle components ─────────────────────────────────────────────────────────

function ToggleTipo({ value, onChange }: { value: Tipo; onChange: (v: Tipo) => void }) {
  return (
    <div className="flex gap-1.5">
      {(['organico', 'convencional'] as Tipo[]).map(v => (
        <button
          key={v}
          type="button"
          onClick={() => onChange(v)}
          style={{
            flex: 1, height: 30, borderRadius: 8, cursor: 'pointer',
            border: value === v ? 'none' : '1px solid var(--border)',
            backgroundColor: value === v
              ? v === 'organico' ? 'var(--agro-success-fill)' : 'var(--agro-warning-fill)'
              : 'var(--card)',
            color: value === v
              ? v === 'organico' ? 'var(--agro-success-text)' : 'var(--agro-warning-text)'
              : 'var(--muted-foreground)',
            fontSize: 12, fontWeight: value === v ? 700 : 400,
          }}
        >
          {v === 'organico' ? 'Orgánico' : 'Convencional'}
        </button>
      ))}
    </div>
  )
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

function ToggleTriEstado({ value, onChange }: { value: boolean | null; onChange: (v: boolean | null) => void }) {
  return (
    <div className="flex gap-1">
      {([null, true, false] as const).map(v => {
        const active = value === v
        let bg = 'var(--card)', color = 'var(--muted-foreground)', border = '1px solid var(--border)'
        if (active && v === null) { bg = 'var(--muted)'; color = 'var(--muted-foreground)'; border = 'none' }
        if (active && v === true) { bg = 'var(--agro-success-fill)'; color = 'var(--agro-success-text)'; border = 'none' }
        if (active && v === false) { bg = 'var(--agro-danger-fill)'; color = 'var(--agro-danger-text)'; border = 'none' }
        return (
          <button
            key={String(v)}
            type="button"
            onClick={() => onChange(v)}
            style={{
              flex: 1, height: 28, borderRadius: 8, cursor: 'pointer',
              border, backgroundColor: bg, color,
              fontSize: 11, fontWeight: active ? 700 : 400,
            }}
          >
            {v === null ? '—' : v ? 'Si' : 'No'}
          </button>
        )
      })}
    </div>
  )
}

// ── Screen ────────────────────────────────────────────────────────────────────

export function RecepcionFruta() {
  const { profile, codigoClave } = useAuthContext()
  const esSuperAdmin = profile?.rol === 'super_admin'
  const { terminosSitio, modulos } = useModulosContext()
  const orgId = profile?.org_id ?? null
  const { ranchos } = useRanchos()
  const { recepciones, loading, error, refetch } = useM39Recepciones()
  const orgNombre = useOrganizacion(orgId)

  // Almacén sector → simplified variant; cuarto frío → original
  const esAlmacen = modulos.some(m => m.sector_clave === 'almacen')

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

  // Totals for cuarto frío
  const totalesCF = useMemo(() => {
    if (esAlmacen) return { t6: 0, t12: 0, t18: 0, a6: 0, a12: 0, a18: 0 }
    const p = (s: string) => parseInt(s, 10) || 0
    const t6  = lineas.reduce((s, l) => s + p(l.cant_6oz), 0)
    const t12 = lineas.reduce((s, l) => s + p(l.cant_12oz), 0)
    const t18 = lineas.reduce((s, l) => s + p(l.cant_18oz), 0)
    const a6  = lineas.filter(l => l.pase_anden).reduce((s, l) => s + p(l.cant_6oz), 0)
    const a12 = lineas.filter(l => l.pase_anden).reduce((s, l) => s + p(l.cant_12oz), 0)
    const a18 = lineas.filter(l => l.pase_anden).reduce((s, l) => s + p(l.cant_18oz), 0)
    return { t6, t12, t18, a6, a12, a18 }
  }, [esAlmacen, lineas])

  // Inventory by cultivo for almacén
  const invCultivoForm = useMemo(() => {
    if (!esAlmacen) return null
    const p = (s: string) => parseInt(s, 10) || 0
    const map: Record<string, { cajas: number; piezas: number }> = {}
    for (const l of lineas) {
      const k = l.cultivo.trim() || 'Sin cultivo'
      if (!map[k]) map[k] = { cajas: 0, piezas: 0 }
      map[k].cajas += p(l.cajas)
      map[k].piezas += p(l.piezas)
    }
    return map
  }, [esAlmacen, lineas])

  async function guardar() {
    if (!orgId) return
    if (!form.rancho_id) { toast.error(`Selecciona una ${terminosSitio.singular}`); return }
    if (esAlmacen && !form.empresa.trim()) { toast.error('Indica la empresa proveedora (requerida para trazabilidad)'); return }
    setGuardando(true)
    try {
      const recepcionPayload: any = {
        org_id: orgId,
        rancho_id: form.rancho_id,
        fecha: form.fecha,
        empresa: form.empresa.trim() || null,
        observaciones: form.observaciones.trim() || null,
      }
      // almacén: always set hoja_no (even empty string) so detection works
      if (esAlmacen) {
        recepcionPayload.hoja_no = form.hoja_no.trim() || ''
      }

      const { data: rec, error: eRec } = await tbl('m39_recepciones')
        .insert(recepcionPayload)
        .select('id')
        .single()
      if (eRec) throw eRec

      const recepcionId = (rec as any).id as string

      if (esAlmacen) {
        const lineasFiltradas = lineas.filter(l =>
          l.cultivo.trim() || l.cajas || l.piezas || l.entrega.trim()
        )
        if (lineasFiltradas.length > 0) {
          // Cada línea = una llegada física = un LR en M48 (fuente única de numeración)
          // Se insertan de forma secuencial para que el trigger de consecutivo no colisione
          const lrIds: string[] = []
          const rows: any[] = []
          try {
            for (let i = 0; i < lineasFiltradas.length; i++) {
              const l = lineasFiltradas[i]
              const partes = [
                l.limp_be !== null ? `BE:${l.limp_be ? 'Si' : 'No'}` : null,
                l.limp_l  !== null ? `L:${l.limp_l  ? 'Si' : 'No'}` : null,
                l.limp_lp !== null ? `LP:${l.limp_lp ? 'Si' : 'No'}` : null,
              ].filter(Boolean)
              const { data: lrData, error: lrErr } = await tbl('m48_lotes_recepcion')
                .insert({
                  org_id: orgId,
                  rancho_id: form.rancho_id,
                  fecha: form.fecha,
                  hora: l.hora || null,
                  proveedor_nombre: form.empresa.trim(),
                  proveedor_origen: null,
                  proveedor_codigo: 'P000',
                  cantidad: l.cajas !== '' ? parseInt(l.cajas, 10) : null,
                  unidad: l.cajas !== '' ? 'cajas' : null,
                  condicion_vehiculo: partes.length > 0 ? partes.join(' ') : null,
                  resultado: l.limp_lp === false ? 'rechazado' : 'aceptado',
                  responsable: null,
                  observaciones: form.observaciones.trim() || null,
                })
                .select('id, codigo')
                .single()
              if (lrErr) throw lrErr
              lrIds.push(lrData.id)
              rows.push({
                recepcion_id: recepcionId,
                org_id: orgId,
                orden: i + 1,
                hora: l.hora || null,
                cultivo: l.cultivo.trim() || null,
                cajas: l.cajas !== '' ? parseInt(l.cajas, 10) : null,
                piezas: l.piezas !== '' ? parseInt(l.piezas, 10) : null,
                entrega: l.entrega.trim() || null,
                limp_be: l.limp_be,
                limp_l: l.limp_l,
                limp_lp: l.limp_lp,
                lr_id: lrData.id,
                codigo_trazabilidad: lrData.codigo,
              })
            }
            const { error: eLineas } = await tbl('m39_lineas').insert(rows)
            if (eLineas) throw eLineas
          } catch (e) {
            // Rollback: eliminar LRs creados y la recepcion para no dejar huerfanos
            if (lrIds.length > 0) await tbl('m48_lotes_recepcion').delete().in('id', lrIds)
            await tbl('m39_recepciones').delete().eq('id', recepcionId)
            throw e
          }
        }
      } else {
        const lineasFiltradas = lineas.filter(l =>
          l.producto.trim() || l.codigo_productor.trim() || l.cant_6oz || l.cant_12oz || l.cant_18oz
        )
        if (lineasFiltradas.length > 0) {
          const rows = lineasFiltradas.map((l, i) => ({
            recepcion_id: recepcionId,
            org_id: orgId,
            orden: i + 1,
            hora: l.hora || null,
            codigo_productor: l.codigo_productor.trim() || null,
            tipo: l.tipo,
            pase_anden: l.pase_anden,
            producto: l.producto.trim() || null,
            cant_6oz:  l.cant_6oz  !== '' ? parseInt(l.cant_6oz,  10) : null,
            cant_12oz: l.cant_12oz !== '' ? parseInt(l.cant_12oz, 10) : null,
            cant_18oz: l.cant_18oz !== '' ? parseInt(l.cant_18oz, 10) : null,
          }))
          const { error: eLineas } = await tbl('m39_lineas').insert(rows)
          if (eLineas) throw eLineas
        }
      }

      setSheetOpen(false)
      await refetch()
      toast.success('Recepción registrada')

      try {
        await generarRecepcionFrutaPDF(recepcionId, orgId, codigoClave)
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
      await generarRecepcionFrutaPDF(id, orgId, codigoClave)
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
      await generarRecepcionFrutaConsolidadoPDF(
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
            <PackageOpen className="w-4 h-4" style={{ color: 'var(--agro-success-text)' }} />
          </div>
          <div className="flex-1 min-w-0">
            <h1 className="text-sm text-foreground truncate" style={{ fontWeight: 600 }}>
              Recepción Diaria de Fruta
            </h1>
            <p className="text-xs text-muted-foreground">{codigoFormato('F-FRUS-PRO-02', codigoClave)} · Por evento</p>
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
            <p className="text-xs" style={{ color: 'var(--agro-danger-text)' }}>Error al cargar recepciones.</p>
          </div>
        )}

        {loading ? (
          <div className="flex justify-center py-12">
            <Loader2 className="w-6 h-6 text-primary animate-spin" />
          </div>
        ) : recepciones.length === 0 ? (
          <div className="bg-card border border-border rounded-xl p-6 text-center">
            <PackageOpen className="w-8 h-8 text-muted-foreground mx-auto mb-3" />
            <p className="text-sm text-foreground" style={{ fontWeight: 600 }}>Sin recepciones aún</p>
            <p className="text-xs text-muted-foreground mt-1">Crea la primera recepción con el botón +</p>
          </div>
        ) : (
          recepciones.map(r => {
            const esAL = r.hoja_no !== null
            return (
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
                    {r.hoja_no && (
                      <p className="text-xs text-muted-foreground mt-0.5">Hoja No.: {r.hoja_no}</p>
                    )}
                    <div className="flex items-center gap-3 mt-1.5 flex-wrap">
                      {esAL ? (
                        <>
                          <span className="text-xs px-2 py-0.5 rounded-full"
                            style={{ backgroundColor: 'var(--agro-success-fill)', color: 'var(--agro-success-text)', fontWeight: 600 }}>
                            {r.total_cajas} cajas · {r.total_piezas} piezas
                          </span>
                        </>
                      ) : (
                        <>
                          <span className="text-xs px-2 py-0.5 rounded-full"
                            style={{ backgroundColor: 'var(--agro-success-fill)', color: 'var(--agro-success-text)', fontWeight: 600 }}>
                            {r.total_6oz + r.total_12oz + r.total_18oz} cajas totales
                          </span>
                          {(r.total_6oz > 0 || r.total_12oz > 0 || r.total_18oz > 0) && (
                            <span className="text-xs text-muted-foreground">
                              {r.total_6oz} · {r.total_12oz} · {r.total_18oz} (6/12/18 oz)
                            </span>
                          )}
                        </>
                      )}
                    </div>
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
          aria-label="Nueva recepción"
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
          <h2 className="text-base text-foreground" style={{ fontWeight: 600 }}>Nueva recepción</h2>
          <button type="button" onClick={() => { if (!guardando) setSheetOpen(false) }}>
            <X className="w-5 h-5 text-muted-foreground" />
          </button>
        </div>

        <div className="overflow-y-auto px-4 pb-6 space-y-6" style={{ flex: 1 }}>

          {/* ── Encabezado ── */}
          <section className="space-y-3">
            <p className="text-xs text-muted-foreground uppercase tracking-wide" style={{ fontWeight: 700 }}>
              Datos de la recepción
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
                <label className="text-xs text-muted-foreground" style={{ fontWeight: 600 }}>{esAlmacen ? 'Empresa *' : 'Empresa'}</label>
                <input
                  type="text"
                  className={fieldCls}
                  placeholder="Nombre de la empresa"
                  value={form.empresa}
                  onChange={e => setF('empresa', e.target.value)}
                />
              </div>
            </div>

            {esAlmacen && (
              <div className="space-y-1">
                <label className="text-xs text-muted-foreground" style={{ fontWeight: 600 }}>Hoja No.</label>
                <input
                  type="text"
                  className={fieldCls}
                  placeholder="Ej: 001"
                  value={form.hoja_no}
                  onChange={e => setF('hoja_no', e.target.value)}
                />
              </div>
            )}
          </section>

          {/* ── Líneas de recepción ── */}
          <section className="space-y-3">
            <div className="flex items-center justify-between">
              <p className="text-xs text-muted-foreground uppercase tracking-wide" style={{ fontWeight: 700 }}>
                Líneas de recepción
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

                  {esAlmacen ? (
                    /* ── Almacén line fields ── */
                    <>
                      <div className="grid grid-cols-2 gap-2">
                        <div className="space-y-1">
                          <label className="text-xs text-muted-foreground">Hora</label>
                          <input
                            type="time"
                            className="w-full h-9 rounded-lg border border-border bg-input-background px-2.5 text-sm"
                            value={l.hora}
                            onChange={e => actualizarLinea(l._key, 'hora', e.target.value)}
                          />
                        </div>
                        <div className="space-y-1">
                          <label className="text-xs text-muted-foreground">Cultivo</label>
                          <input
                            type="text"
                            className="w-full h-9 rounded-lg border border-border bg-input-background px-2.5 text-sm"
                            placeholder="Ej: Zarzamora"
                            value={l.cultivo}
                            onChange={e => actualizarLinea(l._key, 'cultivo', e.target.value)}
                          />
                        </div>
                      </div>

                      <div className="grid grid-cols-2 gap-2">
                        <div className="space-y-1">
                          <label className="text-xs text-muted-foreground">Cajas</label>
                          <input
                            type="number"
                            inputMode="numeric"
                            min="0"
                            placeholder="0"
                            className="w-full h-9 rounded-lg border border-border bg-input-background px-2 text-sm text-center"
                            value={l.cajas}
                            onChange={e => actualizarLinea(l._key, 'cajas', e.target.value)}
                          />
                        </div>
                        <div className="space-y-1">
                          <label className="text-xs text-muted-foreground">Piezas</label>
                          <input
                            type="number"
                            inputMode="numeric"
                            min="0"
                            placeholder="0"
                            className="w-full h-9 rounded-lg border border-border bg-input-background px-2 text-sm text-center"
                            value={l.piezas}
                            onChange={e => actualizarLinea(l._key, 'piezas', e.target.value)}
                          />
                        </div>
                      </div>

                      <div className="space-y-1">
                        <label className="text-xs text-muted-foreground">Entrega</label>
                        <input
                          type="text"
                          className="w-full h-9 rounded-lg border border-border bg-input-background px-2.5 text-sm"
                          placeholder="Nombre o referencia de entrega"
                          value={l.entrega}
                          onChange={e => actualizarLinea(l._key, 'entrega', e.target.value)}
                        />
                      </div>

                      <div className="grid grid-cols-3 gap-2">
                        <div className="space-y-1">
                          <label className="text-xs text-muted-foreground">Limp. BE</label>
                          <ToggleTriEstado value={l.limp_be} onChange={v => actualizarLinea(l._key, 'limp_be', v)} />
                        </div>
                        <div className="space-y-1">
                          <label className="text-xs text-muted-foreground">Limp. L</label>
                          <ToggleTriEstado value={l.limp_l} onChange={v => actualizarLinea(l._key, 'limp_l', v)} />
                        </div>
                        <div className="space-y-1">
                          <label className="text-xs text-muted-foreground">Limp. LP</label>
                          <ToggleTriEstado value={l.limp_lp} onChange={v => actualizarLinea(l._key, 'limp_lp', v)} />
                        </div>
                      </div>

                      <div className="space-y-1">
                        <label className="text-xs text-muted-foreground">Cód. Trazabilidad</label>
                        <div
                          className="w-full h-9 rounded-lg border border-border px-2.5 text-sm flex items-center font-mono"
                          style={{ background: 'var(--muted)', color: 'var(--muted-foreground)' }}
                        >
                          Se genera al guardar
                        </div>
                      </div>
                    </>
                  ) : (
                    /* ── Cuarto frío line fields (unchanged) ── */
                    <>
                      <div className="grid grid-cols-2 gap-2">
                        <div className="space-y-1">
                          <label className="text-xs text-muted-foreground">Hora</label>
                          <input
                            type="time"
                            className="w-full h-9 rounded-lg border border-border bg-input-background px-2.5 text-sm"
                            value={l.hora}
                            onChange={e => actualizarLinea(l._key, 'hora', e.target.value)}
                          />
                        </div>
                        <div className="space-y-1">
                          <label className="text-xs text-muted-foreground">Cód. Productor</label>
                          <input
                            type="text"
                            className="w-full h-9 rounded-lg border border-border bg-input-background px-2.5 text-sm"
                            placeholder="Ej: P-001"
                            value={l.codigo_productor}
                            onChange={e => actualizarLinea(l._key, 'codigo_productor', e.target.value)}
                          />
                        </div>
                      </div>

                      <div className="space-y-1">
                        <label className="text-xs text-muted-foreground">Tipo</label>
                        <ToggleTipo value={l.tipo} onChange={v => actualizarLinea(l._key, 'tipo', v)} />
                      </div>

                      <div className="space-y-1">
                        <label className="text-xs text-muted-foreground">Pase de andén</label>
                        <ToggleSiNo value={l.pase_anden} onChange={v => actualizarLinea(l._key, 'pase_anden', v)} />
                      </div>

                      <div className="space-y-1">
                        <label className="text-xs text-muted-foreground">Producto</label>
                        <input
                          type="text"
                          className="w-full h-9 rounded-lg border border-border bg-input-background px-2.5 text-sm"
                          placeholder="Nombre del producto"
                          value={l.producto}
                          onChange={e => actualizarLinea(l._key, 'producto', e.target.value)}
                        />
                      </div>

                      <div className="grid grid-cols-3 gap-2">
                        {([
                          { label: '6 oz',  key: 'cant_6oz'  as const },
                          { label: '12 oz', key: 'cant_12oz' as const },
                          { label: '18 oz', key: 'cant_18oz' as const },
                        ] as const).map(({ label, key }) => (
                          <div key={key} className="space-y-1">
                            <label className="text-xs text-muted-foreground">{label}</label>
                            <input
                              type="number"
                              inputMode="numeric"
                              min="0"
                              placeholder="0"
                              className="w-full h-9 rounded-lg border border-border bg-input-background px-2 text-sm text-center"
                              value={l[key]}
                              onChange={e => actualizarLinea(l._key, key, e.target.value)}
                            />
                          </div>
                        ))}
                      </div>
                    </>
                  )}
                </div>
              ))}
            </div>

            {/* Totales — cuarto frío */}
            {!esAlmacen && (totalesCF.t6 + totalesCF.t12 + totalesCF.t18) > 0 && (
              <div className="space-y-2">
                <div className="rounded-xl p-3 space-y-1.5"
                  style={{ backgroundColor: 'var(--agro-success-fill)' }}>
                  <p className="text-xs" style={{ fontWeight: 700, color: 'var(--agro-success-text)' }}>
                    Total recepción del día
                  </p>
                  <div className="flex gap-4">
                    {([['6 oz', totalesCF.t6], ['12 oz', totalesCF.t12], ['18 oz', totalesCF.t18]] as const).map(([lbl, val]) => (
                      <div key={lbl} className="flex items-center gap-1">
                        <span className="text-xs" style={{ color: 'var(--agro-success-text)' }}>{lbl}:</span>
                        <span className="text-xs" style={{ color: 'var(--agro-success-text)', fontWeight: 700 }}>{val}</span>
                      </div>
                    ))}
                  </div>
                </div>

                {(totalesCF.a6 + totalesCF.a12 + totalesCF.a18) > 0 && (
                  <div className="rounded-xl p-3 space-y-1.5"
                    style={{ backgroundColor: 'var(--agro-warning-fill)' }}>
                    <p className="text-xs" style={{ fontWeight: 700, color: 'var(--agro-warning-text)' }}>
                      Total pase aduanal
                    </p>
                    <div className="flex gap-4">
                      {([['6 oz', totalesCF.a6], ['12 oz', totalesCF.a12], ['18 oz', totalesCF.a18]] as const).map(([lbl, val]) => (
                        <div key={lbl} className="flex items-center gap-1">
                          <span className="text-xs" style={{ color: 'var(--agro-warning-text)' }}>{lbl}:</span>
                          <span className="text-xs" style={{ color: 'var(--agro-warning-text)', fontWeight: 700 }}>{val}</span>
                        </div>
                      ))}
                    </div>
                  </div>
                )}
              </div>
            )}

            {/* Totales — almacén: inventario por cultivo */}
            {esAlmacen && invCultivoForm && Object.values(invCultivoForm).some(v => v.cajas > 0 || v.piezas > 0) && (
              <div className="rounded-xl p-3 space-y-2"
                style={{ backgroundColor: 'var(--agro-success-fill)' }}>
                <p className="text-xs" style={{ fontWeight: 700, color: 'var(--agro-success-text)' }}>
                  Inventario por cultivo
                </p>
                {Object.entries(invCultivoForm).map(([cultivo, tot]) => (
                  <div key={cultivo} className="flex items-center justify-between">
                    <span className="text-xs" style={{ color: 'var(--agro-success-text)' }}>{cultivo}</span>
                    <span className="text-xs" style={{ color: 'var(--agro-success-text)', fontWeight: 700 }}>
                      {tot.cajas} cajas · {tot.piezas} piezas
                    </span>
                  </div>
                ))}
              </div>
            )}
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
              placeholder="Observaciones generales de la recepción..."
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
