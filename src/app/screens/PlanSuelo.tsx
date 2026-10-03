import { useState } from 'react'
import { Plus, FileDown, X, Loader2 } from 'lucide-react'
import { ModuloHeader } from '@/app/components/ModuloHeader'
import { useNavigate } from 'react-router'
import { BottomSheet } from '@/app/components/BottomSheet'
import { BotonExportarConsolidado } from '@/app/components/BotonExportarConsolidado'
import { toast } from 'sonner'
import { useAuthContext } from '@/context/AuthContext'
import { puedeEditarFechaLibre } from '@/lib/permisos'
import { useModulosContext } from '@/context/ModulosContext'
import { useRanchos } from '@/hooks/useRanchos'
import { useM59PlanSuelo, useM59Items } from '@/hooks/useM59PlanSuelo'
import { useOrganizacion } from '@/hooks/useOrganizacion'
import { supabase } from '@/lib/supabase'
import { generarPlanSueloPDF } from '@/lib/pdf/m59/generarPlanSueloPDF'
import { generarPlanSueloConsolidadoPDF } from '@/lib/pdf/m59/generarPlanSueloPDF'
import { Fab } from '@/app/components/Fab'
import { useContextoTarea } from '@/hooks/useContextoTarea'
import { BannerTareaOrigen } from '@/app/components/BannerTareaOrigen'
import { useFirmasRegistro } from '@/hooks/useFirmasRegistro'
import { FirmasRegistro } from '@/app/components/FirmasRegistro'
import { FirmaGatePaso } from '@/app/components/FirmaGatePaso'
import { PasoFirmaRegistro } from '@/app/components/PasoFirmaRegistro'
import { useFirmaContext } from '@/context/FirmaContext'

const hoyMX = () => new Date().toLocaleDateString('en-CA', { timeZone: 'America/Mexico_City' })

function formatFecha(iso: string): string {
  try {
    return new Date(iso + 'T12:00:00').toLocaleDateString('es-MX', { day: 'numeric', month: 'short', year: 'numeric' })
  } catch { return iso }
}

type Respuesta = 'si' | 'no' | 'na'

function siguienteRespuesta(v: Respuesta): Respuesta {
  if (v === 'si') return 'no'
  if (v === 'no') return 'na'
  return 'si'
}

function colorRespuesta(v: Respuesta): string {
  if (v === 'si') return 'var(--primary)'
  if (v === 'no') return 'var(--agro-red)'
  return 'var(--switch-background)'
}

function labelRespuesta(v: Respuesta): string {
  if (v === 'si') return 'Si'
  if (v === 'no') return 'No'
  return 'N/A'
}

type FormState = {
  rancho_id: string
  fecha: string
  realizo: string
  observaciones: string
}

const FORM_VACIO: FormState = {
  rancho_id: '',
  fecha: hoyMX(),
  realizo: '',
  observaciones: '',
}

