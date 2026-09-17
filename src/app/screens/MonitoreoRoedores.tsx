import { useState } from 'react'
import { ChevronLeft, Plus, FileDown, X, Loader2, Bug, Files, Check } from 'lucide-react'
import { useNavigate } from 'react-router'
import { BottomSheet } from '@/app/components/BottomSheet'
import { toast } from 'sonner'
import { useAuthContext } from '@/context/AuthContext'
import { puedeEditarFechaLibre } from '@/lib/permisos'
import { useModulosContext } from '@/context/ModulosContext'
import { useRanchos } from '@/hooks/useRanchos'
import { useM68MonitoreoRoedores, useM68Criterios, type M68Criterio } from '@/hooks/useM68MonitoreoRoedores'
import { useOrganizacion } from '@/hooks/useOrganizacion'
import { supabase } from '@/lib/supabase'
import { generarMonitoreoRoedoresPDF } from '@/lib/pdf/m68/generarMonitoreoRoedoresPDF'
import { generarMonitoreoRoedoresConsolidadoPDF } from '@/lib/pdf/m68/generarMonitoreoRoedoresPDF'

const hoyMX = () => new Date().toLocaleDateString('en-CA', { timeZone: 'America/Mexico_City' })

function formatFecha(iso: string): string {
  try {
    return new Date(iso + 'T12:00:00').toLocaleDateString('es-MX', { day: 'numeric', month: 'short', year: 'numeric' })
  } catch { return iso }
}

type FormState = {
  rancho_id: string
  fecha: string
  ubicacion: string
  num_trampas: number
  responsable: string
  observaciones: string
}

const FORM_VACIO: FormState = {
  rancho_id: '',
  fecha: hoyMX(),
  ubicacion: '',
  num_trampas: 8,
  responsable: '',
  observaciones: '',
}

function CeldaCheck({ valor, onToggle }: { valor: boolean; onToggle: () => void }) {
  return (
    <button
      type="button"
      onClick={onToggle}
      className="w-9 h-9 rounded-md border flex items-center justify-center shrink-0 transition-colors"
      style={{
        borderColor: valor ? 'var(--primary)' : 'var(--border)',
        backgroundColor: valor ? 'var(--primary)' : 'var(--card)',
      }}
    >
      {valor && <Check className="w-4 h-4 text-white" />}
    </button>
  )
}

function MatrizMonitoreo({
  criterios,
  numTrampas,
  matriz,
  onToggle,
}: {
  criterios: M68Criterio[]
  numTrampas: number
  matriz: Record<string, boolean>
  onToggle: (criterioId: string, trampa: number) => void
}) {
  const cellSize = 40
  const criterioColW = 152

  return (
    <div className="overflow-x-auto -mx-1">
      <div style={{ minWidth: criterioColW + numTrampas * cellSize + 8 + 'px' }}>
        <div className="flex items-center gap-1 mb-1.5 px-1">
          <div style={{ width: criterioColW, flexShrink: 0 }} />
          {Array.from({ length: numTrampas }, (_, i) => (
            <div
              key={i + 1}
              className="shrink-0 text-center text-xs font-semibold"
              style={{ width: cellSize, color: 'var(--muted-foreground)' }}
            >
              T{i + 1}
            </div>
          ))}
        </div>

        {criterios.map(c => (
          <div key={c.id} className="flex items-center gap-1 mb-2 px-1">
            <div
              className="text-xs leading-snug shrink-0"
              style={{ width: criterioColW, color: 'var(--foreground)' }}
            >
              <span className="font-semibold" style={{ color: 'var(--primary)' }}>{c.numero}.</span>{' '}
              {c.descripcion}
            </div>
            {Array.from({ length: numTrampas }, (_, i) => (
              <div key={i + 1} style={{ width: cellSize, flexShrink: 0 }}>
                <CeldaCheck
                  valor={matriz[`${c.id}_${i + 1}`] ?? true}
                  onToggle={() => onToggle(c.id, i + 1)}
                />
              </div>
            ))}
          </div>
        ))}

        <div className="px-1 mt-1 flex items-center gap-3">
          <div className="flex items-center gap-1.5">
            <div
              className="w-4 h-4 rounded border flex items-center justify-center"
              style={{ backgroundColor: 'var(--primary)', borderColor: 'var(--primary)' }}
            >
              <Check className="w-2.5 h-2.5 text-white" />
            </div>
            <span className="text-xs" style={{ color: 'var(--muted-foreground)' }}>Cumple</span>
          </div>
          <div className="flex items-center gap-1.5">
            <div
              className="w-4 h-4 rounded border"
              style={{ borderColor: 'var(--border)', backgroundColor: 'var(--card)' }}
            />
            <span className="text-xs" style={{ color: 'var(--muted-foreground)' }}>No cumple</span>
          </div>
        </div>
      </div>
    </div>
  )
}

