import { useState, useEffect } from 'react'
import { ChevronLeft, Plus, FileDown, X, Loader2, FlaskConical, Files } from 'lucide-react'
import { useNavigate } from 'react-router'
import { BottomSheet } from '@/app/components/BottomSheet'
import { toast } from 'sonner'
import { useAuthContext } from '@/context/AuthContext'
import { puedeEditarFechaLibre } from '@/lib/permisos'
import { codigoFormato } from '@/lib/codigoFormato'
import { useModulosContext } from '@/context/ModulosContext'
import { useRanchos } from '@/hooks/useRanchos'
import { useM22Muestras, useM22Microorganismos, type M22Muestra } from '@/hooks/useM22Muestras'
import { useOrganizacion } from '@/hooks/useOrganizacion'
import { supabase } from '@/lib/supabase'
import { generarMuestrasLaboratorioPDF } from '@/lib/pdf/m22/generarMuestrasLaboratorioPDF'
import { generarMuestrasLaboratorioConsolidadoPDF } from '@/lib/pdf/m22/generarMuestrasLaboratorioConsolidadoPDF'

const hoy = () => new Date().toLocaleDateString('en-CA', { timeZone: 'America/Mexico_City' })

function formatFecha(iso: string): string {
  try {
    return new Date(iso + 'T12:00:00').toLocaleDateString('es-MX', { day: 'numeric', month: 'short', year: 'numeric' })
  } catch { return iso }
}

type FormState = {
  rancho_id: string
  fecha_muestreo: string
  hora_muestreo: string
  descripcion_muestra: string
  microorganismos: string[]
  laboratorio: string
  solicitante_nombre: string
}

const FORM_INICIAL: FormState = {
  rancho_id: '',
  fecha_muestreo: hoy(),
  hora_muestreo: '',
  descripcion_muestra: '',
  microorganismos: [],
  laboratorio: '',
  solicitante_nombre: '',
}

