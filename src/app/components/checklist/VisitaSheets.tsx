// Sheets de la visita en curso: Confirmar, Actualizar, Incidencia y seguimiento de incidencias.
// Cada intento del usuario usa un event_id propio (useAccion): reintentar por red no duplica.
import { useState } from 'react'
import { toast } from 'sonner'
import { BottomSheet } from '@/app/components/BottomSheet'
import { Input } from '@/app/components/ui/input'
import { Pildora } from './Pildora'
import { CLASE_INPUT, CLASE_TEXTAREA, PieFormulario, textoRegistro } from './comun'
import { chk, useAccion, type DocVisita, type IncidenciaDoc, type PrecisionRegistro } from '@/hooks/useChecklistV2'

interface Base { visitaId: string; onClose: () => void; onGuardado: () => void }

function Hoja({ doc, titulo, onClose, children }: { doc: DocVisita | null; titulo: string; onClose: () => void; children: React.ReactNode }) {
  return (
    <BottomSheet open={!!doc} onClose={onClose} height="85%" title={titulo}>
      {doc && children}
    </BottomSheet>
  )
}

const Resumen = ({ doc }: { doc: DocVisita }) => (
  <div>
    <p className="text-sm font-semibold">{doc.nombre}</p>
    <p className="text-xs text-muted-foreground">{[doc.codigo, doc.revision ? `Rev ${doc.revision}` : null].filter(Boolean).join(' · ')}</p>
  </div>
)

// ── Confirmar ────────────────────────────────────────────────────────────────

export function ConfirmarDocSheet({ doc, ...b }: Base & { doc: DocVisita | null }) {
  return <Hoja doc={doc} titulo="Confirmar documento" onClose={b.onClose}>{doc && <FormConfirmar doc={doc} {...b} />}</Hoja>
}

function FormConfirmar({ doc, visitaId, onClose, onGuardado }: Base & { doc: DocVisita }) {
  const [obs, setObs] = useState('')
  const { ocupado, ejecutar } = useAccion()
  async function guardar() {
    const r = await ejecutar(eventId => chk.docConfirmar({ visita: visitaId, documento: doc.id, observacion: obs.trim() || null, eventId }))
    if (!r.ok) { toast.error(r.mensaje); return }
    toast.success('Documento confirmado')
    onGuardado(); onClose()
  }
  return (
    <>
      <div className="flex-1 overflow-y-auto px-4 py-4 space-y-4">
        <Resumen doc={doc} />
        <p className="text-sm text-muted-foreground">Confirmas que revisaste este documento en esta visita y sus datos son correctos.</p>
        <label className="block space-y-1">
          <span className="text-xs text-muted-foreground">Observación (opcional)</span>
          <textarea className={CLASE_TEXTAREA} value={obs} maxLength={2000} onChange={e => setObs(e.target.value)} />
        </label>
      </div>
      <PieFormulario onCancelar={onClose} onGuardar={guardar} textoGuardar="Confirmar" cargando={ocupado} />
    </>
  )
}

// ── Actualizar ───────────────────────────────────────────────────────────────

export function ActualizarDocSheet({ doc, ...b }: Base & { doc: DocVisita | null }) {
  return <Hoja doc={doc} titulo="Actualizar documento" onClose={b.onClose}>{doc && <FormActualizar doc={doc} {...b} />}</Hoja>
}

