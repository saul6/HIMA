import { useState } from 'react'
import { Plus, FileDown, X, Loader2, WifiOff } from 'lucide-react'
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
import { useConexion } from '@/hooks/useConexion'
import { useGuardarOffline } from '@/hooks/useGuardarOffline'
import { opInsert } from '@/lib/offline/construirOperaciones'
import { generarMipIntervencionPDF, generarMipIntervencionConsolidadoPDF } from '@/lib/pdf/m55/generarMipIntervencionPDF'
import { Fab } from '@/app/components/Fab'
import { BotonExportarConsolidado } from '@/app/components/BotonExportarConsolidado'
import { ModuloHeader } from '@/app/components/ModuloHeader'
import { useContextoTarea } from '@/hooks/useContextoTarea'
import { BannerTareaOrigen } from '@/app/components/BannerTareaOrigen'
import { useFirmasRegistro } from '@/hooks/useFirmasRegistro'
import { FirmasRegistro } from '@/app/components/FirmasRegistro'
import { FirmaGatePaso } from '@/app/components/FirmaGatePaso'
import { PasoFirmaRegistro } from '@/app/components/PasoFirmaRegistro'
import { useFirmaContext } from '@/context/FirmaContext'
import { useMostrarCarga } from '@/hooks/useMostrarCarga'
import { ListaSkeleton } from '@/app/components/ListaSkeleton'
import { TextareaContador } from '@/app/components/TextareaContador'
import { limiteTexto } from '@/lib/limitesTexto'
import { InputContador } from '@/app/components/InputContador'
import { PendientesOffline } from '@/app/components/PendientesOffline'
import { EstadoVacio } from '@/app/components/ui-mady/EstadoVacio'
import { ListaTarjetas } from '@/app/components/ui-mady/ListaTarjetas'
import { TarjetaRegistro } from '@/app/components/ui-mady/TarjetaRegistro'
import { TextoColapsable } from '@/app/components/ui-mady/TextoColapsable'
import { resumenFirmas, textoResumenLista } from '@/hooks/resumenFirmas'
import { Etiqueta } from '@/app/components/ui-mady/Etiqueta'
import { Boton } from '@/app/components/ui-mady/Boton'
import { fechaCorta } from '@/lib/formato'

const hoyMX = () => new Date().toLocaleDateString('en-CA', { timeZone: 'America/Mexico_City' })

