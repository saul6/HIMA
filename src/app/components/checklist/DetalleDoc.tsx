// Contenido de un documento en la visita: antecedentes, relacionados, estado de la revisión e incidencias.
// Lo usan la tarjeta (celular) y el panel de revisión (escritorio); las acciones se abren desde quien lo monta.
import { AlertTriangle, ChevronDown } from 'lucide-react'
import type { DocVisita, IncidenciaDoc } from '@/hooks/useChecklistV2'
import { Chip, ChipVigencia, textoRegistro } from './comun'
import { SeguimientosLista, etiquetaEstadoIncidencia } from './IncidenciasTab'
import type { TipoSeguimiento } from './VisitaSheets'
import { COLOR_RESULTADO, etiquetaResultado, textoAntecedente } from './estadoDoc'
import { fechaCorta, fechaLarga, horaCorta } from './constantes'

interface Props {
  doc: DocVisita
  puede: boolean
  onSeguir: (inc: IncidenciaDoc, tipo: TipoSeguimiento) => void
  /** tarjeta: antecedentes plegados en un bloque. panel: rejilla, caja de antecedente y relacionados plegables. */
  variante?: 'tarjeta' | 'panel'
}

export function DetalleDoc({ doc: d, puede, onSeguir, variante = 'tarjeta' }: Props) {
  const antecedente = textoAntecedente(d.antecedente)
  const registro = textoRegistro(d)
  const hayAntecedentes = !!(registro || d.antecedentes || antecedente || d.responsable_llenado || d.vence_el || d.relacionados.length > 0)

  return (
    <>
      {variante === 'tarjeta' ? (
        hayAntecedentes && (
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
              <Relacionados doc={d} />
            </div>
          </details>
        )
      ) : (
        <>
          <dl className="grid grid-cols-1 sm:grid-cols-2 gap-2 text-sm">
            <Dato titulo="Revisión documental">{[d.revision ? `Rev ${d.revision}` : null, d.numeral ? `#${d.numeral}` : null].filter(Boolean).join(' · ') || '—'}</Dato>
            <Dato titulo="Responsable de llenado">{d.responsable_llenado || '—'}</Dato>
            <Dato titulo="Último registro documental">{registro || '—'}</Dato>
            <Dato titulo="Última revisión previa">{antecedente ?? 'Sin revisión anterior'}</Dato>
          </dl>
          {d.antecedentes && (
            <div className="rounded-lg border-l-4 px-3 py-2 text-sm" style={{ borderLeftColor: 'var(--agro-blue)', backgroundColor: 'var(--agro-info-fill)', color: 'var(--agro-info-text)' }}>
              <p className="text-xs font-semibold">Antecedente disponible (no demuestra cumplimiento)</p>
              <p className="whitespace-pre-line mt-0.5">{d.antecedentes}</p>
            </div>
          )}
          <div className="flex flex-wrap items-center gap-2">
            <ChipVigencia vigencia={d.vigencia} />
            {d.vence_el && <span className="text-xs text-muted-foreground">Vence: {fechaLarga(d.vence_el)}</span>}
          </div>
          {d.relacionados.length > 0 && (
            <details className="group rounded-lg border border-border px-2.5 py-1.5 text-xs text-muted-foreground">
              <summary className="cursor-pointer font-semibold flex items-center gap-1 list-none">
                <ChevronDown className="w-3 h-3 transition-transform group-open:rotate-180" aria-hidden="true" /> Documentos relacionados · {d.relacionados.length}
              </summary>
              <div className="mt-1.5"><Relacionados doc={d} /></div>
            </details>
          )}
        </>
      )}

      {d.verificacion && (
        <div className="text-xs space-y-0.5">
          <p className="font-semibold" style={{ color: COLOR_RESULTADO[d.verificacion.resultado] }}>
            {etiquetaResultado(d.verificacion.resultado, d.verificacion.actualizado)} · por {d.verificacion.actor ?? '—'} el {fechaCorta(d.verificacion.creado_en)} a las {horaCorta(d.verificacion.creado_en)}
          </p>
          {d.verificacion.observacion && <p className="text-muted-foreground">{d.verificacion.observacion}</p>}
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
    </>
  )
}

function Dato({ titulo, children }: { titulo: string; children: React.ReactNode }) {
  return (
    <div className="rounded-lg bg-muted px-3 py-2">
      <dt className="text-xs text-muted-foreground">{titulo}</dt>
      <dd className="text-sm text-foreground">{children}</dd>
    </div>
  )
}

function Relacionados({ doc: d }: { doc: DocVisita }) {
  if (d.relacionados.length === 0) return null
  return (
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
  )
}
