import { useState } from 'react'
import { ChevronLeft, HardHat, Plus, FileDown, X, Loader2, Files } from 'lucide-react'
import { useNavigate } from 'react-router'
import { BottomSheet } from '@/app/components/BottomSheet'
import { toast } from 'sonner'
import { useAuthContext } from '@/context/AuthContext'
import { puedeEditarFechaLibre } from '@/lib/permisos'
import { useModulosContext } from '@/context/ModulosContext'
import { useRanchos } from '@/hooks/useRanchos'
import { useM63UsoEpp } from '@/hooks/useM63UsoEpp'
import { useOrganizacion } from '@/hooks/useOrganizacion'
import { supabase } from '@/lib/supabase'
import { generarUsoEppPDF, generarUsoEppConsolidadoPDF } from '@/lib/pdf/m63/generarUsoEppPDF'

const hoyMX = () => new Date().toLocaleDateString('en-CA', { timeZone: 'America/Mexico_City' })

function formatFecha(iso: string): string {
  try {
    return new Date(iso + 'T12:00:00').toLocaleDateString('es-MX', { day: 'numeric', month: 'short', year: 'numeric' })
  } catch { return iso }
}

type FormState = {
  rancho_id: string
  fecha: string
  aplicador: string
  momento: 'inicio' | 'fin'
  botas_ok: boolean
  overol_ok: boolean
  guantes_ok: boolean
  lentes_ok: boolean
  mascarilla_ok: boolean
  realizo: string
  observaciones: string
}

const FORM_VACIO: FormState = {
  rancho_id: '',
  fecha: hoyMX(),
  aplicador: '',
  momento: 'inicio',
  botas_ok: true,
  overol_ok: true,
  guantes_ok: true,
  lentes_ok: true,
  mascarilla_ok: true,
  realizo: '',
  observaciones: '',
}

const EPP_ITEMS = [
  { campo: 'botas_ok', label: 'Botas' },
  { campo: 'overol_ok', label: 'Overol' },
  { campo: 'guantes_ok', label: 'Guantes' },
  { campo: 'lentes_ok', label: 'Lentes' },
  { campo: 'mascarilla_ok', label: 'Mascarilla' },
] as const

