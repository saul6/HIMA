import { useMemo, useState } from 'react'
import { toast } from 'sonner'
import { AlertTriangle, Check, ChevronDown, FileDown, MoreHorizontal, Pencil } from 'lucide-react'
import { BottomSheet } from '@/app/components/BottomSheet'
import { Boton } from '@/app/components/ui-mady/Boton'
import { TituloSeccion } from '@/app/components/ui-mady/TituloSeccion'
import { FiltroPildoras } from '@/app/components/FiltroPildoras'
import {
  chk, useAccion, useCarga, type Antecedente, type DocVisita, type IncidenciaDoc, type ResultadoVerificacion, type VisitaEnCurso,
} from '@/hooks/useChecklistV2'
import { Aviso, Cargando, Chip, ChipVigencia, ErrorReintentar, PieFormulario, TONOS, textoRegistro } from './comun'
import { SeguimientosLista, etiquetaEstadoIncidencia } from './IncidenciasTab'
import {
  ActualizarDocSheet, ConfirmarDocSheet, IncidenciaDocSheet, MarcarDocSheet, SeguirIncidenciaSheet, type TipoMarca, type TipoSeguimiento,
} from './VisitaSheets'
import { CerrarVisitaSheet } from './CerrarVisitaSheet'
import { fechaCorta, fechaLarga, horaCorta } from './constantes'
import { NOMBRE_SECCION, NOMBRE_SECCION_CORTO } from './secciones'
import { descargarReportePdf } from './pdfVisita'

type Filtro = 'sin_revisar' | 'pendiente' | 'incidencia' | 'no_aplica' | 'revisados'

interface Props {
  visitaId: string
  codigoClave: string
  onCambio: () => void
}

/** Estado de una verificación en texto: nunca "correcto" a secas. */
function etiquetaResultado(r: ResultadoVerificacion | undefined, actualizado?: boolean): string {
  switch (r) {
    case 'correcto': return actualizado ? 'Actualizado y verificado' : 'Verificado sin cambios'
    case 'incidencia': return 'No conforme'
    case 'pendiente': return 'Pendiente de evidencia'
    case 'no_aplica': return 'No aplica en esta visita'
    default: return 'revisado'
  }
}

function textoAntecedente(a: Antecedente | null): string | null {
  if (!a) return null
  if (a.fuente === 'visita') {
    return `Última verificación: ${fechaCorta(a.fecha)}, ${etiquetaResultado(a.resultado, a.actualizado).toLowerCase()}${a.asesor ? `, ${a.asesor}` : ''}`
  }
  return `Checklist anterior: ${(a.estado_anterior ?? 'revisado').replace(/_/g, ' ')}${a.fecha ? ` (${fechaCorta(a.fecha)})` : ''}${a.asesor ? `, ${a.asesor}` : ''}`
}

