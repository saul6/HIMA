// M87 · Tarimas y consolidación. De la recepción aceptada se arman tarimas con identidad permanente y número del ciclo activo.
// Sugerencia: Q div K completas y remanente Q mod K (falta K − r). Confirmar = armado físico real (una sola operación en servidor).
// Consolidación solo del mismo productor, ítem y clasificación. Sin capacidad (#453): solo tarima parcial autorizada con motivo.
import { useEffect, useMemo, useRef, useState } from 'react'
import { Boxes, Loader2, TriangleAlert } from 'lucide-react'
import { toast } from 'sonner'
import { ModuloHeader } from '@/app/components/ModuloHeader'
import { Boton } from '@/app/components/ui-mady/Boton'
import { TituloSeccion } from '@/app/components/ui-mady/TituloSeccion'
import { EstadoVacio } from '@/app/components/ui-mady/EstadoVacio'
import { ListaSkeleton } from '@/app/components/ListaSkeleton'
import { useAuthContext } from '@/context/AuthContext'
import { useRanchos } from '@/hooks/useRanchos'
import { fechaCorta } from '@/lib/formato'
import { hoyMX } from '@/lib/fecha'
import {
  useM87Tarimas, agrupar, repartirCompletas, armarTarimas, anularTarima, editarNumeroTarima, corregirRecepcion, mensajeErrorM87,
  ingresarConservador, cerrarCiclo, cargarCuadre,
  type M87Grupo, type M87Tarima, type M87CuadreFila,
} from '@/hooks/useM87Tarimas'

const nuevaClave = () => (crypto?.randomUUID ? crypto.randomUUID() : `${Date.now().toString(16).padStart(8, '0').slice(-8)}-0000-4000-8000-${Math.random().toString(16).slice(2, 14).padEnd(12, '0')}`)
function avisar(e: any) {
  const m = mensajeErrorM87(e)
  if (m.tipo === 'warning') toast.warning(m.texto, { duration: 8000 }); else toast.error(m.texto, { duration: 8000 })
}
const ESTADO_TXT: Record<string, string> = { ARMADA: 'Armada', EN_PREFRIO: 'En prefrío', EN_CONSERVADOR: 'En conservador', RESERVADA: 'Reservada', CARGADA: 'Cargada', DISPUESTA: 'Dispuesta', ANULADA: 'Anulada' }

