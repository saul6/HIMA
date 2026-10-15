// Overlay de bienvenida tras un login exitoso — puramente presentacional y
// desacoplado de la lógica de auth. Montado por IntroTransitionContext por
// encima del router, así que sigue cubriendo la pantalla durante y después
// de la navegación de /login al dashboard (nunca vive dentro de Login.tsx).
// Secuencia: fade + escala del logo (~1.5s) → espera a que el destino ya
// autenticado avise que montó (`appReady`, ver Layout.tsx) → salida:
//   · escritorio: el logo viaja y se encoge hasta el logo del sidebar
//     (`data-intro-destino="sidebar-logo"`) mientras el fondo se desvanece;
//   · móvil / sidebar no disponible: el logo crece apenas y se desvanece;
//   · prefers-reduced-motion: solo fade del overlay.
// Si `appReady` tarda más que la entrada, el overlay sostiene el logo ya
// asentado hasta que llegue. Solo anima transform/opacity (y un blur leve
// de 4px en la salida móvil).

import { useEffect, useRef, useState } from 'react'
import { motion } from 'motion/react'
import { MadyLogo } from '@/app/components/MadyLogo'

const ENTER_MS = 1500
const EXIT_ESCRITORIO_MS = 600
const EXIT_MOVIL_MS = 450
const EXIT_FADE_MS = 250
// Cuánto esperar a que el logo del sidebar esté montado y medible.
const MEDIR_MAX_MS = 300
// Red de seguridad si `appReady` nunca llegara (p. ej. el destino no pasa
// por Layout, como /completar-organizacion) — el overlay nunca se queda
// pegado; el acceso a la app ya ocurrió de todos modos vía goToApp().
const MAX_WAIT_MS = 6000
const EASE_OUT = [0.22, 1, 0.36, 1] as const

type Modo = 'escritorio' | 'movil' | 'fade'

interface Destino {
  dx: number
  dy: number
  scale: number
  // Logo del sidebar (varía con el tema): se funde sobre el de la intro.
  src: string | null
}

interface LoginTransitionProps {
  appReady: boolean
  onDone: () => void
  onLanded: () => void
}

const DURACION: Record<Modo, number> = {
  escritorio: EXIT_ESCRITORIO_MS,
  movil: EXIT_MOVIL_MS,
  fade: EXIT_FADE_MS,
}