export function PlanSuelo() {
  const navigate = useNavigate()
  const { profile, user, codigoClave } = useAuthContext()
  const esSuperAdmin = profile?.rol === 'super_admin'
  const puedeEditarFecha = esSuperAdmin || puedeEditarFechaLibre(user?.email)
  const { terminosSitio } = useModulosContext()
  const orgId = profile?.org_id ?? null
  const { ranchos } = useRanchos(orgId)
  const { ranchoInicial, tareaId } = useContextoTarea(ranchos)
  const { registros, loading, refetch } = useM59PlanSuelo(orgId)
  const { items } = useM59Items()
  const orgNombre = useOrganizacion(orgId)

  const { obligatoria, tengoFirma } = useFirmaContext()
  const todosIds = registros.map(r => r.id)
  const { firmas, loading: loadingFirmas, refetch: refetchFirmas } = useFirmasRegistro('M59', todosIds)

  const [sheetOpen, setSheetOpen] = useState(false)
  const [sheetPaso, setSheetPaso] = useState<'firma_gate' | 'form' | 'firma_decision'>('form')
  const [pendienteFirmaId, setPendienteFirmaId] = useState<string | null>(null)
  const [consolidadoOpen, setConsolidadoOpen] = useState(false)
  const [form, setForm] = useState<FormState>(FORM_VACIO)
  const [valores, setValores] = useState<Record<string, Respuesta>>({})
  const [comentarios, setComentarios] = useState<Record<string, string>>({})
  const [guardando, setGuardando] = useState(false)
  const [pdfLoading, setPdfLoading] = useState<string | null>(null)
  const [consolidadoForm, setConsolidadoForm] = useState({ rancho_id: '', desde: hoyMX(), hasta: hoyMX() })
  const [exportando, setExportando] = useState(false)

  function abrirNuevo() {
    setForm({ ...FORM_VACIO, rancho_id: ranchoInicial ?? '', fecha: hoyMX(), realizo: profile?.nombre_completo ?? '' })
    const init: Record<string, Respuesta> = {}
    for (const item of items) { init[item.id] = 'si' }
    setValores(init)
    setComentarios({})
    setPendienteFirmaId(null)
    setSheetPaso(obligatoria && !tengoFirma ? 'firma_gate' : 'form')
    setSheetOpen(true)
  }

  function handleCerrarSheet() {
    setSheetOpen(false)
    setSheetPaso('form')
    setPendienteFirmaId(null)
  }

  async function guardar() {
    if (!orgId) return
    if (!form.rancho_id) {
      toast.error(`Selecciona ${terminosSitio.genero === 'f' ? 'una' : 'un'} ${terminosSitio.singular}`)
      return
    }

    setGuardando(true)
    try {
      // Paso 1: insertar cabecera
      const { data: regData, error: regErr } = await (supabase as any)
        .from('m59_registro')
        .insert({
          org_id: orgId,
          rancho_id: form.rancho_id,
          fecha: form.fecha,
          realizo: form.realizo.trim() || null,
          observaciones: form.observaciones.trim() || null,
          creado_por: user?.id,
        })
        .select('id')
        .single()
      if (regErr) throw regErr
      const registroId = (regData as any).id as string

      // Paso 2: insertar resultados (llamada separada para que la RLS valide la cabecera)
      const batch = items.map(item => ({
        org_id: orgId,
        registro_id: registroId,
        item_id: item.id,
        respuesta: valores[item.id] ?? 'si',
        comentario: comentarios[item.id]?.trim() || null,
      }))
      const { error: resErr } = await (supabase as any).from('m59_resultados').insert(batch)
      if (resErr) throw resErr

      await refetch()
      toast.success('Inspección registrada')
      setPendienteFirmaId(registroId)
      setSheetPaso('firma_decision')
    } catch (e: any) {
      const msg: string = e?.message ?? 'Error al guardar'
      if (msg.includes('FIRMA_REQUERIDA')) {
        setSheetPaso('firma_gate')
        return
      } else if (msg.includes('FECHA_SOLO_HOY')) {
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
    if (obligatoria && !firmas[id]?.realizo) {
      toast.info('Firma el registro antes de generar el PDF')
      return
    }
    setPdfLoading(id)
    try {
      await generarPlanSueloPDF(id, orgId, codigoClave)
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
      await generarPlanSueloConsolidadoPDF(
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
      <ModuloHeader tituloFallback="Plan y Gestión del Suelo" subtitulo="M59 · Por evento" />
      <BannerTareaOrigen tareaId={tareaId} />

      <div className="px-4 pt-3 pb-4">
        <BotonExportarConsolidado onClick={() => setConsolidadoOpen(true)} />
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
                {r.realizo && <p className="text-xs text-muted-foreground mt-0.5">{r.realizo}</p>}
                {obligatoria && !firmas[r.id]?.realizo && (
                  <span className="text-[10px] px-2 py-0.5 rounded bg-agro-danger-fill text-agro-danger-text mt-1 inline-block">
                    Pendiente de firma
                  </span>
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
            <FirmasRegistro
              modulo="M59"
              registroId={r.id}
              fechaRegistro={r.fecha}
              firma={firmas[r.id]}
              loadingFirmas={loadingFirmas}
              onFirmado={async () => { await refetch(); await refetchFirmas() }}
            />
          </div>
        ))}
      </div>

            <Fab onClick={abrirNuevo} aria-label="Nueva inspección" />

      <BottomSheet open={sheetOpen} onClose={handleCerrarSheet} height="85%">
        {sheetPaso === 'firma_gate' && (
          <FirmaGatePaso onFirmaGuardada={() => setSheetPaso('form')} />
        )}
        {sheetPaso === 'firma_decision' && pendienteFirmaId && (
          <PasoFirmaRegistro
            modulo="M59"
            ids={[pendienteFirmaId]}
            descripcion={`Inspección de suelo del ${formatFecha(form.fecha)}`}
            obligatoria={obligatoria}
            onFirmadoYPDF={async () => {
              await generarPlanSueloPDF(pendienteFirmaId, orgId!, codigoClave)
              handleCerrarSheet()
              await refetchFirmas()
            }}
            onDespues={!obligatoria ? () => handleCerrarSheet() : undefined}
          />
        )}
        {sheetPaso === 'form' && (<>
        <div className="flex items-center justify-between px-4 pt-4 pb-3 border-b border-border">
          <h2 className="text-base font-semibold">Nueva inspección de suelo</h2>
          <button onClick={handleCerrarSheet}>
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
              <p className="text-xs font-medium mb-3">Checklist de gestión del suelo</p>
              <div className="space-y-3">
                {items.map(item => (
                  <div key={item.id} className="rounded-[0.625rem] border border-border bg-card p-3">
                    <div className="flex items-start gap-3 mb-2">
                      <span
                        className="text-xs font-semibold shrink-0 w-5 h-5 rounded-full flex items-center justify-center text-white"
                        style={{ backgroundColor: 'var(--muted-foreground)' }}
                      >
                        {item.numero}
                      </span>
                      <p className="text-sm flex-1 leading-snug">{item.descripcion}</p>
                      <button
                        type="button"
                        onClick={() => setValores(v => ({ ...v, [item.id]: siguienteRespuesta(v[item.id] ?? 'si') }))}
                        className="shrink-0 px-3 py-1 rounded-lg text-xs font-semibold text-white"
                        style={{ backgroundColor: colorRespuesta(valores[item.id] ?? 'si') }}
                      >
                        {labelRespuesta(valores[item.id] ?? 'si')}
                      </button>
                    </div>
                    <input
                      type="text"
                      className="w-full h-8 rounded-lg border border-border bg-input-background px-3 text-xs"
                      placeholder="Comentario (opcional)"
                      value={comentarios[item.id] ?? ''}
                      onChange={e => setComentarios(c => ({ ...c, [item.id]: e.target.value }))}
                    />
                  </div>
                ))}
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
            Guardar
          </button>
        </div>
        </>)}
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
