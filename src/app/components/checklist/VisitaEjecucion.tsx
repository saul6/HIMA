import { useEffect, useMemo, useState } from 'react'
import { toast } from 'sonner'
import { AlertTriangle, Check, FileDown, MoreHorizontal, Pencil } from 'lucide-react'
import { BottomSheet } from '@/app/components/BottomSheet'
import { Boton } from '@/app/components/ui-mady/Boton'
import { TituloSeccion } from '@/app/components/ui-mady/TituloSeccion'
import {
  chk, mensajeError, useAccion, useCarga, type DocVisita, type IncidenciaDoc, type Omision, type VisitaEnCurso,
} from '@/hooks/useChecklistV2'
import { Aviso, Cargando, CLASE_INPUT, Chip, ErrorReintentar, PieFormulario, TONOS } from './comun'
import { DetalleDoc } from './DetalleDoc'
import { COLOR_RESULTADO } from './estadoDoc'
import { InterruptorOrganico } from './InterruptorOrganico'
import { RevisionEscritorio } from './RevisionEscritorio'
import { useEsEscritorio } from './useEsEscritorio'
import {
  ActualizarDocSheet, ConfirmarDocSheet, IncidenciaDocSheet, MarcarDocSheet, SeguirIncidenciaSheet, type TipoMarca, type TipoSeguimiento,
} from './VisitaSheets'
import { FilaControl } from './FilaControl'
import { IndicadorEtapas, PieEtapas, type Etapa } from './EtapasVisita'
import { ResumenCierre } from './ResumenCierre'
import { fechaLarga } from './constantes'
import { NOMBRE_SECCION_CORTO } from './secciones'
import { descargarReportePdf } from './pdfVisita'

const normalizar = (t: string) => t.normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase()

interface Props {
  visitaId: string
  codigoClave: string
  onCambio: () => void
}


