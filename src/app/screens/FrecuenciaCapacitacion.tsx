import { useState } from 'react'
import { ChevronLeft, GraduationCap, FileDown, Plus, X, Loader2, Pencil } from 'lucide-react'
import { useNavigate } from 'react-router'
import { toast } from 'sonner'
import { BottomSheet } from '@/app/components/BottomSheet'
import { useAuthContext } from '@/context/AuthContext'
import { useOrganizacion } from '@/hooks/useOrganizacion'
import { useM56FrecuenciaCapacitacion } from '@/hooks/useM56FrecuenciaCapacitacion'
import { supabase } from '@/lib/supabase'
import { generarFrecuenciaCapacitacionPDF } from '@/lib/pdf/m56/generarFrecuenciaCapacitacionPDF'

const MESES = ['Enero','Febrero','Marzo','Abril','Mayo','Junio','Julio','Agosto','Septiembre','Octubre','Noviembre','Diciembre']
const ANIO_ACTUAL = new Date().getFullYear()

type FormState = {
  tema: string
  anio: number
  mes: number
  capacitador: string
  realizado: boolean
  observaciones: string
}

const FORM_VACIO: FormState = {
  tema: '',
  anio: ANIO_ACTUAL,
  mes: 1,
  capacitador: '',
  realizado: false,
  observaciones: '',
}

