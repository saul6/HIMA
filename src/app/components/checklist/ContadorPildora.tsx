import { useReducedMotion } from 'motion/react'
import { useContadorAnimado } from '@/hooks/useContadorAnimado'

const redondear = (n: number) => String(Math.round(n))

/** Número de una píldora de filtro: cuenta hasta su valor (sin animar con movimiento reducido). */
export function ContadorPildora({ n }: { n: number }) {
  const reducedMotion = !!useReducedMotion()
  const ref = useContadorAnimado(n, redondear, reducedMotion)
  return <span ref={ref}>{n}</span>
}
