import { useMemo, useState } from 'react'
import { toast } from 'sonner'
import { Check, Layers, Plus, Upload } from 'lucide-react'
import { Boton } from '@/app/components/ui-mady/Boton'
import { BottomSheet } from '@/app/components/BottomSheet'
import { EstadoVacio } from '@/app/components/ui-mady/EstadoVacio'
import { TituloSeccion } from '@/app/components/ui-mady/TituloSeccion'
import { FiltroPildoras } from '@/app/components/FiltroPildoras'
import { ContadorPildora } from './ContadorPildora'
import { chk, mensajeError, useAccion, type Aplicabilidad, type CatalogoVer, type ChkDocumento } from '@/hooks/useChecklistV2'
import { Aviso, CLASE_INPUT, Chip, ChipCatalogo, ChipVigencia, PieFormulario, TONOS, textoRegistro } from './comun'
import { DocumentoSheet } from './DocumentoSheet'
import { fechaLarga } from './constantes'

type Filtro = 'por_confirmar' | 'alertas' | 'no_aplica' | 'vencidos'

interface Props {
  catalogo: CatalogoVer
  esAdmin: boolean
  onRecargar: () => void
  onImportar: () => void
}

const ETIQUETA_APLICA: Record<Aplicabilidad, string> = { aplica: 'Aplica', no_aplica: 'No aplica', por_confirmar: 'Por confirmar' }

