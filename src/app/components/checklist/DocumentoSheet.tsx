import { useEffect, useState } from 'react'
import { toast } from 'sonner'
import { BottomSheet } from '@/app/components/BottomSheet'
import { Input } from '@/app/components/ui/input'
import { Pildora } from './Pildora'
import { Aviso, CLASE_INPUT, CLASE_TEXTAREA, PieFormulario } from './comun'
import { chk, mensajeError, useAccion, type ChkAlcance, type ChkDocumento, type HistorialDoc, type PrecisionRegistro } from '@/hooks/useChecklistV2'
import { fechaCorta, fechaLarga, horaCorta } from './constantes'
import { NOMBRE_SECCION } from './secciones'

interface Props {
  open: boolean
  instalacionId: string
  alcances: ChkAlcance[]
  /** Sección con la que se crea un documento nuevo */
  seccionInicial?: number
  /** Alcance preseleccionado en un documento nuevo ('' = compartido) */
  alcanceInicial?: string
  /** null = documento nuevo */
  documento: ChkDocumento | null
  /** Solo lectura (asesora): se ve el detalle y el historial, no se edita. */
  soloLectura: boolean
  onClose: () => void
  onGuardado: () => void
}

export function DocumentoSheet({ open, ...resto }: Props) {
  const titulo = !resto.documento ? 'Nuevo documento' : resto.soloLectura ? 'Documento' : 'Editar documento'
  return (
    <BottomSheet open={open} onClose={resto.onClose} height="85%" title={titulo}>
      {open && <Formulario {...resto} />}
    </BottomSheet>
  )
}

