import { useParams, useNavigate, useLocation, Navigate, Outlet } from 'react-router'
import { MapPin, ClipboardCheck, ChevronRight } from 'lucide-react'
import { useAuthContext } from '@/context/AuthContext'
import { fechaCorta } from '@/lib/formato'
import { useAuditorOrg } from '@/hooks/useAuditorOrg'
import type { AuditorAuditoriaItem } from '@/hooks/useAuditorOrg'
import { Fab } from '@/app/components/Fab'
import { ModuloHeader } from '@/app/components/ModuloHeader'
import { motion, useReducedMotion } from 'motion/react'
import { Skeleton } from '@/app/components/ui/skeleton'
import { ListaSkeleton } from '@/app/components/ListaSkeleton'
import { useMostrarCarga } from '@/hooks/useMostrarCarga'
import { EstadoVacio } from '@/app/components/ui-mady/EstadoVacio'
import { Boton } from '@/app/components/ui-mady/Boton'
import { Etiqueta } from '@/app/components/ui-mady/Etiqueta'
import { estadoAuditoria } from './estados'
import { TituloSeccion } from '@/app/components/ui-mady/TituloSeccion'
import { entrada } from './motionAuditor'

function AuditoriaCard({
  a, index, reducedMotion, onClick,
}: { a: AuditorAuditoriaItem; index: number; reducedMotion: boolean | null; onClick: () => void }) {
  const estado = estadoAuditoria(a.estado)
  return (
    <motion.div {...entrada(index, reducedMotion)}>
    <button
      onClick={onClick}
      className="hover-lift w-full text-left bg-card rounded-xl border border-border p-4 flex flex-col gap-1.5 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ring"
    >
      <div className="flex items-start justify-between gap-2">
        <div className="flex-1 min-w-0">
          <p className="text-sm font-semibold truncate" style={{ color: 'var(--foreground)' }}>
            {a.modulos.length > 0 ? a.modulos.join(' · ') : 'Auditoría PrimusGFS'}
          </p>
          <p className="text-xs mt-0.5" style={{ color: 'var(--muted-foreground)' }}>
            {a.rancho_nombre} · {fechaCorta(a.fecha)}
          </p>
        </div>
        <Etiqueta tono={estado.tono}>{estado.texto}</Etiqueta>
        <ChevronRight className="size-4 shrink-0 text-muted-foreground" aria-hidden="true" />
      </div>
    </button>
    </motion.div>
  )
}

export function AuditorOrgDetalle() {
  const { orgId } = useParams<{ orgId: string }>()
  const navigate = useNavigate()
  const location = useLocation()
  const { profile } = useAuthContext()
  const { ranchos, auditorias, loading, error, refetch } = useAuditorOrg(orgId)
  const reducedMotion = useReducedMotion()
  const mostrarSkeleton = useMostrarCarga(loading, ranchos.length > 0 || auditorias.length > 0)

  const nombreEmpresa = (location.state as { orgNombre?: string } | null)?.orgNombre
  const orgNombre: string = nombreEmpresa ?? 'Empresa auditada'

  if (profile !== null && profile.rol !== 'auditor' && profile.rol !== 'super_admin') {
    return <Navigate to="/" replace />
  }

  return (
    <div className="flex flex-col min-h-screen bg-background pb-24">
      <ModuloHeader
        tituloFallback="Empresa"
        forzarTitulo={nombreEmpresa}
        subtitulo="Instalaciones y auditorías"
        onBack={() => navigate('/auditor')}
      />

      {loading ? (
        mostrarSkeleton ? (
          <div className="px-4 py-4 flex flex-col gap-6">
            <div className="space-y-2.5">
              <Skeleton className="h-3 w-28" />
              <ListaSkeleton rows={2} />
            </div>
            <div className="space-y-2.5">
              <Skeleton className="h-3 w-28" />
              <ListaSkeleton rows={3} />
            </div>
          </div>
        ) : null
      ) : error ? (
        <div className="flex flex-col items-center gap-2 py-16 px-4">
          <p className="text-sm text-center" style={{ color: 'var(--agro-danger-text)' }}>{error}</p>
          <Boton variante="secundario" onClick={refetch}>
            Reintentar
          </Boton>
        </div>
      ) : (
        <main className="flex-1 w-full px-4 py-4 flex flex-col gap-6 lg:grid lg:grid-cols-2 lg:items-start lg:gap-x-6 lg:max-w-5xl">
          {/* Instalaciones */}
          <section>
            <div className="flex items-center gap-2 mb-2.5">
              <TituloSeccion as="p" className="mb-0">Instalaciones</TituloSeccion>
              <Etiqueta tono="neutral">{ranchos.length}</Etiqueta>
            </div>
            {ranchos.length === 0 ? (
              <EstadoVacio icono={MapPin} titulo="Sin instalaciones registradas." />
            ) : (
              <div className="flex flex-col gap-2">
                {ranchos.map((r, index) => (
                  <motion.div
                    key={r.id}
                    {...entrada(index, reducedMotion)}
                    className="bg-muted rounded-lg px-4 py-3 flex items-center gap-3"
                  >
                    <MapPin aria-hidden="true" size={15} style={{ color: 'var(--muted-foreground)' }} className="flex-shrink-0" />
                    <div className="flex-1 min-w-0">
                      <p className="text-sm font-medium truncate" style={{ color: 'var(--foreground)' }}>{r.nombre}</p>
                      {(r.codigo || r.cultivo) && (
                        <p className="text-xs" style={{ color: 'var(--muted-foreground)' }}>
                          {[r.codigo, r.cultivo].filter(Boolean).join(' · ')}
                        </p>
                      )}
                    </div>
                  </motion.div>
                ))}
              </div>
            )}
          </section>

          {/* Auditorías */}
          <section>
            <div className="flex items-center gap-2 mb-2.5">
              <TituloSeccion as="p" className="mb-0">Auditorías</TituloSeccion>
              <Etiqueta tono="neutral">{auditorias.length}</Etiqueta>
            </div>
            {auditorias.length === 0 ? (
              <EstadoVacio icono={ClipboardCheck} titulo="Sin auditorías registradas" ayuda="Usa el botón + para crear la primera" />
            ) : (
              <div className="flex flex-col gap-2">
                {auditorias.map((a, index) => (
                  <AuditoriaCard
                    key={a.id}
                    a={a}
                    index={index}
                    reducedMotion={reducedMotion}
                    onClick={() => navigate(`/auditor/auditoria/${a.id}`, { state: { orgId, orgNombre } })}
                  />
                ))}
              </div>
            )}
          </section>
        </main>
      )}

      {/* FAB */}
            <Fab onClick={() => navigate(`/auditor/org/${orgId}/nueva`, { state: { orgNombre } })} aria-label="Nueva auditoría" />

      <Outlet />
    </div>
  )
}
