import { useState } from 'react'
import { Plus, FileDown, X, Loader2, Check } from 'lucide-react'
import { ModuloHeader } from '@/app/components/ModuloHeader'
import { useNavigate } from 'react-router'
import { BottomSheet } from '@/app/components/BottomSheet'
import { BotonExportarConsolidado } from '@/app/components/BotonExportarConsolidado'
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
  const { ranchoInicial, tareaId } = useContextoTarea(ranchos)
  const { registros, loading, refetch } = useM68MonitoreoRoedores(orgId)
  const { criterios } = useM68Criterios()
  const orgNombre = useOrganizacion(orgId)

  const { obligatoria, tengoFirma } = useFirmaContext()
  const todosIds = registros.map(r => r.id)
  const { firmas, loading: loadingFirmas, refetch: refetchFirmas } = useFirmasRegistro('M68', todosIds)

  const [sheetOpen, setSheetOpen] = useState(false)
  const [sheetPaso, setSheetPaso] = useState<'firma_gate' | 'form' | 'firma_decision'>('form')
  const [pendienteFirmaId, setPendienteFirmaId] = useState<string | null>(null)
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
    setForm({ ...FORM_VACIO, rancho_id: ranchoInicial ?? '', fecha: hoyMX(), responsable: profile?.nombre_completo ?? '' })
    setMatriz(iniciarMatriz(numT))
    setPendienteFirmaId(null)
    setSheetPaso(obligatoria && !tengoFirma ? 'firma_gate' : 'form')
    setSheetOpen(true)
  }

  function handleCerrarSheet() {
    setSheetOpen(false)
    setSheetPaso('form')
    setPendienteFirmaId(null)
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

      await refetch()
      toast.success('Monitoreo registrado')
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
      <ModuloHeader tituloFallback="Monitoreo de Trampas para Roedores" subtitulo="M68 · REG-23 · Por evento" />
      <BannerTareaOrigen tareaId={tareaId} />

      <div className="px-4 pt-3">
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
                <p className="text-sm mt-0.5">{r.ubicacion}</p>
                <p className="text-xs text-muted-foreground mt-0.5">{r.num_trampas} trampas</p>
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
              modulo="M68"
              registroId={r.id}
              fechaRegistro={r.fecha}
              firma={firmas[r.id]}
              loadingFirmas={loadingFirmas}
              onFirmado={async () => { await refetch(); await refetchFirmas() }}
            />
          </div>
        ))}
      </div>

            <Fab onClick={abrirNuevo} aria-label="Nuevo monitoreo" />

      <BottomSheet open={sheetOpen} onClose={handleCerrarSheet} height="85%">
        {sheetPaso === 'firma_gate' && (
          <FirmaGatePaso onFirmaGuardada={() => setSheetPaso('form')} />
        )}
        {sheetPaso === 'firma_decision' && pendienteFirmaId && (
          <PasoFirmaRegistro
            modulo="M68"
            ids={[pendienteFirmaId]}
            descripcion={`Monitoreo del ${formatFecha(form.fecha)}`}
            obligatoria={obligatoria}
            onFirmadoYPDF={async () => {
              await generarMonitoreoRoedoresPDF(pendienteFirmaId, orgId!, codigoClave)
              handleCerrarSheet()
              await refetchFirmas()
            }}
            onDespues={!obligatoria ? () => handleCerrarSheet() : undefined}
          />
        )}
        {sheetPaso === 'form' && (<>
        <div className="flex items-center justify-between px-4 pt-4 pb-3 border-b border-border">
          <h2 className="text-base font-semibold">Nuevo monitoreo</h2>
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
