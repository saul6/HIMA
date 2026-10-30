import { useMemo, useState } from 'react'
import { toast } from 'sonner'
import { Check, ChevronDown, GitBranch, Layers, Plus, Upload } from 'lucide-react'
import { Boton } from '@/app/components/ui-mady/Boton'
import { BottomSheet } from '@/app/components/BottomSheet'
import { EstadoVacio } from '@/app/components/ui-mady/EstadoVacio'
import { TituloSeccion } from '@/app/components/ui-mady/TituloSeccion'
import { FiltroPildoras } from '@/app/components/FiltroPildoras'
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from '@/app/components/ui/collapsible'
import { ContadorPildora } from './ContadorPildora'
import { chk, mensajeError, useAccion, type Aplicabilidad, type CatalogoVer, type ChkAlcance, type ChkDocumento } from '@/hooks/useChecklistV2'
import { Aviso, CLASE_INPUT, Chip, ChipCatalogo, ChipVigencia, PieFormulario, TONOS, textoRegistro } from './comun'
import { DocumentoSheet } from './DocumentoSheet'
import { AlcancesSheet } from './AlcancesSheet'
import { NOMBRE_SECCION } from './secciones'
import { fechaLarga } from './constantes'

type Filtro = 'por_confirmar' | 'alertas' | 'no_aplica' | 'vencidos'

interface Props {
  catalogo: CatalogoVer
  alcances: ChkAlcance[]
  esAdmin: boolean
  onRecargar: () => void
  onImportar: () => void
}

const ETIQUETA_APLICA: Record<Aplicabilidad, string> = { aplica: 'Aplica', no_aplica: 'No aplica', por_confirmar: 'Por confirmar' }

