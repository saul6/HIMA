import { useMemo, useState } from 'react'
import { motion, useReducedMotion } from 'motion/react'
import { entrada, useEntradaPantalla } from '@/lib/motion'
import { fundidoEntrada } from '@/app/screens/auditor/motionAuditor'
import { ChevronLeft, Info } from 'lucide-react'
import { useAuthContext } from '@/context/AuthContext'
import { FiltroPildoras } from '@/app/components/FiltroPildoras'
import { iconoTipoInstalacion } from './iconoTipoInstalacion'
import { TarjetaContador } from '@/app/components/ui-mady/TarjetaContador'
import { chk, useCarga, useSectoresChk, type CarteraCliente, type CarteraInstalacion, type CatalogoVer, type ChkAlcance } from '@/hooks/useChecklistV2'
import { CLASE_INPUT, ChipCatalogo, ErrorReintentar } from './comun'
import { CatalogoTab } from './CatalogoTab'
import { ChecklistSkeleton } from './ChecklistSkeleton'
import { VisitasTab } from './VisitasTab'
import { IncidenciasTab } from './IncidenciasTab'
import { RelacionesTab } from './RelacionesTab'
import { ImportacionesTab } from './ImportacionesTab'
import { ImportarSheet } from './ImportarSheet'
import { ImportacionPreview } from './ImportacionPreview'
import { SelectorSegmentado } from '@/app/components/ui-mady/SelectorSegmentado'
import { useEsEscritorio } from './useEsEscritorio'

export type TabInstalacion = 'catalogo' | 'visitas' | 'incidencias' | 'relaciones' | 'importaciones'

interface Props {
  instalacionId: string
  esAdmin: boolean
  puedeRevisar: boolean
  codigoClave: string
  tab: TabInstalacion
  onTab: (t: TabInstalacion) => void
  onAbrirVisita: (visitaId: string) => void
  onCambio: () => void
  /** Cartera ya cargada en la pantalla: alimenta el selector de instalación y los indicadores. */
  cartera: CarteraCliente[]
  onCambiarInstalacion: (id: string) => void
  /** Escritorio: flecha de regreso a la Cartera del encabezado. */
  onVolver?: () => void
}

