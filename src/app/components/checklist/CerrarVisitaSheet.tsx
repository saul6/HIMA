import { useRef, useState } from 'react'
import { toast } from 'sonner'
import { FileText } from 'lucide-react'
import { BottomSheet } from '@/app/components/BottomSheet'
import { Boton } from '@/app/components/ui-mady/Boton'
import { chk, codigoError, mensajeError, nuevoEventId, useCarga, type Reporte } from '@/hooks/useChecklistV2'
import { Aviso, Cargando, CLASE_TEXTAREA, Chip, ErrorReintentar, TONOS } from './comun'
import { fechaLarga } from './constantes'

interface Props {
  open: boolean
  visitaId: string
  onClose: () => void
  onCerrada: () => void
}

export function CerrarVisitaSheet({ open, ...resto }: Props) {
  return (
    <BottomSheet open={open} onClose={resto.onClose} height="95%" title="Cerrar visita">
      {open && <Contenido {...resto} />}
    </BottomSheet>
  )
}

const ESTADO_TXT = {
  correcto: 'Verificado', incidencia: 'No conforme', pendiente: 'Pendiente', no_aplica: 'No aplica', sin_revisar: 'Sin revisar',
} as const
const NOMBRE_SEC: Record<string, string> = { '1': 'Tabla 1 · Formatos', '2': 'Tabla 2 · Controles complementarios', '3': 'Tabla 3 · Orgánico' }

