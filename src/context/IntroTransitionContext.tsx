// Estado compartido para el overlay de bienvenida tras un login exitoso
// (ver LoginTransition.tsx). Vive por encima del router (ver App.tsx) para
// que el overlay NO se desmonte cuando react-router cambia de ruta al
// navegar de /login al dashboard — si viviera dentro de Login.tsx, ese
// desmontaje dejaba ver un instante del login antes de que el dashboard
// apareciera. Puramente presentacional: no toca signIn/sesión/captcha.
import { createContext, useCallback, useContext, useEffect, useState, type ReactNode } from 'react'
import { LoginTransition } from '@/app/components/LoginTransition'

interface IntroTransitionContextValue {
  // Llamado por Login.tsx justo tras un submit exitoso.
  start: () => void
  // Llamado por el destino ya autenticado (ver Layout.tsx) en su montaje —
  // señal determinística de "la app ya está lista detrás del overlay".
  markAppReady: () => void
  // true mientras el logo de la intro viaja hacia el sidebar: el logo del
  // sidebar queda en opacity 0 para que nunca se vean dos a la vez.
  ocultarLogoSidebar: boolean
  // Fase del contenido de la app tras el login: 'oculto' mientras el logo
  // viaja, 'entra' (fade + subida, una sola vez) al aterrizar, null el resto.
  faseContenido: 'oculto' | 'entra' | null
}

const IntroTransitionContext = createContext<IntroTransitionContextValue | null>(null)

export function IntroTransitionProvider({ children }: { children: ReactNode }) {
  const [active, setActive] = useState(false)
  const [appReady, setAppReady] = useState(false)
  const [logoAterrizado, setLogoAterrizado] = useState(false)
  const [faseContenido, setFaseContenido] = useState<'oculto' | 'entra' | null>(null)

  const start = useCallback(() => {
    setAppReady(false)
    setLogoAterrizado(false)
    setFaseContenido('oculto')
    setActive(true)
  }, [])

  const markAppReady = useCallback(() => {
    setAppReady(true)
  }, [])

  const finish = useCallback(() => {
    setActive(false)
    setAppReady(false)
  }, [])

  const logoLanded = useCallback(() => {
    setLogoAterrizado(true)
    setFaseContenido('entra')
  }, [])

  // La entrada del contenido ocurre una sola vez: pasada su animación se
  // limpia la fase, así navegar después no la repite.
  useEffect(() => {
    if (faseContenido !== 'entra') return
    const t = setTimeout(() => setFaseContenido(null), 700)
    return () => clearTimeout(t)
  }, [faseContenido])

  return (
    <IntroTransitionContext.Provider value={{ start, markAppReady, ocultarLogoSidebar: active && !logoAterrizado, faseContenido }}>
      {children}
      {active && <LoginTransition appReady={appReady} onDone={finish} onLanded={logoLanded} />}
    </IntroTransitionContext.Provider>
  )
}

export function useIntroTransition() {
  const ctx = useContext(IntroTransitionContext)
  if (!ctx) throw new Error('useIntroTransition must be used within IntroTransitionProvider')
  return ctx
}
