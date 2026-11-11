// M86 · Manifiesto de embarque por tarima. Un manifiesto, tres momentos (A llegada, B carga, C salida y cierre),
// dos inspecciones (transporte Sí/No, tarimas Bueno/Malo), tarima con varias presentaciones de la misma clasificación,
// muestras de temperatura solo de tarimas medidas y tres conformidades reales. Las reglas las valida el servidor.
import { useEffect, useMemo, useRef, useState } from 'react'
import { X, Loader2, FileDown, Truck, ChevronDown, ChevronLeft, Plus, Trash2, Search, Thermometer } from 'lucide-react'
import { toast } from 'sonner'
import { useNavigate } from 'react-router'
import { HoraInput24 } from '@/app/components/HoraInput24'
import { BottomSheet } from '@/app/components/BottomSheet'
import { ModuloHeader } from '@/app/components/ModuloHeader'
import { Fab } from '@/app/components/Fab'
import { Boton } from '@/app/components/ui-mady/Boton'
import { TituloSeccion } from '@/app/components/ui-mady/TituloSeccion'
import { EstadoVacio } from '@/app/components/ui-mady/EstadoVacio'
import { ListaSkeleton } from '@/app/components/ListaSkeleton'
import { useAuthContext } from '@/context/AuthContext'
import { useModulosContext } from '@/context/ModulosContext'
import { useRanchos } from '@/hooks/useRanchos'
import { codigoFormato } from '@/lib/codigoFormato'
import { hoyMX } from '@/lib/fecha'
import { fechaCorta } from '@/lib/formato'
import { useM82Catalogo } from '@/hooks/useM82Recepcion'
import {
  useM86Lista, cargarDetalleM86, crearManifiestoM86, accionM86, mensajeErrorM86, totalesPorPresentacion, cargarPapeletasM86, cargarTarimasRegM86, productoresDe,
  type M86Detalle, type M86Manifiesto, type EstadoManifiesto, type M86PapeletaRef, type M86TarimaReg,
} from '@/hooks/useM86Manifiesto'
import { horaLocal, fmtT } from '@/lib/pdf/m86/manifiestoLogica'
import { generarManifiestoPorTarimaPDF } from '@/lib/pdf/m86/generarManifiestoPorTarimaPDF'

const fieldCls = 'w-full h-10 rounded-[0.625rem] border border-border-control bg-input-background px-3 text-sm'
const numCls = 'w-full h-10 rounded-[0.625rem] border border-border-control bg-input-background px-2 text-sm text-right'
const areaCls = 'w-full rounded-[0.625rem] border border-border-control bg-input-background px-3 py-2 text-sm'
const nuevaClave = () => (crypto?.randomUUID ? crypto.randomUUID() : `${Date.now().toString(16).padStart(8, '0').slice(-8)}-0000-4000-8000-${Math.random().toString(16).slice(2, 14).padEnd(12, '0')}`)
const horaAhora = () => new Date().toLocaleTimeString('en-GB', { timeZone: 'America/Mexico_City', hour: '2-digit', minute: '2-digit', hour12: false })
const isoLocal = (hhmm: string) => new Date(`${hoyMX()}T${hhmm}:00-06:00`).toISOString()
const temp = (s: string) => (/^-?\d{1,3}([.,]\d{1,2})?$/.test(s.trim()) ? Number(s.replace(',', '.')) : null)
function avisar(e: any) {
  const m = mensajeErrorM86(e)
  if (m.tipo === 'warning') toast.warning(m.texto, { duration: 7000 }); else toast.error(m.texto, { duration: 8000 })
}

const ESTADO: Record<EstadoManifiesto, { t: string; f: string; c: string }> = {
  BORRADOR: { t: 'Llegada', f: 'var(--muted)', c: 'var(--foreground)' },
  LLEGADA_INSPECCIONADA: { t: 'Transporte conforme', f: 'var(--agro-info-fill)', c: 'var(--agro-info-text)' },
  EN_CARGA: { t: 'En carga', f: 'var(--agro-info-fill)', c: 'var(--agro-info-text)' },
  CARGA_COMPLETA: { t: 'Carga completa', f: 'var(--agro-info-fill)', c: 'var(--agro-info-text)' },
  PENDIENTE_CONFORMIDADES: { t: 'Faltan conformidades', f: 'var(--agro-info-fill)', c: 'var(--agro-info-text)' },
  CIERRE_LOCAL_SELLO_PENDIENTE: { t: 'Cierre local · sello pendiente', f: 'var(--muted)', c: 'var(--agro-danger-text)' },
  CERRADO: { t: 'Cerrado', f: 'var(--agro-success-fill)', c: 'var(--agro-success-text)' },
  SUSPENDIDO: { t: 'Suspendido', f: 'var(--agro-danger-fill)', c: 'var(--agro-danger-text)' },
}

function Chip({ activo, onClick, children, malo }: { activo: boolean; onClick: () => void; children: React.ReactNode; malo?: boolean }) {
  return (
    <button type="button" onClick={onClick}
      className={`h-9 min-w-[3.5rem] px-3 rounded-[0.625rem] border text-sm font-semibold ${activo && !malo ? 'bg-primary text-primary-foreground border-primary' : 'border-border-control'}`}
      style={activo && malo ? { backgroundColor: 'var(--agro-danger-fill)', color: 'var(--agro-danger-text)', borderColor: 'var(--agro-red)' } : undefined}>
      {children}
    </button>
  )
}

function Etapa({ titulo, hecho, abierta, onToggle, children }: { titulo: string; hecho: boolean; abierta: boolean; onToggle: () => void; children: React.ReactNode }) {
  return (
    <section className="rounded-[0.625rem] border border-border bg-card">
      <button type="button" onClick={onToggle} className="w-full flex items-center justify-between px-4 py-3">
        <span className="text-sm font-semibold">{titulo}</span>
        <span className="flex items-center gap-2 text-xs" style={{ color: hecho ? 'var(--agro-success-text)' : 'var(--muted-foreground)' }}>
          {hecho ? 'Listo' : 'Pendiente'} <ChevronDown className={`w-4 h-4 transition-transform ${abierta ? 'rotate-180' : ''}`} />
        </span>
      </button>
      {abierta && <div className="px-4 pb-4 space-y-3">{children}</div>}
    </section>
  )
}