function GrupoCard({ g, ranchoId, puedeCorregir, onListo }: { g: M87Grupo; ranchoId: string; puedeCorregir: boolean; onListo: () => Promise<void> }) {
  const K = g.capacidad
  const completas = K ? Math.floor(g.disponibles / K) : 0
  const resto = K ? g.disponibles % K : g.disponibles
  const [n, setN] = useState(String(completas))
  const [llegoArmada, setLlegoArmada] = useState(false)
  const [parcial, setParcial] = useState(false)
  const [cajasParcial, setCajasParcial] = useState('')
  const [motivo, setMotivo] = useState('')
  const [g2, setG2] = useState(false)
  const claveRef = useRef(nuevaClave())
  useEffect(() => { setN(String(completas)) }, [completas])

  async function ejecutar(tarimas: Parameters<typeof armarTarimas>[2], ok: (r: Awaited<ReturnType<typeof armarTarimas>>) => string) {
    setG2(true)
    try {
      const r = await armarTarimas(ranchoId, claveRef.current, tarimas)
      claveRef.current = nuevaClave()
      toast.success(ok(r)); setParcial(false); setMotivo(''); setCajasParcial('')
      await onListo()
    } catch (e) { avisar(e) } finally { setG2(false) }
  }

  async function armarCompletas() {
    const cuantas = Number(n)
    if (!K || !Number.isInteger(cuantas) || cuantas <= 0 || cuantas > completas) { toast.error(`Indica de 1 a ${completas} tarimas`); return }
    const plan = repartirCompletas(g, cuantas).map(t => ({ ...t, llego_armada: llegoArmada }))
    await ejecutar(plan, r => `Tarima(s) ${r.tarimas.map(t => t.numero).join(', ')} · ciclo ${r.ciclo}`)
  }

  async function armarParcial() {
    const c = Number(cajasParcial)
    const max = K ? Math.min(g.disponibles, K) : g.disponibles
    if (!Number.isInteger(c) || c <= 0 || c > max) { toast.error(`Cajas de 1 a ${max}`); return }
    if (motivo.trim().length < 3) { toast.error('Escribe el motivo y quién autoriza la tarima parcial'); return }
    const aportes: { linea_id: string; cajas: number }[] = []
    let falta = c
    for (const l of g.lineas) { if (!falta) break; const t = Math.min(l.disponibles, falta); if (t > 0) { aportes.push({ linea_id: l.linea_id, cajas: t }); falta -= t } }
    await ejecutar([{ aportes, excepcion_motivo: motivo.trim() }], r => `Tarima parcial autorizada n.º ${r.tarimas[0]?.numero}`)
  }

  return (
    <div className="rounded-[0.625rem] border border-border bg-card p-3 space-y-2">
      <div className="flex items-start justify-between gap-2">
        <div className="min-w-0">
          <p className="text-sm font-semibold truncate">#{g.codigo} · {g.presentacion} · {g.clasificacion}</p>
          <p className="text-xs text-muted-foreground truncate">Productor {g.codigo_productor} · {g.empresa} · {g.lineas.length} recepción(es)</p>
        </div>
        <span className="text-xs px-2 py-0.5 rounded-full font-semibold flex-shrink-0"
          style={K ? { backgroundColor: 'var(--agro-info-fill)', color: 'var(--agro-info-text)' } : { backgroundColor: 'var(--agro-danger-fill)', color: 'var(--agro-danger-text)' }}>
          {K ? `${K} cajas/tarima` : 'Capacidad pendiente de validar'}
        </span>
      </div>
      <div className="grid grid-cols-3 gap-2 text-center text-xs">
        <div className="rounded border border-border p-1"><p className="text-muted-foreground">Disponibles</p><b className="text-sm">{g.disponibles}</b></div>
        <div className="rounded border border-border p-1"><p className="text-muted-foreground">Completas posibles</p><b className="text-sm">{K ? completas : '—'}</b></div>
        <div className="rounded border border-border p-1"><p className="text-muted-foreground">{K ? 'Remanente / falta' : 'Sin armado automático'}</p><b className="text-sm">{K ? `${resto}${resto ? ` / ${K - resto}` : ''}` : g.disponibles}</b></div>
      </div>
      {K && completas > 0 && (
        <div className="flex flex-wrap items-end gap-2">
          <div className="w-24 space-y-1">
            <label className="text-xs text-muted-foreground font-semibold">Tarimas</label>
            <input inputMode="numeric" className="w-full h-10 rounded-[0.625rem] border border-border-control bg-input-background px-2 text-sm text-right"
              value={n} onChange={e => setN(e.target.value.replace(/\D/g, ''))} />
          </div>
          <label className="flex items-center gap-1 text-xs pb-2"><input type="checkbox" checked={llegoArmada} onChange={e => setLlegoArmada(e.target.checked)} /> Llegaron armadas</label>
          <Boton type="button" cargando={g2} onClick={armarCompletas}>Confirmar armado</Boton>
        </div>
      )}
      {(resto > 0 || !K) && (
        parcial ? (
          <div className="space-y-2 rounded-[0.625rem] p-2" style={{ backgroundColor: 'var(--muted)' }}>
            <p className="text-xs">Tarima parcial autorizada: no es completa; se registra como excepción con conteo físico, motivo y responsable.</p>
            <div className="flex gap-2">
              <input inputMode="numeric" className="w-24 h-10 rounded-[0.625rem] border border-border-control bg-input-background px-2 text-sm text-right" placeholder="Cajas"
                value={cajasParcial} onChange={e => setCajasParcial(e.target.value.replace(/\D/g, ''))} />
              <input className="flex-1 h-10 rounded-[0.625rem] border border-border-control bg-input-background px-3 text-sm" maxLength={300}
                placeholder="Motivo y quién autoriza" value={motivo} onChange={e => setMotivo(e.target.value)} />
            </div>
            <div className="flex gap-2">
              <Boton type="button" tamano="sm" cargando={g2} onClick={armarParcial}>Registrar parcial</Boton>
              <Boton type="button" tamano="sm" variante="secundario" onClick={() => setParcial(false)}>Cancelar</Boton>
            </div>
          </div>
        ) : (
          <p className="text-xs text-muted-foreground">
            {K ? `${resto} caja(s) quedan en consolidación esperando ${K - resto} más del mismo productor e ítem.` : 'Sin capacidad documentada no se arma ni se numera automáticamente.'}{' '}
            <button type="button" className="underline" onClick={() => { setCajasParcial(String(K ? resto : g.disponibles)); setParcial(true) }}>Registrar como parcial autorizada</button>
          </p>
        )
      )}
      <details className="text-xs">
        <summary className="cursor-pointer text-muted-foreground">Origen ({g.lineas.length})</summary>
        <ul className="mt-1 space-y-1">
          {g.lineas.map(l => (
            <li key={l.linea_id} className="flex items-center justify-between gap-2">
              <span>{fechaCorta(l.fecha)} {l.hora} · recibidas {l.recibidas} · en tarimas {l.en_tarimas} · disponibles {l.disponibles}</span>
              {puedeCorregir && (
                <button type="button" className="underline" onClick={async () => {
                  const v = window.prompt(`Corregir cajas recibidas (hoy ${l.recibidas}). Nueva cantidad:`); if (v === null) return
                  const m = window.prompt('Motivo de la corrección:'); if (m === null) return
                  try { await corregirRecepcion(l.linea_id, Number(v), m); toast.success('Recepción corregida; queda en el historial'); await onListo() } catch (e) { avisar(e) }
                }}>Corregir</button>
              )}
            </li>
          ))}
        </ul>
      </details>
    </div>
  )
}

