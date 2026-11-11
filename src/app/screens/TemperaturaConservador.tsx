// M85 · Temperatura del conservador. Una lectura ordinaria = escribir la temperatura en °C o °F según configuración + Registrar (o Enter).
// Fecha, hora, conservador y usuario los pone el servidor. Fuera de rango: se registra igual y queda incidencia.
import { useEffect, useMemo, useRef, useState } from 'react'
import { X, Loader2, FileDown, TriangleAlert, Thermometer, CheckCircle2, Pencil } from 'lucide-react'
import { toast } from 'sonner'
import { HoraInput24 } from '@/app/components/HoraInput24'
import { BottomSheet } from '@/app/components/BottomSheet'
import { ModuloHeader } from '@/app/components/ModuloHeader'
import { Boton } from '@/app/components/ui-mady/Boton'
import { TituloSeccion } from '@/app/components/ui-mady/TituloSeccion'
import { ListaSkeleton } from '@/app/components/ListaSkeleton'
import { useAuthContext } from '@/context/AuthContext'
import { useModulosContext } from '@/context/ModulosContext'
import { useRanchos } from '@/hooks/useRanchos'
import { codigoFormato } from '@/lib/codigoFormato'
import { hoyMX } from '@/lib/fecha'
import { fechaCorta } from '@/lib/formato'
import {
  useM85Conservador, registrarLecturaM85, documentarM85, corregirM85, verificarDiaM85, mensajeErrorM85, type M85Lectura,
} from '@/hooks/useM85Conservador'
import { calcularRevision, parsearTemperatura, horaLocal, instanteLocal, fmtF } from '@/lib/pdf/m85/conservadorLogica'
import { generarTemperaturaConservadorPDF } from '@/lib/pdf/m85/generarTemperaturaConservadorPDF'
import { BotonExportarConsolidado } from '@/app/components/BotonExportarConsolidado'

const fieldCls = 'w-full h-10 rounded-[0.625rem] border border-border-control bg-input-background px-3 text-sm'
const areaCls = 'w-full rounded-[0.625rem] border border-border-control bg-input-background px-3 py-2 text-sm'
const K_EMPRESA = 'mady.m85.empresaPdf'
const leer = (k: string) => { try { return localStorage.getItem(k) ?? '' } catch { return '' } }
const guardar = (k: string, v: string) => { try { localStorage.setItem(k, v) } catch { /* sin almacenamiento */ } }
const nuevaClave = () => (crypto?.randomUUID ? crypto.randomUUID() : `${Date.now().toString(16)}-0000-4000-8000-${Math.random().toString(16).slice(2, 14).padEnd(12, '0')}`)
const horaAhora = () => new Date().toLocaleTimeString('en-GB', { timeZone: 'America/Mexico_City', hour: '2-digit', minute: '2-digit', hour12: false })
function avisar(e: any) {
  const m = mensajeErrorM85(e)
  if (m.tipo === 'warning') toast.warning(m.texto, { duration: 7000 }); else toast.error(m.texto, { duration: 8000 })
}

