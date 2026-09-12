import { useState } from 'react'
import { ChevronLeft, Plus, FileDown, X, Loader2, Crosshair, Files } from 'lucide-react'
import { useNavigate } from 'react-router'
import { BottomSheet } from '@/app/components/BottomSheet'
import { toast } from 'sonner'
import { useAuthContext } from '@/context/AuthContext'
import { puedeEditarFechaLibre } from '@/lib/permisos'
import { useModulosContext } from '@/context/ModulosContext'
import { useRanchos } from '@/hooks/useRanchos'
import { useM55MipIntervencion, useM55Items } from '@/hooks/useM55MipIntervencion'
import { useOrganizacion } from '@/hooks/useOrganizacion'
import { supabase } from '@/lib/supabase'
import { generarMipIntervencionPDF, generarMipIntervencionConsolidadoPDF } from '@/lib/pdf/m55/generarMipIntervencionPDF'

const hoyMX = () => new Date().toLocaleDateString('en-CA', { timeZone: 'America/Mexico_City' })

function formatFecha(iso: string): string {
  try {
    return new Date(iso + 'T12:00:00').toLocaleDateString('es-MX', { day: 'numeric', month: 'short', year: 'numeric' })
  } catch { return iso }
}

type Marcas = {
  maleza: boolean
  insectos: boolean
  enfermedades: boolean
  vertebrados: boolean
  comentario: string
}

const MARCAS_INIT: Marcas = { maleza: false, insectos: false, enfermedades: false, vertebrados: false, comentario: '' }

type FormState = {
  rancho_id: string
  fecha: string
  producto: string
  region: string
  realizo: string
  observaciones: string
}

const FORM_VACIO: FormState = {
  rancho_id: '',
  fecha: hoyMX(),
  producto: '',
  region: '',
  realizo: '',
  observaciones: '',
}

function ToggleBtn({ activo, label, onToggle }: { activo: boolean; label: string; onToggle: () => void }) {
  return (
    <button
      type="button"
      onClick={onToggle}
      className="text-xs font-semibold px-2.5 py-1 rounded-lg border transition-colors"
      style={activo
        ? { backgroundColor: 'var(--primary)', color: '#fff', borderColor: 'var(--primary)' }
        : { backgroundColor: 'var(--input-background)', color: 'var(--muted-foreground)', borderColor: 'var(--border)' }
      }
    >
      {label}
    </button>
  )
}

