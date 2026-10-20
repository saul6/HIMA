import { useRef } from 'react'
import { useNavigate, useSearchParams, Navigate } from 'react-router'
import { motion, AnimatePresence, LayoutGroup, useReducedMotion } from 'motion/react'
import { useAuthContext } from '@/context/AuthContext'
import { SPRING_SUAVE, DUR, EASE_OUT } from '@/lib/motion'
import { AuditorCampana } from './AuditorCampana'
import { MisVisitas } from './MisVisitas'
import { CalendarioConsolidado } from './CalendarioConsolidado'
import { EncabezadoPantalla } from '@/app/components/EncabezadoPantalla'

type Tab = 'visitas' | 'calendario'

const TABS: { id: Tab; label: string }[] = [
  { id: 'visitas', label: 'Mis visitas' },
  { id: 'calendario', label: 'Calendario' },
]

export function AuditorAgenda() {
  const { profile } = useAuthContext()
  const navigate = useNavigate()
  const [searchParams, setSearchParams] = useSearchParams()
  const reducedMotion = useReducedMotion()
  const dirTabRef = useRef(1)

  if (profile !== null && profile.rol !== 'auditor' && profile.rol !== 'super_admin') {
    return <Navigate to="/" replace />
  }

  const tab: Tab = searchParams.get('tab') === 'calendario' ? 'calendario' : 'visitas'

  function setTab(t: Tab) {
    dirTabRef.current = TABS.findIndex(x => x.id === t) > TABS.findIndex(x => x.id === tab) ? 1 : -1
    setSearchParams({ tab: t }, { replace: false })
  }

  function handleTabKeyDown(e: React.KeyboardEvent) {
    if (e.key === 'ArrowLeft') setTab('visitas')
    if (e.key === 'ArrowRight') setTab('calendario')
  }

  return (
    <div className="flex flex-col min-h-screen pb-24" style={{ backgroundColor: 'var(--background)' }}>
      <EncabezadoPantalla titulo="Agenda" alRegresar={() => navigate('/auditor')} accionesMovil={<AuditorCampana />} />

      {/* Segmented control de pestañas */}
      <div className="px-4 md:px-6 pt-4 pb-1 w-full">
        <LayoutGroup id="auditor-agenda-tabs">
          <div
            role="tablist"
            aria-label="Secciones de agenda"
            className="flex gap-1 rounded-xl p-1"
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
                className="relative flex-1 py-1.5 rounded-lg text-sm font-semibold transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary"
                style={{
                  color: tab === id ? 'var(--foreground)' : 'var(--muted-foreground)',
                  transitionDuration: 'var(--motion-fast)',
                }}
              >
                {tab === id && (
                  <motion.span
                    layoutId="auditor-agenda-tab-activa"
                    className="absolute inset-0 rounded-lg"
                    style={{ backgroundColor: 'var(--card)', zIndex: 0 }}
                    transition={reducedMotion ? { duration: 0 } : SPRING_SUAVE}
                  />
                )}
                <span className="relative z-10">{label}</span>
              </button>
            ))}
          </div>
        </LayoutGroup>
      </div>

      <main
        role="tabpanel"
        id={`panel-${tab}`}
        aria-labelledby={`tab-${tab}`}
        className="flex-1 px-4 md:px-6 py-4 w-full"
      >
        <AnimatePresence mode="wait" initial={false} custom={dirTabRef.current}>
          <motion.div
            key={tab}
            custom={dirTabRef.current}
            variants={{
              enter: (d: number) => (reducedMotion ? { opacity: 1 } : { opacity: 0, x: d * 24 }),
              center: { opacity: 1, x: 0, transition: { duration: DUR.base, ease: EASE_OUT } },
              exit: (d: number) => (reducedMotion
                ? { opacity: 1 }
                : { opacity: 0, x: d * -12, transition: { duration: 0.12, ease: EASE_OUT } }),
            }}
            initial="enter"
            animate="center"
            exit="exit"
          >
            {tab === 'calendario' ? <CalendarioConsolidado /> : <MisVisitas />}
          </motion.div>
        </AnimatePresence>
      </main>
    </div>
  )
}