function CierreCiclo({ ranchoId, numeroCiclo, tarimas, onListo }: { ranchoId: string; numeroCiclo: number; tarimas: M87Tarima[]; onListo: () => Promise<void> }) {
  const [abierto, setAbierto] = useState(false)
  const [confirmo, setConfirmo] = useState(false)   // sin preselección: decisión explícita
  const [disp, setDisp] = useState<Record<string, { accion: 'TRASPASAR' | 'DISPONER'; motivo: string }>>({})
  const [just, setJust] = useState('')
  const [guardando, setGuardando] = useState(false)
  const clave = useRef(nuevaClave())
  const quedan = tarimas.filter(t => t.estado === 'ARMADA' || t.estado === 'EN_CONSERVADOR')
  const bloquean = tarimas.filter(t => t.estado === 'RESERVADA' || t.estado === 'EN_PREFRIO')
  const faltan = quedan.filter(t => !disp[t.id] || (disp[t.id].accion === 'DISPONER' && disp[t.id].motivo.trim().length < 3))

  async function cerrar() {
    if (!confirmo) { toast.error('Marca "Finalizar también el ciclo; no se esperan más tráileres"'); return }
    if (faltan.length) { toast.error(`Falta decidir qué pasa con la tarima ${faltan[0].numero}`); return }
    setGuardando(true)
    try {
      const r = await cerrarCiclo({ rancho: ranchoId, key: clave.current, confirmoFin: true,
        disposiciones: quedan.map(t => ({ tarima_id: t.id, accion: disp[t.id].accion, motivo: disp[t.id].motivo || undefined })),
        justificacion: just.trim() || null })
      toast.success(`Ciclo ${r.ciclo_cerrado} cerrado${r.traspasadas ? ` · ${r.traspasadas} tarima(s) pasan al siguiente ciclo con número nuevo` : ''}`)
      clave.current = nuevaClave(); setAbierto(false); setConfirmo(false); setDisp({}); setJust('')
      await onListo()
    } catch (e) { avisar(e); if (!/fetch|network/i.test(String((e as any)?.message))) clave.current = nuevaClave() } finally { setGuardando(false) }
  }

  if (!abierto) return <Boton type="button" variante="secundario" className="w-full" onClick={() => setAbierto(true)}>Cerrar ciclo {numeroCiclo}</Boton>
  return (
    <div className="rounded-[0.625rem] border border-border bg-card p-3 space-y-3">
      <p className="text-sm font-semibold">Cerrar ciclo {numeroCiclo}</p>
      {bloquean.length > 0 && <p className="text-xs" style={{ color: 'var(--agro-danger-text)' }}>No se puede cerrar: {bloquean.map(t => `N.${t.numero} (${ESTADO_TXT[t.estado].toLowerCase()})`).join(', ')}. Termina el prefrío o libera la reserva.</p>}
      {quedan.length > 0 && (
        <div className="space-y-2">
          <p className="text-xs text-muted-foreground">Tarimas sin cargar: decide una por una.</p>
          {quedan.map(t => {
            const d = disp[t.id]
            return (
              <div key={t.id} className="space-y-1">
                <p className="text-xs"><b>N.{t.numero}</b> · #{t.codigo} · {t.cajas} cajas · {ESTADO_TXT[t.estado]}</p>
                <div className="flex gap-3 text-xs">
                  <label className="flex items-center gap-1"><input type="radio" name={`d-${t.id}`} checked={d?.accion === 'TRASPASAR'} onChange={() => setDisp(x => ({ ...x, [t.id]: { accion: 'TRASPASAR', motivo: '' } }))} />Pasar al siguiente ciclo</label>
                  <label className="flex items-center gap-1"><input type="radio" name={`d-${t.id}`} checked={d?.accion === 'DISPONER'} onChange={() => setDisp(x => ({ ...x, [t.id]: { accion: 'DISPONER', motivo: x[t.id]?.motivo ?? '' } }))} />Disponer</label>
                </div>
                {d?.accion === 'DISPONER' && <input className="w-full h-9 rounded-[0.625rem] border border-border-control bg-input-background px-2 text-xs" placeholder="Motivo (merma, destrucción, devolución...)" value={d.motivo} onChange={e => setDisp(x => ({ ...x, [t.id]: { accion: 'DISPONER', motivo: e.target.value } }))} />}
              </div>
            )
          })}
        </div>
      )}
      <div className="space-y-1">
        <label className="text-xs text-muted-foreground font-semibold">Cajas recibidas sin armar (si las hay): cómo se resuelven</label>
        <textarea className="w-full rounded-[0.625rem] border border-border-control bg-input-background p-2 text-xs" rows={2} value={just} onChange={e => setJust(e.target.value)} />
      </div>
      <label className="flex items-start gap-2 text-sm">
        <input type="checkbox" className="mt-1" checked={confirmo} onChange={e => setConfirmo(e.target.checked)} />
        <span>Finalizar también el ciclo; no se esperan más tráileres</span>
      </label>
      <div className="flex gap-2">
        <Boton type="button" variante="secundario" className="flex-1" onClick={() => setAbierto(false)} disabled={guardando}>Cancelar</Boton>
        <Boton type="button" className="flex-1" onClick={cerrar} cargando={guardando} disabled={!confirmo || bloquean.length > 0}>Cerrar ciclo</Boton>
      </div>
    </div>
  )
}

