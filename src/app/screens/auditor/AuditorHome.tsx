import { useState, useEffect } from 'react'
import { useNavigate, Navigate } from 'react-router'
import { Building2, ChevronRight, ClipboardCheck, Plus, Warehouse } from 'lucide-react'
import { useAuthContext } from '@/context/AuthContext'
import { useAuditorAsignaciones } from '@/hooks/useAuditorAsignaciones'
import type { OrgAsignada } from '@/hooks/useAuditorAsignaciones'
import { supabase } from '@/lib/supabase'
import { AuditorNuevaAuditoriaSheet } from './AuditorNuevaAuditoriaSheet'

// eslint-disable-next-line @typescript-eslint/no-explicit-any
const tbl = (name: string) => (supabase as any).from(name)

interface InstalacionCard {
  id: string
  nombre: string
  ubicacion: string | null
  tipo_operacion: string | null
}

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
  const { orgs, loading: loadingOrgs, error: errorOrgs } = useAuditorAsignaciones()

  const [instalaciones, setInstalaciones] = useState<InstalacionCard[]>([])
  const [loadingInst, setLoadingInst] = useState(true)
  const [showSheet, setShowSheet] = useState(false)

  if (profile !== null && profile.rol !== 'auditor') {
    return <Navigate to="/" replace />
  }

  async function cargarInstalaciones() {
    setLoadingInst(true)
    try {
      const { data, error } = await tbl('aud_instalaciones')
        .select('id, nombre, ubicacion, tipo_operacion')
        .order('created_at', { ascending: false })
      if (error) throw error
      setInstalaciones(data ?? [])
    } catch (e) {
      console.error('[AuditorHome] aud_instalaciones', e)
    } finally {
      setLoadingInst(false)
    }
  }

  useEffect(() => {
    if (!profile?.id) return
    cargarInstalaciones()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [profile?.id])

  return (
    <div className="flex flex-col min-h-screen bg-background pb-24">
      <header className="sticky top-0 z-10 bg-card border-b border-border flex items-center gap-3 px-4 py-3">
        <div className="flex-1 min-w-0">
          <h1 className="text-base font-semibold" style={{ color: 'var(--foreground)' }}>
            Inicio Auditor
          </h1>
          <p className="text-xs" style={{ color: 'var(--muted-foreground)' }}>
            Hola, {profile?.nombre_completo?.split(' ')[0] ?? '—'} · Auditor
          </p>
        </div>
        <ClipboardCheck size={20} style={{ color: 'var(--muted-foreground)' }} />
      </header>

      <main className="flex-1 px-4 py-4 flex flex-col gap-6">

        {/* ── Mis instalaciones ──────────────────────────────────────── */}
        <section>
          <div className="flex items-center justify-between mb-2.5">
            <p className="text-[11px] font-semibold uppercase tracking-wide" style={{ color: 'var(--muted-foreground)' }}>
              Mis instalaciones
            </p>
            <button
              onClick={() => setShowSheet(true)}
              className="flex items-center gap-1 text-xs font-semibold px-3 py-1 rounded-lg"
              style={{ backgroundColor: 'var(--accent)', color: 'var(--primary)' }}
            >
              <Plus size={13} />
              Nueva auditoría
            </button>
          </div>

          {loadingInst ? (
            <p className="text-sm text-center py-4" style={{ color: 'var(--muted-foreground)' }}>
              Cargando…
            </p>
          ) : instalaciones.length === 0 ? (
            <div
              className="rounded-xl border border-dashed border-border p-5 flex flex-col items-center gap-2"
              style={{ borderColor: 'var(--border)' }}
            >
              <Warehouse size={28} style={{ color: 'var(--muted-foreground)', opacity: 0.4 }} />
              <p className="text-xs text-center" style={{ color: 'var(--muted-foreground)' }}>
                Ninguna auditoría creada aún.
              </p>
              <button
                onClick={() => setShowSheet(true)}
                className="text-xs font-semibold px-4 py-1.5 rounded-lg"
                style={{ backgroundColor: 'var(--primary)', color: '#fff' }}
              >
                + Nueva auditoría
              </button>
            </div>
          ) : (
            <div className="flex flex-col gap-2">
              {instalaciones.map(inst => (
                <button
                  key={inst.id}
                  onClick={() => navigate(`/auditor/instalacion/${inst.id}`)}
                  className="w-full text-left bg-card rounded-xl border border-border p-4 flex items-center gap-3 active:opacity-70 transition-opacity"
                >
                  <div
                    className="w-10 h-10 rounded-full flex items-center justify-center flex-shrink-0"
                    style={{ backgroundColor: 'var(--muted)' }}
                  >
                    <Warehouse size={18} style={{ color: 'var(--muted-foreground)' }} />
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-semibold truncate" style={{ color: 'var(--foreground)' }}>
                      {inst.nombre}
                    </p>
                    {(inst.ubicacion || inst.tipo_operacion) && (
                      <p className="text-xs mt-0.5 truncate" style={{ color: 'var(--muted-foreground)' }}>
                        {[inst.tipo_operacion, inst.ubicacion].filter(Boolean).join(' · ')}
                      </p>
                    )}
                  </div>
                  <ChevronRight size={16} style={{ color: 'var(--muted-foreground)' }} />
                </button>
              ))}
            </div>
          )}
        </section>

        {/* ── Organizaciones asignadas ───────────────────────────────── */}
        <section>
          <p className="text-[11px] font-semibold uppercase tracking-wide mb-2.5" style={{ color: 'var(--muted-foreground)' }}>
            Organizaciones asignadas
          </p>

          {loadingOrgs ? (
            <p className="text-sm text-center py-4" style={{ color: 'var(--muted-foreground)' }}>
              Cargando…
            </p>
          ) : errorOrgs ? (
            <p className="text-sm text-center py-4" style={{ color: 'var(--agro-danger-text)' }}>
              {errorOrgs}
            </p>
          ) : orgs.length === 0 ? (
            <div className="flex flex-col items-center gap-2 py-6 px-4">
              <Building2 size={32} style={{ color: 'var(--muted-foreground)', opacity: 0.4 }} />
              <p className="text-xs text-center" style={{ color: 'var(--muted-foreground)' }}>
                Sin organizaciones asignadas. Contacta al administrador.
              </p>
            </div>
          ) : (
            <div className="flex flex-col gap-2">
              {orgs.map(org => (
                <OrgCard
                  key={org.org_id}
                  org={org}
                  onClick={() => navigate(`/auditor/org/${org.org_id}`, { state: { orgNombre: org.nombre } })}
                />
              ))}
            </div>
          )}
        </section>

      </main>

      {showSheet && (
        <AuditorNuevaAuditoriaSheet
          onClose={() => setShowSheet(false)}
          onCreated={() => { setShowSheet(false); cargarInstalaciones() }}
        />
      )}
    </div>
  )
}