export function MonitoreoRoedores() {
  const navigate = useNavigate()
  const { profile, user, codigoClave } = useAuthContext()
  const esSuperAdmin = profile?.rol === 'super_admin'
  const puedeEditarFecha = esSuperAdmin || puedeEditarFechaLibre(user?.email)
  const { terminosSitio } = useModulosContext()
  const orgId = profile?.org_id ?? null
  const { ranchos } = useRanchos(orgId)
  const { registros, loading, refetch } = useM68MonitoreoRoedores(orgId)
  const { criterios } = useM68Criterios()
  const orgNombre = useOrganizacion(orgId)

  const [sheetOpen, setSheetOpen] = useState(false)
  const [consolidadoOpen, setConsolidadoOpen] = useState(false)
  const [form, setForm] = useState<FormState>(FORM_VACIO)
  const [matriz, setMatriz] = useState<Record<string, boolean>>({})
  const [guardando, setGuardando] = useState(false)
  const [pdfLoading, setPdfLoading] = useState<string | null>(null)
  const [consolidadoForm, setConsolidadoForm] = useState({ rancho_id: '', desde: hoyMX(), hasta: hoyMX() })
  const [exportando, setExportando] = useState(false)

  function iniciarMatriz(numTrampas: number) {
    const init: Record<string, boolean> = {}
    for (const c of criterios) {
      for (let t = 1; t <= numTrampas; t++) {
        init[`${c.id}_${t}`] = true
      }
    }
    return init
  }

  function abrirNuevo() {
    const numT = FORM_VACIO.num_trampas
    setForm({ ...FORM_VACIO, fecha: hoyMX(), responsable: profile?.nombre_completo ?? '' })
    setMatriz(iniciarMatriz(numT))
    setSheetOpen(true)
  }

  function toggleCelda(criterioId: string, trampa: number) {
    setMatriz(m => ({ ...m, [`${criterioId}_${trampa}`]: !(m[`${criterioId}_${trampa}`] ?? true) }))
  }

  function handleNumTrampasChange(val: number) {
    const n = Math.max(1, Math.min(50, val || 1))
    setForm(f => ({ ...f, num_trampas: n }))
  }

  async function guardar() {
    if (!orgId) return
    if (!form.rancho_id) {
      toast.error(`Selecciona ${terminosSitio.genero === 'f' ? 'una' : 'un'} ${terminosSitio.singular}`)
      return
    }
    if (!form.ubicacion.trim()) { toast.error('Ingresa la ubicación'); return }

    setGuardando(true)
    try {
      const { data: regData, error: regErr } = await (supabase as any)
        .from('m68_roedores_registro')
        .insert({
          org_id: orgId,
          rancho_id: form.rancho_id,
          fecha: form.fecha,
          ubicacion: form.ubicacion.trim(),
          num_trampas: form.num_trampas,
          responsable: form.responsable.trim() || null,
          observaciones: form.observaciones.trim() || null,
          creado_por: user?.id,
        })
        .select('id')
        .single()
      if (regErr) throw regErr
      const registroId = (regData as any).id as string

      const batch = criterios.flatMap(c =>
        Array.from({ length: form.num_trampas }, (_, i) => ({
          org_id: orgId,
          registro_id: registroId,
          criterio_id: c.id,
          trampa_numero: i + 1,
          cumple: matriz[`${c.id}_${i + 1}`] ?? true,
        }))
      )
      const { error: resErr } = await (supabase as any).from('m68_roedores_resultados').insert(batch)
      if (resErr) throw resErr

      setSheetOpen(false)
      await refetch()
      toast.success('Monitoreo registrado')

      try {
        await generarMonitoreoRoedoresPDF(registroId, orgId, codigoClave)
      } catch {
        toast.error('PDF no generado')
      }
    } catch (e: any) {
      const msg: string = e?.message ?? 'Error al guardar'
      if (msg.includes('FECHA_SOLO_HOY')) {
        toast.warning('Solo puedes registrar con la fecha de hoy')
      } else {
        toast.error(msg)
        console.error(e)
      }
    } finally {
      setGuardando(false)
    }
  }

  async function descargarPDF(id: string) {
    if (!orgId) return
    setPdfLoading(id)
    try {
      await generarMonitoreoRoedoresPDF(id, orgId, codigoClave)
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
      await generarMonitoreoRoedoresConsolidadoPDF(
        orgId,
        consolidadoForm.rancho_id || null,
        consolidadoForm.desde,
        consolidadoForm.hasta,
        instName,
        orgNombre,
        codigoClave,
      )
      setConsolidadoOpen(false)
    } catch (e: any) {
      toast.error(e?.message ?? 'Error al exportar')
    } finally {
      setExportando(false)
    }
  }

  return (
    <div className="flex flex-col h-full bg-background">
      <div className="flex items-center gap-3 px-4 pt-12 pb-4">
        <button onClick={() => navigate('/')} className="p-1 -ml-1">
          <ChevronLeft className="w-5 h-5" />
        </button>
        <div className="flex-1">
          <h1 className="text-lg font-semibold leading-tight">Monitoreo de Trampas para Roedores</h1>
          <p className="text-xs text-muted-foreground">M68 · REG-23 · Por evento</p>
        </div>
        <Bug className="w-5 h-5 text-muted-foreground" />
      </div>

      <div className="px-4 mb-4">
        <button
          onClick={() => setConsolidadoOpen(true)}
          className="flex items-center gap-2 text-sm font-medium"
          style={{ color: 'var(--primary)' }}
        >
          <Files className="w-4 h-4" />
          Exportar consolidado
        </button>
      </div>

      <div className="flex-1 px-4 pb-32 space-y-3 overflow-y-auto">
        {loading && (
          <div className="flex items-center justify-center py-12">
            <Loader2 className="w-5 h-5 animate-spin text-muted-foreground" />
          </div>
        )}
        {!loading && registros.length === 0 && (
          <div className="text-center py-12 text-muted-foreground text-sm">
            Sin registros. Usa el botón + para agregar.
          </div>
        )}
        {registros.map(r => (
          <div key={r.id} className="bg-card border border-border rounded-[0.625rem] p-4">
            <div className="flex items-start justify-between gap-2">
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-1 flex-wrap mb-0.5">
                  {orgNombre && (
                    <span className="text-xs text-muted-foreground font-medium">{orgNombre} ·</span>
                  )}
                  <span className="text-sm font-semibold">{r.rancho_nombre}</span>
                </div>
                <p className="text-xs text-muted-foreground">{formatFecha(r.fecha)}</p>
                <p className="text-sm mt-0.5">{r.ubicacion}</p>
                <p className="text-xs text-muted-foreground mt-0.5">{r.num_trampas} trampas</p>
              </div>
              <button
                onClick={() => descargarPDF(r.id)}
                disabled={pdfLoading === r.id}
                className="p-2 rounded-lg border border-border shrink-0"
              >
                {pdfLoading === r.id
                  ? <Loader2 className="w-4 h-4 animate-spin" />
                  : <FileDown className="w-4 h-4" style={{ color: 'var(--primary)' }} />
                }
              </button>
            </div>
          </div>
        ))}
      </div>

      <div className="fixed bottom-safe-fab left-1/2 -translate-x-1/2 w-full max-w-[390px] flex justify-end px-4 pointer-events-none z-10 md:bottom-6">
        <button
          onClick={abrirNuevo}
          className="pointer-events-auto w-14 h-14 rounded-full text-white flex items-center justify-center active:scale-95 transition-transform"
          style={{ backgroundColor: 'var(--primary)' }}
          aria-label="Nuevo monitoreo"
        >
          <Plus className="w-6 h-6" />
        </button>
      </div>

      <BottomSheet open={sheetOpen} onClose={() => setSheetOpen(false)} height="85%">
        <div className="flex items-center justify-between px-4 pt-4 pb-3 border-b border-border">
          <h2 className="text-base font-semibold">Nuevo monitoreo</h2>
          <button onClick={() => setSheetOpen(false)}>
            <X className="w-5 h-5" />
          </button>
        </div>
        <div className="overflow-y-auto flex-1 px-4 pt-4 pb-8 space-y-4">

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

          <div>
            <label className="block text-xs font-medium mb-1">Fecha</label>
            <input
              type="date"
              className="w-full h-10 rounded-[0.625rem] border border-border bg-input-background px-3 text-sm"
              value={form.fecha}
              min={puedeEditarFecha ? undefined : hoyMX()}
              max={puedeEditarFecha ? undefined : hoyMX()}
              onChange={e => { if (puedeEditarFecha) setForm(f => ({ ...f, fecha: e.target.value })) }}
            />
          </div>

          <div>
            <label className="block text-xs font-medium mb-1">Ubicación</label>
            <input
              type="text"
              className="w-full h-10 rounded-[0.625rem] border border-border bg-input-background px-3 text-sm"
              placeholder="Ej. Bodega norte, Área de carga..."
              value={form.ubicacion}
              onChange={e => setForm(f => ({ ...f, ubicacion: e.target.value }))}
            />
          </div>

          <div>
            <label className="block text-xs font-medium mb-1">N° de trampas</label>
            <input
              type="number"
              min={1}
              max={50}
              className="w-full h-10 rounded-[0.625rem] border border-border bg-input-background px-3 text-sm"
              value={form.num_trampas}
              onChange={e => handleNumTrampasChange(parseInt(e.target.value, 10))}
            />
          </div>

          <div>
            <label className="block text-xs font-medium mb-1">
              Responsable <span className="text-muted-foreground">(opcional)</span>
            </label>
            <input
              type="text"
              className="w-full h-10 rounded-[0.625rem] border border-border bg-input-background px-3 text-sm"
              placeholder="Nombre completo"
              value={form.responsable}
              onChange={e => setForm(f => ({ ...f, responsable: e.target.value }))}
            />
          </div>

          <div>
            <label className="block text-xs font-medium mb-1">
              Observaciones y/o acción correctiva <span className="text-muted-foreground">(opcional)</span>
            </label>
            <textarea
              rows={2}
              className="w-full rounded-[0.625rem] border border-border bg-input-background px-3 py-2 text-sm resize-none"
              value={form.observaciones}
              onChange={e => setForm(f => ({ ...f, observaciones: e.target.value }))}
            />
          </div>

          {criterios.length > 0 && (
            <div>
              <p className="text-xs font-medium mb-3">Matriz de monitoreo</p>
              <MatrizMonitoreo
                criterios={criterios}
                numTrampas={form.num_trampas}
                matriz={matriz}
                onToggle={toggleCelda}
              />
            </div>
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
            Guardar y generar PDF
          </button>
        </div>
      </BottomSheet>

      <BottomSheet open={consolidadoOpen} onClose={() => setConsolidadoOpen(false)}>
        <div className="flex items-center justify-between px-4 pt-4 pb-3 border-b border-border">
          <h2 className="text-base font-semibold">Exportar consolidado</h2>
          <button onClick={() => setConsolidadoOpen(false)}>
            <X className="w-5 h-5" />
          </button>
        </div>
        <div className="overflow-y-auto flex-1 px-4 pt-4 pb-8 space-y-4">
          <div>
            <label className="block text-xs font-medium mb-1">
              {terminosSitio.singular} <span className="text-muted-foreground">(opcional)</span>
            </label>
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
            className="w-full h-11 rounded-[0.625rem] text-white font-semibold text-sm flex items-center justify-center gap-2 disabled:opacity-50"
            style={{ backgroundColor: 'var(--primary)' }}
          >
            {exportando ? <Loader2 className="w-4 h-4 animate-spin" /> : <FileDown className="w-4 h-4" />}
            Exportar PDF
          </button>
        </div>
      </BottomSheet>
    </div>
  )
}