function Cuadre({ ranchoId }: { ranchoId: string }) {
  const [desde, setDesde] = useState(hoyMX())
  const [hasta, setHasta] = useState(hoyMX())
  const [filas, setFilas] = useState<M87CuadreFila[] | null>(null)
  const [cargando, setCargando] = useState(false)
  async function ver() {
    setCargando(true)
    try { setFilas(await cargarCuadre(ranchoId, desde, hasta)) } catch (e) { avisar(e) } finally { setCargando(false) }
  }
  const tot = (k: keyof M87CuadreFila) => (filas ?? []).reduce((a, f) => a + Number(f[k] ?? 0), 0)
  const cols: [keyof M87CuadreFila, string][] = [['recibidas', 'Recib.'], ['sin_armar', 'Sin armar'], ['en_tarimas_no_cargadas', 'En tarimas'], ['cargadas', 'Cargadas'], ['dispuestas', 'Dispuestas'], ['prefrio_legado', 'Prefrío cajas'], ['retenidas', 'Retenidas']]
  return (
    <div className="space-y-2">
      <div className="flex gap-2 items-end">
        <div className="flex-1"><label className="text-xs text-muted-foreground">Desde</label><input type="date" className="w-full h-9 rounded-[0.625rem] border border-border-control bg-input-background px-2 text-sm" value={desde} onChange={e => setDesde(e.target.value)} /></div>
        <div className="flex-1"><label className="text-xs text-muted-foreground">Hasta</label><input type="date" className="w-full h-9 rounded-[0.625rem] border border-border-control bg-input-background px-2 text-sm" value={hasta} onChange={e => setHasta(e.target.value)} /></div>
        <Boton type="button" tamano="sm" onClick={ver} cargando={cargando}>Ver</Boton>
      </div>
      {filas && (filas.length === 0 ? <p className="text-xs text-muted-foreground">Sin recepción aceptada en el periodo.</p> : (
        <div className="overflow-x-auto">
          <table className="w-full text-xs">
            <thead><tr className="text-muted-foreground"><th className="text-left py-1">Ítem</th>{cols.map(([, t]) => <th key={t} className="text-right px-1">{t}</th>)}<th className="text-right px-1">Dif.</th></tr></thead>
            <tbody>
              {filas.map(f => {
                const dif = f.recibidas - (f.sin_armar + f.en_tarimas_no_cargadas + f.cargadas + f.dispuestas + f.prefrio_legado + f.retenidas)
                return (
                  <tr key={f.codigo} className="border-t border-border">
                    <td className="py-1">#{f.codigo} {f.presentacion ?? ''} · {f.clasificacion}</td>
                    {cols.map(([k]) => <td key={k} className="text-right px-1">{f[k] as number}</td>)}
                    <td className="text-right px-1" style={dif !== 0 ? { color: 'var(--agro-danger-text)' } : undefined}>{dif}</td>
                  </tr>
                )
              })}
              <tr className="border-t border-border font-semibold"><td className="py-1">Total</td>{cols.map(([k]) => <td key={k} className="text-right px-1">{tot(k)}</td>)}<td /></tr>
            </tbody>
          </table>
          <p className="text-xs text-muted-foreground mt-1">Cada caja cae en una sola categoría. Dif. distinta de 0 indica algo por revisar.</p>
        </div>
      ))}
    </div>
  )
}