function FormActualizar({ doc, visitaId, onClose, onGuardado }: Base & { doc: DocVisita }) {
  const [revision, setRevision] = useState(doc.revision ?? '')
  const [resp, setResp] = useState(doc.responsable_llenado ?? '')
  const [precision, setPrecision] = useState<PrecisionRegistro>(doc.ultimo_registro_precision ?? 'dia')
  const [fecha, setFecha] = useState(doc.ultimo_registro_fecha ?? '')
  const [texto, setTexto] = useState(doc.ultimo_registro_texto ?? '')
  const [vence, setVence] = useState(doc.vence_el ?? '')
  const [obs, setObs] = useState('')
  const { ocupado, ejecutar } = useAccion()

  async function guardar() {
    // Solo lo que cambió
    const cambios: Record<string, unknown> = {}
    if (revision.trim() !== (doc.revision ?? '')) cambios.revision = revision.trim() || null
    if (resp.trim() !== (doc.responsable_llenado ?? '')) cambios.responsable_llenado = resp.trim() || null
    if (vence !== (doc.vence_el ?? '')) cambios.vence_el = vence || null
    const nuevaFecha = precision === 'dia' ? (fecha || null) : null
    const nuevoTexto = precision === 'dia' ? null : (texto.trim() || null)
    const nuevaPrec = precision === 'dia' ? (fecha ? 'dia' : null) : (texto.trim() ? precision : null)
    if (nuevaFecha !== (doc.ultimo_registro_fecha ?? null) || nuevoTexto !== (doc.ultimo_registro_texto ?? null) || nuevaPrec !== (doc.ultimo_registro_precision ?? null)) {
      cambios.ultimo_registro_fecha = nuevaFecha
      cambios.ultimo_registro_texto = nuevoTexto
      cambios.ultimo_registro_precision = nuevaPrec
    }
    if (Object.keys(cambios).length === 0) { toast.warning('No cambiaste ningún dato. Usa Confirmar si todo sigue igual.'); return }
    const r = await ejecutar(eventId => chk.docActualizar({ visita: visitaId, documento: doc.id, cambios, observacion: obs.trim() || null, eventId }))
    if (!r.ok) { toast.error(r.mensaje); return }
    toast.success('Documento actualizado')
    onGuardado(); onClose()
  }

  return (
    <>
      <div className="flex-1 overflow-y-auto px-4 py-4 space-y-4">
        <Resumen doc={doc} />
        <label className="block space-y-1">
          <span className="text-xs text-muted-foreground">Revisión</span>
          <Input value={revision} maxLength={20} onChange={e => setRevision(e.target.value)} />
        </label>
        <label className="block space-y-1">
          <span className="text-xs text-muted-foreground">Responsable de llenado</span>
          <Input value={resp} maxLength={300} onChange={e => setResp(e.target.value)} />
        </label>
        <div className="space-y-2">
          <span className="text-xs text-muted-foreground">Último registro</span>
          <div className="flex flex-wrap gap-2">
            {(['dia', 'mes', 'texto'] as const).map(p => (
              <Pildora key={p} activa={precision === p} onClick={() => setPrecision(p)}>{p === 'dia' ? 'Fecha' : p === 'mes' ? 'Mes y año' : 'Texto'}</Pildora>
            ))}
          </div>
          {precision === 'dia'
            ? <input type="date" className={CLASE_INPUT} value={fecha} onChange={e => setFecha(e.target.value)} />
            : <Input value={texto} maxLength={200} onChange={e => setTexto(e.target.value)} placeholder={precision === 'mes' ? 'Febrero 2026' : 'Tal como aparece'} />}
        </div>
        <label className="block space-y-1">
          <span className="text-xs text-muted-foreground">Vence el</span>
          <input type="date" className={CLASE_INPUT} value={vence} onChange={e => setVence(e.target.value)} />
        </label>
        <label className="block space-y-1">
          <span className="text-xs text-muted-foreground">Observación (opcional)</span>
          <textarea className={CLASE_TEXTAREA} value={obs} maxLength={2000} onChange={e => setObs(e.target.value)} />
        </label>
      </div>
      <PieFormulario onCancelar={onClose} onGuardar={guardar} textoGuardar="Guardar y confirmar" cargando={ocupado} />
    </>
  )
}

// ── Incidencia ───────────────────────────────────────────────────────────────

export function IncidenciaDocSheet({ doc, ...b }: Base & { doc: DocVisita | null }) {
  return <Hoja doc={doc} titulo="Registrar incidencia" onClose={b.onClose}>{doc && <FormIncidencia doc={doc} {...b} />}</Hoja>
}

