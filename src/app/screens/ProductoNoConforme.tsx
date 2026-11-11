// M84 · Producto no conforme (papeleta PRO-07). Retener (al ingreso o fruta ya aceptada) → dictamen de Calidad.
import { useMemo, useState } from 'react'
import { X, Loader2, FileDown, ShieldAlert, TriangleAlert } from 'lucide-react'
import { toast } from 'sonner'
import { BottomSheet } from '@/app/components/BottomSheet'
import { ModuloHeader } from '@/app/components/ModuloHeader'
import { Fab } from '@/app/components/Fab'
import { Boton } from '@/app/components/ui-mady/Boton'
import { TituloSeccion } from '@/app/components/ui-mady/TituloSeccion'
import { EstadoVacio } from '@/app/components/ui-mady/EstadoVacio'
import { ListaSkeleton } from '@/app/components/ListaSkeleton'
import { useAuthContext } from '@/context/AuthContext'
import { codigoFormato } from '@/lib/codigoFormato'
import { fechaCorta } from '@/lib/formato'
import {
  useM84Papeletas, cargarOrigenesM84, retenerIngresoM84, retenerPosteriorM84, dictaminarM84, mensajeErrorM84,
  type M84Papeleta, type M84EntregaRetenida, type M84LineaAceptada,
} from '@/hooks/useM84NoConforme'
import { generarProductoNoConformePDF } from '@/lib/pdf/m84/generarProductoNoConformePDF'

const fieldCls = 'w-full h-10 rounded-[0.625rem] border border-border-control bg-input-background px-3 text-sm'
const areaCls = 'w-full rounded-[0.625rem] border border-border-control bg-input-background px-3 py-2 text-sm'
const TZ = 'America/Mexico_City'
const hora = (iso: string | null) => (iso ? new Date(iso).toLocaleTimeString('en-GB', { timeZone: TZ, hour: '2-digit', minute: '2-digit', hour12: false }) : '')
function avisar(e: any) {
  const m = mensajeErrorM84(e)
  if (m.tipo === 'warning') toast.warning(m.texto, { duration: 7000 }); else toast.error(m.texto, { duration: 7000 })
}
const UI: Record<M84Papeleta['estado'], { texto: string; fondo: string; color: string }> = {
  RETENIDA: { texto: 'Retenida', fondo: 'var(--muted)', color: 'var(--foreground)' },
  LIBERADA: { texto: 'Liberada', fondo: 'var(--agro-success-fill)', color: 'var(--agro-success-text)' },
  RECHAZADA: { texto: 'Rechazada', fondo: 'var(--agro-danger-fill)', color: 'var(--agro-danger-text)' },
}

function Chip({ activo, onClick, children }: { activo: boolean; onClick: () => void; children: React.ReactNode }) {
  return (
    <button type="button" onClick={onClick}
      className={`h-9 px-3 rounded-[0.625rem] border text-sm font-semibold ${activo ? 'bg-primary text-primary-foreground border-primary' : 'border-border-control'}`}>
      {children}
    </button>
  )
}