export function LoginTransition({ appReady, onDone, onLanded }: LoginTransitionProps) {
  const [ready, setReady] = useState(false)
  const [reducedMotion, setReducedMotion] = useState(false)
  const [enterDone, setEnterDone] = useState(false)
  const [modo, setModo] = useState<Modo | null>(null)
  const [destino, setDestino] = useState<Destino | null>(null)
  const doneRef = useRef(false)
  const logoBoxRef = useRef<HTMLDivElement>(null)
  const exiting = modo !== null

  function finish() {
    if (doneRef.current) return
    doneRef.current = true
    // Mismo commit: el logo del sidebar reaparece y el overlay se va.
    onLanded()
    onDone()
  }

  useEffect(() => {
    setReducedMotion(window.matchMedia('(prefers-reduced-motion: reduce)').matches)
    setReady(true)
  }, [])

  useEffect(() => {
    if (!ready) return
    const t = setTimeout(() => setEnterDone(true), reducedMotion ? 0 : ENTER_MS)
    const safety = setTimeout(finish, MAX_WAIT_MS)
    return () => { clearTimeout(t); clearTimeout(safety) }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [ready, reducedMotion])

  // Solo arranca la salida cuando AMBAS condiciones se cumplieron: el logo
  // ya terminó su entrada Y el destino ya avisó que está montado. Decide el
  // modo midiendo el logo del sidebar cuando ya es visible (ancho/alto > 0).
  useEffect(() => {
    if (!enterDone || !appReady || modo) return
    if (reducedMotion) { setModo('fade'); return }
    const hayEscritorio = window.matchMedia('(min-width: 768px)').matches
    if (!hayEscritorio) { setModo('movil'); return }

    let raf = 0
    const t0 = performance.now()
    const intentar = () => {
      const dest = document.querySelector<HTMLElement>('[data-intro-destino="sidebar-logo"]')
      const d = dest?.getBoundingClientRect()
      const s = logoBoxRef.current?.getBoundingClientRect()
      if (dest && d && s && d.width > 0 && d.height > 0 && s.height > 0) {
        const destSrc = dest.getAttribute('src')
        setDestino({
          dx: d.left + d.width / 2 - (s.left + s.width / 2),
          dy: d.top + d.height / 2 - (s.top + s.height / 2),
          scale: d.height / s.height,
          src: destSrc && !destSrc.includes('MADYOscuro') ? destSrc : null,
        })
        setModo('escritorio')
        return
      }
      if (performance.now() - t0 >= MEDIR_MAX_MS) { setModo('movil'); return }
      raf = requestAnimationFrame(intentar)
    }
    intentar()
    return () => cancelAnimationFrame(raf)
  }, [enterDone, appReady, modo, reducedMotion])

  // Si la ventana cambia de tamaño a mitad del viaje, el destino medido ya no
  // sirve: se termina con un fade simple.
  useEffect(() => {
    if (modo !== 'escritorio') return
    const alCambiar = () => setModo('fade')
    window.addEventListener('resize', alCambiar)
    return () => window.removeEventListener('resize', alCambiar)
  }, [modo])

  useEffect(() => {
    if (!modo) return
    // Red de seguridad: si onAnimationComplete no dispara (p. ej. la pestaña
    // pierde foco a mitad de la animación), igual se avisa que terminó.
    const t = setTimeout(finish, DURACION[modo] + 250)
    return () => clearTimeout(t)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [modo])

  if (!ready) return null

  const dur = (modo ? DURACION[modo] : EXIT_FADE_MS) / 1000
  const objetivo =
    modo === 'escritorio' && destino
      ? { x: destino.dx, y: destino.dy, scale: destino.scale, opacity: 1 }
      : modo === 'movil'
        ? { x: 0, y: 0, scale: 1.08, opacity: 0, filter: 'blur(4px)' }
        : modo === 'fade'
          ? { opacity: 0 }
          : { x: 0, y: 0, scale: 1, opacity: 1, filter: 'blur(0px)' }
  const fundeSidebar = modo === 'escritorio' && !!destino?.src

  return (
    <div
      aria-hidden="true"
      className="fixed inset-0 z-[100] flex items-center justify-center"
      style={{ pointerEvents: exiting ? 'none' : 'auto' }}
    >
      <div
        className="absolute inset-0"
        style={{
          background: 'var(--auth-bg-base)',
          opacity: exiting ? 0 : 1,
          transition: `opacity ${dur * 1000}ms var(--ease-out)`,
        }}
      />
      <motion.div
        ref={logoBoxRef}
        className="relative flex"
        initial={false}
        animate={objetivo}
        transition={{ duration: dur, ease: EASE_OUT }}
        style={{ willChange: exiting ? 'transform, opacity' : undefined }}
        onAnimationComplete={() => { if (exiting) finish() }}
      >
        <motion.div
          className="flex"
          initial={false}
          animate={{ opacity: fundeSidebar ? 0 : 1 }}
          transition={{ duration: dur, ease: 'easeInOut' }}
        >
          {/* +40% vs. la v11 (84px → 118px), mismo fade+escala de entrada */}
          <MadyLogo theme="dark" className="auth-intro-logo" style={{ height: 118, width: 'auto' }} />
        </motion.div>
        {fundeSidebar && destino?.src && (
          <motion.img
            src={destino.src}
            alt=""
            className="absolute inset-0 h-full w-full"
            style={{ objectFit: 'contain' }}
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            transition={{ duration: dur, ease: 'easeInOut' }}
          />
        )}
      </motion.div>
    </div>
  )
}
