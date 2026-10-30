import { useMemo, useState } from 'react'
import { Info } from 'lucide-react'
import { useAuthContext } from '@/context/AuthContext'
import { FiltroPildoras } from '@/app/components/FiltroPildoras'
import { resolverIcono } from '@/app/components/iconos-modulos'
import { TarjetaContador } from '@/app/components/ui-mady/TarjetaContador'
import { chk, useCarga, useSectoresChk, type CarteraCliente, type CarteraInstalacion, type CatalogoVer, type ChkAlcance } from '@/hooks/useChecklistV2'
import { Cargando, CLASE_INPUT, ChipCatalogo, ErrorReintentar } from './comun'
import { CatalogoTab } from './CatalogoTab'
import { VisitasTab } from './VisitasTab'
import { IncidenciasTab } from './IncidenciasTab'
import { RelacionesTab } from './RelacionesTab'
import { ImportacionesTab } from './ImportacionesTab'
import { ImportarSheet } from './ImportarSheet'
import { ImportacionPreview } from './ImportacionPreview'

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
}

export function InstalacionView({ instalacionId, esAdmin, puedeRevisar, codigoClave, tab, onTab, onAbrirVisita, onCambio, cartera, onCambiarInstalacion }: Props) {
  const { profile } = useAuthContext()
  const sectores = useSectoresChk()
  const catalogo = useCarga<CatalogoVer>(instalacionId, () => chk.catalogoVer(instalacionId))
  const alcancesCarga = useCarga<ChkAlcance[]>(instalacionId, () => chk.alcancesLista(instalacionId))
  const alcances = alcancesCarga.data ?? []
  const [version, setVersion] = useState(0)
  const [importarAbierto, setImportarAbierto] = useState(false)
  const [previewId, setPreviewId] = useState<string | null>(null)

  const opciones = useMemo(
    () => cartera.flatMap(c => c.instalaciones.filter(i => i.activo || i.id === instalacionId).map(i => ({ id: i.id, etiqueta: `${c.nombre} · ${i.nombre}` }))),
    [cartera, instalacionId],
  )
  const deCartera: CarteraInstalacion | null = useMemo(
    () => cartera.flatMap(c => c.instalaciones).find(i => i.id === instalacionId) ?? null,
    [cartera, instalacionId],
  )

  const refrescar = () => { setVersion(v => v + 1); void catalogo.recargar(); void alcancesCarga.recargar(); onCambio() }

  if (catalogo.loading && !catalogo.data) return <Cargando />
  if (catalogo.error || !catalogo.data) return <ErrorReintentar mensaje={catalogo.error ?? 'No se pudo cargar la instalación'} onReintentar={catalogo.recargar} />
  const cat = catalogo.data
  const IconoSector = resolverIcono(sectores.find(s => s.clave === cat.instalacion.sector_clave)?.icono ?? '')

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

  return (
    <div className="space-y-4">
      <div className="space-y-2">
        <label className="block space-y-1">
          <span className="text-xs text-muted-foreground">Instalación</span>
          <select className={`${CLASE_INPUT} font-semibold`} value={instalacionId} onChange={e => { if (e.target.value !== instalacionId) onCambiarInstalacion(e.target.value) }}>
            {opciones.map(o => <option key={o.id} value={o.id}>{o.etiqueta}</option>)}
          </select>
        </label>
        <div className="flex flex-wrap items-center gap-x-3 gap-y-1 text-xs text-muted-foreground">
          <span className="font-semibold text-foreground">{cat.instalacion.cliente}</span>
          {alcancesActivos.length > 0 && <span>Alcance: {alcancesActivos.join(', ')}</span>}
          {(cat.instalacion.sector_nombre ?? cat.instalacion.tipo) && (
            <span className="flex items-center gap-1">
              <IconoSector className="w-3 h-3 flex-shrink-0" aria-hidden="true" />
              {cat.instalacion.sector_nombre ?? cat.instalacion.tipo}
            </span>
          )}
          <ChipCatalogo estado={cat.instalacion.catalogo_estado} />
        </div>
      </div>

      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
        <TarjetaContador etiqueta="Documentos aplicables" valor={aplicables} />
        <TarjetaContador etiqueta="Revisados en esta visita" valor={null} sub={subVisita} />
        <TarjetaContador etiqueta="Pendientes de revisión" valor={null} sub={subVisita} />
        <TarjetaContador etiqueta="Incidencias abiertas" valor={incidenciasAbiertas} tono="alertaTexto" />
      </div>

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
