// M83 · Prefrío por turbina. Iniciar: elegir fruta aceptada (M82) → turbina → tarimas/cajas → temperatura de fruta.
// Finalizar: desde la tarjeta del grupo, temperatura de salida y lo que sale (total o parcial).
import { useEffect, useMemo, useState } from 'react'
import { X, Loader2, FileDown, Snowflake, TriangleAlert, Plus, Ban } from 'lucide-react'
import { toast } from 'sonner'
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
import {
  useM83Prefrio, cargarDisponiblesM83, declararEntradaM83, iniciarGrupoM83, finalizarPrefrioM83, cargarTarimasDispM83, declararTarimasM83, finalizarTarimasM83, cancelarPrefrioM83, mensajeErrorM83,
  isoDesdeHoraLocal, horaLocal, duracionHHMM, fmtTemp,
  type M83Disponible, type M83Grupo, type Unidad, type Lectura, type M83TarimaDisp,
} from '@/hooks/useM83Prefrio'
import { generarPrefrioTurbinasPDF } from '@/lib/pdf/m83/generarPrefrioTurbinasPDF'

const fieldCls = 'w-full h-10 rounded-[0.625rem] border border-border-control bg-input-background px-3 text-sm'
const numCls = 'w-full h-10 rounded-[0.625rem] border border-border-control bg-input-background px-2 text-sm text-right'
const POS: Lectura['posicion'][] = ['SUPERIOR', 'MEDIO', 'INFERIOR']
const POS_TXT: Record<Lectura['posicion'], string> = { SUPERIOR: 'Sup.', MEDIO: 'Medio', INFERIOR: 'Inf.' }
const K_UNIDAD = 'mady.m83.unidad'
const K_TURBINA = 'mady.m83.ultimaTurbinaConv'

const leer = (k: string) => { try { return localStorage.getItem(k) } catch { return null } }
const guardar = (k: string, v: string) => { try { localStorage.setItem(k, v) } catch { /* sin almacenamiento */ } }
const horaAhora = () => new Date().toLocaleTimeString('en-GB', { timeZone: 'America/Mexico_City', hour: '2-digit', minute: '2-digit', hour12: false })
const esNum = (s: string) => s.trim() !== '' && Number.isFinite(Number(s.replace(',', '.')))
const num = (s: string) => Number(s.replace(',', '.'))
function avisar(e: any) {
  const m = mensajeErrorM83(e)
  if (m.tipo === 'warning') toast.warning(m.texto, { duration: 7000 }); else toast.error(m.texto, { duration: 7000 })
}
function minutosDesde(iso: string) { return Math.max(0, Math.floor((Date.now() - new Date(iso).getTime()) / 60000)) }

function Chip({ activo, onClick, children, disabled }: { activo: boolean; onClick: () => void; children: React.ReactNode; disabled?: boolean }) {
  return (
    <button type="button" onClick={onClick} disabled={disabled}
      className={`h-9 min-w-[2.75rem] px-3 rounded-[0.625rem] border text-sm font-semibold disabled:opacity-40 ${activo ? 'bg-primary text-primary-foreground border-primary' : 'border-border-control'}`}>
      {children}
    </button>
  )
}