export function MipIntervencion() {
  const navigate = useNavigate()
  const { profile, user, codigoClave } = useAuthContext()
  const esSuperAdmin = profile?.rol === 'super_admin'
  const puedeEditarFecha = esSuperAdmin || puedeEditarFechaLibre(user?.email)
  const { terminosSitio } = useModulosContext()
  const orgId = profile?.org_id ?? null
  const { ranchos } = useRanchos(orgId)
  const { registros, loading, refetch } = useM55MipIntervencion(orgId)
  const { items } = useM55Items()
  const orgNombre = useOrganizacion(orgId)

  const [sheetOpen, setSheetOpen] = useState(false)
  const [consolidadoOpen, setConsolidadoOpen] = useState(false)
  const [form, setForm] = useState<FormState>(FORM_VACIO)
  const [marcas, setMarcas] = useState<Record<string, Marcas>>({})
  const [otra, setOtra] = useState({ texto: '', maleza: false, insectos: false, enfermedades: false, vertebrados: false, comentario: '' })
  const [guardando, setGuardando] = useState(false)
  const [pdfLoading, setPdfLoading] = useState<string | null>(null)
  const [consolidadoForm, setConsolidadoForm] = useState({ rancho_id: '', desde: hoyMX(), hasta: hoyMX() })
  const [exportando, setExportando] = useState(false)

  function abrirNuevo() {
    setForm({ ...FORM_VACIO, fecha: hoyMX(), realizo: profile?.nombre_completo ?? '' })
    const init: Record<string, Marcas> = {}
    for (const item of items) { init[item.id] = { ...MARCAS_INIT } }
    setMarcas(init)
    setOtra({ texto: '', maleza: false, insectos: false, enfermedades: false, vertebrados: false, comentario: '' })
    setSheetOpen(true)
  }

  function toggleMarca(itemId: string, campo: keyof Pick<Marcas, 'maleza' | 'insectos' | 'enfermedades' | 'vertebrados'>) {
    setMarcas(m => ({ ...m, [itemId]: { ...(m[itemId] ?? MARCAS_INIT), [campo]: !(m[itemId]?.[campo] ?? false) } }))
  }

  async function guardar() {
    if (!orgId) return
    if (!form.rancho_id) { toast.error(`Selecciona ${terminosSitio.genero === 'f' ? 'una' : 'un'} ${terminosSitio.singular}`); return }

    setGuardando(true)
    try {
      const { data: regData, error: regErr } = await (supabase as any)
        .from('m55_registro')
        .insert({
          org_id: orgId,
          rancho_id: form.rancho_id,
          fecha: form.fecha,
          producto: form.producto.trim() || null,
          region: form.region.trim() || null,
          realizo: form.realizo.trim() || null,
          observaciones: form.observaciones.trim() || null,
          creado_por: user?.id,
        })
        .select('id')
        .single()
      if (regErr) throw regErr
      const registroId = (regData as any).id as string

      const batch: any[] = [
        ...items
          .filter(item => {
            const m = marcas[item.id]
            return m && (m.maleza || m.insectos || m.enfermedades || m.vertebrados || m.comentario.trim())
          })
          .map(item => {
            const m = marcas[item.id]!
            return {
              org_id: orgId,
              registro_id: registroId,
              item_id: item.id,
              tecnica_otra: null,
              contra_maleza: m.maleza,
              contra_insectos: m.insectos,
              contra_enfermedades: m.enfermedades,
              contra_vertebrados: m.vertebrados,
              comentario: m.comentario.trim() || null,
            }
          }),
      ]

      if (otra.texto.trim() && (otra.maleza || otra.insectos || otra.enfermedades || otra.vertebrados || otra.comentario.trim())) {
        batch.push({
          org_id: orgId,
          registro_id: registroId,
          item_id: null,
          tecnica_otra: otra.texto.trim(),
          contra_maleza: otra.maleza,
          contra_insectos: otra.insectos,
          contra_enfermedades: otra.enfermedades,
          contra_vertebrados: otra.vertebrados,
          comentario: otra.comentario.trim() || null,
        })
      }

      if (batch.length > 0) {
        const { error: resErr } = await (supabase as any).from('m55_resultados').insert(batch)
        if (resErr) throw resErr
      }

      setSheetOpen(false)
      await refetch()
      toast.success('MIP Intervención registrado')

      try {
        await generarMipIntervencionPDF(registroId, orgId, codigoClave)
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
      await generarMipIntervencionPDF(id, orgId, codigoClave)
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
      await generarMipIntervencionConsolidadoPDF(
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
          <h1 className="text-lg font-semibold leading-tight">MIP · Técnicas de Intervención</h1>
          <p className="text-xs text-muted-foreground">M55 · Por evento</p>
        </div>
        <Crosshair className="w-5 h-5 text-muted-foreground" />
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
                {r.producto && <p className="text-sm mt-1 text-muted-foreground">{r.producto}</p>}
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
          aria-label="Nuevo registro"
        >
          <Plus className="w-6 h-6" />
        </button>
      </div>

      <BottomSheet open={sheetOpen} onClose={() => setSheetOpen(false)} height="85%">
        <div className="flex items-center justify-between px-4 pt-4 pb-3 border-b border-border">
          <h2 className="text-base font-semibold">Nuevo registro MIP Intervención</h2>
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
            <label className="block text-xs font-medium mb-1">
              Producto / Cultivo <span className="text-muted-foreground">(opcional)</span>
            </label>
            <input
              type="text"
              className="w-full h-10 rounded-[0.625rem] border border-border bg-input-background px-3 text-sm"
              placeholder="Ej. Zarzamora, Tomate..."
              value={form.producto}
              onChange={e => setForm(f => ({ ...f, producto: e.target.value }))}
            />
          </div>

          <div>
            <label className="block text-xs font-medium mb-1">
              Región <span className="text-muted-foreground">(opcional)</span>
            </label>
            <input
              type="text"
              className="w-full h-10 rounded-[0.625rem] border border-border bg-input-background px-3 text-sm"
              placeholder="Ej. Norte, Sector A..."
              value={form.region}
              onChange={e => setForm(f => ({ ...f, region: e.target.value }))}
            />
          </div>

          <div>
            <label className="block text-xs font-medium mb-1">
              Realizó <span className="text-muted-foreground">(opcional)</span>
            </label>
            <input
              type="text"
              className="w-full h-10 rounded-[0.625rem] border border-border bg-input-background px-3 text-sm"
              placeholder="Nombre completo"
              value={form.realizo}
              onChange={e => setForm(f => ({ ...f, realizo: e.target.value }))}
            />
          </div>

          <div>
            <label className="block text-xs font-medium mb-1">
              Observaciones <span className="text-muted-foreground">(opcional)</span>
            </label>
            <textarea
              rows={2}
              className="w-full rounded-[0.625rem] border border-border bg-input-background px-3 py-2 text-sm resize-none"
              value={form.observaciones}
              onChange={e => setForm(f => ({ ...f, observaciones: e.target.value }))}
            />
          </div>

          {items.length > 0 && (
            <div>
              <p className="text-xs font-medium mb-1">Matriz de técnicas de intervención</p>
              <p className="text-xs text-muted-foreground mb-3">
                Marca los tipos de problema para cada técnica aplicada.
              </p>
              <div className="space-y-2">
                {items.map(item => {
                  const m = marcas[item.id] ?? MARCAS_INIT
                  return (
                    <div key={item.id} className="rounded-[0.625rem] border border-border bg-card p-3">
                      <div className="flex items-start gap-2 mb-2">
                        <span
                          className="text-xs font-semibold shrink-0 w-5 h-5 rounded-full flex items-center justify-center text-white"
                          style={{ backgroundColor: 'var(--muted-foreground)', fontSize: '10px' }}
                        >
                          {item.numero}
                        </span>
                        <p className="text-xs flex-1 leading-snug text-foreground">{item.texto}</p>
                      </div>
                      <div className="flex flex-wrap gap-1.5 mb-2">
                        <ToggleBtn activo={m.maleza} label="Maleza" onToggle={() => toggleMarca(item.id, 'maleza')} />
                        <ToggleBtn activo={m.insectos} label="Insectos" onToggle={() => toggleMarca(item.id, 'insectos')} />
                        <ToggleBtn activo={m.enfermedades} label="Enfermedades" onToggle={() => toggleMarca(item.id, 'enfermedades')} />
                        <ToggleBtn activo={m.vertebrados} label="Vertebrados" onToggle={() => toggleMarca(item.id, 'vertebrados')} />
                      </div>
                      <input
                        type="text"
                        className="w-full h-8 rounded-lg border border-border bg-input-background px-3 text-xs"
                        placeholder="Comentario (opcional)"
                        value={m.comentario}
                        onChange={e => setMarcas(mp => ({ ...mp, [item.id]: { ...(mp[item.id] ?? MARCAS_INIT), comentario: e.target.value } }))}
                      />
                    </div>
                  )
                })}

                <div className="rounded-[0.625rem] border border-border bg-card p-3">
                  <p className="text-xs font-semibold mb-2 text-muted-foreground">Otra técnica (opcional)</p>
                  <input
                    type="text"
                    className="w-full h-8 rounded-lg border border-border bg-input-background px-3 text-xs mb-2"
                    placeholder="Describe la técnica..."
                    value={otra.texto}
                    onChange={e => setOtra(o => ({ ...o, texto: e.target.value }))}
                  />
                  <div className="flex flex-wrap gap-1.5 mb-2">
                    <ToggleBtn activo={otra.maleza} label="Maleza" onToggle={() => setOtra(o => ({ ...o, maleza: !o.maleza }))} />
                    <ToggleBtn activo={otra.insectos} label="Insectos" onToggle={() => setOtra(o => ({ ...o, insectos: !o.insectos }))} />
                    <ToggleBtn activo={otra.enfermedades} label="Enfermedades" onToggle={() => setOtra(o => ({ ...o, enfermedades: !o.enfermedades }))} />
                    <ToggleBtn activo={otra.vertebrados} label="Vertebrados" onToggle={() => setOtra(o => ({ ...o, vertebrados: !o.vertebrados }))} />
                  </div>
                  <input
                    type="text"
                    className="w-full h-8 rounded-lg border border-border bg-input-background px-3 text-xs"
                    placeholder="Comentario (opcional)"
                    value={otra.comentario}
                    onChange={e => setOtra(o => ({ ...o, comentario: e.target.value }))}
                  />
                </div>
              </div>
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
