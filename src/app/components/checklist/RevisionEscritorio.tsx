// Visita en curso en escritorio (≥ lg): lista compacta de documentos a la izquierda y panel de revisión a la derecha.
// Las acciones abren las mismas sheets que la tarjeta del celular; aquí solo cambia desde dónde se abren.
import { Check, ChevronRight, Pencil } from 'lucide-react'
import { Boton } from '@/app/components/ui-mady/Boton'
import type { DocVisita, IncidenciaDoc, NotaGeneral, ResultadoVerificacion } from '@/hooks/useChecklistV2'
import { Aviso, CLASE_INPUT, Chip, TONOS } from './comun'
import { DetalleDoc } from './DetalleDoc'
import { etiquetaResultado } from './estadoDoc'
import type { TipoMarca, TipoSeguimiento } from './VisitaSheets'

interface Props {
  seccionActiva: number
  busqueda: string
  onBusqueda: (v: string) => void
  porArea: [string, DocVisita[]][]
  seleccionado: DocVisita | null
  onSeleccionar: (id: string) => void
  onSiguiente: () => void
  notas: NotaGeneral[]
  puede: boolean
  /** Aviso del servidor para el documento seleccionado (falta el estado). */
  falta?: string | null
  onConfirmar: (d: DocVisita) => void
  onActualizar: (d: DocVisita) => void
  onMarcar: (d: DocVisita, t: TipoMarca) => void
  onSeguir: (inc: IncidenciaDoc, t: TipoSeguimiento) => void
}

const TONO_RESULTADO: Record<ResultadoVerificacion, typeof TONOS.exito> = {
  correcto: TONOS.exito, incidencia: TONOS.peligro, pendiente: TONOS.info, no_aplica: TONOS.neutro,
}

function Punto({ resultado }: { resultado: ResultadoVerificacion | undefined }) {
  const color = !resultado ? 'var(--muted-foreground)'
    : resultado === 'correcto' ? 'var(--agro-success-text)'
    : resultado === 'pendiente' ? 'var(--agro-info-text)'
    : resultado === 'incidencia' ? 'var(--agro-danger-text)'
    : 'var(--muted-foreground)'
  return (
    <span
      aria-hidden="true"
      className="mt-1.5 w-2.5 h-2.5 rounded-full flex-shrink-0"
      style={resultado === 'no_aplica' ? { border: `2px solid ${color}` } : { backgroundColor: color }}
    />
  )
}

