// Checklist de documentos (M80) v2. Una sola ruta (/inocuidad/checklist) con vistas por query string:
//   (sin params)                    → cartera de clientes e instalaciones (consultoría) o "Mis revisiones" (cliente)
//   ?instalacion=<id>               → instalación (catálogo / visitas / incidencias / importaciones)
//   ?instalacion=<id>&visita=<id>   → visita (programada, en curso o cerrada)
//   ?sitio=<rancho_id>              → compatibilidad con enlaces viejos: busca la instalación ligada a ese sitio
import { useEffect, useMemo } from 'react'
import { Navigate, useSearchParams } from 'react-router'
import { ChevronLeft } from 'lucide-react'
import { useAuthContext } from '@/context/AuthContext'
import { EncabezadoPantalla } from '@/app/components/EncabezadoPantalla'
import { EstadoVacio } from '@/app/components/ui-mady/EstadoVacio'
import { FiltroPildoras } from '@/app/components/FiltroPildoras'
import { ClipboardCheck } from 'lucide-react'
import { ChecklistSkeleton } from '@/app/components/checklist/ChecklistSkeleton'
import { useMostrarCarga } from '@/hooks/useMostrarCarga'
import { chk, useCarga, type CarteraCliente, type ChkEstado } from '@/hooks/useChecklistV2'
import { ErrorReintentar } from '@/app/components/checklist/comun'
import { CarteraView } from '@/app/components/checklist/CarteraView'
import { InstalacionView, type TabInstalacion } from '@/app/components/checklist/InstalacionView'
import { VisitaEjecucion } from '@/app/components/checklist/VisitaEjecucion'
import { PortalCliente } from '@/app/components/checklist/PortalCliente'

const TABS: TabInstalacion[] = ['catalogo', 'visitas', 'incidencias', 'importaciones']

export function ChecklistDocumentos() {
  const { profile, codigoClave } = useAuthContext()
  const [params, setParams] = useSearchParams()
  const instalacionId = params.get('instalacion')
  const visitaId = params.get('visita')
  const sitioLegacy = params.get('sitio')
  const vista = params.get('vista')
  const tabParam = params.get('tab') as TabInstalacion | null

  const rol = profile?.rol
  const rolOk = rol === 'admin_org' || rol === 'asesor_tecnico' || rol === 'super_admin'

  const estado = useCarga<ChkEstado>(rolOk ? 'estado' : null, () => chk.estado())
  const est = estado.data
  const cartera = useCarga<CarteraCliente[]>(est?.consultoria ? 'cartera' : null, () => chk.cartera())
  const mostrarSkeleton = useMostrarCarga(estado.loading || (!!est?.consultoria && cartera.loading), !!est)

  // ?sitio= → instalación ligada a ese sitio (o a la cartera si no hay)
  useEffect(() => {
    if (!sitioLegacy || !cartera.data) return
    const inst = cartera.data.flatMap(c => c.instalaciones).find(i => i.linked_rancho_id === sitioLegacy)
    const p = new URLSearchParams(params)
    p.delete('sitio')
    if (inst) p.set('instalacion', inst.id)
    setParams(p, { replace: true })
  }, [sitioLegacy, cartera.data]) // eslint-disable-line react-hooks/exhaustive-deps

  const tab: TabInstalacion = tabParam && TABS.includes(tabParam) ? tabParam : visitaId ? 'visitas' : 'catalogo'

  function ir(nuevo: Record<string, string | null>) {
    const p = new URLSearchParams(params)
    for (const [k, v] of Object.entries(nuevo)) { if (v === null) p.delete(k); else p.set(k, v) }
    setParams(p)
  }

  const instalacion = useMemo(
    () => cartera.data?.flatMap(c => c.instalaciones).find(i => i.id === instalacionId) ?? null,
    [cartera.data, instalacionId],
  )

  if (!profile) return null
  if (!rolOk) return <Navigate to="/" replace />

  const esAdmin = !!est?.es_admin
  const puedeRevisar = !!est?.puede_revisar
  const consultoria = !!est?.consultoria
  const esCliente = !!est?.es_cliente
  const verCliente = esCliente && (!consultoria || vista === 'cliente')

  function volver() {
    if (visitaId) ir({ visita: null, tab: 'visitas' })
    else ir({ instalacion: null, tab: null })
  }

  const hijo = !est ? null
    : (instalacionId && consultoria) ? (
        <div className="space-y-4">
          <button type="button" onClick={volver} className="inline-flex items-center gap-1 text-sm font-semibold" style={{ color: 'var(--primary)' }}>
            <ChevronLeft className="w-4 h-4" aria-hidden="true" /> {visitaId ? 'Visitas' : 'Cartera'}
          </button>
          {visitaId ? (
            <VisitaEjecucion
              key={visitaId}
              visitaId={visitaId}
              codigoClave={codigoClave}
              onCambio={() => { if (consultoria) void cartera.recargar() }}
            />
          ) : (
            <InstalacionView
              key={instalacionId}
              instalacionId={instalacionId}
              esAdmin={esAdmin}
              puedeRevisar={puedeRevisar}
              codigoClave={codigoClave}
              tab={tab}
              onTab={t => ir({ tab: t })}
              onAbrirVisita={id => ir({ visita: id, tab: 'visitas' })}
              onCambio={() => void cartera.recargar()}
            />
          )}
        </div>
      )
    : verCliente ? <PortalCliente />
    : consultoria ? (
        cartera.error ? <ErrorReintentar mensaje={cartera.error} onReintentar={cartera.recargar} />
        : cartera.data ? <CarteraView cartera={cartera.data} esAdmin={esAdmin} onAbrir={id => ir({ instalacion: id, tab: null, visita: null })} onRecargar={() => void cartera.recargar()} />
        : null
      )
    : (
        <EstadoVacio
          icono={ClipboardCheck}
          titulo="El checklist de documentos no está habilitado para tu organización"
          ayuda="Si lo necesitas, pídelo a M.A.D.Y."
        />
      )

  return (
    <div className="min-h-full pb-safe-nav bg-background">
      <EncabezadoPantalla titulo="Checklist" />
      <div className="p-4 space-y-4">
        {consultoria && esCliente && !instalacionId && (
          <FiltroPildoras<string>
            groupId="chk-vista"
            value={verCliente ? 'cliente' : 'cartera'}
            onChange={v => ir({ vista: v === 'cliente' ? 'cliente' : null })}
            options={[{ value: 'cartera', label: 'Cartera' }, { value: 'cliente', label: 'Mis revisiones' }]}
          />
        )}

        {estado.error ? (
          <ErrorReintentar mensaje={estado.error} onReintentar={estado.recargar} />
        ) : !est ? (
          mostrarSkeleton ? <ChecklistSkeleton /> : null
        ) : instalacionId && consultoria && !cartera.data && !cartera.error ? (
          mostrarSkeleton ? <ChecklistSkeleton /> : null
        ) : (
          <>
            {instalacionId && consultoria && cartera.data && !instalacion && !visitaId ? (
              <EstadoVacio titulo="No se encontró la instalación" ayuda="Pudo desactivarse o no pertenecer a tu consultoría." />
            ) : hijo}
          </>
        )}
      </div>
    </div>
  )
}