export function TarimasConsolidacion() {
  const { profile } = useAuthContext()
  const puedeCorregir = ['admin_org', 'super_admin'].includes(profile?.rol ?? '')
  const { ranchos } = useRanchos()
  const [ranchoId, setRanchoId] = useState('')
  useEffect(() => { if (ranchos.length && !ranchoId) setRanchoId(ranchos[0].id) }, [ranchos, ranchoId])
  const { saldos, ciclo, tarimas, loading, error, refetch } = useM87Tarimas(ranchoId)
  const grupos = useMemo(() => agrupar(saldos), [saldos])
  const activas = tarimas.filter(t => t.estado !== 'ANULADA')
  const [selCons, setSelCons] = useState<string[]>([])
  const [ingresando, setIngresando] = useState(false)
  async function aConservador() {
    setIngresando(true)
    try { const n = await ingresarConservador(selCons); toast.success(`${n} tarima(s) ingresaron al conservador`); setSelCons([]); await refetch() }
    catch (e) { avisar(e) } finally { setIngresando(false) }
  }

  return (
    <div className="flex flex-col min-h-full bg-background pb-safe-nav">
      <ModuloHeader tituloFallback="Tarimas y Consolidación" subtitulo={ciclo ? `Ciclo ${ciclo.numero_ciclo} abierto · último n.º ${ciclo.ultimo_numero}` : 'Sin ciclo abierto: se abre al armar la primera tarima'} />
      <div className="p-4 space-y-4 max-w-3xl w-full mx-auto">
        {ranchos.length > 1 && (
          <select className="w-full h-10 rounded-[0.625rem] border border-border-control bg-input-background px-3 text-sm" value={ranchoId} onChange={e => setRanchoId(e.target.value)}>
            {ranchos.map(r => <option key={r.id} value={r.id}>{r.nombre}</option>)}
          </select>
        )}
        {error && <div className="flex items-start gap-2 rounded-xl p-3" style={{ backgroundColor: 'var(--agro-danger-fill)' }}><TriangleAlert className="w-4 h-4" /><p className="text-xs">{error}</p></div>}

        <section className="space-y-2">
          <TituloSeccion>Por armar (recepción aceptada con cajas disponibles)</TituloSeccion>
          {loading ? <ListaSkeleton rows={2} /> : grupos.length === 0
            ? <EstadoVacio icono={Boxes} titulo="Sin cajas por armar" ayuda="Las entregas aceptadas en Recepción por ítem aparecen aquí" />
            : grupos.map(g => <GrupoCard key={g.clave} g={g} ranchoId={ranchoId} puedeCorregir={puedeCorregir} onListo={refetch} />)}
          <p className="text-xs text-muted-foreground">Solo se consolida el mismo productor, ítem y clasificación. Las tarimas que llegan armadas se registran completas y no se usan para llenar remanentes.</p>
        </section>

        <section className="space-y-2">
          <TituloSeccion>{ciclo ? `Tarimas del ciclo ${ciclo.numero_ciclo}` : 'Tarimas'}</TituloSeccion>
          {loading ? <Loader2 className="w-5 h-5 animate-spin text-muted-foreground" /> : tarimas.length === 0 ? <p className="text-xs text-muted-foreground">Sin tarimas en el ciclo.</p> : (
            <ul className="space-y-1">
              {tarimas.map(t => (
                <li key={t.id} className={`rounded-[0.625rem] border border-border bg-card px-3 py-2 flex items-center gap-3 text-sm ${t.estado === 'ANULADA' ? 'opacity-50' : ''}`}>
                  {t.estado === 'ARMADA'
                    ? <input type="checkbox" aria-label={`Elegir tarima ${t.numero}`} checked={selCons.includes(t.id)} onChange={() => setSelCons(x => x.includes(t.id) ? x.filter(y => y !== t.id) : [...x, t.id])} />
                    : <span className="w-[13px]" />}
                  <b className="w-12 text-lg">{t.numero}</b>
                  <div className="flex-1 min-w-0">
                    <p className="truncate">#{t.codigo} {t.presentacion} · {t.clasificacion} · <b>{t.cajas}</b> cajas</p>
                    <p className="text-xs text-muted-foreground truncate">
                      Prod. {t.codigo_productor} · {ESTADO_TXT[t.estado] ?? t.estado}{t.tipo === 'PARCIAL_EXCEPCION' ? ` · PARCIAL AUTORIZADA (${t.excepcion_motivo})` : ''}{t.origen === 'LLEGO_ARMADA' ? ' · llegó armada' : ''}
                    </p>
                  </div>
                  {t.estado === 'ARMADA' && (
                    <div className="flex flex-col gap-1 text-xs">
                      <button type="button" className="underline" onClick={async () => {
                        const v = window.prompt(`Nuevo número para la tarima ${t.numero}:`); if (v === null) return
                        const m = window.prompt('Motivo:'); if (m === null) return
                        try { await editarNumeroTarima(t.id, Number(v), m); toast.success('Número actualizado'); await refetch() } catch (e) { avisar(e) }
                      }}>Número</button>
                      <button type="button" className="underline" style={{ color: 'var(--agro-danger-text)' }} onClick={async () => {
                        const m = window.prompt(`Deshacer la tarima ${t.numero} (sus cajas vuelven a disponibles; el número no se reutiliza). Motivo:`); if (m === null) return
                        try { await anularTarima(t.id, m); toast.success('Tarima deshecha'); await refetch() } catch (e) { avisar(e) }
                      }}>Deshacer</button>
                    </div>
                  )}
                </li>
              ))}
            </ul>
          )}
          {activas.length > 0 && <p className="text-xs text-muted-foreground">{activas.length} tarima(s) · {activas.reduce((a, t) => a + t.cajas, 0)} cajas en el ciclo.</p>}
          {selCons.length > 0 && (
            <Boton type="button" className="w-full" onClick={aConservador} cargando={ingresando}>Ingresar {selCons.length} al conservador (ya preenfriadas)</Boton>
          )}
          <p className="text-xs text-muted-foreground">Las que van a prefrío se eligen en Prefrío; al salir pasan solas al conservador.</p>
        </section>

        {ciclo && (
          <section className="space-y-2">
            <TituloSeccion>Cierre del ciclo</TituloSeccion>
            <CierreCiclo ranchoId={ranchoId} numeroCiclo={ciclo.numero_ciclo} tarimas={tarimas} onListo={refetch} />
          </section>
        )}

        {ranchoId && (
          <section className="space-y-2">
            <TituloSeccion>Cuadre de jornada</TituloSeccion>
            <Cuadre ranchoId={ranchoId} />
          </section>
        )}
      </div>
    </div>
  )
}
