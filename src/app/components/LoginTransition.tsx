// Overlay de bienvenida tras un login exitoso — puramente presentacional y
// desacoplado de la lógica de auth. Montado por IntroTransitionContext por
// encima del router, así que sigue cubriendo la pantalla durante y después
// de la navegación de /login al dashboard (nunca vive dentro de Login.tsx).
// Secuencia: fade + escala del logo (~1.5s) → espera a que el destino ya
// autenticado avise que montó (`appReady`, ver Layout.tsx) → salida:
//   · escritorio (FLIP manual): el logo se queda quieto, viaja en curva y se
//     encoge hasta el logo del sidebar (`data-intro-destino="sidebar-logo"`),
//     medido durante la entrada, mientras el fondo se desvanece; al llegar,
//     el del sidebar toma su lugar con un fundido;
//   · móvil (FLIP manual): igual, hacia el logo del header de Inicio
//     (`data-intro-destino="header-logo"`), con un viaje un poco más corto;
//   · destino no disponible (p. ej. el auditor en móvil): el logo crece apenas
//     y se desvanece;
//   · prefers-reduced-motion: el logo queda quieto y el overlay hace fade.
// La salida es una secuencia imperativa (`animate` + promesas): el overlay se
// desmonta SOLO cuando la última animación terminó. No se usa
// `onAnimationComplete` de un <motion.div> porque se dispara al ARRANCAR un
// cambio de `animate` (ver nota en `salir`), lo que cortaba el viaje a medias.
// Los temporizadores son red de seguridad y terminan con fade, no con corte.
// El contenido de la app empieza a aparecer junto con el desvanecido del
// fondo (`onSalida`). Solo anima transform/opacity (y un blur leve de 4px en
// la salida móvil).

import { useEffect, useRef, useState } from 'react'
import { animate } from 'motion/react'
import { MadyLogo } from '@/app/components/MadyLogo'

const ENTER_MS = 1500
// Escritorio: pausa del logo (150) + viaje (700) + cambio por el logo del
// sidebar (120) = 970 ms de salida.
const PAUSA_MS = 150
const VIAJE_MS = 700
const VIAJE_MOVIL_MS = 550
const CAMBIO_LOGO_MS = 120
const EXIT_SIMPLE_MS = 450
const EXIT_FADE_MS = 300
// El fondo se desvanece mientras el logo viaja: empieza 100 ms después y dura 500.
const BG_DELAY_MS = 100
const BG_FADE_MS = 500
// Margen de la red de seguridad sobre la duración de la salida: si el hilo
// principal está ocupado montando la app, la animación puede ir retrasada y
// un temporizador justo la cortaría a medias.
const SEGURO_EXTRA_MS = 1500
// Cuánto esperar a que el logo del sidebar esté montado y medible.
const MEDIR_MAX_MS = 300
// Red de seguridad si `appReady` nunca llegara (p. ej. el destino no pasa
// por Layout, como /completar-organizacion) — el overlay nunca se queda
// pegado; el acceso a la app ya ocurrió de todos modos vía goToApp().
const MAX_WAIT_MS = 6000
const EASE_OUT = [0.22, 1, 0.36, 1] as const
// Curvas distintas en X y en Y para que el viaje dibuje una curva y no una
// recta. Ambas arrancan suaves (primer punto de control en y=0): una curva
// que arranca de golpe se ve como un brinco en el primer cuadro. Y se adelanta
// a X, así el logo sube primero y luego se desliza al sidebar.
const EASE_X = [0.55, 0, 0.25, 1] as const
const EASE_Y = [0.3, 0, 0.2, 1] as const
// Móvil: el logo se apaga más despacio que el fondo para que se alcance a ver.
const EASE_FADE_LOGO = [0.4, 0, 0.6, 1] as const
const EASE_BG_MOVIL = 'cubic-bezier(0.4, 0, 1, 1)'

type Modo = 'escritorio' | 'movil' | 'simple' | 'fade'

interface Destino {
  modo: 'escritorio' | 'movil'
  dx: number
  dy: number
  scale: number
  // Logo del destino (varía con el tema): se funde sobre el de la intro.
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
  movil: PAUSA_MS + VIAJE_MOVIL_MS + CAMBIO_LOGO_MS,
  simple: EXIT_SIMPLE_MS,
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
  const doneRef = useRef(false)
  const cedeRef = useRef<HTMLDivElement>(null)
  const logoBoxRef = useRef<HTMLDivElement>(null)
  const logoRef = useRef<HTMLDivElement>(null)
  const logoSidebarRef = useRef<HTMLImageElement>(null)
  const exiting = modo !== null

  function finish() {
    if (doneRef.current) return
    doneRef.current = true
    // Mismo commit: el logo del sidebar reaparece y el overlay se va.
    onLanded()
    onDone()
  }

  function medir(): Destino | null {
    // Sidebar (escritorio) o header de Inicio (móvil): el que esté visible.
    const s = logoBoxRef.current?.getBoundingClientRect()
    if (!s || s.height <= 0) return null
    let dest: HTMLElement | null = null
    let d: DOMRect | null = null
    for (const el of document.querySelectorAll<HTMLElement>('[data-intro-destino]')) {
      const rect = el.getBoundingClientRect()
      if (rect.width > 0 && rect.height > 0) { dest = el; d = rect; break }
    }
    if (!dest || !d) return null
    const destSrc = dest.getAttribute('src')
    return {
      modo: dest.dataset.introDestino === 'sidebar-logo' ? 'escritorio' : 'movil',
      dx: d.left + d.width / 2 - (s.left + s.width / 2),
      dy: d.top + d.height / 2 - (s.top + s.height / 2),
      scale: d.height / s.height,
      src: destSrc && !destSrc.includes('MADYOscuro') ? destSrc : null,
    }
  }

