import { useCallback, useEffect, useRef } from 'react'
import { useReducedMotion } from 'motion/react'

// Spring compartido para microinteracciones vivas pero elegantes (pin, pastillas
// de indicador). Un solo valor en toda la app para que todas las "pastillas"
// y pops se sientan de la misma familia de movimiento.
export const SPRING_SUAVE = { type: 'spring', visualDuration: 0.35, bounce: 0.15 } as const

// Variante sin rebote — para barras/líneas de progreso, donde un overshoot
// de escala se nota como un parpadeo en vez de un rebote natural.
export const SPRING_SUAVE_SIN_REBOTE = { ...SPRING_SUAVE, bounce: 0 } as const

// Tiempos y curva de movimiento en JS: espejo de --motion-fast / --motion-base /
// --motion-slow y --ease-out de theme.css. Si cambias uno, cambia el otro.
export const DUR = { rapido: 0.15, base: 0.22, lento: 0.3 } as const

export const EASE_OUT = [0.22, 1, 0.36, 1] as const

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