export function InstalacionView({ instalacionId, esAdmin, puedeRevisar, codigoClave, tab, onTab, onAbrirVisita, onCambio, cartera, onCambiarInstalacion, onVolver }: Props) {
  const esEscritorio = useEsEscritorio()
  const reducedMotion = useReducedMotion()
  const [comoAbierto, setComoAbierto] = useState(false)
  const { profile } = useAuthContext()
  const sectores = useSectoresChk()
  const catalogo = useCarga<CatalogoVer>(instalacionId, () => chk.catalogoVer(instalacionId))
  const alcancesCarga = useCarga<ChkAlcance[]>(instalacionId, () => chk.alcancesLista(instalacionId))
  const alcances = alcancesCarga.data ?? []
  const [version, setVersion] = useState(0)
  const [importarAbierto, setImportarAbierto] = useState(false)
  const [previewId, setPreviewId] = useState<string | null>(null)
  const ent = useEntradaPantalla(!catalogo.loading)

  const opciones = useMemo(
    () => cartera.flatMap(c => c.instalaciones.filter(i => i.activo || i.id === instalacionId).map(i => ({ id: i.id, etiqueta: `${c.nombre} · ${i.nombre}` }))),
    [cartera, instalacionId],
  )
  const deCartera: CarteraInstalacion | null = useMemo(
    () => cartera.flatMap(c => c.instalaciones).find(i => i.id === instalacionId) ?? null,
    [cartera, instalacionId],
  )

  const refrescar = () => { setVersion(v => v + 1); void catalogo.recargar(); void alcancesCarga.recargar(); onCambio() }

  if (catalogo.loading && !catalogo.data) return <ChecklistSkeleton variante="detalle" onReintentar={catalogo.recargar} />
  if (catalogo.error || !catalogo.data) return <ErrorReintentar mensaje={catalogo.error ?? 'No se pudo cargar la instalación'} onReintentar={catalogo.recargar} />
  const cat = catalogo.data
  const IconoSector = iconoTipoInstalacion(cat.instalacion.sector_clave, cat.instalacion.sector_nombre, sectores.find(s => s.clave === cat.instalacion.sector_clave)?.icono)

  const tabs = [
    { value: 'catalogo', label: 'Catálogo' },
    { value: 'visitas', label: 'Visitas' },
    { value: 'incidencias', label: 'Incidencias' },
    ...(esAdmin ? [{ value: 'relaciones', label: 'Relaciones' }] : []),
    ...(esAdmin ? [{ value: 'importaciones', label: 'Importaciones' }] : []),
  ]

  const aplicables = cat.documentos.filter(d => d.activo && !d.es_nota && d.aplicabilidad === 'aplica').length
  const incidenciasAbiertas = deCartera?.incidencias_abiertas ?? cat.documentos.reduce((n, d) => n + (d.activo ? d.incidencias_abiertas : 0), 0)
  const enCurso = deCartera?.visita_en_curso ?? null
  const subVisita = enCurso ? 'Abre la visita en curso para ver el avance' : 'Sin visita en curso'
  const alcancesActivos = alcances.filter(a => a.activo).map(a => a.nombre)
  const sinLiga = deCartera ? !deCartera.linked_rancho_id : false

  const infoComoFunciona = (
    <div className="rounded-lg px-3 py-2 text-xs space-y-1" style={{ backgroundColor: 'var(--agro-info-fill)', color: 'var(--agro-info-text)' }}>
      <p>La información se hereda del historial, pero cada documento requiere una revisión nueva en esta visita.</p>
      {sinLiga && <p>Esta instalación no consulta registros operativos de M.A.D.Y.</p>}
    </div>
  )
  const nombreTipo = cat.instalacion.sector_nombre ?? cat.instalacion.tipo

  const selectorInstalacion = (
    <label className={esEscritorio ? 'block w-72 max-w-full flex-shrink-0' : 'block space-y-1'}>
      <span className={esEscritorio ? 'sr-only' : 'text-xs text-muted-foreground'}>Instalación</span>
      <select className={`${CLASE_INPUT} font-semibold`} value={instalacionId} onChange={e => { if (e.target.value !== instalacionId) onCambiarInstalacion(e.target.value) }}>
        {opciones.map(o => <option key={o.id} value={o.id}>{o.etiqueta}</option>)}
      </select>
    </label>
  )

  return (
    <div className="space-y-4">
      <motion.div {...ent(0)}>
      {esEscritorio ? (
        <div className="flex items-start gap-3">
          {onVolver && (
            <button
              type="button"
              onClick={onVolver}
              aria-label="Volver a Cartera"
              className="-ml-2 mt-0.5 flex-shrink-0 rounded-lg p-2 text-muted-foreground transition-colors hover:bg-muted focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ring"
            >
              <ChevronLeft className="w-5 h-5" aria-hidden="true" />
            </button>
          )}
          <div className="min-w-0 flex-1 space-y-1">
            <h2 className="truncate text-lg font-semibold text-foreground">{cat.instalacion.nombre}</h2>
            <div className="flex flex-wrap items-center gap-x-3 gap-y-1 text-xs text-muted-foreground">
              <span className="font-semibold text-foreground">{cat.instalacion.cliente}</span>
              {nombreTipo && (
                <span className="flex items-center gap-1">
                  <IconoSector className="w-3 h-3 flex-shrink-0" aria-hidden="true" />
                  {nombreTipo}
                </span>
              )}
              <ChipCatalogo estado={cat.instalacion.catalogo_estado} />
              {alcancesActivos.length > 0 && <span>Alcance: {alcancesActivos.join(', ')}</span>}
            </div>
          </div>
          {selectorInstalacion}
        </div>
      ) : (
        <div className="space-y-2">
          {selectorInstalacion}
          <div className="flex flex-wrap items-center gap-x-3 gap-y-1 text-xs text-muted-foreground">
            <span className="font-semibold text-foreground">{cat.instalacion.cliente}</span>
            {alcancesActivos.length > 0 && <span>Alcance: {alcancesActivos.join(', ')}</span>}
            {nombreTipo && (
              <span className="flex items-center gap-1">
                <IconoSector className="w-3 h-3 flex-shrink-0" aria-hidden="true" />
                {nombreTipo}
              </span>
            )}
            <ChipCatalogo estado={cat.instalacion.catalogo_estado} />
          </div>
        </div>
      )}
      </motion.div>

      <motion.div className="grid grid-cols-2 lg:grid-cols-4 gap-3" {...ent(1)}>
        <TarjetaContador etiqueta="Documentos aplicables" valor={aplicables} />
        <TarjetaContador etiqueta="Revisados en esta visita" valor={esEscritorio ? <span className="text-muted-foreground">—</span> : null} sub={subVisita} />
        <TarjetaContador etiqueta="Pendientes de revisión" valor={esEscritorio ? <span className="text-muted-foreground">—</span> : null} sub={subVisita} />
        <TarjetaContador etiqueta="Incidencias abiertas" valor={incidenciasAbiertas} tono={esEscritorio && incidenciasAbiertas === 0 ? 'normal' : 'alertaTexto'} />
      </motion.div>

      {esEscritorio ? (
        <>
          <div className="flex flex-wrap items-center justify-between gap-3">
            <SelectorSegmentado<string> ariaLabel="Secciones de la instalación" value={tab} onChange={v => onTab(v as TabInstalacion)} options={tabs} />
            <button
              type="button"
              aria-expanded={comoAbierto}
              onClick={() => setComoAbierto(v => !v)}
              className="inline-flex items-center gap-1.5 rounded-sm text-xs font-semibold text-muted-foreground transition-colors hover:text-foreground focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ring"
            >
              <Info className="w-4 h-4 flex-shrink-0" aria-hidden="true" /> Cómo funciona
            </button>
          </div>
          {comoAbierto && infoComoFunciona}
        </>
      ) : (
        <>
          <details className="group rounded-lg px-3 py-2 text-xs" style={{ backgroundColor: 'var(--agro-info-fill)', color: 'var(--agro-info-text)' }}>
            <summary className="cursor-pointer font-semibold flex items-center gap-1.5 list-none">
              <Info className="w-4 h-4 flex-shrink-0" aria-hidden="true" /> Cómo funciona
            </summary>
            <div className="mt-1.5 space-y-1">
              <p>La información se hereda del historial, pero cada documento requiere una revisión nueva en esta visita.</p>
              {sinLiga && <p>Esta instalación no consulta registros operativos de M.A.D.Y.</p>}
            </div>
          </details>

          <FiltroPildoras<string> groupId="chk-instalacion-tab" value={tab} onChange={v => onTab(v as TabInstalacion)} options={tabs} />
        </>
      )}

      <motion.div key={tab} {...fundidoEntrada(reducedMotion)}>
      {tab === 'catalogo' && <CatalogoTab catalogo={cat} alcances={alcances} esAdmin={esAdmin} onRecargar={refrescar} onImportar={() => setImportarAbierto(true)} />}
      {tab === 'visitas' && (
        <VisitasTab
          instalacionId={instalacionId} alcances={alcances} catalogoEstado={cat.instalacion.catalogo_estado} esAdmin={esAdmin} puedeRevisar={puedeRevisar}
          perfilId={profile?.id} version={version} codigoClave={codigoClave} onAbrirVisita={onAbrirVisita} onCambio={refrescar}
        />
      )}
      {tab === 'incidencias' && <IncidenciasTab instalacionId={instalacionId} version={version} />}
      {tab === 'relaciones' && esAdmin && <RelacionesTab instalacionId={instalacionId} version={version} />}
      {tab === 'importaciones' && esAdmin && (
        <ImportacionesTab instalacionId={instalacionId} version={version} onAbrir={setPreviewId} onImportar={() => setImportarAbierto(true)} />
      )}
      </motion.div>

      {esAdmin && (
        <>
          <ImportarSheet open={importarAbierto} instalacionId={instalacionId} alcances={alcances.filter(a => a.activo)} onClose={() => setImportarAbierto(false)}
            onCreada={id => { setVersion(v => v + 1); setPreviewId(id) }} />
          <ImportacionPreview alcances={alcances} importacionId={previewId} onClose={() => setPreviewId(null)} onCambio={refrescar} />
        </>
      )}
    </div>
  )
}