export function VisitaEjecucion({ visitaId, codigoClave, onCambio }: Props) {
  const carga = useCarga<Awaited<ReturnType<typeof chk.visVer>>>(visitaId, () => chk.visVer(visitaId))
  const omis = useCarga<Omision[]>(visitaId, () => chk.visOmisiones(visitaId))
  const [etapa, setEtapa] = useState<Etapa>(1)
  const [alertas, setAlertas] = useState<Record<string, Omision['falta']>>({})
  const [foco, setFoco] = useState<{ id: string; falta: Omision['falta'] | null; n: number } | null>(null)
  const [verificando, setVerificando] = useState(false)
  const [confirmar, setConfirmar] = useState<DocVisita | null>(null)
  const [actualizar, setActualizar] = useState<DocVisita | null>(null)
  const [incidencia, setIncidencia] = useState<DocVisita | null>(null)
  const [marcar, setMarcar] = useState<{ doc: DocVisita; tipo: TipoMarca } | null>(null)
  const [seguir, setSeguir] = useState<{ incidencia: IncidenciaDoc; tipo: TipoSeguimiento } | null>(null)
  const [apagarOrganico, setApagarOrganico] = useState<number | null>(null)
  const [pdf, setPdf] = useState(false)
  const esEscritorio = useEsEscritorio()
  const [seleccionId, setSeleccionId] = useState<string | null>(null)
  const [busqueda, setBusqueda] = useState('')
  const abrir = useAccion()
  const organico = useAccion()

  const data = carga.data
  const enCurso = data && 'visita' in data ? data : null

  // La Tabla 3 solo se evalúa con la revisión orgánica activa; las observaciones generales no se evalúan
  const docs = useMemo(() => (enCurso?.documentos ?? []).filter(d => !d.es_nota && d.habilitado), [enCurso])
  const visitaCurso = enCurso?.visita
  const etapas = useMemo<Etapa[]>(() => {
    const hay = (n: number) => docs.some(d => d.seccion === n)
    return [
      ...(hay(1) ? [1 as const] : []), ...(hay(2) ? [2 as const] : []),
      ...(visitaCurso?.tiene_plantilla_organica && visitaCurso.organico_activo ? [3 as const] : []),
      'resumen' as const,
    ]
  }, [docs, visitaCurso])
  // Si la etapa actual ya no existe (p. ej. se apagó lo orgánico) se pasa a la siguiente que exista
  const pesoEtapa = (e: Etapa) => (e === 'resumen' ? 4 : e)
  const etapaActiva: Etapa = etapas.includes(etapa) ? etapa : (etapas.find(e => pesoEtapa(e) > pesoEtapa(etapa)) ?? 'resumen')
  const seccionActiva = etapaActiva === 'resumen' ? 0 : etapaActiva

  const visibles = useMemo(() => docs.filter(d => {
    if (d.seccion !== seccionActiva) return false
    const q = normalizar(busqueda.trim())
    return !q || normalizar(`${d.nombre} ${d.codigo ?? ''}`).includes(q)
  }), [docs, seccionActiva, busqueda])

  const porArea = useMemo(() => {
    const m = new Map<string, DocVisita[]>()
    for (const d of visibles) {
      const k = d.area?.trim() || d.categoria?.trim() || 'Sin área'
      m.set(k, [...(m.get(k) ?? []), d])
    }
    return [...m.entries()]
  }, [visibles])

  // Escritorio: documento en revisión. Por omisión, el primero sin revisar de la sección; después conserva la selección.
  const docSel = useMemo(
    () => {
      const orden = porArea.flatMap(([, l]) => l)
      return orden.find(d => d.id === seleccionId) ?? orden.find(d => !d.verificacion) ?? orden[0] ?? null
    },
    [porArea, seleccionId],
  )
  useEffect(() => {
    if (esEscritorio && docSel && docSel.id !== seleccionId) setSeleccionId(docSel.id)
  }, [esEscritorio, docSel, seleccionId])

  function siguienteSinRevisar() {
    const orden = porArea.flatMap(([, l]) => l)
    const i = orden.findIndex(d => d.id === docSel?.id)
    const siguiente = [...orden.slice(i + 1), ...orden.slice(0, Math.max(i, 0))].find(d => !d.verificacion)
    if (siguiente) setSeleccionId(siguiente.id)
    else toast.info('No quedan documentos sin revisar en esta vista')
  }

  function recargar() { setAlertas({}); void carga.recargar(); void omis.recargar(); onCambio() }

  const textoFalta = (f: Omision['falta']) => (f === 'estado' ? 'el estado' : 'la observación')

  /** Lleva a la etapa y al registro; con `falta` además lo marca y avisa. */
  function irA(seccion: number, id: string, falta: Omision['falta'] | null) {
    setBusqueda('')
    setEtapa(seccion as Etapa)
    setSeleccionId(id)
    if (falta) {
      setAlertas(a => ({ ...a, [id]: falta }))
      toast.warning(`Revisa este registro: falta ${textoFalta(falta)}`)
    }
    setFoco({ id, falta, n: Date.now() })
  }

  useEffect(() => {
    if (!foco) return
    const raf = requestAnimationFrame(() => {
      const el = document.querySelector<HTMLElement>(`[data-doc-id="${foco.id}"]`)
      if (!el) return
      el.scrollIntoView({ block: 'center', behavior: 'smooth' })
      const objetivo = (foco.falta === 'observaciones' && el.querySelector<HTMLElement>('textarea')) || el.querySelector<HTMLElement>('[data-foco], textarea, button') || el
      objetivo.focus({ preventScroll: true })
    })
    return () => cancelAnimationFrame(raf)
  }, [foco, etapaActiva])

  async function siguiente() {
    setVerificando(true)
    try {
      const lista = await chk.visOmisiones(visitaId)
      omis.setData(lista)
      const propia = lista.find(o => o.seccion === seccionActiva)
      if (propia) { irA(propia.seccion, propia.documento_id, propia.falta); return }
      const i = etapas.indexOf(etapaActiva)
      setBusqueda('')
      setEtapa(etapas[Math.min(i + 1, etapas.length - 1)])
    } catch (e) { toast.error(mensajeError(e)) } finally { setVerificando(false) }
  }
  function anterior() {
    const i = etapas.indexOf(etapaActiva)
    if (i > 0) { setBusqueda(''); setEtapa(etapas[i - 1]) }
  }

  if (carga.loading && !data) return <Cargando />
  if (carga.error || !data) return <ErrorReintentar mensaje={carga.error ?? 'No se pudo cargar la visita'} onReintentar={carga.recargar} />

  async function bajarPdf() {
    setPdf(true)
    try { await descargarReportePdf({ id: visitaId, estado: 'cerrada' }, codigoClave) } catch (e) { console.error(e); toast.error('No se pudo generar el PDF') } finally { setPdf(false) }
  }

  // Visita cerrada: solo lectura (snapshot)
  if ('reporte' in data) {
    const r = data.reporte
    return (
      <div className="space-y-4">
        <div className="rounded-xl border border-border bg-card p-4 space-y-2">
          <p className="text-sm font-semibold">{[r.cliente, r.instalacion, r.alcance].filter(Boolean).join(' · ')}</p>
          <p className="text-xs text-muted-foreground">Visita del {fechaLarga(r.visita.fecha)} · {r.visita.asesor ?? ''} · cierre {r.visita.tipo_cierre}</p>
          <div className="flex flex-wrap gap-1.5">
            <Chip tono={TONOS.exito}>{r.resumen.correctos} verificados</Chip>
            <Chip tono={r.resumen.con_incidencia ? TONOS.peligro : TONOS.neutro}>{r.resumen.con_incidencia} no conformes</Chip>
            {!!r.resumen.pendientes && <Chip tono={TONOS.info}>{r.resumen.pendientes} pendientes</Chip>}
            {!!r.resumen.no_aplica && <Chip>{r.resumen.no_aplica} no aplica</Chip>}
            <Chip>{r.resumen.sin_revisar} sin revisar</Chip>
          </div>
          {r.organico && !r.organico.activo && r.organico.leyenda && <p className="text-xs text-muted-foreground">{r.organico.leyenda}</p>}
        </div>
        <Aviso>Visita cerrada: el reporte no se puede modificar.</Aviso>
        <PieTrazabilidad pdf={{ cargando: pdf, onClick: bajarPdf }} />
      </div>
    )
  }

  const v = data as VisitaEnCurso
  const { visita, resumen } = v
  const puede = visita.puede_capturar

  if (visita.estado === 'programada') {
    return (
      <div className="rounded-xl border border-border bg-card p-4 space-y-3">
        <p className="text-sm font-semibold">{[v.cliente, v.instalacion.nombre, visita.alcance].filter(Boolean).join(' · ')}</p>
        <p className="text-xs text-muted-foreground">Visita programada para el {fechaLarga(visita.fecha)}{visita.asesor ? ` · ${visita.asesor}` : ''}. Todos los documentos arrancan sin revisar.</p>
        <Boton cargando={abrir.ocupado} onClick={async () => {
          const r = await abrir.ejecutar(eventId => chk.visAbrir(visitaId, eventId))
          if (!r.ok) { toast.error(r.mensaje); return }
          recargar()
        }}>Abrir visita</Boton>
      </div>
    )
  }
  if (visita.estado !== 'en_curso') return <Aviso>Esta visita está {visita.estado}.</Aviso>

  const aplicables = resumen?.aplicables ?? docs.length
  const hechos = aplicables - (resumen?.sin_revisar ?? aplicables)
  const pct = aplicables ? Math.round((hechos / aplicables) * 100) : 0
  const secciones = v.secciones ?? {}
  const progresoDe = (n: number) => { const x = secciones[String(n)]; return x ? `${x.aplicables - x.sin_revisar} de ${x.aplicables} revisados` : null }
  // Avances orgánicos guardados como borrador (si la sección está apagada no vienen como habilitados)
  const avancesOrganicos = v.documentos.filter(d => d.seccion === 3 && !!d.verificacion).length
  const notasVisibles = v.notas.filter(n => n.antecedentes && (n.seccion !== 3 || visita.organico_activo))
  const notasEtapa = notasVisibles.filter(n => n.seccion === seccionActiva)

  async function cambiarOrganico(activo: boolean) {
    const r = await organico.ejecutar(eventId => chk.visOrganico({ visita: visitaId, activo, eventId }))
    if (!r.ok) { toast.error(r.mensaje); return }
    setApagarOrganico(null)
    setEtapa(prev => (activo ? 3 : prev === 3 ? 'resumen' : prev))
    toast.success(activo ? 'Revisión orgánica incluida en esta visita' : 'Revisión orgánica fuera de esta visita')
    recargar()
  }
  function alternarOrganico() {
    if (!visita.organico_activo) { void cambiarOrganico(true); return }
    // Antes de apagar con avances se pide confirmación
    if (avancesOrganicos > 0) setApagarOrganico(avancesOrganicos)
    else void cambiarOrganico(false)
  }

  return (
    <div className="space-y-4">
      <div className="rounded-xl border border-border bg-card p-4 space-y-3">
        <div>
          <p className="text-sm font-semibold">{[v.cliente, v.instalacion.nombre, visita.alcance].filter(Boolean).join(' · ')}</p>
          <p className="text-xs text-muted-foreground">{fechaLarga(visita.fecha)}{visita.asesor ? ` · ${visita.asesor}` : ''}</p>
        </div>

        {visita.tiene_plantilla_organica && puede && (
          <InterruptorOrganico
            checked={visita.organico_activo}
            disabled={organico.ocupado}
            onChange={alternarOrganico}
            titulo="Incluir revisión orgánica en esta visita"
            ayuda="Apagada, la Tabla 3 no se evalúa ni cuenta en el reporte."
          />
        )}
        {visita.tiene_plantilla_organica && !visita.organico_activo && (
          <p className="text-xs text-muted-foreground">La revisión orgánica quedó fuera del alcance de esta visita.</p>
        )}

        <div className="space-y-1">
          <div className="flex justify-between text-xs">
            <span className="font-semibold">{hechos} de {aplicables} revisados</span>
            <span className="text-muted-foreground">{pct}%</span>
          </div>
          <div className="h-2 rounded-full bg-muted overflow-hidden" role="progressbar" aria-valuenow={pct} aria-valuemin={0} aria-valuemax={100}>
            <div className="h-full rounded-full" style={{ width: `${pct}%`, backgroundColor: 'var(--primary)' }} />
          </div>
        </div>
        <div className="flex flex-wrap gap-1.5">
          <Chip>{resumen?.sin_revisar ?? 0} sin revisar</Chip>
          <Chip tono={TONOS.info}>{resumen?.actualizados ?? 0} actualizados</Chip>
          {!!resumen?.pendientes && <Chip tono={TONOS.info}>{resumen.pendientes} pendientes</Chip>}
          {!!resumen?.no_aplica && <Chip>{resumen.no_aplica} no aplica</Chip>}
        </div>
        {!puede && <Aviso>Solo la asesora asignada o un administrador puede capturar esta visita.</Aviso>}
      </div>

      <IndicadorEtapas
        etapas={etapas}
        actual={etapaActiva}
        progreso={etapaActiva === 'resumen' ? `${hechos} de ${aplicables} revisados` : progresoDe(etapaActiva)}
        onVerResumen={() => setEtapa('resumen')}
      />

      {etapaActiva === 'resumen' ? (
        <ResumenCierre
          visitaId={visitaId}
          codigoClave={codigoClave}
          docs={docs}
          omisiones={omis.data ?? []}
          puede={puede}
          onIrADoc={(sec, id) => { const o = (omis.data ?? []).find(x => x.documento_id === id); irA(sec, id, o?.falta ?? null) }}
          onCerrada={onCambio}
          onRecargar={recargar}
        />
      ) : (
        <>
          {seccionActiva === 1 && esEscritorio ? (
            <RevisionEscritorio
              seccionActiva={seccionActiva}
              busqueda={busqueda}
              onBusqueda={setBusqueda}
              porArea={porArea}
              seleccionado={docSel}
              onSeleccionar={setSeleccionId}
              onSiguiente={siguienteSinRevisar}
              notas={notasVisibles}
              puede={puede}
              falta={docSel && alertas[docSel.id] ? textoFalta(alertas[docSel.id]) : null}
              onConfirmar={setConfirmar}
              onActualizar={setActualizar}
              onMarcar={(doc, tipo) => setMarcar({ doc, tipo })}
              onIncidencia={setIncidencia}
              onSeguir={(inc, tipo) => setSeguir({ incidencia: inc, tipo })}
            />
          ) : (
            <>
              {notasEtapa.length > 0 && (
                <div className="rounded-lg border-l-4 px-3 py-2 text-xs space-y-1.5" style={{ borderLeftColor: 'var(--agro-blue)', backgroundColor: 'var(--agro-info-fill)', color: 'var(--agro-info-text)' }}>
                  <p className="font-semibold">Antecedente general · no se evalúa</p>
                  {notasEtapa.map(n => (
                    <p key={n.id} className="whitespace-pre-line">
                      {n.atribucion === 'compartido_por_confirmar' && <span className="font-semibold">Atribución por confirmar. </span>}
                      {n.antecedentes}
                    </p>
                  ))}
                </div>
              )}

              <input
                type="search"
                className={CLASE_INPUT}
                placeholder="Buscar nombre o código…"
                aria-label="Buscar documento por nombre o código"
                value={busqueda}
                onChange={e => setBusqueda(e.target.value)}
              />

              {visibles.length === 0 ? (
                <p className="text-sm text-muted-foreground text-center py-10">{busqueda ? 'Nada coincide con la búsqueda.' : 'No hay documentos en esta sección.'}</p>
              ) : porArea.map(([area, lista]) => (
                <section key={area} className="space-y-2">
                  <TituloSeccion as="h2" className="mb-0">{area} · {lista.length}</TituloSeccion>
                  <div className={seccionActiva === 1 ? 'grid gap-3 grid-cols-1 xl:grid-cols-2' : 'space-y-3'}>
                    {lista.map(d => seccionActiva === 1 ? (
                      <TarjetaDoc
                        key={d.id}
                        doc={d}
                        puede={puede}
                        falta={alertas[d.id] ? textoFalta(alertas[d.id]) : null}
                        onConfirmar={() => setConfirmar(d)}
                        onActualizar={() => setActualizar(d)}
                        onMarcar={tipo => setMarcar({ doc: d, tipo })}
                        onIncidencia={() => setIncidencia(d)}
                        onSeguir={(inc, tipo) => setSeguir({ incidencia: inc, tipo })}
                      />
                    ) : (
                      <FilaControl
                        key={d.id}
                        doc={d}
                        visitaId={visitaId}
                        puede={puede}
                        falta={alertas[d.id] ?? null}
                        onGuardado={recargar}
                        onSeguir={(inc, tipo) => setSeguir({ incidencia: inc, tipo })}
                      />
                    ))}
                  </div>
                </section>
              ))}
            </>
          )}
        </>
      )}

      <PieEtapas
        puedeAnterior={etapas.indexOf(etapaActiva) > 0}
        mostrarSiguiente={etapaActiva !== 'resumen'}
        verificando={verificando}
        onAnterior={anterior}
        onSiguiente={siguiente}
      />

      <PieTrazabilidad />

      <ConfirmarDocSheet doc={confirmar} visitaId={visitaId} onClose={() => setConfirmar(null)} onGuardado={recargar} />
      <ActualizarDocSheet doc={actualizar} visitaId={visitaId} onClose={() => setActualizar(null)} onGuardado={recargar} />
      <MarcarDocSheet objetivo={marcar} visitaId={visitaId} onClose={() => setMarcar(null)} onGuardado={recargar} />
      <IncidenciaDocSheet doc={incidencia} visitaId={visitaId} onClose={() => setIncidencia(null)} onGuardado={recargar} />
      <SeguirIncidenciaSheet objetivo={seguir} visitaId={visitaId} onClose={() => setSeguir(null)} onGuardado={recargar} />
      <BottomSheet open={apagarOrganico !== null} onClose={() => setApagarOrganico(null)} title="Apagar revisión orgánica">
        {apagarOrganico !== null && (
          <>
            <div className="px-4 py-4 text-sm text-muted-foreground">
              Se conservarán {apagarOrganico} {apagarOrganico === 1 ? 'revisión' : 'revisiones'} como borrador y no contarán en el reporte.
              Si vuelves a encender la revisión orgánica, se recuperan.
            </div>
            <PieFormulario onCancelar={() => setApagarOrganico(null)} onGuardar={() => cambiarOrganico(false)} textoGuardar="Apagar" cargando={organico.ocupado} />
          </>
        )}
      </BottomSheet>
    </div>
  )
}

