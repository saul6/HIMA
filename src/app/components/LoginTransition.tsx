// Overlay de bienvenida tras un login exitoso — puramente presentacional y
// desacoplado de la lógica de auth. Montado por IntroTransitionContext por
// encima del router, así que sigue cubriendo la pantalla durante y después
// de la navegación de /login al dashboard (nunca vive dentro de Login.tsx).
// Secuencia: fade + escala del logo (~1.5s) → espera a que el destino ya
// autenticado avise que montó (`appReady`, ver Layout.tsx) → salida:
//   · escritorio: pausa breve, el logo viaja en curva y se encoge hasta el
//     logo del sidebar (`data-intro-destino="sidebar-logo"`) mientras el fondo
//     se desvanece; al llegar, el del sidebar toma su lugar con un fundido;
//   · móvil / sidebar no disponible: el logo crece apenas y se desvanece;
//   · prefers-reduced-motion: el logo queda quieto y el overlay hace fade.
// El contenido de la app empieza a aparecer junto con el desvanecido del
// fondo (`onSalida`), no hasta que el logo llega. El overlay SOLO se
// desmonta cuando termina su animación (onAnimationComplete); los
// temporizadores son red de seguridad y siempre terminan con fade, no con corte.
// Si `appReady` tarda más que la entrada, el overlay sostiene el logo ya
// asentado hasta que llegue. Solo anima transform/opacity (y un blur leve
// de 4px en la salida móvil).

import { useEffect, useRef, useState } from 'react'
import { motion } from 'motion/react'
import { MadyLogo } from '@/app/components/MadyLogo'

const ENTER_MS = 1500
// Escritorio: pausa del logo (120) + viaje (650) + cambio por el logo del
// sidebar (120) = 890 ms de salida (antes 600: +290 ms).
const PAUSA_MS = 120
const VIAJE_MS = 650
const CAMBIO_LOGO_MS = 120
const EXIT_MOVIL_MS = 450
const EXIT_FADE_MS = 300
// Margen de la red de seguridad sobre la duración de la salida: si el hilo
// principal está ocupado montando la app, la animación puede ir retrasada y
// un temporizador justo la cortaría a medias.
const SEGURO_EXTRA_MS = 1500
// Retraso del desvanecido del fondo en escritorio (el logo arranca a los 120).
const BG_DELAY_MS = 100
// Cuánto esperar a que el logo del sidebar esté montado y medible.
const MEDIR_MAX_MS = 300
// Red de seguridad si `appReady` nunca llegara (p. ej. el destino no pasa
// por Layout, como /completar-organizacion) — el overlay nunca se queda
// pegado; el acceso a la app ya ocurrió de todos modos vía goToApp().
const MAX_WAIT_MS = 6000
const EASE_OUT = [0.22, 1, 0.36, 1] as const
// Curvas distintas en X y en Y para que el viaje dibuje una curva y no una
// recta: Y arranca rápido (sube/baja primero), X acelera después.
const EASE_X = [0.5, 0, 0.2, 1] as const
const EASE_Y = [0.16, 1, 0.3, 1] as const
// Móvil: el logo se apaga más despacio que el fondo para que se alcance a ver.
const EASE_FADE_LOGO = [0.4, 0, 0.6, 1] as const
const EASE_BG_MOVIL = 'cubic-bezier(0.4, 0, 1, 1)'

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
  // Arranca la salida: el contenido de la app empieza a aparecer.
  onSalida: () => void
}

const DURACION: Record<Modo, number> = {
  escritorio: PAUSA_MS + VIAJE_MS + CAMBIO_LOGO_MS,
  movil: EXIT_MOVIL_MS,
  fade: EXIT_FADE_MS,
}

