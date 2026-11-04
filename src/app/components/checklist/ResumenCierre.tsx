// Etapa 4 de la visita: resumen por resultado y cierre firmado (vista previa, firma de la asesora y de enterado).
import { useEffect, useRef, useState } from 'react'
import { Link } from 'react-router'
import { toast } from 'sonner'
import { ChevronDown, FileDown, FileText } from 'lucide-react'
import { Boton } from '@/app/components/ui-mady/Boton'
import { FirmaPad, type FirmaPadRef } from '@/app/components/FirmaPad'
import { useAuthContext } from '@/context/AuthContext'
import { chk, codigoError, mensajeError, nuevoEventId, type DocVisita, type MiFirma, type Omision, type Reporte } from '@/hooks/useChecklistV2'
import { Aviso, Cargando, CLASE_TEXTAREA } from './comun'
import { NOMBRE_SECCION_CORTO } from './secciones'
import { descargarReportePdf } from './pdfVisita'

type Grupo = 'pendiente' | 'correcto' | 'incidencia'

const GRUPOS: Record<Grupo, { titulo: string; fill: string; text: string }> = {
  pendiente: { titulo: 'Pendientes', fill: 'var(--agro-info-fill)', text: 'var(--agro-info-text)' },
  correcto: { titulo: 'Revisadas', fill: 'var(--agro-success-fill)', text: 'var(--agro-success-text)' },
  incidencia: { titulo: 'Incidencias', fill: 'var(--agro-danger-fill)', text: 'var(--agro-danger-text)' },
}

/** Observación de esta visita del documento (en una incidencia, su descripción). */
function textoDe(d: DocVisita): string {
  const v = d.verificacion
  if (!v) return ''
  if (v.resultado === 'incidencia') return d.incidencias.find(i => i.nueva)?.descripcion ?? v.observacion ?? ''
  return v.observacion ?? ''
}

interface Props {
  visitaId: string
  codigoClave: string
  docs: DocVisita[]
  omisiones: Omision[]
  puede: boolean
  onIrADoc: (seccion: number, documentoId: string) => void
  /** Se llama una vez cerrada la visita, para refrescar listas externas. */
  onCerrada: () => void
  /** El servidor rechazó el cierre: cambió algo o hay omisiones; recarga datos. */
  onRecargar: () => void
}