export function FrecuenciaCapacitacion() {
  const navigate = useNavigate()
  const { profile, user } = useAuthContext()
  const orgId = profile?.org_id ?? null
  const esAdmin = profile?.rol === 'admin_org' || profile?.rol === 'super_admin'
  const orgNombre = useOrganizacion(orgId)
  const { registros, loading, error, refetch } = useM56FrecuenciaCapacitacion(orgId)

  const [sheetOpen, setSheetOpen] = useState(false)
  const [editId, setEditId] = useState<string | null>(null)
  const [form, setForm] = useState<FormState>(FORM_VACIO)
  const [guardando, setGuardando] = useState(false)
  const [pdfLoading, setPdfLoading] = useState(false)
  const [anioFiltro, setAnioFiltro] = useState<number>(ANIO_ACTUAL)
  const [soloActivos, setSoloActivos] = useState(true)

  const aniosDisponibles = [...new Set([ANIO_ACTUAL, ...registros.map(r => r.anio)])].sort((a, b) => b - a)

  const registrosFiltrados = registros.filter(r => {
    if (soloActivos && !r.activo) return false
    if (r.anio !== anioFiltro) return false
    return true
  })

  function abrirNuevo() {
    setEditId(null)
    setForm(FORM_VACIO)
    setSheetOpen(true)
  }

  function abrirEdicion(r: typeof registros[number]) {
    setEditId(r.id)
    setForm({
      tema: r.tema,
      anio: r.anio,
      mes: r.mes,
      capacitador: r.capacitador ?? '',
      realizado: r.realizado,
      observaciones: r.observaciones ?? '',
    })
    setSheetOpen(true)
  }

  async function guardar() {
    if (!orgId) return
    if (!form.tema.trim()) { toast.error('El tema es requerido'); return }

    setGuardando(true)
    try {
      if (editId === null) {
        const { error: err } = await (supabase as any)
          .from('m56_frecuencia_capacitacion')
          .insert({
            org_id: orgId,
            creado_por: user?.id,
            tema: form.tema.trim(),
            anio: form.anio,
            mes: form.mes,
            capacitador: form.capacitador.trim() || null,
            realizado: form.realizado,
            observaciones: form.observaciones.trim() || null,
            activo: true,
          })
        if (err) throw err
        toast.success('Registro agregado')
      } else {
        const { error: err } = await (supabase as any)
          .from('m56_frecuencia_capacitacion')
          .update({
            tema: form.tema.trim(),
            anio: form.anio,
            mes: form.mes,
            capacitador: form.capacitador.trim() || null,
            realizado: form.realizado,
            observaciones: form.observaciones.trim() || null,
          })
          .eq('id', editId)
        if (err) throw err
        toast.success('Registro actualizado')
      }
      setSheetOpen(false)
      await refetch()
    } catch (e: any) {
      toast.error(e?.message ?? 'Error al guardar')
    } finally {
      setGuardando(false)
    }
  }

  async function desactivar() {
    if (!editId) return
    setGuardando(true)
    try {
      const { error: err } = await (supabase as any)
        .from('m56_frecuencia_capacitacion')
        .update({ activo: false })
        .eq('id', editId)
      if (err) throw err
      toast.success('Registro desactivado')
      setSheetOpen(false)
      await refetch()
    } catch (e: any) {
      toast.error(e?.message ?? 'Error al desactivar')
    } finally {
      setGuardando(false)
    }
  }

  async function exportarPDF() {
    if (!orgId) return
    setPdfLoading(true)
    try {
      await generarFrecuenciaCapacitacionPDF(orgId, orgNombre ?? '', anioFiltro)
    } catch (e: any) {
      toast.error(e?.message ?? 'Error al generar PDF')
    } finally {
      setPdfLoading(false)
    }
  }

  return (
    <div className="flex flex-col h-full bg-background">
      <div className="flex items-center gap-3 px-4 pt-12 pb-4">
        <button onClick={() => navigate(-1)} className="p-1 -ml-1">
          <ChevronLeft className="w-5 h-5" />
        </button>
        <div className="flex-1">
          <h1 className="text-lg font-semibold leading-tight">Frecuencia de Capacitación</h1>
          <p className="text-xs text-muted-foreground">M56 · Org-level</p>
        </div>
        <button
          onClick={exportarPDF}
          disabled={pdfLoading}
          className="p-2 rounded-lg border border-border"
        >
          {pdfLoading
            ? <Loader2 className="w-4 h-4 animate-spin" style={{ color: 'var(--primary)' }} />
            : <FileDown className="w-4 h-4" style={{ color: 'var(--primary)' }} />
          }
        </button>
        <GraduationCap className="w-5 h-5 text-muted-foreground" />
      </div>

      <div className="px-4 mb-3 space-y-3">
        <div className="flex items-center gap-2 flex-wrap">
          {aniosDisponibles.map(a => (
            <button
              key={a}
              onClick={() => setAnioFiltro(a)}
              className="text-xs font-semibold px-3 py-1.5 rounded-lg border transition-colors"
              style={anioFiltro === a
                ? { backgroundColor: 'var(--primary)', color: '#fff', borderColor: 'var(--primary)' }
                : { backgroundColor: 'var(--input-background)', color: 'var(--muted-foreground)', borderColor: 'var(--border)' }
              }
            >
              {a}
            </button>
          ))}
        </div>
        <button
          onClick={() => setSoloActivos(v => !v)}
          className="text-xs font-semibold px-3 py-1.5 rounded-lg border transition-colors"
          style={soloActivos
            ? { backgroundColor: 'var(--primary)', color: '#fff', borderColor: 'var(--primary)' }
            : { backgroundColor: 'var(--input-background)', color: 'var(--muted-foreground)', borderColor: 'var(--border)' }
          }
        >
          Solo activos
        </button>
      </div>

      <div className="flex-1 px-4 pb-32 space-y-2 overflow-y-auto">
        {loading && (
          <div className="flex items-center justify-center py-12">
            <Loader2 className="w-5 h-5 animate-spin text-muted-foreground" />
          </div>
        )}
        {error && (
          <p className="text-center py-12 text-sm" style={{ color: 'var(--agro-danger-text)' }}>{error}</p>
        )}
        {!loading && !error && registrosFiltrados.length === 0 && (
          <p className="text-center py-12 text-muted-foreground text-sm">
            Sin registros para {anioFiltro}.
          </p>
        )}
        {registrosFiltrados.map(r => (
          <div key={r.id} className="bg-card border border-border rounded-[0.625rem] p-4">
            <div className="flex items-start justify-between gap-2">
              <div className="flex-1 min-w-0">
                <p className="text-sm font-semibold leading-snug">{r.tema}</p>
                <p className="text-xs text-muted-foreground mt-0.5">{MESES[(r.mes - 1)]} {r.anio}{r.capacitador ? ` · ${r.capacitador}` : ''}</p>
              </div>
              <div className="flex items-center gap-2 shrink-0">
                <span
                  className="text-xs font-semibold px-2 py-0.5 rounded-full"
                  style={r.realizado
                    ? { backgroundColor: 'var(--agro-success-fill)', color: 'var(--agro-success-text)' }
                    : { backgroundColor: 'var(--muted)', color: 'var(--muted-foreground)' }
                  }
                >
                  {r.realizado ? 'Realizado' : 'Pendiente'}
                </span>
                {esAdmin && (
                  <button
                    onClick={() => abrirEdicion(r)}
                    className="p-1.5 rounded-lg border border-border"
                  >
                    <Pencil className="w-3.5 h-3.5 text-muted-foreground" />
                  </button>
                )}
              </div>
            </div>
            {r.observaciones && (
              <p className="text-xs text-muted-foreground mt-2 leading-snug">{r.observaciones}</p>
            )}
          </div>
        ))}
      </div>

      {esAdmin && (
        <div className="fixed bottom-20 right-4 z-50">
          <button
            onClick={abrirNuevo}
            className="w-14 h-14 rounded-full text-white flex items-center justify-center active:scale-95 transition-transform"
            style={{ backgroundColor: 'var(--primary)' }}
            aria-label="Nuevo registro"
          >
            <Plus className="w-6 h-6" />
          </button>
        </div>
      )}

      <BottomSheet open={sheetOpen} onClose={() => setSheetOpen(false)} height="85%">
        <div className="flex items-center justify-between px-4 pt-4 pb-3 border-b border-border">
          <h2 className="text-base font-semibold">
            {editId ? 'Editar registro' : 'Nuevo registro'}
          </h2>
          <button onClick={() => setSheetOpen(false)}>
            <X className="w-5 h-5" />
          </button>
        </div>
        <div className="overflow-y-auto flex-1 px-4 pt-4 pb-8 space-y-4">

          <div>
            <label className="block text-xs font-medium mb-1">Tema</label>
            <input
              type="text"
              className="w-full h-10 rounded-[0.625rem] border border-border bg-input-background px-3 text-sm"
              placeholder="Ej. Higiene personal, BPA..."
              value={form.tema}
              onChange={e => setForm(f => ({ ...f, tema: e.target.value }))}
            />
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-xs font-medium mb-1">Año</label>
              <select
                className="w-full h-10 rounded-[0.625rem] border border-border bg-input-background px-3 text-sm"
                value={form.anio}
                onChange={e => setForm(f => ({ ...f, anio: Number(e.target.value) }))}
              >
                {[ANIO_ACTUAL - 1, ANIO_ACTUAL, ANIO_ACTUAL + 1].map(a => (
                  <option key={a} value={a}>{a}</option>
                ))}
              </select>
            </div>
            <div>
              <label className="block text-xs font-medium mb-1">Mes</label>
              <select
                className="w-full h-10 rounded-[0.625rem] border border-border bg-input-background px-3 text-sm"
                value={form.mes}
                onChange={e => setForm(f => ({ ...f, mes: Number(e.target.value) }))}
              >
                {MESES.map((m, i) => (
                  <option key={i + 1} value={i + 1}>{m}</option>
                ))}
              </select>
            </div>
          </div>

          <div>
            <label className="block text-xs font-medium mb-1">
              Capacitador <span className="text-muted-foreground">(opcional)</span>
            </label>
            <input
              type="text"
              className="w-full h-10 rounded-[0.625rem] border border-border bg-input-background px-3 text-sm"
              placeholder="Nombre del instructor"
              value={form.capacitador}
              onChange={e => setForm(f => ({ ...f, capacitador: e.target.value }))}
            />
          </div>

          <div className="flex items-center justify-between rounded-[0.625rem] border border-border bg-card px-4 py-3">
            <span className="text-sm font-medium">Realizado</span>
            <button
              type="button"
              onClick={() => setForm(f => ({ ...f, realizado: !f.realizado }))}
              className="relative inline-flex h-6 w-11 items-center rounded-full transition-colors"
              style={{ backgroundColor: form.realizado ? 'var(--primary)' : 'var(--switch-background)' }}
            >
              <span
                className="inline-block h-4 w-4 rounded-full bg-white transition-transform"
                style={{ transform: form.realizado ? 'translateX(22px)' : 'translateX(4px)' }}
              />
            </button>
          </div>

          <div>
            <label className="block text-xs font-medium mb-1">
              Observaciones <span className="text-muted-foreground">(opcional)</span>
            </label>
            <textarea
              rows={3}
              className="w-full rounded-[0.625rem] border border-border bg-input-background px-3 py-2 text-sm resize-none"
              value={form.observaciones}
              onChange={e => setForm(f => ({ ...f, observaciones: e.target.value }))}
            />
          </div>

          {editId && (
            <button
              type="button"
              onClick={desactivar}
              disabled={guardando}
              className="w-full h-10 rounded-[0.625rem] border text-sm font-medium disabled:opacity-50"
              style={{ borderColor: 'var(--agro-danger-text)', color: 'var(--agro-danger-text)' }}
            >
              Desactivar registro
            </button>
          )}
        </div>
        <div className="px-4 pb-6 pt-3 border-t border-border">
          <button
            onClick={guardar}
            disabled={guardando}
            className="w-full h-11 rounded-[0.625rem] text-white font-semibold text-sm flex items-center justify-center gap-2 disabled:opacity-50"
            style={{ backgroundColor: 'var(--primary)' }}
          >
            {guardando && <Loader2 className="w-4 h-4 animate-spin" />}
            Guardar
          </button>
        </div>
      </BottomSheet>
    </div>
  )
}
