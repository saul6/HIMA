// M82 · Recepción diaria de fruta por ítem. Captura de 5 datos (fecha, hora, productor, ítem, cajas);
// el bloque de la hoja y ORG/CONV salen del catálogo. Precaptura → dictamen (Aceptar / Retener / Rechazar).
import { useEffect, useMemo, useState } from 'react'
import { X, Loader2, FileDown, PackageOpen, TriangleAlert, Trash2, Search } from 'lucide-react'
import { toast } from 'sonner'
import { BottomSheet } from '@/app/components/BottomSheet'
import { ModuloHeader } from '@/app/components/ModuloHeader'
import { Fab } from '@/app/components/Fab'
import { Boton } from '@/app/components/ui-mady/Boton'
import { TituloSeccion } from '@/app/components/ui-mady/TituloSeccion'
import { EstadoVacio } from '@/app/components/ui-mady/EstadoVacio'
import { ListaSkeleton } from '@/app/components/ListaSkeleton'
import { FirmasRegistro } from '@/app/components/FirmasRegistro'
import { useFirmasRegistro } from '@/hooks/useFirmasRegistro'
import { useAuthContext } from '@/context/AuthContext'
import { useModulosContext } from '@/context/ModulosContext'
import { useRanchos } from '@/hooks/useRanchos'
import { codigoFormato } from '@/lib/codigoFormato'
import { hoyMX } from '@/lib/fecha'
import { fechaCorta } from '@/lib/formato'
import {
  useM82Catalogo, useM82Entregas, crearEntregaM82, dictaminarEntregaM82, borrarEntregaM82, mensajeErrorM82,
  type M82Entrega, type M82Estado, type M82Item,
} from '@/hooks/useM82Recepcion'
import { generarRecepcionPorItemPDF } from '@/lib/pdf/m82/generarRecepcionPorItemPDF'

const fieldCls = 'w-full h-10 rounded-[0.625rem] border border-border-control bg-input-background px-3 text-sm'
const CLAVE_EMPRESA = 'mady.m82.ultimaEmpresa'

function leerEmpresa(): string { try { return localStorage.getItem(CLAVE_EMPRESA) ?? '' } catch { return '' } }
function guardarEmpresa(v: string) { try { localStorage.setItem(CLAVE_EMPRESA, v) } catch { /* sin almacenamiento */ } }
function horaAhora(): string {
  return new Date().toLocaleTimeString('en-GB', { timeZone: 'America/Mexico_City', hour: '2-digit', minute: '2-digit', hour12: false })
}
function avisar(e: any) {
  const m = mensajeErrorM82(e)
  if (m.tipo === 'warning') toast.warning(m.texto, { duration: 7000 }); else toast.error(m.texto, { duration: 7000 })
}

const ESTADO_UI: Record<M82Estado, { texto: string; fondo: string; color: string }> = {
  PRECAPTURA: { texto: 'Precaptura', fondo: 'var(--agro-info-fill)', color: 'var(--agro-info-text)' },
  ACEPTADA: { texto: 'Aceptada', fondo: 'var(--agro-success-fill)', color: 'var(--agro-success-text)' },
  RETENIDA: { texto: 'Retenida', fondo: 'var(--muted)', color: 'var(--foreground)' },
  RECHAZADA: { texto: 'Rechazada', fondo: 'var(--agro-danger-fill)', color: 'var(--agro-danger-text)' },
}

interface LineaForm { codigo: string; cajas: string }