function Formulario({ instalacionId, alcances, seccionInicial, alcanceInicial, documento: d, soloLectura, onClose, onGuardado }: Omit<Props, 'open'>) {
  const [seccion, setSeccion] = useState<number>(d?.seccion ?? seccionInicial ?? 1)
  const [alcanceId, setAlcanceId] = useState(d ? (d.alcance_id ?? '') : (alcanceInicial ?? ''))
  const [categoria, setCategoria] = useState(d?.categoria ?? '')
  const [esNota, setEsNota] = useState(d?.es_nota ?? false)
  const [porConfirmar, setPorConfirmar] = useState(d?.atribucion_por_confirmar ?? false)
  const [area, setArea] = useState(d?.area ?? '')
  const [tipo, setTipo] = useState(d?.tipo_doc ?? '')
  const [revision, setRevision] = useState(d?.revision ?? '')
  const [numeral, setNumeral] = useState(d?.numeral ?? '')
  const [nombre, setNombre] = useState(d?.nombre ?? '')
  const [codigo, setCodigo] = useState(d?.codigo ?? '')
  const [resp, setResp] = useState(d?.responsable_llenado ?? '')
  const [precision, setPrecision] = useState<PrecisionRegistro>(d?.ultimo_registro_precision ?? 'dia')
  const [regFecha, setRegFecha] = useState(d?.ultimo_registro_fecha ?? '')
  const [regTexto, setRegTexto] = useState(d?.ultimo_registro_texto ?? '')
  const [vence, setVence] = useState(d?.vence_el ?? '')
  const [antecedentes, setAntecedentes] = useState(d?.antecedentes ?? '')
  const [motivo, setMotivo] = useState('')
  const [historial, setHistorial] = useState<HistorialDoc[] | null>(null)
  const { ocupado, ejecutar } = useAccion()

  useEffect(() => {
    if (!d) return
    let vivo = true
    chk.documentoHistorial(d.id).then(h => { if (vivo) setHistorial(h ?? []) }).catch(e => { console.error(e); if (vivo) setHistorial([]) })
    return () => { vivo = false }
  }, [d])

  async function guardar() {
    if (!nombre.trim()) { toast.warning('El nombre es obligatorio'); return }
    const datos: Record<string, unknown> = {
      seccion,
      alcance_id: alcanceId || null,
      categoria: categoria.trim() || null,
      es_nota: esNota,
      atribucion_por_confirmar: !alcanceId && porConfirmar,
      area: area.trim() || null,
      tipo_doc: tipo.trim() || null,
      revision: revision.trim() || null,
      numeral: numeral.trim() || null,
      nombre: nombre.trim(),
      codigo: seccion === 2 ? null : codigo.trim() || null,
      responsable_llenado: resp.trim() || null,
      vence_el: vence || null,
      antecedentes: antecedentes.trim() || null,
    }
    if (precision === 'dia') {
      datos.ultimo_registro_fecha = regFecha || null
      datos.ultimo_registro_texto = null
      datos.ultimo_registro_precision = regFecha ? 'dia' : null
    } else {
      datos.ultimo_registro_fecha = null
      datos.ultimo_registro_texto = regTexto.trim() || null
      datos.ultimo_registro_precision = regTexto.trim() ? precision : null
    }
    const r = await ejecutar(() => chk.documentoGuardar({ id: d?.id, instalacion: instalacionId, datos, motivo: motivo.trim() || null }))
    if (!r.ok) { toast.error(r.mensaje); return }
    toast.success(d ? 'Documento actualizado' : 'Documento agregado')
    onGuardado()
    onClose()
  }

  async function validar() {
    if (!d) return
    const r = await ejecutar(() => chk.documentoValidar(d.id, motivo.trim() || null))
    if (!r.ok) { toast.error(r.mensaje); return }
    toast.success('Alertas validadas')
    onGuardado()
    onClose()
  }

  const bloqueado = soloLectura
  return (
    <>
      <div className="flex-1 overflow-y-auto px-4 py-4 space-y-4">
        {d && d.alertas.length > 0 && (
          <Aviso>
            <ul className="space-y-1">{d.alertas.map((a, i) => <li key={i}><span className="font-semibold">{a.campo}:</span> {a.mensaje}</li>)}</ul>
          </Aviso>
        )}
        <div className="grid grid-cols-2 gap-3">
          <Campo etiqueta="Sección">
            <select disabled={bloqueado || !!d} className={CLASE_INPUT} value={seccion} onChange={e => setSeccion(Number(e.target.value))}>
              {[1, 2, 3].map(n => <option key={n} value={n}>{NOMBRE_SECCION[n]}</option>)}
            </select>
          </Campo>
          <Campo etiqueta="Alcance">
            <select disabled={bloqueado} className={CLASE_INPUT} value={alcanceId} onChange={e => setAlcanceId(e.target.value)}>
              <option value="">Compartido</option>
              {alcances.filter(a => a.activo || a.id === alcanceId).map(a => <option key={a.id} value={a.id}>{a.nombre}</option>)}
            </select>
          </Campo>
          {seccion !== 1 && <div className="col-span-2"><Campo etiqueta="Categoría"><Input disabled={bloqueado} value={categoria} maxLength={100} onChange={e => setCategoria(e.target.value)} /></Campo></div>}
          <Campo etiqueta="Área"><Input disabled={bloqueado} value={area} maxLength={100} onChange={e => setArea(e.target.value)} /></Campo>
          <Campo etiqueta="Tipo"><Input disabled={bloqueado} value={tipo} maxLength={20} onChange={e => setTipo(e.target.value)} /></Campo>
          <Campo etiqueta="Rev"><Input disabled={bloqueado} value={revision} maxLength={60} onChange={e => setRevision(e.target.value)} /></Campo>
          <Campo etiqueta="#"><Input disabled={bloqueado} value={numeral} maxLength={20} onChange={e => setNumeral(e.target.value)} /></Campo>
        </div>
        <Campo etiqueta="Nombre"><Input disabled={bloqueado} value={nombre} maxLength={300} onChange={e => setNombre(e.target.value)} /></Campo>
        {seccion !== 2 && <Campo etiqueta="Código"><Input disabled={bloqueado} value={codigo} maxLength={100} onChange={e => setCodigo(e.target.value)} /></Campo>}
        <label className="flex items-center gap-2 text-sm">
          <input type="checkbox" disabled={bloqueado} checked={esNota} onChange={e => setEsNota(e.target.checked)} />
          Observación general (se muestra como antecedente, no se evalúa)
        </label>
        {!alcanceId && alcances.length > 0 && (
          <label className="flex items-center gap-2 text-sm">
            <input type="checkbox" disabled={bloqueado} checked={porConfirmar} onChange={e => setPorConfirmar(e.target.checked)} />
            Atribución por confirmar (compartido, pero podría ser de un solo alcance)
          </label>
        )}
        <Campo etiqueta="Responsable de llenado"><Input disabled={bloqueado} value={resp} maxLength={300} onChange={e => setResp(e.target.value)} /></Campo>

        <div className="space-y-2">
          <span className="text-xs text-muted-foreground">Último registro</span>
          <div className="flex flex-wrap gap-2">
            {(['dia', 'mes', 'texto'] as const).map(p => (
              <Pildora key={p} activa={precision === p} disabled={bloqueado} onClick={() => setPrecision(p)}>
                {p === 'dia' ? 'Fecha' : p === 'mes' ? 'Mes y año' : 'Texto'}
              </Pildora>
            ))}
          </div>
          {precision === 'dia'
            ? <input type="date" disabled={bloqueado} className={CLASE_INPUT} value={regFecha} onChange={e => setRegFecha(e.target.value)} />
            : <Input disabled={bloqueado} value={regTexto} maxLength={200} onChange={e => setRegTexto(e.target.value)} placeholder={precision === 'mes' ? 'Febrero 2026' : 'Tal como aparece en el documento'} />}
        </div>

        <Campo etiqueta="Vence el"><input type="date" disabled={bloqueado} className={CLASE_INPUT} value={vence} onChange={e => setVence(e.target.value)} /></Campo>
        <Campo etiqueta="Antecedentes / notas"><textarea disabled={bloqueado} className={CLASE_TEXTAREA} value={antecedentes} maxLength={1000} onChange={e => setAntecedentes(e.target.value)} /></Campo>
        {!bloqueado && (
          <Campo etiqueta="Motivo del cambio (opcional)"><Input value={motivo} maxLength={300} onChange={e => setMotivo(e.target.value)} /></Campo>
        )}

        {d && (
          <div className="space-y-2">
            <p className="text-xs font-semibold text-muted-foreground">Historial</p>
            {historial === null ? <p className="text-xs text-muted-foreground">Cargando…</p>
              : historial.length === 0 ? <p className="text-xs text-muted-foreground">Sin cambios registrados.</p>
              : (
                <ul className="space-y-2">
                  {historial.map((h, i) => (
                    <li key={i} className="rounded-lg border border-border px-3 py-2 text-xs space-y-0.5">
                      <p className="font-semibold text-foreground">v{h.version} · {h.accion}{h.origen ? ` (${h.origen})` : ''}</p>
                      <p className="text-muted-foreground">{h.actor ?? 'Sistema'} · {fechaLarga(h.creado_en)} {horaCorta(h.creado_en)}</p>
                      {h.motivo && <p>{h.motivo}</p>}
                      {h.cambios && Object.keys(h.cambios).length > 0 && <CambiosLista cambios={h.cambios} />}
                    </li>
                  ))}
                </ul>
              )}
          </div>
        )}
      </div>
      {bloqueado ? null : (
        <div className="border-t border-border">
          {d && d.alertas.length > 0 && (
            <div className="px-4 pt-3">
              <button type="button" onClick={validar} disabled={ocupado} className="text-sm font-semibold disabled:opacity-50" style={{ color: 'var(--primary)' }}>
                Ya revisé las alertas: Validar
              </button>
            </div>
          )}
          <PieFormulario onCancelar={onClose} onGuardar={guardar} textoGuardar="Guardar" cargando={ocupado} />
        </div>
      )}
    </>
  )
}

