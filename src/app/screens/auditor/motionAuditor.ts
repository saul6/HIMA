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