/** Registro de un evento del camión: temperatura medida + hora (ahora o corregida). */
function EventoCamion({ etiqueta, en, t, unidad, deshabilitado, onGuardar }: {
  etiqueta: string; en: string | null; t: number | null; unidad: string; deshabilitado?: boolean; onGuardar: (temp: number, enIso: string | null) => Promise<void>
}) {
  const [valor, setValor] = useState('')
  const [cambiar, setCambiar] = useState(false)
  const [hora, setHora] = useState(horaAhora())
  const [g, setG] = useState(false)
  if (en) return <p className="text-sm">{etiqueta}: <b>{horaLocal(en)}</b> · <b>{fmtT(t)} °{unidad}</b></p>
  return (
    <div className="space-y-2">
      <label className="text-xs text-muted-foreground font-semibold">{etiqueta}: temperatura del camión (°{unidad}) *</label>
      <div className="flex gap-2">
        <input inputMode="decimal" className={numCls} value={valor} onChange={e => setValor(e.target.value.replace(/[^0-9.,-]/g, ''))} disabled={deshabilitado} />
        <Boton type="button" disabled={deshabilitado} cargando={g} onClick={async () => {
          const v = temp(valor); if (v === null) { toast.error('Temperatura inválida'); return }
          setG(true); try { await onGuardar(v, cambiar ? isoLocal(hora) : null); setValor('') } finally { setG(false) }
        }}>Registrar {etiqueta.toLowerCase()}</Boton>
      </div>
      {cambiar ? <HoraInput24 value={hora} onChange={setHora} ariaLabel={`Hora de ${etiqueta.toLowerCase()}`} />
        : <button type="button" className="text-xs underline text-muted-foreground" disabled={deshabilitado} onClick={() => { setHora(horaAhora()); setCambiar(true) }}>¿Fue antes? Indicar hora</button>}
    </div>
  )
}

interface LineaForm { codigo: string; cajas: string }

function ResguardoPapel({ actual, onGuardar }: { actual: string | null; onGuardar: (r: string) => Promise<void> }) {
  const [v, setV] = useState(actual ?? '')
  return (
    <div className="space-y-1">
      <label className="text-xs text-muted-foreground font-semibold">Resguardo del papel firmado (dónde está el original o su copia)</label>
      <div className="flex gap-2">
        <input className={fieldCls} maxLength={300} value={v} onChange={e => setV(e.target.value)} placeholder="Ej. carpeta de embarques de noviembre, copia escaneada en…" />
        <Boton type="button" tamano="sm" variante="secundario" onClick={() => onGuardar(v)}>Guardar</Boton>
      </div>
    </div>
  )
}

function SeguimientoSello({ evidencias, puedeVerificar, unidadSugerida, onAgregar, onVerificar }: {
  evidencias: M86Detalle['evidencias']; puedeVerificar: boolean; unidadSugerida: string
  onAgregar: (ev: Record<string, string>) => Promise<boolean>; onVerificar: (id: string, r: 'VERIFICADA' | 'RECHAZADA', nota: string) => Promise<boolean>
}) {
  const [ev, setEv] = useState<Record<string, string>>({ unidad: unidadSugerida })
  return (
    <div className="space-y-2 rounded-[0.625rem] border p-3" style={{ borderColor: 'var(--agro-red)' }}>
      <TituloSeccion>Seguimiento del sello (evidencia posterior)</TituloSeccion>
      <p className="text-xs text-muted-foreground">El camión salió con el sello pendiente por consolidado. Registra aquí la evidencia del sello final cuando llegue: es un evento separado, con su fecha de recepción, y no cambia la salida.</p>
      {evidencias.map(e => (
        <div key={e.id} className="text-xs rounded border border-border p-2 space-y-1">
          <p><b>Sello {e.sello_folio}</b> · unidad {e.unidad_referencia} · informa {e.informa} · recibida {fechaCorta(e.recibido_en)} {horaLocal(e.recibido_en)}{e.fecha_informada ? ` · fecha informada ${fechaCorta(e.fecha_informada)}` : ''}</p>
          <p className="text-muted-foreground">Soporte: {e.soporte}</p>
          <p>{e.estado === 'POR_VERIFICAR' ? 'Por verificar' : e.estado === 'VERIFICADA' ? `Verificada por ${e.verifico ?? ''}` : `No corresponde: ${e.nota ?? ''}`}</p>
          {e.estado === 'POR_VERIFICAR' && puedeVerificar && (
            <div className="flex gap-2">
              <Boton type="button" tamano="sm" onClick={() => onVerificar(e.id, 'VERIFICADA', '')}>Corresponde a esta unidad</Boton>
              <Boton type="button" tamano="sm" variante="secundario" onClick={() => { const n = window.prompt('¿Por qué no corresponde?'); if (n !== null) onVerificar(e.id, 'RECHAZADA', n) }}>No corresponde</Boton>
            </div>
          )}
        </div>
      ))}
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
        {([['sello_folio', 'N° de sello final *'], ['unidad', 'Unidad (N° econ. de la caja) *'], ['informa', 'Quién informa *'], ['soporte', 'Soporte (foto, documento, mensaje) *']] as const).map(([k, l]) => (
          <div key={k} className="space-y-1">
            <label className="text-xs text-muted-foreground font-semibold">{l}</label>
            <input className={fieldCls} maxLength={k === 'soporte' ? 500 : 150} value={ev[k] ?? ''} onChange={x => setEv(s => ({ ...s, [k]: x.target.value }))} />
          </div>
        ))}
        <div className="space-y-1">
          <label className="text-xs text-muted-foreground font-semibold">Fecha que informa el tercero (si la da)</label>
          <input type="date" className={fieldCls} value={ev.fecha_informada ?? ''} onChange={x => setEv(s => ({ ...s, fecha_informada: x.target.value }))} />
        </div>
      </div>
      <Boton type="button" tamano="sm" onClick={async () => { if (await onAgregar(ev)) setEv({ unidad: unidadSugerida }) }}>Registrar evidencia</Boton>
    </div>
  )
}

