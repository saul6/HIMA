import { useState } from 'react'
import { ChevronLeft, CalendarDays, FileDown, Plus, X, Loader2, Pencil } from 'lucide-react'
import { useNavigate } from 'react-router'
import { toast } from 'sonner'
import { BottomSheet } from '@/app/components/BottomSheet'
import { useAuthContext } from '@/context/AuthContext'
import { useOrganizacion } from '@/hooks/useOrganizacion'
import { useM57CronogramaCapacitacion } from '@/hooks/useM57CronogramaCapacitacion'
import { supabase } from '@/lib/supabase'
import { generarCronogramaCapacitacionPDF } from '@/lib/pdf/m57/generarCronogramaCapacitacionPDF'

const PERIODICIDADES = ['Mensual', 'Bimestral', 'Trimestral', 'Semestral', 'Anual']

type FormState = {
  cargo: string
  tematica: string
  periodicidad: string
  mes_programado: string
  observaciones: string
}

const FORM_VACIO: FormState = {
  cargo: '',
  tematica: '',
  periodicidad: '',
  mes_programado: '',
  observaciones: '',
}

export function CronogramaCapacitacion() {
  const navigate = useNavigate()
  const { profile, user } = useAuthContext()
  const orgId = profile?.org_id ?? null
  const esAdmin = profile?.rol === 'admin_org' || profile?.rol === 'super_admin'
  const orgNombre = useOrganizacion(orgId)
  const { registros, loading, error, refetch } = useM57CronogramaCapacitacion(orgId)

  const [sheetOpen, setSheetOpen] = useState(false)
  const [editId, setEditId] = useState<string | null>(null)
  const [form, setForm] = useState<FormState>(FORM_VACIO)
  const [guardando, setGuardando] = useState(false)
  const [pdfLoading, setPdfLoading] = useState(false)
  const [soloActivos, setSoloActivos] = useState(true)

  const registrosFiltrados = soloActivos ? registros.filter(r => r.activo) : registros

  function abrirNuevo() {
    setEditId(null)
    setForm(FORM_VACIO)
    setSheetOpen(true)
  }

  function abrirEdicion(r: typeof registros[number]) {
    setEditId(r.id)
    setForm({
      cargo: r.cargo,
      tematica: r.tematica,
      periodicidad: r.periodicidad,
      mes_programado: r.mes_programado,
      observaciones: r.observaciones ?? '',
    })
    setSheetOpen(true)
  }

  async function guardar() {
    if (!orgId) return
    if (!form.cargo.trim()) { toast.error('El cargo es requerido'); return }
    if (!form.tematica.trim()) { toast.error('La temática es requerida'); return }

    setGuardando(true)
    try {
      if (editId === null) {
        const { error: err } = await (supabase as any)
          .from('m57_cronograma_capacitacion')
          .insert({
            org_id: orgId,
            creado_por: user?.id,
            cargo: form.cargo.trim(),
            tematica: form.tematica.trim(),
            periodicidad: form.periodicidad.trim(),
            mes_programado: form.mes_programado.trim(),
            observaciones: form.observaciones.trim() || null,
            activo: true,
          })
        if (err) throw err
        toast.success('Registro agregado')
      } else {
        const { error: err } = await (supabase as any)
          .from('m57_cronograma_capacitacion')
          .update({
            cargo: form.cargo.trim(),
            tematica: form.tematica.trim(),
            periodicidad: form.periodicidad.trim(),
            mes_programado: form.mes_programado.trim(),
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
        .from('m57_cronograma_capacitacion')
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
      await generarCronogramaCapacitacionPDF(orgId, orgNombre ?? '')
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
          <h1 className="text-lg font-semibold leading-tight">Cronograma de Capacitaciones</h1>
          <p className="text-xs text-muted-foreground">M57 · Org-level</p>
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
        <CalendarDays className="w-5 h-5 text-muted-foreground" />
      </div>

      <div className="px-4 mb-3">
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
            Sin registros. {esAdmin ? 'Usa el botón + para agregar.' : ''}
          </p>
        )}
        {registrosFiltrados.map(r => (
          <div key={r.id} className="bg-card border border-border rounded-[0.625rem] p-4">
            <div className="flex items-start justify-between gap-2">
              <div className="flex-1 min-w-0">
                <p className="text-sm font-semibold leading-snug">{r.cargo}</p>
                <p className="text-xs text-muted-foreground mt-0.5 leading-snug">{r.tematica}</p>
                <div className="flex items-center gap-2 mt-1.5 flex-wrap">
                  {r.periodicidad && (
                    <span
                      className="text-xs font-medium px-2 py-0.5 rounded-full"
                      style={{ backgroundColor: 'var(--agro-success-fill)', color: 'var(--agro-success-text)' }}
                    >
                      {r.periodicidad}
                    </span>
                  )}
                  {r.mes_programado && (
                    <span className="text-xs text-muted-foreground">{r.mes_programado}</span>
                  )}
                </div>
              </div>
              {esAdmin && (
                <button
                  onClick={() => abrirEdicion(r)}
                  className="p-1.5 rounded-lg border border-border shrink-0"
                >
                  <Pencil className="w-3.5 h-3.5 text-muted-foreground" />
                </button>
              )}
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
            <label className="block text-xs font-medium mb-1">Cargo</label>
            <input
              type="text"
              className="w-full h-10 rounded-[0.625rem] border border-border bg-input-background px-3 text-sm"
              placeholder="Ej. Operario, Supervisor..."
              value={form.cargo}
              onChange={e => setForm(f => ({ ...f, cargo: e.target.value }))}
            />
          </div>

          <div>
            <label className="block text-xs font-medium mb-1">Temática</label>
            <textarea
              rows={3}
              className="w-full rounded-[0.625rem] border border-border bg-input-background px-3 py-2 text-sm resize-none"
              placeholder="Describe la temática de la capacitación..."
              value={form.tematica}
              onChange={e => setForm(f => ({ ...f, tematica: e.target.value }))}
            />
          </div>

          <div>
            <label className="block text-xs font-medium mb-1">Periodicidad</label>
            <select
              className="w-full h-10 rounded-[0.625rem] border border-border bg-input-background px-3 text-sm"
              value={form.periodicidad}
              onChange={e => setForm(f => ({ ...f, periodicidad: e.target.value }))}
            >
              <option value="">Selecciona...</option>
              {PERIODICIDADES.map(p => (
                <option key={p} value={p}>{p}</option>
              ))}
            </select>
          </div>

          <div>
            <label className="block text-xs font-medium mb-1">
              Mes programado <span className="text-muted-foreground">(opcional)</span>
            </label>
            <input
              type="text"
              className="w-full h-10 rounded-[0.625rem] border border-border bg-input-background px-3 text-sm"
              placeholder="Ej. Enero, Marzo-Abril..."
              value={form.mes_programado}
              onChange={e => setForm(f => ({ ...f, mes_programado: e.target.value }))}
            />
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