function formatFecha(iso: string): string {
  try {
    return fechaCorta(iso)
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
  const { ranchos } = useRanchos()
  const { ranchoInicial, tareaId } = useContextoTarea(ranchos)
  const { registros, loading, refetch } = useM55MipIntervencion(orgId)
  const mostrarSkeleton = useMostrarCarga(loading, registros.length > 0)
  const { items } = useM55Items()
  const orgNombre = useOrganizacion(orgId)
  const { online } = useConexion()
  const { guardar: guardarOffline } = useGuardarOffline('M55')

  const { obligatoria, tengoFirma } = useFirmaContext()
  const todosIds = registros.map(r => r.id)
  const { firmas, loading: loadingFirmas, refetch: refetchFirmas } = useFirmasRegistro('M55', todosIds)
  // Sin datos de firmas todavía (cargando): franja neutra y sin conteo de pendientes.
  const sinDatosFirmas = loadingFirmas || (registros.length > 0 && Object.keys(firmas).length === 0)
  const pendientesFirma = sinDatosFirmas
    ? null
    : registros.filter(r => resumenFirmas(firmas[r.id]).estado === 'pendiente').length

  const [sheetOpen, setSheetOpen] = useState(false)
  const [sheetPaso, setSheetPaso] = useState<'firma_gate' | 'form' | 'firma_decision'>('form')
  const [pendienteFirmaId, setPendienteFirmaId] = useState<string | null>(null)
  const [consolidadoOpen, setConsolidadoOpen] = useState(false)
  const [form, setForm] = useState<FormState>(FORM_VACIO)
  const [marcas, setMarcas] = useState<Record<string, Marcas>>({})
  const [otra, setOtra] = useState({ texto: '', maleza: false, insectos: false, enfermedades: false, vertebrados: false, comentario: '' })
  const [guardando, setGuardando] = useState(false)
  const [pdfLoading, setPdfLoading] = useState<string | null>(null)
  const [consolidadoForm, setConsolidadoForm] = useState({ rancho_id: '', desde: hoyMX(), hasta: hoyMX() })
  const [exportando, setExportando] = useState(false)

  function abrirNuevo() {
    setForm({ ...FORM_VACIO, rancho_id: ranchoInicial ?? '', fecha: hoyMX(), realizo: profile?.nombre_completo ?? '' })
    const init: Record<string, Marcas> = {}
    for (const item of items) { init[item.id] = { ...MARCAS_INIT } }
    setMarcas(init)
    setOtra({ texto: '', maleza: false, insectos: false, enfermedades: false, vertebrados: false, comentario: '' })
    setPendienteFirmaId(null)
    setSheetPaso(obligatoria && !tengoFirma ? 'firma_gate' : 'form')
    setSheetOpen(true)
  }

  function handleCerrarSheet() {
    setSheetOpen(false)
    setSheetPaso('form')
    setPendienteFirmaId(null)
  }

  function toggleMarca(itemId: string, campo: keyof Pick<Marcas, 'maleza' | 'insectos' | 'enfermedades' | 'vertebrados'>) {
    setMarcas(m => ({ ...m, [itemId]: { ...(m[itemId] ?? MARCAS_INIT), [campo]: !(m[itemId]?.[campo] ?? false) } }))
  }

  function armarResultados(registroId: string): any[] {
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
    return batch
  }

  async function guardar() {
    if (!orgId) return
    if (!form.rancho_id) { toast.error(`Selecciona ${terminosSitio.genero === 'f' ? 'una' : 'un'} ${terminosSitio.singular}`); return }

    setGuardando(true)
    try {
      if (!online) {
        const registroId = crypto.randomUUID()
        const rancho = ranchos.find(r => r.id === form.rancho_id)
        const ok = await guardarOffline({
          descripcion: `MIP Intervención · ${rancho?.nombre ?? ''} · ${form.fecha}`,
          metadatos: { rancho_id: form.rancho_id, rancho_nombre: rancho?.nombre, fecha: form.fecha },
          operaciones: [
            opInsert('m55_registro', {
              id: registroId,
              rancho_id: form.rancho_id,
              fecha: form.fecha,
              producto: form.producto.trim() || null,
              region: form.region.trim() || null,
              realizo: form.realizo.trim() || null,
              observaciones: form.observaciones.trim() || null,
            }),
            ...armarResultados(registroId).map(({ org_id: _org, ...r }) => opInsert('m55_resultados', r)),
          ],
        })
        if (ok) { setSheetOpen(false); setSheetPaso('form') }
        return
      }

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

      const batch: any[] = armarResultados(registroId)

      if (batch.length > 0) {
        const { error: resErr } = await (supabase as any).from('m55_resultados').insert(batch)
        if (resErr) throw resErr
      }

      await refetch()
      toast.success('MIP Intervención registrado')
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
    if (!online) { toast.warning('Necesitas conexión para generar el PDF'); return }
    if (obligatoria && !firmas[id]?.realizo) {
      toast.info('Firma el registro antes de generar el PDF')
      return
    }
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
    if (!online) { toast.warning('Necesitas conexión para generar el PDF'); return }
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
      <ModuloHeader
        tituloFallback="MIP · Técnicas de Intervención"
        subtitulo="M55 · Por evento"
        subtituloEscritorio={
          loading && registros.length === 0
            ? undefined
            : `M55 · Por evento · ${textoResumenLista(registros.length, pendientesFirma)}`
        }
        acciones={<BotonExportarConsolidado variante="encabezado" onClick={() => setConsolidadoOpen(true)} />}
      />

      <BannerTareaOrigen tareaId={tareaId} />

      <div className="px-4 pt-3 pb-4 min-[1224px]:hidden">
        <BotonExportarConsolidado onClick={() => setConsolidadoOpen(true)} />
      </div>

      <div className="flex-1 px-4 pb-32 space-y-3 overflow-y-auto min-[1224px]:pt-4">
        <PendientesOffline modulo="M55" />
        {mostrarSkeleton ? (
          <ListaSkeleton rejilla />
        ) : loading && registros.length === 0 ? (
          <div style={{ minHeight: '280px' }} />
        ) : registros.length === 0 ? (
          <EstadoVacio titulo="Sin registros. Usa el botón + para agregar." />
        ) : null}
        <ListaTarjetas>
          {registros.map(r => {
            const resumen = resumenFirmas(firmas[r.id], sinDatosFirmas)
            // requiere_correccion solo se usa si el registro ya lo trae (la consulta no se cambia)
            const requiereCorreccion = (r as any).requiere_correccion === true
            return (
              <TarjetaRegistro
                key={r.id}
                className="rounded-[0.625rem]"
                estado={requiereCorreccion ? 'correccion' : resumen.estado}
                firmas={resumen.estado === 'neutro' ? null : resumen}
                meta={[
                  <>
                    {orgNombre && <span className="font-medium">{orgNombre} · </span>}
                    <span className="text-sm font-semibold text-foreground @min-[972px]/lista:text-xs">{r.rancho_nombre}</span>
                  </>,
                  formatFecha(r.fecha),
                ]}
                chips={(
                  <>
                    {r.producto && (
                    <div className="basis-full">
                      <TextoColapsable texto={r.producto} className="text-sm text-muted-foreground" />
                    </div>
                    )}
                  </>
                )}
                chipMovil={obligatoria && !firmas[r.id]?.realizo && (
                  <Etiqueta tono="error">
                    Pendiente de firma
                  </Etiqueta>
                )}
                acciones={(
                  <button
                    onClick={() => descargarPDF(r.id)}
                    disabled={pdfLoading === r.id}
                    className="p-2 rounded-lg border border-border shrink-0"
                    aria-label="Descargar PDF"
                  >
                    {pdfLoading === r.id
                      ? <Loader2 className="w-4 h-4 animate-spin" />
                      : <FileDown className="w-4 h-4" style={{ color: 'var(--primary)' }} />
                    }
                  </button>
                )}
                pie={(
                  <FirmasRegistro
                    variante="escritorio"
                    modulo="M55"
                    registroId={r.id}
                    fechaRegistro={r.fecha}
                    firma={firmas[r.id]}
                    loadingFirmas={loadingFirmas}
                    onFirmado={async () => { await refetch(); await refetchFirmas() }}
                  />
                )}
              />
            )
          })}
        </ListaTarjetas>
      </div>

            <Fab onClick={abrirNuevo} aria-label="Nuevo registro" />

      <BottomSheet open={sheetOpen} onClose={handleCerrarSheet} height="85%">
        {sheetPaso === 'firma_gate' && (
          <FirmaGatePaso onFirmaGuardada={() => setSheetPaso('form')} />
        )}
        {sheetPaso === 'firma_decision' && pendienteFirmaId && (
          <PasoFirmaRegistro
            modulo="M55"
            ids={[pendienteFirmaId]}
            descripcion={`MIP Intervención del ${formatFecha(form.fecha)}`}
            obligatoria={obligatoria}
            onFirmadoYPDF={async () => {
              await generarMipIntervencionPDF(pendienteFirmaId, orgId!, codigoClave)
              handleCerrarSheet()
              await refetchFirmas()
            }}
            onDespues={!obligatoria ? () => handleCerrarSheet() : undefined}
          />
        )}
        {sheetPaso === 'form' && (<>
        <div className="flex items-center justify-between px-4 pt-4 pb-3 border-b border-border">
          <h2 className="text-base font-semibold">Nuevo registro MIP Intervención</h2>
          <button aria-label="Cerrar" onClick={handleCerrarSheet}>
            <X className="w-5 h-5" />
          </button>
        </div>
        <div className="overflow-y-auto flex-1 px-4 pt-4 pb-8 space-y-4">

          <div>
            <label className="block text-xs font-medium mb-1">{terminosSitio.singular}</label>
            <select
              className="w-full h-10 rounded-[0.625rem] border border-border-control bg-input-background px-3 text-sm"
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
              className="w-full h-10 rounded-[0.625rem] border border-border-control bg-input-background px-3 text-sm"
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
            <InputContador limite={limiteTexto('m55_registro', 'producto')}
              type="text"
              className="w-full h-10 rounded-[0.625rem] border border-border-control bg-input-background px-3 text-sm"
              placeholder="Ej. Zarzamora, Tomate..."
              value={form.producto}
              onChange={e => setForm(f => ({ ...f, producto: e.target.value }))}
            />
          </div>

          <div>
            <label className="block text-xs font-medium mb-1">
              Región <span className="text-muted-foreground">(opcional)</span>
            </label>
            <input maxLength={limiteTexto('m55_registro', 'region')}
              type="text"
              className="w-full h-10 rounded-[0.625rem] border border-border-control bg-input-background px-3 text-sm"
              placeholder="Ej. Norte, Sector A..."
              value={form.region}
              onChange={e => setForm(f => ({ ...f, region: e.target.value }))}
            />
          </div>

          <div>
            <label className="block text-xs font-medium mb-1">
              Realizó <span className="text-muted-foreground">(opcional)</span>
            </label>
            <input maxLength={limiteTexto('m55_registro', 'realizo')}
              type="text"
              className="w-full h-10 rounded-[0.625rem] border border-border-control bg-input-background px-3 text-sm"
              placeholder="Nombre completo"
              value={form.realizo}
              onChange={e => setForm(f => ({ ...f, realizo: e.target.value }))}
            />
          </div>

          <div>
            <label className="block text-xs font-medium mb-1">
              Observaciones <span className="text-muted-foreground">(opcional)</span>
            </label>
            <TextareaContador limite={limiteTexto('m55_registro', 'observaciones')}
              rows={2}
              className="w-full rounded-[0.625rem] border border-border-control bg-input-background px-3 py-2 text-sm resize-none"
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
                      <InputContador limite={limiteTexto('m55_resultados', 'comentario')}
                        type="text"
                        className="w-full h-8 rounded-lg border border-border-control bg-input-background px-3 text-xs"
                        placeholder="Comentario (opcional)"
                        value={m.comentario}
                        onChange={e => setMarcas(mp => ({ ...mp, [item.id]: { ...(mp[item.id] ?? MARCAS_INIT), comentario: e.target.value } }))}
                      />
                    </div>
                  )
                })}

                <div className="rounded-[0.625rem] border border-border bg-card p-3">
                  <p className="text-xs font-semibold mb-2 text-muted-foreground">Otra técnica (opcional)</p>
                  <input maxLength={limiteTexto('m55_resultados', 'tecnica_otra')}
                    type="text"
                    className="w-full h-8 rounded-lg border border-border-control bg-input-background px-3 text-xs mb-2"
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
                  <InputContador limite={limiteTexto('m55_resultados', 'comentario')}
                    type="text"
                    className="w-full h-8 rounded-lg border border-border-control bg-input-background px-3 text-xs"
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
          <Boton onClick={guardar} cargando={guardando} className="w-full">
            {guardando && <Loader2 className="w-4 h-4 animate-spin" />}
            {!guardando && !online && <WifiOff className="w-4 h-4" />}
            {online ? 'Guardar' : 'Guardar sin conexión'}
          </Boton>
        </div>
        </>)}
      </BottomSheet>

      <BottomSheet open={consolidadoOpen} onClose={() => setConsolidadoOpen(false)}>
        <div className="flex items-center justify-between px-4 pt-4 pb-3 border-b border-border">
          <h2 className="text-base font-semibold">Exportar consolidado</h2>
          <button aria-label="Cerrar" onClick={() => setConsolidadoOpen(false)}>
            <X className="w-5 h-5" />
          </button>
        </div>
        <div className="overflow-y-auto flex-1 px-4 pt-4 pb-8 space-y-4">
          <div>
            <label className="block text-xs font-medium mb-1">
              {terminosSitio.singular} <span className="text-muted-foreground">(opcional)</span>
            </label>
            <select
              className="w-full h-10 rounded-[0.625rem] border border-border-control bg-input-background px-3 text-sm"
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
              className="w-full h-10 rounded-[0.625rem] border border-border-control bg-input-background px-3 text-sm"
              value={consolidadoForm.desde}
              onChange={e => setConsolidadoForm(f => ({ ...f, desde: e.target.value }))}
            />
          </div>
          <div>
            <label className="block text-xs font-medium mb-1">Hasta</label>
            <input
              type="date"
              className="w-full h-10 rounded-[0.625rem] border border-border-control bg-input-background px-3 text-sm"
              value={consolidadoForm.hasta}
              onChange={e => setConsolidadoForm(f => ({ ...f, hasta: e.target.value }))}
            />
          </div>
        </div>
        <div className="px-4 pb-6 pt-3 border-t border-border">
          <Boton onClick={exportarConsolidado} cargando={exportando} className="w-full">
            {exportando ? <Loader2 className="w-4 h-4 animate-spin" /> : <FileDown className="w-4 h-4" />}
            Exportar PDF
          </Boton>
        </div>
      </BottomSheet>
    </div>
  )
}