function ToggleSiX({ etiqueta, valor, onChange }: { etiqueta: string; valor: boolean | null; onChange: (v: boolean) => void }) {
  const base = 'flex-1 h-9 rounded-[0.625rem] border text-sm font-semibold'
  return (
    <div className="space-y-1">
      <p className="text-xs text-muted-foreground font-semibold">{etiqueta}</p>
      <div className="flex gap-1">
        <button type="button" onClick={() => onChange(true)}
          className={`${base} ${valor === true ? 'bg-primary text-primary-foreground border-primary' : 'border-border-control'}`}>Si</button>
        <button type="button" onClick={() => onChange(false)}
          className={base}
          style={valor === false ? { backgroundColor: 'var(--agro-danger-fill)', color: 'var(--agro-danger-text)', borderColor: 'var(--agro-red)' } : { borderColor: 'var(--border-control)' }}>X</button>
      </div>
    </div>
  )
}

export function RecepcionPorItem() {
  const { profile, codigoClave } = useAuthContext()
  const orgId = profile?.org_id ?? null
  const esSuperAdmin = profile?.rol === 'super_admin'
  const { terminosSitio } = useModulosContext()
  const { ranchos } = useRanchos()
  const { bloques, items, loading: loadingCat } = useM82Catalogo()
  const [fecha, setFecha] = useState(hoyMX())
  const { entregas, loading, error, refetch } = useM82Entregas(fecha)
  const ids = useMemo(() => entregas.filter(e => e.estado === 'ACEPTADA').map(e => e.id), [entregas])
  const { firmas, loading: loadingFirmas, refetch: refetchFirmas } = useFirmasRegistro('M82', ids)
  const codigoFmt = codigoFormato('F-FRUS-PRO-02', codigoClave)

  const itemPorCodigo = useMemo(() => new Map(items.map(i => [i.codigo, i])), [items])
  const bloquePorId = useMemo(() => new Map(bloques.map(b => [b.id, b])), [bloques])
  const tituloBloque = (i?: M82Item) => (i ? bloquePorId.get(i.bloque_id)?.titulo ?? '' : '')

  // ── Nueva entrega
  const [sheet, setSheet] = useState<null | 'nueva' | 'dictamen'>(null)
  const [guardando, setGuardando] = useState(false)
  const [ranchoId, setRanchoId] = useState('')
  const [hora, setHora] = useState(horaAhora())
  const [empresa, setEmpresa] = useState('')
  const [productor, setProductor] = useState('')
  const [lineas, setLineas] = useState<LineaForm[]>([])
  const [busqueda, setBusqueda] = useState('')
  const [filtroBloque, setFiltroBloque] = useState<string>('')

  useEffect(() => { if (ranchos.length === 1) setRanchoId(ranchos[0].id) }, [ranchos])

  function abrirNueva() {
    setHora(horaAhora()); setEmpresa(leerEmpresa()); setProductor(''); setLineas([]); setBusqueda(''); setFiltroBloque('')
    if (ranchos.length === 1) setRanchoId(ranchos[0].id)
    setSheet('nueva')
  }

  const sugerencias = useMemo(() => {
    const q = busqueda.trim().toLowerCase()
    return items.filter(i =>
      (!filtroBloque || i.bloque_id === filtroBloque)
      && (!q || i.codigo.startsWith(q) || i.presentacion.toLowerCase().includes(q)))
  }, [items, busqueda, filtroBloque])

  function agregarItem(codigo: string) {
    setLineas(ls => ls.some(l => l.codigo === codigo) ? ls : [...ls, { codigo, cajas: '' }])
    setBusqueda('')
  }

  async function guardarNueva() {
    if (!orgId) return
    if (!ranchoId) { toast.error(`Selecciona ${terminosSitio.genero === 'f' ? 'una' : 'un'} ${terminosSitio.singular}`); return }
    if (!empresa.trim()) { toast.error('Indica la empresa dueña de la fruta'); return }
    if (!productor.trim()) { toast.error('Indica el código del productor'); return }
    if (!/^\d{2}:\d{2}$/.test(hora)) { toast.error('Indica la hora'); return }
    if (lineas.length === 0) { toast.error('Agrega al menos un ítem'); return }
    const malas = lineas.filter(l => !/^\d+$/.test(l.cajas) || Number(l.cajas) <= 0)
    if (malas.length) { toast.error(`Indica las cajas del ítem ${malas[0].codigo}`); return }
    setGuardando(true)
    try {
      await crearEntregaM82({
        orgId, rancho_id: ranchoId, fecha: hoyMX(), hora, empresa, codigo_productor: productor,
        lineas: lineas.map(l => ({ codigo: l.codigo, cajas: Number(l.cajas) })),
      })
      guardarEmpresa(empresa.trim())
      toast.success('Precaptura guardada')
      setSheet(null)
      if (fecha !== hoyMX()) setFecha(hoyMX()); else await refetch()
    } catch (e) { avisar(e) } finally { setGuardando(false) }
  }

  // ── Dictamen
  const [sel, setSel] = useState<M82Entrega | null>(null)
  const [cajasConf, setCajasConf] = useState<Record<string, string>>({})
  const [be, setBe] = useState<boolean | null>(null)
  const [lim, setLim] = useState<boolean | null>(null)
  const [lp, setLp] = useState<boolean | null>(null)
  const [pase, setPase] = useState(false)
  const [obs, setObs] = useState('')

  function abrirDictamen(e: M82Entrega) {
    setSel(e)
    setCajasConf(Object.fromEntries(e.lineas.map(l => [l.id, String(l.cajas_confirmadas ?? l.cajas_declaradas)])))
    setBe(e.limp_be); setLim(e.limp_l); setLp(e.limp_lp); setPase(e.pase_anden); setObs(e.observaciones ?? '')
    setSheet('dictamen')
  }

  async function dictaminar(estado: 'ACEPTADA' | 'RETENIDA' | 'RECHAZADA') {
    if (!sel) return
    if (estado === 'RECHAZADA' && !obs.trim()) { toast.warning('Escribe el motivo del rechazo en observaciones'); return }
    const cajas: Record<string, number> = {}
    for (const l of sel.lineas) {
      const v = cajasConf[l.id] ?? ''
      if (!/^\d+$/.test(v)) { toast.error(`Indica las cajas físicas del ítem ${l.codigo}`); return }
      cajas[l.id] = Number(v)
    }
    setGuardando(true)
    try {
      await dictaminarEntregaM82(sel, { estado, cajas, limp_be: be, limp_l: lim, limp_lp: lp, pase_anden: pase, observaciones: obs })
      toast.success(estado === 'ACEPTADA' ? 'Entrega aceptada' : estado === 'RETENIDA' ? 'Entrega retenida' : 'Entrega rechazada')
      setSheet(null)
      await refetch()
      await refetchFirmas()
    } catch (e) { avisar(e); await refetch() } finally { setGuardando(false) }
  }

  async function borrar(e: M82Entrega) {
    if (!window.confirm(`¿Borrar la precaptura de las ${e.hora} (${e.codigo_productor})?`)) return
    try { await borrarEntregaM82(e.id); toast.success('Precaptura borrada'); await refetch() } catch (err) { avisar(err) }
  }

  // ── PDF del día
  const [pdfCargando, setPdfCargando] = useState(false)
  async function pdfDia() {
    if (!orgId) return
    setPdfCargando(true)
    try {
      const n = await generarRecepcionPorItemPDF(orgId, fecha, codigoClave)
      if (n === 0) toast.info('No hay entregas aceptadas en esta fecha')
    } catch (e: any) { toast.error(e?.message ?? 'Error al generar PDF') } finally { setPdfCargando(false) }
  }

  // ── Totales del día (aceptadas) por bloque
  const totales = useMemo(() => {
    const m = new Map<string, number>()
    for (const e of entregas) if (e.estado === 'ACEPTADA') for (const l of e.lineas) {
      const k = l.bloque_clave ?? ''
      m.set(k, (m.get(k) ?? 0) + (l.cajas_confirmadas ?? 0))
    }
    return bloques.map(b => ({ titulo: b.titulo, total: m.get(b.clave) ?? 0 })).filter(x => x.total > 0)
  }, [entregas, bloques])

  return (
    <div className="flex flex-col min-h-full bg-background pb-safe-nav">
      <ModuloHeader
        tituloFallback="Recepción Diaria de Fruta por Ítem"
        subtitulo={`${codigoFmt} · Por evento`}
        acciones={
          <button onClick={pdfDia} disabled={pdfCargando}
            className="hidden min-[1224px]:flex items-center gap-2 h-9 px-3 rounded-[0.625rem] border border-border text-sm disabled:opacity-50">
            {pdfCargando ? <Loader2 className="w-4 h-4 animate-spin" /> : <FileDown className="w-4 h-4" style={{ color: 'var(--primary)' }} />}
            PDF del día
          </button>
        }
      />

      <div className="p-4 space-y-3">
        <div className="flex gap-2 items-end">
          <div className="flex-1 space-y-1">
            <label className="text-xs text-muted-foreground font-semibold">Fecha</label>
            <input type="date" className={fieldCls} value={fecha} max={hoyMX()} onChange={e => e.target.value && setFecha(e.target.value)} />
          </div>
          <button onClick={pdfDia} disabled={pdfCargando}
            className="h-10 px-3 rounded-[0.625rem] border border-border flex items-center gap-2 text-sm disabled:opacity-50">
            {pdfCargando ? <Loader2 className="w-4 h-4 animate-spin" /> : <FileDown className="w-4 h-4" style={{ color: 'var(--primary)' }} />}
            PDF del día
          </button>
        </div>

        {totales.length > 0 && (
          <div className="rounded-[0.625rem] border border-border bg-card p-3 flex flex-wrap gap-x-4 gap-y-1">
            {totales.map(t => (
              <span key={t.titulo} className="text-xs"><span className="text-muted-foreground">{t.titulo}:</span> <b>{t.total}</b> cajas</span>
            ))}
          </div>
        )}

        {error && (
          <div className="flex items-start gap-2 rounded-xl p-3" style={{ backgroundColor: 'var(--agro-danger-fill)', border: '1px solid var(--agro-red)' }}>
            <TriangleAlert className="w-4 h-4 flex-shrink-0 mt-0.5" style={{ color: 'var(--agro-danger-text)' }} />
            <p className="text-xs" style={{ color: 'var(--agro-danger-text)' }}>Error al cargar las entregas.</p>
          </div>
        )}

        {!loadingCat && items.length === 0 && (
          <div className="rounded-xl p-3 text-xs" style={{ backgroundColor: 'var(--agro-info-fill)', color: 'var(--agro-info-text)' }}>
            Tu organización aún no tiene catálogo de ítems. Pide a M.A.D.Y. que lo cargue.
          </div>
        )}

        {loading ? <ListaSkeleton /> : entregas.length === 0 ? (
          <EstadoVacio icono={PackageOpen} titulo="Sin entregas en esta fecha" ayuda="Captura la primera con el botón +" />
        ) : entregas.map(e => {
          const ui = ESTADO_UI[e.estado]
          const total = e.lineas.reduce((a, l) => a + (e.estado === 'ACEPTADA' ? (l.cajas_confirmadas ?? 0) : l.cajas_declaradas), 0)
          return (
            <div key={e.id} className="rounded-[0.625rem] border border-border bg-card p-3 space-y-2">
              <div className="flex items-start justify-between gap-2">
                <div className="min-w-0">
                  <p className="text-sm font-semibold truncate">{e.hora} · Productor {e.codigo_productor}</p>
                  <p className="text-xs text-muted-foreground truncate">{e.empresa} · {e.rancho_nombre} · {fechaCorta(e.fecha)}</p>
                </div>
                <span className="text-xs px-2 py-0.5 rounded-full font-semibold flex-shrink-0" style={{ backgroundColor: ui.fondo, color: ui.color }}>{ui.texto}</span>
              </div>
              <ul className="space-y-0.5">
                {e.lineas.map(l => {
                  const it = itemPorCodigo.get(l.codigo)
                  return (
                    <li key={l.id} className="text-xs flex justify-between gap-2">
                      <span className="truncate"><b>{l.codigo}</b> · {it?.presentacion ?? ''} <span className="text-muted-foreground">· {tituloBloque(it)} · {l.clasificacion === 'ORG' ? 'Org' : 'Conv'}</span></span>
                      <span className="flex-shrink-0 font-semibold">{l.cajas_confirmadas ?? l.cajas_declaradas}{l.cajas_confirmadas != null && l.cajas_confirmadas !== l.cajas_declaradas ? ` (decl. ${l.cajas_declaradas})` : ''}</span>
                    </li>
                  )
                })}
              </ul>
              <div className="flex items-center justify-between gap-2">
                <span className="text-xs text-muted-foreground">{total} cajas{e.pase_anden ? ' · Pase de andén' : ''}</span>
                <div className="flex gap-2">
                  {e.estado === 'PRECAPTURA' && (
                    <button onClick={() => borrar(e)} aria-label="Borrar precaptura" className="p-2 rounded-lg border border-border">
                      <Trash2 className="w-4 h-4 text-muted-foreground" />
                    </button>
                  )}
                  {(e.estado === 'PRECAPTURA' || e.estado === 'RETENIDA' || esSuperAdmin && e.estado !== 'ACEPTADA') && (
                    <Boton type="button" tamano="sm" onClick={() => abrirDictamen(e)}>Dictamen y conteo</Boton>
                  )}
                </div>
              </div>
              {e.observaciones && <p className="text-xs text-muted-foreground">Obs.: {e.observaciones}</p>}
              {e.estado === 'ACEPTADA' && (
                <FirmasRegistro modulo="M82" registroId={e.id} fechaRegistro={e.fecha} firma={firmas[e.id]} loadingFirmas={loadingFirmas} onFirmado={refetchFirmas} />
              )}
            </div>
          )
        })}
      </div>

      <Fab onClick={abrirNueva} aria-label="Nueva entrega" disabled={items.length === 0} />

      {/* ═══ Nueva entrega ═══ */}
      <BottomSheet open={sheet === 'nueva'} onClose={() => { if (!guardando) setSheet(null) }} height="85%">
        <div className="flex items-center justify-between px-4 pt-4 pb-3 border-b border-border">
          <h2 className="text-base text-foreground font-semibold">Nueva entrega</h2>
          <button aria-label="Cerrar" type="button" onClick={() => { if (!guardando) setSheet(null) }}><X className="w-5 h-5 text-muted-foreground" /></button>
        </div>
        <div className="overflow-y-auto px-4 pb-6 pt-3 space-y-5" style={{ flex: 1 }}>
          <section className="space-y-3">
            <TituloSeccion>Entrega</TituloSeccion>
            {ranchos.length !== 1 && (
              <div className="space-y-1">
                <label className="text-xs text-muted-foreground font-semibold">{terminosSitio.singular} *</label>
                <select className={fieldCls} value={ranchoId} onChange={e => setRanchoId(e.target.value)}>
                  <option value="">Selecciona...</option>
                  {ranchos.map(r => <option key={r.id} value={r.id}>{r.nombre}</option>)}
                </select>
              </div>
            )}
            <div className="flex gap-3">
              <div className="flex-1 space-y-1">
                <label className="text-xs text-muted-foreground font-semibold">Fecha</label>
                <input type="date" className={fieldCls} value={hoyMX()} min={hoyMX()} max={hoyMX()} readOnly />
              </div>
              <div className="flex-1 space-y-1">
                <label className="text-xs text-muted-foreground font-semibold">Hora *</label>
                <input type="time" className={fieldCls} value={hora} onChange={e => setHora(e.target.value)} />
              </div>
            </div>
            <div className="space-y-1">
              <label className="text-xs text-muted-foreground font-semibold">Código del productor *</label>
              <input className={fieldCls} maxLength={60} value={productor} onChange={e => setProductor(e.target.value)} placeholder="Como viene en la papeleta o etiqueta" />
            </div>
            <div className="space-y-1">
              <label className="text-xs text-muted-foreground font-semibold">Empresa dueña de la fruta *</label>
              <input className={fieldCls} maxLength={150} value={empresa} onChange={e => setEmpresa(e.target.value)} />
            </div>
          </section>

          <section className="space-y-3">
            <TituloSeccion>Ítems y cajas</TituloSeccion>
            {lineas.length > 0 && (
              <ul className="space-y-2">
                {lineas.map((l, idx) => {
                  const it = itemPorCodigo.get(l.codigo)
                  return (
                    <li key={l.codigo} className="flex items-center gap-2 rounded-[0.625rem] border border-border p-2">
                      <div className="flex-1 min-w-0">
                        <p className="text-sm font-semibold truncate">{l.codigo} · {it?.presentacion}</p>
                        <p className="text-xs text-muted-foreground">{tituloBloque(it)} · {it?.clasificacion === 'ORG' ? 'Orgánico' : 'Convencional'}</p>
                      </div>
                      <input inputMode="numeric" pattern="[0-9]*" placeholder="Cajas" aria-label={`Cajas del ítem ${l.codigo}`}
                        className="w-20 h-10 rounded-[0.625rem] border border-border-control bg-input-background px-2 text-sm text-right"
                        value={l.cajas} onChange={e => { const v = e.target.value.replace(/\D/g, ''); setLineas(ls => ls.map((x, i) => i === idx ? { ...x, cajas: v } : x)) }} />
                      <button type="button" aria-label="Quitar" onClick={() => setLineas(ls => ls.filter((_, i) => i !== idx))}><X className="w-4 h-4 text-muted-foreground" /></button>
                    </li>
                  )
                })}
              </ul>
            )}
            <div className="relative">
              <Search className="w-4 h-4 absolute left-3 top-3 text-muted-foreground" />
              <input className={`${fieldCls} pl-9`} placeholder="Código (ej. 001) o presentación" value={busqueda} onChange={e => setBusqueda(e.target.value)} />
            </div>
            <div className="flex gap-1 flex-wrap">
              <button type="button" onClick={() => setFiltroBloque('')}
                className={`text-xs px-2 py-1 rounded-full border ${!filtroBloque ? 'bg-primary text-primary-foreground border-primary' : 'border-border'}`}>Todos</button>
              {bloques.map(b => (
                <button key={b.id} type="button" onClick={() => setFiltroBloque(b.id)}
                  className={`text-xs px-2 py-1 rounded-full border ${filtroBloque === b.id ? 'bg-primary text-primary-foreground border-primary' : 'border-border'}`}>{b.titulo}</button>
              ))}
            </div>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-1 max-h-64 overflow-y-auto">
              {sugerencias.map(i => {
                const ya = lineas.some(l => l.codigo === i.codigo)
                return (
                  <button key={i.id} type="button" disabled={ya} onClick={() => agregarItem(i.codigo)}
                    className="text-left rounded-[0.625rem] border border-border px-3 py-2 disabled:opacity-40">
                    <span className="text-sm font-semibold">{i.codigo}</span>
                    <span className="text-sm"> · {i.presentacion}</span>
                    <span className="block text-xs text-muted-foreground">{tituloBloque(i)} · {i.clasificacion === 'ORG' ? 'Org' : 'Conv'}</span>
                  </button>
                )
              })}
              {sugerencias.length === 0 && <p className="text-xs text-muted-foreground p-2">Sin coincidencias en el catálogo.</p>}
            </div>
          </section>

          <Boton type="button" onClick={guardarNueva} cargando={guardando} className="w-full">Guardar precaptura</Boton>
        </div>
      </BottomSheet>

      {/* ═══ Dictamen y conteo ═══ */}
      <BottomSheet open={sheet === 'dictamen'} onClose={() => { if (!guardando) setSheet(null) }} height="85%">
        <div className="flex items-center justify-between px-4 pt-4 pb-3 border-b border-border">
          <h2 className="text-base text-foreground font-semibold">Dictamen y conteo</h2>
          <button aria-label="Cerrar" type="button" onClick={() => { if (!guardando) setSheet(null) }}><X className="w-5 h-5 text-muted-foreground" /></button>
        </div>
        {sel && (
          <div className="overflow-y-auto px-4 pb-6 pt-3 space-y-5" style={{ flex: 1 }}>
            <p className="text-sm"><b>{sel.hora}</b> · Productor {sel.codigo_productor} · {sel.empresa}</p>
            <section className="space-y-2">
              <TituloSeccion>Cajas físicas por ítem</TituloSeccion>
              {sel.lineas.map(l => {
                const it = itemPorCodigo.get(l.codigo)
                return (
                  <div key={l.id} className="flex items-center gap-2">
                    <div className="flex-1 min-w-0">
                      <p className="text-sm font-semibold truncate">{l.codigo} · {it?.presentacion}</p>
                      <p className="text-xs text-muted-foreground">Declaradas: {l.cajas_declaradas}</p>
                    </div>
                    <input inputMode="numeric" pattern="[0-9]*" aria-label={`Cajas físicas ${l.codigo}`}
                      className="w-20 h-10 rounded-[0.625rem] border border-border-control bg-input-background px-2 text-sm text-right"
                      value={cajasConf[l.id] ?? ''} onChange={e => setCajasConf(c => ({ ...c, [l.id]: e.target.value.replace(/\D/g, '') }))} />
                  </div>
                )
              })}
            </section>
            <section className="space-y-2">
              <TituloSeccion>Limpieza del vehículo</TituloSeccion>
              <div className="grid grid-cols-3 gap-2">
                <ToggleSiX etiqueta="BE · Buen estado" valor={be} onChange={setBe} />
                <ToggleSiX etiqueta="L · Limpio" valor={lim} onChange={setLim} />
                <ToggleSiX etiqueta="LP · Libre de plagas" valor={lp} onChange={setLp} />
              </div>
              {lp === false && (
                <p className="text-xs" style={{ color: 'var(--agro-danger-text)' }}>Con presencia de plaga la carga no se recibe.</p>
              )}
              <label className="flex items-center gap-2 text-sm pt-1">
                <input type="checkbox" checked={pase} onChange={e => setPase(e.target.checked)} /> Pase de andén
              </label>
            </section>
            <section className="space-y-1">
              <label className="text-xs text-muted-foreground font-semibold">Observaciones</label>
              <textarea className="w-full rounded-[0.625rem] border border-border-control bg-input-background px-3 py-2 text-sm" rows={3} maxLength={2000}
                value={obs} onChange={e => setObs(e.target.value)} placeholder="Motivo de retención o rechazo, fruta de campo o preenfriada..." />
            </section>
            <div className="space-y-2">
              <Boton type="button" onClick={() => dictaminar('ACEPTADA')} cargando={guardando} className="w-full" disabled={lp === false}>Aceptar entrega</Boton>
              <div className="flex gap-2">
                {sel.estado === 'PRECAPTURA' && (
                  <Boton type="button" variante="secundario" onClick={() => dictaminar('RETENIDA')} disabled={guardando} className="flex-1">Retener</Boton>
                )}
                <Boton type="button" variante="secundario" onClick={() => dictaminar('RECHAZADA')} disabled={guardando} className="flex-1">Rechazar</Boton>
              </div>
            </div>
          </div>
        )}
      </BottomSheet>
    </div>
  )
}
