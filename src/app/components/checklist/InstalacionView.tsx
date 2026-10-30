import { useState } from 'react'
import { useAuthContext } from '@/context/AuthContext'
import { FiltroPildoras } from '@/app/components/FiltroPildoras'
import { resolverIcono } from '@/app/components/iconos-modulos'
import { chk, useCarga, useSectoresChk, type CatalogoVer, type ChkAlcance } from '@/hooks/useChecklistV2'
import { Cargando, ErrorReintentar } from './comun'
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
}

export function InstalacionView({ instalacionId, esAdmin, puedeRevisar, codigoClave, tab, onTab, onAbrirVisita, onCambio }: Props) {
  const { profile } = useAuthContext()
  const sectores = useSectoresChk()
  const catalogo = useCarga<CatalogoVer>(instalacionId, () => chk.catalogoVer(instalacionId))
  const alcancesCarga = useCarga<ChkAlcance[]>(instalacionId, () => chk.alcancesLista(instalacionId))
  const alcances = alcancesCarga.data ?? []
  const [version, setVersion] = useState(0)
  const [importarAbierto, setImportarAbierto] = useState(false)
  const [previewId, setPreviewId] = useState<string | null>(null)

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

  return (
    <div className="space-y-4">
      <div>
        <p className="text-sm font-semibold text-foreground">{cat.instalacion.cliente} · {cat.instalacion.nombre}</p>
        {(cat.instalacion.sector_nombre ?? cat.instalacion.tipo) && (
          <p className="text-xs text-muted-foreground flex items-center gap-1">
            <IconoSector className="w-3 h-3 flex-shrink-0" aria-hidden="true" />
            {cat.instalacion.sector_nombre ?? cat.instalacion.tipo}
          </p>
        )}
      </div>

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
          <ImportarSheet open={importarAbierto} instalacionId={instalacionId} onClose={() => setImportarAbierto(false)}
            onCreada={id => { setVersion(v => v + 1); setPreviewId(id) }} />
          <ImportacionPreview importacionId={previewId} onClose={() => setPreviewId(null)} onCambio={refrescar} />
        </>
      )}
    </div>
  )
}
