// Overlay de bienvenida tras un login exitoso — puramente presentacional y
// desacoplado de la lógica de auth: no valida nada, no sabe qué es signIn,
// solo llama `onDone` cuando termina para que quien lo monte decida qué
// hacer (navegar). Pantalla completa navy con el logo M.A.D.Y en fade +
// escala (~1.5s) y luego un fundido de salida del overlay antes de avisar.
// Respeta prefers-reduced-motion: si está activo, no se monta y llama
// `onDone` de inmediato (entra sin animación).

import { useEffect, useRef, useState } from 'react'
import { MadyLogo } from '@/app/components/MadyLogo'

const LOGO_DURATION_MS = 1500
const FADE_OUT_MS = 350

interface LoginTransitionProps {
  onDone: () => void
}

export function LoginTransition({ onDone }: LoginTransitionProps) {
  const [ready, setReady] = useState(false)
  const [reducedMotion, setReducedMotion] = useState(false)
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
    const t = setTimeout(() => setExiting(true), LOGO_DURATION_MS)
    return () => clearTimeout(t)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [ready, reducedMotion])

  useEffect(() => {
    if (!exiting) return
    // Red de seguridad: si onTransitionEnd no dispara (p. ej. la pestaña
    // pierde foco a mitad de la transición), igual se avisa que terminó.
    const t = setTimeout(finish, FADE_OUT_MS + 150)
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
        transition: `opacity ${FADE_OUT_MS}ms ease`,
      }}
      onTransitionEnd={() => { if (exiting) finish() }}
    >
      <MadyLogo theme="dark" className="auth-intro-logo" style={{ height: 84, width: 'auto' }} />
    </div>
  )
}