export function CatalogoTab({ catalogo, alcances, esAdmin, onRecargar, onImportar }: Props) {
  const { instalacion: inst } = catalogo
  // Filtro por alcance: '' = todos, 'compartidos' = sin alcance, o el id del alcance
  const [alcanceSel, setAlcanceSel] = useState('')
  const [alcancesAbierto, setAlcancesAbierto] = useState(false)
  const [seccion, setSeccion] = useState(1)
  const docsAlcance = catalogo.documentos.filter(d => d.activo && (
    !alcanceSel || (alcanceSel === 'compartidos' ? d.alcance_id === null : d.alcance_id === alcanceSel)))
  const docs = docsAlcance.filter(d => d.seccion === seccion)
  const porSeccion = (n: number) => docsAlcance.filter(d => d.seccion === n).length
  const nombreAlcance = (id: string | null) => (id ? alcances.find(a => a.id === id)?.nombre ?? 'Alcance' : 'Compartido')
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

  // La aprobación mira todo el catálogo, no solo la sección o el alcance a la vista
  const todos = catalogo.documentos.filter(d => d.activo)
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
      const k = d.area?.trim() || d.categoria?.trim() || 'Sin área'
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
  const nPorConfirmar = todos.filter(d => d.aplicabilidad === 'por_confirmar').length
  const nAlertas = todos.filter(d => d.alertas.length > 0).length
  if (todos.length === 0) bloqueos.push('El catálogo está vacío.')
  if (nPorConfirmar > 0) bloqueos.push(`${nPorConfirmar} documento(s) con aplicabilidad por confirmar.`)
  if (nAlertas > 0) bloqueos.push(`${nAlertas} documento(s) con alertas por validar.`)
  if (todos.length > 0 && todos.every(d => d.aplicabilidad !== 'aplica')) bloqueos.push('Ningún documento aplica.')

  return (
    <div className="space-y-4">
      <Collapsible defaultOpen={inst.catalogo_estado !== 'aprobado'} className="rounded-xl border border-border bg-card">
        <CollapsibleTrigger className="group flex w-full items-center justify-between gap-2 px-4 py-3 text-left">
          <span className="flex flex-wrap items-center gap-2">
            <span className="text-sm font-semibold">Configuración documental{esAdmin ? ' · administración' : ''}</span>
            <ChipCatalogo estado={inst.catalogo_estado} />
          </span>
          <ChevronDown className="w-4 h-4 text-muted-foreground transition-transform group-data-[state=open]:rotate-180" aria-hidden="true" />
        </CollapsibleTrigger>
        <CollapsibleContent className="px-4 pb-4 space-y-3">
          <p className="text-xs text-muted-foreground">
            Versión {inst.catalogo_version}{inst.aprobado_en ? ` · aprobado el ${fechaLarga(inst.aprobado_en)}${inst.aprobado_por ? ` por ${inst.aprobado_por}` : ''}` : ''}
          </p>
          {inst.catalogo_estado !== 'aprobado' ? (
            todos.length > 0
              ? <Aviso>Catálogo pendiente de aprobación. Solo con el catálogo aprobado se pueden programar visitas; un catálogo en borrador no genera revisiones.</Aviso>
              : <Aviso>Catálogo pendiente de aprobación.</Aviso>
          ) : (
            <Aviso>Catálogo autorizado para visitas. Si lo modificas, tendrá que aprobarse de nuevo.</Aviso>
          )}
          {esAdmin && (
            <div className="flex flex-wrap gap-2">
              <Boton tamano="sm" variante="secundario" cargando={precarga.ocupado} onClick={pedirPrecarga}><Layers className="w-4 h-4" /> Cargar módulos del sector</Boton>
              <Boton tamano="sm" variante="secundario" onClick={() => setAlcancesAbierto(true)}><GitBranch className="w-4 h-4" /> Alcances</Boton>
              <Boton tamano="sm" variante="secundario" onClick={onImportar}><Upload className="w-4 h-4" /> Importar</Boton>
              <Boton tamano="sm" variante="secundario" onClick={() => setEditar({ abierto: true, doc: null })}><Plus className="w-4 h-4" /> Documento</Boton>
            </div>
          )}
        </CollapsibleContent>
      </Collapsible>

      <FiltroPildoras<string>
        groupId="chk-catalogo-seccion"
        value={String(seccion)}
        onChange={v => { setSeccion(Number(v)); setFiltro(null) }}
        options={[1, 2, 3].map(n => ({ value: String(n), label: <>{NOMBRE_SECCION[n]} · <ContadorPildora n={porSeccion(n)} /></> }))}
      />

      {alcances.length > 0 && (
        <FiltroPildoras<string>
          groupId="chk-catalogo-alcance"
          value={alcanceSel}
          onChange={v => setAlcanceSel(alcanceSel === v ? '' : v)}
          options={[...alcances.filter(a => a.activo).map(a => ({ value: a.id, label: a.nombre })), { value: 'compartidos', label: 'Compartidos' }]}
        />
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

      {catalogo.documentos.filter(d => d.activo).length === 0 ? (
        <EstadoVacio titulo="El catálogo de esta instalación está vacío" ayuda={esAdmin ? 'Carga los módulos del sector, importa un PDF o Word, o agrega los documentos uno por uno.' : undefined}
          accion={esAdmin && (
            <div className="flex flex-wrap justify-center gap-2">
              <Boton tamano="sm" cargando={precarga.ocupado} onClick={pedirPrecarga}><Layers className="w-4 h-4" /> Cargar módulos del sector</Boton>
              <Boton tamano="sm" variante="secundario" onClick={onImportar}><Upload className="w-4 h-4" /> Importar</Boton>
              <Boton tamano="sm" variante="secundario" onClick={() => setEditar({ abierto: true, doc: null })}><Plus className="w-4 h-4" /> Documento</Boton>
            </div>
          )} />
      ) : visibles.length === 0 ? (
        <p className="text-sm text-muted-foreground text-center py-10">{docs.length === 0 ? 'Esta sección no tiene documentos.' : 'Nada coincide con este filtro.'}</p>
      ) : (
        porArea.map(([area, lista]) => (
          <section key={area} className="space-y-2">
            <TituloSeccion as="h2" className="mb-0">{area} · {lista.length}</TituloSeccion>

            <div className="rounded-xl border border-border bg-card divide-y divide-border">
              {lista.map(d => {
                const meta = [d.tipo_doc, d.revision ? `Rev ${d.revision}` : null, d.numeral ? `#${d.numeral}` : null, d.responsable_llenado,
                  textoRegistro(d) ? `Último registro: ${textoRegistro(d)}` : null, d.vence_el ? `Vence: ${fechaLarga(d.vence_el)}` : null,
                  d.modulos_mady && d.modulos_mady.length > 0 ? `Módulos M.A.D.Y: ${d.modulos_mady.join(', ')}` : null].filter(Boolean).join(' · ')
                return (
                  <div key={d.id} className="flex flex-wrap items-start gap-x-3 gap-y-2 p-3" style={d.alertas.length ? { backgroundColor: 'var(--agro-info-fill)' } : undefined}>
                    {esAdmin && <input type="checkbox" className="mt-1" aria-label={`Seleccionar ${d.nombre}`} checked={seleccion.has(d.id)} onChange={() => alternar(d.id)} />}
                    <button type="button" className="text-left flex-1 min-w-48" onClick={() => setEditar({ abierto: true, doc: d })}>
                      <span className="flex flex-wrap items-baseline gap-x-2">
                        <span className="text-sm font-bold" style={{ color: 'var(--primary)' }}>{d.codigo || 'Sin código'}</span>
                        <span className="text-xs font-semibold uppercase tracking-wide text-foreground">{d.nombre}</span>
                      </span>
                      {meta && <span className="block text-xs text-muted-foreground mt-0.5">{meta}</span>}
                    </button>
                    <div className="flex items-center gap-2">
                      <ChipVigencia vigencia={d.vigencia} />
                      <SelectAplica d={d} esAdmin={esAdmin} ocupado={accion.ocupado} onCambiar={v => pedirAplicabilidad([d.id], v)} />
                    </div>
                    <div className="basis-full space-y-0.5 empty:hidden">
                      <ChipPlantilla d={d} />
                      <ChipsAtribucion d={d} nombreAlcance={nombreAlcance} />
                      {d.alertas.map((a, i) => <p key={i} className="text-xs mt-0.5" style={{ color: 'var(--agro-info-text)' }}>{a.mensaje}</p>)}
                    </div>
                  </div>
                )
              })}
            </div>
          </section>
        ))
      )}

      {esAdmin && (
        <div className="flex justify-end">
          <Boton onClick={() => setAprobarAbierto(true)}><Check className="w-4 h-4" /> Aprobar catálogo de la instalación</Boton>
        </div>
      )}

      {esAdmin && (
        <AlcancesSheet open={alcancesAbierto} instalacionId={inst.id} alcances={alcances} onClose={() => setAlcancesAbierto(false)} onCambio={onRecargar} />
      )}
      <DocumentoSheet
        open={editar.abierto}
        instalacionId={inst.id}
        alcances={alcances}
        seccionInicial={seccion}
        alcanceInicial={alcanceSel && alcanceSel !== 'compartidos' ? alcanceSel : ''}
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

function ChipsAtribucion({ d, nombreAlcance }: { d: ChkDocumento; nombreAlcance: (id: string | null) => string }) {
  return (
    <span className="flex flex-wrap gap-1 mt-1">
      {d.es_nota && <Chip tono={TONOS.info}>Observación general</Chip>}
      <Chip>{nombreAlcance(d.alcance_id)}</Chip>
      {d.atribucion_por_confirmar && <Chip tono={TONOS.info}>Atribución por confirmar</Chip>}
    </span>
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
