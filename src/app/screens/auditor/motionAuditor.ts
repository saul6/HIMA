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
