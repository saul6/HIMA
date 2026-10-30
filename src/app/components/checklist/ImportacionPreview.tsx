import { useState } from 'react'
import { toast } from 'sonner'
import { BottomSheet } from '@/app/components/BottomSheet'
import { Boton } from '@/app/components/ui-mady/Boton'
import { Input } from '@/app/components/ui/input'
import {
  chk, mensajeError, useAccion, useCarga,
  type ChkAlcance, type Clasificacion, type ImportacionFila, type ImportacionVer,
} from '@/hooks/useChecklistV2'
import { Aviso, Cargando, Chip, ErrorReintentar, TONOS } from './comun'
import { fechaCorta } from './constantes'
import { NOMBRE_SECCION_CORTO } from './secciones'

interface Props {
  alcances: ChkAlcance[]
  importacionId: string | null
  onClose: () => void
  /** Se aplicó o se canceló: recargar catálogo e importaciones. */
  onCambio: () => void
}

const CLASIF: Record<Clasificacion, { label: string; tono: typeof TONOS.exito }> = {
  nuevo: { label: 'Nuevo', tono: TONOS.exito },
  modificado: { label: 'Modificado', tono: TONOS.info },
  igual: { label: 'Igual', tono: TONOS.neutro },
  dudoso: { label: 'Dudoso', tono: TONOS.info },
  duplicado: { label: 'Duplicado', tono: TONOS.peligro },
}

const ETIQ: Record<string, string> = {
  area: 'Área', tipo_doc: 'Tipo', revision: 'Rev', numeral: '#', nombre: 'Nombre', codigo: 'Código',
  responsable_llenado: 'Responsable', ultimo_registro_fecha: 'Fecha de registro', ultimo_registro_texto: 'Último registro (texto)',
  ultimo_registro_precision: 'Precisión', antecedentes: 'Antecedentes', seccion: 'Sección', categoria: 'Categoría',
  alcance_id: 'Alcance', es_nota: 'Observación general', atribucion_por_confirmar: 'Atribución por confirmar',
}
const mostrar = (v: unknown) => (v == null || v === '' ? '—' : typeof v === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(v) ? fechaCorta(v) : String(v))

export function ImportacionPreview({ alcances, importacionId, onClose, onCambio }: Props) {
  return (
    <BottomSheet open={!!importacionId} onClose={onClose} height="95%" title="Vista previa de importación">
      {importacionId && <Contenido alcances={alcances} importacionId={importacionId} onClose={onClose} onCambio={onCambio} />}
    </BottomSheet>
  )
}

function Contenido({ alcances, importacionId, onClose, onCambio }: { alcances: ChkAlcance[]; importacionId: string; onClose: () => void; onCambio: () => void }) {
  const carga = useCarga<ImportacionVer>(importacionId, () => chk.importacionVer(importacionId))
  const accion = useAccion()
  const imp = carga.data

  // Estado local de decisiones para no recargar todo el archivo en cada toque
  function actualizarFila(id: string, parche: Partial<ImportacionFila>) {
    if (!imp) return
    carga.setData({ ...imp, filas: imp.filas.map(f => f.id === id ? { ...f, ...parche } : f) })
  }

  async function decidir(fila: ImportacionFila, decision: 'aplicar' | 'omitir', datos: Record<string, unknown> | null, resueltas: boolean) {
    const r = await accion.ejecutar(() => chk.importacionDecidir(fila.id, decision, datos, resueltas))
    if (!r.ok) { toast.error(r.mensaje); return }
    actualizarFila(fila.id, {
      decision,
      datos: datos ? { ...fila.datos, ...datos } : fila.datos,
      alertas: resueltas && decision === 'aplicar' ? [] : fila.alertas,
    })
  }

  async function aplicar() {
    const r = await accion.ejecutar(() => chk.importacionAplicar(importacionId))
    if (!r.ok) { toast.error(r.mensaje); return }
    toast.success(`Importación aplicada: ${r.data.altas} nuevos, ${r.data.modificados} modificados`)
    onCambio()
    onClose()
  }

  async function cancelar() {
    const r = await accion.ejecutar(() => chk.importacionCancelar(importacionId))
    if (!r.ok) { toast.error(r.mensaje); return }
    toast.success('Importación cancelada')
    onCambio()
    onClose()
  }

  if (carga.loading && !imp) return <Cargando />
  if (carga.error || !imp) return <div className="p-4"><ErrorReintentar mensaje={carga.error ?? 'No se pudo cargar'} onReintentar={carga.recargar} /></div>

  const sinDecision = imp.filas.filter(f => f.decision == null).length
  const aAplicar = imp.filas.filter(f => f.decision === 'aplicar').length
  const abierta = imp.estado === 'revision'

  return (
    <>
      <div className="flex-1 overflow-y-auto px-4 py-4 space-y-3">
        <div className="space-y-1">
          <p className="text-sm font-semibold break-all">{imp.archivo_nombre}</p>
          <div className="flex flex-wrap gap-1.5">
            {(Object.keys(CLASIF) as Clasificacion[]).filter(k => imp.resumen?.[k]).map(k => (
              <Chip key={k} tono={CLASIF[k].tono}>{CLASIF[k].label} · {imp.resumen[k]}</Chip>
            ))}
          </div>
        </div>
        {!abierta && <Aviso>Esta importación ya está {imp.estado}; solo lectura.</Aviso>}
        {abierta && sinDecision > 0 && <Aviso>Faltan {sinDecision} renglones por decidir (Aplicar u Omitir).</Aviso>}

        {imp.filas.map(f => (
          <FilaPreview key={f.id} fila={f} alcances={alcances} editable={abierta} ocupado={accion.ocupado} onDecidir={(d, datos, res) => decidir(f, d, datos, res)} />
        ))}
      </div>
      {abierta && (
        <div className="flex gap-3 px-4 py-3 border-t border-border">
          <Boton type="button" variante="secundario" className="flex-1" disabled={accion.ocupado} onClick={cancelar}>Cancelar importación</Boton>
          <Boton type="button" className="flex-1" cargando={accion.ocupado} disabled={sinDecision > 0 || aAplicar === 0} onClick={aplicar}>
            Aplicar ({aAplicar})
          </Boton>
        </div>
      )}
    </>
  )
}

