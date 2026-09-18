import { useParams, useNavigate, useLocation, Navigate } from 'react-router'
import { ChevronLeft, Plus, MapPin, ClipboardCheck } from 'lucide-react'
import { useAuthContext } from '@/context/AuthContext'
import { useAuditorOrg } from '@/hooks/useAuditorOrg'
import type { AuditorAuditoriaItem } from '@/hooks/useAuditorOrg'

const ESTADO_LABELS: Record<string, string> = {
  en_proceso:  'En proceso',
  preliminar:  'Preliminar',
  completada:  'Completada',
  cerrada:     'Cerrada',
}

const ESTADO_STYLE: Record<string, { bg: string; color: string }> = {
  en_proceso:  { bg: 'var(--agro-warning-fill)', color: 'var(--agro-warning-text)' },
  preliminar:  { bg: 'var(--agro-success-fill)', color: 'var(--agro-success-text)' },
  completada:  { bg: 'var(--agro-success-fill)', color: 'var(--agro-success-text)' },
  cerrada:     { bg: 'var(--muted)',              color: 'var(--muted-foreground)'  },
}

function formatFecha(fecha: string) {
  const [y, m, d] = fecha.split('-')
  return `${d}/${m}/${y}`
}

function AuditoriaCard({ a, onClick }: { a: AuditorAuditoriaItem; onClick: () => void }) {
  const style = ESTADO_STYLE[a.estado] ?? ESTADO_STYLE.cerrada
  return (
    <button
      onClick={onClick}
      className="w-full text-left bg-card rounded-xl border border-border p-4 flex flex-col gap-1.5 active:opacity-70 transition-opacity"
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
    </button>
  )
}

export function AuditorOrgDetalle() {
  const { orgId } = useParams<{ orgId: string }>()
  const navigate = useNavigate()
  const location = useLocation()
  const { profile } = useAuthContext()
  const { ranchos, auditorias, loading, error, refetch } = useAuditorOrg(orgId)

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
        <p className="text-sm text-center py-16" style={{ color: 'var(--muted-foreground)' }}>
          Cargando…
        </p>
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
                {ranchos.map(r => (
                  <div key={r.id} className="bg-card rounded-xl border border-border px-4 py-3 flex items-center gap-3">
                    <MapPin size={15} style={{ color: 'var(--muted-foreground)' }} className="flex-shrink-0" />
                    <div className="flex-1 min-w-0">
                      <p className="text-sm font-medium truncate" style={{ color: 'var(--foreground)' }}>{r.nombre}</p>
                      {(r.codigo || r.cultivo) && (
                        <p className="text-xs" style={{ color: 'var(--muted-foreground)' }}>
                          {[r.codigo, r.cultivo].filter(Boolean).join(' · ')}
                        </p>
                      )}
                    </div>
                  </div>
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
                {auditorias.map(a => (
                  <AuditoriaCard
                    key={a.id}
                    a={a}
                    onClick={() => navigate(`/auditor/auditoria/${a.id}`, { state: { orgId, orgNombre } })}
                  />
                ))}
              </div>
            )}
          </section>
        </main>
      )}

      {/* FAB */}
      <button
        onClick={() => navigate(`/auditor/org/${orgId}/nueva`, { state: { orgNombre } })}
        className="fixed bottom-20 right-4 w-14 h-14 rounded-full flex items-center justify-center shadow-lg z-20"
        style={{ backgroundColor: 'var(--primary)' }}
        aria-label="Nueva auditoría"
      >
        <Plus size={24} color="white" />
      </button>
    </div>
  )
}