const COLOR_RESULTADO: Record<ResultadoVerificacion, string | undefined> = {
  correcto: 'var(--agro-success-text)',
  incidencia: 'var(--agro-danger-text)',
  pendiente: 'var(--agro-info-text)',
  no_aplica: undefined,
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
  const abrir = useAccion()
  const organico = useAccion()

  const data = carga.data
  const enCurso = data && 'visita' in data ? data : null

  // La Tabla 3 solo se evalúa con la revisión orgánica activa; las observaciones generales no se evalúan
  const docs = useMemo(() => (enCurso?.documentos ?? []).filter(d => !d.es_nota && d.habilitado), [enCurso])
  const seccionActiva = seccion === 3 && !enCurso?.visita.organico_activo ? 1 : seccion

  const visibles = useMemo(() => docs.filter(d => {
    if (d.seccion !== seccionActiva) return false
    const r = d.verificacion?.resultado
    if (filtro === 'sin_revisar') return !d.verificacion
    if (filtro === 'pendiente') return r === 'pendiente'
    if (filtro === 'incidencia') return r === 'incidencia'
    if (filtro === 'no_aplica') return r === 'no_aplica'
    if (filtro === 'revisados') return r === 'correcto'
    return true
  }), [docs, filtro, seccionActiva])

  const porArea = useMemo(() => {
    const m = new Map<string, DocVisita[]>()
    for (const d of visibles) {
      const k = d.area?.trim() || d.categoria?.trim() || 'Sin área'
      m.set(k, [...(m.get(k) ?? []), d])
    }
    return [...m.entries()]
  }, [visibles])

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
        {puede && <Boton onClick={() => setCerrarAbierto(true)}><Check className="w-4 h-4" /> Cerrar visita</Boton>}
        {!puede && <Aviso>Solo la asesora asignada o un administrador puede capturar esta visita.</Aviso>}
      </div>

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
  const ver = d.verificacion
  const antecedente = textoAntecedente(d.antecedente)
  const registro = textoRegistro(d)
  // Sin revisar = sin color de éxito
  const borde = ver ? COLOR_RESULTADO[ver.resultado] : undefined
  const encabezado = [d.codigo, d.area ?? d.categoria].filter(Boolean).join(' · ')
  const hayAntecedentes = !!(registro || d.antecedentes || antecedente || d.responsable_llenado || d.vence_el || d.relacionados.length > 0)

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

      {hayAntecedentes && (
        <details className="group rounded-lg bg-muted px-2.5 py-1.5 text-xs text-muted-foreground">
          <summary className="cursor-pointer font-semibold flex items-center gap-1 list-none">
            <ChevronDown className="w-3 h-3 transition-transform group-open:rotate-180" aria-hidden="true" /> Antecedentes
          </summary>
          <div className="mt-1.5 space-y-1.5">
            {registro && <p><span className="font-semibold">Último registro documental:</span> {registro}</p>}
            {d.antecedentes && <p className="whitespace-pre-line"><span className="font-semibold">Observación histórica:</span> {d.antecedentes}</p>}
            {antecedente && <p>{antecedente}</p>}
            {(d.revision || d.numeral) && <p>{[d.revision ? `Rev ${d.revision}` : null, d.numeral ? `#${d.numeral}` : null].filter(Boolean).join(' · ')}</p>}
            {d.responsable_llenado && <p>Responsable de llenado: {d.responsable_llenado}</p>}
            {d.vence_el && <p>Vence: {fechaLarga(d.vence_el)}</p>}
            {d.relacionados.length > 0 && (
              <div className="space-y-1">
                <p className="font-semibold">Documentos relacionados (solo consulta)</p>
                {d.relacionados.map(r => (
                  <div key={r.id} className="rounded-md border border-border bg-card px-2 py-1">
                    <p className="text-foreground">{r.nombre}{r.codigo ? ` · ${r.codigo}` : ''} <span className="text-muted-foreground">({r.tipo})</span></p>
                    {r.ultimo_registro && <p>Último registro documental: {r.ultimo_registro}</p>}
                    <p>
                      {r.verificacion_actual
                        ? `En esta visita: ${etiquetaResultado(r.verificacion_actual.resultado)}`
                        : textoAntecedente(r.antecedente) ?? 'Sin verificación previa'}
                    </p>
                  </div>
                ))}
              </div>
            )}
          </div>
        </details>
      )}

      {ver && (
        <div className="text-xs space-y-0.5">
          <p className="font-semibold" style={{ color: COLOR_RESULTADO[ver.resultado] }}>
            {etiquetaResultado(ver.resultado, ver.actualizado)} · por {ver.actor ?? '—'} el {fechaCorta(ver.creado_en)} a las {horaCorta(ver.creado_en)}
          </p>
          {ver.observacion && <p className="text-muted-foreground">{ver.observacion}</p>}
        </div>
      )}

      {d.incidencias.length > 0 && (
        <div className="space-y-2">
          {d.incidencias.map(i => {
            const e = etiquetaEstadoIncidencia(i.estado)
            const sinCerrar = i.estado !== 'cerrada'
            return (
              <div key={i.id} className="rounded-lg border border-border p-2 space-y-1.5">
                <div className="flex items-start justify-between gap-2">
                  <p className="text-xs font-semibold flex items-center gap-1"><AlertTriangle className="w-3 h-3" aria-hidden="true" />{i.nueva ? 'Incidencia nueva' : `Incidencia del ${fechaCorta(i.origen_fecha)}`}</p>
                  <Chip tono={e.tono}>{e.label}</Chip>
                </div>
                <p className="text-xs">{i.descripcion}</p>
                {(i.responsable || i.fecha_compromiso) && (
                  <p className="text-xs text-muted-foreground">{i.responsable ? `Responsable: ${i.responsable}` : ''}{i.fecha_compromiso ? ` · Compromiso: ${fechaLarga(i.fecha_compromiso)}` : ''}</p>
                )}
                <SeguimientosLista items={i.seguimientos} />
                {puede && sinCerrar && !i.nueva && (
                  <div className="flex flex-wrap gap-3 pt-0.5">
                    <button type="button" className="text-xs font-semibold" style={{ color: 'var(--primary)' }} onClick={() => onSeguir(i, 'seguimiento')}>Seguimiento</button>
                    {i.estado === 'correccion_reportada' && (
                      <button type="button" className="text-xs font-semibold" style={{ color: 'var(--primary)' }} onClick={() => onSeguir(i, 'correccion_rechazada')}>Rechazar corrección</button>
                    )}
                    <button type="button" className="text-xs font-semibold" style={{ color: 'var(--primary)' }} onClick={() => onSeguir(i, 'cierre')}>Cerrar</button>
                  </div>
                )}
              </div>
            )
          })}
        </div>
      )}

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
