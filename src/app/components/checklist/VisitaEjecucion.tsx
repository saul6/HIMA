import { useMemo, useState } from 'react'
import { toast } from 'sonner'
import { AlertTriangle, Check, FileDown, Pencil } from 'lucide-react'
import { Boton } from '@/app/components/ui-mady/Boton'
import { TituloSeccion } from '@/app/components/ui-mady/TituloSeccion'
import { FiltroPildoras } from '@/app/components/FiltroPildoras'
import { chk, useAccion, useCarga, type Antecedente, type DocVisita, type IncidenciaDoc, type VisitaEnCurso } from '@/hooks/useChecklistV2'
import { Aviso, Cargando, Chip, ChipVigencia, ErrorReintentar, TONOS, textoRegistro } from './comun'
import { SeguimientosLista, etiquetaEstadoIncidencia } from './IncidenciasTab'
import {
  ActualizarDocSheet, ConfirmarDocSheet, IncidenciaDocSheet, SeguirIncidenciaSheet, type TipoSeguimiento,
} from './VisitaSheets'
import { CerrarVisitaSheet } from './CerrarVisitaSheet'
import { fechaCorta, fechaLarga, horaCorta } from './constantes'
import { descargarReportePdf } from './pdfVisita'

type Filtro = 'sin_revisar' | 'revisados' | 'incidencia'

interface Props {
  visitaId: string
  codigoClave: string
  onCambio: () => void
}

function textoAntecedente(a: Antecedente | null): string | null {
  if (!a) return null
  if (a.fuente === 'visita') {
    return `Última revisión: ${fechaCorta(a.fecha)}, ${a.resultado === 'incidencia' ? 'con incidencia' : 'correcto'}${a.actualizado ? ' (actualizado)' : ''}${a.asesor ? `, ${a.asesor}` : ''}`
  }
  return `Checklist anterior: ${(a.estado_anterior ?? 'revisado').replace(/_/g, ' ')}${a.fecha ? ` (${fechaCorta(a.fecha)})` : ''}${a.asesor ? `, ${a.asesor}` : ''}`
}

export function VisitaEjecucion({ visitaId, codigoClave, onCambio }: Props) {
  const carga = useCarga<Awaited<ReturnType<typeof chk.visVer>>>(visitaId, () => chk.visVer(visitaId))
  const [filtro, setFiltro] = useState<Filtro | null>(null)
  const [confirmar, setConfirmar] = useState<DocVisita | null>(null)
  const [actualizar, setActualizar] = useState<DocVisita | null>(null)
  const [incidencia, setIncidencia] = useState<DocVisita | null>(null)
  const [seguir, setSeguir] = useState<{ incidencia: IncidenciaDoc; tipo: TipoSeguimiento } | null>(null)
  const [cerrarAbierto, setCerrarAbierto] = useState(false)
  const [pdf, setPdf] = useState(false)
  const abrir = useAccion()

  const data = carga.data
  const enCurso = data && 'visita' in data ? data : null

  const docs = enCurso?.documentos ?? []
  const visibles = useMemo(() => docs.filter(d => {
    if (filtro === 'sin_revisar') return !d.verificacion
    if (filtro === 'revisados') return !!d.verificacion
    if (filtro === 'incidencia') return d.verificacion?.resultado === 'incidencia'
    return true
  }), [docs, filtro])

  const porArea = useMemo(() => {
    const m = new Map<string, DocVisita[]>()
    for (const d of visibles) {
      const k = d.area?.trim() || 'Sin área'
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
          <p className="text-sm font-semibold">{r.cliente} · {r.instalacion}</p>
          <p className="text-xs text-muted-foreground">Visita del {fechaLarga(r.visita.fecha)} · {r.visita.asesor ?? ''} · cierre {r.visita.tipo_cierre}</p>
          <div className="flex flex-wrap gap-1.5">
            <Chip tono={TONOS.exito}>{r.resumen.correctos} correctos</Chip>
            <Chip tono={r.resumen.con_incidencia ? TONOS.peligro : TONOS.neutro}>{r.resumen.con_incidencia} con incidencia</Chip>
            <Chip>{r.resumen.sin_revisar} sin revisar</Chip>
          </div>
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
        <p className="text-sm font-semibold">{v.cliente} · {v.instalacion.nombre}</p>
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
  const hechos = (resumen?.correctos ?? 0) + (resumen?.con_incidencia ?? 0)
  const pct = aplicables ? Math.round((hechos / aplicables) * 100) : 0

  return (
    <div className="space-y-4">
      <div className="rounded-xl border border-border bg-card p-4 space-y-3">
        <div>
          <p className="text-sm font-semibold">{v.cliente} · {v.instalacion.nombre}</p>
          <p className="text-xs text-muted-foreground">{fechaLarga(visita.fecha)}{visita.asesor ? ` · ${visita.asesor}` : ''}</p>
        </div>
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
          <Chip tono={resumen?.vencidos ? TONOS.peligro : TONOS.neutro}>{resumen?.vencidos ?? 0} vencidos</Chip>
        </div>
        {puede && <Boton onClick={() => setCerrarAbierto(true)}><Check className="w-4 h-4" /> Cerrar visita</Boton>}
        {!puede && <Aviso>Solo la asesora asignada o un administrador puede capturar esta visita.</Aviso>}
      </div>

      <FiltroPildoras<string>
        groupId="chk-visita-filtro"
        value={filtro ?? ''}
        onChange={f => setFiltro(filtro === f ? null : (f as Filtro))}
        options={[
          { value: 'sin_revisar', label: 'Sin revisar' },
          { value: 'revisados', label: 'Revisados' },
          { value: 'incidencia', label: 'Con incidencia' },
        ]}
      />

      {visibles.length === 0 ? (
        <p className="text-sm text-muted-foreground text-center py-10">{filtro ? 'Nada coincide con este filtro.' : 'No hay documentos en esta visita.'}</p>
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
                onIncidencia={() => setIncidencia(d)}
                onSeguir={(inc, tipo) => setSeguir({ incidencia: inc, tipo })}
              />
            ))}
          </div>
        </section>
      ))}

      <ConfirmarDocSheet doc={confirmar} visitaId={visitaId} onClose={() => setConfirmar(null)} onGuardado={recargar} />
      <ActualizarDocSheet doc={actualizar} visitaId={visitaId} onClose={() => setActualizar(null)} onGuardado={recargar} />
      <IncidenciaDocSheet doc={incidencia} visitaId={visitaId} onClose={() => setIncidencia(null)} onGuardado={recargar} />
      <SeguirIncidenciaSheet objetivo={seguir} visitaId={visitaId} onClose={() => setSeguir(null)} onGuardado={recargar} />
      <CerrarVisitaSheet open={cerrarAbierto} visitaId={visitaId} onClose={() => setCerrarAbierto(false)} onCerrada={recargar} />
    </div>
  )
}