export function CatalogoTab({ catalogo, esAdmin, onRecargar, onImportar }: Props) {
  const { instalacion: inst } = catalogo
  const docs = catalogo.documentos.filter(d => d.activo)
  const [filtro, setFiltro] = useState<Filtro | null>(null)
  const [seleccion, setSeleccion] = useState<Set<string>>(new Set())
  const [editar, setEditar] = useState<{ abierto: boolean; doc: ChkDocumento | null }>({ abierto: false, doc: null })
  const [motivoSheet, setMotivoSheet] = useState<string[] | null>(null)
  const [aprobarAbierto, setAprobarAbierto] = useState(false)
  const accion = useAccion()
  const precarga = useAccion()
  const [confirmarPrecarga, setConfirmarPrecarga] = useState(false)

  async function cargarModulos() {
    if (!inst.sector_clave) return
    const r = await precarga.ejecutar(() => chk.catalogoPrecargar(inst.id, inst.sector_clave as string))
    if (!r.ok) { toast.error(r.mensaje); return }
    setConfirmarPrecarga(false)
    if (r.data.agregados === 0) toast.info('Ya están todos los módulos del sector')
    else toast.success(`${r.data.agregados} módulos agregados · el catálogo vuelve a borrador`)
    onRecargar()
  }

  function pedirPrecarga() {
    if (!inst.sector_clave) { toast.warning('Esta instalación no tiene tipo asignado. Edítala y elige uno.'); return }
    if (inst.catalogo_estado === 'aprobado') setConfirmarPrecarga(true)
    else void cargarModulos()
  }

  const cuenta = useMemo(() => ({
    por_confirmar: docs.filter(d => d.aplicabilidad === 'por_confirmar').length,
    alertas: docs.filter(d => d.alertas.length > 0).length,
    no_aplica: docs.filter(d => d.aplicabilidad === 'no_aplica').length,
    vencidos: docs.filter(d => d.vigencia === 'vencido').length,
  }), [docs])

  const visibles = docs.filter(d => {
    switch (filtro) {
      case 'por_confirmar': return d.aplicabilidad === 'por_confirmar'
      case 'alertas': return d.alertas.length > 0
      case 'no_aplica': return d.aplicabilidad === 'no_aplica'
      case 'vencidos': return d.vigencia === 'vencido'
      default: return true
    }
  })

  const porArea = useMemo(() => {
    const m = new Map<string, ChkDocumento[]>()
    for (const d of visibles) {
      const k = d.area?.trim() || 'Sin área'
      m.set(k, [...(m.get(k) ?? []), d])
    }
    return [...m.entries()]
  }, [visibles])

  async function cambiarAplicabilidad(ids: string[], valor: Aplicabilidad, motivo: string | null) {
    const r = await accion.ejecutar(() => chk.aplicabilidad(inst.id, ids, valor, motivo))
    if (!r.ok) { toast.error(r.mensaje); return false }
    setSeleccion(new Set())
    onRecargar()
    return true
  }

  function pedirAplicabilidad(ids: string[], valor: Aplicabilidad) {
    if (valor === 'no_aplica') setMotivoSheet(ids)
    else void cambiarAplicabilidad(ids, valor, null)
  }

  const alternar = (id: string) => setSeleccion(s => { const n = new Set(s); if (n.has(id)) n.delete(id); else n.add(id); return n })

  const bloqueos: string[] = []
  if (docs.length === 0) bloqueos.push('El catálogo está vacío.')
  if (cuenta.por_confirmar > 0) bloqueos.push(`${cuenta.por_confirmar} documento(s) con aplicabilidad por confirmar.`)
  if (cuenta.alertas > 0) bloqueos.push(`${cuenta.alertas} documento(s) con alertas por validar.`)
  if (docs.length > 0 && docs.every(d => d.aplicabilidad !== 'aplica')) bloqueos.push('Ningún documento aplica.')

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center gap-2">
        <ChipCatalogo estado={inst.catalogo_estado} />
        <span className="text-xs text-muted-foreground">
          Versión {inst.catalogo_version}{inst.aprobado_en ? ` · aprobado el ${fechaLarga(inst.aprobado_en)}${inst.aprobado_por ? ` por ${inst.aprobado_por}` : ''}` : ''}
        </span>
        {esAdmin && (
          <div className="ml-auto flex gap-2">
            <Boton tamano="sm" variante="secundario" cargando={precarga.ocupado} onClick={pedirPrecarga}><Layers className="w-4 h-4" /> Cargar módulos del sector</Boton>
            <Boton tamano="sm" variante="secundario" onClick={onImportar}><Upload className="w-4 h-4" /> Importar</Boton>
            <Boton tamano="sm" variante="secundario" onClick={() => setEditar({ abierto: true, doc: null })}><Plus className="w-4 h-4" /> Documento</Boton>
            <Boton tamano="sm" onClick={() => setAprobarAbierto(true)}><Check className="w-4 h-4" /> Aprobar catálogo</Boton>
          </div>
        )}
      </div>

      {inst.catalogo_estado !== 'aprobado' && docs.length > 0 && (
        <Aviso>Solo con el catálogo aprobado se pueden programar visitas. Un catálogo en borrador no genera revisiones.</Aviso>
      )}

      {docs.length > 0 && (
        <FiltroPildoras<string>
          groupId="chk-catalogo-filtro"
          value={filtro ?? ''}
          onChange={v => setFiltro(filtro === v ? null : (v as Filtro))}
          options={([
            ['por_confirmar', 'Por confirmar'], ['alertas', 'Con alertas'], ['no_aplica', 'No aplica'], ['vencidos', 'Vencidos'],
          ] as const).map(([k, label]) => ({ value: k, label: <>{label} · <ContadorPildora n={cuenta[k]} /></> }))}
        />
      )}

      {esAdmin && seleccion.size > 0 && (
        <div className="flex flex-wrap items-center gap-2 rounded-xl border border-border bg-card px-3 py-2">
          <span className="text-sm font-semibold">{seleccion.size} seleccionados</span>
          <span className="text-xs text-muted-foreground">Marcar como:</span>
          <Boton tamano="sm" variante="secundario" cargando={accion.ocupado} onClick={() => pedirAplicabilidad([...seleccion], 'aplica')}>Aplica</Boton>
          <Boton tamano="sm" variante="secundario" cargando={accion.ocupado} onClick={() => pedirAplicabilidad([...seleccion], 'no_aplica')}>No aplica</Boton>
          <button type="button" className="ml-auto text-xs text-muted-foreground" onClick={() => setSeleccion(new Set())}>Quitar selección</button>
        </div>
      )}

      {docs.length === 0 ? (
        <EstadoVacio titulo="El catálogo de esta instalación está vacío" ayuda={esAdmin ? 'Carga los módulos del sector, importa un PDF o Word, o agrega los documentos uno por uno.' : undefined}
          accion={esAdmin && (
            <div className="flex flex-wrap justify-center gap-2">
              <Boton tamano="sm" cargando={precarga.ocupado} onClick={pedirPrecarga}><Layers className="w-4 h-4" /> Cargar módulos del sector</Boton>
              <Boton tamano="sm" variante="secundario" onClick={onImportar}><Upload className="w-4 h-4" /> Importar</Boton>
              <Boton tamano="sm" variante="secundario" onClick={() => setEditar({ abierto: true, doc: null })}><Plus className="w-4 h-4" /> Documento</Boton>
            </div>
          )} />
      ) : visibles.length === 0 ? (
        <p className="text-sm text-muted-foreground text-center py-10">Nada coincide con este filtro.</p>
      ) : (
        porArea.map(([area, lista]) => (
          <section key={area} className="space-y-2">
            <TituloSeccion as="h2" className="mb-0">{area} · {lista.length}</TituloSeccion>

            {/* Escritorio: tabla */}
            <div className="hidden md:block overflow-x-auto rounded-xl border border-border bg-card">
              <table className="w-full text-sm">
                <thead>
                  <tr className="text-left text-xs text-muted-foreground border-b border-border">
                    {esAdmin && <th className="w-8 p-2" />}
                    <th className="p-2 font-semibold">Tipo</th><th className="p-2 font-semibold">Rev</th><th className="p-2 font-semibold">#</th>
                    <th className="p-2 font-semibold">Nombre</th><th className="p-2 font-semibold">Código</th>
                    <th className="p-2 font-semibold">Responsable</th><th className="p-2 font-semibold">Último registro</th>
                    <th className="p-2 font-semibold">Vence</th><th className="p-2 font-semibold">Módulos</th><th className="p-2 font-semibold">Aplica</th>
                  </tr>
                </thead>
                <tbody>
                  {lista.map(d => (
                    <tr key={d.id} className="border-b border-border last:border-0 align-top" style={d.alertas.length ? { backgroundColor: 'var(--agro-info-fill)' } : undefined}>
                      {esAdmin && <td className="p-2"><input type="checkbox" aria-label={`Seleccionar ${d.nombre}`} checked={seleccion.has(d.id)} onChange={() => alternar(d.id)} /></td>}
                      <td className="p-2">{d.tipo_doc}</td><td className="p-2">{d.revision}</td><td className="p-2">{d.numeral}</td>
                      <td className="p-2 min-w-48">
                        <button type="button" className="text-left font-semibold hover:underline" onClick={() => setEditar({ abierto: true, doc: d })}>{d.nombre}</button>
                        <ChipPlantilla d={d} />
                        {d.alertas.map((a, i) => <p key={i} className="text-xs mt-0.5" style={{ color: 'var(--agro-info-text)' }}>{a.mensaje}</p>)}
                      </td>
                      <td className="p-2 whitespace-nowrap">{d.codigo}</td><td className="p-2">{d.responsable_llenado}</td>
                      <td className="p-2">{textoRegistro(d)}</td>
                      <td className="p-2"><div className="flex flex-col gap-1 items-start">{d.vence_el && <span className="text-xs">{fechaLarga(d.vence_el)}</span>}<ChipVigencia vigencia={d.vigencia} /></div></td>
                      <td className="p-2 text-xs">{d.modulos_mady?.join(', ')}</td>
                      <td className="p-2">
                        <SelectAplica d={d} esAdmin={esAdmin} ocupado={accion.ocupado} onCambiar={v => pedirAplicabilidad([d.id], v)} />
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>

            {/* Celular: tarjetas */}
            <div className="md:hidden space-y-2">
              {lista.map(d => (
                <div key={d.id} className="rounded-xl border border-border bg-card p-3 space-y-2" style={d.alertas.length ? { borderColor: 'var(--agro-info-text)' } : undefined}>
                  <div className="flex items-start gap-2">
                    {esAdmin && <input type="checkbox" className="mt-1" aria-label={`Seleccionar ${d.nombre}`} checked={seleccion.has(d.id)} onChange={() => alternar(d.id)} />}
                    <button type="button" className="text-left flex-1 min-w-0" onClick={() => setEditar({ abierto: true, doc: d })}>
                      <p className="text-sm font-semibold">{d.nombre}</p>
                      <ChipPlantilla d={d} />
                      <p className="text-xs text-muted-foreground">{[d.tipo_doc, d.codigo, d.revision ? `Rev ${d.revision}` : null, d.numeral ? `#${d.numeral}` : null].filter(Boolean).join(' · ')}</p>
                    </button>
                    <ChipVigencia vigencia={d.vigencia} />
                  </div>
                  <div className="text-xs text-muted-foreground space-y-0.5">
                    {d.responsable_llenado && <p>Responsable: {d.responsable_llenado}</p>}
                    {textoRegistro(d) && <p>Último registro: {textoRegistro(d)}</p>}
                    {d.vence_el && <p>Vence: {fechaLarga(d.vence_el)}</p>}
                    {d.modulos_mady && d.modulos_mady.length > 0 && <p>Módulos M.A.D.Y: {d.modulos_mady.join(', ')}</p>}
                  </div>
                  {d.alertas.map((a, i) => <Aviso key={i}>{a.mensaje}</Aviso>)}
                  <SelectAplica d={d} esAdmin={esAdmin} ocupado={accion.ocupado} onCambiar={v => pedirAplicabilidad([d.id], v)} />
                </div>
              ))}
            </div>
          </section>
        ))
      )}

      <DocumentoSheet
        open={editar.abierto}
        instalacionId={inst.id}
        documento={editar.doc}
        soloLectura={!esAdmin}
        onClose={() => setEditar(s => ({ ...s, abierto: false }))}
        onGuardado={onRecargar}
      />
      <MotivoNoAplicaSheet
        ids={motivoSheet}
        ocupado={accion.ocupado}
        onClose={() => setMotivoSheet(null)}
        onConfirmar={async motivo => { if (motivoSheet && await cambiarAplicabilidad(motivoSheet, 'no_aplica', motivo)) setMotivoSheet(null) }}
      />
      <BottomSheet open={confirmarPrecarga} onClose={() => setConfirmarPrecarga(false)} title="Cargar módulos del sector">
        {confirmarPrecarga && (
          <>
            <div className="px-4 py-4">
              <p className="text-sm text-muted-foreground">Se agregarán los módulos que falten y el catálogo tendrá que aprobarse de nuevo.</p>
            </div>
            <PieFormulario onCancelar={() => setConfirmarPrecarga(false)} onGuardar={cargarModulos} textoGuardar="Cargar módulos" cargando={precarga.ocupado} />
          </>
        )}
      </BottomSheet>
      <AprobarSheet
        open={aprobarAbierto}
        bloqueos={bloqueos}
        instalacionId={inst.id}
        onClose={() => setAprobarAbierto(false)}
        onAprobado={onRecargar}
      />
    </div>
  )
}

function ChipPlantilla({ d }: { d: ChkDocumento }) {
  if (d.origen !== 'plantilla') return null
  return <Chip className="mt-1">Módulo M.A.D.Y.{d.modulos_mady?.[0] ? ` · ${d.modulos_mady[0]}` : ''}</Chip>
}

function SelectAplica({ d, esAdmin, ocupado, onCambiar }: { d: ChkDocumento; esAdmin: boolean; ocupado: boolean; onCambiar: (v: Aplicabilidad) => void }) {
  if (!esAdmin) {
    return <Chip tono={d.aplicabilidad === 'aplica' ? TONOS.exito : d.aplicabilidad === 'por_confirmar' ? TONOS.info : TONOS.neutro}>{ETIQUETA_APLICA[d.aplicabilidad]}</Chip>
  }
  return (
    <div className="space-y-1">
      <select
        aria-label={`Aplicabilidad de ${d.nombre}`}
        className="h-9 rounded-lg border border-border-control bg-card px-2 text-xs text-foreground"
        value={d.aplicabilidad}
        disabled={ocupado}
        onChange={e => onCambiar(e.target.value as Aplicabilidad)}
      >
        {(Object.keys(ETIQUETA_APLICA) as Aplicabilidad[]).map(k => <option key={k} value={k}>{ETIQUETA_APLICA[k]}</option>)}
      </select>
      {d.aplicabilidad === 'no_aplica' && d.motivo_no_aplica && <p className="text-xs text-muted-foreground">{d.motivo_no_aplica}</p>}
    </div>
  )
}

function MotivoNoAplicaSheet({ ids, ocupado, onClose, onConfirmar }: { ids: string[] | null; ocupado: boolean; onClose: () => void; onConfirmar: (motivo: string) => void }) {
  const [motivo, setMotivo] = useState('')
  return (
    <BottomSheet open={!!ids} onClose={onClose} title="¿Por qué no aplica?">
      {ids && (
        <>
          <div className="px-4 py-4 space-y-2">
            <p className="text-xs text-muted-foreground">{ids.length === 1 ? 'Este documento' : `Estos ${ids.length} documentos`} quedará{ids.length === 1 ? '' : 'n'} fuera de las visitas. El motivo es obligatorio.</p>
            <textarea className="w-full min-h-20 rounded-lg border border-border-control bg-card px-3 py-2 text-sm" value={motivo} maxLength={300} onChange={e => setMotivo(e.target.value)} />
          </div>
          <PieFormulario onCancelar={onClose} textoGuardar="Confirmar" cargando={ocupado} deshabilitado={motivo.trim().length < 3}
            onGuardar={() => onConfirmar(motivo.trim())} />
        </>
      )}
    </BottomSheet>
  )
}

function AprobarSheet({ open, bloqueos, instalacionId, onClose, onAprobado }: { open: boolean; bloqueos: string[]; instalacionId: string; onClose: () => void; onAprobado: () => void }) {
  const [notas, setNotas] = useState('')
  const { ocupado, ejecutar } = useAccion()
  async function aprobar() {
    const r = await ejecutar(() => chk.catalogoAprobar(instalacionId, notas.trim() || null))
    if (!r.ok) { toast.error(mensajeError(r.error)); return }
    toast.success('Catálogo aprobado')
    onAprobado()
    onClose()
  }
  return (
    <BottomSheet open={open} onClose={onClose} title="Aprobar catálogo">
      {open && (
        <>
          <div className="px-4 py-4 space-y-3">
            {bloqueos.length > 0 ? (
              <Aviso>
                <p className="font-semibold mb-1">Aún no se puede aprobar:</p>
                <ul className="list-disc pl-4 space-y-0.5">{bloqueos.map((b, i) => <li key={i}>{b}</li>)}</ul>
                <p className="mt-1">Confirma la aplicabilidad de cada documento y valida las alertas.</p>
              </Aviso>
            ) : (
              <p className="text-sm text-muted-foreground">Al aprobar, se podrán programar visitas con este catálogo. Cada visita parte con todos los documentos sin revisar.</p>
            )}
            <label className="block space-y-1">
              <span className="text-xs text-muted-foreground">Notas (opcional)</span>
              <input className={CLASE_INPUT} value={notas} maxLength={300} onChange={e => setNotas(e.target.value)} />
            </label>
          </div>
          <PieFormulario onCancelar={onClose} onGuardar={aprobar} textoGuardar="Aprobar" cargando={ocupado} deshabilitado={bloqueos.length > 0} />
        </>
      )}
    </BottomSheet>
  )
}