export function LoginTransition({ appReady, onDone, onLanded, onSalida }: LoginTransitionProps) {
  const [ready, setReady] = useState(false)
  const [reducedMotion, setReducedMotion] = useState(false)
  const [enterDone, setEnterDone] = useState(false)
  const [modo, setModo] = useState<Modo | null>(null)
  const [destino, setDestino] = useState<Destino | null>(null)
  // La medición del destino terminó (con éxito o sin sidebar disponible).
  const [medido, setMedido] = useState(false)
  // Escritorio: el logo ya llegó y se cede el lugar al del sidebar.
  const [cedido, setCedido] = useState(false)
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

  function medir(): Destino | null {
    const dest = document.querySelector<HTMLElement>('[data-intro-destino="sidebar-logo"]')
    const d = dest?.getBoundingClientRect()
    const s = logoBoxRef.current?.getBoundingClientRect()
    if (!dest || !d || !s || d.width <= 0 || d.height <= 0 || s.height <= 0) return null
    const destSrc = dest.getAttribute('src')
    return {
      dx: d.left + d.width / 2 - (s.left + s.width / 2),
      dy: d.top + d.height / 2 - (s.top + s.height / 2),
      scale: d.height / s.height,
      src: destSrc && !destSrc.includes('MADYOscuro') ? destSrc : null,
    }
  }

  useEffect(() => {
    if (!ready) return
    const t = setTimeout(() => setEnterDone(true), reducedMotion ? 0 : ENTER_MS)
    // Seguro: si algo falla la salida termina con fade, nunca con corte.
    const safety = setTimeout(() => setModo(m => m ?? 'fade'), MAX_WAIT_MS)
    return () => { clearTimeout(t); clearTimeout(safety) }
  }, [ready, reducedMotion])

  // Mide el logo del sidebar DURANTE la entrada, en cuanto la app montó y el
  // logo tiene tamaño real — así la salida no espera a medir.
  useEffect(() => {
    if (!appReady || medido || reducedMotion) return
    if (!window.matchMedia('(min-width: 768px)').matches) { setMedido(true); return }
    let raf = 0
    const t0 = performance.now()
    const intentar = () => {
      const d = medir()
      if (d) { setDestino(d); setMedido(true); return }
      if (performance.now() - t0 >= MEDIR_MAX_MS) { setMedido(true); return }
      raf = requestAnimationFrame(intentar)
    }
    intentar()
    return () => cancelAnimationFrame(raf)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [appReady, medido, reducedMotion])

  // La salida arranca cuando AMBAS condiciones se cumplieron: el logo ya
  // terminó su entrada Y la app ya está montada debajo.
  useEffect(() => {
    if (!enterDone || !appReady || modo) return
    if (reducedMotion) { setModo('fade'); return }
    if (!medido) return
    const fresco = medir() ?? destino
    if (fresco) { setDestino(fresco); setModo('escritorio') } else setModo('movil')
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [enterDone, appReady, modo, reducedMotion, medido])

  useEffect(() => {
    if (!modo) return
    // El contenido de la app aparece al mismo tiempo que se desvanece el fondo.
    const tContenido = setTimeout(onSalida, modo === 'escritorio' ? BG_DELAY_MS : 0)
    // Red de seguridad: solo por si onAnimationComplete no dispara (p. ej. la
    // pestaña pierde foco). Holgada para no cortar una animación retrasada.
    const tSeguro = setTimeout(finish, DURACION[modo] + SEGURO_EXTRA_MS)
    return () => { clearTimeout(tContenido); clearTimeout(tSeguro) }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [modo])

  if (!ready) return null

  const dur = (modo === 'escritorio' ? VIAJE_MS : modo ? DURACION[modo] : EXIT_FADE_MS) / 1000
  const bgDelay = modo === 'escritorio' ? BG_DELAY_MS : 0
  const bgEase = modo === 'movil' ? EASE_BG_MOVIL : 'var(--ease-out)'
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
          transition: `opacity ${dur * 1000}ms ${bgEase} ${bgDelay}ms`,
        }}
      />
      <motion.div
        initial={false}
        animate={{ opacity: cedido ? 0 : 1 }}
        transition={{ duration: CAMBIO_LOGO_MS / 1000, ease: 'easeInOut' }}
        onAnimationComplete={() => { if (cedido) finish() }}
      >
        <motion.div
          ref={logoBoxRef}
          className="relative flex"
          initial={false}
          animate={objetivo}
          transition={
            modo === 'escritorio'
              ? {
                  delay: PAUSA_MS / 1000,
                  x: { duration: dur, ease: EASE_X },
                  y: { duration: dur, ease: EASE_Y },
                  scale: { duration: dur, ease: EASE_X },
                }
              : modo === 'movil'
                ? { duration: dur, ease: EASE_OUT, opacity: { duration: dur, ease: EASE_FADE_LOGO } }
                : { duration: dur, ease: EASE_OUT }
          }
          style={{ willChange: exiting ? 'transform, opacity' : undefined }}
          onAnimationComplete={() => {
            if (!exiting) return
            if (modo === 'escritorio') {
              // Llegó: el logo del sidebar aparece y el de la intro se va.
              onLanded()
              setCedido(true)
            } else {
              finish()
            }
          }}
        >
          <motion.div
            className="flex"
            initial={false}
            animate={{ opacity: fundeSidebar ? 0 : 1 }}
            transition={{ duration: dur, delay: modo === 'escritorio' ? PAUSA_MS / 1000 : 0, ease: 'easeInOut' }}
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
              transition={{ duration: dur, delay: PAUSA_MS / 1000, ease: 'easeInOut' }}
            />
          )}
        </motion.div>
      </motion.div>
    </div>
  )
}
