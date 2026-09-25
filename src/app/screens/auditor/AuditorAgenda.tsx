import { useNavigate, useSearchParams, Navigate } from 'react-router'
import { ChevronLeft } from 'lucide-react'
import { useAuthContext } from '@/context/AuthContext'
import { AuditorCampana } from './AuditorCampana'
import { MisVisitas } from './MisVisitas'
import { CalendarioConsolidado } from './CalendarioConsolidado'

type Tab = 'visitas' | 'calendario'

const TABS: { id: Tab; label: string }[] = [
  { id: 'visitas', label: 'Mis visitas' },
  { id: 'calendario', label: 'Calendario' },
]

export function AuditorAgenda() {
  const { profile } = useAuthContext()
  const navigate = useNavigate()
  const [searchParams, setSearchParams] = useSearchParams()

  if (profile !== null && profile.rol !== 'auditor' && profile.rol !== 'super_admin') {
    return <Navigate to="/" replace />
  }

  const tab: Tab = searchParams.get('tab') === 'calendario' ? 'calendario' : 'visitas'

  function setTab(t: Tab) {
    setSearchParams({ tab: t }, { replace: false })
  }

  function handleTabKeyDown(e: React.KeyboardEvent) {
    if (e.key === 'ArrowLeft') setTab('visitas')
    if (e.key === 'ArrowRight') setTab('calendario')
  }

  return (
    <div className="flex flex-col min-h-screen pb-10" style={{ backgroundColor: 'var(--background)' }}>
      <header
        className="sticky top-0 z-10 border-b border-border flex items-center gap-3 px-4 py-3"
        style={{ backgroundColor: 'var(--card)' }}
      >
        <button
          onClick={() => navigate('/auditor')}
          className="flex-shrink-0 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary rounded"
          style={{ color: 'var(--muted-foreground)' }}
          aria-label="Volver"
        >
          <ChevronLeft size={24} />
        </button>
        <div className="flex-1 min-w-0">
          <h1 className="text-base font-semibold" style={{ color: 'var(--foreground)' }}>Agenda</h1>
        </div>
        <AuditorCampana />
      </header>

      {/* Segmented control de pestañas */}
      <div className="px-4 pt-3 pb-1 max-w-lg mx-auto w-full">
        <div
          role="tablist"
          aria-label="Secciones de agenda"
          className="flex gap-0.5 rounded-lg p-0.5"
          style={{ backgroundColor: 'var(--muted)' }}
        >
          {TABS.map(({ id, label }) => (
            <button
              key={id}
              role="tab"
              id={`tab-${id}`}
              aria-selected={tab === id}
              aria-controls={`panel-${id}`}
              onClick={() => setTab(id)}
              onKeyDown={handleTabKeyDown}
              className="flex-1 py-1.5 rounded-md text-sm font-semibold transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary"
              style={
                tab === id
                  ? { backgroundColor: 'var(--card)', color: 'var(--primary)' }
                  : { color: 'var(--muted-foreground)' }
              }
            >
              {label}
            </button>
          ))}
        </div>
      </div>

      <main
        role="tabpanel"
        id={`panel-${tab}`}
        aria-labelledby={`tab-${tab}`}
        className="flex-1 px-4 py-4 max-w-lg mx-auto w-full"
      >
        {tab === 'calendario' ? <CalendarioConsolidado /> : <MisVisitas />}
      </main>
    </div>
  )
}
