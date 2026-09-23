// Overlay de bienvenida tras un login exitoso — puramente presentacional y
// desacoplado de la lógica de auth. Montado por IntroTransitionContext por
// encima del router, así que sigue cubriendo la pantalla durante y después
// de la navegación de /login al dashboard (nunca vive dentro de Login.tsx).
// Secuencia: fade + escala del logo (~1.5s) → espera a que el destino ya
// autenticado avise que montó (`appReady`, ver Layout.tsx) → cross-fade de
// salida corto (~300ms) → `onDone` (oculta el overlay). Si `appReady` tarda
// más que la entrada, el overlay simplemente sostiene el logo ya asentado
// hasta que llegue — nunca hace el cross-fade antes de tiempo.
// Respeta prefers-reduced-motion: si está activo, no se monta y llama
// `onDone` de inmediato (entra sin animación).

import { useEffect, useRef, useState } from 'react'
import { MadyLogo } from '@/app/components/MadyLogo'

const ENTER_MS = 1500
const EXIT_MS = 300
// Red de seguridad si `appReady` nunca llegara (p. ej. el destino no pasa
// por Layout, como /completar-organizacion) — el overlay nunca se queda
// pegado; el acceso a la app ya ocurrió de todos modos vía goToApp().
const MAX_WAIT_MS = 6000

interface LoginTransitionProps {
  appReady: boolean
  onDone: () => void
}

export function LoginTransition({ appReady, onDone }: LoginTransitionProps) {
  const [ready, setReady] = useState(false)
  const [reducedMotion, setReducedMotion] = useState(false)
  const [enterDone, setEnterDone] = useState(false)
  const [exiting, setExiting] = useState(false)
  const doneRef = useRef(false)

  function finish() {
    if (doneRef.current) return
    doneRef.current = true
    onDone()
  }

  useEffect(() => {
    setReducedMotion(window.matchMedia('(prefers-reduced-motion: reduce)').matches)
    setReady(true)
  }, [])

  useEffect(() => {
    if (!ready) return
    if (reducedMotion) { finish(); return }
    const t = setTimeout(() => setEnterDone(true), ENTER_MS)
    const safety = setTimeout(finish, MAX_WAIT_MS)
    return () => { clearTimeout(t); clearTimeout(safety) }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [ready, reducedMotion])

  // Solo cruza a "exiting" cuando AMBAS condiciones se cumplieron: el logo
  // ya terminó su entrada Y el destino ya avisó que está montado.
  useEffect(() => {
    if (enterDone && appReady) setExiting(true)
  }, [enterDone, appReady])

  useEffect(() => {
    if (!exiting) return
    // Red de seguridad: si onTransitionEnd no dispara (p. ej. la pestaña
    // pierde foco a mitad de la transición), igual se avisa que terminó.
    const t = setTimeout(finish, EXIT_MS + 150)
    return () => clearTimeout(t)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [exiting])

  if (!ready || reducedMotion) return null

  return (
    <div
      aria-hidden="true"
      className="fixed inset-0 z-[100] flex items-center justify-center"
      style={{
        background: 'var(--auth-navy-darker)',
        opacity: exiting ? 0 : 1,
        transition: `opacity ${EXIT_MS}ms ease`,
      }}
      onTransitionEnd={() => { if (exiting) finish() }}
    >
      {/* +40% vs. la v11 (84px → 118px), mismo fade+escala */}
      <MadyLogo theme="dark" className="auth-intro-logo" style={{ height: 118, width: 'auto' }} />
    </div>
  )
}