function TarjetaDoc({ doc: d, puede, falta, onConfirmar, onActualizar, onMarcar, onIncidencia, onSeguir }: {
  doc: DocVisita; puede: boolean; falta: string | null
  onConfirmar: () => void; onActualizar: () => void; onMarcar: (t: TipoMarca) => void; onIncidencia: () => void
  onSeguir: (inc: IncidenciaDoc, tipo: TipoSeguimiento) => void
}) {
  // Sin revisar = sin color de éxito
  const borde = d.verificacion ? COLOR_RESULTADO[d.verificacion.resultado] : undefined
  const encabezado = [d.codigo, d.area ?? d.categoria].filter(Boolean).join(' · ')

  return (
    <div data-doc-id={d.id} className="rounded-xl border border-border bg-card p-3 space-y-2.5" style={falta ? { borderColor: 'var(--agro-danger-text)' } : borde ? { borderColor: borde } : undefined}>
      <div className="flex items-start justify-between gap-2">
        <div className="min-w-0">
          <p className="text-sm font-semibold">{d.nombre}</p>
          {encabezado && <p className="text-xs text-muted-foreground">{encabezado}</p>}
          {d.atribucion === 'compartido_por_confirmar' && (
            <p className="text-xs mt-0.5" style={{ color: 'var(--agro-info-text)' }}>Antecedente compartido — atribución por confirmar</p>
          )}
        </div>
      </div>

      <DetalleDoc doc={d} puede={puede} onSeguir={onSeguir} />
      {falta && <p role="alert" className="text-xs font-semibold" style={{ color: 'var(--agro-danger-text)' }}>Revisa este registro: falta {falta}</p>}

      {puede && (
        <div className="flex flex-wrap items-center gap-2 pt-0.5">
          <Boton tamano="sm" variante="secundario" onClick={onConfirmar}><Check className="w-4 h-4" /> Verificar</Boton>
          <Boton tamano="sm" variante="secundario" onClick={onActualizar}><Pencil className="w-4 h-4" /> Actualizar</Boton>
          <Boton tamano="sm" variante="secundario" onClick={() => onMarcar('pendiente')}>Pendiente</Boton>
          <Boton tamano="sm" variante="secundario" onClick={() => onMarcar('no_aplica')}>No aplica</Boton>
          <details className="relative">
            <summary className="list-none cursor-pointer rounded-lg border border-border px-2 py-1.5 text-muted-foreground" aria-label="Más acciones">
              <MoreHorizontal className="w-4 h-4" aria-hidden="true" />
            </summary>
            <div className="absolute z-10 mt-1 right-0 rounded-lg border border-border bg-card p-1 min-w-40">
              <button type="button" className="flex w-full items-center gap-2 rounded-md px-2 py-1.5 text-sm text-left hover:bg-muted" onClick={onIncidencia}>
                <AlertTriangle className="w-4 h-4" aria-hidden="true" /> Registrar incidencia
              </button>
            </div>
          </details>
        </div>
      )}
    </div>
  )
}

function PieTrazabilidad({ pdf }: { pdf?: { cargando: boolean; onClick: () => void } }) {
  return (
    <div className="rounded-xl border border-border bg-card p-4 flex flex-wrap items-center justify-between gap-3">
      <div>
        <p className="text-sm font-semibold">Trazabilidad de la visita</p>
        <p className="text-xs text-muted-foreground">Cada acción queda registrada con quién, cuándo y qué cambió.</p>
      </div>
      {pdf && <Boton tamano="sm" variante="secundario" cargando={pdf.cargando} onClick={pdf.onClick}><FileDown className="w-4 h-4" /> Descargar reporte PDF</Boton>}
    </div>
  )
}