export function ManifiestoPorTarima() {
  const { profile, codigoClave } = useAuthContext()
  const orgId = profile?.org_id ?? null
  const puedeVerificar = ['admin_org', 'asesor_tecnico', 'super_admin'].includes(profile?.rol ?? '')
  const { terminosSitio } = useModulosContext()
  const { ranchos } = useRanchos()
  const { items, bloques } = useM82Catalogo()
  const { manifiestos, historial, loading, error, refetch } = useM86Lista()
  const codigoFmt = codigoFormato('F-FRUS-PRO-01', codigoClave)
  const itemPorCodigo = useMemo(() => new Map(items.map(i => [i.codigo, i])), [items])
  const frutaDe = (codigo: string) => { const i = itemPorCodigo.get(codigo); return i ? bloques.find(b => b.id === i.bloque_id)?.fruta ?? '' : '' }

  const [selId, setSelId] = useState<string | null>(null)
  const [det, setDet] = useState<M86Detalle | null>(null)
  const [cargandoDet, setCargandoDet] = useState(false)
  const [abierta, setAbierta] = useState<'A' | 'B' | 'C'>('A')
  const navigate = useNavigate()
  // ── Tarimas registradas (M87): reservar ≠ cargar
  const [regs, setRegs] = useState<M86TarimaReg[]>([])
  const [regSel, setRegSel] = useState<string[]>([])
  const [regCotejo, setRegCotejo] = useState(false)
  const [regGuardando, setRegGuardando] = useState(false)
  const regClave = useRef(nuevaClave())
  const [manualOpen, setManualOpen] = useState(false)
  async function recargar(id = selId) {
    if (!id) return
    setCargandoDet(true)
    try {
      const d = await cargarDetalleM86(id); setDet(d)
      cargarTarimasRegM86(d.m.rancho_id, d.m.empresa, d.m.id).then(setRegs).catch(() => setRegs([]))
      setAbierta(d.m.carga_en ? (d.m.salida_en || d.m.estado === 'CARGA_COMPLETA' ? 'C' : 'B') : 'A')
    } catch (e) { avisar(e) } finally { setCargandoDet(false) }
  }
  useEffect(() => { if (selId) recargar(selId); else setDet(null) }, [selId]) // eslint-disable-line react-hooks/exhaustive-deps

  async function accion(nombre: string, datos: Record<string, unknown> = {}, ok?: string) {
    if (!det) return false
    try { await accionM86(det.m.id, nombre, datos); if (ok) toast.success(ok); await recargar(det.m.id); refetch(); return true }
    catch (e) { avisar(e); await recargar(det.m.id); return false }
  }

  // ── Nuevo manifiesto
  const [nuevoOpen, setNuevoOpen] = useState(false)
  const [nuevo, setNuevo] = useState<Record<string, string>>({})
  const [ranchoId, setRanchoId] = useState('')
  const [guardando, setGuardando] = useState(false)
  useEffect(() => { if (ranchos.length >= 1 && !ranchoId) setRanchoId(ranchos[0].id) }, [ranchos, ranchoId])
  async function crear() {
    if (!ranchoId) { toast.error(`Selecciona ${terminosSitio.singular.toLowerCase()}`); return }
    if (!nuevo.empresa?.trim()) { toast.error('Indica la empresa'); return }
    setGuardando(true)
    try { const id = await crearManifiestoM86(ranchoId, { ...nuevo, empresa: nuevo.empresa.trim().replace(/\s+/g, ' ').toUpperCase(), temp_unidad: 'C' }); setNuevoOpen(false); await refetch(); setSelId(id) }
    catch (e) { avisar(e) } finally { setGuardando(false) }
  }
  const CAMPOS: [string, string][] = [['folio', 'N° de manifiesto (folio real)'], ['empresa', 'Empresa *'], ['transportista', 'Línea transportista'], ['chofer', 'Nombre del chofer'],
    ['tractor_placas', 'Placas del tractor'], ['tractor_economico', 'N° econ. del tractor'], ['caja_pies', 'Caja (pies)'], ['caja_economico', 'N° econ. de la caja']]

  // ── Datos de transporte (editar)
  const [datosOpen, setDatosOpen] = useState(false)
  const [datos, setDatos] = useState<Record<string, string>>({})

  // ── Inspecciones
  const [itOpen, setItOpen] = useState(false)
  const [it, setIt] = useState<{ buen_estado: boolean | null; limpio: boolean | null; plagas: boolean | null }>({ buen_estado: null, limpio: null, plagas: null })
  const [itarOpen, setItarOpen] = useState(false)
  const [itar, setItar] = useState<Record<string, boolean | null>>({})
  const ITAR: [string, string][] = [['remontado', 'Remontado correcto'], ['flejado', 'Flejado correcto'], ['limpieza', 'Condiciones de limpieza'], ['condicion', 'Condición de la tarima'], ['distribucion', 'Distribución del embarque (tras el acomodo)']]

  // ── Tarima en captura
  const numRef = useRef<HTMLInputElement>(null)
  const claveRef = useRef(nuevaClave())
  const [numero, setNumero] = useState('')
  const [lineas, setLineas] = useState<LineaForm[]>([{ codigo: '', cajas: '' }])
  const [sugeridas, setSugeridas] = useState<LineaForm[]>([])
  const [cotejo, setCotejo] = useState(false)
  const [papeletaId, setPapeletaId] = useState('')
  const [papeletas, setPapeletas] = useState<M86PapeletaRef[]>([])
  useEffect(() => { if (orgId && selId) cargarPapeletasM86(orgId).then(setPapeletas).catch(() => setPapeletas([])) }, [orgId, selId])
  const [busq, setBusq] = useState<{ idx: number; q: string } | null>(null)
  const clasifTarima = (() => { const cs = Array.from(new Set(lineas.map(l => itemPorCodigo.get(l.codigo)?.clasificacion).filter(Boolean))); return cs.length === 1 ? cs[0] : cs.length > 1 ? 'MEZCLA' : null })()
  const sugerencias = useMemo(() => {
    if (!busq) return []
    const q = busq.q.trim().toLowerCase()
    const base = clasifTarima && clasifTarima !== 'MEZCLA' ? items.filter(i => i.clasificacion === clasifTarima) : items
    return base.filter(i => !q || i.codigo.startsWith(q) || i.presentacion.toLowerCase().includes(q)).slice(0, 8)
  }, [busq, items, clasifTarima])
  function elegirItem(idx: number, codigo: string) {
    setLineas(ls => {
      const dup = ls.findIndex((l, i) => i !== idx && l.codigo === codigo)
      if (dup >= 0) { toast.info(`El ítem ${codigo} ya está en la tarima: suma sus cajas en esa línea`); return ls.filter((_, i) => i !== idx || ls.length === 1) }
      return ls.map((l, i) => i === idx ? { ...l, codigo } : l)
    })
    setBusq(null)
  }
  const [confirmando, setConfirmando] = useState(false)
  async function confirmarTarima() {
    if (!det) return
    const n = numero.trim().toUpperCase()
    if (!/^[0-9A-Z-]{1,12}$/.test(n)) { toast.error('Escribe el número de la tarima'); return }
    const ls = lineas.filter(l => l.codigo || l.cajas)
    if (ls.length === 0) { toast.error('Agrega al menos una presentación'); return }
    for (const l of ls) {
      if (!itemPorCodigo.has(l.codigo)) { toast.error('Elige el ítem de cada línea del catálogo'); return }
      if (!/^\d+$/.test(l.cajas) || Number(l.cajas) <= 0) { toast.error(`Cajas inválidas en ${l.codigo}`); return }
    }
    if (clasifTarima === 'MEZCLA') { toast.error('Una tarima no mezcla orgánico y convencional'); return }
    if (!cotejo) { toast.error('Marca el cotejo físico de la tarima (identificación, papeleta y disponibilidad)'); return }
    setConfirmando(true)
    const ok = await accion('CONFIRMAR_TARIMA', { key: claveRef.current, numero: n, cotejo: true, papeleta_id: papeletaId || null, lineas: ls.map(l => ({ codigo: l.codigo, cajas: Number(l.cajas) })) }, `Tarima ${n} cargada`)
    setConfirmando(false)
    if (ok) {
      claveRef.current = nuevaClave()
      setSugeridas(ls); setNumero(''); setLineas([{ codigo: '', cajas: '' }]); setCotejo(false); setPapeletaId(''); numRef.current?.focus()
    }
  }

  async function accionReg(tipo: 'RESERVAR' | 'LIBERAR_RESERVA' | 'CARGAR_TARIMAS') {
    const ids = regSel.filter(id => {
      const t = regs.find(x => x.id === id); if (!t) return false
      return tipo === 'LIBERAR_RESERVA' ? t.estado === 'RESERVADA' : tipo === 'RESERVAR' ? t.estado !== 'RESERVADA' : true
    })
    if (ids.length === 0) { toast.error(tipo === 'LIBERAR_RESERVA' ? 'Elige tarimas reservadas' : 'Elige tarimas'); return }
    if (tipo === 'CARGAR_TARIMAS' && !regCotejo) { toast.error('Marca el cotejo físico de las tarimas'); return }
    setRegGuardando(true)
    const datos: Record<string, unknown> = { tarimas: ids }
    if (tipo === 'CARGAR_TARIMAS') { datos.key = regClave.current; datos.cotejo = true }
    const ok = await accion(tipo, datos, tipo === 'RESERVAR' ? `${ids.length} tarima(s) reservadas` : tipo === 'LIBERAR_RESERVA' ? 'Reserva liberada' : `${ids.length} tarima(s) cargadas`)
    setRegGuardando(false)
    if (ok) { setRegSel([]); if (tipo === 'CARGAR_TARIMAS') { regClave.current = nuevaClave(); setRegCotejo(false) } }
  }

  // ── Muestra
  const [muestraOpen, setMuestraOpen] = useState(false)
  const [muestra, setMuestra] = useState({ numero: '', superior: '', medio: '', inferior: '' })

  // ── Folios / conformidades
  const [termo, setTermo] = useState('')
  const [selloEstado, setSelloEstado] = useState<'COLOCADO' | 'PENDIENTE_CONSOLIDADO' | ''>('')
  const [selloFolio, setSelloFolio] = useState('')
  const [obs, setObs] = useState('')
  const [confNombre, setConfNombre] = useState<Record<string, string>>({})
  useEffect(() => {
    if (!det) return
    setTermo(det.m.termografo_folio ?? ''); setSelloEstado(det.m.sello_estado ?? ''); setSelloFolio(det.m.sello_folio ?? ''); setObs(det.m.observaciones ?? '')
    setConfNombre({ EMERGENT: det.m.conf_emergent_nombre ?? profile?.nombre_completo ?? '', CLIENTE: det.m.conf_cliente_nombre ?? '', CHOFER: det.m.conf_chofer_nombre ?? det.m.chofer ?? '' })
  }, [det?.m.id, det?.m.termografo_folio, det?.m.sello_estado, det?.m.observaciones]) // eslint-disable-line react-hooks/exhaustive-deps

  const [pdfCargando, setPdfCargando] = useState(false)
  async function pdf() {
    if (!det || !orgId) return
    setPdfCargando(true)
    try { await generarManifiestoPorTarimaPDF(det.m.id, orgId, codigoClave) } catch (e: any) { toast.error(e?.message ?? 'Error al generar PDF') } finally { setPdfCargando(false) }
  }

  // ═══ Lista ═══
  if (!selId) {
    return (
      <div className="flex flex-col min-h-full bg-background pb-safe-nav">
        <ModuloHeader tituloFallback="Manifiesto de Embarque" subtitulo={`${codigoFmt} · Por embarque`} />
        <div className="p-4 space-y-2 max-w-3xl w-full mx-auto">
          {error && <p className="text-xs" style={{ color: 'var(--agro-danger-text)' }}>Error al cargar manifiestos.</p>}
          {loading ? <ListaSkeleton rows={3} /> : manifiestos.length === 0 ? (
            <EstadoVacio icono={Truck} titulo="Sin manifiestos" ayuda="Crea el manifiesto cuando llegue el tráiler con el botón +" />
          ) : manifiestos.map((m: M86Manifiesto) => (
            <button key={m.id} type="button" onClick={() => setSelId(m.id)} className="w-full text-left rounded-[0.625rem] border border-border bg-card p-3">
              <div className="flex items-start justify-between gap-2">
                <div className="min-w-0">
                  <p className="text-sm font-semibold truncate">N° {m.folio ?? 'sin folio'} · {m.empresa}</p>
                  <p className="text-xs text-muted-foreground truncate">{fechaCorta(m.fecha)} · {m.transportista ?? '—'} · {m.tractor_placas ?? '—'}</p>
                </div>
                <span className="text-xs px-2 py-0.5 rounded-full font-semibold flex-shrink-0" style={{ backgroundColor: ESTADO[m.estado].f, color: ESTADO[m.estado].c }}>{ESTADO[m.estado].t}</span>
              </div>
            </button>
          ))}
        </div>
        <Fab onClick={() => { setNuevo({ empresa: 'DRISCOLL' }); setNuevoOpen(true) }} aria-label="Nuevo manifiesto" />
        <BottomSheet open={nuevoOpen} onClose={() => { if (!guardando) setNuevoOpen(false) }} height="85%">
          <div className="flex items-center justify-between px-4 pt-4 pb-3 border-b border-border">
            <h2 className="text-base text-foreground font-semibold">Nuevo manifiesto</h2>
            <button aria-label="Cerrar" type="button" onClick={() => setNuevoOpen(false)}><X className="w-5 h-5 text-muted-foreground" /></button>
          </div>
          <div className="overflow-y-auto px-4 pb-6 pt-3 space-y-3" style={{ flex: 1 }}>
            {ranchos.length > 1 && (
              <select className={fieldCls} value={ranchoId} onChange={e => setRanchoId(e.target.value)}>{ranchos.map(r => <option key={r.id} value={r.id}>{r.nombre}</option>)}</select>
            )}
            {CAMPOS.map(([k, label]) => (
              <div key={k} className="space-y-1">
                <label className="text-xs text-muted-foreground font-semibold">{label}</label>
                <input className={fieldCls} maxLength={k === 'folio' ? 40 : 150} list={`h-${k}`} value={nuevo[k] ?? ''} onChange={e => setNuevo(n => ({ ...n, [k]: e.target.value }))} />
                <datalist id={`h-${k}`}>{(historial[k] ?? []).map(v => <option key={v} value={v} />)}</datalist>
              </div>
            ))}
            <p className="text-xs text-muted-foreground">Las sugerencias vienen de manifiestos anteriores: confírmalas contra la unidad y el chofer reales. El folio es el real del documento; si aún no lo tienes, déjalo vacío.</p>
            <Boton type="button" onClick={crear} cargando={guardando} className="w-full">Crear manifiesto</Boton>
          </div>
        </BottomSheet>
      </div>
    )
  }

  // ═══ Detalle ═══
  const m = det?.m
  const u = m?.temp_unidad ?? 'C'
  const cargadas = det?.tarimas.filter(t => t.estado === 'CARGADA') ?? []
  const totales = det ? totalesPorPresentacion(det.tarimas) : []
  const transporteOk = m ? m.it_buen_estado === true && m.it_limpio === true && m.it_plagas === false : false
  const tarimasOk = m ? [m.itar_remontado, m.itar_flejado, m.itar_limpieza, m.itar_condicion, m.itar_distribucion].every(v => v === true) : false
  const cierreLocal = m?.estado === 'CIERRE_LOCAL_SELLO_PENDIENTE'
  const cerrado = m?.estado === 'CERRADO' || cierreLocal
  const suspendido = m?.estado === 'SUSPENDIDO'

  return (
    <div className="flex flex-col min-h-full bg-background pb-safe-nav">
      <ModuloHeader tituloFallback="Manifiesto de Embarque" subtitulo={m ? `N° ${m.folio ?? 'sin folio'} · ${m.empresa}` : codigoFmt}
        onBack={() => { setSelId(null); refetch() }} />
      <div className="p-4 space-y-3 max-w-3xl w-full mx-auto">
        {(!m || cargandoDet && !det) ? <ListaSkeleton rows={3} /> : (<>
          <div className="flex items-center justify-between gap-2">
            <button type="button" className="text-xs flex items-center gap-1 text-muted-foreground" onClick={() => { setSelId(null); refetch() }}><ChevronLeft className="w-4 h-4" /> Manifiestos</button>
            <div className="flex items-center gap-2">
              <span className="text-xs px-2 py-0.5 rounded-full font-semibold" style={{ backgroundColor: ESTADO[m.estado].f, color: ESTADO[m.estado].c }}>{ESTADO[m.estado].t}</span>
              <button onClick={pdf} disabled={pdfCargando} className="h-9 px-3 rounded-[0.625rem] border border-border flex items-center gap-2 text-sm disabled:opacity-50">
                {pdfCargando ? <Loader2 className="w-4 h-4 animate-spin" /> : <FileDown className="w-4 h-4" style={{ color: 'var(--primary)' }} />} PDF
              </button>
            </div>
          </div>
          {suspendido && (
            <div className="rounded-xl p-3 flex items-center justify-between gap-2" style={{ backgroundColor: 'var(--agro-danger-fill)' }}>
              <span className="text-xs" style={{ color: 'var(--agro-danger-text)' }}>Suspendido: {m.suspendido_motivo}</span>
              <Boton type="button" tamano="sm" onClick={() => accion('REANUDAR', {}, 'Manifiesto reanudado')}>Reanudar</Boton>
            </div>
          )}

          {/* A · Llegada */}
          <Etapa titulo="A · Llegada" hecho={!!m.llegada_en && transporteOk} abierta={abierta === 'A'} onToggle={() => setAbierta('A')}>
            <div className="text-xs text-muted-foreground space-y-0.5">
              <p>{m.transportista ?? 'Sin transportista'} · Chofer {m.chofer ?? '—'}</p>
              <p>Tractor {m.tractor_placas ?? '—'} / econ. {m.tractor_economico ?? '—'} · Caja {m.caja_pies ?? '—'} pies / econ. {m.caja_economico ?? '—'}</p>
            </div>
            {!cerrado && <button type="button" className="text-xs underline" style={{ color: 'var(--primary)' }} onClick={() => { setDatos({}); setDatosOpen(true) }}>Cotejar o corregir datos del transporte y folio</button>}
            <EventoCamion etiqueta="Llegada" en={m.llegada_en} t={m.llegada_temp} unidad={u} deshabilitado={cerrado || suspendido}
              onGuardar={async (t, en) => { await accion('LLEGADA', { temp: t, en }, 'Llegada registrada') }} />
            <div className="flex items-center justify-between gap-2">
              <span className="text-xs" style={{ color: m.it_buen_estado === null ? 'var(--muted-foreground)' : transporteOk ? 'var(--agro-success-text)' : 'var(--agro-danger-text)' }}>
                {m.it_buen_estado === null ? 'Inspección del transporte pendiente' : transporteOk ? 'Transporte conforme' : 'Transporte NO conforme: detener carga, corregir y reinspeccionar'}
              </span>
              <Boton type="button" tamano="sm" variante="secundario" disabled={!!m.carga_en || cerrado || suspendido}
                onClick={() => { setIt({ buen_estado: null, limpio: null, plagas: null }); setItOpen(true) }}>Inspección del transporte</Boton>
            </div>
          </Etapa>

          {/* B · Carga */}
          <Etapa titulo={`B · Carga (${cargadas.length} tarimas · ${totales.reduce((a, t) => a + t.cajas, 0)} cajas)`} hecho={!!m.carga_en && tarimasOk && cargadas.length > 0} abierta={abierta === 'B'} onToggle={() => setAbierta('B')}>
            <EventoCamion etiqueta="Carga" en={m.carga_en} t={m.carga_temp} unidad={u} deshabilitado={!m.llegada_en || !transporteOk || cerrado || suspendido}
              onGuardar={async (t, en) => { await accion('CARGA', { temp: t, en }, 'Inicio de carga registrado') }} />
            {!m.salida_en && !cerrado && !suspendido && (
              <div className="rounded-[0.625rem] border border-border p-3 space-y-2">
                <p className="text-xs font-semibold">Tarimas registradas de {m.empresa}</p>
                {regs.length === 0 ? <p className="text-xs text-muted-foreground">No hay tarimas armadas disponibles para esta empresa.</p> : (
                  <ul className="space-y-1">
                    {regs.map(t => {
                      const on = regSel.includes(t.id)
                      return (
                        <li key={t.id}>
                          <label className={`flex items-center gap-2 rounded-[0.625rem] border p-2 text-sm ${on ? 'border-primary' : 'border-border'}`}>
                            <input type="checkbox" checked={on} onChange={() => setRegSel(x => on ? x.filter(y => y !== t.id) : [...x, t.id])} />
                            <span className="min-w-0 truncate"><b>N.{t.numero}</b> · #{t.codigo} {t.presentacion} · {t.clasificacion} · {t.cajas} cajas · Prod. {t.codigo_productor}</span>
                            <span className="text-xs ml-auto flex-shrink-0" style={t.estado === 'RESERVADA' ? { color: 'var(--agro-info-text)' } : { color: 'var(--muted-foreground)' }}>
                              {t.estado === 'RESERVADA' ? 'Reservada aquí' : t.estado === 'EN_CONSERVADOR' ? 'En conservador' : 'Armada'}
                            </span>
                          </label>
                        </li>
                      )
                    })}
                  </ul>
                )}
                {regs.length > 0 && (<>
                  <div className="flex gap-2">
                    <Boton type="button" tamano="sm" variante="secundario" className="flex-1" disabled={regGuardando} onClick={() => accionReg('RESERVAR')}>Reservar</Boton>
                    <Boton type="button" tamano="sm" variante="secundario" className="flex-1" disabled={regGuardando} onClick={() => accionReg('LIBERAR_RESERVA')}>Liberar reserva</Boton>
                  </div>
                  <p className="text-xs text-muted-foreground">Reservar aparta la tarima para este manifiesto; no la cuenta como cargada.</p>
                  {m.carga_en ? (<>
                    <label className="flex items-start gap-2 text-xs">
                      <input type="checkbox" className="mt-0.5" checked={regCotejo} onChange={e => setRegCotejo(e.target.checked)} />
                      <span>Cotejé físicamente las tarimas elegidas: están arriba del tráiler, con su identificación y papeleta.</span>
                    </label>
                    <Boton type="button" className="w-full" cargando={regGuardando} onClick={() => accionReg('CARGAR_TARIMAS')}>Confirmar carga de {regSel.length || ''} tarima(s)</Boton>
                  </>) : <p className="text-xs text-muted-foreground">Registra el inicio de carga para confirmar tarimas cargadas.</p>}
                </>)}
              </div>
            )}
            {m.carga_en && !m.salida_en && !cerrado && !suspendido && regs.length > 0 && (
              <button type="button" className="text-xs underline" style={{ color: 'var(--primary)' }} onClick={() => setManualOpen(o => !o)}>
                {manualOpen ? 'Ocultar captura manual' : 'Captura manual (tarima sin registro en M.A.D.Y.)'}
              </button>
            )}
            {m.carga_en && !m.salida_en && !cerrado && !suspendido && (manualOpen || regs.length === 0) && (
              <div className="rounded-[0.625rem] border border-border p-3 space-y-2">
                <div className="flex gap-2 items-end">
                  <div className="w-32 space-y-1">
                    <label className="text-xs text-muted-foreground font-semibold">Tarima N° *</label>
                    <input ref={numRef} className={fieldCls} inputMode="numeric" maxLength={12} value={numero} onChange={e => setNumero(e.target.value.toUpperCase().replace(/[^0-9A-Z-]/g, ''))} />
                  </div>
                  {clasifTarima && <span className="text-xs font-semibold pb-2" style={clasifTarima === 'MEZCLA' ? { color: 'var(--agro-danger-text)' } : undefined}>{clasifTarima === 'MEZCLA' ? 'ORG y CONV mezclados' : clasifTarima}</span>}
                </div>
                {lineas.map((l, idx) => {
                  const it = itemPorCodigo.get(l.codigo)
                  const sug = sugeridas[idx]
                  return (
                    <div key={idx} className="space-y-1">
                      <div className="flex gap-2 items-center">
                        <button type="button" className={`${fieldCls} flex-1 text-left truncate`} onClick={() => setBusq({ idx, q: '' })}>
                          {it ? `#${it.codigo} · ${it.presentacion}` : sug ? <span className="text-muted-foreground">Sugerido: #{sug.codigo} (confirma)</span> : <span className="text-muted-foreground">Elegir ítem…</span>}
                        </button>
                        <input inputMode="numeric" className="w-20 h-10 rounded-[0.625rem] border border-border-control bg-input-background px-2 text-sm text-right"
                          placeholder={sug?.cajas ?? 'Cajas'} value={l.cajas} aria-label="Cajas" onChange={e => { const v = e.target.value.replace(/\D/g, ''); setLineas(ls => ls.map((x, i) => i === idx ? { ...x, cajas: v } : x)) }} />
                        {lineas.length > 1 && <button type="button" aria-label="Quitar" onClick={() => setLineas(ls => ls.filter((_, i) => i !== idx))}><Trash2 className="w-4 h-4 text-muted-foreground" /></button>}
                      </div>
                      {busq?.idx === idx && (
                        <div className="rounded-[0.625rem] border border-border p-2 space-y-1">
                          <div className="relative">
                            <Search className="w-4 h-4 absolute left-3 top-3 text-muted-foreground" />
                            <input autoFocus className={`${fieldCls} pl-9`} placeholder="Código (ej. 005) o presentación" value={busq.q} onChange={e => setBusq({ idx, q: e.target.value })} />
                          </div>
                          {sug && !l.codigo && <button type="button" className="text-xs underline" onClick={() => elegirItem(idx, sug.codigo)}>Usar sugerido #{sug.codigo}</button>}
                          {sugerencias.map(i => (
                            <button key={i.id} type="button" onClick={() => elegirItem(idx, i.codigo)} className="w-full text-left text-sm px-2 py-1.5 rounded hover:bg-muted">
                              <b>{i.codigo}</b> · {i.presentacion} <span className="text-xs text-muted-foreground">· {frutaDe(i.codigo)} · {i.clasificacion}</span>
                            </button>
                          ))}
                        </div>
                      )}
                    </div>
                  )
                })}
                <div className="flex gap-2">
                  <button type="button" className="text-xs flex items-center gap-1" style={{ color: 'var(--primary)' }} onClick={() => setLineas(ls => [...ls, { codigo: '', cajas: '' }])}><Plus className="w-3 h-3" /> Presentación</button>
                </div>
                <div className="space-y-1">
                  <label className="text-xs text-muted-foreground font-semibold">Papeleta PRO-07 relacionada (solo si la conoces)</label>
                  <select className={fieldCls} value={papeletaId} onChange={e => setPapeletaId(e.target.value)}>
                    <option value="">Ninguna identificada</option>
                    {papeletas.map(p => <option key={p.id} value={p.id}>#{p.codigo} · {p.embalaje} · {p.cajas} cajas · {p.estado === 'LIBERADA' ? 'liberada' : p.estado === 'RETENIDA' ? 'RETENIDA' : 'RECHAZADA'} · {fechaCorta(p.fecha)}</option>)}
                  </select>
                </div>
                <label className="flex items-start gap-2 text-xs">
                  <input type="checkbox" className="mt-0.5" checked={cotejo} onChange={e => setCotejo(e.target.checked)} />
                  <span>Cotejé físicamente la tarima: identificación, papeleta y disponibilidad. No tiene retención vigente que yo conozca. <span className="text-muted-foreground">(Verificación manual: M.A.D.Y. no detecta retenciones de forma automática.)</span></span>
                </label>
                <Boton type="button" className="w-full" cargando={confirmando} onClick={confirmarTarima}>Confirmar tarima cargada</Boton>
                <p className="text-xs text-muted-foreground">Confirma solo cuando la tarima ya está físicamente arriba del tráiler y contada. Las sugerencias no cuentan hasta confirmarlas.</p>
              </div>
            )}
            {cargadas.length > 0 && (
              <ul className="space-y-1">
                {[...cargadas].reverse().map(t => (
                  <li key={t.id} className="rounded-[0.625rem] border border-border px-3 py-2 flex items-start justify-between gap-2 text-sm">
                    <div className="min-w-0">
                      <b>Tarima {t.numero}</b> · {t.clasificacion} · {t.lineas.reduce((a, l) => a + l.cajas, 0)} cajas
                      <p className="text-xs text-muted-foreground truncate">{t.lineas.map(l => { const pr = productoresDe(t, l.codigo); return `#${l.codigo} ${l.presentacion} ×${l.cajas}${pr ? ` · Prod. ${pr}` : ''}` }).join(' · ')}</p>
                    </div>
                    {!m.salida_en && !cerrado && (
                      <button type="button" className="text-xs underline flex-shrink-0" onClick={async () => {
                        const motivo = window.prompt(`Retirar la tarima ${t.numero}. Motivo (queda en el historial):`)
                        if (motivo !== null) await accion('RETIRAR_TARIMA', { tarima_id: t.id, motivo }, `Tarima ${t.numero} retirada`)
                      }}>Retirar</button>
                    )}
                  </li>
                ))}
              </ul>
            )}
            {m.carga_en && (
              <div className="flex flex-wrap gap-2 items-center justify-between">
                <span className="text-xs text-muted-foreground">{det!.muestras.length} tarima(s) medidas · {m.itar_remontado === null ? 'Inspección de tarimas pendiente' : tarimasOk ? 'Tarimas conformes' : 'Tarimas con desviación: corregir y reinspeccionar'}</span>
                <div className="flex gap-2">
                  <Boton type="button" tamano="sm" variante="secundario" disabled={!!m.salida_en || cargadas.length === 0 || cerrado}
                    onClick={() => { setMuestra({ numero: '', superior: '', medio: '', inferior: '' }); setMuestraOpen(true) }}><Thermometer className="w-4 h-4" /> Temperatura de fruta</Boton>
                  <Boton type="button" tamano="sm" variante="secundario" disabled={!!m.salida_en || cerrado}
                    onClick={() => { setItar({}); setItarOpen(true) }}>Inspección de tarimas</Boton>
                </div>
              </div>
            )}
          </Etapa>

          {/* C · Salida y cierre */}
          <Etapa titulo="C · Salida y cierre" hecho={cerrado} abierta={abierta === 'C'} onToggle={() => setAbierta('C')}>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <div className="space-y-1">
                <label className="text-xs text-muted-foreground font-semibold">N° de chismógrafo (folio real)</label>
                <input className={fieldCls} maxLength={40} value={termo} disabled={!!m.salida_en || cerrado} onChange={e => setTermo(e.target.value)} />
              </div>
              <div className="space-y-1">
                <label className="text-xs text-muted-foreground font-semibold">Sello</label>
                <div className="flex gap-1 flex-wrap">
                  <Chip activo={selloEstado === 'COLOCADO'} onClick={() => setSelloEstado('COLOCADO')}>Colocado</Chip>
                  <Chip activo={selloEstado === 'PENDIENTE_CONSOLIDADO'} onClick={() => setSelloEstado('PENDIENTE_CONSOLIDADO')}>Pendiente por consolidado</Chip>
                </div>
                {selloEstado === 'COLOCADO' && <input className={fieldCls} maxLength={40} placeholder="N° de sello verificado" value={selloFolio} disabled={!!m.salida_en || cerrado} onChange={e => setSelloFolio(e.target.value)} />}
              </div>
            </div>
            {!m.salida_en && !cerrado && (
              <Boton type="button" variante="secundario" tamano="sm" onClick={() => accion('FOLIOS', { termografo: termo, sello_estado: selloEstado, sello_folio: selloFolio }, 'Folios guardados')}>Guardar chismógrafo y sello</Boton>
            )}
            <EventoCamion etiqueta="Salida" en={m.salida_en} t={m.salida_temp} unidad={u} deshabilitado={!m.carga_en || cerrado || suspendido}
              onGuardar={async (t, en) => { await accion('SALIDA', { temp: t, en }, 'Salida registrada') }} />
            {totales.length > 0 && (
              <div className="rounded-[0.625rem] border border-border p-2 text-xs space-y-0.5">
                {totales.map((t, i) => <p key={t.codigo}>Total producto {i + 1}{i >= 5 ? ' (cont.)' : ''}: <b>#{t.codigo} {t.presentacion}</b> · {t.clasificacion} · <b>{t.cajas}</b> cajas</p>)}
              </div>
            )}
            <div className="space-y-1">
              <label className="text-xs text-muted-foreground font-semibold">Observaciones</label>
              <textarea className={areaCls} rows={3} maxLength={2000} value={obs} disabled={cerrado} onChange={e => setObs(e.target.value)} placeholder="Diferencias, desviaciones, referencias a incidentes o retenciones" />
              {!cerrado && <Boton type="button" tamano="sm" variante="secundario" onClick={() => accion('OBSERVACIONES', { texto: obs }, 'Observaciones guardadas')}>Guardar observaciones</Boton>}
            </div>
            {m.salida_en && (
              <div className="space-y-2">
                <TituloSeccion>Conformidades (firma manuscrita en papel)</TituloSeccion>
                {([['EMERGENT', 'Responsable de la instalación', m.conf_emergent_en, m.conf_emergent_nombre], ['CLIENTE', 'Responsable empresa', m.conf_cliente_en, m.conf_cliente_nombre], ['CHOFER', 'Chofer', m.conf_chofer_en, m.conf_chofer_nombre]] as const).map(([tipo, etq, en, nom]) => (
                  <div key={tipo} className="flex gap-2 items-center">
                    <span className="text-xs w-40 flex-shrink-0">{etq}</span>
                    {en ? <span className="text-sm">Conformidad registrada: {nom} · {horaLocal(en)}</span> : (<>
                      <input className={fieldCls} maxLength={150} placeholder="Nombre de quien firma" value={confNombre[tipo] ?? ''} onChange={e => setConfNombre(c => ({ ...c, [tipo]: e.target.value }))} />
                      <Boton type="button" tamano="sm" onClick={() => accion('CONFORMIDAD', { tipo, nombre: confNombre[tipo] ?? '' }, 'Conformidad registrada')}>Registrar</Boton>
                    </>)}
                  </div>
                ))}
                <p className="text-xs text-muted-foreground">Registra cada conformidad solo cuando esa persona firmó el papel. El nombre no es una firma digital. Con las tres se cierra la operación local{m.sello_estado === 'PENDIENTE_CONSOLIDADO' ? '; el cierre documental queda pendiente de la evidencia del sello' : ''}.</p>
                {m.conf_emergent_en && m.conf_cliente_en && m.conf_chofer_en && (
                  <ResguardoPapel actual={m.papel_resguardo} onGuardar={async (r) => { await accion('PAPEL', { resguardo: r }, 'Resguardo del papel registrado') }} />
                )}
              </div>
            )}
            {cierreLocal && (
              <SeguimientoSello evidencias={det!.evidencias} puedeVerificar={puedeVerificar} unidadSugerida={m.caja_economico ?? ''}
                onAgregar={async (ev) => accion('SELLO_EVIDENCIA', ev, 'Evidencia registrada; queda por verificar')}
                onVerificar={async (id, resultado, nota) => accion('SELLO_VERIFICAR', { evidencia_id: id, resultado, nota }, resultado === 'VERIFICADA' ? 'Evidencia verificada' : 'Evidencia marcada como no correspondiente')} />
            )}
            {cerrado && (
              <div className="rounded-[0.625rem] border border-border p-3 space-y-2">
                <p className="text-xs">¿Este fue el último tráiler? Si ya no se esperan más, cierra el ciclo de tarimas: decide qué pasa con las que quedaron y la numeración vuelve a empezar.</p>
                <Boton type="button" tamano="sm" variante="secundario" onClick={() => navigate('/inocuidad/tarimas')}>Ir a cerrar el ciclo</Boton>
              </div>
            )}
            {m.estado === 'CERRADO' && m.sello_estado === 'PENDIENTE_CONSOLIDADO' && (
              <p className="text-xs" style={{ color: 'var(--agro-success-text)' }}>Sello por consolidado: evidencia final verificada (evento posterior; la salida original no cambia).</p>
            )}
            {!cerrado && !suspendido && (
              <button type="button" className="text-xs underline" style={{ color: 'var(--agro-danger-text)' }} onClick={async () => {
                const motivo = window.prompt('Suspender el manifiesto. Motivo:'); if (motivo !== null) await accion('SUSPENDER', { motivo }, 'Manifiesto suspendido')
              }}>Suspender manifiesto</button>
            )}
          </Etapa>
        </>)}
      </div>

      {/* ═══ Inspección del transporte ═══ */}
      <BottomSheet open={itOpen} onClose={() => setItOpen(false)} height="85%">
        <div className="flex items-center justify-between px-4 pt-4 pb-3 border-b border-border">
          <h2 className="text-base text-foreground font-semibold">Inspección del transporte</h2>
          <button aria-label="Cerrar" type="button" onClick={() => setItOpen(false)}><X className="w-5 h-5 text-muted-foreground" /></button>
        </div>
        <div className="overflow-y-auto px-4 pb-6 pt-3 space-y-4" style={{ flex: 1 }}>
          {([['buen_estado', 'En buen estado', true], ['limpio', 'Limpio y libre de malos olores', true], ['plagas', 'Presencia de plagas', false]] as const).map(([k, etq, conforme]) => (
            <div key={k} className="flex items-center justify-between gap-2">
              <span className="text-sm">{etq}</span>
              <div className="flex gap-1">
                <Chip activo={it[k] === true} malo={!conforme} onClick={() => setIt(s => ({ ...s, [k]: true }))}>Sí</Chip>
                <Chip activo={it[k] === false} malo={conforme} onClick={() => setIt(s => ({ ...s, [k]: false }))}>No</Chip>
              </div>
            </div>
          ))}
          <p className="text-xs text-muted-foreground">No sustituye la revisión de integridad de 7 puntos del contenedor. Si algo no es conforme, la carga queda bloqueada hasta corregir y reinspeccionar.</p>
          <Boton type="button" className="w-full" disabled={it.buen_estado === null || it.limpio === null || it.plagas === null}
            onClick={async () => { if (await accion('INSPECCION_TRANSPORTE', it, 'Inspección guardada')) setItOpen(false) }}>Guardar inspección</Boton>
        </div>
      </BottomSheet>

      {/* ═══ Inspección de tarimas ═══ */}
      <BottomSheet open={itarOpen} onClose={() => setItarOpen(false)} height="85%">
        <div className="flex items-center justify-between px-4 pt-4 pb-3 border-b border-border">
          <h2 className="text-base text-foreground font-semibold">Inspección de tarimas</h2>
          <button aria-label="Cerrar" type="button" onClick={() => setItarOpen(false)}><X className="w-5 h-5 text-muted-foreground" /></button>
        </div>
        <div className="overflow-y-auto px-4 pb-6 pt-3 space-y-4" style={{ flex: 1 }}>
          {ITAR.map(([k, etq]) => (
            <div key={k} className="flex items-center justify-between gap-2">
              <span className="text-sm">{etq}</span>
              <div className="flex gap-1">
                <Chip activo={itar[k] === true} onClick={() => setItar(s => ({ ...s, [k]: true }))}>Bueno</Chip>
                <Chip activo={itar[k] === false} malo onClick={() => setItar(s => ({ ...s, [k]: false }))}>Malo</Chip>
              </div>
            </div>
          ))}
          <p className="text-xs text-muted-foreground">La distribución del embarque se califica después del acomodo; puedes dejarla sin responder y volver a abrir esta inspección.</p>
          <Boton type="button" className="w-full" onClick={async () => {
            const datos = Object.fromEntries(ITAR.map(([k]) => [k, itar[k] ?? null]))
            if (await accion('INSPECCION_TARIMAS', datos, 'Inspección guardada')) setItarOpen(false)
          }}>Guardar inspección</Boton>
        </div>
      </BottomSheet>

      {/* ═══ Muestra de temperatura ═══ */}
      <BottomSheet open={muestraOpen} onClose={() => setMuestraOpen(false)} height="85%">
        <div className="flex items-center justify-between px-4 pt-4 pb-3 border-b border-border">
          <h2 className="text-base text-foreground font-semibold">Temperatura de fruta (tarima muestreada)</h2>
          <button aria-label="Cerrar" type="button" onClick={() => setMuestraOpen(false)}><X className="w-5 h-5 text-muted-foreground" /></button>
        </div>
        <div className="overflow-y-auto px-4 pb-6 pt-3 space-y-4" style={{ flex: 1 }}>
          <div className="space-y-1">
            <label className="text-xs text-muted-foreground font-semibold">Tarima medida *</label>
            <select className={fieldCls} value={muestra.numero} onChange={e => setMuestra(s => ({ ...s, numero: e.target.value }))}>
              <option value="">Selecciona…</option>
              {cargadas.map(t => <option key={t.id} value={t.numero}>Tarima {t.numero}</option>)}
            </select>
          </div>
          <div className="grid grid-cols-3 gap-2">
            {(['superior', 'medio', 'inferior'] as const).map(k => (
              <div key={k} className="space-y-1">
                <label className="text-xs text-muted-foreground font-semibold capitalize">{k} (°{u})</label>
                <input inputMode="decimal" className={numCls} value={muestra[k]} onChange={e => setMuestra(s => ({ ...s, [k]: e.target.value.replace(/[^0-9.,-]/g, '') }))} />
              </div>
            ))}
          </div>
          <p className="text-xs text-muted-foreground">Solo tarimas elegidas al azar y medidas de verdad. Las demás quedan sin muestreo (no se copia ninguna lectura).</p>
          <Boton type="button" className="w-full" onClick={async () => {
            const s = temp(muestra.superior), me = temp(muestra.medio), i = temp(muestra.inferior)
            if (!muestra.numero || s === null || me === null || i === null) { toast.error('Elige la tarima y captura las tres lecturas'); return }
            if (await accion('MUESTRA', { numero: muestra.numero, superior: s, medio: me, inferior: i }, 'Lecturas guardadas')) setMuestraOpen(false)
          }}>Guardar lecturas</Boton>
        </div>
      </BottomSheet>

      {/* ═══ Datos del transporte ═══ */}
      <BottomSheet open={datosOpen} onClose={() => setDatosOpen(false)} height="85%">
        <div className="flex items-center justify-between px-4 pt-4 pb-3 border-b border-border">
          <h2 className="text-base text-foreground font-semibold">Datos del manifiesto</h2>
          <button aria-label="Cerrar" type="button" onClick={() => setDatosOpen(false)}><X className="w-5 h-5 text-muted-foreground" /></button>
        </div>
        {m && (
          <div className="overflow-y-auto px-4 pb-6 pt-3 space-y-3" style={{ flex: 1 }}>
            {CAMPOS.map(([k, label]) => (
              <div key={k} className="space-y-1">
                <label className="text-xs text-muted-foreground font-semibold">{label.replace(' *', '')}</label>
                <input className={fieldCls} maxLength={k === 'folio' ? 40 : 150} list={`hd-${k}`} placeholder={(m as any)[k] ?? ''} value={datos[k] ?? ''} onChange={e => setDatos(d => ({ ...d, [k]: e.target.value }))} />
                <datalist id={`hd-${k}`}>{(historial[k] ?? []).map(v => <option key={v} value={v} />)}</datalist>
              </div>
            ))}
            <p className="text-xs text-muted-foreground">Solo se cambian los campos que escribas; el cambio queda en el historial del manifiesto.</p>
            <Boton type="button" className="w-full" onClick={async () => { if (await accion('DATOS', datos, 'Datos actualizados')) setDatosOpen(false) }}>Guardar</Boton>
          </div>
        )}
      </BottomSheet>
      {cargandoDet && det && <div className="fixed bottom-24 right-6"><Loader2 className="w-5 h-5 animate-spin text-muted-foreground" /></div>}
    </div>
  )
}