export function PrefrioTurbinas() {
  const { profile, codigoClave } = useAuthContext()
  const orgId = profile?.org_id ?? null
  const { terminosSitio } = useModulosContext()
  const { ranchos } = useRanchos()
  const [fecha, setFecha] = useState(hoyMX())
  const { activos, porEntrar, delDia, config, loading, error, refetch } = useM83Prefrio(fecha)
  const [filtroTurbina, setFiltroTurbina] = useState<number | null>(null)
  const [, setTick] = useState(0)
  useEffect(() => { const t = setInterval(() => setTick(x => x + 1), 60000); return () => clearInterval(t) }, [])
  const codigoFmt = codigoFormato('F-FRUS-PRO-04', codigoClave)
  const turbinas = useMemo(() => Array.from(new Set([...config.turbinas_conv, ...config.turbinas_org])).sort((a, b) => a - b), [config])

  // ── Iniciar
  const [sheet, setSheet] = useState<null | 'declarar' | 'iniciar' | 'finalizar'>(null)
  const [guardando, setGuardando] = useState(false)
  const [ranchoId, setRanchoId] = useState('')
  const [disp, setDisp] = useState<M83Disponible[]>([])
  const [cargandoDisp, setCargandoDisp] = useState(false)
  const [sel, setSel] = useState<Record<string, string>>({})  // linea_id -> cajas
  const [fuente, setFuente] = useState<'TARIMAS' | 'CAJAS'>('TARIMAS')
  const [tDisp, setTDisp] = useState<M83TarimaDisp[]>([])
  const [tSelIds, setTSelIds] = useState<string[]>([])
  const [turbina, setTurbina] = useState<number | null>(null)
  const [tarimas, setTarimas] = useState('')
  const [unidad, setUnidad] = useState<Unidad>((leer(K_UNIDAD) as Unidad) || 'C')
  const [modo, setModo] = useState<'GUIADO' | 'COMPACTO'>('GUIADO')
  const [lect, setLect] = useState<string[][]>([])           // [tarima][pos]
  const [promedio, setPromedio] = useState('')

  useEffect(() => { if (ranchos.length === 1) setRanchoId(ranchos[0].id) }, [ranchos])

  async function cargarDisp(r: string) {
    if (!r) { setDisp([]); return }
    setCargandoDisp(true)
    try { const [d, t] = await Promise.all([cargarDisponiblesM83(r), cargarTarimasDispM83(r)]); setDisp(d); setTDisp(t); setFuente(t.length > 0 || d.length === 0 ? 'TARIMAS' : 'CAJAS') } catch (e) { avisar(e) } finally { setCargandoDisp(false) }
  }

  function abrirIniciar() {
    setSel({}); setTSelIds([]); setTurbina(null); setTarimas(''); setModo('GUIADO'); setLect([]); setPromedio('')
    const r = ranchos.length === 1 ? ranchos[0].id : ranchoId
    setRanchoId(r); cargarDisp(r)
    setSheet('declarar')
  }

  const elegidas = disp.filter(d => sel[d.linea_id] !== undefined)
  const ref = elegidas[0]
  // Un grupo puede combinar presentaciones (ítems) de la misma empresa y la misma clasificación ORG/CONV
  const compatible = (d: M83Disponible) => !ref || (d.empresa === ref.empresa && d.clasificacion === ref.clasificacion)
  const codigosElegidos = Array.from(new Set(elegidas.map(d => d.codigo)))
  const tSel = tSelIds.map(id => tDisp.find(t => t.id === id)).filter(Boolean) as M83TarimaDisp[]
  const refX = fuente === 'TARIMAS'
    ? (tSel[0] ? { key: tSel[0].id, clasificacion: tSel[0].clasificacion, empresa: tSel[0].empresa, codigo: tSel[0].codigo } : null)
    : (ref ? { key: ref.linea_id, clasificacion: ref.clasificacion, empresa: ref.empresa, codigo: ref.codigo } : null)
  const compatibleT = (t: M83TarimaDisp) => !refX || fuente !== 'TARIMAS' || (t.empresa === refX.empresa && t.clasificacion === refX.clasificacion)
  const etiquetaLect = (i: number) => fuente === 'TARIMAS' ? (tSel[i] ? `N.${tSel[i].numero}` : `T${i + 1}`) : `T${i + 1}`
  const turbinasValidas = refX ? (refX.clasificacion === 'ORG' ? config.turbinas_org : config.turbinas_conv) : []
  const nTarimas = fuente === 'TARIMAS' ? tSel.length : (/^\d+$/.test(tarimas) ? Number(tarimas) : 0)
  const muestraMin = nTarimas > 0 ? Math.ceil(nTarimas * 0.4) : 0
  const totalCajas = elegidas.reduce((a, d) => a + (Number(sel[d.linea_id]) || 0), 0)

  // al elegir la primera fruta, turbina sugerida
  useEffect(() => {
    if (!refX) { setTurbina(null); return }
    if (turbina && turbinasValidas.includes(turbina)) return
    if (refX.clasificacion === 'ORG') setTurbina(config.turbinas_org[0] ?? null)
    else { const u = Number(leer(K_TURBINA)); setTurbina(config.turbinas_conv.includes(u) ? u : null) }
  }, [refX?.key, refX?.clasificacion]) // eslint-disable-line react-hooks/exhaustive-deps

  // filas de lectura guiada = muestra mínima (se pueden agregar más)
  useEffect(() => {
    setLect(prev => {
      const n = Math.max(muestraMin, prev.length > muestraMin ? prev.length : 0)
      return Array.from({ length: n }, (_, i) => prev[i] ?? ['', '', ''])
    })
  }, [muestraMin])

  const lecturasLlenas = lect.length > 0 && lect.every(f => f.every(esNum))
  const promGuiado = lecturasLlenas ? lect.flat().reduce((a, v) => a + num(v), 0) / (lect.length * 3) : null

  function toggleLinea(d: M83Disponible) {
    setSel(s => {
      const n = { ...s }
      if (n[d.linea_id] !== undefined) delete n[d.linea_id]; else n[d.linea_id] = String(d.saldo)
      return n
    })
  }

  async function declarar() {
    if (!ranchoId) { toast.error(`Selecciona ${terminosSitio.genero === 'f' ? 'una' : 'un'} ${terminosSitio.singular}`); return }
    if (fuente === 'TARIMAS') {
      if (tSel.length === 0) { toast.error('Elige las tarimas que entran'); return }
      if (!turbina) { toast.error('Elige la turbina'); return }
      if (modo === 'GUIADO' && !lecturasLlenas) { toast.error('Completa las lecturas superior, medio e inferior'); return }
      if (modo === 'COMPACTO' && !esNum(promedio)) { toast.error('Captura el promedio medido de la fruta'); return }
      setGuardando(true)
      try {
        await declararTarimasM83({ rancho: ranchoId, turbina, tarimas: tSel.map(t => t.id), unidad,
          lecturas: modo === 'GUIADO' ? lect.flatMap((f, i) => f.map((v, j) => ({ tarima: etiquetaLect(i), posicion: POS[j], valor: num(v) }))) : null,
          temp: modo === 'COMPACTO' ? num(promedio) : null })
        guardar(K_UNIDAD, unidad)
        if (refX?.clasificacion === 'CONV') guardar(K_TURBINA, String(turbina))
        toast.success(`Entrada declarada: ${tSel.length} tarima(s) en turbina ${turbina}. Inicia el prefrío cuando entren`)
        setSheet(null); await refetch()
      } catch (e) { avisar(e) } finally { setGuardando(false) }
      return
    }
    if (!ref) { toast.error('Selecciona la fruta que entra a prefrío'); return }
    for (const d of elegidas) {
      const c = sel[d.linea_id]
      if (!/^\d+$/.test(c) || Number(c) <= 0 || Number(c) > d.saldo) { toast.error(`Cajas inválidas para ${d.codigo} (${d.hora}); disponibles ${d.saldo}`); return }
    }
    if (!turbina) { toast.error('Elige la turbina'); return }
    if (nTarimas <= 0) { toast.error('Indica el número de tarimas que entran'); return }
    if (modo === 'GUIADO' && !lecturasLlenas) { toast.error('Completa las lecturas superior, medio e inferior'); return }
    if (modo === 'COMPACTO' && !esNum(promedio)) { toast.error('Captura el promedio medido de la fruta'); return }
    const lecturas: Lectura[] | null = modo === 'GUIADO'
      ? lect.flatMap((f, i) => f.map((v, j) => ({ tarima: `T${i + 1}`, posicion: POS[j], valor: num(v) })))
      : null
    setGuardando(true)
    try {
      await declararEntradaM83({
        rancho: ranchoId, turbina, tarimas: nTarimas, unidad,
        origen: elegidas.map(d => ({ linea_id: d.linea_id, cajas: Number(sel[d.linea_id]) })),
        lecturas, temp: modo === 'COMPACTO' ? num(promedio) : null,
      })
      guardar(K_UNIDAD, unidad)
      if (ref.clasificacion === 'CONV') guardar(K_TURBINA, String(turbina))
      toast.success(`Entrada declarada en turbina ${turbina}. Inicia el prefrío cuando entre`)
      setSheet(null)
      await refetch()
    } catch (e) { avisar(e) } finally { setGuardando(false) }
  }

  // ── Iniciar prefrío (solo hora de entrada)
  const [porIniciar, setPorIniciar] = useState<M83Grupo | null>(null)
  const [horaEnt, setHoraEnt] = useState(horaAhora())
  const [cambiarHora, setCambiarHora] = useState(false)
  function abrirIniciar2(g: M83Grupo) { setPorIniciar(g); setHoraEnt(horaAhora()); setCambiarHora(false); setSheet('iniciar') }
  async function iniciar() {
    if (!porIniciar) return
    if (cambiarHora && !/^\d{2}:\d{2}$/.test(horaEnt)) { toast.error('Indica la hora de entrada'); return }
    setGuardando(true)
    try {
      await iniciarGrupoM83(porIniciar.id, cambiarHora ? isoDesdeHoraLocal(hoyMX(), horaEnt) : null)
      toast.success(`Prefrío iniciado en turbina ${porIniciar.turbina}`)
      setSheet(null)
      if (fecha !== hoyMX()) setFecha(hoyMX()); else await refetch()
    } catch (e) { avisar(e) } finally { setGuardando(false) }
  }

  // ── Finalizar
  const [grupo, setGrupo] = useState<M83Grupo | null>(null)
  const [sTar, setSTar] = useState('')
  const [sCaj, setSCaj] = useState('')
  const [sTarIds, setSTarIds] = useState<string[]>([])
  const [sTemp, setSTemp] = useState('')
  const [sUnidad, setSUnidad] = useState<Unidad>('C')
  const [horaSal, setHoraSal] = useState(horaAhora())
  const [cambiarHoraSal, setCambiarHoraSal] = useState(false)

  function abrirFinalizar(g: M83Grupo) {
    setGrupo(g); setSTar(String(g.quedan_tarimas)); setSCaj(String(g.quedan_cajas)); setSTemp('')
    setSTarIds(g.tarimas_det.filter(t => !t.salio).map(t => t.tarima_id))
    setSUnidad(g.temp_entrada_unidad); setHoraSal(horaAhora()); setCambiarHoraSal(false)
    setSheet('finalizar')
  }

  async function finalizar() {
    if (!grupo) return
    const porTarimas = grupo.tarimas_det.length > 0
    if (porTarimas) {
      if (sTarIds.length === 0) { toast.error('Elige las tarimas que salen'); return }
      if (!esNum(sTemp)) { toast.error('Captura la temperatura de salida de la fruta'); return }
      setGuardando(true)
      try {
        const r = await finalizarTarimasM83({ grupo: grupo.id, tarimas: sTarIds, temp: num(sTemp), unidad: sUnidad,
          salidaEn: cambiarHoraSal ? isoDesdeHoraLocal(hoyMX(), horaSal) : null })
        toast.success(r.finalizado
          ? `Prefrío finalizado · ${duracionHHMM(r.duracion_min)} h · tarimas pasan a conservador`
          : `Salida parcial · quedan ${r.quedan_tarimas} tarima(s) en prefrío`)
        setSheet(null); await refetch()
      } catch (e) { avisar(e) } finally { setGuardando(false) }
      return
    }
    if (!/^\d+$/.test(sTar) || !/^\d+$/.test(sCaj) || Number(sTar) <= 0 || Number(sCaj) <= 0) { toast.error('Indica tarimas y cajas que salen'); return }
    if (!esNum(sTemp)) { toast.error('Captura la temperatura de salida de la fruta'); return }
    setGuardando(true)
    try {
      const r = await finalizarPrefrioM83({
        grupo: grupo.id, tarimas: Number(sTar), cajas: Number(sCaj), temp: num(sTemp), unidad: sUnidad,
        salidaEn: cambiarHoraSal ? isoDesdeHoraLocal(hoyMX(), horaSal) : null,
      })
      toast.success(r.finalizado
        ? `Prefrío finalizado · ${duracionHHMM(r.duracion_min)} h`
        : `Salida parcial · quedan ${r.quedan_tarimas} tarima(s) y ${r.quedan_cajas} cajas`)
      setSheet(null)
      await refetch()
    } catch (e) { avisar(e) } finally { setGuardando(false) }
  }

  async function cancelar(g: M83Grupo) {
    const motivo = window.prompt(`Cancelar el grupo ${g.combinada ? 'combinado' : '#' + g.codigo} de turbina ${g.turbina}. Motivo:`)
    if (motivo === null) return
    try { await cancelarPrefrioM83(g.id, motivo); toast.success('Grupo cancelado; sus cajas vuelven a estar disponibles'); await refetch() } catch (e) { avisar(e) }
  }

  // ── PDF
  const [pdfCargando, setPdfCargando] = useState(false)
  async function pdfDia() {
    if (!orgId) return
    setPdfCargando(true)
    try {
      const n = await generarPrefrioTurbinasPDF(orgId, fecha, codigoClave)
      if (n === 0) toast.info('No hay entradas a prefrío en esta fecha')
    } catch (e: any) { toast.error(e?.message ?? 'Error al generar PDF') } finally { setPdfCargando(false) }
  }

  const activosVista = activos.filter(g => filtroTurbina === null || g.turbina === filtroTurbina)
  const salidasDia = delDia.flatMap(g => g.salidas.map(s => ({ g, s })))

  const BotonPdf = (
    <button onClick={pdfDia} disabled={pdfCargando}
      className="h-10 px-3 rounded-[0.625rem] border border-border flex items-center gap-2 text-sm disabled:opacity-50">
      {pdfCargando ? <Loader2 className="w-4 h-4 animate-spin" /> : <FileDown className="w-4 h-4" style={{ color: 'var(--primary)' }} />}
      PDF del día
    </button>
  )

  return (
    <div className="flex flex-col min-h-full bg-background pb-safe-nav">
      <ModuloHeader tituloFallback="Entradas y Salidas de Prefrío por Turbina" subtitulo={`${codigoFmt} · ${config.camara_nombre}`} />

      <div className="p-4 space-y-4">
        {error && (
          <div className="flex items-start gap-2 rounded-xl p-3" style={{ backgroundColor: 'var(--agro-danger-fill)', border: '1px solid var(--agro-red)' }}>
            <TriangleAlert className="w-4 h-4 flex-shrink-0 mt-0.5" style={{ color: 'var(--agro-danger-text)' }} />
            <p className="text-xs" style={{ color: 'var(--agro-danger-text)' }}>Error al cargar el prefrío.</p>
          </div>
        )}

        {/* Por entrar (declarados) */}
        {porEntrar.length > 0 && (
          <section className="space-y-2">
            <TituloSeccion>Por entrar a prefrío</TituloSeccion>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-2">
              {porEntrar.map(g => (
                <div key={g.id} className="rounded-[0.625rem] border border-border bg-card p-3 space-y-2">
                  <div className="flex items-start justify-between gap-2">
                    <div className="min-w-0">
                      <p className="text-sm font-semibold truncate">{g.combinada ? 'Combinada' : `#${g.codigo}`} · {g.fruta ?? ''} {g.presentacion}</p>
                      <p className="text-xs text-muted-foreground truncate">{g.empresa} · {g.clasificacion} · {g.tarimas} tar. · {g.cajas} cajas · {fmtTemp(g.temp_entrada_valor, g.temp_entrada_unidad)}</p>
                    </div>
                    <span className="text-xs px-2 py-0.5 rounded-full font-semibold flex-shrink-0"
                      style={{ backgroundColor: 'var(--muted)', color: 'var(--foreground)' }}>Turbina {g.turbina}</span>
                  </div>
                  <div className="flex gap-2">
                    <Boton type="button" tamano="sm" className="flex-1" onClick={() => abrirIniciar2(g)}>Iniciar prefrío</Boton>
                    <button type="button" aria-label="Cancelar declaración" onClick={() => cancelar(g)} className="p-2 rounded-lg border border-border">
                      <Ban className="w-4 h-4 text-muted-foreground" />
                    </button>
                  </div>
                </div>
              ))}
            </div>
          </section>
        )}

        {/* En prefrío ahora */}
        <section className="space-y-2">
          <div className="flex items-center justify-between gap-2 flex-wrap">
            <TituloSeccion>En prefrío ahora</TituloSeccion>
            <div className="flex gap-1 flex-wrap">
              <Chip activo={filtroTurbina === null} onClick={() => setFiltroTurbina(null)}>Todas</Chip>
              {turbinas.map(t => (
                <Chip key={t} activo={filtroTurbina === t} onClick={() => setFiltroTurbina(t)}>
                  T{t}{config.turbinas_org.includes(t) ? ' ORG' : ''}
                </Chip>
              ))}
            </div>
          </div>
          {loading ? <ListaSkeleton rows={2} /> : activosVista.length === 0 ? (
            <EstadoVacio icono={Snowflake} titulo="Nada en prefrío" ayuda="Declara la entrada con el botón + y luego inicia el prefrío" />
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-2 gap-2">
              {activosVista.map(g => {
                const min = minutosDesde(g.entrada_en ?? '')
                return (
                  <div key={g.id} className="rounded-[0.625rem] border border-border bg-card p-3 space-y-2">
                    <div className="flex items-start justify-between gap-2">
                      <div className="min-w-0">
                        <p className="text-sm font-semibold truncate">{g.combinada ? 'Combinada' : `#${g.codigo}`} · {g.fruta ?? ''} {g.presentacion}</p>
                        <p className="text-xs text-muted-foreground truncate">{g.empresa}</p>
                      </div>
                      <span className="text-xs px-2 py-0.5 rounded-full font-semibold flex-shrink-0"
                        style={{ backgroundColor: 'var(--agro-info-fill)', color: 'var(--agro-info-text)' }}>Turbina {g.turbina}</span>
                    </div>
                    <div className="flex flex-wrap gap-x-3 gap-y-1 text-xs">
                      <span><b>{g.clasificacion}</b></span>
                      <span>{g.quedan_tarimas} tar. · {g.quedan_cajas} cajas{g.quedan_cajas !== g.cajas ? ` (de ${g.cajas})` : ''}</span>
                      <span>Entrada {horaLocal(g.entrada_en ?? '')} · {fmtTemp(g.temp_entrada_valor, g.temp_entrada_unidad)}</span>
                      <span className="text-muted-foreground">{duracionHHMM(min)} h en prefrío</span>
                    </div>
                    {g.tarimas_det.length > 0 && <p className="text-xs text-muted-foreground">Tarimas: {g.tarimas_det.filter(t => !t.salio).map(t => 'N.' + t.numero).join(', ')}</p>}
                    <div className="flex gap-2">
                      <Boton type="button" tamano="sm" className="flex-1" onClick={() => abrirFinalizar(g)}>Finalizar prefrío</Boton>
                      {g.salidas.length === 0 && (
                        <button type="button" aria-label="Cancelar grupo" onClick={() => cancelar(g)} className="p-2 rounded-lg border border-border">
                          <Ban className="w-4 h-4 text-muted-foreground" />
                        </button>
                      )}
                    </div>
                  </div>
                )
              })}
            </div>
          )}
        </section>

        {/* Bitácora del día */}
        <section className="space-y-2">
          <TituloSeccion>Salidas del día</TituloSeccion>
          <div className="flex gap-2 items-end">
            <div className="flex-1 space-y-1">
              <label className="text-xs text-muted-foreground font-semibold">Fecha de entrada</label>
              <input type="date" className={fieldCls} value={fecha} max={hoyMX()} onChange={e => e.target.value && setFecha(e.target.value)} />
            </div>
            {BotonPdf}
          </div>
          {salidasDia.length === 0 ? (
            <p className="text-xs text-muted-foreground">Sin salidas registradas para grupos que entraron en esta fecha.</p>
          ) : (
            <ul className="space-y-1">
              {salidasDia.map(({ g, s }) => (
                <li key={s.id} className="text-xs rounded-[0.625rem] border border-border bg-card px-3 py-2 flex flex-wrap gap-x-3">
                  <b>{g.combinada ? g.presentacion : `#${g.codigo}`}</b><span>{g.clasificacion}</span><span>T{g.turbina}</span>
                  <span>{s.tarimas} tar. · {s.cajas} cajas</span>
                  <span>{horaLocal(g.entrada_en ?? '')} {fmtTemp(g.temp_entrada_valor, g.temp_entrada_unidad)} → {horaLocal(s.salida_en)} {fmtTemp(s.temp_salida_valor, s.temp_salida_unidad)}</span>
                  <span className="text-muted-foreground">{duracionHHMM(s.duracion_min)} h</span>
                </li>
              ))}
            </ul>
          )}
        </section>
      </div>

      <Fab onClick={abrirIniciar} aria-label="Declarar entrada a prefrío" />

      {/* ═══ Declarar entrada (captura intermedia) ═══ */}
      <BottomSheet open={sheet === 'declarar'} onClose={() => { if (!guardando) setSheet(null) }} height="85%">
        <div className="flex items-center justify-between px-4 pt-4 pb-3 border-b border-border">
          <h2 className="text-base text-foreground font-semibold">Declarar entrada a prefrío</h2>
          <button aria-label="Cerrar" type="button" onClick={() => { if (!guardando) setSheet(null) }}><X className="w-5 h-5 text-muted-foreground" /></button>
        </div>
        <div className="overflow-y-auto px-4 pb-6 pt-3 space-y-5" style={{ flex: 1 }}>
          {ranchos.length !== 1 && (
            <div className="space-y-1">
              <label className="text-xs text-muted-foreground font-semibold">{terminosSitio.singular} *</label>
              <select className={fieldCls} value={ranchoId} onChange={e => { setRanchoId(e.target.value); setSel({}); cargarDisp(e.target.value) }}>
                <option value="">Selecciona...</option>
                {ranchos.map(r => <option key={r.id} value={r.id}>{r.nombre}</option>)}
              </select>
            </div>
          )}

          <div className="flex gap-2">
            <Chip activo={fuente === 'TARIMAS'} onClick={() => { setFuente('TARIMAS'); setSel({}) }}>Por tarimas</Chip>
            <Chip activo={fuente === 'CAJAS'} onClick={() => { setFuente('CAJAS'); setTSelIds([]) }}>Por cajas (sin tarima registrada)</Chip>
          </div>
          {fuente === 'TARIMAS' ? (
          <section className="space-y-2">
            <TituloSeccion>1 · Tarimas disponibles</TituloSeccion>
            {cargandoDisp ? <Loader2 className="w-5 h-5 animate-spin text-muted-foreground" /> : tDisp.length === 0 ? (
              <p className="text-xs text-muted-foreground">No hay tarimas armadas. Ármalas en Tarimas y Consolidación.</p>
            ) : (
              <ul className="space-y-1">
                {tDisp.map(t => {
                  const on = tSelIds.includes(t.id)
                  const ok = on || compatibleT(t)
                  return (
                    <li key={t.id}>
                      <label className={`flex items-center gap-2 rounded-[0.625rem] border p-2 ${on ? 'border-primary' : 'border-border'} ${ok ? '' : 'opacity-40'}`}>
                        <input type="checkbox" checked={on} disabled={!ok} onChange={() => setTSelIds(s => on ? s.filter(x => x !== t.id) : [...s, t.id])} />
                        <span className="text-sm"><b>N.{t.numero}</b> · #{t.codigo} {t.presentacion} · {t.clasificacion} · {t.cajas} cajas</span>
                        <span className="text-xs text-muted-foreground ml-auto">{t.estado === 'EN_CONSERVADOR' ? 'En conservador' : 'Armada'}</span>
                      </label>
                    </li>
                  )
                })}
              </ul>
            )}
            {tSel.length > 0 && <p className="text-xs">Grupo: <b>{tSel.length}</b> tarima(s) · {tSel.reduce((a, t) => a + t.cajas, 0)} cajas · {refX?.clasificacion}</p>}
          </section>
          ) : (
          <section className="space-y-2">
            <TituloSeccion>1 · Fruta aceptada disponible (cajas sin tarima)</TituloSeccion>
            {cargandoDisp ? <Loader2 className="w-5 h-5 animate-spin text-muted-foreground" /> : disp.length === 0 ? (
              <p className="text-xs text-muted-foreground">No hay fruta aceptada con cajas disponibles (últimos 3 días). Acepta la entrega en Recepción por ítem.</p>
            ) : (
              <ul className="space-y-1">
                {disp.map(d => {
                  const on = sel[d.linea_id] !== undefined
                  const ok = on || compatible(d)
                  return (
                    <li key={d.linea_id} className={`rounded-[0.625rem] border p-2 ${on ? 'border-primary' : 'border-border'} ${ok ? '' : 'opacity-40'}`}>
                      <div className="flex items-center gap-2">
                        <input type="checkbox" checked={on} disabled={!ok} onChange={() => toggleLinea(d)} aria-label={`Seleccionar ${d.codigo} de las ${d.hora}`} />
                        <button type="button" disabled={!ok} onClick={() => toggleLinea(d)} className="flex-1 min-w-0 text-left">
                          <p className="text-sm font-semibold truncate">#{d.codigo} · {d.fruta ?? ''} {d.presentacion ?? ''} · {d.clasificacion}</p>
                          <p className="text-xs text-muted-foreground truncate">{d.empresa} · Prod. {d.codigo_productor} · {d.hora} · disponibles {d.saldo}</p>
                        </button>
                        {on && (
                          <input inputMode="numeric" aria-label={`Cajas de ${d.codigo}`} className="w-20 h-9 rounded-[0.625rem] border border-border-control bg-input-background px-2 text-sm text-right"
                            value={sel[d.linea_id]} onChange={e => { const v = e.target.value.replace(/\D/g, ''); setSel(s => ({ ...s, [d.linea_id]: v })) }} />
                        )}
                      </div>
                    </li>
                  )
                })}
              </ul>
            )}
            {ref && <p className="text-xs">Grupo: <b>{totalCajas}</b> cajas · {codigosElegidos.length > 1 ? `Combinada (${codigosElegidos.map(c => '#' + c).join(', ')})` : `#${ref.codigo}`} · {ref.clasificacion}</p>}
          </section>
          )}

          {refX && (<>
            <section className="space-y-2">
              <TituloSeccion>2 · Turbina y tarimas</TituloSeccion>
              <div className="flex gap-2 flex-wrap">
                {turbinas.map(t => (
                  <Chip key={t} activo={turbina === t} disabled={!turbinasValidas.includes(t)} onClick={() => setTurbina(t)}>Turbina {t}</Chip>
                ))}
              </div>
              <p className="text-xs text-muted-foreground">{refX.clasificacion === 'ORG' ? 'Orgánico: solo turbina ' + config.turbinas_org.join(', ') : 'Convencional: turbinas ' + config.turbinas_conv.join(', ')}</p>
              {fuente === 'CAJAS' && <div className="flex gap-3 items-end">
                <div className="flex-1 space-y-1">
                  <label className="text-xs text-muted-foreground font-semibold">N° de tarimas que entran *</label>
                  <input inputMode="numeric" className={numCls} value={tarimas} onChange={e => setTarimas(e.target.value.replace(/\D/g, ''))} />
                </div>
              </div>}
            </section>

            <section className="space-y-2">
              <TituloSeccion>3 · Temperatura de fruta (vástago)</TituloSeccion>
              <div className="flex gap-2 flex-wrap">
                <Chip activo={modo === 'GUIADO'} onClick={() => setModo('GUIADO')}>Lecturas por tarima</Chip>
                <Chip activo={modo === 'COMPACTO'} onClick={() => setModo('COMPACTO')}>Promedio ya medido</Chip>
                <span className="flex-1" />
                <Chip activo={unidad === 'F'} onClick={() => setUnidad('F')}>°F</Chip>
                <Chip activo={unidad === 'C'} onClick={() => setUnidad('C')}>°C</Chip>
              </div>
              {modo === 'GUIADO' ? (
                nTarimas <= 0 ? <p className="text-xs text-muted-foreground">Indica las tarimas para calcular la muestra (40 %).</p> : (
                  <div className="space-y-2">
                    <p className="text-xs text-muted-foreground">Muestra mínima: <b>{muestraMin}</b> de {nTarimas} tarima(s), superior, medio e inferior.</p>
                    {lect.map((f, i) => (
                      <div key={i} className="flex items-center gap-2">
                        <span className="text-xs font-semibold w-10">{etiquetaLect(i)}</span>
                        {f.map((v, j) => (
                          <input key={j} inputMode="decimal" placeholder={POS_TXT[POS[j]]} aria-label={`Tarima ${i + 1} ${POS_TXT[POS[j]]}`} className={numCls}
                            value={v} onChange={e => { const val = e.target.value.replace(/[^0-9.,-]/g, ''); setLect(L => L.map((r, a) => a === i ? r.map((x, b) => b === j ? val : x) : r)) }} />
                        ))}
                        {i >= muestraMin && (
                          <button type="button" aria-label="Quitar tarima" onClick={() => setLect(L => L.filter((_, a) => a !== i))}><X className="w-4 h-4 text-muted-foreground" /></button>
                        )}
                      </div>
                    ))}
                    {lect.length < nTarimas && (
                      <button type="button" className="text-xs flex items-center gap-1" style={{ color: 'var(--primary)' }} onClick={() => setLect(L => [...L, ['', '', '']])}>
                        <Plus className="w-3 h-3" /> Muestrear otra tarima
                      </button>
                    )}
                    <p className="text-sm">Promedio de entrada: <b>{promGuiado !== null ? fmtTemp(promGuiado, unidad) : '—'}</b></p>
                  </div>
                )
              ) : (
                <div className="space-y-1">
                  <label className="text-xs text-muted-foreground font-semibold">Promedio medido de la fruta (°{unidad}) *</label>
                  <input inputMode="decimal" className={numCls} value={promedio} onChange={e => setPromedio(e.target.value.replace(/[^0-9.,-]/g, ''))} />
                  <p className="text-xs text-muted-foreground">Usa este modo solo si el muestreo del 40 % quedó en la hoja de respaldo.</p>
                </div>
              )}
            </section>
          </>)}

          <Boton type="button" onClick={declarar} cargando={guardando} className="w-full" disabled={!refX}>Guardar declaración</Boton>
        </div>
      </BottomSheet>

      {/* ═══ Iniciar prefrío (solo hora) ═══ */}
      <BottomSheet open={sheet === 'iniciar'} onClose={() => { if (!guardando) setSheet(null) }} height="85%">
        <div className="flex items-center justify-between px-4 pt-4 pb-3 border-b border-border">
          <h2 className="text-base text-foreground font-semibold">Iniciar prefrío</h2>
          <button aria-label="Cerrar" type="button" onClick={() => { if (!guardando) setSheet(null) }}><X className="w-5 h-5 text-muted-foreground" /></button>
        </div>
        {porIniciar && (
          <div className="overflow-y-auto px-4 pb-6 pt-3 space-y-5" style={{ flex: 1 }}>
            <div className="text-sm space-y-0.5">
              <p className="font-semibold">{porIniciar.combinada ? 'Combinada' : `#${porIniciar.codigo}`} · {porIniciar.fruta ?? ''} {porIniciar.presentacion}</p>
              <p className="text-xs text-muted-foreground">Turbina {porIniciar.turbina} · {porIniciar.tarimas} tar. · {porIniciar.cajas} cajas · entrada {fmtTemp(porIniciar.temp_entrada_valor, porIniciar.temp_entrada_unidad)}</p>
            </div>
            <div className="space-y-1">
              <label className="text-xs text-muted-foreground font-semibold">Hora de entrada</label>
              {cambiarHora
                ? <HoraInput24 value={horaEnt} onChange={setHoraEnt} ariaLabel="Hora de entrada" />
                : <button type="button" className={`${fieldCls} text-left text-muted-foreground`} onClick={() => setCambiarHora(true)}>Ahora · cambiar</button>}
            </div>
            <p className="text-xs text-muted-foreground">La salida queda pendiente hasta que la registres en la tarjeta del grupo.</p>
            <Boton type="button" onClick={iniciar} cargando={guardando} className="w-full">Iniciar prefrío</Boton>
          </div>
        )}
      </BottomSheet>

      {/* ═══ Finalizar prefrío ═══ */}
      <BottomSheet open={sheet === 'finalizar'} onClose={() => { if (!guardando) setSheet(null) }} height="85%">
        <div className="flex items-center justify-between px-4 pt-4 pb-3 border-b border-border">
          <h2 className="text-base text-foreground font-semibold">Finalizar prefrío</h2>
          <button aria-label="Cerrar" type="button" onClick={() => { if (!guardando) setSheet(null) }}><X className="w-5 h-5 text-muted-foreground" /></button>
        </div>
        {grupo && (
          <div className="overflow-y-auto px-4 pb-6 pt-3 space-y-5" style={{ flex: 1 }}>
            <div className="text-sm space-y-0.5">
              <p className="font-semibold">#{grupo.codigo} · {grupo.fruta ?? ''} {grupo.presentacion} · {grupo.clasificacion}</p>
              <p className="text-xs text-muted-foreground">Turbina {grupo.turbina} · entrada {horaLocal(grupo.entrada_en ?? '')} · {fmtTemp(grupo.temp_entrada_valor, grupo.temp_entrada_unidad)} · en prefrío {grupo.quedan_tarimas} tar. / {grupo.quedan_cajas} cajas</p>
            </div>
            <section className="space-y-2">
              <TituloSeccion>Lo que sale</TituloSeccion>
              {grupo.tarimas_det.length > 0 ? (<>
                <ul className="space-y-1">
                  {grupo.tarimas_det.filter(t => !t.salio).map(t => {
                    const on = sTarIds.includes(t.tarima_id)
                    return (
                      <li key={t.tarima_id}>
                        <label className={`flex items-center gap-2 rounded-[0.625rem] border p-2 ${on ? 'border-primary' : 'border-border'}`}>
                          <input type="checkbox" checked={on} onChange={() => setSTarIds(x => on ? x.filter(y => y !== t.tarima_id) : [...x, t.tarima_id])} />
                          <span className="text-sm">Tarima <b>N.{t.numero}</b></span>
                        </label>
                      </li>
                    )
                  })}
                </ul>
                {sTarIds.length < grupo.tarimas_det.filter(t => !t.salio).length && <p className="text-xs" style={{ color: 'var(--agro-info-text)' }}>Salida parcial: el resto sigue en prefrío con su hora de entrada.</p>}
                <p className="text-xs text-muted-foreground">Al salir, las tarimas pasan a conservador.</p>
              </>) : (<>
              <div className="flex gap-3">
                <div className="flex-1 space-y-1">
                  <label className="text-xs text-muted-foreground font-semibold">Tarimas</label>
                  <input inputMode="numeric" className={numCls} value={sTar} onChange={e => setSTar(e.target.value.replace(/\D/g, ''))} />
                </div>
                <div className="flex-1 space-y-1">
                  <label className="text-xs text-muted-foreground font-semibold">Cajas</label>
                  <input inputMode="numeric" className={numCls} value={sCaj} onChange={e => setSCaj(e.target.value.replace(/\D/g, ''))} />
                </div>
              </div>
              {(Number(sTar) < grupo.quedan_tarimas) && <p className="text-xs" style={{ color: 'var(--agro-info-text)' }}>Salida parcial: el resto sigue en prefrío con su hora de entrada.</p>}
              </>)}
            </section>
            <section className="space-y-2">
              <TituloSeccion>Temperatura de salida de la fruta</TituloSeccion>
              <div className="flex gap-2 items-center">
                <input inputMode="decimal" className={numCls} value={sTemp} placeholder={`°${sUnidad}`} onChange={e => setSTemp(e.target.value.replace(/[^0-9.,-]/g, ''))} />
                <Chip activo={sUnidad === 'F'} onClick={() => setSUnidad('F')}>°F</Chip>
                <Chip activo={sUnidad === 'C'} onClick={() => setSUnidad('C')}>°C</Chip>
              </div>
              <div className="space-y-1">
                <label className="text-xs text-muted-foreground font-semibold">Hora de salida</label>
                {cambiarHoraSal
                  ? <HoraInput24 value={horaSal} onChange={setHoraSal} ariaLabel="Hora de salida" />
                  : <button type="button" className={`${fieldCls} text-left text-muted-foreground`} onClick={() => setCambiarHoraSal(true)}>Ahora · cambiar</button>}
              </div>
            </section>
            <Boton type="button" onClick={finalizar} cargando={guardando} className="w-full">Finalizar prefrío</Boton>
          </div>
        )}
      </BottomSheet>
    </div>
  )
}