export function RegistroMuestrasLaboratorio() {
  const navigate = useNavigate()
  const { profile, user, codigoClave } = useAuthContext()
  const esSuperAdmin = profile?.rol === 'super_admin'
  const puedeEditarFecha = esSuperAdmin || puedeEditarFechaLibre(user?.email)
  const { terminosSitio } = useModulosContext()
  const orgId = profile?.org_id ?? null
  const { ranchos } = useRanchos(orgId)
  const { muestras, loading, refetch } = useM22Muestras(orgId)
  const { microorganismos } = useM22Microorganismos()
  const orgNombre = useOrganizacion(orgId)

  const [sheetOpen, setSheetOpen] = useState(false)
  const [consolidadoOpen, setConsolidadoOpen] = useState(false)
  const [form, setForm] = useState<FormState>(FORM_INICIAL)
  const [guardando, setGuardando] = useState(false)
  const [pdfLoading, setPdfLoading] = useState<string | null>(null)
  const [consolidadoForm, setConsolidadoForm] = useState({ rancho_id: '', desde: hoy(), hasta: hoy() })
  const [exportando, setExportando] = useState(false)

  const indicadores = microorganismos.filter(m => m.tipo === 'indicador').sort((a, b) => a.orden - b.orden)
  const patogenos = microorganismos.filter(m => m.tipo === 'patogeno').sort((a, b) => a.orden - b.orden)

  function toggleMicro(codigo: string) {
    setForm(f => ({
      ...f,
      microorganismos: f.microorganismos.includes(codigo)
        ? f.microorganismos.filter(c => c !== codigo)
        : [...f.microorganismos, codigo],
    }))
  }

  function abrirNueva() {
    setForm({ ...FORM_INICIAL, solicitante_nombre: profile?.nombre_completo ?? '' })
    setSheetOpen(true)
  }

  async function guardar() {
    if (!orgId) return
    if (!form.rancho_id) { toast.error(`Selecciona una ${terminosSitio.singular}`); return }
    if (!form.fecha_muestreo) { toast.error('Ingresa la fecha de muestreo'); return }
    if (!form.descripcion_muestra.trim()) { toast.error('Ingresa la descripción de la muestra'); return }
    if (form.microorganismos.length === 0) { toast.error('Selecciona al menos un microorganismo'); return }
    if (!form.laboratorio.trim()) { toast.error('Ingresa el laboratorio'); return }
    if (!form.solicitante_nombre.trim()) { toast.error('Ingresa el nombre del solicitante'); return }

    setGuardando(true)
    try {
      const { data, error } = await (supabase as any)
        .from('m22_muestras')
        .insert({
          org_id: orgId,
          rancho_id: form.rancho_id,
          fecha_muestreo: form.fecha_muestreo,
          hora_muestreo: form.hora_muestreo || null,
          descripcion_muestra: form.descripcion_muestra.trim(),
          microorganismos: form.microorganismos,
          laboratorio: form.laboratorio.trim(),
          solicitante_nombre: form.solicitante_nombre.trim(),
        })
        .select('id')
        .single()
      if (error) throw error

      setSheetOpen(false)
      await refetch()
      toast.success('Muestra registrada')

      try {
        await generarMuestrasLaboratorioPDF(data.id, orgId)
      } catch (e) {
        toast.error('PDF no generado')
        console.error(e)
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
      await generarMuestrasLaboratorioPDF(id, orgId)
    } catch (e) {
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
      const instCode = (rancho as any)?.codigo ?? ''
      await generarMuestrasLaboratorioConsolidadoPDF(
        orgId,
        consolidadoForm.rancho_id || null,
        consolidadoForm.desde,
        consolidadoForm.hasta,
        instName,
        instCode
      )
      setConsolidadoOpen(false)
    } catch (e: any) {
      toast.error(e.message ?? 'Error al exportar')
    } finally {
      setExportando(false)
    }
  }

  return (
    <div className="flex flex-col h-full bg-background">
      {/* Header */}
      <div className="flex items-center gap-3 px-4 pt-12 pb-4">
        <button onClick={() => navigate('/')} className="p-1 -ml-1">
          <ChevronLeft className="w-5 h-5" />
        </button>
        <div className="flex-1">
          <h1 className="text-lg font-semibold leading-tight">Muestras al Laboratorio</h1>
          <p className="text-xs text-muted-foreground">{codigoFormato('F-FRUS-CAL-24', codigoClave)} · Por evento</p>
        </div>
        <FlaskConical className="w-5 h-5 text-muted-foreground" />
      </div>

      {/* Exportar consolidado */}
      <div className="px-4 mb-4">
        <button
          onClick={() => setConsolidadoOpen(true)}
          className="flex items-center gap-2 text-sm text-primary font-medium"
        >
          <Files className="w-4 h-4" />
          Exportar consolidado
        </button>
      </div>

      {/* Lista */}
      <div className="flex-1 px-4 pb-32 space-y-3">
        {loading && (
          <div className="flex items-center justify-center py-12">
            <Loader2 className="w-5 h-5 animate-spin text-muted-foreground" />
          </div>
        )}
        {!loading && muestras.length === 0 && (
          <div className="text-center py-12 text-muted-foreground text-sm">
            Sin registros. Usa el botón + para agregar.
          </div>
        )}
        {muestras.map(m => (
          <div key={m.id} className="bg-card border border-border rounded-[0.625rem] p-4">
            <div className="flex items-start justify-between gap-2">
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-1 flex-wrap mb-0.5">
                  {orgNombre && (
                    <span className="text-xs text-muted-foreground font-medium">{orgNombre} ·</span>
                  )}
                  <span className="text-sm font-semibold">{m.rancho_nombre}</span>
                </div>
                <p className="text-xs text-muted-foreground">{formatFecha(m.fecha_muestreo)}{m.hora_muestreo ? ` · ${m.hora_muestreo}` : ''}</p>
                <p className="text-xs mt-1 line-clamp-2">{m.descripcion_muestra}</p>
                <p className="text-xs text-muted-foreground mt-1">{m.laboratorio}</p>
                <div className="flex flex-wrap gap-1 mt-2">
                  {m.microorganismos.map(c => (
                    <span key={c} className="text-[10px] px-1.5 py-0.5 rounded bg-muted text-muted-foreground">{c}</span>
                  ))}
                </div>
              </div>
              <button
                onClick={() => descargarPDF(m.id)}
                disabled={pdfLoading === m.id}
                className="p-2 rounded-lg border border-border shrink-0"
              >
                {pdfLoading === m.id
                  ? <Loader2 className="w-4 h-4 animate-spin" />
                  : <FileDown className="w-4 h-4 text-primary" />
                }
              </button>
            </div>
          </div>
        ))}
      </div>

      {/* FAB */}
      <div className="fixed bottom-safe-fab left-1/2 -translate-x-1/2 w-full max-w-[390px] flex justify-end px-4 pointer-events-none z-10">
        <button
          onClick={abrirNueva}
          className="pointer-events-auto w-14 h-14 rounded-full bg-[var(--primary)] text-white flex items-center justify-center shadow-lg active:scale-95 transition-transform"
          aria-label="Nueva muestra"
        >
          <Plus className="w-6 h-6" />
        </button>
      </div>

      {/* Bottom sheet — Formulario */}
      <BottomSheet open={sheetOpen} onClose={() => setSheetOpen(false)}>
            <div className="flex items-center justify-between px-4 pt-4 pb-3 border-b border-border">
              <h2 className="text-base font-semibold">Nueva muestra</h2>
              <button onClick={() => setSheetOpen(false)}>
                <X className="w-5 h-5" />
              </button>
            </div>
            <div className="overflow-y-auto flex-1 px-4 pt-4 pb-8 space-y-4">

              {/* Instalación */}
              <div>
                <label className="block text-xs font-medium mb-1">{terminosSitio.singular}</label>
                <select
                  className="w-full h-10 rounded-[0.625rem] border border-border bg-input-background px-3 text-sm"
                  value={form.rancho_id}
                  onChange={e => setForm(f => ({ ...f, rancho_id: e.target.value }))}
                >
                  <option value="">Selecciona...</option>
                  {ranchos.map(r => <option key={r.id} value={r.id}>{r.nombre}</option>)}
                </select>
              </div>

              {/* Fecha */}
              <div>
                <label className="block text-xs font-medium mb-1">Fecha de muestreo</label>
                <input
                  type="date"
                  className="w-full h-10 rounded-[0.625rem] border border-border bg-input-background px-3 text-sm"
                  value={form.fecha_muestreo}
                  min={puedeEditarFecha ? undefined : hoy()}
                  max={puedeEditarFecha ? undefined : hoy()}
                  onChange={e => { if (puedeEditarFecha) setForm(f => ({ ...f, fecha_muestreo: e.target.value })) }}
                />
              </div>

              {/* Hora (opcional) */}
              <div>
                <label className="block text-xs font-medium mb-1">Hora de muestreo <span className="text-muted-foreground">(opcional)</span></label>
                <input
                  type="time"
                  className="w-full h-10 rounded-[0.625rem] border border-border bg-input-background px-3 text-sm"
                  value={form.hora_muestreo}
                  onChange={e => setForm(f => ({ ...f, hora_muestreo: e.target.value }))}
                />
              </div>

              {/* Descripción */}
              <div>
                <label className="block text-xs font-medium mb-1">Descripción de la muestra</label>
                <textarea
                  rows={3}
                  className="w-full rounded-[0.625rem] border border-border bg-input-background px-3 py-2 text-sm resize-none"
                  placeholder="Describe la muestra..."
                  value={form.descripcion_muestra}
                  onChange={e => setForm(f => ({ ...f, descripcion_muestra: e.target.value }))}
                />
              </div>

              {/* Microorganismos */}
              <div>
                <label className="block text-xs font-medium mb-2">Microorganismos a analizar</label>

                <p className="text-xs text-muted-foreground mb-1 font-medium">m.o. Indicadores</p>
                <div className="flex flex-wrap gap-2 mb-3">
                  {indicadores.map(m => (
                    <button
                      key={m.codigo}
                      type="button"
                      onClick={() => toggleMicro(m.codigo)}
                      className={`text-xs px-2.5 py-1 rounded-full border transition-colors ${
                        form.microorganismos.includes(m.codigo)
                          ? 'bg-primary text-white border-primary'
                          : 'bg-muted border-border text-foreground'
                      }`}
                    >
                      {m.codigo}
                    </button>
                  ))}
                </div>

                <p className="text-xs text-muted-foreground mb-1 font-medium">m.o. Patógenos</p>
                <div className="flex flex-wrap gap-2">
                  {patogenos.map(m => (
                    <button
                      key={m.codigo}
                      type="button"
                      onClick={() => toggleMicro(m.codigo)}
                      className={`text-xs px-2.5 py-1 rounded-full border transition-colors ${
                        form.microorganismos.includes(m.codigo)
                          ? 'bg-primary text-white border-primary'
                          : 'bg-muted border-border text-foreground'
                      }`}
                    >
                      {m.codigo}
                    </button>
                  ))}
                </div>

                {form.microorganismos.length > 0 && (
                  <p className="text-xs text-muted-foreground mt-2">
                    Seleccionados: {form.microorganismos.join(', ')}
                  </p>
                )}
              </div>

              {/* Laboratorio */}
              <div>
                <label className="block text-xs font-medium mb-1">Laboratorio</label>
                <input
                  type="text"
                  className="w-full h-10 rounded-[0.625rem] border border-border bg-input-background px-3 text-sm"
                  placeholder="Nombre del laboratorio"
                  value={form.laboratorio}
                  onChange={e => setForm(f => ({ ...f, laboratorio: e.target.value }))}
                />
              </div>

              {/* Solicitante */}
              <div>
                <label className="block text-xs font-medium mb-1">Nombre del solicitante</label>
                <input
                  type="text"
                  className="w-full h-10 rounded-[0.625rem] border border-border bg-input-background px-3 text-sm"
                  placeholder="Nombre completo"
                  value={form.solicitante_nombre}
                  onChange={e => setForm(f => ({ ...f, solicitante_nombre: e.target.value }))}
                />
              </div>

            </div>
            <div className="px-4 pb-6 pt-3 border-t border-border">
              <button
                onClick={guardar}
                disabled={guardando}
                className="w-full h-11 rounded-[0.625rem] bg-primary text-white font-semibold text-sm flex items-center justify-center gap-2 disabled:opacity-50"
              >
                {guardando && <Loader2 className="w-4 h-4 animate-spin" />}
                Guardar y generar PDF
              </button>
            </div>
      </BottomSheet>

      {/* Bottom sheet — Consolidado */}
      <BottomSheet open={consolidadoOpen} onClose={() => setConsolidadoOpen(false)}>
            <div className="flex items-center justify-between px-4 pt-4 pb-3 border-b border-border">
              <h2 className="text-base font-semibold">Exportar consolidado</h2>
              <button onClick={() => setConsolidadoOpen(false)}>
                <X className="w-5 h-5" />
              </button>
            </div>
            <div className="overflow-y-auto flex-1 px-4 pt-4 pb-8 space-y-4">
              <div>
                <label className="block text-xs font-medium mb-1">{terminosSitio.singular} <span className="text-muted-foreground">(opcional)</span></label>
                <select
                  className="w-full h-10 rounded-[0.625rem] border border-border bg-input-background px-3 text-sm"
                  value={consolidadoForm.rancho_id}
                  onChange={e => setConsolidadoForm(f => ({ ...f, rancho_id: e.target.value }))}
                >
                  <option value="">{terminosSitio.plural}</option>
                  {ranchos.map(r => <option key={r.id} value={r.id}>{r.nombre}</option>)}
                </select>
              </div>
              <div>
                <label className="block text-xs font-medium mb-1">Desde</label>
                <input
                  type="date"
                  className="w-full h-10 rounded-[0.625rem] border border-border bg-input-background px-3 text-sm"
                  value={consolidadoForm.desde}
                  onChange={e => setConsolidadoForm(f => ({ ...f, desde: e.target.value }))}
                />
              </div>
              <div>
                <label className="block text-xs font-medium mb-1">Hasta</label>
                <input
                  type="date"
                  className="w-full h-10 rounded-[0.625rem] border border-border bg-input-background px-3 text-sm"
                  value={consolidadoForm.hasta}
                  onChange={e => setConsolidadoForm(f => ({ ...f, hasta: e.target.value }))}
                />
              </div>
            </div>
            <div className="px-4 pb-6 pt-3 border-t border-border">
              <button
                onClick={exportarConsolidado}
                disabled={exportando}
                className="w-full h-11 rounded-[0.625rem] bg-primary text-white font-semibold text-sm flex items-center justify-center gap-2 disabled:opacity-50"
              >
                {exportando ? <Loader2 className="w-4 h-4 animate-spin" /> : <FileDown className="w-4 h-4" />}
                Exportar PDF
              </button>
            </div>
      </BottomSheet>
    </div>
  )
}