function TarjetaDoc({ doc: d, puede, onConfirmar, onActualizar, onIncidencia, onSeguir }: {
  doc: DocVisita; puede: boolean
  onConfirmar: () => void; onActualizar: () => void; onIncidencia: () => void
  onSeguir: (inc: IncidenciaDoc, tipo: TipoSeguimiento) => void
}) {
  const ver = d.verificacion
  const antecedente = textoAntecedente(d.antecedente)
  const registro = textoRegistro(d)
  // Sin revisar = sin color de éxito
  const borde = ver?.resultado === 'incidencia' ? 'var(--agro-danger-text)' : ver ? 'var(--agro-success-text)' : undefined

  return (
    <div className="rounded-xl border border-border bg-card p-3 space-y-2.5" style={borde ? { borderColor: borde } : undefined}>
      <div className="flex items-start justify-between gap-2">
        <div className="min-w-0">
          <p className="text-sm font-semibold">{d.nombre}</p>
          <p className="text-xs text-muted-foreground">{[d.tipo_doc, d.codigo, d.revision ? `Rev ${d.revision}` : null, d.numeral ? `#${d.numeral}` : null].filter(Boolean).join(' · ')}</p>
        </div>
        <ChipVigencia vigencia={d.vigencia} />
      </div>

      <div className="text-xs text-muted-foreground space-y-0.5">
        {d.responsable_llenado && <p>Responsable de llenado: {d.responsable_llenado}</p>}
        {registro && <p>Último registro: {registro}</p>}
        {d.vence_el && <p>Vence: {fechaLarga(d.vence_el)}</p>}
        {d.antecedentes && <p>{d.antecedentes}</p>}
      </div>

      {antecedente && <p className="text-xs rounded-lg bg-muted text-muted-foreground px-2.5 py-1.5">{antecedente}</p>}

      {ver && (
        <div className="text-xs space-y-0.5">
          <p className="font-semibold" style={{ color: ver.resultado === 'incidencia' ? 'var(--agro-danger-text)' : 'var(--agro-success-text)' }}>
            {ver.resultado === 'incidencia' ? 'Con incidencia' : ver.actualizado ? 'Actualizado y confirmado' : 'Confirmado'} · Revisado por {ver.actor ?? '—'} a las {horaCorta(ver.creado_en)}
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
        <div className="flex flex-wrap gap-2 pt-0.5">
          <Boton tamano="sm" variante="secundario" onClick={onConfirmar}><Check className="w-4 h-4" /> Confirmar</Boton>
          <Boton tamano="sm" variante="secundario" onClick={onActualizar}><Pencil className="w-4 h-4" /> Actualizar</Boton>
          <Boton tamano="sm" variante="secundario" onClick={onIncidencia}><AlertTriangle className="w-4 h-4" /> Incidencia</Boton>
        </div>
      )}
    </div>
  )
}