export function ProductoNoConforme() {
  const { profile, codigoClave } = useAuthContext()
  const orgId = profile?.org_id ?? null
  const { papeletas, loading, error, refetch } = useM84Papeletas()
  const codigoFmt = codigoFormato('F-FRUS-PRO-07', codigoClave)
  const abiertas = useMemo(() => papeletas.filter(p => p.estado === 'RETENIDA'), [papeletas])
  const cerradas = useMemo(() => papeletas.filter(p => p.estado !== 'RETENIDA'), [papeletas])

  const [sheet, setSheet] = useState<null | 'retener' | 'dictamen'>(null)
  const [guardando, setGuardando] = useState(false)

  // ── Retener
  const [tipo, setTipo] = useState<'INGRESO' | 'POSTERIOR'>('INGRESO')
  const [cargandoOrigen, setCargandoOrigen] = useState(false)
  const [retenidas, setRetenidas] = useState<M84EntregaRetenida[]>([])
  const [aceptadas, setAceptadas] = useState<M84LineaAceptada[]>([])
  const [selEntrega, setSelEntrega] = useState<string | null>(null)
  const [selLinea, setSelLinea] = useState<string | null>(null)
  const [cajas, setCajas] = useState('')
  const [motivo, setMotivo] = useState('')
  const [retiene, setRetiene] = useState('')

  async function abrirRetener() {
    if (!orgId) return
    setSelEntrega(null); setSelLinea(null); setCajas(''); setMotivo(''); setRetiene('')
    setSheet('retener'); setCargandoOrigen(true)
    try {
      const o = await cargarOrigenesM84(orgId)
      setRetenidas(o.retenidas); setAceptadas(o.aceptadas)
      setTipo(o.retenidas.length > 0 ? 'INGRESO' : 'POSTERIOR')
    } catch (e) { avisar(e) } finally { setCargandoOrigen(false) }
  }

  async function retener() {
    if (motivo.trim().length < 3) { toast.error('Escribe el motivo de la retención'); return }
    if (retiene.trim().length < 2) { toast.error('Indica quién retiene en Calidad'); return }
    setGuardando(true)
    try {
      if (tipo === 'INGRESO') {
        if (!selEntrega) { toast.error('Selecciona la entrega retenida'); setGuardando(false); return }
        const n = await retenerIngresoM84(selEntrega, motivo, retiene)
        toast.success(`${n} papeleta(s) generada(s)`)
      } else {
        const l = aceptadas.find(a => a.linea_id === selLinea)
        if (!l) { toast.error('Selecciona la fruta que se retiene'); setGuardando(false); return }
        const n = Number(cajas)
        if (!/^\d+$/.test(cajas) || n <= 0 || n > l.cajas - l.retenidas) { toast.error(`Cajas inválidas; máximo ${l.cajas - l.retenidas}`); setGuardando(false); return }
        await retenerPosteriorM84(l.linea_id, n, motivo, retiene)
        toast.success('Papeleta generada; esas cajas ya no están disponibles para prefrío')
      }
      setSheet(null)
      await refetch()
    } catch (e) { avisar(e) } finally { setGuardando(false) }
  }

  // ── Dictamen
  const [pap, setPap] = useState<M84Papeleta | null>(null)
  const [resultado, setResultado] = useState<'LIBERADA' | 'RECHAZADA' | null>(null)
  const [dictamen, setDictamen] = useState('')
  const [libera, setLibera] = useState('')
  const [disposicion, setDisposicion] = useState('')

  function abrirDictamen(p: M84Papeleta) {
    setPap(p); setResultado(null); setDictamen(''); setLibera(p.retiene_nombre); setDisposicion('')
    setSheet('dictamen')
  }

  async function dictaminar() {
    if (!pap || !resultado) { toast.error('Elige Liberar o Rechazar'); return }
    setGuardando(true)
    try {
      const r = await dictaminarM84({ papeleta: pap.id, resultado, dictamen, libera, disposicion: resultado === 'RECHAZADA' ? disposicion : null })
      if (r.entrega === 'ACEPTADA') toast.success('Dictamen guardado; la entrega quedó aceptada en Recepción por ítem')
      else if (r.entrega === 'RECHAZADA') toast.success('Dictamen guardado; la entrega quedó rechazada')
      else if (r.entrega === 'PENDIENTE_ACEPTAR') toast.info('Dictamen guardado. Falta marcar BE, L y LP y aceptar la entrega en Recepción por ítem', { duration: 8000 })
      else toast.success('Dictamen guardado')
      setSheet(null)
      await refetch()
    } catch (e) { avisar(e) } finally { setGuardando(false) }
  }

  // ── PDF
  const [pdfId, setPdfId] = useState<string | null>(null)
  async function pdfDe(p: M84Papeleta) {
    if (!orgId) return
    setPdfId(p.id)
    try { await generarProductoNoConformePDF([p], orgId, codigoClave) } catch (e: any) { toast.error(e?.message ?? 'Error al generar PDF') } finally { setPdfId(null) }
  }

  const Tarjeta = ({ p }: { p: M84Papeleta }) => (
    <div className="rounded-[0.625rem] border border-border bg-card p-3 space-y-2">
      <div className="flex items-start justify-between gap-2">
        <div className="min-w-0">
          <p className="text-sm font-semibold truncate">#{p.codigo} · {p.embalaje} · {p.cajas} cajas</p>
          <p className="text-xs text-muted-foreground truncate">{p.empresa} · {p.origen === 'INGRESO' ? 'Al ingreso' : 'Posterior'} · {fechaCorta(p.fecha)} {hora(p.retenida_en)}</p>
        </div>
        <span className="text-xs px-2 py-0.5 rounded-full font-semibold flex-shrink-0" style={{ backgroundColor: UI[p.estado].fondo, color: UI[p.estado].color }}>{UI[p.estado].texto}</span>
      </div>
      <p className="text-xs"><span className="text-muted-foreground">Motivo:</span> {p.motivo}</p>
      {p.dictamen && <p className="text-xs"><span className="text-muted-foreground">Dictamen:</span> {p.dictamen}{p.disposicion ? ` · Disposición: ${p.disposicion}` : ''}</p>}
      <div className="flex gap-2">
        {p.estado === 'RETENIDA' && <Boton type="button" tamano="sm" className="flex-1" onClick={() => abrirDictamen(p)}>Dictamen de Calidad</Boton>}
        <button onClick={() => pdfDe(p)} disabled={pdfId === p.id} aria-label="PDF de la papeleta" className="p-2 rounded-lg border border-border disabled:opacity-50">
          {pdfId === p.id ? <Loader2 className="w-4 h-4 animate-spin" /> : <FileDown className="w-4 h-4" style={{ color: 'var(--primary)' }} />}
        </button>
      </div>
    </div>
  )

  return (
    <div className="flex flex-col min-h-full bg-background pb-safe-nav">
      <ModuloHeader tituloFallback="Producto No Conforme" subtitulo={`${codigoFmt} · Por evento`} />
      <div className="p-4 space-y-4">
        {error && (
          <div className="flex items-start gap-2 rounded-xl p-3" style={{ backgroundColor: 'var(--agro-danger-fill)', border: '1px solid var(--agro-red)' }}>
            <TriangleAlert className="w-4 h-4 flex-shrink-0 mt-0.5" style={{ color: 'var(--agro-danger-text)' }} />
            <p className="text-xs" style={{ color: 'var(--agro-danger-text)' }}>Error al cargar las papeletas.</p>
          </div>
        )}
        <section className="space-y-2">
          <TituloSeccion>Retenidas sin dictamen</TituloSeccion>
          {loading ? <ListaSkeleton rows={2} /> : abiertas.length === 0
            ? <EstadoVacio icono={ShieldAlert} titulo="Sin producto retenido" ayuda="Si Calidad retiene fruta, genera la papeleta con el botón +" />
            : <div className="grid grid-cols-1 md:grid-cols-2 gap-2">{abiertas.map(p => <Tarjeta key={p.id} p={p} />)}</div>}
        </section>
        {cerradas.length > 0 && (
          <section className="space-y-2">
            <TituloSeccion>Con dictamen (últimos 30 días)</TituloSeccion>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-2">{cerradas.map(p => <Tarjeta key={p.id} p={p} />)}</div>
          </section>
        )}
      </div>

      <Fab onClick={abrirRetener} aria-label="Nueva retención" />

      {/* ═══ Retener ═══ */}
      <BottomSheet open={sheet === 'retener'} onClose={() => { if (!guardando) setSheet(null) }} height="85%">
        <div className="flex items-center justify-between px-4 pt-4 pb-3 border-b border-border">
          <h2 className="text-base text-foreground font-semibold">Retener producto</h2>
          <button aria-label="Cerrar" type="button" onClick={() => { if (!guardando) setSheet(null) }}><X className="w-5 h-5 text-muted-foreground" /></button>
        </div>
        <div className="overflow-y-auto px-4 pb-6 pt-3 space-y-5" style={{ flex: 1 }}>
          <div className="flex gap-2 flex-wrap">
            <Chip activo={tipo === 'INGRESO'} onClick={() => setTipo('INGRESO')}>Al ingreso</Chip>
            <Chip activo={tipo === 'POSTERIOR'} onClick={() => setTipo('POSTERIOR')}>Fruta ya aceptada</Chip>
          </div>
          {cargandoOrigen ? <Loader2 className="w-5 h-5 animate-spin text-muted-foreground" /> : tipo === 'INGRESO' ? (
            <section className="space-y-2">
              <TituloSeccion>Entrega retenida en recepción</TituloSeccion>
              {retenidas.length === 0 ? (
                <p className="text-xs text-muted-foreground">No hay entregas retenidas sin papeleta. En Recepción por ítem usa «Dictamen y conteo» → «Retener».</p>
              ) : (
                <ul className="space-y-1">
                  {retenidas.map(e => (
                    <li key={e.id}>
                      <button type="button" onClick={() => setSelEntrega(e.id)}
                        className={`w-full text-left rounded-[0.625rem] border p-2 ${selEntrega === e.id ? 'border-primary' : 'border-border'}`}>
                        <p className="text-sm font-semibold">{fechaCorta(e.fecha)} {e.hora} · Productor {e.codigo_productor}</p>
                        <p className="text-xs text-muted-foreground">{e.empresa} · {e.lineas.map(l => `#${l.codigo} (${l.cajas})`).join(', ')}</p>
                      </button>
                    </li>
                  ))}
                </ul>
              )}
              <p className="text-xs text-muted-foreground">Se genera una papeleta por ítem de la entrega.</p>
            </section>
          ) : (
            <section className="space-y-2">
              <TituloSeccion>Fruta aceptada (últimos 7 días)</TituloSeccion>
              {aceptadas.length === 0 ? <p className="text-xs text-muted-foreground">No hay fruta aceptada disponible para retener.</p> : (
                <ul className="space-y-1">
                  {aceptadas.map(l => (
                    <li key={l.linea_id}>
                      <button type="button" onClick={() => { setSelLinea(l.linea_id); setCajas(String(l.cajas - l.retenidas)) }}
                        className={`w-full text-left rounded-[0.625rem] border p-2 ${selLinea === l.linea_id ? 'border-primary' : 'border-border'}`}>
                        <p className="text-sm font-semibold">#{l.codigo} · {l.cajas - l.retenidas} cajas retenibles</p>
                        <p className="text-xs text-muted-foreground">{l.empresa} · {fechaCorta(l.fecha)} {l.hora} · Productor {l.codigo_productor}</p>
                      </button>
                    </li>
                  ))}
                </ul>
              )}
              {selLinea && (
                <div className="space-y-1">
                  <label className="text-xs text-muted-foreground font-semibold">N° de cajas retenidas *</label>
                  <input inputMode="numeric" className={fieldCls} value={cajas} onChange={e => setCajas(e.target.value.replace(/\D/g, ''))} />
                </div>
              )}
            </section>
          )}
          <section className="space-y-3">
            <TituloSeccion>Retención</TituloSeccion>
            <div className="space-y-1">
              <label className="text-xs text-muted-foreground font-semibold">Motivo de la retención *</label>
              <textarea className={areaCls} rows={3} maxLength={1000} value={motivo} onChange={e => setMotivo(e.target.value)} />
            </div>
            <div className="space-y-1">
              <label className="text-xs text-muted-foreground font-semibold">Quién retiene en Calidad *</label>
              <input className={fieldCls} maxLength={120} value={retiene} onChange={e => setRetiene(e.target.value)} placeholder="Nombre de la persona de Calidad" />
            </div>
            <p className="text-xs text-muted-foreground">Hora y fecha se toman al guardar. Identifica y separa físicamente el producto.</p>
          </section>
          <Boton type="button" onClick={retener} cargando={guardando} className="w-full">Generar papeleta</Boton>
        </div>
      </BottomSheet>

      {/* ═══ Dictamen ═══ */}
      <BottomSheet open={sheet === 'dictamen'} onClose={() => { if (!guardando) setSheet(null) }} height="85%">
        <div className="flex items-center justify-between px-4 pt-4 pb-3 border-b border-border">
          <h2 className="text-base text-foreground font-semibold">Dictamen de Calidad</h2>
          <button aria-label="Cerrar" type="button" onClick={() => { if (!guardando) setSheet(null) }}><X className="w-5 h-5 text-muted-foreground" /></button>
        </div>
        {pap && (
          <div className="overflow-y-auto px-4 pb-6 pt-3 space-y-5" style={{ flex: 1 }}>
            <div className="text-sm space-y-0.5">
              <p className="font-semibold">#{pap.codigo} · {pap.embalaje} · {pap.cajas} cajas</p>
              <p className="text-xs text-muted-foreground">{pap.empresa} · retenida {fechaCorta(pap.fecha)} {hora(pap.retenida_en)} · {pap.motivo}</p>
            </div>
            <div className="flex gap-2">
              <Chip activo={resultado === 'LIBERADA'} onClick={() => setResultado('LIBERADA')}>Liberar</Chip>
              <Chip activo={resultado === 'RECHAZADA'} onClick={() => setResultado('RECHAZADA')}>Rechazar</Chip>
            </div>
            <div className="space-y-1">
              <label className="text-xs text-muted-foreground font-semibold">Dictamen *</label>
              <textarea className={areaCls} rows={3} maxLength={1000} value={dictamen} onChange={e => setDictamen(e.target.value)} />
            </div>
            {resultado === 'RECHAZADA' && (
              <div className="space-y-1">
                <label className="text-xs text-muted-foreground font-semibold">Devolución o disposición que instruyó el cliente *</label>
                <textarea className={areaCls} rows={2} maxLength={500} value={disposicion} onChange={e => setDisposicion(e.target.value)} />
              </div>
            )}
            <div className="space-y-1">
              <label className="text-xs text-muted-foreground font-semibold">Quién dictamina en Calidad *</label>
              <input className={fieldCls} maxLength={120} value={libera} onChange={e => setLibera(e.target.value)} />
            </div>
            {pap.origen === 'INGRESO' && (
              <p className="text-xs text-muted-foreground">Al dictaminar todos los ítems de la entrega, Recepción por ítem se actualiza sola: liberada entra con sus cajas; rechazada queda en 0.</p>
            )}
            <Boton type="button" onClick={dictaminar} cargando={guardando} className="w-full" disabled={!resultado}>Guardar dictamen</Boton>
          </div>
        )}
      </BottomSheet>
    </div>
  )
}
