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
import {
  useM87Tarimas, agrupar, repartirCompletas, armarTarimas, anularTarima, editarNumeroTarima, corregirRecepcion, mensajeErrorM87,
  type M87Grupo,
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

export function TarimasConsolidacion() {
  const { profile } = useAuthContext()
  const puedeCorregir = ['admin_org', 'asesor_tecnico', 'super_admin'].includes(profile?.rol ?? '')
  const { ranchos } = useRanchos()
  const [ranchoId, setRanchoId] = useState('')
  useEffect(() => { if (ranchos.length && !ranchoId) setRanchoId(ranchos[0].id) }, [ranchos, ranchoId])
  const { saldos, ciclo, tarimas, loading, error, refetch } = useM87Tarimas(ranchoId)
  const grupos = useMemo(() => agrupar(saldos), [saldos])
  const activas = tarimas.filter(t => t.estado !== 'ANULADA')

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
        </section>
      </div>
    </div>
  )
}