function FilaPreview({ fila, alcances, editable, ocupado, onDecidir }: {
  fila: ImportacionFila; alcances: ChkAlcance[]; editable: boolean; ocupado: boolean
  onDecidir: (decision: 'aplicar' | 'omitir', datos: Record<string, unknown> | null, resueltas: boolean) => void
}) {
  const d = fila.datos as Record<string, unknown>
  const c = CLASIF[fila.clasificacion]
  const dudoso = fila.alertas.length > 0
  const [editando, setEditando] = useState(false)
  const [campos, setCampos] = useState({
    nombre: String(d.nombre ?? ''), codigo: String(d.codigo ?? ''), revision: String(d.revision ?? ''),
    area: String(d.area ?? ''), responsable_llenado: String(d.responsable_llenado ?? ''),
    registro: String(d.ultimo_registro_texto ?? d.ultimo_registro_fecha ?? ''),
    antecedentes: String(d.antecedentes ?? ''),
    categoria: String(d.categoria ?? ''),
    alcance_id: String(d.alcance_id ?? ''),
    por_confirmar: d.atribucion_por_confirmar === true,
  })
  const [revisadas, setRevisadas] = useState(false)

  function datosEditados(): Record<string, unknown> | null {
    if (!editando) return null
    const out: Record<string, unknown> = {
      nombre: campos.nombre.trim(), codigo: campos.codigo.trim() || null, revision: campos.revision.trim() || null,
      area: campos.area.trim() || null, responsable_llenado: campos.responsable_llenado.trim() || null,
      antecedentes: campos.antecedentes.trim() || null, categoria: campos.categoria.trim() || null,
      alcance_id: campos.alcance_id || null, atribucion_por_confirmar: !campos.alcance_id && campos.por_confirmar,
    }
    const reg = campos.registro.trim()
    if (reg !== String(d.ultimo_registro_texto ?? d.ultimo_registro_fecha ?? '')) {
      if (/^\d{4}-\d{2}-\d{2}$/.test(reg)) {
        out.ultimo_registro_fecha = reg; out.ultimo_registro_texto = null; out.ultimo_registro_precision = 'dia'
      } else {
        out.ultimo_registro_fecha = null; out.ultimo_registro_texto = reg || null; out.ultimo_registro_precision = reg ? 'texto' : null
      }
    }
    return out
  }

  const seccion = Number(d.seccion ?? 1)
  const nombreAlcance = d.alcance_id ? alcances.find(a => a.id === d.alcance_id)?.nombre ?? 'Alcance' : 'Compartido'
  const candidatos = Array.isArray((fila.original as Record<string, unknown>)?.candidatos_t1) ? ((fila.original as Record<string, unknown>).candidatos_t1 as string[]) : []
  const bloqueaAplicar = fila.clasificacion === 'duplicado'
  return (
    <div className="rounded-xl border border-border bg-card p-3 space-y-2" style={dudoso ? { borderColor: 'var(--agro-info-text)' } : undefined}>
      <div className="flex items-start justify-between gap-2">
        <div className="min-w-0">
          <p className="text-xs text-muted-foreground">Renglón {fila.n_fila}{d.area ? ` · ${String(d.area)}` : ''}</p>
          <p className="text-sm font-semibold">{mostrar(d.nombre)}</p>
          <p className="text-xs text-muted-foreground">{[d.codigo, d.revision ? `Rev ${String(d.revision)}` : null].filter(Boolean).map(String).join(' · ')}</p>
        </div>
        <Chip tono={c.tono}>{c.label}</Chip>
      </div>
      <div className="flex flex-wrap gap-1">
        <Chip>{NOMBRE_SECCION_CORTO[seccion] ?? `Sección ${seccion}`}</Chip>
        <Chip>{nombreAlcance}</Chip>
        {d.es_nota === true && <Chip tono={TONOS.info}>Observación general</Chip>}
        {d.atribucion_por_confirmar === true && <Chip tono={TONOS.info}>Atribución por confirmar</Chip>}
        {d.categoria ? <Chip>{String(d.categoria)}</Chip> : null}
      </div>
      {d.antecedentes ? <p className="text-xs text-muted-foreground whitespace-pre-line">{String(d.antecedentes)}</p> : null}
      {candidatos.length > 0 && <p className="text-xs text-muted-foreground">Relaciones sugeridas con la Tabla 1: {candidatos.join(', ')}</p>}

      {Object.keys(fila.diferencias ?? {}).length > 0 && (
        <ul className="text-xs text-muted-foreground space-y-0.5">
          {Object.entries(fila.diferencias).map(([k, v]) => (
            <li key={k}>{ETIQ[k] ?? k}: {mostrar(v.antes)} → <span className="text-foreground font-semibold">{mostrar(v.despues)}</span></li>
          ))}
        </ul>
      )}
      {fila.clasificacion === 'nuevo' && (
        <p className="text-xs text-muted-foreground">
          {mostrar(d.responsable_llenado) !== '—' && <>Responsable: {mostrar(d.responsable_llenado)}. </>}
          {(d.ultimo_registro_texto || d.ultimo_registro_fecha) ? <>Último registro: {mostrar(d.ultimo_registro_texto ?? d.ultimo_registro_fecha)}.</> : null}
        </p>
      )}
      {fila.alertas.map((a, i) => <Aviso key={i}><span className="font-semibold">{ETIQ[a.campo] ?? a.campo}:</span> {a.mensaje}</Aviso>)}

      {editable && editando && (
        <div className="grid grid-cols-2 gap-2">
          {([['nombre', 'Nombre'], ['codigo', 'Código'], ['revision', 'Rev'], ['area', 'Área'], ['responsable_llenado', 'Responsable'], ['registro', 'Último registro']] as const).map(([k, label]) => (
            <label key={k} className={`block space-y-0.5 ${k === 'nombre' ? 'col-span-2' : ''}`}>
              <span className="text-xs text-muted-foreground">{label}</span>
              <Input value={campos[k]} onChange={e => setCampos(s => ({ ...s, [k]: e.target.value }))} />
            </label>
          ))}
          <label className="block space-y-0.5 col-span-2">
            <span className="text-xs text-muted-foreground">Antecedentes</span>
            <textarea className="w-full min-h-16 rounded-lg border border-border-control bg-card px-3 py-2 text-sm" value={campos.antecedentes} onChange={e => setCampos(s => ({ ...s, antecedentes: e.target.value }))} />
          </label>
          <label className="block space-y-0.5">
            <span className="text-xs text-muted-foreground">Alcance</span>
            <select className="w-full h-10 rounded-lg border border-border-control bg-card px-2 text-sm" value={campos.alcance_id} onChange={e => setCampos(s => ({ ...s, alcance_id: e.target.value }))}>
              <option value="">Compartido</option>
              {alcances.map(a => <option key={a.id} value={a.id}>{a.nombre}</option>)}
            </select>
          </label>
          {!campos.alcance_id && alcances.length > 0 && (
            <label className="flex items-end gap-2 text-xs pb-2">
              <input type="checkbox" checked={campos.por_confirmar} onChange={e => setCampos(s => ({ ...s, por_confirmar: e.target.checked }))} /> Atribución por confirmar
            </label>
          )}
        </div>
      )}
      {editable && dudoso && (
        <label className="flex items-center gap-2 text-xs">
          <input type="checkbox" checked={revisadas} onChange={e => setRevisadas(e.target.checked)} /> Ya revisé las alertas
        </label>
      )}

      {editable && (
        <div className="flex flex-wrap items-center gap-2">
          <Boton tamano="sm" variante={fila.decision === 'aplicar' ? 'primario' : 'secundario'} disabled={ocupado || bloqueaAplicar}
            onClick={() => onDecidir('aplicar', datosEditados(), revisadas)}>
            Aplicar
          </Boton>
          <Boton tamano="sm" variante={fila.decision === 'omitir' ? 'primario' : 'secundario'} disabled={ocupado}
            onClick={() => onDecidir('omitir', null, false)}>
            Omitir
          </Boton>
          {fila.clasificacion !== 'duplicado' && (
            <button type="button" className="text-xs font-semibold ml-auto" style={{ color: 'var(--primary)' }} onClick={() => setEditando(e => !e)}>
              {editando ? 'No corregir' : 'Corregir campos'}
            </button>
          )}
        </div>
      )}
      {!editable && <p className="text-xs text-muted-foreground">Decisión: {fila.decision ?? 'sin decidir'}{fila.aplicado ? ' · aplicado' : ''}</p>}
    </div>
  )
}

export { mensajeError }