export function RevisionEscritorio(p: Props) {
  const d = p.seleccionado
  const total = p.porArea.reduce((n, [, l]) => n + l.length, 0)
  const notasSeccion = p.notas.filter(n => n.seccion === p.seccionActiva)

  return (
    <div className="grid grid-cols-[minmax(0,1fr)_minmax(0,1.15fr)] gap-4 items-start">
      {/* Columna izquierda: documentos */}
      <div className="rounded-xl border border-border bg-card p-3 space-y-3 min-w-0">
        <h2 className="text-sm font-semibold">Documentos</h2>

        <input
          type="search"
          className={CLASE_INPUT}
          placeholder="Buscar nombre o código…"
          aria-label="Buscar documento por nombre o código"
          value={p.busqueda}
          onChange={e => p.onBusqueda(e.target.value)}
        />

        {notasSeccion.length > 0 && (
          <div className="rounded-lg border-l-4 px-3 py-2 text-xs space-y-1.5" style={{ borderLeftColor: 'var(--agro-blue)', backgroundColor: 'var(--agro-info-fill)', color: 'var(--agro-info-text)' }}>
            <p className="font-semibold">Antecedente general · no se evalúa</p>
            {notasSeccion.map(n => (
              <p key={n.id} className="whitespace-pre-line">
                {n.atribucion === 'compartido_por_confirmar' && <span className="font-semibold">Atribución por confirmar. </span>}
                {n.antecedentes}
              </p>
            ))}
          </div>
        )}

        {total === 0 ? (
          <p className="text-sm text-muted-foreground text-center py-8">{p.busqueda ? 'Nada coincide con la búsqueda.' : 'No hay documentos en esta sección.'}</p>
        ) : p.porArea.map(([area, lista]) => (
          <section key={area} className="space-y-1">
            <h3 className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">{area} · {lista.length}</h3>
            <ul className="space-y-1">
              {lista.map(doc => {
                const sel = d?.id === doc.id
                const ver = doc.verificacion
                return (
                  <li key={doc.id}>
                    <button
                      type="button"
                      data-doc-id={doc.id}
                      aria-pressed={sel}
                      onClick={() => p.onSeleccionar(doc.id)}
                      className="flex w-full items-start gap-2 rounded-lg border px-2.5 py-2 text-left text-foreground focus-visible:outline focus-visible:outline-2 focus-visible:outline-ring hover:bg-muted"
                      style={sel ? { borderColor: 'var(--agro-blue)', backgroundColor: 'var(--agro-info-fill)' } : { borderColor: 'transparent' }}
                    >
                      <Punto resultado={ver?.resultado} />
                      <span className="min-w-0 flex-1">
                        <span className="block text-sm font-semibold">{doc.nombre}</span>
                        <span className="block text-xs text-muted-foreground">
                          {doc.codigo ? `${doc.codigo}${doc.revision ? ` · Rev. ${doc.revision}` : ''}` : 'Sin código'}
                        </span>
                        {doc.atribucion === 'compartido_por_confirmar' && (
                          <span className="block text-xs" style={{ color: 'var(--agro-info-text)' }}>Antecedente compartido — atribución por confirmar</span>
                        )}
                      </span>
                      <Chip tono={ver ? TONO_RESULTADO[ver.resultado] : TONOS.neutro}>
                        {ver ? etiquetaResultado(ver.resultado, ver.actualizado) : 'Pendiente de revisión'}
                      </Chip>
                    </button>
                  </li>
                )
              })}
            </ul>
          </section>
        ))}

      </div>

      {/* Columna derecha: revisión del documento */}
      <aside aria-label="Revisión del documento" className="sticky top-4 max-h-[calc(100vh-2rem)] overflow-y-auto rounded-xl border border-border bg-card p-4 space-y-3 min-w-0">
        <h2 className="text-xs font-semibold text-muted-foreground">Revisión del documento</h2>
        {!d ? (
          <p className="text-sm text-muted-foreground py-8 text-center">Elige un documento de la lista.</p>
        ) : (
          <>
            <div>
              <p className="text-xs font-semibold uppercase tracking-wide" style={{ color: 'var(--primary)' }}>
                {[d.codigo, d.area ?? d.categoria].filter(Boolean).join(' · ') || 'Sin código'}
              </p>
              <p className="text-lg font-semibold text-foreground">{d.nombre}</p>
              {d.atribucion === 'compartido_por_confirmar' && (
                <p className="text-xs mt-0.5" style={{ color: 'var(--agro-info-text)' }}>Antecedente compartido — atribución por confirmar</p>
              )}
            </div>

            <DetalleDoc doc={d} puede={p.puede} onSeguir={p.onSeguir} variante="panel" />

            {p.falta && <p role="alert" className="text-sm font-semibold" style={{ color: 'var(--agro-danger-text)' }}>Revisa este registro: falta {p.falta}</p>}

            {p.puede ? (
              <div className="space-y-2 border-t border-border pt-3">
                <p className="text-sm font-semibold">¿Qué encontraste al revisar este documento?</p>
                <p className="text-xs text-muted-foreground">Compara con el antecedente y elige una opción. No existe aprobación masiva.</p>
                <div className="flex flex-wrap items-center gap-2">
                  <Boton onClick={() => p.onConfirmar(d)}><Check className="w-4 h-4" /> Verificar</Boton>
                  <Boton variante="secundario" onClick={() => p.onActualizar(d)}><Pencil className="w-4 h-4" /> Actualizar</Boton>
                  <Boton variante="secundario" onClick={() => p.onMarcar(d, 'pendiente')}>Pendiente</Boton>
                  <Boton variante="secundario" onClick={() => p.onMarcar(d, 'no_aplica')}>No aplica</Boton>
                </div>
                <div className="flex flex-wrap items-center justify-end gap-2">
                  <button type="button" className="inline-flex items-center gap-1 text-sm font-semibold" style={{ color: 'var(--primary)' }} onClick={p.onSiguiente}>
                    Siguiente sin revisar <ChevronRight className="w-4 h-4" aria-hidden="true" />
                  </button>
                </div>
                <p className="text-xs text-muted-foreground">La fecha y quién verificó se guardan solos.</p>
              </div>
            ) : (
              <Aviso>Solo la asesora asignada o un administrador puede capturar esta visita.</Aviso>
            )}
          </>
        )}
      </aside>
    </div>
  )
}
