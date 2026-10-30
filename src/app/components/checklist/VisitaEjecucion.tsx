import { useEffect, useMemo, useState } from 'react'
import { toast } from 'sonner'
import { AlertTriangle, Check, FileDown, MoreHorizontal, Pencil } from 'lucide-react'
import { BottomSheet } from '@/app/components/BottomSheet'
import { Boton } from '@/app/components/ui-mady/Boton'
import { TituloSeccion } from '@/app/components/ui-mady/TituloSeccion'
import { FiltroPildoras } from '@/app/components/FiltroPildoras'
import {
  chk, useAccion, useCarga, type DocVisita, type IncidenciaDoc, type VisitaEnCurso,
} from '@/hooks/useChecklistV2'
import { Aviso, Cargando, Chip, ChipVigencia, ErrorReintentar, PieFormulario, TONOS } from './comun'
import { DetalleDoc } from './DetalleDoc'
import { COLOR_RESULTADO, type FiltroDoc } from './estadoDoc'
import { RevisionEscritorio } from './RevisionEscritorio'
import { useEsEscritorio } from './useEsEscritorio'
import {
  ActualizarDocSheet, ConfirmarDocSheet, IncidenciaDocSheet, MarcarDocSheet, SeguirIncidenciaSheet, type TipoMarca, type TipoSeguimiento,
} from './VisitaSheets'
import { CerrarVisitaSheet } from './CerrarVisitaSheet'
import { fechaLarga } from './constantes'
import { NOMBRE_SECCION, NOMBRE_SECCION_CORTO } from './secciones'
import { descargarReportePdf } from './pdfVisita'

type Filtro = FiltroDoc

const normalizar = (t: string) => t.normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase()

interface Props {
  visitaId: string
  codigoClave: string
  onCambio: () => void
}