export function UsoEpp() {
  const navigate = useNavigate()
  const { profile, user, codigoClave } = useAuthContext()
  const esSuperAdmin = profile?.rol === 'super_admin'
  const puedeEditarFecha = esSuperAdmin || puedeEditarFechaLibre(user?.email)
  const { terminosSitio } = useModulosContext()
  const orgId = profile?.org_id ?? null
  const { ranchos } = useRanchos(orgId)
  const { registros, loading, refetch } = useM63UsoEpp(orgId)
  const orgNombre = useOrganizacion(orgId)

  const [sheetOpen, setSheetOpen] = useState(false)
  const [consolidadoOpen, setConsolidadoOpen] = useState(false)
  const [form, setForm] = useState<FormState>(FORM_VACIO)
  const [guardando, setGuardando] = useState(false)
  const [pdfLoading, setPdfLoading] = useState<string | null>(null)
  const [consolidadoForm, setConsolidadoForm] = useState({ rancho_id: '', desde: hoyMX(), hasta: hoyMX() })
  const [exportando, setExportando] = useState(false)

  function abrirNuevo() {
    setForm({ ...FORM_VACIO, fecha: hoyMX(), realizo: profile?.nombre_completo ?? '' })
    setSheetOpen(true)
  }

  async function guardar() {
    if (!orgId) return
    if (!form.rancho_id) { toast.error(`Selecciona ${terminosSitio.singular}`); return }
    if (!form.aplicador.trim()) { toast.error('Ingresa el nombre del aplicador'); return }

    setGuardando(true)
    try {
      const { data, error } = await (supabase as any)
        .from('m63_uso_epp')
        .insert({
          org_id: orgId,
          rancho_id: form.rancho_id,
          fecha: form.fecha,
          aplicador: form.aplicador.trim(),
          momento: form.momento,
          botas_ok: form.botas_ok,
          overol_ok: form.overol_ok,
          guantes_ok: form.guantes_ok,
          lentes_ok: form.lentes_ok,
          mascarilla_ok: form.mascarilla_ok,
          realizo: form.realizo.trim() || null,
          observaciones: form.observaciones.trim() || null,
          creado_por: user?.id,
        })
        .select('id')
        .single()
      if (error) throw error

      setSheetOpen(false)
      await refetch()
      toast.success('Registro guardado')

      try {
        await generarUsoEppPDF(data.id, orgId, codigoClave)
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
      await generarUsoEppPDF(id, orgId, codigoClave)
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
      await generarUsoEppConsolidadoPDF(
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
      toast.error(e.message ?? 'Error al exportar')
    } finally {
      setExportando(false)
    }
  }

  function eppOkCount(r: typeof registros[number]): number {
    return [r.botas_ok, r.overol_ok, r.guantes_ok, r.lentes_ok, r.mascarilla_ok].filter(Boolean).length
  }

  return (
    <div className="flex flex-col h-full bg-background">
      {/* Header */}
      <div className="flex items-center gap-3 px-4 pt-12 pb-4">
        <button onClick={() => navigate(-1)} className="p-1 -ml-1">
          <ChevronLeft className="w-5 h-5" />
        </button>
        <div className="flex-1">
          <h1 className="text-lg font-semibold leading-tight">Uso de EPP</h1>
          <p className="text-xs text-muted-foreground">M63 · Por evento</p>
        </div>
        <HardHat className="w-5 h-5 text-muted-foreground" />
      </div>

      {/* Exportar consolidado */}
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

      {/* Lista */}
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
        {registros.map(r => {
          const okCount = eppOkCount(r)
          const allOk = okCount === 5
          return (
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
                  <p className="text-sm mt-1 font-medium">{r.aplicador}</p>
                  <div className="flex items-center gap-2 mt-1.5 flex-wrap">
                    <span
                      className="text-xs px-2 py-0.5 rounded font-medium"
                      style={{
                        backgroundColor: r.momento === 'inicio' ? 'var(--agro-success-fill)' : 'var(--muted)',
                        color: r.momento === 'inicio' ? 'var(--agro-success-text)' : 'var(--muted-foreground)',
                      }}
                    >
                      {r.momento === 'inicio' ? 'Inicio' : 'Fin'}
                    </span>
                    <span
                      className="text-xs px-2 py-0.5 rounded font-medium"
                      style={{
                        backgroundColor: allOk ? 'var(--agro-success-fill)' : 'var(--agro-warning-fill)',
                        color: allOk ? 'var(--agro-success-text)' : 'var(--agro-warning-text)',
                      }}
                    >
                      EPP: {okCount}/5 ok
                    </span>
                  </div>
                  {r.observaciones && (
                    <p className="text-xs mt-1 text-muted-foreground leading-snug">{r.observaciones}</p>
                  )}
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
          )
        })}
      </div>

      {/* FAB */}
      <div className="fixed bottom-safe-fab left-1/2 -translate-x-1/2 w-full max-w-[390px] flex justify-end px-4 pointer-events-none z-10 md:bottom-6">
        <button
          onClick={abrirNuevo}
          className="pointer-events-auto w-14 h-14 rounded-full text-white flex items-center justify-center active:scale-95 transition-transform"
          style={{ backgroundColor: 'var(--primary)' }}
          aria-label="Nuevo registro EPP"
        >
          <Plus className="w-6 h-6" />
        </button>
      </div>

      {/* Bottom sheet — Formulario */}
      <BottomSheet open={sheetOpen} onClose={() => setSheetOpen(false)}>
        <div className="flex items-center justify-between px-4 pt-4 pb-3 border-b border-border">
          <h2 className="text-base font-semibold">Nuevo registro de EPP</h2>
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
            <label className="block text-xs font-medium mb-1">Aplicador</label>
            <input
              type="text"
              className="w-full h-10 rounded-[0.625rem] border border-border bg-input-background px-3 text-sm"
              placeholder="Nombre del aplicador"
              value={form.aplicador}
              onChange={e => setForm(f => ({ ...f, aplicador: e.target.value }))}
            />
          </div>

          <div>
            <label className="block text-xs font-medium mb-1">Momento</label>
            <select
              className="w-full h-10 rounded-[0.625rem] border border-border bg-input-background px-3 text-sm"
              value={form.momento}
              onChange={e => setForm(f => ({ ...f, momento: e.target.value as 'inicio' | 'fin' }))}
            >
              <option value="inicio">Inicio de aplicacion</option>
              <option value="fin">Fin de aplicacion</option>
            </select>
          </div>

          <div>
            <p className="text-xs font-medium mb-2">Estado del EPP</p>
            <div className="space-y-2">
              {EPP_ITEMS.map(({ campo, label }) => {
                const val = form[campo]
                return (
                  <div key={campo} className="flex items-center justify-between rounded-[0.625rem] border border-border bg-card px-4 py-3">
                    <span className="text-sm font-medium">{label}</span>
                    <div className="flex items-center gap-2">
                      <span className="text-xs font-medium" style={{ color: val ? 'var(--agro-success-text)' : 'var(--agro-warning-text)' }}>
                        {val ? 'Buen estado' : 'Danado'}
                      </span>
                      <button
                        type="button"
                        onClick={() => setForm(f => ({ ...f, [campo]: !val }))}
                        className="relative inline-flex h-6 w-11 items-center rounded-full transition-colors"
                        style={{ backgroundColor: val ? 'var(--primary)' : 'var(--agro-amber)' }}
                      >
                        <span
                          className="inline-block h-4 w-4 rounded-full bg-white transition-transform"
                          style={{ transform: val ? 'translateX(22px)' : 'translateX(4px)' }}
                        />
                      </button>
                    </div>
                  </div>
                )
              })}
            </div>
          </div>

          <div>
            <label className="block text-xs font-medium mb-1">
              Realizo <span className="text-muted-foreground">(opcional)</span>
            </label>
            <input
              type="text"
              className="w-full h-10 rounded-[0.625rem] border border-border bg-input-background px-3 text-sm"
              placeholder="Nombre de quien realizo la verificacion"
              value={form.realizo}
              onChange={e => setForm(f => ({ ...f, realizo: e.target.value }))}
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