export function ResumenCierre({ visitaId, codigoClave, docs, omisiones, puede, onIrADoc, onCerrada, onRecargar }: Props) {
  const { profile } = useAuthContext()
  const [abierto, setAbierto] = useState<Grupo | null>(null)
  const [observaciones, setObservaciones] = useState('')
  const [fase, setFase] = useState<'inicio' | 'firma' | 'cerrada'>('inicio')
  const [preview, setPreview] = useState<Reporte | null>(null)
  const [cargandoPreview, setCargandoPreview] = useState(false)
  const [miFirma, setMiFirma] = useState<MiFirma | null>(null)
  const [nombreEnterado, setNombreEnterado] = useState('')
  const [puntos, setPuntos] = useState(0)
  const [errNombre, setErrNombre] = useState<string | null>(null)
  const [errFirma, setErrFirma] = useState<string | null>(null)
  const [cerrando, setCerrando] = useState(false)
  const [pdfCargando, setPdfCargando] = useState(false)
  const [descargando, setDescargando] = useState(false)
  const padRef = useRef<FirmaPadRef>(null)
  const eventId = useRef<string | null>(null)

  const por = (r: Grupo) => docs.filter(d => d.verificacion?.resultado === r)
  const listas: Record<Grupo, DocVisita[]> = { pendiente: por('pendiente'), correcto: por('correcto'), incidencia: por('incidencia') }
  const noAplica = docs.filter(d => d.verificacion?.resultado === 'no_aplica').length
  const hayControles = docs.length > 0
  const sinOmisiones = omisiones.length === 0
  const nombreAsesora = profile?.nombre_completo ?? ''

  // Si aparece una omisión (edición de otra sesión) se vuelve al resumen normal
  useEffect(() => { if (!sinOmisiones && fase === 'firma') { setFase('inicio'); setPreview(null) } }, [sinOmisiones, fase])

  async function abrirVistaPrevia() {
    setCargandoPreview(true)
    try {
      const [rep, firma] = await Promise.all([chk.visPreview(visitaId), chk.miFirma()])
      setPreview(rep); setMiFirma(firma ?? { tiene: false }); setFase('firma')
      setNombreEnterado(''); setPuntos(0); setErrNombre(null); setErrFirma(null)
    } catch (e) {
      console.error(e); toast.error(mensajeError(e))
    } finally { setCargandoPreview(false) }
  }

  async function verPdfPreliminar() {
    if (!preview) return
    setPdfCargando(true)
    try {
      const { previsualizarReporteVisitaPDF } = await import('@/lib/pdf/m80/generarReporteVisitaPDF')
      await previsualizarReporteVisitaPDF(preview)
    } catch (e) { console.error(e); toast.error('No se pudo generar la vista previa') } finally { setPdfCargando(false) }
  }

  async function confirmar() {
    if (!preview || !miFirma?.tiene) return
    const nombre = nombreEnterado.trim()
    let ok = true
    if (nombre.length < 3) { setErrNombre('Escribe el nombre de la persona que firma (mínimo 3 letras)'); ok = false } else setErrNombre(null)
    if (puntos < 15) { setErrFirma('Falta la firma de enterado'); ok = false } else setErrFirma(null)
    if (!ok || !padRef.current) return
    const { png, trazos } = padRef.current.exportar()
    if (!eventId.current) eventId.current = nuevoEventId()
    setCerrando(true)
    try {
      await chk.visCerrarFirmado({
        visita: visitaId, observaciones: observaciones.trim() || null, hash: preview.hash, enteradoNombre: nombre,
        enteradoPng: png, enteradoTrazos: trazos, enteradoPuntos: puntos, eventId: eventId.current,
      })
      eventId.current = null
      setFase('cerrada')
      onCerrada()
    } catch (e) {
      const c = codigoError(e)
      if (c) eventId.current = null
      if (c === 'PREVIEW_DESACTUALIZADA') {
        toast.warning('Hubo cambios después de la vista previa. Revísala y firma de nuevo.')
        padRef.current.limpiar(); setPuntos(0)
        try { setPreview(await chk.visPreview(visitaId)) } catch (e2) { console.error(e2) }
        onRecargar()
      } else if (c === 'OMISIONES') {
        toast.warning(mensajeError(e)); setFase('inicio'); setPreview(null); onRecargar()
      } else if (c === 'ENTERADO_NOMBRE_REQUERIDO') setErrNombre(mensajeError(e))
      else if (c === 'ENTERADO_FIRMA_REQUERIDA') setErrFirma(mensajeError(e))
      else if (c === 'FIRMA_PERFIL_REQUERIDA') { setMiFirma({ tiene: false }); toast.error(mensajeError(e)) }
      else toast.error(mensajeError(e))
    } finally { setCerrando(false) }
  }

  async function descargar() {
    setDescargando(true)
    try { await descargarReportePdf({ id: visitaId, estado: 'cerrada' }, codigoClave) } catch (e) { console.error(e); toast.error('No se pudo generar el PDF. Puedes reintentar: la visita ya quedó cerrada.') } finally { setDescargando(false) }
  }

  if (fase === 'cerrada') {
    return (
      <div className="rounded-xl border border-border bg-card p-4 space-y-3" role="status">
        <p className="text-sm font-semibold" style={{ color: 'var(--agro-success-text)' }}>Documento guardado</p>
        <p className="text-xs text-muted-foreground">La visita quedó cerrada con la firma de la asesora y la de enterado. El reporte ya no se puede modificar.</p>
        <Boton cargando={descargando} onClick={descargar}><FileDown className="w-4 h-4" /> Descargar PDF</Boton>
      </div>
    )
  }

  const boton = (g: Grupo) => {
    const t = GRUPOS[g]
    const n = listas[g].length
    return (
      <button
        key={g}
        type="button"
        aria-expanded={abierto === g}
        aria-controls={`resumen-${g}`}
        onClick={() => setAbierto(abierto === g ? null : g)}
        className="flex items-center justify-between gap-2 rounded-lg px-3 py-3 text-sm font-semibold focus-visible:outline focus-visible:outline-2 focus-visible:outline-ring"
        style={{ backgroundColor: t.fill, color: t.text }}
      >
        <span>{t.titulo} · {n}</span>
        <ChevronDown className={`w-4 h-4 transition-transform ${abierto === g ? 'rotate-180' : ''}`} aria-hidden="true" />
      </button>
    )
  }

  return (
    <div className="space-y-4">
      {!sinOmisiones && (
        <div className="flex flex-wrap items-center justify-between gap-2 rounded-lg px-3 py-2 text-sm" role="alert" style={{ backgroundColor: 'var(--agro-danger-fill)', color: 'var(--agro-danger-text)' }}>
          <span className="font-semibold">Faltan {omisiones.length} {omisiones.length === 1 ? 'registro' : 'registros'} por revisar</span>
          <button type="button" className="font-semibold underline" onClick={() => onIrADoc(omisiones[0].seccion, omisiones[0].documento_id)}>Ir a la omisión</button>
        </div>
      )}

      <div className="rounded-xl border border-border bg-card p-3 space-y-3">
        <div className="grid grid-cols-2 gap-2">
          <div className="col-span-2 mx-auto w-full sm:w-1/2">{boton('pendiente')}</div>
          {boton('correcto')}
          {boton('incidencia')}
        </div>
        {noAplica > 0 && <p className="text-xs text-muted-foreground">{noAplica} no aplica</p>}
        {(Object.keys(GRUPOS) as Grupo[]).map(g => abierto === g && (
          <ul key={g} id={`resumen-${g}`} className="rounded-lg border border-border divide-y divide-border">
            {listas[g].length === 0 ? <li className="px-3 py-2 text-xs text-muted-foreground">Nada en esta lista.</li> : listas[g].map(d => (
              <li key={d.id}>
                <button type="button" className="w-full text-left px-3 py-2 hover:bg-muted focus-visible:outline focus-visible:outline-2 focus-visible:outline-ring" onClick={() => onIrADoc(d.seccion, d.id)}>
                  <span className="block text-xs text-muted-foreground">{NOMBRE_SECCION_CORTO[d.seccion]}{d.codigo ? ` · ${d.codigo}` : ''}</span>
                  <span className="block text-sm font-semibold">{d.nombre}</span>
                  {textoDe(d) && <span className="block text-xs text-muted-foreground whitespace-pre-line">{textoDe(d)}</span>}
                </button>
              </li>
            ))}
          </ul>
        ))}
      </div>

      {puede && fase === 'inicio' && (
        <>
          <label className="block space-y-1">
            <span className="text-xs text-muted-foreground">Observaciones generales (opcional)</span>
            <textarea className={CLASE_TEXTAREA} value={observaciones} maxLength={2000} onChange={e => setObservaciones(e.target.value)} />
          </label>
          {!hayControles && <Aviso>La visita no tiene controles configurados; define el alcance antes de cerrar.</Aviso>}
          <Boton className="w-full" disabled={!sinOmisiones || !hayControles} cargando={cargandoPreview} onClick={abrirVistaPrevia}>Cerrar visita</Boton>
        </>
      )}

      {puede && fase === 'firma' && preview && (
        <div className="rounded-xl border border-border bg-card p-4 space-y-4">
          <Aviso>Esta es la vista previa del reporte. Al confirmar, queda guardado tal cual y no se puede modificar.</Aviso>
          <Boton variante="secundario" cargando={pdfCargando} onClick={verPdfPreliminar}><FileText className="w-4 h-4" /> Ver como PDF</Boton>

          <section className="space-y-1.5" aria-label="Firma de la asesora">
            <p className="text-sm font-semibold">Firma de la asesora</p>
            <p className="text-sm">{nombreAsesora || '—'}</p>
            {!miFirma ? <Cargando /> : miFirma.tiene && miFirma.firma_png ? (
              <img src={miFirma.firma_png} alt="Tu firma de perfil" className="h-20 w-auto rounded-lg border border-border bg-white" />
            ) : miFirma.tiene ? (
              <p className="text-xs text-muted-foreground">Firma de perfil registrada.</p>
            ) : (
              <Aviso>
                Registra tu firma en tu perfil para poder cerrar la visita. <Link to="/perfil" className="font-semibold underline">Ir a Mi perfil</Link>
              </Aviso>
            )}
          </section>

          <section className="space-y-2" aria-label="Enterado">
            <p className="text-sm font-semibold">Enterado</p>
            <label className="block space-y-1">
              <span className="text-xs text-muted-foreground">Nombre de la persona que firma</span>
              <input
                className="w-full h-10 rounded-lg border bg-card px-3 text-sm text-foreground"
                style={{ borderColor: errNombre ? 'var(--agro-danger-text)' : 'var(--border-control)' }}
                value={nombreEnterado}
                maxLength={200}
                aria-invalid={!!errNombre}
                autoComplete="off"
                onChange={e => { setNombreEnterado(e.target.value); setErrNombre(null) }}
              />
            </label>
            {errNombre && <p role="alert" className="text-xs" style={{ color: 'var(--agro-danger-text)' }}>{errNombre}</p>}
            <span className="block text-xs text-muted-foreground">Firma digital</span>
            <FirmaPad ref={padRef} onChange={i => { setPuntos(i.puntos); if (i.puntos >= 15) setErrFirma(null) }} />
            {errFirma && <p role="alert" className="text-xs" style={{ color: 'var(--agro-danger-text)' }}>{errFirma}</p>}
          </section>

          <div className="flex gap-3">
            <Boton variante="secundario" className="flex-1" onClick={() => { setFase('inicio'); setPreview(null) }}>Seguir revisando</Boton>
            <Boton className="flex-1" cargando={cerrando} disabled={!miFirma?.tiene} onClick={confirmar}>Confirmar y cerrar</Boton>
          </div>
        </div>
      )}
    </div>
  )
}