function Campo({ etiqueta, children }: { etiqueta: string; children: React.ReactNode }) {
  return (
    <label className="block space-y-1">
      <span className="text-xs text-muted-foreground">{etiqueta}</span>
      {children}
    </label>
  )
}

const ETIQUETA_CAMPO: Record<string, string> = {
  area: 'Área', tipo_doc: 'Tipo', revision: 'Rev', numeral: '#', nombre: 'Nombre', codigo: 'Código',
  responsable_llenado: 'Responsable', ultimo_registro_fecha: 'Último registro', ultimo_registro_texto: 'Último registro',
  ultimo_registro_precision: 'Precisión', vence_el: 'Vence', aplicabilidad: 'Aplicabilidad', motivo_no_aplica: 'Motivo',
  seccion: 'Sección', categoria: 'Categoría', es_nota: 'Observación general', alcance_id: 'Alcance',
  atribucion_por_confirmar: 'Atribución por confirmar', antecedentes: 'Antecedentes', frecuencia: 'Frecuencia', orden: 'Orden', alertas: 'Alertas',
}

const mostrar = (v: unknown) => (v == null || v === '' ? '—' : typeof v === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(v) ? fechaCorta(v) : typeof v === 'object' ? JSON.stringify(v) : String(v))

/** Cambios "antes → después" ({campo:{antes,despues}} o valores sueltos). */
export function CambiosLista({ cambios }: { cambios: Record<string, unknown> }) {
  return (
    <ul className="text-muted-foreground">
      {Object.entries(cambios).filter(([k]) => k !== 'alertas').map(([k, v]) => {
        const o = v as { antes?: unknown; despues?: unknown } | null
        const par = o && typeof o === 'object' && ('antes' in o || 'despues' in o)
        return (
          <li key={k}>
            {ETIQUETA_CAMPO[k] ?? k}: {par ? `${mostrar(o!.antes)} → ${mostrar(o!.despues)}` : mostrar(v)}
          </li>
        )
      })}
    </ul>
  )
}
