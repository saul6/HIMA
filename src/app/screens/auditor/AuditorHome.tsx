import { useNavigate, Navigate } from 'react-router'
import { Building2, ChevronRight, ClipboardCheck } from 'lucide-react'
import { useAuthContext } from '@/context/AuthContext'
import { useAuditorAsignaciones } from '@/hooks/useAuditorAsignaciones'
import type { OrgAsignada } from '@/hooks/useAuditorAsignaciones'

function OrgCard({ org, onClick }: { org: OrgAsignada; onClick: () => void }) {
  return (
    <button
      onClick={onClick}
      className="w-full text-left bg-card rounded-xl border border-border p-4 flex items-center gap-3 active:opacity-70 transition-opacity"
    >
      <div
        className="w-10 h-10 rounded-full flex items-center justify-center flex-shrink-0"
        style={{ backgroundColor: 'var(--accent)' }}
      >
        <Building2 size={18} style={{ color: 'var(--primary)' }} />
      </div>
      <div className="flex-1 min-w-0">
        <p className="text-sm font-semibold truncate" style={{ color: 'var(--foreground)' }}>
          {org.nombre}
        </p>
        <p className="text-xs mt-0.5" style={{ color: 'var(--muted-foreground)' }}>
          {org.num_ranchos} {org.num_ranchos === 1 ? 'instalación' : 'instalaciones'}
          {org.tipo ? ` · ${org.tipo}` : ''}
        </p>
      </div>
      <ChevronRight size={16} style={{ color: 'var(--muted-foreground)' }} />
    </button>
  )
}

export function AuditorHome() {
  const { profile } = useAuthContext()
  const navigate = useNavigate()
  const { orgs, loading, error } = useAuditorAsignaciones()

  if (profile !== null && profile.rol !== 'auditor') {
    return <Navigate to="/" replace />
  }

  return (
    <div className="flex flex-col min-h-screen bg-background pb-24">
      <header className="sticky top-0 z-10 bg-card border-b border-border flex items-center gap-3 px-4 py-3">
        <div className="flex-1 min-w-0">
          <h1 className="text-base font-semibold" style={{ color: 'var(--foreground)' }}>
            Mis organizaciones
          </h1>
          <p className="text-xs" style={{ color: 'var(--muted-foreground)' }}>
            Hola, {profile?.nombre_completo?.split(' ')[0] ?? '—'} · Auditor
          </p>
        </div>
        <ClipboardCheck size={20} style={{ color: 'var(--muted-foreground)' }} />
      </header>

      <main className="flex-1 px-4 py-4 flex flex-col gap-3">
        {loading ? (
          <p className="text-sm text-center py-16" style={{ color: 'var(--muted-foreground)' }}>
            Cargando…
          </p>
        ) : error ? (
          <p className="text-sm text-center py-16" style={{ color: 'var(--agro-danger-text)' }}>
            {error}
          </p>
        ) : orgs.length === 0 ? (
          <div className="flex flex-col items-center gap-3 py-16 px-4">
            <Building2 size={40} style={{ color: 'var(--muted-foreground)', opacity: 0.4 }} />
            <p className="text-sm text-center font-medium" style={{ color: 'var(--muted-foreground)' }}>
              Sin organizaciones asignadas
            </p>
            <p className="text-xs text-center" style={{ color: 'var(--muted-foreground)' }}>
              Contacta al administrador para que te asignen acceso a una empresa auditada.
            </p>
          </div>
        ) : (
          orgs.map(org => (
            <OrgCard
              key={org.org_id}
              org={org}
              onClick={() => navigate(`/auditor/org/${org.org_id}`, { state: { orgNombre: org.nombre } })}
            />
          ))
        )}
      </main>
    </div>
  )
}