  useEffect(() => {
    setReducedMotion(window.matchMedia('(prefers-reduced-motion: reduce)').matches)
    setReady(true)
  }, [])

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
  // terminó su entrada Y la app ya está montada debajo. Se vuelve a medir justo
  // antes de salir; el logo parte EXACTAMENTE de donde terminó la entrada
  // (x = y = 0, scale = 1): sin cambio de layout ni de clase, sin brinco.
  useEffect(() => {
    if (!enterDone || !appReady || modo) return
    if (reducedMotion) { setModo('fade'); return }
    if (!medido) return
    const fresco = medir() ?? destino
    if (fresco) { setDestino(fresco); setModo(fresco.modo) } else setModo('simple')
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [enterDone, appReady, modo, reducedMotion, medido])

  // Secuencia de salida. Nota: con <motion.div animate={...} onAnimationComplete>
  // el callback se disparaba al ARRANCAR el cambio de `animate` (verificado
  // cuadro por cuadro: el overlay se iba con el viaje al ~80 %), y el `delay`
  // de nivel superior no llegaba a x/y/scale por tener transiciones propias.
  // Con `animate()` imperativo cada fase espera de verdad a la anterior.
  useEffect(() => {
    if (!modo) return
    const box = logoBoxRef.current
    const cede = cedeRef.current
    if (!box || !cede) { finish(); return }
    const controles: { stop: () => void }[] = []
    let cancelado = false
    const mover = <T extends { stop: () => void }>(c: T): T => { controles.push(c); return c }

    async function salir() {
      if ((modo === 'escritorio' || modo === 'movil') && destino) {
        const delay = PAUSA_MS / 1000
        const duration = (modo === 'movil' ? VIAJE_MOVIL_MS : VIAJE_MS) / 1000
        const viaje = [
          mover(animate(box!, { x: destino.dx }, { delay, duration, ease: [...EASE_X] })),
          mover(animate(box!, { y: destino.dy }, { delay, duration, ease: [...EASE_Y] })),
          mover(animate(box!, { scale: destino.scale }, { delay, duration, ease: [...EASE_X] })),
        ]
        if (destino.src && logoRef.current && logoSidebarRef.current) {
          // Cambio de tema del logo (oscuro → claro) mientras viaja.
          viaje.push(
            mover(animate(logoRef.current, { opacity: 0 }, { delay, duration, ease: 'easeInOut' })),
            mover(animate(logoSidebarRef.current, { opacity: 1 }, { delay, duration, ease: 'easeInOut' })),
          )
        }
        await Promise.all(viaje)
        if (cancelado) return
        // Llegó: el logo del sidebar aparece (fundido + asentamiento) y el de
        // la intro se va.
        onLanded()
        await mover(animate(cede!, { opacity: 0 }, { duration: CAMBIO_LOGO_MS / 1000, ease: 'easeInOut' }))
      } else if (modo === 'simple') {
        const duration = EXIT_SIMPLE_MS / 1000
        await Promise.all([
          mover(animate(box!, { scale: 1.08 }, { duration, ease: [...EASE_OUT] })),
          mover(animate(box!, { opacity: 0, filter: 'blur(4px)' }, { duration, ease: [...EASE_FADE_LOGO] })),
        ])
      } else {
        await mover(animate(box!, { opacity: 0 }, { duration: EXIT_FADE_MS / 1000, ease: 'easeOut' }))
      }
      if (!cancelado) finish()
    }
    salir()

    // El contenido de la app aparece al mismo tiempo que se desvanece el fondo.
    const viaja = modo === 'escritorio' || modo === 'movil'
    const tContenido = setTimeout(onSalida, viaja ? BG_DELAY_MS : 0)
    // Red de seguridad: solo por si las animaciones no terminan (p. ej. la
    // pestaña pierde foco). Holgada para no cortar una animación retrasada.
    const tSeguro = setTimeout(finish, DURACION[modo] + SEGURO_EXTRA_MS)
    return () => {
      cancelado = true
      controles.forEach(c => c.stop())
      clearTimeout(tContenido)
      clearTimeout(tSeguro)
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [modo])

  if (!ready) return null

  const viajando = modo === 'escritorio' || modo === 'movil'
  const bgMs = viajando ? BG_FADE_MS : modo ? DURACION[modo] : EXIT_FADE_MS
  const bgDelay = viajando ? BG_DELAY_MS : 0
  const bgEase = modo === 'simple' ? EASE_BG_MOVIL : 'var(--ease-out)'

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
          transition: `opacity ${bgMs}ms ${bgEase} ${bgDelay}ms`,
        }}
      />
      <div ref={cedeRef}>
        <div
          ref={logoBoxRef}
          className="relative flex"
          style={{ willChange: exiting ? 'transform, opacity' : undefined }}
        >
          <div ref={logoRef} className="flex">
            {/* +40% vs. la v11 (84px → 118px), mismo fade+escala de entrada */}
            <MadyLogo theme="dark" className="auth-intro-logo" style={{ height: 118, width: 'auto' }} />
          </div>
          {viajando && destino?.src && (
            <img
              ref={logoSidebarRef}
              src={destino.src}
              alt=""
              className="absolute inset-0 h-full w-full"
              style={{ objectFit: 'contain', opacity: 0 }}
            />
          )}
        </div>
      </div>
    </div>
  )
}
