import { Navigate, useNavigate } from 'react-router'
import { ChevronLeft, Plus, ClipboardCheck, AlertCircle } from 'lucide-react'
import { useAuthContext } from '@/context/AuthContext'
import { useAuditoriasPGFS } from '@/hooks/useAuditoriasPGFS'
import type { AuditoriaListItem } from '@/hooks/useAuditoriasPGFS'
import { LEYENDA_LEGAL_PGFS } from '@/lib/auditoriasPGFS'

const ROLES_PERMITIDOS = ['auditor', 'admin_org', 'super_admin']

const ESTADO_LABELS: Record<string, string> = {
  en_proceso: 'En proceso',
  completada: 'Completada',
  cerrada: 'Cerrada',
}

const ESTADO_STYLE: Record<string, { bg: string; color: string }> = {
  en_proceso: { bg: 'var(--agro-warning-fill)', color: 'var(--agro-warning-text)' },
  completada:  { bg: 'var(--agro-success-fill)', color: 'var(--agro-success-text)' },
  cerrada:     { bg: 'var(--muted)',              color: 'var(--muted-foreground)'   },
}

function formatFecha(fecha: string) {
  const [y, m, d] = fecha.split('-')
  return `${d}/${m}/${y}`
}

function AuditoriaCard({ a, onClick }: { a: AuditoriaListItem; onClick: () => void }) {
  const style = ESTADO_STYLE[a.estado] ?? ESTADO_STYLE.cerrada
  return (
    <button
      onClick={onClick}
      className="w-full text-left bg-card rounded-xl border border-border p-4 flex flex-col gap-2 active:opacity-70 transition-opacity"
    >
      <div className="flex items-start justify-between gap-2">
        <div className="flex-1 min-w-0">
          <p className="text-sm font-semibold truncate" style={{ color: 'var(--foreground)' }}>
            {a.modulo_nombre}
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
      {a.auditor_nombre && (
        <p className="text-xs" style={{ color: 'var(--muted-foreground)' }}>
          Auditor: {a.auditor_nombre}
        </p>
      )}
    </button>
  )
}

export default function AuditoriasPrimusGFS() {
  const { profile } = useAuthContext()
  const navigate = useNavigate()
  const { auditorias, loading, error, refetch } = useAuditoriasPGFS()

  if (!ROLES_PERMITIDOS.includes(profile?.rol ?? '')) {
    return <Navigate to="/" replace />
  }

  return (
    <div className="flex flex-col min-h-screen bg-background pb-24">
      <header
        className="sticky top-0 z-10 bg-card border-b border-border flex items-center gap-3 px-4 py-3"
      >
        <button onClick={() => navigate(-1)} className="text-muted-foreground">
          <ChevronLeft size={24} />
        </button>
        <div className="flex-1 min-w-0">
          <h1 className="text-base font-semibold" style={{ color: 'var(--foreground)' }}>
            Auditorías PrimusGFS
          </h1>
          <p className="text-xs" style={{ color: 'var(--muted-foreground)' }}>v3.2</p>
        </div>
        <ClipboardCheck size={20} style={{ color: 'var(--muted-foreground)' }} />
      </header>

      {/* Leyenda legal */}
      <div className="mx-4 mt-4 rounded-xl border border-border bg-card px-4 py-3 flex gap-3">
        <AlertCircle size={16} className="flex-shrink-0 mt-0.5" style={{ color: 'var(--agro-warning-text)' }} />
        <p className="text-[11px] leading-relaxed" style={{ color: 'var(--muted-foreground)' }}>
          {LEYENDA_LEGAL_PGFS}
        </p>
      </div>

      <main className="flex-1 px-4 py-4 flex flex-col gap-3">
        {loading ? (
          <p className="text-sm text-center py-12" style={{ color: 'var(--muted-foreground)' }}>
            Cargando…
          </p>
        ) : error ? (
          <div className="flex flex-col items-center gap-2 py-12">
            <p className="text-sm text-center" style={{ color: 'var(--agro-danger-text)' }}>{error}</p>
            <button
              onClick={refetch}
              className="text-xs underline"
              style={{ color: 'var(--primary)' }}
            >
              Reintentar
            </button>
          </div>
        ) : auditorias.length === 0 ? (
          <div className="flex flex-col items-center gap-2 py-16">
            <ClipboardCheck size={40} style={{ color: 'var(--muted-foreground)', opacity: 0.4 }} />
            <p className="text-sm text-center" style={{ color: 'var(--muted-foreground)' }}>
              Sin auditorías registradas
            </p>
            <p className="text-xs text-center" style={{ color: 'var(--muted-foreground)' }}>
              Usa el botón + para crear la primera
            </p>
          </div>
        ) : (
          auditorias.map((a) => (
            <AuditoriaCard
              key={a.id}
              a={a}
              onClick={() => navigate(`/inocuidad/auditorias-primusgfs/${a.id}`)}
            />
          ))
        )}
      </main>

      {/* FAB */}
      <button
        onClick={() => navigate('/inocuidad/auditorias-primusgfs/nueva')}
        className="fixed bottom-20 right-4 w-14 h-14 rounded-full flex items-center justify-center shadow-lg z-20"
        style={{ backgroundColor: 'var(--primary)' }}
        aria-label="Nueva auditoría"
      >
        <Plus size={24} color="white" />
      </button>
    </div>
  )
}
