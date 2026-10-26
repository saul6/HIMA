import { useCallback, useEffect, useRef } from 'react'
import { useReducedMotion } from 'motion/react'
import { DUR, EASE_OUT } from '@/lib/motion'

// Entrada escalonada compartida (solo los primeros 8; el resto aparece sin retraso).
// Con movimiento reducido no anima: arranca ya en su estado final.
export function entrada(index: number, reducedMotion: boolean | null) {
  return {
    initial: reducedMotion ? (false as const) : { opacity: 0, y: 8 },
    animate: {
      opacity: 1, y: 0,
      transition: { duration: DUR.base, ease: EASE_OUT, delay: Math.min(index, 7) * 0.03 },
    },
  }
}

// Entrada de una pantalla grande: se dispara cuando `listo` (termina la carga) y solo
// la primera vez. Si el contenido se vuelve a montar (refetch, cambio de estado) ya no anima.
// Uso: const ent = useEntradaPantalla(!cargando); <motion.div {...ent(0)}>
export function useEntradaPantalla(listo: boolean) {
  const reducedMotion = useReducedMotion()
  const yaEntro = useRef(false)
  useEffect(() => {
    if (listo) yaEntro.current = true
  }, [listo])
  return useCallback(
    (index = 0) => entrada(index, reducedMotion || yaEntro.current),
    [reducedMotion],
  )
}

// Fundido al desplegar un panel plegable que sigue montado con `hidden`: al abrir, opacity 0 → 1;
// al plegar se oculta al instante. Solo opacity (sin animar altura). Uso: <motion.div hidden={!abierto} {...fundido}>
export function useFundidoPlegable(abierto: boolean) {
  const reducedMotion = useReducedMotion()
  return {
    initial: false as const,
    animate: { opacity: abierto ? 1 : 0 },
    transition: { duration: abierto && !reducedMotion ? DUR.rapido : 0, ease: EASE_OUT },
  }
}

// Avisos (error, sin conexión) que NO son sticky/fixed: entran con opacity + y −4 → 0 y salen con fundido.
// Usar dentro de <AnimatePresence initial={false}> con `key`.
export function avisoMotion(reducedMotion: boolean | null) {
  return {
    initial: reducedMotion ? { opacity: 0 } : { opacity: 0, y: -4 },
    animate: { opacity: 1, y: 0 },
    exit: { opacity: 0 },
    transition: { duration: reducedMotion ? 0 : DUR.rapido, ease: EASE_OUT },
  }
}

// Fundido de entrada simple (confirmaciones en línea, contenido de un panel recién abierto).
export function fundidoEntrada(reducedMotion: boolean | null) {
  return {
    initial: reducedMotion ? (false as const) : { opacity: 0 },
    animate: { opacity: 1 },
    transition: { duration: DUR.rapido, ease: EASE_OUT },
  }
}

// Scroll que respeta "reducir movimiento". Se evalúa al momento de hacer scroll, así sirve
// igual dentro y fuera de componentes.
export function comportamientoScroll(): ScrollBehavior {
  const reducido = typeof window !== 'undefined' && window.matchMedia('(prefers-reduced-motion: reduce)').matches
  return reducido ? 'auto' : 'smooth'
}

// Resalte breve del destino tras un scroll ("Ir a pregunta", "Resolver"): anillo --ring que se desvanece en
// ~600 ms. Usa la Web Animations API sobre el propio elemento: no deja temporizadores ni estado, y si el
// elemento se desmonta la animación se va con él. Con movimiento reducido el anillo aparece y se quita
// sin transición (se mantiene y desaparece de golpe).
export function resaltarDestino(el: HTMLElement) {
  const objetivo = (el.firstElementChild as HTMLElement | null) ?? el
  if (typeof objetivo.animate !== 'function') return
  const reducido = comportamientoScroll() === 'auto'
  const anillo = { outlineStyle: 'solid', outlineWidth: '2px', outlineOffset: '2px' }
  const keyframes: Keyframe[] = reducido
    ? [
        { ...anillo, outlineColor: 'var(--ring)', offset: 0 },
        { ...anillo, outlineColor: 'var(--ring)', offset: 0.999 },
        { ...anillo, outlineColor: 'transparent', offset: 1 },
      ]
    : [
        { ...anillo, outlineColor: 'var(--ring)' },
        { ...anillo, outlineColor: 'transparent' },
      ]
  objetivo.animate(keyframes, { duration: 600, delay: reducido ? 0 : 300, easing: 'cubic-bezier(0.22, 1, 0.36, 1)' })
}