export function TemperaturaConservador() {
  const { profile, codigoClave } = useAuthContext()
  const orgId = profile?.org_id ?? null
  const esAdmin = profile?.rol === 'admin_org' || profile?.rol === 'super_admin'
  const puedeVerificar = esAdmin || profile?.rol === 'asesor_tecnico'
  const { terminosSitio } = useModulosContext()
  const { ranchos } = useRanchos()
  const [fecha, setFecha] = useState(hoyMX())
  const { config, delDia, pendientes, verificacion, loading, error, refetch } = useM85Conservador(fecha)
  const [ranchoId, setRanchoId] = useState('')
  useEffect(() => { if (ranchos.length >= 1 && !ranchoId) setRanchoId(ranchos[0].id) }, [ranchos, ranchoId])
  const codigoFmt = codigoFormato('F-FRUS-PRO-05', codigoClave)
  const [, setTick] = useState(0)
  useEffect(() => { const t = setInterval(() => setTick(x => x + 1), 60000); return () => clearInterval(t) }, [])

  // ── Lectura
  const inputRef = useRef<HTMLInputElement>(null)
  const claveRef = useRef<string>(nuevaClave())
  const [valor, setValor] = useState('')
  const [obs, setObs] = useState('')
  const [cambiarHora, setCambiarHora] = useState(false)
  const [horaMed, setHoraMed] = useState(horaAhora())
  const [guardando, setGuardando] = useState(false)
  const [ultimo, setUltimo] = useState<{ hora: string; temp: number; fuera: boolean } | null>(null)
  useEffect(() => { inputRef.current?.focus() }, [])

  const temp = parsearTemperatura(valor)
  const fuera = temp !== null && (temp < config.limite_min || temp > config.limite_max)
  const esHoy = fecha === hoyMX()
  const ultimaLectura = esHoy && delDia.length ? delDia[delDia.length - 1] : null
  const revision = esHoy ? calcularRevision(delDia, config.turno_inicio) : null

  async function registrar() {
    if (guardando) return
    if (!ranchoId) { toast.error(`No hay ${terminosSitio.singular.toLowerCase()} asignada`); return }
    if (temp === null) { toast.error('Escribe la temperatura: número con punto o coma, hasta dos decimales'); return }
    if (cambiarHora && !/^\d{2}:\d{2}$/.test(horaMed)) { toast.error('Indica la hora de medición'); return }
    setGuardando(true)
    try {
      const r = await registrarLecturaM85({
        rancho: ranchoId, temperatura: temp, key: claveRef.current,
        medidaEn: cambiarHora ? instanteLocal(hoyMX(), horaMed).toISOString() : null,
        observacion: fuera && obs.trim() ? obs.trim() : null,
      })
      claveRef.current = nuevaClave()
      setUltimo({ hora: horaLocal(r.medida_en), temp: Number(r.temperatura), fuera: r.estado !== 'REGISTRADA' })
      setValor(''); setObs(''); setCambiarHora(false)
      if (r.estado === 'INCIDENCIA_PENDIENTE') toast.warning(`Registrado ${horaLocal(r.medida_en)} · ${fmtF(r.temperatura)} °${config.unidad} fuera de intervalo: documenta la incidencia`, { duration: 8000 })
      else toast.success(`Registrado ${horaLocal(r.medida_en)} · ${fmtF(r.temperatura)} °${config.unidad}`)
      if (!esHoy) setFecha(hoyMX()); else await refetch()
      inputRef.current?.focus()
    } catch (e) {
      avisar(e)  // el valor y la clave se conservan: reintentar no duplica
    } finally { setGuardando(false) }
  }

  // ── Documentar incidencia
  const [doc, setDoc] = useState<M85Lectura | null>(null)
  const [docObs, setDocObs] = useState('')
  const [docAccion, setDocAccion] = useState('')
  async function documentar() {
    if (!doc) return
    setGuardando(true)
    try { await documentarM85(doc.id, docObs, docAccion); toast.success('Incidencia documentada'); setDoc(null); await refetch() }
    catch (e) { avisar(e) } finally { setGuardando(false) }
  }

  // ── Corregir
  const [cor, setCor] = useState<M85Lectura | null>(null)
  const [corTemp, setCorTemp] = useState('')
  const [corHora, setCorHora] = useState('')
  const [corMotivo, setCorMotivo] = useState('')
  async function corregir() {
    if (!cor) return
    const t = corTemp.trim() ? parsearTemperatura(corTemp) : null
    if (corTemp.trim() && t === null) { toast.error('Temperatura inválida'); return }
    const medidaEn = corHora && corHora !== horaLocal(cor.medida_en) ? instanteLocal(cor.fecha, corHora).toISOString() : null
    if (t === null && !medidaEn) { toast.error('No hay cambios'); return }
    setGuardando(true)
    try {
      await corregirM85({ lectura: cor.id, motivo: corMotivo, temperatura: t !== null && t !== cor.temperatura ? t : null, medidaEn })
      toast.success('Lectura corregida; el valor anterior queda en el historial'); setCor(null); await refetch()
    } catch (e) { avisar(e) } finally { setGuardando(false) }
  }

  // ── Verificación del encargado de turno
  const [verificando, setVerificando] = useState(false)
  async function verificarDia() {
    if (!ranchoId) return
    if (!window.confirm(`¿Verificar como encargado de turno las lecturas del ${fechaCorta(fecha)}?`)) return
    setVerificando(true)
    try { const r = await verificarDiaM85(ranchoId, fecha); toast.success(`Día verificado (${r.lecturas} lecturas)`); await refetch() }
    catch (e) { avisar(e) } finally { setVerificando(false) }
  }

  // ── PDF
  const [pdfOpen, setPdfOpen] = useState(false)
  const [pdfDesde, setPdfDesde] = useState(hoyMX())
  const [pdfHasta, setPdfHasta] = useState(hoyMX())
  const [pdfEmpresa, setPdfEmpresa] = useState(leer(K_EMPRESA) || 'DRISCOLL')
  const [pdfCargando, setPdfCargando] = useState(false)
  async function pdf() {
    if (!orgId) return
    if (!pdfEmpresa.trim()) { toast.error('Indica la empresa del encabezado'); return }
    if (pdfHasta < pdfDesde) { toast.error('El rango de fechas no es válido'); return }
    setPdfCargando(true)
    try {
      guardar(K_EMPRESA, pdfEmpresa.trim())
      const n = await generarTemperaturaConservadorPDF({ orgId, desde: pdfDesde, hasta: pdfHasta, empresa: pdfEmpresa.trim(), codigoClave,
        limites: { min: config.limite_min, max: config.limite_max }, unidad: config.unidad })
      if (n === 0) toast.info('No hay lecturas en ese periodo'); else setPdfOpen(false)
    } catch (e: any) { toast.error(e?.message ?? 'Error al generar PDF') } finally { setPdfCargando(false) }
  }

  const listaDia = useMemo(() => [...delDia].reverse(), [delDia])

  return (
    <div className="flex flex-col min-h-full bg-background pb-safe-nav">
      <ModuloHeader tituloFallback="Temperatura del Conservador" subtitulo={`${codigoFmt} · ${config.conservador_nombre}`}
        acciones={<button onClick={() => setPdfOpen(true)} className="hidden min-[1224px]:flex items-center gap-2 h-9 px-3 rounded-[0.625rem] border border-border text-sm">
          <FileDown className="w-4 h-4" style={{ color: 'var(--primary)' }} /> PDF</button>} />

      <div className="px-4 pt-3"><BotonExportarConsolidado onClick={() => setPdfOpen(true)} /></div>

      <div className="p-4 space-y-4 max-w-xl w-full mx-auto">
        {error && (
          <div className="flex items-start gap-2 rounded-xl p-3" style={{ backgroundColor: 'var(--agro-danger-fill)', border: '1px solid var(--agro-red)' }}>
            <TriangleAlert className="w-4 h-4 flex-shrink-0 mt-0.5" style={{ color: 'var(--agro-danger-text)' }} />
            <p className="text-xs" style={{ color: 'var(--agro-danger-text)' }}>Error al cargar las lecturas.</p>
          </div>
        )}

        {/* Captura */}
        <section className="rounded-[0.625rem] border border-border bg-card p-4 space-y-3">
          <div className="flex items-center justify-between text-xs">
            <span className="text-muted-foreground">{config.conservador_nombre} · {profile?.nombre_completo ?? ''}</span>
            {revision && (revision.tipo === 'pendiente'
              ? <span className="font-semibold" style={{ color: 'var(--agro-danger-text)' }}>Revisión pendiente desde {revision.desde}</span>
              : revision.tipo === 'proxima'
                ? <span className="text-muted-foreground">Próxima revisión: <b>{revision.hora}</b></span>
                : <span className="text-muted-foreground">Registra la lectura de inicio de turno</span>)}
          </div>
          {ranchos.length > 1 && (
            <select className={fieldCls} value={ranchoId} onChange={e => setRanchoId(e.target.value)} aria-label={terminosSitio.singular}>
              {ranchos.map(r => <option key={r.id} value={r.id}>{r.nombre}</option>)}
            </select>
          )}
          <form onSubmit={e => { e.preventDefault(); registrar() }} className="space-y-3">
            <label className="text-xs text-muted-foreground font-semibold flex items-center gap-1">
              <Thermometer className="w-3.5 h-3.5" /> Temperatura ambiental (°{config.unidad})
            </label>
            <div className="flex items-center gap-2">
              <input ref={inputRef} inputMode="decimal" autoComplete="off" aria-label={`Temperatura en °${config.unidad}`}
                className="flex-1 h-14 rounded-[0.625rem] border border-border-control bg-input-background px-4 text-2xl font-semibold"
                value={valor} onChange={e => setValor(e.target.value.replace(/[^0-9.,-]/g, ''))} placeholder={config.unidad === 'C' ? '0.0' : '32.0'} />
              <span className="text-lg font-semibold text-muted-foreground">°{config.unidad}</span>
            </div>
            {valor && temp === null && <p className="text-xs" style={{ color: 'var(--agro-danger-text)' }}>Número con punto o coma y hasta dos decimales.</p>}
            {fuera && (
              <div className="space-y-2 rounded-[0.625rem] p-3" style={{ backgroundColor: 'var(--agro-danger-fill)' }}>
                <p className="text-xs font-semibold" style={{ color: 'var(--agro-danger-text)' }}>
                  Fuera del intervalo {config.limite_min}–{config.limite_max} °{config.unidad}. Se registrará el valor real y quedará una incidencia.
                </p>
                <textarea className={areaCls} rows={2} maxLength={1000} value={obs} onChange={e => setObs(e.target.value)}
                  placeholder="Observación y acción (opcional ahora; puedes documentarla después)" />
              </div>
            )}
            {cambiarHora ? (
              <div className="space-y-1">
                <label className="text-xs text-muted-foreground font-semibold">Hora real de la medición (captura tardía)</label>
                <HoraInput24 value={horaMed} onChange={setHoraMed} ariaLabel="Hora de medición" />
              </div>
            ) : (
              <button type="button" className="text-xs text-muted-foreground underline" onClick={() => { setHoraMed(horaAhora()); setCambiarHora(true) }}>
                ¿La tomaste antes? Indicar hora de medición
              </button>
            )}
            <Boton type="submit" cargando={guardando} className="w-full" disabled={temp === null}>Registrar lectura</Boton>
          </form>
          {ultimo && (
            <p className="text-sm flex items-center gap-1" style={{ color: ultimo.fuera ? 'var(--agro-danger-text)' : 'var(--agro-success-text)' }}>
              <CheckCircle2 className="w-4 h-4" /> Registrado {ultimo.hora} · {fmtF(ultimo.temp)} °{config.unidad}
            </p>
          )}
          {ultimaLectura && (
            <p className="text-xs text-muted-foreground">Última: {horaLocal(ultimaLectura.medida_en)} · {fmtF(ultimaLectura.temperatura)} °{config.unidad} · {ultimaLectura.iniciales}</p>
          )}
        </section>

        {/* Incidencias pendientes */}
        {pendientes.length > 0 && (
          <section className="space-y-2">
            <TituloSeccion>Incidencias por documentar</TituloSeccion>
            {pendientes.map(l => (
              <div key={l.id} className="rounded-[0.625rem] border p-3 flex items-center justify-between gap-2" style={{ borderColor: 'var(--agro-red)' }}>
                <span className="text-sm">{fechaCorta(l.fecha)} {horaLocal(l.medida_en)} · <b>{fmtF(l.temperatura)} °{config.unidad}</b> · {l.iniciales}</span>
                <Boton type="button" tamano="sm" onClick={() => { setDoc(l); setDocObs(l.observacion ?? ''); setDocAccion('') }}>Documentar</Boton>
              </div>
            ))}
          </section>
        )}

        {/* Lecturas del día */}
        <section className="space-y-2">
          <div className="flex items-end gap-2">
            <div className="flex-1 space-y-1">
              <TituloSeccion>Lecturas</TituloSeccion>
              <input type="date" className={fieldCls} value={fecha} max={hoyMX()} onChange={e => e.target.value && setFecha(e.target.value)} />
            </div>
            <button onClick={() => { setPdfDesde(fecha); setPdfHasta(fecha); setPdfOpen(true) }}
              className="h-10 px-3 rounded-[0.625rem] border border-border flex items-center gap-2 text-sm">
              <FileDown className="w-4 h-4" style={{ color: 'var(--primary)' }} /> PDF
            </button>
          </div>
          {(verificacion || (puedeVerificar && listaDia.length > 0)) && (
            <div className="flex items-center justify-between gap-2 rounded-[0.625rem] border border-border bg-card px-3 py-2">
              <span className="text-xs text-muted-foreground">
                {verificacion
                  ? <>Verificó (encargado de turno): <b>{verificacion.nombre}</b> · {horaLocal(verificacion.verificado_en)} · {verificacion.lecturas} lecturas</>
                  : 'Sin verificar por el encargado de turno'}
              </span>
              {puedeVerificar && listaDia.length > 0 && (
                <Boton type="button" tamano="sm" variante={verificacion ? 'secundario' : 'primario'} cargando={verificando} onClick={verificarDia}>
                  {verificacion ? 'Volver a verificar' : 'Verificar día'}
                </Boton>
              )}
            </div>
          )}
          {loading ? <ListaSkeleton rows={3} /> : listaDia.length === 0 ? (
            <p className="text-xs text-muted-foreground">Sin lecturas en esta fecha.</p>
          ) : (
            <ul className="space-y-1">
              {listaDia.map(l => {
                const f = l.estado !== 'REGISTRADA'
                const tardia = Math.abs(new Date(l.guardada_en).getTime() - new Date(l.medida_en).getTime()) > 10 * 60000
                return (
                  <li key={l.id} className="rounded-[0.625rem] border border-border bg-card px-3 py-2 flex items-center gap-3 text-sm">
                    <span className="w-12 font-semibold">{horaLocal(l.medida_en)}</span>
                    <span className="w-20 font-semibold" style={f ? { color: 'var(--agro-danger-text)' } : undefined}>{fmtF(l.temperatura)} °{config.unidad}</span>
                    <span className="flex-1 text-xs text-muted-foreground truncate">
                      {l.iniciales}{tardia ? ` · guardada ${horaLocal(l.guardada_en)}` : ''}
                      {l.estado === 'INCIDENCIA_PENDIENTE' ? ' · incidencia pendiente' : l.estado === 'INCIDENCIA_DOCUMENTADA' ? ' · incidencia documentada' : ''}
                    </span>
                    {(esAdmin || l.usuario_id === profile?.id) && (
                      <button type="button" aria-label="Corregir lectura" className="p-1.5 rounded-lg border border-border"
                        onClick={() => { setCor(l); setCorTemp(''); setCorHora(horaLocal(l.medida_en)); setCorMotivo('') }}>
                        <Pencil className="w-3.5 h-3.5 text-muted-foreground" />
                      </button>
                    )}
                  </li>
                )
              })}
            </ul>
          )}
        </section>
      </div>

      {/* ═══ Documentar ═══ */}
      <BottomSheet open={!!doc} onClose={() => { if (!guardando) setDoc(null) }} height="85%">
        <div className="flex items-center justify-between px-4 pt-4 pb-3 border-b border-border">
          <h2 className="text-base text-foreground font-semibold">Documentar incidencia</h2>
          <button aria-label="Cerrar" type="button" onClick={() => { if (!guardando) setDoc(null) }}><X className="w-5 h-5 text-muted-foreground" /></button>
        </div>
        {doc && (
          <div className="overflow-y-auto px-4 pb-6 pt-3 space-y-4" style={{ flex: 1 }}>
            <p className="text-sm">{fechaCorta(doc.fecha)} {horaLocal(doc.medida_en)} · <b>{fmtF(doc.temperatura)} °{config.unidad}</b> · {doc.nombre_usuario}</p>
            <div className="space-y-1">
              <label className="text-xs text-muted-foreground font-semibold">Observación (qué pasó) *</label>
              <textarea className={areaCls} rows={3} maxLength={1000} value={docObs} onChange={e => setDocObs(e.target.value)} />
            </div>
            <div className="space-y-1">
              <label className="text-xs text-muted-foreground font-semibold">Acción realizada y seguimiento</label>
              <textarea className={areaCls} rows={3} maxLength={1000} value={docAccion} onChange={e => setDocAccion(e.target.value)}
                placeholder="Solo lo que realmente se hizo (p. ej. reporte a mantenimiento, nueva lectura a las …)" />
            </div>
            <Boton type="button" onClick={documentar} cargando={guardando} className="w-full">Guardar</Boton>
          </div>
        )}
      </BottomSheet>

      {/* ═══ Corregir ═══ */}
      <BottomSheet open={!!cor} onClose={() => { if (!guardando) setCor(null) }} height="85%">
        <div className="flex items-center justify-between px-4 pt-4 pb-3 border-b border-border">
          <h2 className="text-base text-foreground font-semibold">Corregir lectura</h2>
          <button aria-label="Cerrar" type="button" onClick={() => { if (!guardando) setCor(null) }}><X className="w-5 h-5 text-muted-foreground" /></button>
        </div>
        {cor && (
          <div className="overflow-y-auto px-4 pb-6 pt-3 space-y-4" style={{ flex: 1 }}>
            <p className="text-sm">Registrada: {fechaCorta(cor.fecha)} {horaLocal(cor.medida_en)} · {fmtF(cor.temperatura)} °{config.unidad} · {cor.iniciales}</p>
            <div className="flex gap-3">
              <div className="flex-1 space-y-1">
                <label className="text-xs text-muted-foreground font-semibold">Temperatura correcta (°{config.unidad})</label>
                <input inputMode="decimal" className={fieldCls} value={corTemp} placeholder={fmtF(cor.temperatura)} onChange={e => setCorTemp(e.target.value.replace(/[^0-9.,-]/g, ''))} />
              </div>
              <div className="flex-1 space-y-1">
                <label className="text-xs text-muted-foreground font-semibold">Hora real de medición</label>
                <HoraInput24 value={corHora} onChange={setCorHora} ariaLabel="Hora real de medición" />
              </div>
            </div>
            <div className="space-y-1">
              <label className="text-xs text-muted-foreground font-semibold">Motivo de la corrección *</label>
              <textarea className={areaCls} rows={2} maxLength={500} value={corMotivo} onChange={e => setCorMotivo(e.target.value)} />
            </div>
            <p className="text-xs text-muted-foreground">El valor anterior, quién corrige, cuándo y el motivo quedan en el historial.</p>
            <Boton type="button" onClick={corregir} cargando={guardando} className="w-full">Guardar corrección</Boton>
          </div>
        )}
      </BottomSheet>

      {/* ═══ PDF ═══ */}
      <BottomSheet open={pdfOpen} onClose={() => { if (!pdfCargando) setPdfOpen(false) }} height="85%">
        <div className="flex items-center justify-between px-4 pt-4 pb-3 border-b border-border">
          <h2 className="text-base text-foreground font-semibold">Bitácora del conservador</h2>
          <button aria-label="Cerrar" type="button" onClick={() => { if (!pdfCargando) setPdfOpen(false) }}><X className="w-5 h-5 text-muted-foreground" /></button>
        </div>
        <div className="overflow-y-auto px-4 pb-6 pt-3 space-y-4" style={{ flex: 1 }}>
          <div className="space-y-1">
            <label className="text-xs text-muted-foreground font-semibold">Empresa (encabezado) *</label>
            <input className={fieldCls} maxLength={150} value={pdfEmpresa} onChange={e => setPdfEmpresa(e.target.value)} />
          </div>
          <div className="flex gap-3">
            <div className="flex-1 space-y-1">
              <label className="text-xs text-muted-foreground font-semibold">Desde</label>
              <input type="date" className={fieldCls} value={pdfDesde} max={hoyMX()} onChange={e => setPdfDesde(e.target.value)} />
            </div>
            <div className="flex-1 space-y-1">
              <label className="text-xs text-muted-foreground font-semibold">Hasta</label>
              <input type="date" className={fieldCls} value={pdfHasta} max={hoyMX()} onChange={e => setPdfHasta(e.target.value)} />
            </div>
          </div>
          <p className="text-xs text-muted-foreground">Cinco bloques de fecha por hoja. Si dos lecturas caen en la misma hora, la segunda va en otro bloque de la misma fecha.</p>
          <Boton type="button" onClick={pdf} cargando={pdfCargando} className="w-full">
            {pdfCargando ? <Loader2 className="w-4 h-4 animate-spin" /> : null} Generar PDF
          </Boton>
        </div>
      </BottomSheet>
    </div>
  )
}
