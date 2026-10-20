import { useParams, useNavigate, useLocation, Navigate, Outlet } from 'react-router'
import { ChevronLeft, Plus, MapPin, ClipboardCheck } from 'lucide-react'
import { useAuthContext } from '@/context/AuthContext'
import { useAuditorOrg } from '@/hooks/useAuditorOrg'
import type { AuditorAuditoriaItem } from '@/hooks/useAuditorOrg'
import { Fab } from '@/app/components/Fab'
import { motion, useReducedMotion } from 'motion/react'
import { Skeleton } from '@/app/components/ui/skeleton'
import { ListaSkeleton } from '@/app/components/ListaSkeleton'
import { useMostrarCarga } from '@/hooks/useMostrarCarga'

// Entrada escalonada (primeros 8) compartida por las listas de esta pantalla.
function entrada(index: number, reducedMotion: boolean | null) {
  return {
    initial: reducedMotion ? (false as const) : { opacity: 0, y: 8 },
    animate: {
      opacity: 1, y: 0,
      transition: { duration: 0.22, ease: [0.22, 1, 0.36, 1] as const, delay: Math.min(index, 7) * 0.03 },
    },
  }
}

const ESTADO_LABELS: Record<string, string> = {
  en_proceso:  'En proceso',
  preliminar:  'Preliminar',
  completada:  'Completada',
  cerrada:     'Cerrada',
}

const ESTADO_STYLE: Record<string, { bg: string; color: string }> = {
  en_proceso:  { bg: 'var(--agro-info-fill)', color: 'var(--agro-info-text)' },
  preliminar:  { bg: 'var(--agro-success-fill)', color: 'var(--agro-success-text)' },
  completada:  { bg: 'var(--agro-success-fill)', color: 'var(--agro-success-text)' },
  cerrada:     { bg: 'var(--muted)',              color: 'var(--muted-foreground)'  },
}

function formatFecha(fecha: string) {
  const [y, m, d] = fecha.split('-')
  return `${d}/${m}/${y}`
}

function AuditoriaCard({
  a, index, reducedMotion, onClick,
}: { a: AuditorAuditoriaItem; index: number; reducedMotion: boolean | null; onClick: () => void }) {
  const style = ESTADO_STYLE[a.estado] ?? ESTADO_STYLE.cerrada
  return (
    <motion.button
      {...entrada(index, reducedMotion)}
      onClick={onClick}
      className="w-full text-left bg-card rounded-xl border border-border p-4 flex flex-col gap-1.5 hover:bg-muted active:opacity-70 transition focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ring"
      style={{ transitionDuration: 'var(--motion-fast)' }}
    >
      <div className="flex items-start justify-between gap-2">
        <div className="flex-1 min-w-0">
          <p className="text-sm font-semibold truncate" style={{ color: 'var(--foreground)' }}>
            {a.modulos.length > 0 ? a.modulos.join(' · ') : 'Auditoría PrimusGFS'}
          </p>
          <p className="text-xs mt-0.5" style={{ color: 'var(--muted-foreground)' }}>
            {a.rancho_nombre} · {formatFecha(a.fecha)}
          </p>
        </div>
        <span
          className="text-[10px] font-semibold px-2 py-0.5 rounded-full flex-shrink-0"
          style={{ backgroundColor: style.bg, color: style.color }}
        >
          {ESTADO_LABELS[a.estado] ?? a.estado}
        </span>
      </div>
    </motion.button>
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

  const orgNombre: string = (location.state as { orgNombre?: string } | null)?.orgNombre ?? 'Empresa auditada'

  if (profile !== null && profile.rol !== 'auditor' && profile.rol !== 'super_admin') {
    return <Navigate to="/" replace />
  }

  return (
    <div className="flex flex-col min-h-screen bg-background pb-24">
      <header className="sticky top-0 z-10 bg-card border-b border-border flex items-center gap-3 px-4 py-3">
        <button onClick={() => navigate('/auditor')} className="text-muted-foreground flex-shrink-0">
          <ChevronLeft size={24} />
        </button>
        <div className="flex-1 min-w-0">
          <h1 className="text-base font-semibold truncate" style={{ color: 'var(--foreground)' }}>
            {orgNombre}
          </h1>
          <p className="text-xs" style={{ color: 'var(--muted-foreground)' }}>
            Instalaciones y auditorías
          </p>
        </div>
      </header>

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
          <button onClick={refetch} className="text-xs underline" style={{ color: 'var(--primary)' }}>
            Reintentar
          </button>
        </div>
      ) : (
        <main className="flex-1 px-4 py-4 flex flex-col gap-6">
          {/* Instalaciones */}
          <section>
            <p className="text-[11px] font-semibold uppercase tracking-wide mb-2.5" style={{ color: 'var(--muted-foreground)' }}>
              Instalaciones ({ranchos.length})
            </p>
            {ranchos.length === 0 ? (
              <p className="text-sm" style={{ color: 'var(--muted-foreground)' }}>Sin instalaciones registradas.</p>
            ) : (
              <div className="flex flex-col gap-2">
                {ranchos.map((r, index) => (
                  <motion.div
                    key={r.id}
                    {...entrada(index, reducedMotion)}
                    className="bg-card rounded-xl border border-border px-4 py-3 flex items-center gap-3"
                  >
                    <MapPin size={15} style={{ color: 'var(--muted-foreground)' }} className="flex-shrink-0" />
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
            <p className="text-[11px] font-semibold uppercase tracking-wide mb-2.5" style={{ color: 'var(--muted-foreground)' }}>
              Auditorías ({auditorias.length})
            </p>
            {auditorias.length === 0 ? (
              <div className="flex flex-col items-center gap-2 py-10">
                <ClipboardCheck size={36} style={{ color: 'var(--muted-foreground)', opacity: 0.4 }} />
                <p className="text-sm text-center" style={{ color: 'var(--muted-foreground)' }}>
                  Sin auditorías registradas
                </p>
                <p className="text-xs text-center" style={{ color: 'var(--muted-foreground)' }}>
                  Usa el botón + para crear la primera
                </p>
              </div>
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