function FormIncidencia({ doc, visitaId, onClose, onGuardado }: Base & { doc: DocVisita }) {
  const [desc, setDesc] = useState('')
  const [resp, setResp] = useState('')
  const [compromiso, setCompromiso] = useState('')
  const { ocupado, ejecutar } = useAccion()
  async function guardar() {
    if (desc.trim().length < 5) { toast.warning('Describe la incidencia (mínimo 5 caracteres)'); return }
    const r = await ejecutar(eventId => chk.incidenciaRegistrar({
      visita: visitaId, documento: doc.id, descripcion: desc.trim(), responsable: resp.trim() || null,
      fechaCompromiso: compromiso || null, eventId,
    }))
    if (!r.ok) { toast.error(r.mensaje); return }
    toast.success('Incidencia registrada')
    onGuardado(); onClose()
  }
  return (
    <>
      <div className="flex-1 overflow-y-auto px-4 py-4 space-y-4">
        <Resumen doc={doc} />
        <label className="block space-y-1">
          <span className="text-xs text-muted-foreground">Descripción</span>
          <textarea className={CLASE_TEXTAREA} value={desc} maxLength={2000} onChange={e => setDesc(e.target.value)} />
        </label>
        <label className="block space-y-1">
          <span className="text-xs text-muted-foreground">Responsable de corregir (opcional)</span>
          <Input value={resp} maxLength={200} onChange={e => setResp(e.target.value)} />
        </label>
        <label className="block space-y-1">
          <span className="text-xs text-muted-foreground">Fecha compromiso (opcional)</span>
          <input type="date" className={CLASE_INPUT} value={compromiso} onChange={e => setCompromiso(e.target.value)} />
        </label>
      </div>
      <PieFormulario onCancelar={onClose} onGuardar={guardar} textoGuardar="Registrar" cargando={ocupado} />
    </>
  )
}

// ── Seguimiento de incidencias abiertas ──────────────────────────────────────

export type TipoSeguimiento = 'seguimiento' | 'correccion_rechazada' | 'cierre'
const TITULO_SEG: Record<TipoSeguimiento, { titulo: string; etiqueta: string; boton: string }> = {
  seguimiento: { titulo: 'Dar seguimiento', etiqueta: 'Seguimiento', boton: 'Guardar seguimiento' },
  correccion_rechazada: { titulo: 'Rechazar corrección', etiqueta: 'Por qué se rechaza', boton: 'Rechazar corrección' },
  cierre: { titulo: 'Cerrar incidencia', etiqueta: 'Sustento del cierre', boton: 'Cerrar incidencia' },
}

export function SeguirIncidenciaSheet({ objetivo, visitaId, onClose, onGuardado }: Base & { objetivo: { incidencia: IncidenciaDoc; tipo: TipoSeguimiento } | null }) {
  return (
    <BottomSheet open={!!objetivo} onClose={onClose} title={objetivo ? TITULO_SEG[objetivo.tipo].titulo : ''}>
      {objetivo && <FormSeguir objetivo={objetivo} visitaId={visitaId} onClose={onClose} onGuardado={onGuardado} />}
    </BottomSheet>
  )
}

function FormSeguir({ objetivo, visitaId, onClose, onGuardado }: Omit<Base, never> & { objetivo: { incidencia: IncidenciaDoc; tipo: TipoSeguimiento } }) {
  const t = TITULO_SEG[objetivo.tipo]
  const [texto, setTexto] = useState('')
  const { ocupado, ejecutar } = useAccion()
  async function guardar() {
    if (texto.trim().length < 3) { toast.warning('Escribe el texto (mínimo 3 caracteres)'); return }
    const r = await ejecutar(eventId => chk.incidenciaSeguir({ incidencia: objetivo.incidencia.id, tipo: objetivo.tipo, texto: texto.trim(), visita: visitaId, eventId }))
    if (!r.ok) { toast.error(r.mensaje); return }
    toast.success(objetivo.tipo === 'cierre' ? 'Incidencia cerrada' : 'Guardado')
    onGuardado(); onClose()
  }
  return (
    <>
      <div className="px-4 py-4 space-y-3">
        <p className="text-sm">{objetivo.incidencia.descripcion}</p>
        <label className="block space-y-1">
          <span className="text-xs text-muted-foreground">{t.etiqueta}</span>
          <textarea className={CLASE_TEXTAREA} value={texto} maxLength={2000} onChange={e => setTexto(e.target.value)} />
        </label>
      </div>
      <PieFormulario onCancelar={onClose} onGuardar={guardar} textoGuardar={t.boton} cargando={ocupado} />
    </>
  )
}

export { textoRegistro }