function Contenido({ visitaId, onClose, onCerrada }: Omit<Props, 'open'>) {
  const carga = useCarga<Reporte>(visitaId, () => chk.visPreview(visitaId))
  const [justificacion, setJustificacion] = useState('')
  const [observaciones, setObservaciones] = useState('')
  const [cerrando, setCerrando] = useState(false)
  const [pdfCargando, setPdfCargando] = useState(false)
  const eventId = useRef<string | null>(null)
  const rep = carga.data

  async function verPdf() {
    if (!rep) return
    setPdfCargando(true)
    try {
      const { previsualizarReporteVisitaPDF } = await import('@/lib/pdf/m80/generarReporteVisitaPDF')
      await previsualizarReporteVisitaPDF(rep)
    } catch (e) { console.error(e); toast.error('No se pudo generar la vista previa') } finally { setPdfCargando(false) }
  }

  async function cerrar() {
    if (!rep) return
    const parcial = rep.resumen.sin_revisar > 0
    if (parcial && justificacion.trim().length < 10) { toast.warning('Justifica el cierre parcial (mínimo 10 caracteres)'); return }
    if (!eventId.current) eventId.current = nuevoEventId()
    setCerrando(true)
    try {
      await chk.visCerrar({
        visita: visitaId, justificacion: parcial ? justificacion.trim() : null,
        observaciones: observaciones.trim() || null, hash: rep.hash, eventId: eventId.current,
      })
      toast.success('Visita cerrada. El reporte ya no se puede modificar.')
      onCerrada()
      onClose()
    } catch (e) {
      if (codigoError(e)) eventId.current = null
      if (codigoError(e) === 'PREVIEW_DESACTUALIZADA') {
        toast.warning('Hubo cambios después de la vista previa. Revísala de nuevo.')
        await carga.recargar()
      } else toast.error(mensajeError(e))
    } finally { setCerrando(false) }
  }

  if (carga.loading && !rep) return <Cargando />
  if (carga.error || !rep) return <div className="p-4"><ErrorReintentar mensaje={carga.error ?? 'No se pudo cargar'} onReintentar={carga.recargar} /></div>

  const r = rep.resumen
  const parcial = r.sin_revisar > 0
  const porArea = new Map<string, typeof rep.documentos>()
  for (const d of rep.documentos) {
    const k = `${d.seccion}|${d.area?.trim() || d.categoria?.trim() || 'Sin área'}`
    porArea.set(k, [...(porArea.get(k) ?? []), d])
  }
  const secciones = Object.entries(rep.secciones ?? {}).sort(([a], [b]) => Number(a) - Number(b))

  return (
    <>
      <div className="flex-1 overflow-y-auto px-4 py-4 space-y-4">
        <div className="space-y-1">
          <p className="text-sm font-semibold">{[rep.cliente, rep.instalacion, rep.alcance].filter(Boolean).join(' · ')}</p>
          <p className="text-xs text-muted-foreground">{fechaLarga(rep.visita.fecha)} · {rep.visita.asesor ?? 'Sin asesora'}</p>
          <div className="flex flex-wrap gap-1.5 pt-1">
            <Chip tono={TONOS.exito}>{r.correctos} verificados</Chip>
            <Chip tono={r.con_incidencia ? TONOS.peligro : TONOS.neutro}>{r.con_incidencia} no conformes</Chip>
            {!!r.pendientes && <Chip tono={TONOS.info}>{r.pendientes} pendientes</Chip>}
            {!!r.no_aplica && <Chip>{r.no_aplica} no aplica</Chip>}
            <Chip tono={r.sin_revisar ? TONOS.info : TONOS.neutro}>{r.sin_revisar} sin revisar</Chip>
            <Chip>{r.actualizados} actualizados</Chip>
            <Chip tono={r.vencidos ? TONOS.peligro : TONOS.neutro}>{r.vencidos} vencidos</Chip>
          </div>
          {secciones.length > 0 && (
            <ul className="text-xs text-muted-foreground pt-1 space-y-0.5">
              {secciones.map(([n, x]) => (
                <li key={n}>{NOMBRE_SEC[n] ?? `Sección ${n}`}: {x.aplicables - x.sin_revisar} de {x.aplicables} revisados{x.sin_revisar ? ` · ${x.sin_revisar} sin revisar` : ''}</li>
              ))}
            </ul>
          )}
          {rep.organico?.leyenda && <p className="text-xs text-muted-foreground">{rep.organico.leyenda}</p>}
        </div>

        <Aviso>Esta es la vista previa del reporte. Al cerrar, queda guardado tal cual y no se puede modificar.</Aviso>
        <Boton type="button" variante="secundario" cargando={pdfCargando} onClick={verPdf}>
          <FileText className="w-4 h-4" /> Ver como PDF
        </Boton>

        {[...porArea.entries()].map(([clave, docs]) => (
          <div key={clave} className="space-y-1">
            <p className="text-xs font-semibold text-muted-foreground">{NOMBRE_SEC[clave.split('|')[0]]?.split(' · ')[0]} · {clave.split('|').slice(1).join('|')}</p>
            <ul className="rounded-lg border border-border divide-y divide-border bg-card">
              {docs.map(d => (
                <li key={d.documento_id} className="px-3 py-2 text-xs space-y-0.5">
                  <div className="flex items-start justify-between gap-2">
                    <span className="font-semibold text-foreground">{[d.codigo, d.nombre].filter(Boolean).join(' · ')}</span>
                    <span className="font-semibold whitespace-nowrap" style={{ color: d.estado === 'incidencia' ? 'var(--agro-danger-text)' : d.estado === 'correcto' ? 'var(--agro-success-text)' : 'var(--muted-foreground)' }}>
                      {ESTADO_TXT[d.estado]}{d.actualizado ? ' (actualizado)' : ''}
                    </span>
                  </div>
                  {d.incidencia && <p className="text-muted-foreground">{d.incidencia}</p>}
                  {d.observacion && <p className="text-muted-foreground">{d.observacion}</p>}
                </li>
              ))}
            </ul>
          </div>
        ))}

        {rep.incidencias.length > 0 && (
          <div className="space-y-1">
            <p className="text-xs font-semibold text-muted-foreground">Incidencias ({rep.incidencias.length})</p>
            <ul className="rounded-lg border border-border divide-y divide-border bg-card">
              {rep.incidencias.map(i => (
                <li key={i.id} className="px-3 py-2 text-xs">
                  <span className="font-semibold">{i.documento ?? i.documento_nombre}</span> · {i.nueva ? 'Nueva' : 'Seguimiento'} · {i.estado}
                  <p className="text-muted-foreground">{i.descripcion}</p>
                </li>
              ))}
            </ul>
          </div>
        )}

        {!!rep.notas?.length && (
          <div className="space-y-1">
            <p className="text-xs font-semibold text-muted-foreground">Antecedentes (observaciones generales)</p>
            {rep.notas.map((n, i) => n.antecedentes && <p key={i} className="text-xs whitespace-pre-line rounded-lg bg-muted px-3 py-2">{n.antecedentes}</p>)}
          </div>
        )}

        {parcial && (
          <label className="block space-y-1">
            <span className="text-xs font-semibold" style={{ color: 'var(--agro-info-text)' }}>
              Cierre parcial: quedan {r.sin_revisar} documentos sin revisar. Justifica por qué (obligatorio, mínimo 10 caracteres)
            </span>
            <textarea className={CLASE_TEXTAREA} value={justificacion} maxLength={2000} onChange={e => setJustificacion(e.target.value)} />
          </label>
        )}
        <label className="block space-y-1">
          <span className="text-xs text-muted-foreground">Observaciones generales (opcional)</span>
          <textarea className={CLASE_TEXTAREA} value={observaciones} maxLength={2000} onChange={e => setObservaciones(e.target.value)} />
        </label>
      </div>
      <div className="flex gap-3 px-4 py-3 border-t border-border">
        <Boton type="button" variante="secundario" className="flex-1" onClick={onClose}>Seguir revisando</Boton>
        <Boton type="button" className="flex-1" cargando={cerrando} onClick={cerrar}>
          {parcial ? 'Cerrar parcial' : 'Cerrar visita'}
        </Boton>
      </div>
    </>
  )
}