export function VisitaEjecucion({ visitaId, codigoClave, onCambio }: Props) {
  const carga = useCarga<Awaited<ReturnType<typeof chk.visVer>>>(visitaId, () => chk.visVer(visitaId))
  const [filtro, setFiltro] = useState<Filtro | null>(null)
  const [confirmar, setConfirmar] = useState<DocVisita | null>(null)
  const [actualizar, setActualizar] = useState<DocVisita | null>(null)
  const [incidencia, setIncidencia] = useState<DocVisita | null>(null)
  const [marcar, setMarcar] = useState<{ doc: DocVisita; tipo: TipoMarca } | null>(null)
  const [seguir, setSeguir] = useState<{ incidencia: IncidenciaDoc; tipo: TipoSeguimiento } | null>(null)
  const [cerrarAbierto, setCerrarAbierto] = useState(false)
  const [seccion, setSeccion] = useState(1)
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
  const seccionActiva = seccion === 3 && !enCurso?.visita.organico_activo ? 1 : seccion

  const visibles = useMemo(() => docs.filter(d => {
    if (d.seccion !== seccionActiva) return false
    const q = normalizar(busqueda.trim())
    if (q && !normalizar(`${d.nombre} ${d.codigo ?? ''}`).includes(q)) return false
    const r = d.verificacion?.resultado
    if (filtro === 'sin_revisar') return !d.verificacion
    if (filtro === 'pendiente') return r === 'pendiente'
    if (filtro === 'incidencia') return r === 'incidencia'
    if (filtro === 'no_aplica') return r === 'no_aplica'
    if (filtro === 'revisados') return r === 'correcto'
    return true
  }), [docs, filtro, seccionActiva, busqueda])

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

  function recargar() { void carga.recargar(); onCambio() }

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
          <Boton tamano="sm" variante="secundario" cargando={pdf} onClick={bajarPdf}><FileDown className="w-4 h-4" /> Descargar PDF</Boton>
        </div>
        <Aviso>Visita cerrada: el reporte no se puede modificar.</Aviso>
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
  const conteo = (n: number) => { const x = secciones[String(n)]; return x ? `${x.aplicables - x.sin_revisar}/${x.aplicables}` : '0/0' }
  // Avances orgánicos guardados como borrador (si la sección está apagada no vienen como habilitados)
  const avancesOrganicos = v.documentos.filter(d => d.seccion === 3 && !!d.verificacion).length
  const notasVisibles = v.notas.filter(n => n.antecedentes && (n.seccion !== 3 || visita.organico_activo))

  async function cambiarOrganico(activo: boolean) {
    const r = await organico.ejecutar(eventId => chk.visOrganico({ visita: visitaId, activo, eventId }))
    if (!r.ok) { toast.error(r.mensaje); return }
    setApagarOrganico(null)
    setSeccion(activo ? 3 : 1)
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
          <label className="flex items-start gap-2 rounded-lg border border-border px-3 py-2 text-sm cursor-pointer">
            <input type="checkbox" className="mt-1" checked={visita.organico_activo} disabled={organico.ocupado} onChange={alternarOrganico} />
            <span>
              <span className="font-semibold">Incluir revisión orgánica en esta visita</span>
              <span className="block text-xs text-muted-foreground">Apagada, la Tabla 3 no se evalúa ni cuenta en el reporte.</span>
            </span>
          </label>
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
          <Chip tono={resumen?.vencidos ? TONOS.peligro : TONOS.neutro}>{resumen?.vencidos ?? 0} vencidos</Chip>
        </div>
        {puede && !esEscritorio && <Boton onClick={() => setCerrarAbierto(true)}><Check className="w-4 h-4" /> Cerrar visita</Boton>}
        {!puede && <Aviso>Solo la asesora asignada o un administrador puede capturar esta visita.</Aviso>}
      </div>

      {esEscritorio ? (
        <RevisionEscritorio
          pestanas={[1, 2, 3].filter(n => n !== 3 || visita.tiene_plantilla_organica).map(n => {
            const apagada = n === 3 && !visita.organico_activo
            return { n, etiqueta: NOMBRE_SECCION[n], conteo: conteo(n), deshabilitada: apagada, titulo: apagada ? 'La revisión orgánica está fuera de esta visita. Enciéndela para evaluar la Tabla 3.' : undefined }
          })}
          seccionActiva={seccionActiva}
          onSeccion={n => { setSeccion(n); setFiltro(null) }}
          filtro={filtro}
          onFiltro={setFiltro}
          busqueda={busqueda}
          onBusqueda={setBusqueda}
          porArea={porArea}
          seleccionado={docSel}
          onSeleccionar={setSeleccionId}
          onSiguiente={siguienteSinRevisar}
          notas={notasVisibles}
          puede={puede}
          onCerrar={() => setCerrarAbierto(true)}
          onConfirmar={setConfirmar}
          onActualizar={setActualizar}
          onMarcar={(doc, tipo) => setMarcar({ doc, tipo })}
          onIncidencia={setIncidencia}
          onSeguir={(inc, tipo) => setSeguir({ incidencia: inc, tipo })}
        />
      ) : (
        <>
        <FiltroPildoras<string>
          groupId="chk-visita-seccion"
          value={String(seccionActiva)}
          onChange={n => { setSeccion(Number(n)); setFiltro(null) }}
          options={[1, 2, ...(visita.organico_activo ? [3] : [])].map(n => ({ value: String(n), label: <>{NOMBRE_SECCION[n]} · {conteo(n)}</> }))}
        />

        {notasVisibles.length > 0 && (
          <details className="rounded-xl border border-border bg-card p-3">
            <summary className="text-sm font-semibold cursor-pointer">Observaciones de visitas anteriores · {notasVisibles.length}</summary>
            <div className="mt-2 space-y-2">
              {notasVisibles.map(n => (
                <div key={n.id}>
                  <p className="text-xs text-muted-foreground">
                    {NOMBRE_SECCION_CORTO[n.seccion]}{n.atribucion === 'compartido_por_confirmar' ? ' · Antecedente compartido — atribución por confirmar' : ''}
                  </p>
                  <p className="text-sm whitespace-pre-line">{n.antecedentes}</p>
                </div>
              ))}
            </div>
          </details>
        )}

        <FiltroPildoras<string>
          groupId="chk-visita-filtro"
          value={filtro ?? ''}
          onChange={f => setFiltro(filtro === f ? null : (f as Filtro))}
          options={[
            { value: 'sin_revisar', label: 'Sin revisar' },
            { value: 'pendiente', label: 'Pendientes' },
            { value: 'incidencia', label: 'Con incidencia' },
            { value: 'no_aplica', label: 'No aplica' },
            { value: 'revisados', label: 'Revisados' },
          ]}
        />

        {visibles.length === 0 ? (
          <p className="text-sm text-muted-foreground text-center py-10">{filtro ? 'Nada coincide con este filtro.' : 'No hay documentos en esta sección.'}</p>
        ) : porArea.map(([area, lista]) => (
          <section key={area} className="space-y-2">
            <TituloSeccion as="h2" className="mb-0">{area} · {lista.length}</TituloSeccion>
            <div className="grid gap-3 grid-cols-1 xl:grid-cols-2">
              {lista.map(d => (
                <TarjetaDoc
                  key={d.id}
                  doc={d}
                  puede={puede}
                  onConfirmar={() => setConfirmar(d)}
                  onActualizar={() => setActualizar(d)}
                  onMarcar={tipo => setMarcar({ doc: d, tipo })}
                  onIncidencia={() => setIncidencia(d)}
                  onSeguir={(inc, tipo) => setSeguir({ incidencia: inc, tipo })}
                />
              ))}
            </div>
          </section>
        ))}
        </>
      )}

      <ConfirmarDocSheet doc={confirmar} visitaId={visitaId} onClose={() => setConfirmar(null)} onGuardado={recargar} />
      <ActualizarDocSheet doc={actualizar} visitaId={visitaId} onClose={() => setActualizar(null)} onGuardado={recargar} />
      <MarcarDocSheet objetivo={marcar} visitaId={visitaId} onClose={() => setMarcar(null)} onGuardado={recargar} />
      <IncidenciaDocSheet doc={incidencia} visitaId={visitaId} onClose={() => setIncidencia(null)} onGuardado={recargar} />
      <SeguirIncidenciaSheet objetivo={seguir} visitaId={visitaId} onClose={() => setSeguir(null)} onGuardado={recargar} />
      <CerrarVisitaSheet open={cerrarAbierto} visitaId={visitaId} onClose={() => setCerrarAbierto(false)} onCerrada={recargar} />
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

function TarjetaDoc({ doc: d, puede, onConfirmar, onActualizar, onMarcar, onIncidencia, onSeguir }: {
  doc: DocVisita; puede: boolean
  onConfirmar: () => void; onActualizar: () => void; onMarcar: (t: TipoMarca) => void; onIncidencia: () => void
  onSeguir: (inc: IncidenciaDoc, tipo: TipoSeguimiento) => void
}) {
  // Sin revisar = sin color de éxito
  const borde = d.verificacion ? COLOR_RESULTADO[d.verificacion.resultado] : undefined
  const encabezado = [d.codigo, d.area ?? d.categoria].filter(Boolean).join(' · ')

  return (
    <div className="rounded-xl border border-border bg-card p-3 space-y-2.5" style={borde ? { borderColor: borde } : undefined}>
      <div className="flex items-start justify-between gap-2">
        <div className="min-w-0">
          <p className="text-sm font-semibold">{d.nombre}</p>
          {encabezado && <p className="text-xs text-muted-foreground">{encabezado}</p>}
          {d.atribucion === 'compartido_por_confirmar' && (
            <p className="text-xs mt-0.5" style={{ color: 'var(--agro-info-text)' }}>Antecedente compartido — atribución por confirmar</p>
          )}
        </div>
        <ChipVigencia vigencia={d.vigencia} />
      </div>

      <DetalleDoc doc={d} puede={puede} onSeguir={onSeguir} />

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
